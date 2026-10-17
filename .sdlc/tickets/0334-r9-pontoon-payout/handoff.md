---
id: T-0334
title: "BANKROLL_MISMATCH and NATURAL_ACTIONS price a pontoon at 2:1 (round 9 cluster H)"
type: bug             # feature | bug | chore | spike | idea
status: ready     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P3         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-17
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
The payout check prices naturals per game: pontoon 2:1, blackjack and Spanish 21 3:2.

## Intent
- Do: the fix in Context, one cause.
- Non-goals: other round 9 clusters.
- Done when: A croupier check test on :27: 1300 passes for pontoon; blackjack still 3:2. `npm run check` plus the touched folders' tests exit 0.

## Context
catalog/personas/croupier/checks.ts:672 payout(), :295. Pontoon rules: site/pages/agent-admin-libraries.ts:409. Round 9 :27. report .sdlc/evals/rounds/2026-10-17-r9-matrix/report.md cluster H.

## Constraints
None.
