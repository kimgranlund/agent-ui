---
id: T-0233
title: "A playing-phase CardTable with no move Buttons passes the Croupier checks"
type: bug             # feature | bug | chore | spike | idea
status: proposed     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-15
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
A CardTable in the playing phase always offers the player's moves, or the turn is sent back.

## Repro
1. `npx vitest run scripts/e2e-admin/probe/replays/croupier-rounds-haiku-no-moves.test.mjs` (pinned; turn 1 also leaks a meta-line, T-0229).
2. Open `.sdlc/live-round-2/runs/croupier-blackjack-rounds-haiku-1/turn-2.png`: the next step finds no Stand ("buttons: none").

## Expected
After the 100 press the table shows the dealt hands and Hit and Stand (and Double where legal).

## Actual
Round 1 answered in prose only and got ACTION_NOT_APPLIED; the repair round (`2026-10-15.jsonl:2`) resent `{"id":"root","component":"CardTable","phase":"playing",...,"betAction":"deal","children":[]}`, so the moves were dropped and the turn shipped.

## Context
No check in `packages/agent-ui/a2ui/src/catalog/personas/croupier/checks.ts` reads a playing-phase CardTable's move Buttons; NATURAL_ACTIONS reads them only to forbid moves on a natural. Guess: a MOVES_MISSING finding when a CardTable is in phase playing, no hand is a natural or bust, and no child Button names a move (`moveWord`). Found by T-0225 (`.sdlc/live-round-2/report.md`).

## Constraints
The failing test lands before or with the fix, never after. No em dashes.

## Acceptance criteria
- (red) `npx vitest run --project packages packages/agent-ui/a2ui/src/catalog/personas/croupier/checks.test.ts` exits 0: a playing-phase CardTable with no move Button gets the finding; a settled or natural table does not.
- `npm run check` exits 0.
