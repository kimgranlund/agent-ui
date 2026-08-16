# ADR-0193 — a persistence-adapter seam in `@agent-ui/shared`: typed async `StorageAdapter` (`get`/`set`/`delete`/`keys`) + a localStorage tier + an IndexedDB tier + an opt-in cross-tab change-notification seam, ratifying what layers below `app` may persist through (GH #959, Slice 1)

> Source: agent-ui ADR log (this directory — the numbered files ARE the index; status lives in each ADR's own header). · 2026-08-16
>
> | Field | Value |
> |---|---|
> | **Status** | proposed |
> | **Date** | 2026-08-16 |
> | **Proposed by** | build-lead dispatch against GH [#959](https://github.com/kimgranlund/agent-ui/issues/959) Slice 1 — a layer-contract change (what `shared`, the DAG bottom, may persist through) earns an ADR before any consumer wires it, per doc-standards §1c (a genuine contract fork or ruling earns an ADR) |
> | **Ratified by** | *(pending — kimgranlund (repo owner) ratifies via a `ratify ADR-0193` utterance, verified + flipped by `scripts/adr_ratify.py`)* |
> | **Repairs** | on ratification (not authored here): `CLAUDE.md` §Layout's `@agent-ui/shared` line (currently "cross-cutting tokens/styles/utility types" only — this ADR adds a persistence-adapter seam to that line); otherwise none — this is the FIRST persistence contract at this layer, so there is no prior `PRD-G#`/`SPEC-R#`/`LLD-C#` row to repair; a future SPEC/LLD for the settings/persistence surface would `Extend` this ADR rather than this ADR repairing an existing one |
> | **Supersedes / Superseded by** | **Relates** [TKT-0062](../tickets/tkt-0062-entry-control-filled-state-law.md) / ADR-0191 (the "one fleet-wide convention, not per-component hacks" shape this ADR reapplies to persistence instead of visual state) · **Relates** `app/src/controls/settings/store.ts`'s `SettingsStore` seam (`app-surfaces-m4.spec.md` SPEC-R12, `app-surfaces-m4.lld.md` LLD-C15) — a DIFFERENT, higher-altitude contract (`ui-settings`' sync per-field read/write) that this ADR does not touch, supersede, or require `ui-settings` to adopt · **Extends** none (no prior persistence-adapter convention exists below `app`) · **Resolves** GH #959's Slice-1 scope note (interface + localStorage tier + IndexedDB tier + cross-tab notification seam, tests) |

## Context

Persistence today is localStorage-only, and the seam that touches `localStorage` directly lives in
`@agent-ui/app` (`app/src/controls/settings/memory-store.ts`'s `createMemoryStore({persistKey})`,
consumed by settings, entry-list, and agent-admin personas) plus a second, hand-rolled localStorage
touch-point in `site/pages/agent-admin-presets.ts` (per-persona `modifiedAt`/`seedVersion` keys). Two
consequences follow directly from persistence living at `app`: (1) nothing below `app` in the DAG
(`shared`, `components`, `router`, `code`, `a2ui`, `a2a`) can persist ANYTHING without either
importing upward (forbidden — CLAUDE.md's downward-only DAG) or re-inventing its own localStorage
touch-point (exactly the drift `site/pages/agent-admin-presets.ts`'s hand-rolled keys already show in
miniature); (2) there is no IndexedDB/OPFS tier at any layer, so any future consumer needing more than
small string-keyed values (a corpus cache, a session transcript, a large A2UI payload) has nowhere
zero-dep to reach for one.

GH #959 proposes closing this by adding an async `get`/`set`/`delete`/`keys` storage-adapter interface
at the DAG's bottom (`@agent-ui/shared` — Kim's own ruling, 2026-08-16, on the issue and
`.claude/ops/rulings.md`: "seam home = `@agent-ui/shared`"), with zero-dep, hand-rolled adapters
(never `idb`/`Dexie`/`localForage` — the fleet's zero-dependency law, one ruled exception already
spent on `@agent-ui/code/editor`'s CodeMirror 6, ADR-0139, and not reopened here). Because this changes
what layers below `app` are PERMITTED to persist through — a new capability every future
`shared`-or-above consumer inherits, not a private implementation detail — it is a layer-contract
change and earns an ADR before it ships, the same test ADR-0191 applied to a new host-state
convention: a fork needing a recommendation weighed, not a decision already made directly.

This ADR covers Slice 1 of GH #959's three-slice Acceptance, re-scoped by the build dispatch to land
in one PR: the adapter interface, a localStorage tier, an IndexedDB tier (originally Slice 2), and an
opt-in cross-tab change-notification seam (originally Slice 3's "BroadcastChannel cross-tab
invalidation (opt-in)"). Migrating `memory-store.ts` onto the new seam (the ORIGINAL issue's Slice-1
Acceptance line) is explicitly OUT of this build's scope — the dispatch's own scope note lists only
the interface + two tiers + notification seam + tests, not the `app`-level cutover, and `store.ts`'s
`SettingsStore` contract (sync get/set, `app-surfaces-m4.spec.md` SPEC-R12 / `app-surfaces-m4.lld.md`
LLD-C15 fork F7) is a deliberately different, higher-altitude seam this ADR does not touch or require
`ui-settings` to adopt (Consequences, below).

## Decision

1. **One typed, zero-dep `StorageAdapter` interface lands in `@agent-ui/shared`**
   (`packages/agent-ui/shared/src/storage/adapter.ts`): `get(key): Promise<unknown>`,
   `set(key, value): Promise<void>`, `delete(key): Promise<void>`, `keys(): Promise<string[]>` — async
   throughout (unlike `store.ts`'s deliberately-sync `SettingsStore`, LLD-C15 fork F7 — a storage adapter
   fronting IndexedDB cannot be sync, and this ADR does not retrofit that constraint onto the settings
   seam). One optional method, `subscribe?(listener: (change: StorageChange) => void): () => void`,
   for the cross-tab notification seam (cl.4) — absent ⇒ no external-change reactivity, the same
   "optional, absence is a documented no-op" shape `SettingsStore.subscribe` already uses.
2. **A localStorage tier, `createLocalStorageAdapter({ namespace })`**
   (`storage/local-storage-adapter.ts`): every key is namespaced `${namespace}.${key}` (the same
   trailing-dot-delimited prefix-scan convention `memory-store.ts` already uses, so a future
   `memory-store.ts` migration is a drop-in, not a re-derivation) — `get`/`set`/`delete` wrap
   `localStorage` in a resolved Promise; `keys()` prefix-scans the whole namespace. `subscribe`
   listens on the native `window` `storage` event (fires only in OTHER tabs/windows sharing the same
   origin — a genuine zero-dep cross-tab signal, no library). Absent `localStorage` (SSR, a locked-down
   embed) degrades every method to a safe no-op/`undefined`, never a throw — the same fail-open-to-
   undefined idiom `memory-store.ts`'s corrupt-JSON catch already establishes.
3. **An IndexedDB tier, `createIndexedDbAdapter({ dbName, storeName?, version? })`**
   (`storage/indexed-db-adapter.ts`): ONE object store per adapter instance (`storeName` defaults
   `'kv'`), versioned `onupgradeneeded` creates it if absent, every `IDBRequest`/transaction
   hand-wrapped in a `new Promise` (the `idb` library's PATTERN, reimplemented, never the dependency —
   Context above). `subscribe` uses a `BroadcastChannel` scoped `agent-ui-storage:${dbName}:${storeName}`,
   posting `{key, value}` on every `set`/`delete` — genuinely cross-tab AND cross-instance-within-a-tab
   (unlike the native `storage` event, `BroadcastChannel` fires for every OTHER open channel of the
   same name, tab or not). Absent `indexedDB` (jsdom, a locked-down embed) every method rejects with a
   named `Error('indexedDB unavailable')` rather than silently no-op-ing — IndexedDB failures are
   real capacity/availability failures a caller needs to see, unlike a missing `localStorage` which
   this fleet already treats as a benign degrade.
4. **The cross-tab notification seam is opt-in by construction, not a standing subscription — no
   LISTENER is ever attached until a caller calls `subscribe()`.** The localStorage tier's `window`
   `storage` listener is created lazily inside `subscribe` and removed by the returned unsubscribe
   function — `get`/`set`/`delete`/`keys` alone never touch `window`. The IndexedDB tier's
   `BroadcastChannel` is a genuinely different shape: because `set`/`delete` must POST on it for
   OTHER instances to ever hear a change, the channel itself opens lazily on the first `set`,
   `delete`, or `subscribe` call (whichever comes first) and then lives for that adapter instance's
   lifetime — `subscribe`'s unsubscribe removes only the LISTENER, never closes the channel (no
   `close()` is exposed in this slice; Consequences names the resulting leak surface). "Opt-in" here
   means no LISTENING happens until `subscribe()` is called, not that the channel itself is inert
   until then — GH #959's Slice-3 "(opt-in)" qualifier is realized at the listener boundary, the one
   a caller actually observes (an unsubscribed adapter emits nothing to anyone), without a separate
   feature flag.
5. **`shared` still imports nothing but itself.** Neither tier imports `@agent-ui/components` or any
   other workspace package or npm dependency — only ambient DOM globals (`localStorage`, `window`,
   `indexedDB`, `BroadcastChannel`) already available under this repo's `lib: ["ES2023", "DOM",
   "DOM.Iterable"]` tsconfig, guarded at every call site for an environment where they're absent. The
   existing `layering.test.ts` trip-wire (shared/src, every non-test module: local imports only)
   covers this by construction — no new gate needed.
6. **`app/src/controls/settings/store.ts`'s `SettingsStore` seam is untouched.** `ui-settings` keeps
   reading/writing through its own sync interface; this ADR neither requires nor forbids a FUTURE
   migration of `memory-store.ts` onto `StorageAdapter` (an async-wrapped sync facade, or a genuine
   `SettingsStore` async variant) — that migration, if and when it happens, is its own dispatch against
   GH #959's remaining scope, not decided here.

## Consequences

- Every future `shared`-or-above consumer (a corpus cache, an A2UI payload store, a session-transcript
  buffer, `app`'s own settings surfaces) has ONE typed seam to reach for instead of a fourth hand-rolled
  localStorage touch-point (`site/pages/agent-admin-presets.ts`'s per-persona keys being the second,
  `memory-store.ts` the first) — the GH #959 Context's own stated goal.
- A genuinely large-value consumer (a corpus cache, a multi-KB A2UI payload) now has a zero-dep,
  capacity-realistic IndexedDB tier instead of being forced into `localStorage`'s ~5MB/origin ceiling
  or an OPFS tier this ADR deliberately defers (GH #959's own Scope/Open: "OPFS deferred until a
  blob-scale consumer exists" — unchanged here).
- `memory-store.ts` and `site/pages/agent-admin-presets.ts` are NOT migrated by this change — they
  keep behaving exactly as today. A stale-context risk this ADR names rather than silently accepts:
  the next reader of `memory-store.ts` sees a NEW, more general seam exists one layer down and may
  reasonably ask why `memory-store.ts` doesn't use it yet; the answer is scope, not oversight, and
  belongs on GH #959's own remaining Acceptance line, not invented fresh at that read.
- Two different async-vs-sync persistence contracts now coexist in the DAG (`store.ts`'s sync
  `SettingsStore` at `app`, this ADR's async `StorageAdapter` at `shared`) — a deliberate, named
  divergence (Decision cl.6), not a drift: `SettingsStore`'s sync contract is LLD-C15 fork F7's own
  ruled scope boundary ("async/remote-sync stores are OUT of scope for v1"), and retrofitting it would
  be its own SPEC change, not something this ADR does by side effect.
- An IndexedDB adapter instance that has written at least once opens a `BroadcastChannel` for the
  lifetime of that instance (lazily, on first `set`/`delete`/`subscribe` — never on `get`/`keys` alone,
  and never at construction) with no `close()` exposed; a caller that constructs many short-lived
  adapter instances against the same `dbName`/`storeName` accumulates open channels — a real (small)
  leak surface named here rather than discovered later. Separately, every consumer of `subscribe()`
  owns calling its returned unsubscribe on teardown to stop LISTENING (the channel itself stays open),
  the same discipline `SettingsStore.subscribe` already requires of `ui-settings`' generated fields.

## Alternatives considered

- **Keep the seam in `@agent-ui/app`, add IndexedDB there instead** — rejected: this is exactly the
  status quo GH #959 opens against (Context above) — nothing below `app` could ever persist without
  an upward import, permanently fencing `components`/`router`/`code`/`a2ui`/`a2a` out of persistence
  regardless of future need. Kim's own ruling on the issue names `shared` explicitly; this ADR
  ratifies that ruling rather than re-litigating it.
- **A synchronous `StorageAdapter`, matching `SettingsStore`'s shape for API consistency** — rejected:
  IndexedDB's own API is irreducibly async (`IDBRequest` events, transaction completion callbacks) —
  a sync facade over it would need to either block (impossible in a browser) or fake synchronicity
  with a stale in-memory mirror, silently reintroducing the exact race a real async contract avoids.
  `store.ts`'s sync choice was itself scoped to v1's simpler in-memory/localStorage case (LLD-C15 fork
  F7); an IndexedDB-fronting seam is a genuinely different problem shape and earns its own (async)
  contract rather than forcing one mismatch to match the other.
- **Adopt `idb` (or `Dexie`/`localForage`) instead of hand-rolling the Promise wrapper** — rejected:
  the fleet's zero-dependency law has exactly one ruled exception (`@agent-ui/code/editor`'s CodeMirror
  6, ADR-0139, an opt-in subpath never touching the default barrels) — `shared` is the DAG's bottom,
  imported by every other package; a dependency there would propagate into EVERY consumer's bundle,
  the opposite of an opt-in subpath exception. `idb`'s own implementation is a thin Promise wrapper
  over the same `IDBRequest`/transaction primitives this ADR hand-wraps directly — the PATTERN is
  worth adopting, the dependency is not (GH #959 Acceptance's own "Zero-dep law holds" line).
  Same reasoning excludes `Dexie` (a much larger ORM-shaped surface) and `localForage` (a
  localStorage-first polyfill library this ADR's own localStorage tier already covers natively).
- **A single unified adapter auto-selecting IndexedDB-or-localStorage per environment, instead of two
  named constructors** — rejected for Slice 1: an auto-selecting adapter hides which storage a value
  actually landed in from the caller, which matters for capacity planning (a corpus cache wants
  IndexedDB specifically, not "whichever the browser felt like today") and for the parity-pinned tests
  this slice's Acceptance requires (a fixed adapter's behavior is what gets pinned). A future
  convenience wrapper composing both named adapters remains possible without revising this decision.
- **A single BroadcastChannel-only notification seam for BOTH tiers (skip the native `storage` event
  for localStorage)** — rejected: the native `storage` event is a genuinely zero-dep, zero-setup
  cross-tab signal `localStorage` already provides for free; wrapping it in a hand-rolled
  `BroadcastChannel` shim as well would double the moving parts for the same signal with no
  behavioral gain over just posting cross-tab. `BroadcastChannel` is reserved for the IndexedDB tier,
  where the native browser primitive (a `storage`-event equivalent) does not exist at all.
- **Migrate `memory-store.ts` onto `StorageAdapter` in this same PR (the original issue's literal
  Slice-1 line)** — rejected for THIS dispatch: the build dispatch's own scope note narrows Slice 1 to
  the interface + two tiers + notification seam + tests, deliberately deferring the `app`-level cutover
  to a follow-up slice against GH #959's remaining Acceptance — landing the new seam standalone first
  (this ADR's own Decision cl.5's layering proof) lets it be reviewed and ratified independent of a
  behavior-parity migration's own risk surface.
