import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { createMemoryStore } from './memory-store.ts'
declare const process: { cwd(): string }

// n3d — jsdom probes for the SettingsStore seam + its reference adapter (LLD-C15, SPEC-R12).

describe('createMemoryStore — plain in-memory (no persistKey)', () => {
  it('get() returns undefined for an unseeded key; set()/get() round-trip within the SAME instance', () => {
    const store = createMemoryStore()
    expect(store.get('missing')).toBeUndefined()
    store.set('theme', 'dark')
    expect(store.get('theme')).toBe('dark')
  })

  it('seeds from `initial`', () => {
    const store = createMemoryStore({ initial: { theme: 'light' } })
    expect(store.get('theme')).toBe('light')
  })

  it('subscribe() notifies listeners on set(), and the returned unsubscribe stops further notifications', () => {
    const store = createMemoryStore()
    const seen: Array<[string, unknown]> = []
    const unsubscribe = store.subscribe?.((key, value) => seen.push([key, value]))
    store.set('a', 1)
    expect(seen).toEqual([['a', 1]])
    unsubscribe?.()
    store.set('a', 2)
    expect(seen).toEqual([['a', 1]]) // no further notification after unsubscribe
  })

  it('save() batch-writes every key', () => {
    const store = createMemoryStore()
    store.save?.({ a: 1, b: 2 })
    expect(store.get('a')).toBe(1)
    expect(store.get('b')).toBe(2)
  })

  it('a DIFFERENT store instance (no persistKey) never sees another instance\'s writes', () => {
    const a = createMemoryStore()
    const b = createMemoryStore()
    a.set('x', 'from-a')
    expect(b.get('x')).toBeUndefined()
  })
})

describe('createMemoryStore — persistKey (localStorage-backed round trip, SPEC-R12 AC2)', () => {
  it('a write from one store instance is visible to a SECOND instance pointed at the same persistKey', () => {
    localStorage.clear()
    const first = createMemoryStore({ persistKey: 'ui-settings-test' })
    first.set('volume', 7)

    const second = createMemoryStore({ persistKey: 'ui-settings-test', initial: { volume: 0 } })
    expect(second.get('volume')).toBe(7) // the persisted value WINS over the constructor's `initial` seed
  })

  it('a corrupt persisted value falls back to the constructor seed, never throws', () => {
    localStorage.clear()
    localStorage.setItem('ui-settings-test-2.volume', '{not json')
    expect(() => createMemoryStore({ persistKey: 'ui-settings-test-2', initial: { volume: 5 } })).not.toThrow()
    const store = createMemoryStore({ persistKey: 'ui-settings-test-2', initial: { volume: 5 } })
    expect(store.get('volume')).toBe(5)
  })

  // GH #409 — the seed used to double as a hidden ALLOWLIST: rehydration walked the seed's own keys, so a
  // key the store genuinely wrote but the seed never carried round-tripped inside one live instance and
  // vanished on the next construction (a reload). That is the whole agent-admin Surface-Options /
  // master-toggle bug, at the mechanism level.
  it('a key the SEED never carried still rehydrates into a second instance (the reload case)', () => {
    localStorage.clear()
    const first = createMemoryStore({ persistKey: 'ui-settings-test-3', initial: { volume: 5 } })
    first.set('surfaceA2ui', false) // an unseeded key — written, so it belongs to this namespace
    first.set('agentEnabled', false)

    const second = createMemoryStore({ persistKey: 'ui-settings-test-3', initial: { volume: 5 } })
    expect(second.get('surfaceA2ui')).toBe(false)
    expect(second.get('agentEnabled')).toBe(false)
    expect(second.get('volume')).toBe(5) // the seed still supplies what the namespace does not hold
  })

  it('the namespace is delimited by the trailing dot — a persistKey that PREFIXES another never reads its keys', () => {
    localStorage.clear()
    const travel = createMemoryStore({ persistKey: 'agent-admin-app.travel' })
    const imported = createMemoryStore({ persistKey: 'agent-admin-app.travel-imported' })
    travel.set('surfaceA2ui', false)
    imported.set('surfaceA2ui', true)

    // Fresh instances of BOTH — neither namespace may leak into the other (the persona-switching case:
    // an imported persona's id is its source's slug plus a suffix, so the prefixes genuinely overlap).
    expect(createMemoryStore({ persistKey: 'agent-admin-app.travel' }).get('surfaceA2ui')).toBe(false)
    expect(createMemoryStore({ persistKey: 'agent-admin-app.travel-imported' }).get('surfaceA2ui')).toBe(true)
    // And a SIBLING key outside both namespaces (the page's own `agent-admin-app.activePreset`) is not a
    // store key of either.
    localStorage.setItem('agent-admin-app.activePreset', JSON.stringify('travel'))
    expect(createMemoryStore({ persistKey: 'agent-admin-app.travel' }).get('activePreset')).toBeUndefined()
  })
})

// ── the SPEC-R12 AC3 seam guard: ui-settings imports ONLY store.ts's interface, never a concrete store ──

describe('layering — settings.ts never imports a concrete store (SPEC-R12 AC3)', () => {
  const DIR = `${process.cwd()}/packages/agent-ui/app/src/controls/settings`
  const settingsTs = readFileSync(`${DIR}/settings.ts`, 'utf8') as string

  it('settings.ts imports store.ts (the interface) but never memory-store.ts (a concrete adapter)', () => {
    expect(settingsTs).toContain("from './store.ts'")
    expect(settingsTs).not.toContain('memory-store')
    expect(settingsTs).not.toContain('localStorage')
  })
})
