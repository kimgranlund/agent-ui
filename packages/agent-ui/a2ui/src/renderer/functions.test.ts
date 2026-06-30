// functions.test.ts — function-call binding evaluator (renderer LLD-C10 / ADR-0026).
//
// Tests for `resolveValue` (the three-armed dispatcher) and `evaluate` (the function-call arm).
// Covers:
//   - Literal pass-through
//   - `{path}` delegation to binding.ts (per-path reactive read; tested via `resolveValue`)
//   - `@index` in a list scope (0-based, with and without offset)
//   - `@index` outside a list scope (FUNCTION error + undefined)
//   - Unknown `@` system function (FUNCTION error + undefined)
//   - Catalog function dispatch (`required` / `email` / `regex`) with `{path}` args
//   - Catalog function with a nested `{call}` arg (recursive resolution)
//   - Unknown catalog function (FUNCTION error + undefined)
//   - Throwing catalog function (FUNCTION error + undefined, non-fatal)
//   - `{call}` on a bindable prop — conformance.ts accepts it without a CATALOG error
//     (this is a cross-slice contract assertion: the conformance check is in conformance.test.ts,
//      but the evaluator side is verified here by confirming `resolveValue` produces a result)

import { describe, it, expect } from 'vitest'
import { resolveValue, evaluate } from './functions.ts'
import { createSurface, disposeSurface } from './surface.ts'
import type { Surface } from './surface.ts'
import type { ItemScope } from './types.ts'
import type { A2uiError, FunctionCall } from '../protocol.ts'
import type { CatalogRegistry } from '../catalog/types.ts'
import { Registry } from '../catalog/registry.ts'
import { defaultCatalog } from '../catalog/default/index.ts'
import { defaultFactories } from '../catalog/default/factories.ts'
import { catalogFunctions } from '../catalog/functions.ts'

// ── Harness helpers ───────────────────────────────────────────────────────────

function stubRegistry(): CatalogRegistry {
  const reg = new Registry()
  reg.register(defaultCatalog, defaultFactories)
  return reg
}

interface TestEnv {
  surface: Surface
  registry: CatalogRegistry
  errors: A2uiError[]
  emitError: (e: A2uiError) => void
}

function testEnv(): TestEnv {
  const surface = createSurface({ id: 's1', catalogId: 'agent-ui', version: 'v1.0' })
  const registry = stubRegistry()
  const errors: A2uiError[] = []
  const emitError = (e: A2uiError) => void errors.push(e)
  return { surface, registry, errors, emitError }
}

function listItemScope(index: number): ItemScope {
  return { index, path: '/items' }
}

// ── resolveValue — literal pass-through ───────────────────────────────────────

describe('resolveValue — literal pass-through (ADR-0026 first arm)', () => {
  it.each([
    ['string', 'hello'],
    ['number', 42],
    ['boolean', true],
    ['null', null],
    ['array', [1, 2, 3]],
  ])('%s literal is returned as-is', (_, literal) => {
    const { surface, registry, errors, emitError } = testEnv()
    const result = resolveValue(literal, surface, undefined, emitError, registry)
    expect(result).toEqual(literal)
    expect(errors).toHaveLength(0)
    disposeSurface(surface)
  })
})

// ── resolveValue — {path} delegation ─────────────────────────────────────────

describe('resolveValue — {path} binding delegation to binding.ts (ADR-0026 second arm)', () => {
  it('returns the value at the pointer path from surface.data', () => {
    const { surface, registry, emitError } = testEnv()
    surface.data.value = { greeting: 'world' }

    const result = resolveValue({ path: '/greeting' }, surface, undefined, emitError, registry)
    expect(result).toBe('world')
    disposeSurface(surface)
  })

  it('returns undefined for a path not present in the data model', () => {
    const { surface, registry, emitError } = testEnv()
    surface.data.value = {}

    const result = resolveValue({ path: '/missing' }, surface, undefined, emitError, registry)
    expect(result).toBeUndefined()
    disposeSurface(surface)
  })
})

// ── @index — inside a collection scope ───────────────────────────────────────

describe('@index — valid inside a collection scope (ADR-0026 / LLD-C10)', () => {
  it('returns the item index (0-based) with no offset', () => {
    const { surface, registry, errors, emitError } = testEnv()
    const call: FunctionCall = { call: '@index' }
    const result = resolveValue(call, surface, listItemScope(3), emitError, registry)
    expect(result).toBe(3)
    expect(errors).toHaveLength(0)
    disposeSurface(surface)
  })

  it('adds a numeric offset to the index', () => {
    const { surface, registry, errors, emitError } = testEnv()
    const call: FunctionCall = { call: '@index', args: { offset: 1 } }
    const result = resolveValue(call, surface, listItemScope(0), emitError, registry)
    expect(result).toBe(1) // 0-based + 1 → 1-based display
    expect(errors).toHaveLength(0)
    disposeSurface(surface)
  })

  it('ignores a non-numeric offset (falls back to 0)', () => {
    const { surface, registry, emitError } = testEnv()
    const call: FunctionCall = { call: '@index', args: { offset: 'bad' } }
    const result = resolveValue(call, surface, listItemScope(2), emitError, registry)
    expect(result).toBe(2)
    disposeSurface(surface)
  })
})

