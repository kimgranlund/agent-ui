---
id: T-0212
title: "Croupier BET_TABLE_MISSING fires on poker bet steps and costs repair rounds"
type: bug             # feature | bug | chore | spike | idea
status: proposed     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
`BET_TABLE_MISSING` only fires for blackjack-family tables, so a poker bet step is never sent back to become a CardTable.

## Repro
1. `npx vitest run scripts/e2e-admin/probe/replays/croupier-stud-bet-table-missing.test.mjs` (keyless; the trace 2026-10-15.jsonl:49).

## Expected
A seven-card stud opening with a stake Slider and a Deal Button ships on round 1.

## Actual
Round 1 (ask-1) and round 2 were sent back with BET_TABLE_MISSING; the model gave up and re-issued the bet as ask-2. The probe failed `no-surface-loss` (ask-1 created, never shipped). Run seven-card-stud-haiku-1 turn 1.

## Context
`betStepWithoutTable` in `packages/agent-ui/a2ui/src/catalog/personas/croupier/checks.ts` judges any surface with a bet input or a Deal Button and no PlayingCard, whatever the game; its own message says "A game other than blackjack keeps its Card". Guess: it needs the game (the table title, the turn's game-rules resource, or the absence of blackjack words) before it fires. Two wasted repair rounds per poker opening. Found by T-0184 (`.sdlc/croupier-closed-loop/report.md`); run folders and screenshots under `.sdlc/croupier-closed-loop/runs/` in the T-0184 lane commit; the trace file is git-ignored in the wave-cl worktree.

## Constraints
The failing test lands before or with the fix, never after. No em dashes.
