---
id: T-0333
title: "BOOKING_CONFIRMATION_MISSING fires on a confirm turn or a read-back, not caption words (round 9 cluster G)"
type: bug             # feature | bug | chore | spike | idea
status: ready     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-17
branch: fix/0333-confirmation-caption
worktree: ../agent-ui.worktrees/wave-w333
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
Captions that mention booking or confirming no longer trip BOOKING_CONFIRMATION_MISSING.

## Intent
- Do: the fix in Context, one cause.
- Non-goals: other round 9 clusters.
- Done when: A composite-moments test: :491 and :257 give no finding, :85 still fires. `npm run check` plus the touched folders' tests exit 0.

## Context
composite-moments.ts:93-108. Round 9 :491 (Opus) and :257 (Sonnet). report .sdlc/evals/rounds/2026-10-17-r9-matrix/report.md cluster G. About $0.25 a round wasted.

## Constraints
None.
