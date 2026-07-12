---
doc-type: ticket
id: tkt-0024
status: doing
date: 2026-07-12
owner:
kind: bug
---
# TKT-0024 — the renderer never repaints a mounted container on a structural resend

## Summary
Discovered by the TKT-0020 chat build and HOST-REPRODUCED with a direct probe (2026-07-12):
resending an already-MOUNTED, non-root container via `updateComponents` with a grown `children`
list updates the stored record (`tree.ts`'s upsert) but never repaints — `SurfaceTree.apply`
reuses the cached widget on any later delivery of that id, so the new child never enters the
DOM. Probe: mount `root→group→msg("hello")`, resend `group` whole with `children:['msg','status']`
+ a new `status` Text("READY-MARKER") → textContent stays `"hello"`.

**The blast radius is the four-type lifecycle teaching itself (TKT-0016/ADR-0126):** SPEC-R1
rule 2 and the shipped GRAMMAR bullet teach producers "a change to the SHAPE of the surface is
`updateComponents`, same surfaceId" — at runtime that instruction is a silent no-op for mounted
containers. The a2ui-live demo's turns 3/4 have NEVER visibly restructured (their notes claim a
status line appears; the surface doesn't change) — unnoticed because the round-trip DOM test
asserted teardown-after-turn-5, which cannot distinguish rendered-then-removed from
never-rendered (its own review flagged exactly this as an INFO hardening). The new a2ui-chat
page inherits the same visual no-op faithfully. The kpi-panel corpus exemplar teaches the same
shape.

## Acceptance
- First, the CONTRACT question, settled against the runtime SPEC (the renderer's own spec — find
  its updateComponents re-render requirement or its absence): is structural re-render on a
  mounted container REQUIRED (a renderer bug) or genuinely unspecified (a spec gap needing a
  ratified decision)? The ADR-0053 first-connect limit (Select+Options ship in one message) is
  prior art acknowledging a related constraint — reconcile with it explicitly.
- Then the fix (assuming required): a mounted container whose record changes on a later
  `updateComponents` reconciles its rendered children — added ids mount (in order), removed ids
  dispose, surviving ids KEEP node identity (no full-subtree teardown; the LLD-C6 positional-list
  precedent + the per-path data waking must be preserved untouched). Prop changes on a resent
  record apply per the whole-record upsert semantic.
- The teaching becomes TRUE end-to-end: the a2ui-live turn-3/4 arc visibly shows "Ready"/"Clicked
  again" (the round-trip test gains the present-after-turn-N assertions its review recommended);
  the a2ui-chat page's turn 3/4 assertions upgrade from routing-only to visible-restructure; the
  kpi-panel exemplar's restructure step renders.
- Regression floor: the full a2ui suite + both demo pages' suites + the catalog conformance
  set green; the first-connect/ADR-0053 constraint either lifted-and-documented or explicitly
  retained with the teaching corrected to match.
- The pipeline: this is renderer-core work — design intake first if the reconciliation needs an
  LLD-grade design (likely: widget-cache invalidation strategy, order preservation, focus/state
  survival on surviving nodes), then the a2ui-builder + review gate.

## Repro
The host probe (2026-07-12, throwaway, reproduced above) — or run the a2ui-live demo and watch
turn 3: the note claims a status line was added; the confirmation surface never changes.

## Expected vs actual
- **Expected:** a whole-record container resend reconciles the mounted DOM (adds/removes/keeps).
- **Actual:** the stored record updates; the cached widget renders on; the DOM never changes.

## Classification
Axis: **functional (renderer structural reconciliation)** — plane `packages/agent-ui/a2ui/src/
renderer/` (tree.ts widget cache / renderer.ts). Consumers affected: the GRAMMAR teaching, both
demo pages, the corpus exemplars, any real agent following the taught rule.

## Severity
**major** — the shipped decision-layer teaching instructs producers to emit messages the
renderer silently ignores; demos narrate changes that don't happen (an honest-labels breach
by inheritance).

