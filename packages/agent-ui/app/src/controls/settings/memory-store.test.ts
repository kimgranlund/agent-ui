// memory-store.test.ts — GH #959 (remaining slice) parity pins for `createMemoryStore({ persistKey })`'s
// migration onto `@agent-ui/shared`'s `StorageAdapter` seam (ADR-0193). `store.test.ts` carries the
// pre-migration behavioural suite UNCHANGED (sync construct→get, cross-instance visibility, corrupt-value
// fail-open, trailing-dot namespacing); this file pins what the migration must additionally hold:
//   1. byte-identical serialization — the seam writes the SAME `${persistKey}.${key}` → `JSON.stringify`
//      bytes the pre-migration direct `localStorage.setItem` wrote, observable SYNCHRONOUSLY after `set`;
//   2. the two modules agree in BOTH directions — what `createLocalStorageAdapter` writes, the store
//      hydrates; what the store writes, the adapter's `keys()`/`get()` see;
//   3. a pre-migration localStorage snapshot (literal legacy bytes) hydrates identically;
//   4. structurally: the write path IS the seam (no direct `localStorage.setItem` left in the module).
import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { createLocalStorageAdapter } from '@agent-ui/shared'
import { createMemoryStore } from './memory-store.ts'

beforeEach(() => localStorage.clear())

describe('createMemoryStore — byte-identical serialization through the shared localStorage tier (GH #959)', () => {
  it('every value shape lands under `${persistKey}.${key}` as exactly `JSON.stringify(value)`, synchronously', () => {
    const store = createMemoryStore({ persistKey: 'parity-ns' })
    // Literal expected bytes — the pre-migration module wrote `localStorage.setItem(`${persistKey}.${key}`,
    // JSON.stringify(value))`; these strings ARE that output, pinned rather than recomputed.
    const cases: ReadonlyArray<readonly [key: string, value: unknown, bytes: string]> = [
      ['volume', 7, '7'],
      ['theme', 'dark', '"dark"'],
      ['enabled', false, 'false'],
      ['cleared', null, 'null'],
      ['tags', ['a', 'b'], '["a","b"]'],
      ['nested', { a: 1, b: [true, null, 'é'], c: { d: 'x' } }, '{"a":1,"b":[true,null,"é"],"c":{"d":"x"}}'],
      ['empty', '', '""'],
    ]
    for (const [key, value, bytes] of cases) {
      store.set(key, value)
      // No await — the sync store contract (SPEC-R12 F7) means the write is observable in the same tick.
      expect(localStorage.getItem(`parity-ns.${key}`)).toBe(bytes)
      expect(localStorage.getItem(`parity-ns.${key}`)).toBe(JSON.stringify(value))
    }
    // And NOTHING else was written under the namespace (no bookkeeping keys, no shape change).
    const written = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i))
      .filter((k): k is string => k !== null && k.startsWith('parity-ns.'))
      .sort()
    expect(written).toEqual(cases.map(([key]) => `parity-ns.${key}`).sort())
  })

  it('`save(next)` writes each entry through the same path (same bytes, same keys)', () => {
    const store = createMemoryStore({ persistKey: 'parity-save' })
    store.save?.({ volume: 3, theme: 'light' }) // `save` is optional on the `SettingsStore` interface; the reference store implements it
    expect(localStorage.getItem('parity-save.volume')).toBe('3')
    expect(localStorage.getItem('parity-save.theme')).toBe('"light"')
  })

  it('a store WITHOUT persistKey writes nothing to localStorage', () => {
    const store = createMemoryStore({ initial: { volume: 1 } })
    store.set('volume', 9)
    expect(localStorage.length).toBe(0)
  })
})

