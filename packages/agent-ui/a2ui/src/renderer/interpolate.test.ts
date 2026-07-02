// interpolate.test.ts — `${…}` DynamicString interpolation (renderer ADR-0027).
//
// DoD proof points covered here:
//   1. Path interpolation renders + coerces each type: string, number, boolean, object→JSON, null→"", undefined→"".
//   2. Relative-in-scope path inside a list item resolves via /items/{index}/…
//   3. Escaping: `\${x}` → `${x}` (no interpolation); mixed literal+resolved+literal.
//   4. Reactivity POSITIVE: template re-resolves on an embedded-path updateDataModel.
//      Reactivity NEGATIVE CONTROL: unrelated path write does NOT re-run the bound-prop effect (SPEC-N2).
//   6. fn-expr evaluation (ADR-0028): unknown fn → "" + FUNCTION error; registered fn → coerced result.
//   7. Malformed unterminated `${` → verbatim, errors.length === 0.
//
// Proof point 5 (plain-string regression) is covered by the existing functions.test.ts literal
// pass-through suite (no `${` → returned byte-identical) — it stays green, unchanged.
// Proof point 8 (conformance no-false-CATALOG) is in conformance.test.ts.

import { describe, it, expect } from 'vitest'
import { isInterpolated, interpolate } from './interpolate.ts'
import { resolveValue } from './functions.ts'
import { catalogFunctions } from '../catalog/functions.ts'
import { makeCreateWidget } from './widget.ts'
import { createSurface, disposeSurface } from './surface.ts'
import { resolve, setPointer } from './binding.ts'
import { whenFlushed } from '@agent-ui/components'
import type { A2uiComponent, A2uiError } from '../protocol.ts'
import type { CatalogEntry, CatalogRegistry, WidgetFactory } from '../catalog/types.ts'
import type { ItemScope } from './types.ts'
import type { Surface } from './surface.ts'

// ── Helpers ───────────────────────────────────────────────────────────────────

const comp = (c: Record<string, unknown>): A2uiComponent => c as A2uiComponent

/** Stub resolve for unit tests: reads a flat key off surface.data (tracks data reactively via resolve). */
const stubResolve = (binding: { path: string }, surface: Surface, itemScope?: ItemScope) =>
  resolve(binding, surface, itemScope)

/** A factory that creates a real element and records every applyProp call. */
function stubFactory(tag = 'ui-text'): { factory: WidgetFactory; applied: { prop: string; value: unknown }[] } {
  const applied: { prop: string; value: unknown }[] = []
  const factory: WidgetFactory = {
    tag,
    create: () => document.createElement(tag),
    applyProp: (_, prop, value) => void applied.push({ prop, value }),
  }
  return { factory, applied }
}

/** A registry that resolves exactly `catalogId` to `factories`. */
function stubRegistry(catalogId: string, factories: Record<string, WidgetFactory>): CatalogRegistry {
  const entry = { factories } as unknown as CatalogEntry
  return {
    register: () => {},
    get: (id) => (id === catalogId ? entry : undefined),
    supportedCatalogIds: () => [catalogId],
    submitGateSelector: () => '',
  }
}

/**
 * A harness that wires the REAL `resolveValue` (with the interpolate hook) so bound-prop effects
 * correctly track per-path memos — needed for the reactivity proof points (4+).
 */
function reactiveHarness() {
  const { factory, applied } = stubFactory('ui-text')
  const errors: A2uiError[] = []
  const registry = stubRegistry('demo', { Text: factory })
  const emitError = (e: A2uiError) => void errors.push(e)
  const createWidget = makeCreateWidget({
    registry,
    emitError,
    resolveValue: (v, s, is) => resolveValue(v, s, is, emitError, registry),
  })
  const surface = createSurface({ id: 's1', catalogId: 'demo', version: 'v1.0' })
  return { applied, errors, createWidget, surface }
}

// ── isInterpolated ────────────────────────────────────────────────────────────

describe('isInterpolated — unescaped-${-detection guard', () => {
  it.each([
    ['plain string', 'hello', false],
    ['empty string', '', false],
    ['escaped only', '\\${x}', false],
    ['escaped mid-string', 'a\\${b}c', false],
    ['single unescaped', '${/x}', true],
    ['unescaped at start', '${x}', true],
    ['mixed: escaped then unescaped', '\\${a} ${/b}', true],
    ['dollar no brace', 'price $5', false],
  ])('%s', (_, s, expected) => {
    expect(isInterpolated(s)).toBe(expected)
  })
})

