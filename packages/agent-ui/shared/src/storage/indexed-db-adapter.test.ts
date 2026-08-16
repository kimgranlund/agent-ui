import { describe, it, expect } from 'vitest'
import { createIndexedDbAdapter } from './indexed-db-adapter.ts'

// jsdom does not implement `indexedDB` (ADR-0193 Context/cl.3) — this file proves the graceful-failure
// path (every method REJECTS with a named Error, never silently no-ops, unlike the localStorage tier).
// The real round-trip proof (open/put/get/delete/getAllKeys + BroadcastChannel notification) runs under
// a real engine: indexed-db-adapter.browser.test.ts (the `packages-rest` Playwright project).

describe('createIndexedDbAdapter — indexedDB unavailable (jsdom has none)', () => {
  it('precondition: this jsdom environment genuinely has no indexedDB global', () => {
    expect(typeof indexedDB).toBe('undefined')
  })

  it('get()/set()/delete()/keys() all reject with a named Error rather than hanging or silently no-oping', async () => {
    const adapter = createIndexedDbAdapter({ dbName: 'ns-a' })
    await expect(adapter.get('k')).rejects.toThrow('indexedDB unavailable')
    await expect(adapter.set('k', 1)).rejects.toThrow('indexedDB unavailable')
    await expect(adapter.delete('k')).rejects.toThrow('indexedDB unavailable')
    await expect(adapter.keys()).rejects.toThrow('indexedDB unavailable')
  })

  it('subscribe() with no BroadcastChannel global returns a no-op unsubscribe rather than throwing', () => {
    const original = globalThis.BroadcastChannel
    // @ts-expect-error — simulating an environment with no BroadcastChannel global (jsdom itself may or
    // may not ship one; force the absence explicitly so this test is not environment-dependent)
    delete globalThis.BroadcastChannel
    try {
      const adapter = createIndexedDbAdapter({ dbName: 'ns-b' })
      expect(() => adapter.subscribe?.(() => {})?.()).not.toThrow()
    } finally {
      globalThis.BroadcastChannel = original
    }
  })

  it('defaults: storeName "kv", version 1 — options are accepted without construction-time validation', () => {
    // Construction itself never touches indexedDB (lazy open on first call) — this must not throw even
    // though indexedDB is absent in this environment.
    expect(() => createIndexedDbAdapter({ dbName: 'ns-c' })).not.toThrow()
    expect(() => createIndexedDbAdapter({ dbName: 'ns-d', storeName: 'custom', version: 3 })).not.toThrow()
  })
})
