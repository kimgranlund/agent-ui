---
id: T-0368
title: "POKER_DEAL_MISSING judges a PlayingCard template over an empty hand as undealt (round 11 cluster H)"
type: bug             # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-18
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
A hold'em table that asks for the stake with PlayingCard list templates bound to empty hands gets POKER_DEAL_MISSING, as a table with no PlayingCard does (T-0357).

## Repro
1. A croupier check test on the round 2 payload of trace :222 of `.sdlc/evals/rounds/2026-10-18-r11-targeted/``traces/2026-10-18.jsonl` (surface `holdem-table-1`, `playerHand: []`, `dealerHand: []`, a "Choose your bet" reply) expecting `['POKER_DEAL_MISSING']`. Today it yields `[]`.

## Expected
The check fires on templates over empty hands and stays quiet once a hand array holds cards.

## Actual
`regress-croupier-texas-holdem-haiku-3` opened stake-first through the SURFACE_MISSING repair round, so the scripted hand ran a street behind and Deal again never appeared (:222 to :226). POKER_DEAL_MISSING fired 0 times in round 11.

## Context
`packages/agent-ui/a2ui/src/catalog/personas/croupier/checks.ts` `betStepWithoutTable` returns early on any `PlayingCard` ("a dealt hand is past the bet step"), before `holdemStakeAsk`. Guess: a PlayingCard reached only as a ChildList template over an empty bound array is not a dealt card. Report: `.sdlc/evals/rounds/2026-10-18-r11-targeted/``report.md` cluster H.

## Constraints
The failing test lands before or with the fix, never after.

## Kim ruling (2026-10-18, close-out round)
Promoted to ready; run as a keyless solo lane with one verifier, no live spend.

## Acceptance criteria
verifier: L3
- `npx vitest run packages/agent-ui/a2ui/src/catalog/personas/croupier/checks.test.ts -t "T-0368"` exits 0: the inlined :222 round 2 payload with intent "Let's play Texas hold'em." yields exactly `[['POKER_DEAL_MISSING', 'holdem-table-1:dealBtn']]`, worded as a deal with no stake ask (a bet Slider beside it is worded as a stake ask); cards in a hand, a stud, lowball or 2-7 ask, hands cleared after a fold or showdown (no `/phase` key), and a table the session dealt on before stay quiet; a question that mentions hold'em and a blackjack ask that mentions hold'em fall to `BET_TABLE_MISSING`; a Card of empty templates with a bet Slider gets `BET_TABLE_MISSING`, a CardTable never; an orphan template stays dealt.
- `npx vitest run packages/agent-ui/a2ui/src/catalog/personas/croupier packages/agent-ui/a2ui/src/live-agent` exits 0 (the T-0357 tests and the recorded replays unchanged).
- `npm run check` exits 0.