## Links
- `packages/agent-ui/a2ui/src/renderer/{tree.ts,renderer.ts}` · the runtime SPEC (the contract
  question's home) · ADR-0053 (first-connect limit — prior art) · ADR-0126 + 
  `.claude/docs/spec/a2ui-message-lifecycle.spec.md` SPEC-R1 rule 2 (the teaching this must make
  true) · the TKT-0016 round-trip review's INFO note (the blind spot that let this ship).
- `.claude/docs/tickets/tkt-0020-a2ui-chat.md` — the discovering build; its LLD §4 repair rides
  this ticket's context.

## Findings

**2026-07-12 — design intake complete, documents-only, no build.** Produced:
- [`../spec/renderer-structural-resend.spec.md`](../spec/renderer-structural-resend.spec.md) (SPEC-R1…R5,
  SPEC-N1…N3).
- [`../lld/renderer-structural-resend.lld.md`](../lld/renderer-structural-resend.lld.md) (component map
  LLD-C1…C7: per-node scope registry, a create/wire split in `widget.ts`/`renderer.ts`, resend detection,
  id-keyed children diff, recursive subtree disposal, prop reconcile onto an existing element).
- [`../decompositions/renderer-structural-resend.decomp.json`](../decompositions/renderer-structural-resend.decomp.json)
  (`coverage_check.py --strict` clean: 15 nodes/12 actions/13 hosts/13 edges, plan mode).
- [`../adr/0128-renderer-structural-resend-reconciliation.md`](../adr/0128-renderer-structural-resend-reconciliation.md)
  (proposed; one genuine fork — SPEC-R5 survivor reorder — awaits Kim's ruling; every other design question
  settled from shipped mechanics or direct precedent).

**The contract ruling (acceptance's first question, answered): a genuine SPEC GAP, not a defensible-reading
bug.** The runtime SPEC's SPEC-R3 ("buffer, reconstruct, render-on-root") and SPEC-R4 ("out-of-order tolerance",
AC1: *"a parent referencing a child ID that arrives in a later message... it is patched into place"*) specify
**progressive first build** only — a tree not yet fully delivered, a child arriving for the FIRST time later.
Neither addresses an ALREADY-MOUNTED node's OWN record being resent; `renderer/tree.ts`'s `#patchPending` keys
exclusively on `#pendingParents` (an id previously absent), never on an id already in `surface.widgets`. The
sibling message-lifecycle SPEC's SPEC-R2 (whole-record upsert) already assumed the renderer acts on a resend —
its own AC2 worked example IS this bug's shape — without itself amending the runtime SPEC to say so. Closed by
a NEW sibling SPEC (`renderer-structural-resend.spec.md`), the same altitude relationship the message-lifecycle
SPEC already holds to the runtime SPEC; a forward cross-reference in the runtime SPEC's own SPEC-R3/R4 is a
build-time edit (ADR-0128 `Repairs`), not part of this docs-only intake.

**Mechanism (LLD).** Generalizes the LLD-C6 positional-list's per-item `(scope, ac)` pair (ADR-0024 amendment
3) to EVERY static-tree node — a new `SurfaceTree#nodeScopes` map. A create/wire split in `widget.ts`
(`makeCreateWidget` → `create()` + `wireProps()`) and `renderer.ts` (`#makeHostCreateWidget` → `#create()` +
`#wireNode()`) is the crux: it lets reconciliation re-wire an EXISTING element's props/input/action/checks
without ever calling `factory.create()` again, which is what preserves DOM identity/focus/state. Children
reconcile is an id-KEYED set diff (the static `children: string[]` is naturally id-keyed, unlike LLD-C6's
anonymous array-template instances) — added ids mount fresh and insert at their position (safe: never
relocates an already-connected node), removed ids recursively dispose (leak-free, cascading into any nested
dynamic list via its `parentScope`), survivors are left untouched. Prop reconcile disposes+rebuilds only the
resent node's own `(scope, ac)` pair against the new record, per whole-record-upsert fidelity. A no-delta
resend is inert; `"root"` is never reconciled (the shipped IDGRAPH guard already forecloses a second delivery).
Per-path data waking (`binding.ts`) is entirely untouched — only WHICH scope owns a bound-prop effect changes.

