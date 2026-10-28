---
id: T-0498
title: "A component moved to a new parent in the same updateComponents batch survives the reconcile (round 16 cluster M)"
type: bug             # feature | bug | chore | spike | idea
status: claimed     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-28
claimed_by: claude:a8ce3b21 2026-10-28
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
When one `updateComponents` batch moves an existing component under a new parent (also in the batch), the server merge and the browser renderer keep it, so a valid payload no longer reads as a dangling id.

## Context
Round 16 cluster M (T-0486, report `.sdlc/evals/rounds/2026-10-28-r16-pattern/report.md`, merging as #2300). Run `smoke-negotiator-first-offer-haiku-3`: :83 builds `ask-1` with `ask_ft` (CardFooter) whose `child` is `walk`. :84 resends `ask-1` with `ask_ft.child` = `ask_row`, a new Row whose `children` are `accept` and `walk`, and resends `walk`. All three rounds get `IDGRAPH ask_row->walk` and the turn ships nothing. The :84 payload alone validates clean; seeded with :83's `ask-1` it fails. Cause: `packages/agent-ui/a2ui/src/renderer/component-merge.ts` `applyComponentBatch` upserts `walk`, then reconciles the resent mounted `ask_ft`, sees `walk` dropped from its children and disposes it, though `ask_row` in the same batch names it. `packages/agent-ui/a2ui/src/renderer/tree.ts` `#reconcileNode` and `#reconcileChildren` do the same in the browser. Fixture (until #2300 merges, copy from the T-0486 lane): /Users/kimgranlund/Projects/nonoun/agent-ui.worktrees/T-0486-wave-w0486/.sdlc/evals/rounds/2026-10-28-r16-pattern/runs/smoke-negotiator-first-offer-haiku-3/fixture.json

## Constraints
Do not dispose a dropped child that the merged graph still references or the batch redelivers; in tree.ts move its live node instead of recreating it. Keep server and browser behavior identical. Failing-first unit tests on both. Add a keyless replay under `scripts/e2e-admin/probe/replays/` from the :84 turn, following the existing replays. No paid runs. No em dashes.

## Acceptance criteria
- A `component-merge` unit test: a batch that moves a child under a new sibling parent keeps it and reports no IDGRAPH; it fails with the fix reverted.
- A `tree` browser or jsdom test: the moved child's DOM node is the same node after the update (not disposed and recreated); it fails with the fix reverted.
- The new replay from :84 passes `npm run chat:probe -- --replay <it>` and its test fails with the fix reverted.
- `npm run check` and the tests under `packages/agent-ui/a2ui/src/renderer/` pass.
- Lane: solo because size L2 (steps.py lane; ticket resized from L3, two-file fix with a known root cause, solo at tier L3)