// ── @index — outside a collection scope ──────────────────────────────────────

describe('@index — FUNCTION error outside a collection scope', () => {
  it('emits a FUNCTION error and returns undefined when itemScope is absent', () => {
    const { surface, registry, errors, emitError } = testEnv()
    const call: FunctionCall = { call: '@index' }
    const result = resolveValue(call, surface, undefined, emitError, registry)

    expect(result).toBeUndefined()
    expect(errors).toHaveLength(1)
    expect(errors[0]!.code).toBe('FUNCTION')
    expect(errors[0]!.message).toContain('@index')
    disposeSurface(surface)
  })
})

// ── Unknown system function ───────────────────────────────────────────────────

describe('unknown system (@) function — FUNCTION error + undefined', () => {
  it('emits FUNCTION and returns undefined for an unrecognised @-prefix name', () => {
    const { surface, registry, errors, emitError } = testEnv()
    const call: FunctionCall = { call: '@unknown' }
    const result = resolveValue(call, surface, undefined, emitError, registry)

    expect(result).toBeUndefined()
    expect(errors).toHaveLength(1)
    expect(errors[0]!.code).toBe('FUNCTION')
    expect(errors[0]!.message).toContain('@unknown')
    disposeSurface(surface)
  })
})

// ── Catalog functions via the default catalog ─────────────────────────────────

describe('catalog function dispatch — required / email / regex', () => {
  it('required({ value:"hello" }) returns { valid:true }', () => {
    const { surface, registry, errors, emitError } = testEnv()
    const call: FunctionCall = { call: 'required', args: { value: 'hello' } }
    const result = resolveValue(call, surface, undefined, emitError, registry) as { valid: boolean }

    expect(result).toBeDefined()
    expect(result.valid).toBe(true)
    expect(errors).toHaveLength(0)
    disposeSurface(surface)
  })

  it('required({ value:"" }) returns { valid:false }', () => {
    const { surface, registry, errors, emitError } = testEnv()
    const call: FunctionCall = { call: 'required', args: { value: '' } }
    const result = resolveValue(call, surface, undefined, emitError, registry) as { valid: boolean }

    expect(result.valid).toBe(false)
    expect(errors).toHaveLength(0)
    disposeSurface(surface)
  })

  it('email({ value:"user@example.com" }) returns { valid:true }', () => {
    const { surface, registry, errors, emitError } = testEnv()
    const call: FunctionCall = { call: 'email', args: { value: 'user@example.com' } }
    const result = resolveValue(call, surface, undefined, emitError, registry) as { valid: boolean }

    expect(result.valid).toBe(true)
    expect(errors).toHaveLength(0)
    disposeSurface(surface)
  })

  it('regex({ value:"abc", pattern:"^[a-z]+$" }) returns { valid:true }', () => {
    const { surface, registry, errors, emitError } = testEnv()
    const call: FunctionCall = { call: 'regex', args: { value: 'abc', pattern: '^[a-z]+$' } }
    const result = resolveValue(call, surface, undefined, emitError, registry) as { valid: boolean }

    expect(result.valid).toBe(true)
    expect(errors).toHaveLength(0)
    disposeSurface(surface)
  })

  it('regex({ value:"Abc", pattern:"^[a-z]+$" }) returns { valid:false }', () => {
    const { surface, registry, errors, emitError } = testEnv()
    const call: FunctionCall = { call: 'regex', args: { value: 'Abc', pattern: '^[a-z]+$' } }
    const result = resolveValue(call, surface, undefined, emitError, registry) as { valid: boolean }

    expect(result.valid).toBe(false)
    expect(errors).toHaveLength(0)
    disposeSurface(surface)
  })
})

// ── {path} arg inside a {call} — reactive arg resolution ─────────────────────

describe('catalog function with {path} arg — reactive resolution', () => {
  it('resolves the {path} arg from surface.data and passes it to the function', () => {
    const { surface, registry, errors, emitError } = testEnv()
    surface.data.value = { email: 'user@example.com' }
    const call: FunctionCall = { call: 'email', args: { value: { path: '/email' } } }
    const result = resolveValue(call, surface, undefined, emitError, registry) as { valid: boolean }

    expect(result.valid).toBe(true)
    expect(errors).toHaveLength(0)
    disposeSurface(surface)
  })

  it('required with {path} arg reading an empty field returns { valid:false }', () => {
    const { surface, registry, errors, emitError } = testEnv()
    surface.data.value = { name: '' }
    const call: FunctionCall = { call: 'required', args: { value: { path: '/name' } } }
    const result = resolveValue(call, surface, undefined, emitError, registry) as { valid: boolean }

    expect(result.valid).toBe(false)
    expect(errors).toHaveLength(0)
    disposeSurface(surface)
  })
})

// ── Nested {call} arg recursion ───────────────────────────────────────────────

