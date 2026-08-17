// adapter.ts — the `StorageAdapter` persistence seam (ADR-0193, GH #959 Slice 1). Async `get`/`set`/
// `delete`/`keys` at the DAG's bottom (`@agent-ui/shared`) so any layer at or above `shared` can persist
// without an upward import — the localStorage tier (`local-storage-adapter.ts`) and the IndexedDB tier
// (`indexed-db-adapter.ts`) both implement this ONE contract. Deliberately ASYNC throughout, unlike
// `@agent-ui/app`'s `SettingsStore` (`app/src/controls/settings/store.ts`, SPEC-R12 fork F7's sync
// choice) — IndexedDB's own API is irreducibly async, and this seam fronts it directly (ADR-0193
// Alternatives). The two contracts are deliberately separate; this ADR does not touch `SettingsStore`.

/** One external-change notification — the cross-tab/cross-instance seam (ADR-0193 cl.4), opt-in via
 *  `StorageAdapter.subscribe`. `value`/`oldValue` are `undefined` when the change was a `delete`. */
export interface StorageChange {
  key: string
  value: unknown
  oldValue?: unknown
}

/**
 * The persistence-adapter contract every `shared`-or-above consumer may reach for (ADR-0193). Every
 * method is async — a sync facade over IndexedDB is not possible without a stale in-memory mirror
 * (ADR-0193 Alternatives), so this seam does not offer one (the ONE tier-scoped exception: a tier whose
 * backing store IS synchronous may implement `SyncReadableStorageAdapter` — ADR-0193 Amendment, A1–A3).
 */
export interface StorageAdapter {
  /** Read the currently-persisted value for `key`, or `undefined` if this adapter holds nothing for it. */
  get(key: string): Promise<unknown>

  /** Persist `value` for `key`, overwriting any prior value. */
  set(key: string, value: unknown): Promise<void>

  /** Remove `key` and its value. A no-op (never a throw) when `key` was never set. */
  delete(key: string): Promise<void>

  /** Every key this adapter currently holds a value for, in no guaranteed order. */
  keys(): Promise<string[]>

  /**
   * Optional external-change notification (ADR-0193 cl.4): the adapter calls `listener(change)` when a
   * value changes from OUTSIDE this adapter instance — another tab (localStorage tier, the native
   * `storage` event) or another instance/tab sharing the same store (IndexedDB tier, `BroadcastChannel`).
   * Returns an unsubscribe function. Lazily wired: nothing here is listened to until `subscribe` is
   * called, and the listener stops the moment the returned function runs — the opt-in realization GH
   * #959's Slice-3 "(opt-in)" qualifier asks for, with no separate flag.
   *
   * Absent ⇒ no external-change reactivity is available at all (never implemented by every adapter — an
   * adapter MAY omit it, the same "optional, absence is a documented no-op" shape
   * `SettingsStore.subscribe` already uses at the `app` layer).
   */
  subscribe?(listener: (change: StorageChange) => void): () => void
}

/**
 * The sync READ extension for tiers whose backing store is synchronous by nature (ADR-0193 Amendment,
 * A1/A2) — today exactly ONE: the localStorage tier (`createLocalStorageAdapter` returns this type).
 * Both members are REQUIRED and are the exact same-tick counterparts of their async siblings over the
 * SAME live backing store — no snapshot, no second state (the stale-mirror facade stays rejected, A3).
 * Nothing may implement this over an async store (IndexedDB and any future async tier stay plain
 * `StorageAdapter`); the base contract gains no sync members.
 */
export interface SyncReadableStorageAdapter extends StorageAdapter {
  /** Synchronous `get`: the currently-persisted value for `key`, or `undefined` when absent — or when
   *  the backing store itself is unavailable (the same fail-open idiom as ADR-0193 cl.2). */
  getSync(key: string): unknown

  /** Synchronous `keys`: every key this adapter currently holds, `[]` when the backing store is
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
