---
id: T-0211
title: "Croupier Deal again deals at the old bet instead of opening the bet strip"
type: bug             # feature | bug | chore | spike | idea
status: proposed     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P1         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
Answering Deal again opens the next table in the betting phase, so the player picks a stake on the CardTable bet strip (Kim's ruling, T-0172: one press bets and deals).

## Repro
1. `npm run chat:probe -- --replay scripts/e2e-admin/probe/replays/croupier-deal-again-old-bet.json` (keyless), or play a live Haiku 5.5 blackjack round to settled and press Deal again.

## Expected
table-2 is created with phase betting, empty hands and the last settled bankroll; the bet strip shows.

## Actual
Haiku 5.5 created table-2 already dealt (phase playing) at the old 100 stake: "New round on the same 100 bet." Live: blackjack-rounds-haiku-1 turn 4 (trace 2026-10-15.jsonl:4, `.sdlc/croupier-closed-loop/runs/blackjack-rounds-haiku-1/turn-4.png`) and pontoon-haiku-1 turn 5 (trace :29). The next bet click then failed `click-target`. Sonnet 5.5 opened a betting table in all its runs.

## Context
Found by T-0184. Guess: the round-loop teaching says Deal again starts the next round but not that the round starts in betting, and `croupierActionApplied` ignores the `newRound` action. Proposed check: a `newRound` action must create a fresh CardTable surface whose phase is betting with empty hands. The replay `scripts/e2e-admin/probe/replays/croupier-deal-again-old-bet.test.mjs` pins the trace (expected-fail on `action-updates-surface`, an offline replay divergence, see T-0222); no probe check sees the skipped phase yet. Not the bet strip: the old table's strip is hidden (`turn-4.png` shows only Hit and Stand); the probe's button list includes hidden buttons (T-0222). Found by T-0184 (`.sdlc/croupier-closed-loop/report.md`); run folders and screenshots under `.sdlc/croupier-closed-loop/runs/` in the T-0184 lane commit; the trace file is git-ignored in the wave-cl worktree.

## Constraints
The failing test lands before or with the fix, never after. No em dashes.
