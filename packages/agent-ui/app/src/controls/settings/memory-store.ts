// memory-store.ts — the REFERENCE `SettingsStore` adapter (LLD-C15, SPEC-R12) for the demo/tests, not a
// dependency of `ui-settings` (which imports only `store.ts`'s interface — SPEC-R12 AC3). Two flavours,
// one factory: an in-process Map (the default — dies with the page, round-trips within a session) and an
// optional `localStorage`-backed variant (the `persistKey` option) that round-trips ACROSS two separate
// store instances (SPEC-R12 AC2's "write → reload" proof needs real persistence, not just object
// identity).
//
// GH #959 (remaining slice, 2026-08-16) + GH #1077 (read-path migration, 2026-08-17) — the persisted
// flavour goes through `@agent-ui/shared`'s localStorage `StorageAdapter` tier (ADR-0193) END-TO-END:
// `createLocalStorageAdapter({ namespace: persistKey })` owns the `${persistKey}.${key}` key format, the
// `JSON.stringify` encoding, AND the namespace enumeration — no code in this module touches
// `localStorage` directly (parity-pinned in `memory-store.test.ts`). The seam's BASE contract is async by
// ADR-0193 ruling, while `SettingsStore` is sync by SPEC-R12 fork F7 — the bridge is a SYNC READ-THROUGH
// CACHE: the `values` Map answers every `get` synchronously, is WARMED at construction by the TIER's own
// sync read surface — `keysSync()`/`getSync()`, `SyncReadableStorageAdapter` (ADR-0193 Amendment A1/A4;
// same-tick over the live `localStorage`, so a construct-then-`get` sees the persisted value in the same
// tick — `store.test.ts`'s persistKey suite pins it) — and is written through to the adapter on every
// `set`. The localStorage
// tier's `set()` performs its `setItem` synchronously before its promise settles (an `async` body runs to
// its first `await`, and it has none), so a second instance constructed right after a `set` still sees the
// write — the pre-existing cross-instance test is the trip-wire for that assumption. Consequence: this
// store is pinned to the localStorage tier — an IndexedDB-backed `SettingsStore` would need an async
// hydration handshake `SettingsStore` does not have (a planner call, not this module's).

import { createLocalStorageAdapter, type SyncReadableStorageAdapter } from '@agent-ui/shared'
import type { SettingsStore } from './store.ts'

export interface MemoryStoreOptions {
  /** Seed values, keyed the same as the schema's field `key`s. */
  initial?: Readonly<Record<string, unknown>>
  /** When set, every read/write also round-trips through `localStorage` under `${persistKey}.${key}`
   *  (JSON-encoded, via `@agent-ui/shared`'s localStorage `StorageAdapter` tier — ADR-0193) — the ONLY way
   *  two separately-constructed stores can observe the same value (a plain in-memory Map is per-instance).
   *  Omit for a pure in-memory store (the common demo/test case).
   *
   *  `${persistKey}.` is this store's whole NAMESPACE: construction rehydrates every key it holds (GH #409),
   *  seeded or not, so nothing else should write under it. */
  persistKey?: string
}

/** A reference `SettingsStore`: synchronous Map-backed get/set + `subscribe`, optionally mirrored into
 *  `localStorage` (through the shared `StorageAdapter` seam) for cross-instance persistence. */
export function createMemoryStore(options: MemoryStoreOptions = {}): SettingsStore {
  const { initial, persistKey } = options
  const values = new Map<string, unknown>(Object.entries(initial ?? {}))
  const listeners = new Set<(key: string, value: unknown) => void>()

  // The write-through seam (ADR-0193). Its own `typeof localStorage` guard makes every call a safe no-op
  // where localStorage is unavailable, so no second guard is needed on the write path.
  const adapter: SyncReadableStorageAdapter | undefined = persistKey ? createLocalStorageAdapter({ namespace: persistKey }) : undefined

  if (adapter) {
    // Seed from any previously-persisted values (a real reload, or a fresh store pointed at the same
    // persistKey) — persisted values WIN over the constructor's `initial` seed, native-`localStorage`-parity.
    //
    // This is the sync read-through cache's warm-up (module banner): the TIER's own sync read surface,
    // `keysSync()`/`getSync()` (ADR-0193 Amendment A1/A4) — same-tick over the live `localStorage`, so a
    // `SettingsStore` answers the persisted value in the tick it is constructed; the adapter owns key
    // format, JSON encoding, and enumeration end-to-end (its no-localStorage guard makes this a no-op
    // where storage is unavailable). A corrupt/foreign value reads as `undefined` (the tier's fail-open
    // idiom) and is skipped — the constructor's seed survives, never a throw.
    //
    // GH #409 — this is a PREFIX SCAN of the whole `${persistKey}.` namespace, not a walk of the seed's
    // own keys. The old seed-key walk made the seed a hidden allowlist: a key the store had genuinely
    // WRITTEN (`set` persisted it) but the seed never carried was invisible on the next construction, so
    // it round-tripped inside one live instance and vanished on reload — which is exactly how
    // agent-admin's Surface Options and capability master toggles (no preset seed carries them) persisted
    // and then never came back. Scanning the namespace fixes the CLASS: whatever this persistKey holds is
    // what this store answers, seeded or not.
    //
    // The namespace is the whole contract, so a caller that parks its OWN bookkeeping under a store's
    // persistKey now has it rehydrated as a store key too (agent-admin-presets.ts's per-persona
    // `agent-admin-app.<id>.seedVersion` marker is the one such neighbour in this repo — inert: nothing
    // reads a `seedVersion` store key, and the persona file's exported key set is enumerated, never
    // "whatever the namespace holds"). Keys are namespaced by the trailing `.`, so two persistKeys where
    // one is a leading substring of the other (`…app.travel` vs `…app.travel-imported`) never cross.
    for (const key of adapter.keysSync()) {
      const value = adapter.getSync(key)
      if (value !== undefined) values.set(key, value)
    }
  }

  return {
    get(key) {
      return values.get(key)
    },
    set(key, value) {
      values.set(key, value)
      // Write-through to the seam. The localStorage tier's `setItem` runs synchronously inside this call
      // (banner); the returned promise carries nothing this sync store can wait on, so it is released
      // (a rejected write — quota, a locked-down embed that throws — surfaces as an unhandled rejection
      // instead of the pre-migration synchronous throw: the ONE behavioural delta, error path only).
      void adapter?.set(key, value)
      for (const listener of listeners) listener(key, value)
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    save(next) {
      for (const [key, value] of Object.entries(next)) this.set(key, value)
    },
  }
}
