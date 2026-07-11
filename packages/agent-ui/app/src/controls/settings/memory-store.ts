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
   *  in-memory Map is per-instance). Omit for a pure in-memory store (the common demo/test case). */
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
    for (const key of values.keys()) {
      const raw = localStorage.getItem(storageKey(key))
      if (raw !== null) {
        try {
          values.set(key, JSON.parse(raw) as unknown)
        } catch {
          // A corrupt/foreign value under this key — keep the constructor's seed, never throw.
        }
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
