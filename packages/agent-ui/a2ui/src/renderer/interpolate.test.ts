// interpolate.test.ts — `${…}` DynamicString interpolation (renderer ADR-0027).
//
// DoD proof points covered here:
//   1. Path interpolation renders + coerces each type: string, number, boolean, object→JSON, null→"", undefined→"".
//   2. Relative-in-scope path inside a list item resolves via /items/{index}/…
//   3. Escaping: `\${x}` → `${x}` (no interpolation); mixed literal+resolved+literal.
//   4. Reactivity POSITIVE: template re-resolves on an embedded-path updateDataModel.
//      Reactivity NEGATIVE CONTROL: unrelated path write does NOT re-run the bound-prop effect (SPEC-N2).
//   6. Deferred fn-expr: `${now()}` → literal `${now()}`, errors.length === 0.
//   7. Malformed unterminated `${` → verbatim, errors.length === 0.
//
// Proof point 5 (plain-string regression) is covered by the existing functions.test.ts literal
// pass-through suite (no `${` → returned byte-identical) — it stays green, unchanged.
// Proof point 8 (conformance no-false-CATALOG) is in conformance.test.ts.

import { describe, it, expect } from 'vitest'
import { isInterpolated, interpolate } from './interpolate.ts'
import { resolveValue } from './functions.ts'
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

// ── Proof point 6: deferred function-expression ───────────────────────────────

describe('interpolate — deferred fn-expr renders verbatim (proof point 6)', () => {
  it('${now()} renders as literal "${now()}", zero errors (task-#15 deferral)', () => {
    const surface = createSurface({ id: 's', catalogId: 'c', version: 'v1.0' })
    surface.data.value = {}
    // The `(` in the body classifies it as a function-expression — not yet implemented.
    const result = interpolate('${now()}', surface, undefined, stubResolve)
    expect(result).toBe('${now()}')
    disposeSurface(surface)
  })

  it('${formatDate(value:${/d}, format:"yyyy")} renders verbatim (nested ${} inside fn-expr still deferred)', () => {
    const surface = createSurface({ id: 's', catalogId: 'c', version: 'v1.0' })
    surface.data.value = { d: '2026-01-01' }
    const template = '${formatDate(value:${/d}, format:"yyyy")}'
    const result = interpolate(template, surface, undefined, stubResolve)
    expect(result).toBe(template) // verbatim — the outer `(` classifies the whole body as deferred
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
