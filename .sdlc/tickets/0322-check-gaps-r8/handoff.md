---
id: T-0322
title: "Check gaps: uncovered prose answers (word-game opening, Concierge form edit) and the ProductCard check missing a priced DescriptionList"
type: bug             # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-16
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
Close round 8 clusters C and D, `.sdlc/evals/rounds/2026-10-16-r8-matrix/report.md` (`## Why it failed and how to fix it`).

## Scope
- C1: a word-game opening answered in prose gets SURFACE_MISSING (like the Battleship and Croupier `opening:` checks; `hidden-state-checks.ts`).
- C2: a Concierge say turn that targets an open BookingForm and sends it no update gets ACTION_NOT_APPLIED (:166).
- D: when the turn asks the services moment (the composite-moment `ask` cue) and the surface lists priced rows in another type (DescriptionList, List), fire PRODUCT_CARD_MISSING (`composite-moments.ts`, extending T-0279's priced-Table condition).

## Done when
- One test per item from the recorded turns (:101, :166, :90), red at the base; the T-0314 contract tests stay green with fixtures added for any new check; the catalog and live-agent suites and `npm run check` exit 0.

## Lane bundle
- T-0322: check gaps C1 (word-game opening), C2 (Concierge edit in prose), D (priced DescriptionList on a services ask).
- T-0324: a blackjack deal that settles needs a two-card 21.
- T-0325: the texas-holdem round scenario has no fixed move after one that can end the hand.