// ── Proof point 1: coercion table ────────────────────────────────────────────

describe('interpolate — coercion table (ADR-0027 §3.5, proof point 1)', () => {
  it('string value → itself', () => {
    const surface = createSurface({ id: 's', catalogId: 'c', version: 'v1.0' })
    surface.data.value = { name: 'Alice' }
    expect(interpolate('Hello ${/name}!', surface, undefined, stubResolve)).toBe('Hello Alice!')
    disposeSurface(surface)
  })

  it('number value → String(v)', () => {
    const surface = createSurface({ id: 's', catalogId: 'c', version: 'v1.0' })
    surface.data.value = { count: 42 }
    expect(interpolate('Count: ${/count}', surface, undefined, stubResolve)).toBe('Count: 42')
    disposeSurface(surface)
  })

  it('boolean value → String(v)', () => {
    const surface = createSurface({ id: 's', catalogId: 'c', version: 'v1.0' })
    surface.data.value = { active: true }
    expect(interpolate('Active: ${/active}', surface, undefined, stubResolve)).toBe('Active: true')
    disposeSurface(surface)
  })

  it('object value → JSON.stringify(v)', () => {
    const surface = createSurface({ id: 's', catalogId: 'c', version: 'v1.0' })
    surface.data.value = { obj: { a: 1 } }
    expect(interpolate('Data: ${/obj}', surface, undefined, stubResolve)).toBe('Data: {"a":1}')
    disposeSurface(surface)
  })

  it('null value → "" (the empty-string sentinel, NOT "null")', () => {
    const surface = createSurface({ id: 's', catalogId: 'c', version: 'v1.0' })
    surface.data.value = { mid: null }
    // NON-VACUOUS: if coerce used String(null) this would be "null", not "".
    expect(interpolate('${/mid}', surface, undefined, stubResolve)).toBe('')
    disposeSurface(surface)
  })

  it('undefined (missing path) → "" (the empty-string sentinel, NOT "undefined")', () => {
    const surface = createSurface({ id: 's', catalogId: 'c', version: 'v1.0' })
    surface.data.value = {}
    // NON-VACUOUS: String(undefined) = "undefined"; correct coercion = "".
    expect(interpolate('${/missing}', surface, undefined, stubResolve)).toBe('')
    disposeSurface(surface)
  })

  it('multiple segments of different types concatenated in source order', () => {
    const surface = createSurface({ id: 's', catalogId: 'c', version: 'v1.0' })
    surface.data.value = { name: 'Alice', age: 30 }
    expect(interpolate('${/name} is ${/age}', surface, undefined, stubResolve)).toBe('Alice is 30')
    disposeSurface(surface)
  })
})

// ── Proof point 2: relative-in-scope path resolution ─────────────────────────

describe('interpolate — relative path in a collection scope (proof point 2)', () => {
  it('resolves a relative path body to /items/{index}/… via itemScope', () => {
    const surface = createSurface({ id: 's', catalogId: 'c', version: 'v1.0' })
    surface.data.value = { items: [{ label: 'first' }, { label: 'second' }] }
    const itemScope: ItemScope = { path: '/items', index: 1 }
    // `${label}` is relative — binding.ts scopedPointer rewrites it to /items/1/label.
    expect(interpolate('Item: ${label}', surface, itemScope, stubResolve)).toBe('Item: second')
    disposeSurface(surface)
  })

  it('an absolute path inside a collection scope resolves from root (not the item)', () => {
    const surface = createSurface({ id: 's', catalogId: 'c', version: 'v1.0' })
    surface.data.value = { title: 'ROOT', items: [{ label: 'a' }] }
    const itemScope: ItemScope = { path: '/items', index: 0 }
    expect(interpolate('${/title}: ${label}', surface, itemScope, stubResolve)).toBe('ROOT: a')
    disposeSurface(surface)
  })
})

// ── Proof point 3: escaping + mixed ──────────────────────────────────────────

