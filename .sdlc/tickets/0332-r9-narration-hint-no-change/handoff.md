---
id: T-0332
title: "NARRATION_HINT leaves the surface as it is when the reply needs no change (round 9 cluster E)"
type: bug             # feature | bug | chore | spike | idea
status: ready     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P3         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-17
branch: fix/0332-narration-hint
worktree: ../agent-ui.worktrees/wave-w332
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
A narration repair on a turn that needed no surface change does not deal a new round.

## Intent
- Do: the fix in Context, one cause.
- Non-goals: other round 9 clusters.
- Done when: A produce replay of :182 that keeps table-2 settled with Deal again; red first. This changes model-read text: the debate rule applies to the wording (one short challenge is enough for a one-line hint). `npm run check` plus the touched folders' tests exit 0.

## Context
produce.ts:1136-1140 NARRATION_HINT. Round 9 :182 (blackjack-moves-sonnet): "Hit me again." after a bust; the repair opened table-3. report .sdlc/evals/rounds/2026-10-17-r9-matrix/report.md cluster E. Note: NARRATED_MECHANICS fires rose 2 to 14 with no code change; that is open and needs a 5-sample rerun, not this ticket.

## Constraints
None.
