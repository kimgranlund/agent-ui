// memory-store.ts — the REFERENCE `SettingsStore` adapter (LLD-C15, SPEC-R12) for the demo/tests, not a
// dependency of `ui-settings` (which imports only `store.ts`'s interface — SPEC-R12 AC3). Two flavours,
// one factory: an in-process Map (the default — dies with the page, round-trips within a session) and an
// optional `localStorage`-backed variant (the `persistKey` option) that round-trips ACROSS two separate
// store instances (SPEC-R12 AC2's "write → reload" proof needs real persistence, not just object
// identity).

import type { SettingsStore } from './store.ts'

export interface MemoryStoreOptions {
  /** Seed values, keyed the same as the schema's field `key`s. */
  initial?: Readonly<Record<string, unknown>>
  /** When set, every read/write also round-trips through `localStorage` under `${persistKey}.${key}`
   *  (JSON-encoded) — the ONLY way two separately-constructed stores can observe the same value (a plain
   *  in-memory Map is per-instance). Omit for a pure in-memory store (the common demo/test case).
   *
   *  `${persistKey}.` is this store's whole NAMESPACE: construction rehydrates every key it holds (GH #409),
   *  seeded or not, so nothing else should write under it. */
  persistKey?: string
}

/** A reference `SettingsStore`: synchronous Map-backed get/set + `subscribe`, optionally mirrored into
 *  `localStorage` for cross-instance persistence. */
export function createMemoryStore(options: MemoryStoreOptions = {}): SettingsStore {
  const { initial, persistKey } = options
  const values = new Map<string, unknown>(Object.entries(initial ?? {}))
  const listeners = new Set<(key: string, value: unknown) => void>()

  const storageKey = (key: string): string => `${persistKey}.${key}`

  if (persistKey && typeof localStorage !== 'undefined') {
    // Seed from any previously-persisted values (a real reload, or a fresh store pointed at the same
    // persistKey) — persisted values WIN over the constructor's `initial` seed, native-`localStorage`-parity.
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
    const prefix = `${persistKey}.`
    for (let index = 0; index < localStorage.length; index += 1) {
      const stored = localStorage.key(index)
      if (stored === null || !stored.startsWith(prefix)) continue
      const raw = localStorage.getItem(stored)
      if (raw === null) continue
      try {
        values.set(stored.slice(prefix.length), JSON.parse(raw) as unknown)
      } catch {
        // A corrupt/foreign value under this key — keep the constructor's seed, never throw.
      }
    }
  }

  return {
    get(key) {
      return values.get(key)
    },
    set(key, value) {
      values.set(key, value)
      if (persistKey && typeof localStorage !== 'undefined') {
        localStorage.setItem(storageKey(key), JSON.stringify(value))
      }
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
