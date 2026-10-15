---
id: T-0230
title: "Lexicographer and Admiral commit no secret word or fleet, so marks and hits are made up"
type: bug             # feature | bug | chore | spike | idea
status: proposed     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P1         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-15
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
The Lexicographer's secret word and the Admiral's fleets are committed at game start where later turns read them, so every mark, hit and reveal agrees with one fixed answer.

## Repro
1. `npx vitest run scripts/e2e-admin/probe/replays/lexicographer-haiku-no-secret.test.mjs` (pins the trace; turns 3 and 4 also leak, T-0229).
2. Read `.sdlc/live-round-2/runs/lexicographer-invalid-then-replay-haiku-1/turn-4.png` and `turn-5.png` (git-ignored pngs, in the wave-r2 worktree).

## Expected
The word game's first turn commits the secret, and each guess is marked against it. Battleship commits both fleets at the start: the Admiral resolves its return fire against the player's fleet and every shot against its own.

## Actual
No data model in the round holds a secret: Lexicographer surfaces carry `rows`, `used`, `draft` (`2026-10-15.jsonl:182`, `:186`), Admiral ones `cells` and `shipsRemaining` (`:92`). Haiku 5.5 admits it: "I never fixed a secret word earlier, so my GHOST result wasn't checked against anything" (:84), then "the marks I gave for GHOST and BRINE were made up" (:85), and in give-up "I've lost track of the hidden word" (:79). Sonnet 5.5 names SLAIN at the reveal and adds "SWAIN also fits those clues, but SLAIN was my word" (:185), a word fitted to the marks after the fact. The Admiral on Haiku says the fleet is seven cells, then "the revealed board shows five" (:91). The player's fleet is never placed: Sonnet asks the player to call its return fire every turn ("I don't have your fleet's placement, so tell me whether it's a hit", :193 to :208), and Haiku calls every return shot a miss.

## Context
The foundation prose says "hold a secret five-letter word fixed for the whole game", but a turn's reasoning is not carried to the next turn; only the conversation and the data models are. The precedent is the Croupier: dealer hole cards are written face down in the data model at the deal (T-0218) and checked across turns (HOLE_CARD_CHANGED). A data-model path is on the wire (`sendDataModel: true`), so "hidden" needs a ruling first: a client-visible field (as the hole cards are) or host-held state. Found by T-0225 (`.sdlc/live-round-2/report.md`).

## Constraints
The failing test lands before or with the fix, never after. No em dashes.

## Decision
Hidden game state lives in the game surface's own data model under the reserved key `/secret` (the word game: `/secret/word`; Battleship: `/secret/fleet` for the Admiral's ships and `/secret/playerFleet` for the player's, both committed on the opening turn, as `{row, col}` lists in the board's own coordinates). It is a client-visible field bound to no component, the T-0218 face-down hole-card precedent: the producer reads it back from its own earlier wire lines and the action's data model, the host's semantic checks read it, and a player sees it only by inspecting the wire. Host-held state is rejected: nothing survives between turns except the session lines and the data models, and it would need a new store and trust path. The checks run on every catalog (the Lexicographer and Admiral turn on plain `agent-ui`, where no persona or domain check resolves), gated on the types they read and silent unless a surface carries the word-game or Battleship signature.

## Acceptance criteria
- A decision line in this ticket: where hidden game state lives (data model field or host-held), and who may read it.
- (red) A check (a persona `semanticChecks` entry or a producer finding) fails a guess or shot turn whose marks or result disagree with the committed answer, with a unit test on the recorded `lexicographer-haiku-no-secret` turns: `npx vitest run --project packages packages/agent-ui/a2ui/src/catalog/hidden-state-checks.test.ts -t T-0230` exits 0.
- `npm run check` exits 0.
