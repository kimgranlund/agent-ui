---
id: T-0276
title: "The blackjack NATURAL_ACTIONS check fires on a Texas hold'em opening and its repair settles the hand as a blackjack natural"
type: bug             # feature | bug | chore | spike | idea
status: proposed     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P1         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-15
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
NATURAL_ACTIONS runs only on blackjack-family tables, so a poker opening holding an ace and a ten-value card is never sent back as a blackjack natural.

## Repro
`npx vitest run scripts/e2e-admin/probe/replays/croupier-haiku-holdem-natural.test.mjs` (keyless, pinned to today's behavior). Live: `.sdlc/evals/rounds/2026-10-15-r4-fixes/``traces/2026-10-16.jsonl` :46, `regress-croupier-texas-holdem-haiku-1` t0.

## Expected
A Texas hold'em opening with hole cards A K ships its hold'em table with no NATURAL_ACTIONS.

## Actual
NATURAL_ACTIONS fired twice ("The player's cards in playerRow (A, K) are a natural blackjack ... the player wins 3:2"), and the third round obeyed it: "Your A♠ K♦ is a natural, so the hand ends on the deal ... you win 3:2 on your 50-chip stake". table-1 never shipped (no-surface-loss), the next turn opened a fresh hold'em table, and the run fell behind its steps (click-target t5).

## Context
`packages/agent-ui/a2ui/src/catalog/personas/croupier/checks.ts:275` (`naturalFinding`) reads any two-card player hand; the check has no game gate. Found by T-0275.

## Done when
- A Croupier checks test proves a hold'em, Omaha or stud opening with A K raises no NATURAL_ACTIONS, and a blackjack natural still does.
- The replay is recaptured to its fixed shape; `npx vitest run scripts/e2e-admin/probe` and `npm run check` exit 0.
