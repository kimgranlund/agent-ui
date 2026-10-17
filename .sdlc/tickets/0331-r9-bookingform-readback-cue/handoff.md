---
id: T-0331
title: "BookingForm read-back check matches booking verbs and the confirm_booking action (round 9 cluster D)"
type: bug             # feature | bug | chore | spike | idea
status: ready     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-17
branch: fix/0331-readback-cue
worktree: ../agent-ui.worktrees/wave-w331
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
A DescriptionList read-back with a "Book now" or "Reserve" button is caught like "Confirm booking".

## Intent
- Do: the fix in Context, one cause.
- Non-goals: other round 9 clusters.
- Done when: A composite-moments test on the :84 round 3 payload, red first; existing cases stay green. `npm run check` plus the touched folders' tests exit 0.

## Context
packages/agent-ui/a2ui/src/catalog/composite-moments.ts:88, the readBack cue `/\bconfirm\b/i`. Round 9 :84 (facilities-then-tour-haiku). report .sdlc/evals/rounds/2026-10-17-r9-matrix/report.md cluster D.

## Constraints
None.
