---
id: T-0330
title: "Feed a dropped surface's bound composite finding with SURFACE_DROPPED (round 9 cluster C)"
type: bug             # feature | bug | chore | spike | idea
status: done     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-17
branch: fix/0330-dropped-surface-finding
worktree: ../agent-ui.worktrees/wave-w330
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
The SURFACE_DROPPED repair no longer asks the model to resend a surface that already failed a composite check.

## Intent
- Do: the fix in Context, one cause.
- Non-goals: other round 9 clusters.
- Done when: A produce test that the :157 round 3 request carries the BOOKING_FORM_MISSING finding; red first. `npm run check` plus the touched folders' tests exit 0.

## Context
produce.ts :697, :1111, :1724. Round 9 :157 (long-spa-services-haiku): round 1 read-back gets BOOKING_FORM_MISSING, round 2 is prose, the forced round 3 resends the same read-back and ships SEMANTIC_UNCORRECTED. report .sdlc/evals/rounds/2026-10-17-r9-matrix/report.md cluster C.

## Constraints
None.

## Outcome

2026-10-17 · lane: full L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: 99910ea777cd
- Changed: SURFACE_DROPPED repair restates the dropped surface's unanswered composite finding in one sentence (#2093)
- Commits: 40107b4 T-0330: record lane wave-w330
- Check: 1 new test passes and is red at the parent: pass
- Check: 2 `npm run check`: pass
- Check: 3 agent + live-agent folders: pass
- Follow-up: note: .sdlc/runtime/tasks/0330-r9-dropped-surface-finding/verifier-L2.run... -> notes.md
