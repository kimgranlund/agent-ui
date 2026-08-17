// local-storage-adapter.ts — the localStorage `StorageAdapter` tier (ADR-0193 cl.2, GH #959 Slice 1).
// Mirrors `@agent-ui/app`'s `memory-store.ts` namespacing convention deliberately (trailing-dot-delimited
// `${namespace}.${key}` prefix scan) so that store's migration onto this seam was a drop-in, not a
// re-derivation — landed in GH #959's remaining slice (2026-08-16): `createMemoryStore({ persistKey })`
// now WRITES through this tier (its sync hydration stays a direct scan of the same namespace — the
// `SettingsStore` contract is sync, this seam is async by ADR-0193 ruling; parity-pinned in
// `app/src/controls/settings/memory-store.test.ts`).
// Cross-tab notification rides the native `storage` DOM event — genuinely zero-dep, fires only in OTHER
// tabs/windows sharing the origin, never the tab that made the write (browser-native same-tab exclusion).

import type { StorageAdapter, StorageChange } from './adapter.ts'

export interface LocalStorageAdapterOptions {
  /** Every key this adapter reads/writes lives under `${namespace}.${key}` — the WHOLE namespace belongs
   *  to this adapter (`keys()` prefix-scans it), so nothing else should write under the same namespace
   *  (the same whole-namespace contract `memory-store.ts`'s `persistKey` already documents). */
  namespace: string
}

const isBrowserStorageAvailable = (): boolean => typeof localStorage !== 'undefined'

const parse = (raw: string | null): unknown => {
  if (raw === null) return undefined
  try {
    return JSON.parse(raw) as unknown
  } catch {
    // A corrupt/foreign value under this key — degrade to `undefined`, never throw (same fail-open
    // idiom `memory-store.ts`'s corrupt-JSON catch already establishes).
    return undefined
  }
}

/** A `StorageAdapter` backed by `localStorage`, namespaced so multiple adapters can share one origin
 *  without colliding (ADR-0193 cl.2). Every method degrades to a safe no-op/`undefined` — never a
 *  throw — when `localStorage` is unavailable (SSR, a locked-down embed). */
export function createLocalStorageAdapter(options: LocalStorageAdapterOptions): StorageAdapter {
  const { namespace } = options
  const prefix = `${namespace}.`
  const storageKey = (key: string): string => `${prefix}${key}`

  return {
    async get(key) {
      if (!isBrowserStorageAvailable()) return undefined
      return parse(localStorage.getItem(storageKey(key)))
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
      if (!isBrowserStorageAvailable()) return []
      const out: string[] = []
      for (let index = 0; index < localStorage.length; index += 1) {
        const stored = localStorage.key(index)
        if (stored !== null && stored.startsWith(prefix)) out.push(stored.slice(prefix.length))
      }
      return out
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
