---
id: T-0234
title: "Agents narrate surface ids and earlier-turn corrections in ordinary turns"
type: bug             # feature | bug | chore | spike | idea
status: proposed     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-15
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
An ordinary turn's reply talks about the game or the booking, never about the surfaces: no surface ids, no "I removed the button", no "I need to correct my earlier turns".

## Repro
1. `npx vitest run scripts/e2e-admin/probe/replays/croupier-omaha-opus-narration.test.mjs` (pinned to `no-internal-leak:4`).
2. Read `.sdlc/live-round-2/runs/croupier-omaha-opus-1/turn-5.png`.

## Expected
Turn 4's reply states the turn card and the player's options.

## Actual
Opus 5.5: "Last turn I described round 2 but never actually built its table, so I've built it now as table-2. ... I've also removed the Deal again button from round 1" (`2026-10-15.jsonl:260`). The same confession in Haiku 5.5 turns that are not repair rounds: "Before the showdown I need to correct my last turn: I described the discard and draw but never updated your cards on the table" (:44), "I need to correct my earlier turns: I announced a 2 of spades turn and then replaced it" (:40), "I made a mistake last turn" (:56), "I also need to correct my opening" (Admiral, :91), "I also need to correct my last message" (Concierge, :60). Sonnet 5.5 corrects itself mid-sentence: "I win with a pair of queens, Q♥... correction: Q♦ Q♣" (:140).

## Context
T-0217 taught the repair round's sentence that the user never saw the rejected round; these are ordinary turns, and most confess an earlier turn that stated a change in prose with no surface update (T-0214). The probe's `no-internal-leak` names them; the producer has no finding, so nothing sends them back. Options: a grammar line (prompt stack, baseline recapture) that a fix is made silently on the surface and the reply states the current state, and a producer finding for a surface id or a correction phrase in the reply. Found by T-0225 (`.sdlc/live-round-2/report.md`).

## Constraints
Prompt edits follow the `a2ui-prompt-authoring` recapture flow. No em dashes.

## Acceptance criteria
- (red) A producer test: a reply that names a surface id of the session, or opens a correction of an earlier turn, gets a finding and one repair round.
- `npx vitest run scripts/e2e-admin/probe/replays/croupier-omaha-opus-narration.test.mjs` exits 0 with its expectation updated to the repaired turn.
- `npm run check` exits 0.
