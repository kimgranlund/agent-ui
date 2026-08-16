// indexed-db-adapter.browser.test.ts — the real-engine proof for the IndexedDB `StorageAdapter` tier
// (ADR-0193 cl.3, GH #959 Slice 1). jsdom does not implement `indexedDB` at all
// (indexed-db-adapter.test.ts covers the graceful-unavailable path); this file is the ONLY place the
// actual open/put/get/delete/getAllKeys round trip, and the BroadcastChannel notification seam, are
// proven against a real IndexedDB implementation. Runs in BOTH Chromium and WebKit
// (vitest.browser.config.ts's `packages-rest` project, `packages/agent-ui/*/src/**/*.browser.test.ts`
// minus components/app).
import { describe, it, expect, afterEach } from 'vitest'
import { createIndexedDbAdapter } from './indexed-db-adapter.ts'

let counter = 0
/** A fresh, uniquely-named database per test — real IndexedDB persists across test runs within one
 *  browser context, so reusing a name would leak state between tests (unlike jsdom, which resets). */
const freshDbName = (): string => `agent-ui-storage-test-${Date.now()}-${(counter += 1)}`

const openedDbNames: string[] = []
afterEach(async () => {
  while (openedDbNames.length) {
    const name = openedDbNames.pop()
    if (name) await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase(name)
      req.onsuccess = () => resolve()
      req.onerror = () => resolve() // best-effort cleanup — never fail a test on teardown
      req.onblocked = () => resolve()
    })
  }
})

describe('createIndexedDbAdapter — real IndexedDB round trip', () => {
  it('get() resolves undefined for an unseeded key', async () => {
    const dbName = freshDbName()
    openedDbNames.push(dbName)
    const adapter = createIndexedDbAdapter({ dbName })
    await expect(adapter.get('missing')).resolves.toBeUndefined()
  })

  it('set()/get() round-trip a structured value', async () => {
    const dbName = freshDbName()
    openedDbNames.push(dbName)
    const adapter = createIndexedDbAdapter({ dbName })
    await adapter.set('config', { volume: 7, tags: ['a', 'b'] })
    await expect(adapter.get('config')).resolves.toEqual({ volume: 7, tags: ['a', 'b'] })
  })

  it('a write from one adapter instance is visible to a SECOND instance pointed at the same db/store', async () => {
    const dbName = freshDbName()
    openedDbNames.push(dbName)
    const first = createIndexedDbAdapter({ dbName })
    await first.set('theme', 'dark')
    const second = createIndexedDbAdapter({ dbName })
    await expect(second.get('theme')).resolves.toBe('dark')
  })

  it('delete() removes the key; a subsequent get() resolves undefined', async () => {
    const dbName = freshDbName()
    openedDbNames.push(dbName)
    const adapter = createIndexedDbAdapter({ dbName })
    await adapter.set('a', 1)
    await adapter.delete('a')
    await expect(adapter.get('a')).resolves.toBeUndefined()
  })

  it('delete() on a never-set key resolves cleanly, never rejects', async () => {
    const dbName = freshDbName()
    openedDbNames.push(dbName)
    const adapter = createIndexedDbAdapter({ dbName })
    await expect(adapter.delete('never-set')).resolves.toBeUndefined()
  })

  it('keys() lists every key this adapter has written', async () => {
    const dbName = freshDbName()
    openedDbNames.push(dbName)
    const adapter = createIndexedDbAdapter({ dbName })
    await adapter.set('a', 1)
    await adapter.set('b', 2)
    const keys = await adapter.keys()
    expect(keys.sort()).toEqual(['a', 'b'])
  })

  it('a custom storeName/version is honored — the object store is created on first open', async () => {
    const dbName = freshDbName()
    openedDbNames.push(dbName)
    const adapter = createIndexedDbAdapter({ dbName, storeName: 'custom-store', version: 2 })
    await adapter.set('k', 'v')
    await expect(adapter.get('k')).resolves.toBe('v')
  })
})

describe('createIndexedDbAdapter — subscribe (BroadcastChannel cross-instance notification, ADR-0193 cl.4)', () => {
  it('a set() on one adapter instance notifies a SECOND subscribed instance of the same db/store', async () => {
    const dbName = freshDbName()
    openedDbNames.push(dbName)
    const writer = createIndexedDbAdapter({ dbName })
    const reader = createIndexedDbAdapter({ dbName })

    const seen = await new Promise<{ key: string; value: unknown }>((resolve) => {
      reader.subscribe?.((change) => resolve(change))
      void writer.set('theme', 'dark')
    })
    expect(seen).toEqual({ key: 'theme', value: 'dark' })
  })

  it('a delete() notifies with value: undefined', async () => {
    const dbName = freshDbName()
    openedDbNames.push(dbName)
    const writer = createIndexedDbAdapter({ dbName })
    const reader = createIndexedDbAdapter({ dbName })
    await writer.set('a', 1)

    const seen = await new Promise<{ key: string; value: unknown }>((resolve) => {
      reader.subscribe?.((change) => {
        if (change.key === 'a') resolve(change)
      })
      void writer.delete('a')
    })
    expect(seen).toEqual({ key: 'a', value: undefined })
  })

  it('unsubscribe() stops further notifications', async () => {
    const dbName = freshDbName()
    openedDbNames.push(dbName)
    const writer = createIndexedDbAdapter({ dbName })
    const reader = createIndexedDbAdapter({ dbName })
    const seen: unknown[] = []
    const unsubscribe = reader.subscribe?.((change) => seen.push(change))

    await writer.set('a', 1)
    // give the BroadcastChannel message a tick to deliver before unsubscribing
    await new Promise((resolve) => setTimeout(resolve, 50))
    unsubscribe?.()
    await writer.set('b', 2)
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(seen).toHaveLength(1)
  })
})
