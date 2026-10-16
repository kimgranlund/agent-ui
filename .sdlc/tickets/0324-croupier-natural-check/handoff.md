---
id: T-0324
title: "A blackjack deal that settles needs a two-card 21 (natural); otherwise phase playing with Hit and Stand"
type: bug             # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-16
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
Round 8 cluster F, `.sdlc/evals/rounds/2026-10-16-r8-matrix/report.md` (`## Why it failed and how to fix it`): `blackjack-rounds-haiku` (:9) dealt A and 9, called it a natural and settled; BANKROLL_MISMATCH's repair then accepted the settle. NATURAL_ACTIONS checks that a natural has no moves, not that a settled deal is a natural.

## Done when
- A Croupier check: a deal turn that settles without a two-card 21 fails with a named code and a repair asking for phase playing with Hit and Stand; the bankroll repair no longer endorses the false settle; a test from :9 red at the base; the T-0314 contract tests (fixtures for the new check), the catalog and live-agent suites and `npm run check` exit 0.
