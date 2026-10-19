---
id: T-0379
title: "A Croupier check reads the reply's pot and bankroll against the table and across hands (round 12 cluster K)"
type: feature        # feature | bug | chore | spike | idea
status: ready     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L3             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-18
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
A Croupier check catches poker chip drift a one-turn table read misses: the reply's stated pot and bankroll disagreeing with the table, and the bankroll not carried across Deal again.

## Intent
- Do: extend POKER_CHIPS_MISMATCH (T-0371) or add a sibling check that reads the pot and bankroll the reply states against the table, and carries the settled bankroll into the next hand.
- Non-goals: blackjack BANKROLL_MISMATCH.
- Done when: a check test on the r12 `omaha-haiku-3` sequence fires; correct hands stay quiet; the croupier sweep shows no lost hits; `npm run check` exits 0.

## Context
Round 12 archive `.sdlc/evals/rounds/2026-10-19-r12-targeted/` (report.md "Why it failed and how to fix it", fog report 6bae5f5b20e6a9741951dd4a). Trace lines `:n` are 1-based lines of its `traces/2026-10-19.jsonl`. Kim chose to ticket this cluster on 2026-10-19. Cluster K (round 11, reopened): judged C4 fails 5 of 9 hold'em, Omaha and stud runs (`omaha-haiku-1` to `-3`, `seven-card-stud-haiku-2`, `texas-holdem-haiku-1`), e.g. "You bet the pot at $15. The opponent calls, so the pot is $30." T-0371's check fired 3 times and repaired each, but reads one turn's table only.

## Constraints
Recorded rounds are never rewritten.
