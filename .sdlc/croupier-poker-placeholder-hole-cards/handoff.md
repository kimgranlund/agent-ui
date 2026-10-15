---
id: T-0218
title: "Croupier poker hole cards are placeholders, not a committed hand"
type: bug             # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P1         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
A poker deal writes the dealer's real hole cards (face down) once, and the showdown reveals those same cards.

## Repro
1. `npx vitest run scripts/e2e-admin/probe/replays/croupier-omaha-placeholder-hole.test.mjs` (trace 2026-10-15.jsonl:105), then read the turn-1 data model.

## Expected
Four distinct dealer cards, faceDown true, unchanged until the showdown.

## Actual
Sonnet 5.5 Omaha wrote the dealer hand as four identical 2 of clubs (omaha-sonnet-1 turn 1). Haiku 5.5 Omaha wrote four aces of spades, swapped them mid-hand and settled on the swapped cards, then told the player the result "isn't reliable" (omaha-haiku-1 turns 3 to 7, traces :37 to :41). No check fires.

## Context
Guess: face-down cards read as decoration to the model, so it writes placeholders and invents the hand at showdown. Proposed check: within one deal every card is distinct (single deck games), and a face-down card's rank and suit never change before it is turned up. Found by T-0184 (`.sdlc/croupier-closed-loop/report.md`); run folders and screenshots under `.sdlc/croupier-closed-loop/runs/` in the T-0184 lane commit; the trace file is git-ignored in the wave-cl worktree.

## Constraints
The failing test lands before or with the fix, never after. No em dashes.

## Acceptance criteria
- (red) A new `croupier-deck` check: on a surface that names a poker game every card in the data model is distinct (CARD_DUPLICATE, the recorded four face-down 2 of clubs), and on an action turn a face-down card on the clicked surface turns up, or stays down, as the same rank and suit (HOLE_CARD_CHANGED); a blackjack table, a draw game's redraw, a new round and another surface are never judged: `npx vitest run --project packages packages/agent-ui/a2ui/src/catalog/personas/croupier/checks.test.ts -t T-0218` exits 0.
- The touched folders stay green: `npx vitest run --project packages packages/agent-ui/a2ui/src/catalog packages/agent-ui/a2ui/src/live-agent` exits 0.
- The recorded fixture still replays: `npx vitest run --project scripts scripts/e2e-admin/probe/replays/croupier-omaha-placeholder-hole.test.mjs` exits 0 (the offline replay runs no semantic checks, so the Repro span is green on the broken tree too; it stays as recorded evidence).
- `npm run check` exits 0.
