// indexed-db-adapter.ts — the IndexedDB `StorageAdapter` tier (ADR-0193 cl.3, GH #959 Slice 1). ONE
// object store per adapter instance, versioned `onupgradeneeded`, every `IDBRequest`/transaction
// hand-wrapped in a `new Promise` — the `idb` library's PATTERN, hand-rolled, never the dependency
// (zero-dep law; ADR-0193 Alternatives). Cross-tab (and cross-instance-within-a-tab) notification rides
// `BroadcastChannel`, since IndexedDB itself has no `storage`-event equivalent.
//
// jsdom does not implement `indexedDB` (ADR-0193 Context) — every method rejects with a named Error
// when it's absent rather than silently no-op-ing (IndexedDB unavailability is a real capacity/
// availability failure a caller needs to see, unlike a missing `localStorage`). The real-engine proof
// lives in `indexed-db-adapter.browser.test.ts`, run under Playwright (`packages-rest` project) where
// `indexedDB` genuinely exists.

import type { StorageAdapter, StorageChange } from './adapter.ts'

export interface IndexedDbAdapterOptions {
  /** The IndexedDB database name — one database per adapter instance. */
  dbName: string
  /** The single object store's name. Defaults `'kv'`. */
  storeName?: string
  /** The database's `onupgradeneeded` version. Defaults `1` — bump it to add/rename stores in a future
   *  slice; this adapter only ever creates the ONE store it was constructed with. */
  version?: number
}

const DEFAULT_STORE_NAME = 'kv'

const isIndexedDbAvailable = (): boolean => typeof indexedDB !== 'undefined'

const unavailable = (): Promise<never> =>
  Promise.reject(new Error('indexedDB unavailable — this environment does not implement it'))

function openDatabase(dbName: string, storeName: string, version: number): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, version)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(storeName)) db.createObjectStore(storeName)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error(`indexedDB.open("${dbName}") failed`))
  })
}

function runTransaction<T>(
  db: IDBDatabase,
  storeName: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode)
    const request = run(tx.objectStore(storeName))
    let result: T
    request.onsuccess = () => {
      result = request.result
    }
    request.onerror = () => reject(request.error ?? new Error('indexedDB request failed'))
    tx.oncomplete = () => resolve(result)
    tx.onerror = () => reject(tx.error ?? new Error('indexedDB transaction failed'))
    tx.onabort = () => reject(tx.error ?? new Error('indexedDB transaction aborted'))
  })
}

/** A `StorageAdapter` backed by one IndexedDB object store, hand-wrapped in Promises (ADR-0193 cl.3). */
export function createIndexedDbAdapter(options: IndexedDbAdapterOptions): StorageAdapter {
  const { dbName, storeName = DEFAULT_STORE_NAME, version = 1 } = options

  let dbPromise: Promise<IDBDatabase> | undefined
  const getDb = (): Promise<IDBDatabase> => {
    if (!isIndexedDbAvailable()) return unavailable()
    dbPromise ??= openDatabase(dbName, storeName, version)
    return dbPromise
  }

  // Lazily created on the first `subscribe()` call, never before (ADR-0193 cl.4's opt-in realization).
  let channel: BroadcastChannel | undefined
  const getChannel = (): BroadcastChannel | undefined => {
    if (typeof BroadcastChannel === 'undefined') return undefined
    channel ??= new BroadcastChannel(`agent-ui-storage:${dbName}:${storeName}`)
    return channel
  }

  return {
    async get(key) {
      if (!isIndexedDbAvailable()) return unavailable()
      const db = await getDb()
      return runTransaction<unknown>(db, storeName, 'readonly', (store) => store.get(key))
    },

    async set(key, value) {
      if (!isIndexedDbAvailable()) return unavailable()
      const db = await getDb()
      await runTransaction<IDBValidKey>(db, storeName, 'readwrite', (store) => store.put(value, key))
      const change: StorageChange = { key, value }
      getChannel()?.postMessage(change)
    },

    async delete(key) {
      if (!isIndexedDbAvailable()) return unavailable()
      const db = await getDb()
      await runTransaction<undefined>(db, storeName, 'readwrite', (store) => store.delete(key))
      const change: StorageChange = { key, value: undefined }
      getChannel()?.postMessage(change)
    },

    async keys() {
      if (!isIndexedDbAvailable()) return unavailable()
      const db = await getDb()
      const result = await runTransaction<IDBValidKey[]>(db, storeName, 'readonly', (store) =>
        store.getAllKeys(),
      )
      return result.map((key) => String(key))
    },

    subscribe(listener) {
      const ch = getChannel()
      if (!ch) return () => {}
      const handler = (event: MessageEvent<StorageChange>): void => listener(event.data)
      ch.addEventListener('message', handler)
      return () => ch.removeEventListener('message', handler)
    },
  }
}
