---
id: T-0364
title: "ResultCard composite moment fires only beside a BoardGrid"
type: bug             # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P3         # P1 | P2 | P3
depends: [T-0358]          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-17
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
A board-less game persona (the Mentalist, the Negotiator, the Dungeon Master) that ends its game with a hand-built result Card instead of the ResultCard its skill names gets a RESULT_CARD_MISSING repair round, as T-0358 did for the GameHud.

## Repro
1. `npx vitest run packages/agent-ui/a2ui/src/catalog/composite-moments.test.ts` with a case: a Card holding Text "You won! The answer was a cat." and a Play again Button, no BoardGrid, expecting `['RESULT_CARD_MISSING']`. Today it yields `[]`.

## Expected
The ResultCard row fires on a board-less game ending and stays quiet on a non-game outcome (a booking or order receipt).

## Actual
The ResultCard row in `packages/agent-ui/a2ui/src/catalog/composite-moments.ts` keeps `requires: ['BoardGrid']` and `has: ['BoardGrid']`, so a surface with no board is never checked.

## Context
Follow-up of T-0358. T-0358's board-less path (`statStrip`) reads stat items, which a result does not have, so the change is not symmetric: the ResultCard words (game over, you win, play again) need their own game gate, and the hidden-state checks already emit RESULT_CARD_MISSING for word and fleet games (`hidden-state-checks.ts`). The skills naming it: `guess-hud`, `deal-sheet`, `quest-log`.

## Constraints
The failing test lands before or with the fix, never after.
