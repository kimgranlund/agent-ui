// local-storage-adapter.ts — the localStorage `StorageAdapter` tier (ADR-0193 cl.2, GH #959 Slice 1).
// Mirrors `@agent-ui/app`'s `memory-store.ts` namespacing convention deliberately (trailing-dot-delimited
// `${namespace}.${key}` prefix scan) so that store's migration onto this seam was a drop-in, not a
// re-derivation — landed in GH #959's remaining slice (2026-08-16): `createMemoryStore({ persistKey })`
// WRITES through this tier, and since GH #1077 (2026-08-17) HYDRATES through it too, via the tier's
// `getSync`/`keysSync` sync read surface (ADR-0193 Amendment — the `SettingsStore` contract is sync;
// parity-pinned in `app/src/controls/settings/memory-store.test.ts`).
// Cross-tab notification rides the native `storage` DOM event — genuinely zero-dep, fires only in OTHER
// tabs/windows sharing the origin, never the tab that made the write (browser-native same-tab exclusion).

import type { StorageChange, SyncReadableStorageAdapter } from './adapter.ts'

export interface LocalStorageAdapterOptions {
  /** Every key this adapter reads/writes lives under `${namespace}.${key}` — the WHOLE namespace belongs
   *  to this adapter (`keys()` prefix-scans it), so nothing else should write under the same namespace
   *  (the same whole-namespace contract `memory-store.ts`'s `persistKey` already documents). */
  namespace: string
}

/** `typeof localStorage` still THROWS in a browser with cookies/site-data blocked (a throwing
 *  accessor, not merely `undefined`) — caught here so every caller's fail-open contract (this
 *  module's own "never a throw" doc) actually holds pre-paint, not just when the store is absent
 *  (GH #1544 review finding: a site's synchronous hydration read must never throw). */
const isBrowserStorageAvailable = (): boolean => {
  try {
    return typeof localStorage !== 'undefined'
  } catch {
    return false
  }
}

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
 *  throw — when `localStorage` is unavailable (SSR, a locked-down embed).
 *
 *  The return type is the SYNC-READABLE extension (ADR-0193 Amendment A1/A5 — a source-compatible
 *  narrowing): localStorage's backing store is synchronous by nature, so `getSync`/`keysSync` are the
 *  exact same-tick counterparts of `get`/`keys` over the same live store. */
export function createLocalStorageAdapter(options: LocalStorageAdapterOptions): SyncReadableStorageAdapter {
  const { namespace } = options
  const prefix = `${namespace}.`
  const storageKey = (key: string): string => `${prefix}${key}`

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
      try {
        localStorage.setItem(storageKey(key), JSON.stringify(value))
      } catch {
        // Quota exceeded, or a private-mode engine where `localStorage` EXISTS but every `setItem`
        // throws (old Safari private browsing) — degrade to session-only, never a throw (GH #1544
        // review finding: every drained call site does `void adapter.set(...)`, which turned this
        // into an unhandled rejection before this catch existed).
      }
    },

    async delete(key) {
      if (!isBrowserStorageAvailable()) return
      try {
        localStorage.removeItem(storageKey(key))
      } catch {
        /* see set() above */
      }
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
