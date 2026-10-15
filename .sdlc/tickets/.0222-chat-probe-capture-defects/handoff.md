---
id: T-0222
title: "chat:probe step desync on page-fired turns, hidden button labels, run-level expect-component"
type: bug             # feature | bug | chore | spike | idea
status: done     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
`npm run chat:probe` records each step's own exchange, lists only visible buttons, and fails a turn that should have shipped a surface.

## Repro
1. Open `.sdlc/evals/rounds/2026-10-14-r1-croupier/runs/five-card-draw-sonnet-1/report.json`: turn 5 (click Deal again) holds the "Bet 50" answer (trace :115), and every later step is one exchange late.
2. Open `.sdlc/evals/rounds/2026-10-14-r1-croupier/runs/blackjack-rounds-haiku-1/report.json` turn 5: `available` lists two bet strips, but `turn-4.png` shows only Hit and Stand.

## Expected
A step's record holds that step's answer; page-fired turns are recorded as their own rows; `available` lists visible buttons.

## Actual
Three defects. (1) Desync: `waitForTurn` returns on the first finished turn, so page-fired heal turns (:113, :114) shift the record (five-card-draw-sonnet-1 only, of 16 runs). (2) `surfaceButtonLabels` includes hidden buttons, which read as "two full bet strips" in the T-0184 review. (3) `expect-component` is run-level, so hold'em Haiku passed with four surface-less turns. Also: the offline replay diverges from live on two retry turns (`croupier-deal-again-old-bet`, `croupier-stud-bet-table-missing` replays fail checks the live run passed or failed differently).

## Context
Files: `scripts/e2e-admin/probe/run.ts` (step loop), `scripts/e2e-admin/admin-page.ts` (`surfaceButtonLabels`), `scripts/e2e-admin/probe/model.ts` (checks), `scripts/e2e-admin/probe/trace.ts` (`offlineReplay`). T-0184 already made `clickSurfaceButton` click the newest visible match. Found by T-0184 (`.sdlc/evals/rounds/2026-10-14-r1-croupier/report.md`); run folders and screenshots under `.sdlc/evals/rounds/2026-10-14-r1-croupier/runs/` in the T-0184 lane commit; the trace file is git-ignored in the wave-cl worktree.

## Constraints
The failing test lands before or with the fix, never after. No em dashes.

## Lane brief (conductor, 2026-10-14)
Lane 3 of Kim's plan: make chat:probe report only real failures before Kim's next $20+ live round. Fix: per-step records stay aligned when the page fires its own error turns; the available-button list excludes hidden buttons; expect-component scopes per turn where the scenario means it; offline replay matches live on retry turns. Evidence: the T-0184 report on main (.sdlc/evals/rounds/2026-10-14-r1-croupier/report.md) and the five-card-draw-sonnet run. Keep the probe selftest in check:scripts green and add one keyless regression per defect. No live spend. Gate: npm run check plus scripts/e2e-admin tests. Work and commit in the worktree the prompt names; no push.

## Acceptance criteria
Run from the lane worktree root (.claude/worktrees/T-0222-solo-chat-probe-capture-defects).
- Desync, per-turn expect-component and the CLI: `node scripts/chat-probe.mjs selftest` exits 0 (its canned cases pin the step's own exchange among page-fired error turns, the `{"page": ...}` row, and a turn-expected component answered in prose failing exactly expect-component).
- Hidden buttons and offline replay: `npx vitest run scripts/e2e-admin` exits 0 (`admin-page.test.mjs` lists only visible buttons; `croupier-deal-again-old-bet` replays green as live did; `croupier-stud-bet-table-missing` loses ask-1 as live did; `trace.test.mjs` pins the replay's semantic checks to the shipped personas; the Croupier deals carry `--expect-turn`).
- Gate: `npm run check` exits 0.

## Plan review
- scope widened: conductor keeps .sdlc/evals/rounds/2026-10-14-r1-croupier/live-commands.sh (regenerated; croupier.test.mjs requires it to equal liveCommandsScript()) and packages/agent-ui/a2ui/tools/testkit/producer-leg.ts (optional semanticChecks for offline replay). Both serve the goal.
- verifier: also run `npm run e2e:admin` (test-chat flows now see visible buttons only) in this tree (wave-pb now holds the T-0222 commits).

## Outcome

2026-10-14 · lane: solo L1 · verdict: closed by reason (Merged in #1995; verifier L2 pass) · verifier: none · base: none
- Changed: see commits
- Commits: none
