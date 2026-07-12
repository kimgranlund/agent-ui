# SPEC — Renderer structural-resend reconciliation (`@agent-ui/a2ui` renderer)

> Status: proposed · v0.1 · 2026-07-12 · Layer: SPEC (execution contract)
> Refines: [`./a2ui-runtime.spec.md`](./a2ui-runtime.spec.md) SPEC-R3/R4 (§3.3 component tree & progressive
> rendering) — closes the gap those requirements leave open (§2 below); cites, never restates, SPEC-R3's
> render-on-root and SPEC-R4's out-of-order tolerance.
> Cites [`./a2ui-message-lifecycle.spec.md`](./a2ui-message-lifecycle.spec.md) SPEC-R2 (the whole-record-upsert
> producer rule this SPEC makes true on the renderer side) and [`../adr/0053-a2ui-form-family-catalog-rows.md`](../adr/0053-a2ui-form-family-catalog-rows.md)
> (the first-connect limitation this SPEC's mechanism interacts with but does not resolve, §4).
> Refined by: [`../lld/renderer-structural-resend.lld.md`](../lld/renderer-structural-resend.lld.md).
> Altitude: owns the renderer's reconciliation behavior when an **already-mounted** component's record changes
> on a later `updateComponents`. Progressive first-build (a tree not yet fully delivered) stays the runtime
> SPEC's; per-path data waking stays untouched (LLD-C5, cited not amended). Requirement IDs file-scoped
> (`SPEC-R1…`).

---

## 1. Purpose

TKT-0024 host-reproduced a defect: resending an already-**mounted**, non-root container via `updateComponents`
with a changed `children` list (or changed props) updates the buffered record (`renderer/tree.ts`'s
upsert-by-id) but never repaints — the cached widget renders on, and the new state never reaches the DOM. The
message-lifecycle SPEC's SPEC-R2 already normatively requires a producer to emit exactly this pattern (a
whole-record resend, e.g. `{id:"row", children:["a","b","c"]}`, AC2) — its own text assumes the renderer acts
on it. This SPEC states, for the first time, what the renderer **MUST** do when that assumption is exercised
against an already-mounted node: reconcile the rendered DOM to match, preserving survivor identity.

## 2. The contract ruling (a spec gap, not an unambiguous violation)

The runtime SPEC's SPEC-R3 ("buffer, reconstruct, render-on-root") and SPEC-R4 ("out-of-order/incomplete
tolerance", AC1: *"a parent referencing a child ID that arrives in a later message... it is patched into place"*)
together specify **progressive first build**: a tree not yet fully delivered, where a referenced child arrives
for the **first time** later. Neither requirement's text addresses the **different** case this SPEC closes: an
**already-mounted** parent's **own record** is resent, changing its `children` (or other props). The runtime
LLD's realization (LLD-C4, `#mountNode`/`#patchPending`) confirms the gap empirically — its patch-in path keys
exclusively on `pendingParents` (a previously-missing id becoming available), never on a delivered id that
**already has a widget** (`surface.widgets.has(id)`). The runtime SPEC is therefore genuinely silent, not
violated by a defensible reading — this is a **SPEC gap**, closed here by ratified addition (ADR-0128), not a
bare bugfix against prior unambiguous text. The sibling message-lifecycle SPEC's SPEC-R2 (AC2 in particular)
already assumed the affirmative answer without itself amending the runtime SPEC — the oversight this SPEC and
its ADR correct.

## 3. Definitions

- **Resend** — a later `updateComponents` batch that includes an `id` already present in `surface.widgets`
  (i.e. already mounted, not a first arrival and not a `pendingParents` patch-in).
- **Reconcile** — the act of bringing a resent node's rendered DOM into agreement with its new buffered record,
  without discarding the node's own live custom-element instance (identity, focus, internal state).
