// core/cache.ts — SPEC-R4: the instance-scoped, single-writer, structurally-sharing store.
// Only `commit` mutates. A `snapshot()` is a reference to the CURRENT internal state object — O(1),
// no per-key copy — and `restore()` swaps that reference back, so untouched entries keep identity
// across a snapshot/commit/restore round-trip (the corpus `put` + a2ui `setPointer` mechanism,
// re-implemented minimally per ADR-0192's DAG constraint: `data` cannot import `a2ui`).

/** An opaque, structurally-shared point-in-time view of a store (SPEC-R4). */
export interface StoreSnapshot<T = unknown> {
  readonly map: ReadonlyMap<string, T>
}

/**
 * Why a key's subscriber fired: `'commit'` — the value changed (a fresh read, a `live` push, an
 * optimistic write, a rollback) and a holder should just MIRROR the new value; `'invalidate'` —
 * the key was marked stale and an active `resource()` should actually re-fetch. Collapsing these
 * into one signal would make every external commit (an optimistic write, `paginated()`'s own
 * page-list commit) trigger a redundant re-read that clobbers the just-written value.
 */
export type StoreChangeReason = 'commit' | 'invalidate'

/** The instance-scoped key -> value cache (SPEC-R4). */
export interface Store<T = unknown> {
  get(key: string): T | undefined
  commit(key: string, value: T | ((prev: T | undefined) => T)): void
  snapshot(): StoreSnapshot<T>
  restore(snap: StoreSnapshot<T>): void
  invalidate(keyOrPrefix: string): void
  subscribe(key: string, cb: (reason: StoreChangeReason) => void): () => void
}

/** `createStore()` — SPEC-R4. */
export function createStore<T = unknown>(): Store<T> {
  let state: StoreSnapshot<T> = { map: new Map() }
  const listeners = new Map<string, Set<(reason: StoreChangeReason) => void>>()

  const notify = (key: string, reason: StoreChangeReason): void => {
    const set = listeners.get(key)
    if (!set) return
    for (const cb of [...set]) cb(reason)
  }

  return {
    get(key) {
      return state.map.get(key)
    },
    commit(key, value) {
      const prev = state.map.get(key)
      const next = typeof value === 'function' ? (value as (p: T | undefined) => T)(prev) : value
      if (Object.is(next, prev)) return // the kernel cutoff (SPEC-R4 AC3) — no wake on a no-op write
      const nextMap = new Map(state.map) // copy-on-write: untouched entries keep their reference
      nextMap.set(key, next)
      state = { map: nextMap }
      notify(key, 'commit')
    },
    snapshot() {
      return state // O(1) — the current immutable state object, not a per-key copy
    },
    restore(snap) {
      const prev = state
      state = snap
      // a restore can silently change many keys at once (e.g. a mutation rollback); subscribers of
      // every key present in the restored map are mirrored — never re-fetched — AND so are the
      // keys the rollback REMOVED (present before, absent now: an optimistic create rolled back).
      for (const key of state.map.keys()) notify(key, 'commit')
      for (const key of prev.map.keys()) if (!state.map.has(key)) notify(key, 'commit')
    },
    invalidate(keyOrPrefix) {
      for (const key of state.map.keys()) {
        if (key === keyOrPrefix || key.startsWith(keyOrPrefix)) notify(key, 'invalidate')
      }
      // a prefix with no committed entries yet (e.g. invalidating before any read) still wakes an
      // exact-match subscriber that predates any commit under that key.
      if (!state.map.has(keyOrPrefix)) notify(keyOrPrefix, 'invalidate')
    },
    subscribe(key, cb) {
      let set = listeners.get(key)
      if (!set) {
        set = new Set()
        listeners.set(key, set)
      }
      set.add(cb)
      return () => {
        set!.delete(cb)
        if (set!.size === 0) listeners.delete(key)
      }
    },
  }
}

/**
 * A module-level default store for `resource()`/`mutation()` called without an explicit `store`
 * — a documented soft global (the ADR-0115 `defaultRouter` posture, SPEC-R4). Tests use explicit
 * stores; this default exists for casual consumer code only.
 */
export const defaultStore: Store = createStore()
