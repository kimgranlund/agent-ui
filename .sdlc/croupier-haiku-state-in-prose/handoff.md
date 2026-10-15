---
id: T-0214
title: "Haiku 5.5 plays Croupier moves in prose without updating the table"
type: bug             # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P1         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
branch: fix/lane-h-agent-behavior
worktree: .claude/worktrees/wave-lh
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
Every Croupier turn that changes the game (a deal, a typed move, a bet press) updates the table surface, on Haiku 5.5 too.

## Repro
1. `npx vitest run scripts/e2e-admin/probe/replays/croupier-draw-haiku-prose-state.test.mjs` (traces 2026-10-15.jsonl:45 to 48).

## Expected
The opening deal ships a table; a typed "Bet 50." that settles the hand updates it to a result and a Deal again Button.

## Actual
Haiku 5.5 dealt five-card draw, hold'em and Omaha in prose with no surface (texas-holdem-haiku-1 turns 1 to 4, five-card-draw-haiku-1 turns 1 and 2, omaha-haiku-1 turn 1). In five-card-draw-haiku-1 turn 4 it settled the showdown in prose ("bankroll is now 1,050") and shipped no update after a SCHEMA retry, so the table kept Check and Bet and the next Deal again click failed `click-target` (`turn-4.png`). The first bet press on blackjack and pontoon was answered in prose and needed ACTION_NOT_APPLIED repair rounds (traces :2, :26). No probe check fails on a typed move that leaves the table stale.

## Context
Guess: `croupierActionApplied` only judges a click, and only blackjack action names; a typed move or a poker turn that names a target table is never checked. Proposed: judge a typed turn that the meta-line targets at an open table the same way, and extend the probe's `action-updates-surface` to a say turn with a `target`. Found by T-0184 (`.sdlc/evals/rounds/2026-10-14-r1-croupier/report.md`); run folders and screenshots under `.sdlc/evals/rounds/2026-10-14-r1-croupier/runs/` in the T-0184 lane commit; the trace file is git-ignored in the wave-cl worktree.

Live round 2 (T-0225, `.sdlc/evals/rounds/2026-10-15-r2-presets/report.md`, traces in the wave-r2 worktree) widens this past Haiku and the Croupier: Opus 5.5 played an Omaha round 2 flop in prose with no table (`2026-10-15.jsonl:259`), the Admiral on Haiku said "my fleet board is now revealed below" with no surface touched (:98), and the Concierge on Haiku reviewed a spa booking in prose with no surface (:58). Croupier Haiku again: the opening (:26, :51), the Omaha turn card (:38), the draw (:43), three prose-only rounds after a bet (:14).

## Constraints
The failing test lands before or with the fix, never after. No em dashes.