- **Survivor** — a child id present in both the old and new `children`/`child` reference set of a resent
  container; a survivor's DOM position and element are left untouched by this SPEC (§3.4 non-goal).
- **Node scope** — a per-static-tree-node kernel `(Scope, AbortController)` pair, generalizing the per-item
  `(scope, ac)` pair the LLD-C6 positional list already uses (ADR-0024 amendment 3), that owns exactly one
  node's bound-prop effects and DOM listeners, independently disposable without touching siblings or ancestors.

## 4. Requirements

Normative per RFC 2119. Each carries a stable ID and acceptance criteria.

**SPEC-R1 — Children reconciliation on resend.** When a delivered `updateComponents` batch resends an id
already present in `surface.widgets` and its `children`/`child` reference set differs from its previously
buffered record, the renderer MUST reconcile the container's rendered children by an **id-keyed set diff**
(never positional/index — contrast LLD-C6's array-template lists, which have no id at all): every newly
referenced id not previously a child MUST mount (its own subtree) and insert at its position in the new list
relative to already-present siblings; every previously referenced id no longer present MUST be torn down
(§SPEC-N1) and removed from the DOM; every survivor id present in both sets MUST keep its existing DOM node,
subtree, and node scope untouched — no full-subtree teardown of a survivor. *(→ TKT-0024 acceptance)*
- **AC1** *Given* a mounted container `{id:"group", children:["msg"]}` resent as `{id:"group",
  children:["msg","status"]}` with a new `status` node in the same batch, *when* applied, *then* `status`
  mounts as a new DOM child of `group`'s widget and `msg`'s existing DOM node/subtree is untouched (same
  element reference before and after). *If `status`'s own record has not yet arrived* (an out-of-order
  delivery within the same wave), it falls to the runtime SPEC's existing SPEC-R4 pending-anchor path
  unchanged — this SPEC does not duplicate that mechanism, only triggers entry into it for a newly referenced
  id exactly as a first-ever parent reference would.
- **AC2** *Given* the reverse (`children:["msg","status"]` resent as `children:["msg"]`), *when* applied, *then*
  `status`'s DOM node is removed and its node scope disposed (§SPEC-N1); `msg` is untouched.
- **AC3** *Given* a resent container whose `children` set is unchanged (byte-identical array), *when* applied,
  *then* no child mounts, unmounts, or re-wires (a no-op reconcile — §SPEC-R3 gates this).

