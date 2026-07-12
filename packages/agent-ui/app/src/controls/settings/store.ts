// store.ts — the `SettingsStore` persistence-adapter SEAM (app-surfaces-m4.lld.md LLD-C15, SPEC-R12).
// A pure TypeScript interface, no implementation: `ui-settings` (settings.ts) depends ONLY on this
// contract, never a concrete store (SPEC-R12 AC3 — grep-guarded by store.test.ts). The app brings its
// own store (ADR-0120 cl.4); `memory-store.ts` ships a REFERENCE adapter for the demo/tests, not a
// dependency.
//
// Fork F7 (LLD §8) — RESOLVED per the LLD's recommendation: sync `get`/`set` + an optional `subscribe`
// (external-change notification) + an optional batch `save` (a save-button flow). Async/remote-sync
// stores are OUT of scope for v1 (the PRD fence) — a store that itself debounces/awaits a network round
// trip inside a sync `set` is the adapter's own business, invisible to this contract.

/**
 * The persistence adapter `ui-settings` reads/writes through. `get`/`set` are SYNCHRONOUS (fork F7): a
 * remote-backed store must resolve its own async work internally (e.g. optimistic-write + background
 * flush) — this seam does not model a pending/loading state.
 */
export interface SettingsStore {
  /** Read the currently-persisted value for `key`, or `undefined` if this store holds nothing for it
   *  (the caller falls back to the field's own `default` — SPEC-R12 AC2). */
  get(key: string): unknown

  /** Persist `value` for `key`. Called on a per-field commit (SPEC-R12 "per-field-on-change", the
   *  LLD-C15 recommended timing) — once per user-driven change, never on every keystroke. */
  set(key: string, value: unknown): void

  /**
   * Optional external-change notification: the store may call `listener(key, value)` when a value
   * changes from OUTSIDE `ui-settings` (another tab, a remote push). Returns an unsubscribe function.
   * Absent ⇒ no external-change reactivity — `ui-settings` is authoritative on read only at mount
   * (documented, LLD-C15 failure/edge handling).
   *
   * WIRED by `ui-settings` (TKT-0021, generate.ts's `subscribeExternalSync`): every generated field
   * subscribes and reflects a matching external `set(key, value)` into its own control via the registry's
   * `setValue`. Zero-echo is the kernel's Object.is precedent, not a flag — a notification whose value
   * already equals the control's own current `getValue()` (true for the store's own re-notification of a
   * commit the field JUST made) is a silent no-op; a genuinely different value reflects. Re-armed across a
   * relocation reconnect the same way the field's validation wiring is (settings.ts's reconnect branch).
   */
  subscribe?(listener: (key: string, value: unknown) => void): () => void

  /**
   * Optional batch write, for a store that prefers a single flush over N per-field `set` calls (a
   * save-button flow). `ui-settings` does not call this itself in this build (per-field-on-change is
   * the only wired timing) — exposed so a store implementation MAY offer it and a future consumer can
   * call it directly against the store it supplied.
   */
  save?(values: Readonly<Record<string, unknown>>): void
}