describe('interpolate — escaping and mixed segments (proof point 3)', () => {
  it('\\${ emits literal ${ (no interpolation)', () => {
    const surface = createSurface({ id: 's', catalogId: 'c', version: 'v1.0' })
    surface.data.value = { x: 'SHOULD NOT APPEAR' }
    // s contains backslash-dollar-brace, i.e. the escape sequence.
    expect(interpolate('show \\${x} literally', surface, undefined, stubResolve)).toBe('show ${x} literally')
    disposeSurface(surface)
  })

  it('mixed: literal + resolved + literal concatenated in source order', () => {
    const surface = createSurface({ id: 's', catalogId: 'c', version: 'v1.0' })
    surface.data.value = { x: 'Y' }
    expect(interpolate('a ${/x} b', surface, undefined, stubResolve)).toBe('a Y b')
    disposeSurface(surface)
  })

  it('escaped then unescaped in the same string: \\${ followed by ${/x}', () => {
    const surface = createSurface({ id: 's', catalogId: 'c', version: 'v1.0' })
    surface.data.value = { x: 'resolved' }
    expect(interpolate('\\${literal} ${/x}', surface, undefined, stubResolve)).toBe('${literal} resolved')
    disposeSurface(surface)
  })
})

// ── Proof point 4: reactivity positive + negative control ─────────────────────

describe('interpolate — reactivity proof (proof point 4, SPEC-N2)', () => {
  it('POSITIVE: template re-resolves when the embedded path changes (updateDataModel)', async () => {
    const { applied, createWidget, surface } = reactiveHarness()
    surface.data.value = { name: 'Alice' }

    createWidget(comp({ id: 't1', component: 'Text', text: 'Hello ${/name}!' }), surface)
    expect(applied.at(-1)).toEqual({ prop: 'text', value: 'Hello Alice!' })

    surface.data.value = setPointer(surface.data.peek(), '/name', 'Bob')
    await whenFlushed()
    expect(applied.at(-1)).toEqual({ prop: 'text', value: 'Hello Bob!' })
    disposeSurface(surface)
  })

  it('NEGATIVE CONTROL: unrelated path write does NOT re-run the bound-prop effect (SPEC-N2 per-path waking)', async () => {
    // The template binds only `/name`. Writing to `/other` (structural-sharing setPointer) keeps the
    // `/name` path-computed Object.is-equal → the bound-prop effect verifies "unchanged" and skips.
    // This is the SPEC-N2 per-path waking proof: the template does NOT re-resolve on every write.
    const { applied, createWidget, surface } = reactiveHarness()
    surface.data.value = { name: 'Alice', other: 1 }

    createWidget(comp({ id: 't1', component: 'Text', text: 'Hello ${/name}!' }), surface)
    const textApplies = () => applied.filter((a) => a.prop === 'text').length

    expect(textApplies()).toBe(1) // initial synchronous apply only

    surface.data.value = setPointer(surface.data.peek(), '/other', 2)
    await whenFlushed()

    // NON-VACUOUS: without per-path waking the text effect would re-run on ANY data write,
    // producing a second entry. The `Object.is` cutoff on the `/name` computed keeps it asleep.
    expect(textApplies()).toBe(1) // still 1 — the unrelated /other write did not re-apply the text
    disposeSurface(surface)
  })
})

// ── Proof point 6: function-expression evaluation (ADR-0028) ─────────────────
//
// 6a: a call whose name is absent from the catalog → evaluate emits FUNCTION + returns undefined
//     → coerce(undefined) = "" → result is "" + one error.
// 6b: a call whose impl IS registered → evaluate resolves → coerce → interpolated string, zero errors.
// 6c: a positional/unnamed-arg call (Fork 1, deferred #18) → parseFunctionExpr returns null →
//     render-literally with ZERO errors (it is a deferred grammar form, not an unknown function).