**SPEC-R2 — Prop reconciliation on resend (whole-record fidelity).** When a delivered batch resends an id
already present in `surface.widgets` and its non-structural props (every key except `id`/`component`/
`child`/`children`) differ — by key set or by value — from its previously buffered record, the renderer MUST
re-apply the resent record's complete prop set to the SAME existing element (never replacing it), per the
message-lifecycle SPEC's whole-record-upsert semantic (SPEC-R2 there: an omitted prop is a silent drop, not a
preserved prior value) — a static literal not present in the new record MUST NOT linger, a `{path}`/`{call}`/
DynamicString binding whose target changed MUST re-resolve against the new target, not the old. The node's
DOM identity, focus state, and any internal component-level state (e.g. a form control's edited value) MUST be
preserved — the renderer MUST NOT replace the reconciled node's own rendered element; only its bound-prop
effects and structural wiring (input/action/checks) are torn down and reinstalled. *(→ TKT-0024 acceptance
"prop changes on a resent record apply per the whole-record upsert semantic"; the reset mechanism for AC3 is
the LLD's, not restated here)*
- **AC1** *Given* a mounted `{id:"btn", component:"Button", label:"Go"}` resent as `{id:"btn",
  component:"Button", label:"Go!"}`, *when* applied, *then* the SAME `<ui-button>` element's label updates to
  "Go!" with no new element created and no focus loss if the button had focus.
- **AC2** *Given* a mounted node bound `{path:"/a"}` on some prop, resent rebinding that SAME prop to
  `{path:"/b"}`, *when* applied, *then* the prop's rendered value tracks `/b` going forward, not `/a` (the old
  effect is disposed, not merely left subscribed to a target that no longer matches the record).
- **AC3** *Given* a resend that omits a previously-present **identity-mapped** prop (the catalog `PropDef.
  mapsTo` equals the prop's own name — the majority of the catalog, verified against `catalog/default/
  factories.ts`'s `accessorFactory` rows), *when* applied, *then* the prop's prior value does not linger — it
  resets to the widget's declared default (matches message-lifecycle SPEC-R2 AC1's "silent drop", now true
  end-to-end for this class of prop). *Given* an omitted prop whose catalog mapping is **non-identity** (a
  bespoke factory — e.g. `Button.label`, a control's non-identity `label`/attribute mapping), the renderer is
  NOT required to reset it in this wave (§5 non-goal) — its prior value may linger; closing this fully needs a
  catalog-level capability this SPEC does not add.

**SPEC-R3 — No reconcile without an actual delta.** A resend whose complete record (props + structural
references) is unchanged from the previously buffered one for that id MUST NOT tear down or reinstall that
id's node scope, bound-prop effects, or DOM listeners (SPEC-R1 AC3 restated for props). Equality MUST be
**structural**, not by object reference — a freshly parsed message re-delivers every object-valued prop (a
`{path}`/`{call}` binding, an action object) as a new reference even when semantically unchanged, and a
reference-only comparison would defeat this requirement for any node carrying one. *(→ efficiency; avoids
needless effect churn on an idempotent or heartbeat-style resend)*
- **AC1** *Given* a resend of an already-mounted id whose record is structurally identical to its previously
  buffered one — including a `{path}` binding re-delivered as a new object with the same `path` string, not
  merely the same reference — *when* applied, *then* the id's node scope is not disposed or recreated (its
  `Scope` identity is unchanged) and no bound-prop effect or DOM listener re-installs.

**SPEC-R4 — Root carve-out (unaffected).** The `"root"` id is never subject to SPEC-R1/R2 — the runtime SPEC's
existing guard (SPEC-R3 AC2: a second `id:"root"` delivery is `IDGRAPH`, existing root kept) already forecloses
a root resend outright, matching the message-lifecycle SPEC-R2 root carve-out (REV 2026-07-11). This SPEC adds
no new root behavior. *(→ consistency, no regression)*
- **AC1** *Given* a second `updateComponents` delivery of `id:"root"` for a surface whose root is already
  mounted, *when* applied, *then* the runtime SPEC's existing `IDGRAPH` guard fires exactly as it does today
  (unaffected by this SPEC) and SPEC-R1/R2 reconciliation is never invoked against `"root"`.

**SPEC-R5 — Survivor reorder is a non-goal (deferred).** SPEC-R1's reconciliation is add/remove only — a
survivor id's DOM position is NOT re-derived from its new index in the resent `children` array if that index
differs from before (e.g. `["a","b"]` → `["b","a"]`, no add/remove, pure reorder). A survivor with a changed
relative position keeps its CURRENT DOM position. This is deliberate, not an oversight: relocating an
already-connected, possibly-focused node without a focus-preserving primitive is the same class of gap this
repo has already deferred once (`repeat`'s `before()`-based move drops focus; only native `Node.prototype.
moveBefore` would preserve it, itself an ADR-tracked, deferred seam upgrade). Realizing full reorder is
reopenable in a future SPEC revision once that seam lands. *(→ ADR-0128 fork; Kim's call)*
- **AC1** *Given* a resend that is a pure reorder of an already-fully-present children set (no id added or
  removed), *when* applied, *then* no DOM node moves and no node scope is disposed.

**SPEC-N1 — Node-granular leak-free teardown.** Reconciling a removed child (SPEC-R1) MUST dispose that id's
entire subtree — every descendant's node scope AND `AbortController`, recursively, including any dynamic list
(LLD-C6) rooted under it — leaving zero live signals/effects/listeners for the removed subtree (extends the
runtime SPEC's SPEC-N3, surface-granular today, to per-node granularity on a structural remove; provable via
the kernel's `inspect()`, mirroring the existing SPEC-N3 proof pattern). *(→ TKT-0024 "no full-subtree
teardown" read together with "removed ids dispose")*
- **AC1** *Given* a removed container whose own subtree contains a nested dynamic list (LLD-C6) with live
  items, *when* the container is torn down, *then* `inspect()` shows zero residual subscribers/listeners for
  every item that list ever created.

**SPEC-N2 — Per-path data waking is unaffected.** The binding resolver (`binding.ts`, LLD-C5) and its per-path
`Object.is` memoization are untouched by this SPEC; reconciliation changes only WHICH scope owns a node's
bound-prop effects (a new per-node scope replaces the blanket `surface.scope` for the static tree), never the
resolve/computed mechanism itself. *(→ non-regression guard, explicit per the ticket's constraint)*

**SPEC-N3 — Reconciliation emits nothing.** A structural or prop reconcile driven by this SPEC MUST NOT itself
emit any client→server message (no `action`, no `error`) — it is a renderer-internal consequence of an
already-delivered, already-validated message, exactly as the LLD-C6 positional list's reconcile emits nothing
today. *(→ consistency with existing reconcile precedent)*

## 5. Non-goals (explicit fences)

- **Survivor reorder** (SPEC-R5) — deferred, not solved here.
- **ADR-0053's Select+Option first-connect limitation is NOT resolved by this SPEC.** Verified against
  `packages/agent-ui/components/src/controls/select/select.ts` (§470-503): `ui-select` moves its authored
  `[role=option]`/`[role=group]` light-DOM children into its internal listbox panel **only at first connect**
  (an idempotent, one-time guard) — not on every childList mutation. Even with this SPEC's generic
  children-reconcile shipped, a late-arriving `Option` mounts as an ordinary light-DOM child of `<ui-select>`
  (correctly, per SPEC-R1) but is **not** moved into the panel and remains invisible/inert, because the
  move-to-panel step is a `ui-select`-owned, connect-time-only behavior this renderer-layer SPEC has no
  authority over. §6 below records ADR-0053's disposition as **retained**, with this precision added.
- **List-item (instance-mode) descendants** — a dynamic list's per-index items (LLD-C6) are driven by array
  length/data changes, not by `updateComponents` resends of the same id (their ids alias across N instances
  and are deliberately untracked in `pendingParents`/`surface.widgets`, per `tree.ts`'s own design). This SPEC's
  reconciliation applies to the **static tree only** (`instance=false`); it does not touch list-item internals.
- **Out-of-order template/descendant arrival** inside a not-yet-fully-delivered list item — an existing, named
  LLD-C6 follow-up (ADR-0024's subtree amendment), unaffected by this SPEC.
- **Corpus admission / GRAMMAR/skill teaching text edits** — this SPEC governs renderer mechanics only; the
  producer-facing teaching already lives in the message-lifecycle SPEC and needs no wording change (its
  assumption becomes true, not different).
- **Resetting a non-identity-mapped omitted prop** (SPEC-R2 AC3's narrowed arm) — the catalog's `WidgetFactory`
  exposes only `create()`/`applyProp(el, prop, value)`, no per-prop default reader; a prop whose mapping is a
  bespoke, non-identity one (e.g. `Button.label`) cannot be reset without a new, optional catalog-level
  capability this SPEC does not add. Deferred, not silently dropped — flagged as a follow-up.
- **A resent container whose `children` is a dynamic-list TEMPLATE object** (`{path, componentId}`, runtime
  SPEC-R6/LLD-C6), not a static id array — this SPEC's id-keyed diff (SPEC-R1) operates on the static
  `children: string[]`/`child` shape only; a template-to-template resend (e.g. a changed `componentId`) is not
  reconciled by this SPEC.

## 6. Examples

Illustrative (normative for shape, not exhaustive) — the ticket's own host-reproduced repro, the minimal shape
SPEC-R1/R2 must both satisfy against a real message stream.

```jsonc
// 1. first build — root -> group -> msg (SPEC-R3 of the runtime SPEC, unaffected)
{"version":"v1.0","createSurface":{"surfaceId":"s1","catalogId":"agent-ui"}}
{"version":"v1.0","updateComponents":{"surfaceId":"s1","components":[
  {"id":"root","component":"Column","children":["group"]},
  {"id":"group","component":"Row","children":["msg"]},
  {"id":"msg","component":"Text","text":"hello"}
]}}
// after this batch: mount.textContent contains "hello"; "status" does not exist anywhere.

// 2. structural resend — group's OWN record grows a child (SPEC-R1)
{"version":"v1.0","updateComponents":{"surfaceId":"s1","components":[
  {"id":"group","component":"Row","children":["msg","status"]},
  {"id":"status","component":"Text","text":"READY-MARKER"}
]}}
// REQUIRED after this batch (the bug this SPEC closes): mount.textContent ALSO contains "READY-MARKER";
// "msg"'s element reference is unchanged (SPEC-R1 AC1) — not merely the buffered record.
```

A resend that ALSO changes `group`'s own non-structural props (e.g. adds `gap:"8"`) in the same message
combines with SPEC-R2 — both facets reconcile off the SAME delivered record, independently gated (§4 of the
LLD).

## 7. Prior-art reconciliation

| Prior decision | Disposition under this SPEC |
|---|---|
| ADR-0053 (first-connect Option limitation) | **Retained**, documented consequence unchanged in substance; this SPEC adds the precision (§5) that the renderer-level cause ("children never repaint") is fixed, while `ui-select`'s own connect-time-only panel population is a **separate, component-owned** gap — flagged as a new follow-up ticket against `ui-select`, out of this SPEC's scope. |
| ADR-0024 (LLD-C6 positional list, no key) | **Untouched, and the pattern this SPEC generalizes.** The per-item `(scope, ac)` pair (ADR-0024 amendment 3) is the direct precedent for this SPEC's per-static-node scope (§3); the two mechanisms are siblings, not one subsuming the other — LLD-C6 stays positional/no-key for its array-template case, this SPEC is id-keyed for the static-children case (§SPEC-R1). |
| Runtime SPEC SPEC-R3/R4 | **Extended, not amended in place** (this SPEC is proposed, the runtime SPEC's own text is left as-is per this intake's scope; a forward cross-reference is a build-time edit, ADR-0128 `Repairs`). |
| Message-lifecycle SPEC SPEC-R2 | **Made true end-to-end.** Its AC2 already modeled exactly this SPEC's SPEC-R1/R2 scenario; no wording change needed there — the renderer now does what that SPEC's producer-facing rule already assumed. |

## 8. Traceability

| Requirement | Ticket / ADR trace |
|---|---|
| SPEC-R1, R2, N1 | TKT-0024 acceptance (children add/remove/keep, prop whole-record fidelity, leak-free removal) |
| SPEC-R3 | TKT-0024 "the pipeline" note (avoid needless churn) — efficiency, not in the ticket's literal acceptance text but required by SPEC-N2's spirit; the structural (not reference) equality clause closes a defect found at doc review |
| SPEC-R4 | Runtime SPEC-R3 AC2 · message-lifecycle SPEC-R2 root carve-out (REV 2026-07-11) |
| SPEC-R5 | ADR-0128 (this SPEC's one genuine fork) |
| SPEC-N2 | TKT-0024 "the per-path data waking must be preserved untouched" |
| SPEC-N3 | runtime LLD-C6 (list.ts) reconcile-emits-nothing precedent |
