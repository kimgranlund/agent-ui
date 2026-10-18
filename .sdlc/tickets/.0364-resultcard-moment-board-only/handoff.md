---
id: T-0364
title: "ResultCard composite moment fires only beside a BoardGrid"
type: bug             # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
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

## Acceptance criteria
verifier: L3

1. `npx vitest run packages/agent-ui/a2ui/src/catalog/composite-moments.test.ts` exits 0: the repro (a Card with "You won! The answer was a cat." and a Play again Button, no BoardGrid), a Negotiator, a Dungeon Master and a quizmaster final-round ending yield `['RESULT_CARD_MISSING']` and none with a ResultCard; mid-game progress, a sales dashboard, an order receipt, a booking confirmation, a concierge Gold level, a podcast player, a lone "Game over? Not yet" notice, a round result Toast, two croupier hands and a quizmaster mid-run reveal yield no RESULT_CARD_MISSING and each fires with the board-less gate opened; a BoardGrid ending in a Toast still fires; a CardTable or PlayingCard never answers a carried RESULT_CARD_MISSING.
2. `npx vitest run packages/agent-ui/a2ui/src/live-agent/check-contracts.test.ts` exits 0, its mutation opening the row's board-less gate.
3. `npx vitest run --project scripts scripts/e2e-admin/probe/` exits 0 (no replay re-pinned).
4. `npm run check` exits 0.
5. The ResultCard repair wording is unchanged.

## Outcome

2026-10-18 · lane: full L2 · verdict: pass · verifier: verifier-L3 (fable) · base: 8421bba9988a
- Changed: ResultCard moment fires on board-less game endings (#2137)
- Commits: none
- Check: 1 `npx vitest run packages/agent-ui/a2ui/src/catalog/composite-moments.test.ts` exits 0 with the li...: pass
- Check: 2 `npx vitest run packages/agent-ui/a2ui/src/live-agent/check-contracts.test.ts` exits 0, its mutat...: pass
- Check: 3 `npx vitest run --project scripts scripts/e2e-admin/probe/` exits 0 (no replay re-pinned): pass
- Check: 4 `npm run check` exits 0: pass
- Check: 5 The ResultCard repair wording is unchanged: pass
- Follow-up: decide: packages/agent-ui/a2ui/src/catalog/composite-moments.ts:121... -> notes.md
- Follow-up: decide: packages/agent-ui/a2ui/src/catalog/composite-moments.ts:349... -> notes.md
- Follow-up: decide: packages/agent-ui/a2ui/src/catalog/composite-moments.ts:198... -> notes.md
- Follow-up: decide: packages/agent-ui/a2ui/src/catalog/composite-moments.ts:175: note... -> notes.md
- Follow-up: decide: packages/agent-ui/a2ui/src/catalog/composite-moments.test.ts:475... -> notes.md
- Follow-up: decide: site/agent-content/personas/quizmaster/workflows/grand-reveal/WORKF... -> notes.md
- Follow-up: decide: .sdlc/tickets/0364-resultcard-moment-board-only/handoff.md:31... -> notes.md
- Follow-up: decide: /var/folders/n0/b1pq09652mbd8kncmz8tgkvc0000gn/T/sdlc-lite/agent-ui... -> notes.md