describe('interpolate — fn-expr evaluation (proof point 6, ADR-0028)', () => {
  it('${now()} with no "now" in catalog → "" + FUNCTION error (proof point 6a)', () => {
    const surface = createSurface({ id: 's', catalogId: 'c', version: 'v1.0' })
    surface.data.value = {}
    const errors: A2uiError[] = []
    const emitError = (e: A2uiError) => void errors.push(e)
    // Registry keyed to 'demo', not 'c' → registry.get('c') = undefined → FUNCTION error.
    const registry = stubRegistry('demo', {})
    // NON-VACUOUS: the old (task-#13) assertion was '${now()}' (verbatim); now it must be "".
    const result = interpolate('${now()}', surface, undefined, stubResolve, emitError, registry)
    expect(result).toBe('') // undefined from evaluate → coerce → ''
    expect(errors).toHaveLength(1)
    expect(errors[0]!.code).toBe('FUNCTION')
    expect(errors[0]!.message).toContain('now')
    disposeSurface(surface)
  })

  it('${formatDate(value:${/d}, format:"yyyy")} with registered impl → coerced string (proof point 6b)', () => {
    // Hermetic: add a stub formatDate to catalogFunctions, restored unconditionally in finally.
    ;(catalogFunctions as Record<string, (args: Record<string, unknown>) => unknown>)['formatDate'] =
      (args) => `${String(args.value)}_${String(args.format)}`

    const surface = createSurface({ id: 's', catalogId: 'c', version: 'v1.0' })
    surface.data.value = { d: '2026-01-01' }

    // Minimal catalog entry that declares formatDate in its functions map.
    const testEntry = {
      catalog: {
        catalogId: 'c', protocolVersion: 'v1.0', components: {},
        functions: { formatDate: { args: {}, returns: { type: 'string' } } },
      },
      factories: {},
    }
    const registry: CatalogRegistry = {
      register: () => {},
      get: (id) => (id === 'c' ? testEntry as unknown as CatalogEntry : undefined),
      supportedCatalogIds: () => ['c'],
      submitGateSelector: () => '',
    }

    const errors: A2uiError[] = []
    const emitError = (e: A2uiError) => void errors.push(e)

    try {
      // NON-VACUOUS: the old assertion was the template string verbatim; now it resolves.
      const result = interpolate(
        '${formatDate(value:${/d}, format:"yyyy")}',
        surface, undefined, stubResolve, emitError, registry,
      )
      expect(result).toBe('2026-01-01_yyyy')
      expect(errors).toHaveLength(0)
    } finally {
      delete (catalogFunctions as Record<string, unknown>)['formatDate']
      disposeSurface(surface)
    }
  })

  it('${upper(${now()})} — positional arg (Fork 1, #18) → verbatim, ZERO errors (proof point 6c)', () => {
    // `upper` receives the result of `${now()}` as an UNNAMED positional arg (no `name:` prefix).
    // parseFunctionExpr('upper(${now()})') detects no top-level ':' in the arg → positional → null.
    // The classifier falls back to render-literally with no error — this is NOT a FUNCTION error:
    // the evaluator is never called, so unknown-fn detection never fires.
    // NON-VACUOUS: if we mistakenly called evaluate, it would emit a FUNCTION error for 'upper'.
    const surface = createSurface({ id: 's', catalogId: 'c', version: 'v1.0' })
    surface.data.value = {}
    const errors: A2uiError[] = []
    const emitError = (e: A2uiError) => void errors.push(e)
    const registry = stubRegistry('demo', {})
    const template = '${upper(${now()})}'
    const result = interpolate(template, surface, undefined, stubResolve, emitError, registry)
    expect(result).toBe(template) // render-literally — deferred grammar form
    expect(errors).toHaveLength(0) // zero errors — parseFunctionExpr returned null, evaluate never called
    disposeSurface(surface)
  })
})

// ── Proof point 7: malformed / unterminated `${` ──────────────────────────────

describe('interpolate — malformed unterminated ${ renders verbatim (proof point 7)', () => {
  it('unterminated ${ at the end of the string is emitted verbatim, zero errors', () => {
    const surface = createSurface({ id: 's', catalogId: 'c', version: 'v1.0' })
    surface.data.value = {}
    const result = interpolate('prefix ${unterminated', surface, undefined, stubResolve)
    expect(result).toBe('prefix ${unterminated')
    disposeSurface(surface)
  })

  it('unterminated ${ mid-string: chars after ${ accumulate as verbatim', () => {
    const surface = createSurface({ id: 's', catalogId: 'c', version: 'v1.0' })
    surface.data.value = {}
    const result = interpolate('a ${open and more text', surface, undefined, stubResolve)
    expect(result).toBe('a ${open and more text')
    disposeSurface(surface)
  })
})
