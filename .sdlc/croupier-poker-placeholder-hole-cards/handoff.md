---
id: T-0218
title: "Croupier poker hole cards are placeholders, not a committed hand"
type: bug             # feature | bug | chore | spike | idea
status: proposed     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
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
