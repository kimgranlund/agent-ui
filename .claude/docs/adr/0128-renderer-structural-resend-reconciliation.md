# ADR-0128 — the renderer reconciles a mounted container's resent record (structural-resend reconciliation): a generalized per-node scope, id-keyed children diff, and a create/wire split — survivor reorder deferred

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-12
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-07-12 |
> | **Proposed by** | design intake (TKT-0024, host-reproduced 2026-07-12: a mounted non-root container resent whole via `updateComponents` with a grown `children` list never repaints — `SurfaceTree.apply` reuses the cached widget on any later delivery of that id) |
> | **Ratified by** | Kim, 2026-07-12 — SPEC-R5 ruled option B (reorder deferred) at the batched prompt; Status hand-flipped in-tree + 'proceed' confirmed (the registered-guard workflow's first full pass) |
> | **Repairs** | NEW [`../spec/renderer-structural-resend.spec.md`](../spec/renderer-structural-resend.spec.md) · NEW [`../lld/renderer-structural-resend.lld.md`](../lld/renderer-structural-resend.lld.md) · NEW [`../decompositions/renderer-structural-resend.decomp.json`](../decompositions/renderer-structural-resend.decomp.json) (coverage-clean, plan mode). On ratification+build (NOT this intake): `packages/agent-ui/a2ui/src/renderer/{tree.ts,widget.ts,renderer.ts,types.ts}` · a forward cross-reference note in [`../spec/a2ui-runtime.spec.md`](../spec/a2ui-runtime.spec.md) SPEC-R3/R4 (the gap this ADR closes, left unedited by this intake per its docs-only scope) · `round-trip.test.ts` (a2ui-live) · the a2ui-chat build's turn 3/4 assertions · the `message-lifecycle` corpus seed's fixture test |
> | **Supersedes / Superseded by** | None. **Relates ADR-0024** (the LLD-C6 per-item `(scope, ac)` pair this ADR generalizes to every static-tree node — a sibling mechanism, not a supersession: LLD-C6 stays positional/no-key for array-template lists, this ADR is id-keyed for static `children` references) · **Relates ADR-0053** (the Select+Option first-connect limitation this ADR's mechanism interacts with but does NOT resolve — retained, disposition corrected below) · **Relates ADR-0126/the message-lifecycle SPEC** (SPEC-R2's whole-record-upsert rule, whose AC2 already modeled exactly this scenario without the renderer honoring it — this ADR makes that assumption true) |

## Context

TKT-0024 host-reproduced the defect with a direct probe: mount `root→group→msg("hello")`, resend `group` whole
via `updateComponents` with `children:["msg","status"]` plus a new `status` Text("READY-MARKER") — `msg`'s
textContent stays `"hello"` and `status` never enters the DOM. Reading `renderer/tree.ts`'s `apply()`
(`tree.ts:76-108`) confirms the mechanism directly: once `root` is mounted, every subsequent batch's
reconciliation loop consults `#pendingParents` ONLY — a map of ids some already-mounted parent is holding an
anchor slot for because they had **never yet arrived**. An id that is **already** in `surface.widgets` (already
mounted) is never revisited, no matter what its freshly-buffered record now says. The buffer (`surface.
components.set(comp.id, comp)`) updates faithfully every time; the rendered tree does not.

**The blast radius is the ADR-0126 lifecycle teaching itself.** The message-lifecycle SPEC's SPEC-R2 (whole-
record-upsert) already normatively requires a producer to emit exactly this pattern — its own AC2 worked
example (`{id:"row", children:["a","b"]}` → `{id:"row", children:["a","b","c"]}`) IS the bug's shape. That SPEC
assumed the renderer already reconciles on resend (citing `tree.ts:85`'s upsert-by-id as proof, which proves
only that the STORED record updates, not that the RENDERED tree does). Three shipped teaching surfaces inherit
the gap faithfully: the `a2ui-live` demo's turns 3/4 have never visibly restructured (noted in `transcript.ts`'s
own turn text, never contradicted by a test — the round-trip test asserts only teardown-after-turn-5, which
cannot distinguish rendered-then-removed from never-rendered, a blind spot that test's own review already
flagged as INFO); the new `a2ui-chat` build inherits the same visual no-op (named explicitly at `a2ui-chat.
lld.md:153-157`, already flagged pending this ADR); the `kpi-panel` corpus exemplar teaches the same shape.

### The contract ruling (settled from mechanics, not a taste fork)

