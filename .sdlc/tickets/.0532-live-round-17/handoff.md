---
id: T-0532
title: "Live round 17 measures the round 16 fixes (T-0498 to T-0501) across the full matrix"
type: spike           # feature | bug | chore | spike | idea
status: done
size: L2
priority: P2         # P1 | P2 | P3
depends: []
created: 2026-10-28
claimed_by: claude:a8ce3b21 2026-10-28
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Question
Did the round 16 fixes (T-0498, T-0499, T-0501) clear clusters M and Q live on Haiku, without new failures across the 69-run matrix?

## Goal
A paid Haiku round reports pass rates across the full persona matrix after the round 16 fixes.

## Context
Round 16 (`.sdlc/evals/rounds/2026-10-28-r16-pattern/`) passed 67 of 69 for 0.67 USD, failing clusters M (move under a new parent) and Q (empty repair round). Fixes since: T-0498 (M), T-0499 and T-0501 (Q and the other forced repairs), T-0500 (probe renderer-rejection check), T-0503 (weekday schedule cue). Same 69-run matrix and runner as round 16. Kim approved this round 2026-10-28.

## Constraints
Cap 5 USD. A new round archive `.sdlc/evals/rounds/2026-10-29-r17-pattern/`; never rewrite a finished one. Each failing cluster gets a proposed fix layer and keyless test in the report, for Kim to rule on; no fixes land here. The lane's `.env` is a symlink to the main checkout's; never read or print it. No em dashes.

## Done when
- `report.md` in the new round folder gives per-cluster round 16 and round 17 numbers and cost.
- `npm run check` passes.

## Acceptance criteria
- `.sdlc/evals/rounds/2026-10-29-r17-pattern/round.json` shows 69 runs, stop done, cap 5, and `totals.costUsd` under 5.
- `report.md` there gives per-cell and per-cluster round 16 and round 17 numbers, the eval:signals churn against `2026-10-28-r16-pattern`, the cost, the new `no-renderer-rejection` probe check's result, and a proposed fix layer and keyless test for each failing cluster, with no em dash.
- The round 16 archive is unchanged (`git diff --quiet HEAD -- .sdlc/evals/rounds/2026-10-28-r16-pattern`).
- `npm run check` exits 0.
- Lane: solo because size L2 (steps.py lane)

## Outcome

2026-10-28 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: 28bfcbd34a6b
- Changed: Live round 17 passes 68 of 69 Haiku runs for 0.66 USD; M and Q hold, one new cluster P5 for Kim's ruling
- Commits: none
- Check: 1 round.json shows 69 runs, stop done, cap 5, costUsd under 5: pass
- Check: 2 report.md content (per-cell and per-cluster r16/r17, signals churn, cost, no-renderer-rejection r...: pass
- Check: 3 round 16 archive unchanged: pass
- Check: 4 npm run check exits 0: pass
- Follow-up: note: the red-checkpoint deviation check redck.py deviations printed no... -> notes.md
- Follow-up: note: report says M, Q, and the weekday cue were not exercised live 0... -> notes.md
