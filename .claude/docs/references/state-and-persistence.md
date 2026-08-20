# State & persistence — the sanctioned shared-state grammar

> Canonical how-to-apply standard for holding, sharing, and persisting state in agent-ui.
> **Derived** from the ratified [ADR-0227](../adr/0227-context-shared-state-grammar-and-data-adoption.md)
> (the context/shared-state grammar + the `@agent-ui/data` adoption) — that record holds the *why*, the
> alternatives, and the acceptance predicates; this doc is the resolved shape the NEXT feature copies,
> and it derives, never rules: on any conflict ADR-0227 wins. The inventory it sits on is the
> data-model review corpus (`../reports/data-model-review-2026-08-20/` — `framework-state-idioms.md`'s
> sanctioned-idioms table is the mechanism census; `agent-admin-app-state-audit.md` is the priced
> failure record §6 distills). Related decisions: [ADR-0050](../adr/0050-form-provider-context-registration.md) ·
> [ADR-0051](../adr/0051-uiformelement-field-labelling-seam.md) · [ADR-0117](../adr/0117-theme-provider-shipped-component.md) ·
> [ADR-0192](../adr/0192-agent-ui-data-package.md) · [ADR-0193](../adr/0193-shared-storage-adapter-seam.md).
> Worked reference: `packages/agent-ui/app/src/controls/agent-admin/persona-roster-source.ts` +
> `site/pages/agent-admin-app.ts` (ADR-0227 wave 1, PR #1543). Distilled 2026-08-20 (GH #1546).

## 0 · Route by question

| "How do I…" | Answer | Detail |
|---|---|---|
| hold a shared fact two+ surfaces read | ONE signal-backed store owns it; everything else derives | §1 rule 1 |
| get a store to its consumer | typed prop / constructor arg at the composition root — explicit injection | §1 rule 2 |
| persist state | `StorageAdapter` (never raw `localStorage`) — pick the tier, know the sync twins | §2 |
| share theme / scale / density down a subtree | CSS cascade + reflected attribute carriers (ADR-0117's mechanism) | §1 rule 4 |
| hold CRUD-shaped app state (list + edit + persist) | `@agent-ui/data`: a `DataSource<T>` + one `resource()` + `mutation()`s | §4 |
| aggregate passive members into a provider (form-like) | ADR-0050's connect-event registry — forms only, not a template | §3 |
| hand one element a reference it labels/owns | ADR-0051's direct signal push — same fence | §3 |
| feed a subtree whose composer does NOT control its ancestry | the ONE reopening condition — see §5 before building anything | §5 |
| add a new provider-shaped mechanism | you probably don't — cite ADR-0227 clause 5, conform or record the exception | §7 |
| why doesn't `resource-idb-store.ts` use `resource()`/`mutation()` | recorded named exception — content-addressed, mint-a-ref-on-write, no signal-backed consumer | §7 |

## 1 · The grammar — four rules (ADR-0227 clause 2)

1. **One fact, one owner.** Every shared fact lives in exactly ONE signal-backed store; every other
   surface *derives* it (`computed` / `effect` / a store subscription), never copies it. A hand-pushed
   snapshot seam (`setAgentRoster`-style "data-in, re-callable") is legitimate only at a package
   boundary where the outer owner is not a store — and then the outer side must itself derive the push
   from its one owner, so the snapshot cannot go stale silently.
2. **Delivery is explicit injection.** A store reaches its consumer as a typed prop (props-as-signals —
   the reference-identity rewire `agent-admin.ts`'s `store` effect does) or a constructor/factory
   argument at the composition root. This fleet is light-DOM and page-composed: the composer holds
   references to the nodes it feeds, so the prop-drilling cost a discovery protocol exists to relieve
   is not being paid here (drilling depth ≈ 1). No DI container, no `useContext`-shaped lookup, no
   `host.use()` — traits stay channel-less by design.
3. **Persistence rides `StorageAdapter`** (ADR-0193) — never a raw `localStorage` touch-point. §2 has
   the tiers and the sync-read rules. (`SettingsStore`'s own sync contract predates the seam and stays
   untouched per ADR-0193 cl.6 — this rule governs NEW state.)
4. **Presentational, inheritable axes ride the CSS cascade** (ADR-0117's mechanism): delivery to
   descendants is cascade/inheritance keyed off reflected attribute carriers, never kernel state.
   Theme, scale, density are the shipped shape — zero JS reactive state beyond the one
   scheme→`colorScheme` effect. If the axis is presentational and inherits naturally, CSS is strictly
   superior: it works for non-component subtrees and costs no kernel bytes.

Module-level default instances (`defaultRouter`, [ADR-0115](../adr/0115-spa-router-v1-scope.md);
`@agent-ui/data`'s default store, ADR-0192) are documented soft-global *exceptions*, never the pattern.

## 2 · Persistence — `StorageAdapter`, tiers, sync twins

The one persistence seam is `@agent-ui/shared`'s `StorageAdapter`
(`packages/agent-ui/shared/src/storage/adapter.ts`): async `get / set / delete / keys`, an optional
`subscribe(listener)` for external-change notification (another tab — ADR-0193 cl.4), and namespacing
via the factory (`${namespace}.${key}` on the real backing key).

| Tier | Factory | Returns | Use for |
|---|---|---|---|
| localStorage | `createLocalStorageAdapter({ namespace })` | `SyncReadableStorageAdapter` | small JSON records: rosters, orderings, ids, markers |
| IndexedDB | `createIndexedDbAdapter(options)` | `StorageAdapter` (async only) | large content — e.g. `resource-idb-store.ts`'s over-threshold resource text |

**The sync twins** (`getSync` / `keysSync`, the ADR-0193 sync-read amendment) exist ONLY on the
localStorage tier, because that backing store is synchronous by nature — they are same-tick
counterparts over the SAME live store, never a snapshot or mirror. Nothing may implement them over an
async store; adapter-generic call sites narrow via `hasSyncReads(adapter)`.

**When the sync path is mandatory:** a read the first paint depends on. A page that must render its
persisted state synchronously at boot (no flash of default state) hydrates through the sync twins —
the wave-1 page seeds its store with `rosterSource.readViewSync()` before the first render, then lets
the async `resource()` machinery own everything after. Same-tick *writes* also hold on this tier —
`createLocalStorageAdapter`'s `set`/`delete` bodies contain no `await`, so the backing write completes
in the calling tick (only the promise's settlement defers); `persona-roster-source.ts`'s
`writeSeedVersionSync`/`resetStateSync` lean on that ordering and say so. A future async tier swap
must re-derive any such sequencing.

**Never raw `localStorage`.** The one sanctioned exception class is an explicit, documented legacy
*migration* read (the wave-1 `activeIdSync` tolerant read of the pre-adapter raw id — commented at the
site, self-retiring on the next write). A new raw touch-point is out of grammar, full stop.

## 3 · The three ratified point solutions — and when each applies

ADR-0227 clause 1 ratifies these in place *as point solutions, not precedents*. Each derived its shape
from its own constraints and each rejected the generic-context direction on its own record. None is a
template for app state.

| Solution | Mechanism | Applies when — and only when |
|---|---|---|
| [ADR-0050](../adr/0050-form-provider-context-registration.md) forms registry | composed/bubbling `ui-form-connect` event carrying value/validity closures; nearest provider registers into a `members` signal (`traits/form-registry.ts`) | a PROVIDER aggregates passive members it cannot enumerate — the form case, where request/respond is inverted (members announce themselves upward) |
| [ADR-0051](../adr/0051-uiformelement-field-labelling-seam.md) field labelling | plain signal write (`setFieldLabelling`) called imperatively on a reference the caller already holds — no event, no registry | one element OWNS another's nodes/ids and hands the wiring across (ui-field → its control); ownership would invert under a control-pulls protocol |
| [ADR-0117](../adr/0117-theme-provider-shipped-component.md) theme provider | reflected attribute carriers + CSS cascade/inheritance; zero kernel state beyond scheme→`colorScheme` | presentational, inheritable axes (theme/scale/density) — §1 rule 4 is this mechanism generalized |

A new feature reaching for "make another provider-shaped mechanism" is out of grammar unless it can
make the same constraint-derived case these three did — recorded as a named exception per §7.

## 4 · CRUD-shaped state — `@agent-ui/data`

The grammar's realization for CRUD-shaped shared state is already ratified (ADR-0192) and adopted
(ADR-0227 clause 4): don't hand-roll fetch/state/persistence logic — a `DataSource<T>` + one
`resource()` + `mutation()`s IS the single-owner signal-backed store of §1.

The worked example is the persona roster (wave 1, PR #1543):

- **The source** — `packages/agent-ui/app/src/controls/agent-admin/persona-roster-source.ts`:
  `createPersonaRosterSource<P>()` returns a `DataSource<P>` (`read · list · create · update · remove
  · subscribe`, the last wired to the adapter's cross-tab seam) that is the ONE owner of the roster's
  persisted records, persisting through `createLocalStorageAdapter` under the legacy namespace so
  existing users' data survives byte-for-byte. It also exposes a `view` sub-source (roster + active id
  as ONE value — the triplicated active-id collapsed to one owner) and the sync twins the boot path
  needs. Injected data (the shipped personas) arrives at construction — §1 rule 2 — so the module
  never imports site code.
- **The read path** — `site/pages/agent-admin-app.ts` (the `rosterResource` block): ONE
  `resource(ROSTER_KEY, rosterSource.view, { store, live: true })`. The store is seeded same-tick from
  `readViewSync()` (§2's mandatory-sync case), `live: true` rides the source's cross-tab subscribe —
  the staleness guard. Every consumer (`currentRoster()`, `activeAgent()`) is a derivation reading
  `rosterResource.data`, never a copied array.
- **The write path** — every roster write is a `mutation()` (the `saveAgentMutation` /
  `renameAgentMutation` / `deleteAgentMutation` / `reorderAgentsMutation` / `setActiveAgentMutation`
  quintet) with an `optimistic:` commit applying the SAME transform the source persists
  (exported-pure helpers like `applyRosterOrder` make that a shared rule, zero drift), then an atomic
  read-back `commitRosterView()` in the mutation body. That page mirrors deliberately instead of the
  `invalidate`-refetch ADR-0227 clause 4 sketched — a build-time supersession, recorded in
  `commitRosterView`'s own comment (PR #1543): an invalidation's read→commit pipeline spans jobs and
  a late refetch clobbers a rapid successive optimistic commit (measured live on the drawer reorder,
  the exact clobber class `resource.ts`'s own mirror law names). Prefix invalidation stays the shape
  for sources whose reads are genuinely async, where no same-tick truth exists to mirror.

A new CRUD-shaped feature copies this shape: one source module owning the persisted records, one
`resource()` per view, `mutation()`s for every write, `StorageAdapter` underneath.

## 5 · The reopening condition — when `context-request` comes back

ADR-0227 clause 3 declines the community `context-request` protocol NOW and re-scopes the trigger from
a consumer count to a fact: **a consumer that cannot receive an explicit injection because its
composer does not control its ancestry**. Named candidates: an agent-composed A2UI subtree needing an
app-tier store; a shadow-DOM embedding consumer. When that consumer actually appears, the adoption
shape is pre-ruled — the spec's event contract as written (composed bubbling `context-request`,
strict-equality keys, `stopImmediatePropagation()`, zero-dep inline implementation), delivering
**signal-backed stores once** (`subscribe: false` semantics) so reactivity stays on the one kernel.
Per-value callback subscriptions beside the signal kernel are out of grammar even then. Until that
consumer exists, building any of this is pre-abstraction — the failure ADR-0050 declined and ADR-0227
re-declined with the receipts.

## 6 · Anti-patterns — the priced failure modes

Each of these is documented, with line numbers, in the corpus
(`../reports/data-model-review-2026-08-20/agent-admin-app-state-audit.md` §Sync-point map). They are
the reason the grammar exists; recognize the shape and reach for the §1 rule it violates.

| Anti-pattern | The live instance that priced it | The rule it violates |
|---|---|---|
| **Two-name identity split** — two stores each holding "the" name, zero code paths writing both | `Persona.label` vs `store.get('name')`: the "New agent 48"/"Wrench" bug, plus its Team-pane twin | §1 rule 1 — one fact, one owner |
| **Triplicated fact** — N copies of one value kept in sync only by call-site discipline | the active-agent id: page var + component field + raw storage key, synced only because ONE function touched all three | §1 rule 1 |
| **Identity-gated effect fed by manual pushes** — an effect that only reacts to reference change, fed by call sites that must each remember to rebuild-and-reassign | `admin.libraries`' fresh-object reassignment law (every call site must independently rebuild-and-reassign, nothing enforcing it); the `setAgentRoster`/`#pendingRoster` push before wave 1 | §1 rule 1 — derive, don't push |
| **Write-only snapshot seam** — data pushed in, nothing subscribing the push back to its owner | pre-wave `setAgentRoster`: no read path from `store.subscribe('name')`, so renames never reached the roster select | §1 rule 1's boundary clause |
| **Raw `localStorage`** — hand-rolled keys + JSON beside the ruled seam | the retired `IMPORTED_PERSONAS_KEY`/`ROSTER_ORDER_KEY`/`ACTIVE_PRESET_KEY` bookkeeping | §1 rule 3 / §2 |
| **A new pattern per feature** — each generation added because no second sanctioned option existed | agent-admin's four stacked state generations | the whole grammar |

## 7 · The citation duty (ADR-0227 clause 5)

Every PR introducing a **provider-shaped control**, an **app-tier shared-state mechanism**, or a
**new persistence touch-point** cites ADR-0227 in its descriptor/LLD/PR body — either conforming to
§1's four rules or recording a named exception with its constraint-derived case (the bar §3's three
solutions met). Reviewable by grep, enforced at review. This doc is the how; the ADR is the authority
the citation names.

**Recorded named exceptions** (clause 5's "or record a named exception" branch, realized — the next
reader shouldn't have to re-derive why a touch-point sits outside the grammar):

| Module | What it is | Why it's exempt | Revisit when |
|---|---|---|---|
| `packages/agent-ui/app/src/controls/agent-admin/resource-idb-store.ts` | A content-addressed blob tier: every routed resource text mints a fresh, globally-unique `idbRef` at write time (`mintResourceIdbRef`) rather than reading/writing a stable owned key — write-once, ref-out, never re-fetched by id through a shared store | Not CRUD-shaped (no `list`/`read`/`update` against one owned record set) and has no signal-backed consumer to hang `resource()`/`mutation()` on — §1's grammar targets shared, derivable, multi-reader state; this tier is a one-shot persistence detail behind `materializeResourceEntry(Entries)`'s own sync/async accessors, not a fact any second surface observes | If a signal-backed consumer of this tier ever appears — something that reads or subscribes to routed resource text as live, shared state rather than one-shot `materialize*` calls — re-evaluate against §1's four rules rather than extending the exception |

(Wave 2 build report, GH [#1545](https://github.com/kimgranlund/agent-ui/issues/1545)/PR
[#1548](https://github.com/kimgranlund/agent-ui/pull/1548): deliberately left off the `DataSource`
migration on exactly this basis; GH [#1549](https://github.com/kimgranlund/agent-ui/issues/1549)
recorded it here rather than leaving the call undocumented.)