Read literally, the runtime SPEC's SPEC-R3 ("buffer, reconstruct, render-on-root") and SPEC-R4 ("out-of-order
tolerance", AC1: *"a parent referencing a child ID that arrives in a later message... it is patched into
place"*) specify **progressive first build** — a tree not yet fully delivered, where a referenced child arrives
for the **first time** later. Neither addresses an **already-mounted** parent's **own record** being resent.
The runtime LLD's realization confirms this empirically: `#patchPending` keys exclusively on `pendingParents`
(a previously-missing id becoming available), never on an id that **already has a widget**. This is a genuine
**SPEC gap**, not a defensible-reading violation — the runtime SPEC is silent, and the sibling message-lifecycle
SPEC assumed the affirmative answer without itself amending the runtime SPEC to say so. `renderer-structural-
resend.spec.md` closes the gap (SPEC-R1/R2); this ADR ratifies that closure and the mechanism realizing it.

### The reuse ledger (the precedent sweep, argued per row)

| Existing mechanism | What it already proves | What it does NOT give us |
|---|---|---|
| `renderer/list.ts` + ADR-0024 amendment 3 (per-item `(scope, ac)` pair) | A node-granular disposable lifetime pair is a PROVEN pattern in this renderer — items dispose their own effects+listeners on positional removal, leak-free | It is scoped to list-item INSTANCES only (ids alias across N instances, deliberately untracked in `pendingParents`/`surface.widgets`); the STATIC tree has never had per-node scopes — every static bound-prop effect lives flatly in `surface.scope` today |
| `renderer/widget.ts`'s `makeCreateWidget` + `renderer.ts`'s `#makeHostCreateWidget` | The full "mint + wire props + wire input + wire action + wire checks" pipeline, already composed once per node | No way to re-run "wire" alone against an ALREADY-EXISTING element — `factory.create()` is fused into the same closure that applies props, so reconciling props today would necessarily mint a NEW element, destroying identity |
| `renderer/tree.ts`'s `#pendingParents`/`#patchPending` (SPEC-R4) | A working out-of-order PATCH-IN mechanism for a first-arrival id | It is keyed on absence (`components.get(id) === undefined`), the exact opposite of a resend's precondition (the id already has a widget) — structurally cannot be reused as-is, only as a design precedent for "patch, don't re-render the whole tree" |
| `a2ui-message-lifecycle.spec.md` SPEC-R2 (whole-record upsert) | The PRODUCER-side rule this renderer fix must make true end-to-end; its AC2 is the bug's own repro shape | Nothing renderer-side — it is explicitly producer POLICY over "already-shipped mechanics" (its own SPEC-N1), an assumption this ADR discovers was false |
| ADR-0053 (Select+Option first-connect limitation) | A DIFFERENT, already-documented resend limitation exists in the fleet, so this is not the first time "a later `updateComponents` doesn't reach where it should" has surfaced | Verified (select.ts, the connect-time move-to-panel guard — since fixed for APPENDS by TKT-0026's adoption observer, and for the mid-position THROW by TKT-0031's `tree.ts#reconcileChildren` anchor fix, landed 2026-07-13) to be a SEPARATE, component-owned cause — this ADR's generic renderer fix did not, by itself, resolve it (§ Consequences); TKT-0031 later did, for the whole ADR-0017 child-relocating family, though panel-position fidelity stays out of scope (SPEC-R5 non-goal) |

## Decision

We ratify `renderer-structural-resend.spec.md` (SPEC-R1…R5, SPEC-N1…N3) and its LLD's mechanism:

1. **Generalize the LLD-C6 per-item `(scope, ac)` pair to every static-tree node.** `SurfaceTree` gains a
   `#nodeScopes: Map<id, {scope, ac}>` parallel to `surface.widgets`; every node mounted via the ordinary DFS
   (not a list-item instance) gets its own disposable kernel scope + `AbortController`, populated at mount time.
2. **A create/wire split in `widget.ts`/`renderer.ts` (a pure refactor, zero behavior change on its own).**
   `factory.create()` separates from "apply props + wire input + wire action + wire checks" so reconciliation
   can re-wire an EXISTING element without ever minting a new one.
3. **Resend detection via a pre-overwrite snapshot in `apply()`.** Before `surface.components.set(id, comp)`
   overwrites a record, capture the previous one; if the id already has a widget, route it to `#reconcileNode`
   after the ordinary pending-parent patch-in runs.
