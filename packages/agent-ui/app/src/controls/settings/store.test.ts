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