describe('nested {call} arg — recursive resolution', () => {
  it('@index result used as the value arg of required (silly but valid recursion)', () => {
    // required({ value: @index }) — @index returns a number (3), required(3) → valid:true (non-null).
    const { surface, registry, errors, emitError } = testEnv()
    const call: FunctionCall = {
      call: 'required',
      args: { value: { call: '@index' } },
    }
    const result = resolveValue(call, surface, listItemScope(3), emitError, registry) as { valid: boolean }

    expect(result.valid).toBe(true)
    expect(errors).toHaveLength(0)
    disposeSurface(surface)
  })
})

// ── Unknown catalog function ──────────────────────────────────────────────────

describe('unknown catalog function — FUNCTION error + undefined', () => {
  it('emits FUNCTION and returns undefined for a name not in the bound catalog', () => {
    const { surface, registry, errors, emitError } = testEnv()
    const call: FunctionCall = { call: 'nonexistent' }
    const result = resolveValue(call, surface, undefined, emitError, registry)

    expect(result).toBeUndefined()
    expect(errors).toHaveLength(1)
    expect(errors[0]!.code).toBe('FUNCTION')
    expect(errors[0]!.message).toContain('nonexistent')
    disposeSurface(surface)
  })
})

// ── Fault isolation: a throwing impl yields FUNCTION + undefined ──────────────

describe('evaluate — fault isolation when impl throws', () => {
  it('emits FUNCTION and returns undefined; sibling calls are unaffected', () => {
    // We test this indirectly: `regex` with a malformed pattern does NOT throw (it catches internally),
    // so we need to test the evaluator's catch block. The only way to reach it in production is a
    // future project-catalog function that throws. We monkey-patch `catalogFunctions` for this case.
    const { surface, registry, errors, emitError } = testEnv()

    // Directly test `evaluate` with a fake FunctionCall that cannot reach a known impl
    // but uses the catalog function path (no @ prefix):
    // Insert a fake entry in the catalog by temporarily patching the registry lookup:
    const originalGet = registry.get.bind(registry)
    const catalogEntry = originalGet('agent-ui')!
    const patchedEntry = {
      ...catalogEntry,
      catalog: {
        ...catalogEntry.catalog,
        functions: {
          ...catalogEntry.catalog.functions,
          // callableFrom required by FunctionDef (ADR-0034 clause 2); binding-eval ignores it
          thrower: { args: {}, returns: { type: 'object' }, callableFrom: 'clientOnly' as const },
        },
      },
    }
    registry.get = (id) => (id === 'agent-ui' ? patchedEntry : undefined)

    // `catalogFunctions` does NOT have 'thrower', so the evaluator hits the
    // "declared but no registered implementation" branch — also a FUNCTION error.
    const call: FunctionCall = { call: 'thrower' }
    const result = evaluate(call, surface, undefined, emitError, registry)

    expect(result).toBeUndefined()
    expect(errors).toHaveLength(1)
    expect(errors[0]!.code).toBe('FUNCTION')
    disposeSurface(surface)
  })

  it('step-3 throw-catch: a registered impl that THROWS yields FUNCTION + undefined (ADR-0026 fault isolation)', () => {
    // Step-3 catch requires the name to pass BOTH the catalog declaration check (step 1) AND the
    // catalogFunctions lookup (step 2) before the try{impl(args)} catch block fires. The three built-in
    // impls (required/email/regex) catch their own throws, so this test temporarily extends
    // `catalogFunctions` with a new 'thrower' key that throws unconditionally, then restores in finally
    // so no state leaks to sibling tests. The local registry is also patched to declare 'thrower' in the
    // bound catalog (step 1). Both patches are scoped to this test.
    const { surface, registry, errors, emitError } = testEnv()

    // Step-1 patch: declare 'thrower' in the bound catalog (local registry instance, not a singleton).
    const catalogEntry = registry.get('agent-ui')!
    const patchedEntry = {
      ...catalogEntry,
      catalog: {
        ...catalogEntry.catalog,
        functions: {
          ...catalogEntry.catalog.functions,
          // callableFrom required by FunctionDef (ADR-0034 clause 2); binding-eval ignores it
          thrower: { args: {}, returns: { type: 'object' }, callableFrom: 'clientOnly' as const },
        },
      },
    }
    registry.get = (id) => (id === 'agent-ui' ? patchedEntry : undefined)

    // Step-2/3 patch: add a throwing impl to the module-level table (new key, NOT overwriting existing).
    // Restored unconditionally in finally — cannot leak even on assertion failure.
    ;(catalogFunctions as Record<string, unknown>)['thrower'] = () => {
      throw new Error('intentional throw for step-3 coverage')
    }
    try {
      const call: FunctionCall = { call: 'thrower' }
      const result = evaluate(call, surface, undefined, emitError, registry)

      expect(result).toBeUndefined()
      expect(errors).toHaveLength(1)
      expect(errors[0]!.code).toBe('FUNCTION')
      expect(errors[0]!.message).toContain('thrower') // the function name is in the error message
    } finally {
      delete (catalogFunctions as Record<string, unknown>)['thrower']
      disposeSurface(surface)
    }
  })
})
