---
id: T-0219
title: "Croupier result narration and rule moves go unchecked against the cards"
type: bug             # feature | bug | chore | spike | idea
status: proposed     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
A result line or move the Croupier states agrees with the cards and the game's rules entry, or the turn is sent back.

## Repro
1. `npx vitest run scripts/e2e-admin/probe/replays/croupier-spanish-surrender-narration.test.mjs` (traces 2026-10-15.jsonl:15 to 20).

## Expected
A late surrender settles as "You surrender: half your 100 back, bankroll 850."

## Actual
Spanish 21 Haiku 5.5: "You surrender. Dealer 18 beats your soft 20. You lose 50." (spanish-21-haiku-1 turn 6, :20): 18 does not beat 20 and a surrender is not a comparison; the arithmetic (850) was right. Pontoon Sonnet 5.5 bought a card face up (pontoon-sonnet-1 turn 7, :90; the rules entry says a buy is a face-down card). Omaha Haiku 5.5 called a 100 bet into an empty pot illegal and then doubted its own earlier 50 bet (omaha-haiku-1 turn 9, :43). No check reads narration.

## Context
The hand check (`checks.ts`) parses totals only, never a result line. Proposed: parse "X beats Y" / "wins with N" in the result or status against the computed totals, and check a buy card's face. A judged check may fit better than a regex for the poker cases. Found by T-0184 (`.sdlc/croupier-closed-loop/report.md`); run folders and screenshots under `.sdlc/croupier-closed-loop/runs/` in the T-0184 lane commit; the trace file is git-ignored in the wave-cl worktree.

## Constraints
The failing test lands before or with the fix, never after. No em dashes.
