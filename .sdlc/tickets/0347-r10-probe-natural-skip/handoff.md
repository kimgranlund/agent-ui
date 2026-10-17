---
id: T-0347
title: "Scripted card scenarios skip the rest of a hand when a natural settles it (round 10 cluster D)"
type: chore           # feature | bug | chore | spike | idea
status: ready     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-17
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
Probe scenarios stop failing a correct agent when a natural settles the hand on the deal.

## Intent
- Do: the fix in Context, one cause.
- Non-goals: other round 10 clusters.
- Done when: Keyless replays of :80 and :101 pass the scenario; a run without a natural is unchanged. `npm run check` plus the touched folders' tests exit 0.

## Context
scripts/e2e-admin/probe croupier scenario steps. Round 10 :80 (blackjack-rounds-haiku-3), :101 to :103 (pontoon-haiku-1): NATURAL_ACTIONS settled correctly (T-0324, T-0334) and the next scripted step had no button. Round 10 report .sdlc/evals/rounds/2026-10-17-r10-targeted/report.md cluster D.

## Constraints
None beyond AGENTS.md.
