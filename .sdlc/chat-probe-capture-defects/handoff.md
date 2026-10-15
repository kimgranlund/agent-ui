---
id: T-0222
title: "chat:probe step desync on page-fired turns, hidden button labels, run-level expect-component"
type: bug             # feature | bug | chore | spike | idea
status: proposed     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
`npm run chat:probe` records each step's own exchange, lists only visible buttons, and fails a turn that should have shipped a surface.

## Repro
1. Open `.sdlc/croupier-closed-loop/runs/five-card-draw-sonnet-1/report.json`: turn 5 (click Deal again) holds the "Bet 50" answer (trace :115), and every later step is one exchange late.
2. Open `.sdlc/croupier-closed-loop/runs/blackjack-rounds-haiku-1/report.json` turn 5: `available` lists two bet strips, but `turn-4.png` shows only Hit and Stand.

## Expected
A step's record holds that step's answer; page-fired turns are recorded as their own rows; `available` lists visible buttons.

## Actual
Three defects. (1) Desync: `waitForTurn` returns on the first finished turn, so page-fired heal turns (:113, :114) shift the record (five-card-draw-sonnet-1 only, of 16 runs). (2) `surfaceButtonLabels` includes hidden buttons, which read as "two full bet strips" in the T-0184 review. (3) `expect-component` is run-level, so hold'em Haiku passed with four surface-less turns. Also: the offline replay diverges from live on two retry turns (`croupier-deal-again-old-bet`, `croupier-stud-bet-table-missing` replays fail checks the live run passed or failed differently).

## Context
Files: `scripts/e2e-admin/probe/run.ts` (step loop), `scripts/e2e-admin/admin-page.ts` (`surfaceButtonLabels`), `scripts/e2e-admin/probe/model.ts` (checks), `scripts/e2e-admin/probe/trace.ts` (`offlineReplay`). T-0184 already made `clickSurfaceButton` click the newest visible match. Found by T-0184 (`.sdlc/croupier-closed-loop/report.md`); run folders and screenshots under `.sdlc/croupier-closed-loop/runs/` in the T-0184 lane commit; the trace file is git-ignored in the wave-cl worktree.

## Constraints
The failing test lands before or with the fix, never after. No em dashes.