**ADR-0053's fate: RETAINED, not lifted — verified, not assumed.** Read `packages/agent-ui/components/src/
controls/select/select.ts:470-503` directly: `ui-select` moves its authored `[role=option]`/`[role=group]`
light-DOM children into the internal listbox panel **only at first connect** (an idempotent, one-time guard),
never on a later childList mutation. Even after this fix ships, a late-arriving `Option` mounts correctly as a
light-DOM child of `<ui-select>` (this ticket's fix guarantees that much) but is NOT moved into the panel and
stays invisible/inert — a SEPARATE, `ui-select`-owned defect (component-level, not renderer-level), out of this
ticket's scope. A follow-up ticket against `ui-select` is recommended, not opened here.

**The one genuine fork (ADR-0128, Kim's call): survivor reorder.** A resend with no adds/removes, purely a
reorder of already-present children ids, could either (A) realize the full new order by relocating survivor DOM
nodes, or (B) defer reorder as a documented non-goal (add/remove only; survivors keep current DOM position).
Recommendation: **B** — Option A risks the SAME focus-loss class this repo already deferred once (`repeat`'s
`before()`-based move drops focus; only a native `moveBefore` would preserve it, not yet landed). The ticket's
own acceptance criteria reads as add/remove/keep and does not name reorder.

**Build-slice enumeration (post-ratification, a2ui-builder dispatch):** the ticket's own repro becomes a
permanent `tree.test.ts` regression; `round-trip.test.ts` gains a present-after-turn-3 assertion (closing the
"rendered-then-removed vs never-rendered" blind spot its own prior review flagged as INFO); `a2ui-chat`'s turn
3/4 assertions (already flagged pending this ticket at `a2ui-chat.lld.md:153-157`) upgrade from routing-only to
visible-restructure; the `kpi-panel`-shaped corpus seed's fixture test gains a real-render assertion for its
restructure step; full `a2ui` suite + both demo pages + catalog conformance stay green.

**Doc review (self-run, SPEC + LLD).** Requirement IDs are stable and cross-referenced correctly, every
acceptance criterion is testable, and the SPEC's non-goals section explicitly fences the three adjacent
concerns a reader could mistake this for (survivor reorder, ADR-0053/Select, list-item instances). **One real
gap caught and fixed, not merely a wording pass:** the first LLD draft's `#reconcileProps` disposed a resent
node's old scope and re-wired only the keys present in the NEW record — correct for changed/added props, but
silently insufficient for SPEC-R2 AC3 ("an omitted prop does not linger"), since disposing an effect stops it
from re-running without undoing whatever value it already wrote to the element, and the catalog's
`WidgetFactory` (verified `catalog/types.ts`) exposes no per-prop default registry to reset an omitted key
against. Fixed by sourcing the reset value from a throwaway, never-connected `factory.create()` instance (its
reactive props already sit at their class-declared defaults) for exactly the keys dropped between the old and
new record — LLD §7, plus a matching SPEC-R2 wording tightening (a fresh `create()` must not REPLACE the
reconciled node's own element; an ephemeral default-lookup instance is not that). `TreeDeps` gained two more
collaborators (`create`, `resetProp`) to carry it. No other findings above INFO.

### 2026-07-12 — the SPEC-R5 fork RULED (Kim, at the batched prompt): option B — reorder deferred

Add/remove reconcile ships; a survivor keeps its DOM position; reorder is a documented non-goal
until a focus-safe move primitive lands (consistent with the standing repeat/moveBefore deferral).
ADR-0128's Status flip is Kim's hand-edit (the registered guard); the build dispatches on it.
