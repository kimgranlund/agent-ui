import"./super-shell-D76CLu9A.js";import{n as e,r as t}from"./_page-DIBN49D1.js";import{t as n}from"./code-block-DEt2Scp8.js";import{a as r,g as i,h as a,m as o,n as s}from"./doc-page-H_CmxYv1.js";import{t as c}from"./local-storage-adapter-BVVnVK1L.js";import{a as l,i as u}from"./specimens-BSFejhGR.js";import{t as d}from"./store-BQcz4KvH.js";var f=`// adapter.ts — the \`StorageAdapter\` persistence seam (ADR-0193, GH #959 Slice 1). Async \`get\`/\`set\`/
// \`delete\`/\`keys\` at the DAG's bottom (\`@agent-ui/shared\`) so any layer at or above \`shared\` can persist
// without an upward import — the localStorage tier (\`local-storage-adapter.ts\`) and the IndexedDB tier
// (\`indexed-db-adapter.ts\`) both implement this ONE contract. Deliberately ASYNC throughout, unlike
// \`@agent-ui/app\`'s \`SettingsStore\` (\`app/src/controls/settings/store.ts\`, SPEC-R12 fork F7's sync
// choice) — IndexedDB's own API is irreducibly async, and this seam fronts it directly (ADR-0193
// Alternatives). The two contracts are deliberately separate; this ADR does not touch \`SettingsStore\`.

/** One external-change notification — the cross-tab/cross-instance seam (ADR-0193 cl.4), opt-in via
 *  \`StorageAdapter.subscribe\`. \`value\`/\`oldValue\` are \`undefined\` when the change was a \`delete\`. */
export interface StorageChange {
  key: string
  value: unknown
  oldValue?: unknown
}

/**
 * The persistence-adapter contract every \`shared\`-or-above consumer may reach for (ADR-0193). Every
 * method is async — a sync facade over IndexedDB is not possible without a stale in-memory mirror
 * (ADR-0193 Alternatives), so this seam does not offer one (the ONE tier-scoped exception: a tier whose
 * backing store IS synchronous may implement \`SyncReadableStorageAdapter\` — ADR-0193 Amendment, A1–A3).
 */
export interface StorageAdapter {
  /** Read the currently-persisted value for \`key\`, or \`undefined\` if this adapter holds nothing for it. */
  get(key: string): Promise<unknown>

  /** Persist \`value\` for \`key\`, overwriting any prior value. */
  set(key: string, value: unknown): Promise<void>

  /** Remove \`key\` and its value. A no-op (never a throw) when \`key\` was never set. */
  delete(key: string): Promise<void>

  /** Every key this adapter currently holds a value for, in no guaranteed order. */
  keys(): Promise<string[]>

  /**
   * Optional external-change notification (ADR-0193 cl.4): the adapter calls \`listener(change)\` when a
   * value changes from OUTSIDE this adapter instance — another tab (localStorage tier, the native
   * \`storage\` event) or another instance/tab sharing the same store (IndexedDB tier, \`BroadcastChannel\`).
   * Returns an unsubscribe function. Lazily wired: nothing here is listened to until \`subscribe\` is
   * called, and the listener stops the moment the returned function runs — the opt-in realization GH
   * #959's Slice-3 "(opt-in)" qualifier asks for, with no separate flag.
   *
   * Absent ⇒ no external-change reactivity is available at all (never implemented by every adapter — an
   * adapter MAY omit it, the same "optional, absence is a documented no-op" shape
   * \`SettingsStore.subscribe\` already uses at the \`app\` layer).
   */
  subscribe?(listener: (change: StorageChange) => void): () => void
}

/**
 * The sync READ extension for tiers whose backing store is synchronous by nature (ADR-0193 Amendment,
 * A1/A2) — today exactly ONE: the localStorage tier (\`createLocalStorageAdapter\` returns this type).
 * Both members are REQUIRED and are the exact same-tick counterparts of their async siblings over the
 * SAME live backing store — no snapshot, no second state (the stale-mirror facade stays rejected, A3).
 * Nothing may implement this over an async store (IndexedDB and any future async tier stay plain
 * \`StorageAdapter\`); the base contract gains no sync members.
 */
export interface SyncReadableStorageAdapter extends StorageAdapter {
  /** Synchronous \`get\`: the currently-persisted value for \`key\`, or \`undefined\` when absent — or when
   *  the backing store itself is unavailable (the same fail-open idiom as ADR-0193 cl.2). */
  getSync(key: string): unknown

  /** Synchronous \`keys\`: every key this adapter currently holds, \`[]\` when the backing store is
   *  unavailable. */
  keysSync(): string[]
}

/** Narrowing convenience for adapter-GENERIC call sites (ADR-0193 Amendment A2 — a convenience over the
 *  typed extension, not the contract; the known-tier construction site uses the factory's narrowed
 *  return type directly). Function-presence check only. */
export function hasSyncReads(adapter: StorageAdapter): adapter is SyncReadableStorageAdapter {
  const candidate = adapter as Partial<SyncReadableStorageAdapter>
  return typeof candidate.getSync === 'function' && typeof candidate.keysSync === 'function'
}
`,p=`// local-storage-adapter.ts — the localStorage \`StorageAdapter\` tier (ADR-0193 cl.2, GH #959 Slice 1).
// Mirrors \`@agent-ui/app\`'s \`memory-store.ts\` namespacing convention deliberately (trailing-dot-delimited
// \`\${namespace}.\${key}\` prefix scan) so that store's migration onto this seam was a drop-in, not a
// re-derivation — landed in GH #959's remaining slice (2026-08-16): \`createMemoryStore({ persistKey })\`
// WRITES through this tier, and since GH #1077 (2026-08-17) HYDRATES through it too, via the tier's
// \`getSync\`/\`keysSync\` sync read surface (ADR-0193 Amendment — the \`SettingsStore\` contract is sync;
// parity-pinned in \`app/src/controls/settings/memory-store.test.ts\`).
// Cross-tab notification rides the native \`storage\` DOM event — genuinely zero-dep, fires only in OTHER
// tabs/windows sharing the origin, never the tab that made the write (browser-native same-tab exclusion).

import type { StorageChange, SyncReadableStorageAdapter } from './adapter.ts'

export interface LocalStorageAdapterOptions {
  /** Every key this adapter reads/writes lives under \`\${namespace}.\${key}\` — the WHOLE namespace belongs
   *  to this adapter (\`keys()\` prefix-scans it), so nothing else should write under the same namespace
   *  (the same whole-namespace contract \`memory-store.ts\`'s \`persistKey\` already documents). */
  namespace: string
}

const isBrowserStorageAvailable = (): boolean => typeof localStorage !== 'undefined'

const parse = (raw: string | null): unknown => {
  if (raw === null) return undefined
  try {
    return JSON.parse(raw) as unknown
  } catch {
    // A corrupt/foreign value under this key — degrade to \`undefined\`, never throw (same fail-open
    // idiom \`memory-store.ts\`'s corrupt-JSON catch already establishes).
    return undefined
  }
}

/** A \`StorageAdapter\` backed by \`localStorage\`, namespaced so multiple adapters can share one origin
 *  without colliding (ADR-0193 cl.2). Every method degrades to a safe no-op/\`undefined\` — never a
 *  throw — when \`localStorage\` is unavailable (SSR, a locked-down embed).
 *
 *  The return type is the SYNC-READABLE extension (ADR-0193 Amendment A1/A5 — a source-compatible
 *  narrowing): localStorage's backing store is synchronous by nature, so \`getSync\`/\`keysSync\` are the
 *  exact same-tick counterparts of \`get\`/\`keys\` over the same live store. */
export function createLocalStorageAdapter(options: LocalStorageAdapterOptions): SyncReadableStorageAdapter {
  const { namespace } = options
  const prefix = \`\${namespace}.\`
  const storageKey = (key: string): string => \`\${prefix}\${key}\`

  const getSync = (key: string): unknown => {
    if (!isBrowserStorageAvailable()) return undefined
    return parse(localStorage.getItem(storageKey(key)))
  }

  const keysSync = (): string[] => {
    if (!isBrowserStorageAvailable()) return []
    const out: string[] = []
    for (let index = 0; index < localStorage.length; index += 1) {
      const stored = localStorage.key(index)
      if (stored !== null && stored.startsWith(prefix)) out.push(stored.slice(prefix.length))
    }
    return out
  }

  return {
    getSync,
    keysSync,

    async get(key) {
      return getSync(key)
    },

    async set(key, value) {
      if (!isBrowserStorageAvailable()) return
      localStorage.setItem(storageKey(key), JSON.stringify(value))
    },

    async delete(key) {
      if (!isBrowserStorageAvailable()) return
      localStorage.removeItem(storageKey(key))
    },

    async keys() {
      return keysSync()
    },

    subscribe(listener) {
      if (typeof window === 'undefined') return () => {}
      const handler = (event: StorageEvent): void => {
        if (event.key === null || !event.key.startsWith(prefix)) return
        const change: StorageChange = {
          key: event.key.slice(prefix.length),
          value: parse(event.newValue),
          oldValue: parse(event.oldValue),
        }
        listener(change)
      }
      window.addEventListener('storage', handler)
      return () => window.removeEventListener('storage', handler)
    },
  }
}
`,m=`// indexed-db-adapter.ts — the IndexedDB \`StorageAdapter\` tier (ADR-0193 cl.3, GH #959 Slice 1). ONE
// object store per adapter instance, versioned \`onupgradeneeded\`, every \`IDBRequest\`/transaction
// hand-wrapped in a \`new Promise\` — the \`idb\` library's PATTERN, hand-rolled, never the dependency
// (zero-dep law; ADR-0193 Alternatives). Cross-tab (and cross-instance-within-a-tab) notification rides
// \`BroadcastChannel\`, since IndexedDB itself has no \`storage\`-event equivalent.
//
// jsdom does not implement \`indexedDB\` (ADR-0193 Context) — every method rejects with a named Error
// when it's absent rather than silently no-op-ing (IndexedDB unavailability is a real capacity/
// availability failure a caller needs to see, unlike a missing \`localStorage\`). The real-engine proof
// lives in \`indexed-db-adapter.browser.test.ts\`, run under Playwright (\`packages-rest\` project) where
// \`indexedDB\` genuinely exists.

import type { StorageAdapter, StorageChange } from './adapter.ts'

export interface IndexedDbAdapterOptions {
  /** The IndexedDB database name — one database per adapter instance. */
  dbName: string
  /** The single object store's name. Defaults \`'kv'\`. */
  storeName?: string
  /** The database's \`onupgradeneeded\` version. Defaults \`1\` — bump it to add/rename stores in a future
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
    request.onerror = () => reject(request.error ?? new Error(\`indexedDB.open("\${dbName}") failed\`))
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

/** A \`StorageAdapter\` backed by one IndexedDB object store, hand-wrapped in Promises (ADR-0193 cl.3). */
export function createIndexedDbAdapter(options: IndexedDbAdapterOptions): StorageAdapter {
  const { dbName, storeName = DEFAULT_STORE_NAME, version = 1 } = options

  let dbPromise: Promise<IDBDatabase> | undefined
  const getDb = (): Promise<IDBDatabase> => {
    if (!isIndexedDbAvailable()) return unavailable()
    dbPromise ??= openDatabase(dbName, storeName, version)
    return dbPromise
  }

  // Lazily created on the first \`subscribe()\` call, never before (ADR-0193 cl.4's opt-in realization).
  let channel: BroadcastChannel | undefined
  const getChannel = (): BroadcastChannel | undefined => {
    if (typeof BroadcastChannel === 'undefined') return undefined
    channel ??= new BroadcastChannel(\`agent-ui-storage:\${dbName}:\${storeName}\`)
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
`;function h(e,t){let n=`export interface ${t} {`,r=e.indexOf(n);if(r===-1)throw Error(`persistence.ts: interface "${t}" not found — renamed or removed?`);let i=0,a=r;for(;a<e.length;a++)if(e[a]===`{`)i++;else if(e[a]===`}`&&(i--,i===0)){a++;break}return e.slice(r,a)}function g(e,t){let n=`export function ${t}(`,r=e.indexOf(n);if(r===-1)throw Error(`persistence.ts: function "${t}" not found — renamed or removed?`);let i=e.indexOf(`{`,r);return e.slice(r,i).trim()}function _(...e){let t=document.createElement(`p`);for(let n of e)t.append(typeof n==`string`?document.createTextNode(n):n);return t}function v(e){let t=document.createElement(`code`);return t.textContent=e,t}function y(e,t){let n=document.createElement(`a`);return n.href=e,n.textContent=t,n}var{content:b}=e({title:`Persistence`,intro:`One typed, async StorageAdapter seam at the DAG’s bottom (@agent-ui/shared) so any layer at or above it can persist without an upward import — a localStorage tier, an IndexedDB tier, and an opt-in cross-tab change-notification seam. ADR-0193 (2026-08-16, STATUS: proposed — not yet ratified).`});b.append(t(`Before this seam, only @agent-ui/app could touch localStorage (its own ui-settings SettingsStore), so nothing below it in the DAG could persist anything without an upward import. This page is that seam’s guide: what it is, a live demo of the tier you’ll reach for most, how it differs from ui-settings’ own store, and how (little) it overlaps @agent-ui/data.`)),b.append(r(2,`The StorageAdapter interface`)),b.append(_(`Sliced verbatim from `,v(`packages/agent-ui/shared/src/storage/adapter.ts`),` (ADR-0193 cl.1) — async throughout, since an IndexedDB-fronting seam cannot be sync without a stale in-memory mirror (ADR-0193 Alternatives):`)),b.append(n(h(f,`StorageChange`),`ts`)),b.append(n(h(f,`StorageAdapter`),`ts`)),b.append(_(v(`subscribe`),` is optional and lazily wired — nothing is listened to until a caller calls it, and the listener stops the moment the returned unsubscribe function runs (ADR-0193 cl.4). Absent ⇒ no external-change reactivity, the same "optional, absence is a documented no-op" shape `,v(`SettingsStore.subscribe`),` already uses one layer up (§3 below).`)),b.append(r(2,`Live — the localStorage tier`)),b.append(_(`A real `,v(`createLocalStorageAdapter({ namespace: 'agent-ui-docs.persistence-demo' })`),` from `,v(`@agent-ui/shared`),`, driven by two real `,v(`ui-text-field`),`s and three real `,v(`ui-button`),`s — Write calls `,v(`adapter.set(key, value)`),`, Read calls `,v(`adapter.get(key)`),`, Clear calls `,v(`adapter.delete(key)`),`. Reload this page — the namespace persists across reloads, same as any real consumer’s would.`));{let e=`agent-ui-docs.persistence-demo`,t=c({namespace:e}),n=document.createElement(`ui-text-field`);n.setAttribute(`label`,`Key`),n.setAttribute(`placeholder`,`e.g. draft-title`);let r=document.createElement(`ui-text-field`);r.setAttribute(`label`,`Value`),r.setAttribute(`placeholder`,`e.g. Hello, persistence`);let i=document.createElement(`ui-button`);i.setAttribute(`variant`,`solid`),i.textContent=`Write`;let a=document.createElement(`ui-button`);a.setAttribute(`variant`,`soft`),a.textContent=`Read`;let o=document.createElement(`ui-button`);o.setAttribute(`variant`,`ghost`),o.textContent=`Clear`;let s=u(`p`,{class:`persistence-demo-status`},[document.createTextNode(`—`)]);s.style.fontFamily=`var(--md-sys-typeface-mono)`,s.style.fontSize=`0.8rem`,s.style.whiteSpace=`pre-wrap`;let d=()=>n.value,f=()=>r.value,p=e=>{s.textContent=e};i.addEventListener(`click`,()=>{t.set(d(),f()).then(()=>p(`wrote ${e}.${d()} = ${JSON.stringify(f())}`))}),a.addEventListener(`click`,()=>{t.get(d()).then(t=>p(t===void 0?`${e}.${d()} — no value stored`:`read ${e}.${d()} = ${JSON.stringify(t)}`))}),o.addEventListener(`click`,()=>{t.delete(d()).then(()=>p(`cleared ${e}.${d()}`))});let m=u(`div`,{class:`persistence-demo-row`},[n,r]);m.style.display=`flex`,m.style.gap=`0.75rem`,m.style.flexWrap=`wrap`;let h=u(`div`,{class:`persistence-demo-buttons`},[i,a,o]);h.style.display=`flex`,h.style.gap=`0.5rem`,b.append(l(`Live — createLocalStorageAdapter`,m,h,s)),n.value=`draft-title`,r.value=`Hello, persistence`}b.append(n([`import { createLocalStorageAdapter } from '@agent-ui/shared'`,``,`const adapter = createLocalStorageAdapter({ namespace: 'my-feature' })`,`await adapter.set('draft-title', 'Hello, persistence')  // -> localStorage['my-feature.draft-title']`,`await adapter.get('draft-title')                        // -> 'Hello, persistence'`,`await adapter.delete('draft-title')`,`await adapter.keys()                                    // -> every key under the 'my-feature.' namespace`].join(`
`),`ts`)),b.append(n(h(p,`LocalStorageAdapterOptions`),`ts`)),b.append(n(g(p,`createLocalStorageAdapter`),`ts`)),b.append(_(`The whole `,v(`namespace`),` belongs to one adapter — `,v(`keys()`),` prefix-scans it, so nothing else should write under the same namespace (ADR-0193 cl.2). Every method degrades to a safe no-op/undefined — never a throw — when localStorage is unavailable (SSR, a locked-down embed). `,v(`subscribe`),` rides the native `,v(`window`),` `,v(`storage`),` event — zero-dep, and fires only in OTHER tabs sharing the origin (never the tab that made the write).`)),b.append(r(2,`The IndexedDB tier`)),b.append(_(`For a genuinely large-value consumer (a corpus cache, a multi-KB A2UI payload) — localStorage’s ~5MB/origin ceiling doesn’t apply. ONE object store per adapter instance, every `,v(`IDBRequest`),`/transaction hand-wrapped in a `,v(`new Promise`),` (the `,v(`idb`),` library’s PATTERN, hand-rolled, never the dependency — the fleet’s zero-dep law, ADR-0193 Alternatives).`)),b.append(n(h(m,`IndexedDbAdapterOptions`),`ts`)),b.append(n(g(m,`createIndexedDbAdapter`),`ts`)),b.append(_(`Absent `,v(`indexedDB`),` (jsdom — this page’s own test environment — or a locked-down embed), every method REJECTS with a named Error instead of silently no-op-ing: an IndexedDB failure is a real capacity/availability failure a caller needs to see, unlike a missing localStorage (ADR-0193 cl.3). Cross-tab notification rides `,v(`BroadcastChannel`),` (IndexedDB has no `,v(`storage`),`-event equivalent), opened lazily on the first `,v(`set`),`/`,v(`delete`),`/`,v(`subscribe`),` call — with no `,v(`close()`),` exposed in this slice, a real (small) leak surface for a caller constructing many short-lived instances against the same store (ADR-0193 Consequences, named rather than hidden).`)),b.append(r(2,`Choosing a tier`));{let e=[{tier:`createLocalStorageAdapter`,syncAsync:`Async wrapper (localStorage itself is sync)`,capacity:`~5MB / origin, string-keyed`,crossTab:`Native storage event (zero-dep, other tabs only)`,when:`Small string/JSON values — a draft, a filter set, a small preference blob.`},{tier:`createIndexedDbAdapter`,syncAsync:`Genuinely async (IDBRequest/transaction)`,capacity:`Capacity-realistic, browser-quota-bound`,crossTab:`BroadcastChannel (zero-dep, every other open channel — tab or not)`,when:`A corpus cache, a session transcript, a multi-KB A2UI payload.`},{tier:`SettingsStore (@agent-ui/app)`,syncAsync:`Deliberately sync (fork F7 — no pending/loading state)`,capacity:`Whatever the concrete store backs it with (memory-store.ts: localStorage)`,crossTab:`Store-defined optional subscribe(key, value)`,when:`ui-settings only — this contract is what it reads/writes through, not a general-purpose seam.`},{tier:`@agent-ui/data resource()/mutation()`,syncAsync:`N/A — an in-memory cache, not a storage tier`,capacity:`Process memory, dies with the page`,crossTab:`None`,when:`Never for persistence — see §6 below.`}],t=document.createElement(`table`);t.append(o(`Tier`,`Sync / async`,`Capacity`,`Cross-tab`,`Reach for it when`));let n=document.createElement(`tbody`);for(let t of e)n.append(a(s(t.tier),i(t.syncAsync),i(t.capacity),i(t.crossTab),i(t.when)));t.append(n),b.append(t)}b.append(r(2,`settings-store vs memory-store — now on the seam (PR #1027)`)),b.append(_(v(`@agent-ui/app`),`’s `,v(`ui-settings`),` reads/writes through its OWN, deliberately sync `,v(`SettingsStore`),` contract (`,v(`packages/agent-ui/app/src/controls/settings/store.ts`),`) — a DIFFERENT, higher-altitude seam ADR-0193 does not touch, supersede, or require `,v(`ui-settings`),` to adopt (ADR-0193’s own header, "Relates" line):`)),b.append(n(h(d,`SettingsStore`),`ts`)),b.append(_(`The REFERENCE adapter, `,v(`memory-store.ts`),`’s `,v(`createMemoryStore`),`, bridges the two: its `,v(`persistKey`),` flavour now WRITES through `,v(`@agent-ui/shared`),`’s `,v(`createLocalStorageAdapter`),` (PR #1027) instead of touching `,v(`localStorage`),` directly, fronted by a synchronous read-through cache (a construct-then-`,v(`get`),` must see a persisted value in the same tick — no async `,v(`keys()`),`/`,v(`get()`),` round trip can satisfy that). Full detail + the derived `,v(`MemoryStoreOptions`),` interface: `,y(`./settings.html`,`the Settings guide`),`, §2b.`)),b.append(r(2,`How @agent-ui/data relates — caching is not persistence`)),b.append(_(`Honestly: barely. `,v(`@agent-ui/data`),`’s `,v(`resource()`),`/`,v(`mutation()`),`/`,v(`paginated()`),` back a structurally-sharing, instance-scoped, IN-MEMORY store — it dies with the page, exactly like `,v(`memory-store.ts`),`’s un-persisted Map flavour. `,v(`@agent-ui/data`),`’s own guide states this explicitly: persistence is "deliberately NOT this package’s" (`,y(`./data-doc.html`,`Data`),`, "Where it sits"). `)),b.append(_(`There is no built-in `,v(`StorageAdapter`),` hook anywhere in `,v(`@agent-ui/data`),` v1 — no `,v(`resource(key, source, { persist: adapter })`),` option exists today. A consumer wanting a `,v(`resource()`),` to survive a reload would compose it by hand: read the adapter at construction to seed an `,v(`initial`),` value, and write through it on every commit — the exact shape `,v(`memory-store.ts`),` hand-rolls one layer down (§5 above), not a capability `,v(`@agent-ui/data`),` ships. Stated as a gap, not a feature — a future adapter-hook slice, if it happens, is its own dispatch against a future issue, not decided here.`)),b.append(r(2,`Where it sits`)),b.append(_(`@agent-ui/shared`,` — the DAG’s bottom (`,v(`shared ← components ← {a2ui, router, code, data} ← app`),`) — imports nothing, so every layer AT OR ABOVE it can reach `,v(`StorageAdapter`),` without an upward import: a corpus cache, an A2UI payload store, a session-transcript buffer, or `,v(`@agent-ui/app`),`’s own settings surfaces (ADR-0193 Consequences). ADR-0193 itself is STATUS: proposed, not yet ratified — `,`the interface + both tiers + the notification seam are shipped code (PRs #1012/#1027), but the decision record backing them has not been ratified as of this page’s own build.`));