describe('createMemoryStore ↔ createLocalStorageAdapter — the two modules agree in both directions', () => {
  it('what the adapter writes, a store on the same namespace hydrates SYNCHRONOUSLY at construction', async () => {
    const adapter = createLocalStorageAdapter({ namespace: 'shared-ns' })
    await adapter.set('volume', 42)
    await adapter.set('profile', { name: 'Kim', roles: ['owner'] })

    const store = createMemoryStore({ persistKey: 'shared-ns', initial: { volume: 0, extra: 'seed' } })
    expect(store.get('volume')).toBe(42) // persisted wins over the seed
    expect(store.get('profile')).toEqual({ name: 'Kim', roles: ['owner'] })
    expect(store.get('extra')).toBe('seed') // the seed still supplies what the namespace does not hold
  })

  it('what the store writes, the adapter `keys()`/`get()` see — the same keys, the same values', async () => {
    const store = createMemoryStore({ persistKey: 'shared-ns-2' })
    store.set('a', 1)
    store.set('b', { deep: [1, 2, 3] })

    const adapter = createLocalStorageAdapter({ namespace: 'shared-ns-2' })
    expect((await adapter.keys()).sort()).toEqual(['a', 'b'])
    await expect(adapter.get('a')).resolves.toBe(1)
    await expect(adapter.get('b')).resolves.toEqual({ deep: [1, 2, 3] })
  })

  it('a corrupt value fails open the SAME way on both sides (store keeps its seed; adapter answers undefined)', async () => {
    localStorage.setItem('shared-ns-3.volume', '{not json')
    const store = createMemoryStore({ persistKey: 'shared-ns-3', initial: { volume: 5 } })
    expect(store.get('volume')).toBe(5)
    await expect(createLocalStorageAdapter({ namespace: 'shared-ns-3' }).get('volume')).resolves.toBeUndefined()
  })

  it('the trailing-dot namespace boundary is the same on both sides (a prefixing namespace never leaks)', async () => {
    createMemoryStore({ persistKey: 'ns.travel' }).set('flag', false)
    createMemoryStore({ persistKey: 'ns.travel-imported' }).set('flag', true)
    await expect(createLocalStorageAdapter({ namespace: 'ns.travel' }).keys()).resolves.toEqual(['flag'])
    await expect(createLocalStorageAdapter({ namespace: 'ns.travel' }).get('flag')).resolves.toBe(false)
    await expect(createLocalStorageAdapter({ namespace: 'ns.travel-imported' }).get('flag')).resolves.toBe(true)
  })
})

describe('createMemoryStore — a PRE-migration localStorage snapshot hydrates identically', () => {
  it('literal legacy bytes (as the direct-setItem code wrote them) come back as the same values', () => {
    // A snapshot of what the pre-#959 module left in localStorage for a persona-style namespace — written
    // here as literal strings, exactly as `JSON.stringify` produced them then.
    localStorage.setItem('agent-admin-app.travel.volume', '7')
    localStorage.setItem('agent-admin-app.travel.theme', '"dark"')
    localStorage.setItem('agent-admin-app.travel.surfaceA2ui', 'false')
    localStorage.setItem('agent-admin-app.travel.tools', '{"web":true,"files":false}')
    localStorage.setItem('agent-admin-app.travel.seedVersion', '3') // the documented inert neighbour (GH #409)
    localStorage.setItem('agent-admin-app.activePreset', '"travel"') // a sibling OUTSIDE the namespace

    const store = createMemoryStore({ persistKey: 'agent-admin-app.travel', initial: { volume: 0, theme: 'light' } })
    expect(store.get('volume')).toBe(7)
    expect(store.get('theme')).toBe('dark')
    expect(store.get('surfaceA2ui')).toBe(false)
    expect(store.get('tools')).toEqual({ web: true, files: false })
    expect(store.get('seedVersion')).toBe(3)
    expect(store.get('activePreset')).toBeUndefined()

    // A subsequent write does not disturb any neighbour byte.
    store.set('volume', 8)
    expect(localStorage.getItem('agent-admin-app.travel.volume')).toBe('8')
    expect(localStorage.getItem('agent-admin-app.travel.theme')).toBe('"dark"')
    expect(localStorage.getItem('agent-admin-app.activePreset')).toBe('"travel"')
  })
})

describe('memory-store.ts — the write path IS the shared seam (structural pin)', () => {
  const src = readFileSync(`${process.cwd()}/packages/agent-ui/app/src/controls/settings/memory-store.ts`, 'utf8') as string

  it('imports createLocalStorageAdapter from @agent-ui/shared and holds no direct localStorage.setItem', () => {
    expect(src).toContain("from '@agent-ui/shared'")
    expect(src).toContain('createLocalStorageAdapter(')
    expect(src).not.toContain('localStorage.setItem')
  })
})
