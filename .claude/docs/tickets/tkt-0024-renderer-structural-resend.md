---
doc-type: ticket
id: tkt-0024
status: open
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