4. **Children reconcile is an id-KEYED set diff** (not positional — the static `children: string[]` is
   naturally id-keyed, unlike LLD-C6's anonymous array-template instances): added ids mount fresh and insert at
   their new position (safe — never relocates an already-connected node); removed ids recursively dispose
   (node scope + ac, cascading into any nested dynamic list via its `parentScope`) and detach; **survivors are
   left DOM-position-untouched** regardless of any reorder in the new list (SPEC-R5 — see the fork below).
5. **Prop reconcile disposes and rebuilds ONLY the resent node's own `(scope, ac)` pair**, re-wiring the
   complete new record onto the SAME element (whole-record-upsert fidelity — a rebound `{path}` target
   re-resolves against the new target, not the old) — DOM identity, focus, and any component-internal state
   survive because the element itself is never replaced. **An omitted prop resets to its declared default only
   when the catalog's mapping for it is identity** (`PropDef.mapsTo === prop`, verified against `catalog/
   default/factories.ts`'s `accessorFactory` rows — the large majority of the catalog); a bespoke, non-identity
   mapping (e.g. `Button.label`) is NOT reset by this wave — its prior value may linger. This narrowing surfaced
   at doc review (the `WidgetFactory` interface has no per-prop default reader, only `applyProp`) and is
   recorded honestly rather than promised past what the mechanism can verify — closing it fully needs a new,
   optional catalog-level capability, flagged as a follow-up, not built here.
6. **A no-delta resend is inert** (SPEC-R3): both diffs gate on an actual change; an idempotent or heartbeat-
   style resend disposes nothing.
7. **`"root"` is never reconciled** (SPEC-R4) — the shipped IDGRAPH guard already forecloses a second `root`
   delivery, matching the message-lifecycle SPEC's own root carve-out.
8. **Reconciliation emits nothing** (SPEC-N3) — a renderer-internal consequence of an already-delivered
   message, exactly like LLD-C6's positional reconcile today.

### Fork — SPEC-R5, survivor reorder: deferred (Kim's call to confirm)

A resend can change a container's children set with NO adds/removes, purely a **reorder** of already-present
ids (`["a","b"]` → `["b","a"]`). Two live options:

- **A — realize the full new order** (relocate survivor DOM nodes to match): faithful to "the resent record IS
  the new truth," but relocating an ALREADY-CONNECTED node without a focus-preserving primitive risks the exact
  gap this repo has already deferred once — `repeat`'s `before()`-based move drops focus; only a native
  `Node.prototype.moveBefore` would preserve it, itself flagged and NOT YET landed (an ADR-tracked, deferred
  seam upgrade, per the standing `repeat`/focus-deferral finding). Shipping reorder now means either building a
  NEW focus-safe move primitive (out of this ticket's scope) or knowingly reintroducing the same focus-loss
  class this repo chose not to ship elsewhere.
- **B — defer reorder as a documented non-goal** (this ADR's recommendation, SPEC-R5): add/remove reconcile
  only; a survivor keeps its CURRENT DOM position even if the new array's order differs. A producer that
  relies on visual reflow from a pure reorder will not get it — a real, if narrow, expressiveness gap, but a
  SAFE one (nothing regresses; today ZERO structural resends of any kind reconcile).

**Recommendation: B.** The ticket's own acceptance criteria reads as add/remove/keep ("added ids mount in
order, removed ids dispose, surviving ids KEEP node identity") and does not name reorder; nothing in the
shipped teaching (GRAMMAR, `a2ui-compose`, the corpus exemplar) asks a producer to reorder existing children
without also adding or removing one. Option A is reopenable in a future SPEC revision once a focus-safe move
primitive lands — this defers a real gap, it does not close the door on it.

## Consequences

- **The runtime SPEC's SPEC-R3/R4 gain a forward cross-reference at build time** (not this intake, which is
  docs-only) — a one-line pointer to this SPEC, since their own text still reads as "progressive first build
  only" and would otherwise mislead a future reader into thinking resend reconciliation is unspecified rather
  than specified-elsewhere.
- **ADR-0053's first-connect limitation is RETAINED, with a corrected precision, not lifted.** Verified against
  `select.ts` (the connect-time guard as of this ADR's date; TKT-0026 has since added append-adoption): `ui-select` moves its authored `[role=option]`/`[role=group]` children into the internal
  listbox panel **only at first connect** (an idempotent, one-time guard), never on a later childList mutation.
  Even after this ADR ships, a late-arriving `Option` mounts correctly as a light-DOM child of `<ui-select>`
  (SPEC-R1 now guarantees that much) but is **not** moved into the panel and stays invisible/inert — a
  SEPARATE, `ui-select`-owned defect (its move-to-panel step needs to become ongoing, not connect-time-only),
  out of this renderer-only ADR's scope. **A new follow-up ticket against `ui-select` is recommended**, not
  opened here.
- **Every static-tree node now carries a scope + AbortController it did not before** — a small, constant
  per-node memory cost (two objects), justified by being the only way to make reconciliation surgical; no
  measured perf concern is raised by this ADR (a follow-up may want a benchmark on a very large static tree,
  not blocking).
- **Omitted-prop reset is narrower than SPEC-R2 AC3's plain-language promise for non-identity-mapped catalog
  rows.** The `WidgetFactory` interface (`catalog/types.ts`) has no per-prop default reader, only `applyProp` —
  a dropped prop resets correctly only when its catalog mapping is identity (`mapsTo === prop`, the majority of
  the catalog); a bespoke factory's non-identity prop (`Button.label`, a control's attribute-mapped prop) is not
  reset in this wave. Recorded, not silently promised — a follow-up `WidgetFactory.resetProp?` capability is
  the closing mechanism, out of this ADR's scope.
- **Consumer test upgrades ride this same wave** (build slices, not separate tickets): `round-trip.test.ts`
  gains a present-after-turn-3 assertion closing the "rendered-then-removed vs never-rendered" blind spot;
  `a2ui-chat`'s turn 3/4 assertions upgrade from routing-only to visible-restructure; the `kpi-panel` corpus
  seed's fixture test gains a real-render assertion for its restructure step.
- **Stale → re-verify:** `a2ui-runtime.spec.md` SPEC-R3/R4 (forward cross-reference) · `a2ui-renderer.lld.md`
  LLD-C4 (`tree.ts`)/LLD-C7 (`widget.ts`)/LLD-C13 (`renderer.ts`) — the runtime components this ADR's own LLD
  (`renderer-structural-resend.lld.md`, RSR-C1…C7) amends — · `round-trip.test.ts` · `a2ui-chat.lld.md:153-157`
  (the flagged upgrade, now unblocked) · `examples/message-lifecycle.ts`'s fixture test.

## Alternatives considered

- **A coarse fix: on ANY resend, dispose and remount the WHOLE surface from `root`** — rejected: violates the
  ticket's own acceptance criteria directly ("no full-subtree teardown", "surviving ids KEEP node identity");
  would also drop focus/state on every unrelated node in the tree on every resend, the opposite of what's
  wanted.
- **Per-container scopes only (leaf nodes share their parent's scope)** — rejected: fails SPEC-R2's leaf-node
  prop-resend requirement (a resent `Text` leaf with a changed static prop or rebound path needs its OWN
  disposable scope to refresh in isolation; sharing the parent's scope would either leak the parent's other
  effects on a leaf-only reconcile or force disposing the parent's scope too, cascading unrelated churn).
  Rejected as insufficient, not as a taste call.
- **Reuse `repeat`/`moveBefore` (ADR-0022) for the static children list** — considered given static `children`
  IS naturally id-keyed (unlike LLD-C6's array-template lists, which are positional precisely because ADR-0024
  ruled out `repeat` there for the opposite reason). Rejected for THIS ADR's scope: `tree.ts`'s current
  mounting is a manual imperative DFS with comment-anchor patch-in, not a tagged-template/directive-driven
  render; adopting `repeat` here would mean restructuring the static tree's entire mount path around a
  directive, a much larger and differently-scoped change than a bespoke id-diff loop mirroring LLD-C6's own
  precedent for "bespoke reconcile beats a primitive built for a different reorder model." A bespoke id-keyed
  loop is the pragmatic, minimally-invasive choice; `repeat`/`moveBefore` remains the vehicle for a genuinely
  keyed, reorder-heavy list elsewhere in the fleet.
- **A partial per-prop diff instead of "dispose the whole node scope and rebuild all props from scratch"** —
  rejected for its complexity/correctness tradeoff: a partial diff would need to track, per prop, whether it
  was previously static/bound/absent and handle each transition (static→bound, bound→absent, etc.)
  individually; whole-record-upsert semantics (message-lifecycle SPEC-R2) already require "no partial-prop-
  patch" as the STORED-record rule — mirroring that at the WIRING layer (rebuild the whole node's wiring from
  the new record) is simpler, provably correct by construction, and the redundant re-application of unchanged
  props is visually and functionally a no-op (an idempotent `applyProp`/re-resolved-`{path}`-to-the-same-value
  effect), not a real cost.
