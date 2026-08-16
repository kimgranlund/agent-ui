import { describe, it, expect, vi } from 'vitest'
import { createLocalStorageAdapter } from './local-storage-adapter.ts'

// jsdom probes for the localStorage `StorageAdapter` tier (ADR-0193 cl.2, GH #959 Slice 1).

describe('createLocalStorageAdapter — get/set/delete/keys round-trip', () => {
  it('get() resolves undefined for an unseeded key', async () => {
    localStorage.clear()
    const adapter = createLocalStorageAdapter({ namespace: 'ns-a' })
    await expect(adapter.get('missing')).resolves.toBeUndefined()
  })

  it('set()/get() round-trip within the same adapter, JSON-encoded under the namespace', async () => {
    localStorage.clear()
    const adapter = createLocalStorageAdapter({ namespace: 'ns-b' })
    await adapter.set('theme', 'dark')
    await expect(adapter.get('theme')).resolves.toBe('dark')
    expect(localStorage.getItem('ns-b.theme')).toBe('"dark"')
  })

  it('set()/get() round-trip a structured (non-string) value', async () => {
    localStorage.clear()
    const adapter = createLocalStorageAdapter({ namespace: 'ns-c' })
    await adapter.set('config', { volume: 7, muted: false })
    await expect(adapter.get('config')).resolves.toEqual({ volume: 7, muted: false })
  })

  it('a write from one adapter instance is visible to a SECOND instance sharing the same namespace', async () => {
    localStorage.clear()
    const first = createLocalStorageAdapter({ namespace: 'ns-d' })
    await first.set('volume', 7)
    const second = createLocalStorageAdapter({ namespace: 'ns-d' })
    await expect(second.get('volume')).resolves.toBe(7)
  })

  it('delete() removes the key; a subsequent get() resolves undefined', async () => {
    localStorage.clear()
    const adapter = createLocalStorageAdapter({ namespace: 'ns-e' })
    await adapter.set('a', 1)
    await adapter.delete('a')
    await expect(adapter.get('a')).resolves.toBeUndefined()
  })

  it('delete() on a never-set key is a no-op, never a throw', async () => {
    localStorage.clear()
    const adapter = createLocalStorageAdapter({ namespace: 'ns-f' })
    await expect(adapter.delete('never-set')).resolves.toBeUndefined()
  })

  it('keys() lists only this namespace\'s own keys, unqualified', async () => {
    localStorage.clear()
    const adapter = createLocalStorageAdapter({ namespace: 'ns-g' })
    await adapter.set('a', 1)
    await adapter.set('b', 2)
    localStorage.setItem('ns-other.c', '3') // a sibling namespace's key — must not leak in
    await expect(adapter.keys()).resolves.toEqual(expect.arrayContaining(['a', 'b']))
    const listed = await adapter.keys()
    expect(listed).toHaveLength(2)
  })

  it('a corrupt persisted value degrades get() to undefined, never throws', async () => {
    localStorage.clear()
    localStorage.setItem('ns-h.volume', '{not json')
    const adapter = createLocalStorageAdapter({ namespace: 'ns-h' })
    await expect(adapter.get('volume')).resolves.toBeUndefined()
  })

  it('the namespace is delimited by the trailing dot — a namespace that PREFIXES another never reads its keys', async () => {
    localStorage.clear()
    const travel = createLocalStorageAdapter({ namespace: 'app.travel' })
    const imported = createLocalStorageAdapter({ namespace: 'app.travel-imported' })
    await travel.set('surfaceA2ui', false)
    await imported.set('surfaceA2ui', true)
    await expect(travel.get('surfaceA2ui')).resolves.toBe(false)
    await expect(imported.get('surfaceA2ui')).resolves.toBe(true)
  })
})

describe('createLocalStorageAdapter — subscribe (the cross-tab notification seam, ADR-0193 cl.4)', () => {
  it('subscribe() is lazy: no "storage" listener registered until called', () => {
    const addSpy = vi.spyOn(window, 'addEventListener')
    createLocalStorageAdapter({ namespace: 'ns-i' })
    expect(addSpy).not.toHaveBeenCalledWith('storage', expect.anything())
    addSpy.mockRestore()
  })

  it('a "storage" event scoped to this namespace notifies the listener with the unprefixed key', () => {
    const adapter = createLocalStorageAdapter({ namespace: 'ns-j' })
    const seen: Array<{ key: string; value: unknown; oldValue?: unknown }> = []
    const unsubscribe = adapter.subscribe?.((change) => seen.push(change))

    window.dispatchEvent(
      new StorageEvent('storage', { key: 'ns-j.theme', newValue: '"dark"', oldValue: '"light"' }),
    )
    expect(seen).toEqual([{ key: 'theme', value: 'dark', oldValue: 'light' }])

    unsubscribe?.()
    window.dispatchEvent(new StorageEvent('storage', { key: 'ns-j.theme', newValue: '"blue"' }))
    expect(seen).toHaveLength(1) // no further notification after unsubscribe
  })

  it('a "storage" event for a DIFFERENT namespace is ignored', () => {
    const adapter = createLocalStorageAdapter({ namespace: 'ns-k' })
    const seen: unknown[] = []
    adapter.subscribe?.((change) => seen.push(change))
    window.dispatchEvent(new StorageEvent('storage', { key: 'ns-other.theme', newValue: '"dark"' }))
    expect(seen).toEqual([])
  })

  it('a "storage" event carrying newValue: null (the key was removed) resolves value: undefined', () => {
    const adapter = createLocalStorageAdapter({ namespace: 'ns-l' })
    const seen: Array<{ key: string; value: unknown; oldValue?: unknown }> = []
    adapter.subscribe?.((change) => seen.push(change))
    window.dispatchEvent(new StorageEvent('storage', { key: 'ns-l.a', newValue: null, oldValue: '"x"' }))
    expect(seen).toEqual([{ key: 'a', value: undefined, oldValue: 'x' }])
  })
})

describe('createLocalStorageAdapter — no localStorage available (SSR / locked-down embed)', () => {
  it('every method degrades to a safe no-op/undefined rather than throwing', async () => {
    const original = globalThis.localStorage
    // @ts-expect-error — simulating an environment with no localStorage global
    delete globalThis.localStorage
    try {
      const adapter = createLocalStorageAdapter({ namespace: 'ns-m' })
      await expect(adapter.get('a')).resolves.toBeUndefined()
      await expect(adapter.set('a', 1)).resolves.toBeUndefined()
      await expect(adapter.delete('a')).resolves.toBeUndefined()
      await expect(adapter.keys()).resolves.toEqual([])
    } finally {
      globalThis.localStorage = original
    }
  })

  it('subscribe() with no window returns a no-op unsubscribe rather than throwing', () => {
    const adapter = createLocalStorageAdapter({ namespace: 'ns-n' })
    expect(() => adapter.subscribe?.(() => {})?.()).not.toThrow()
  })
})
