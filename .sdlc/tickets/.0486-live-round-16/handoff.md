---
id: T-0486
title: "Live round 16 measures the round 15 fixes (T-0478 to T-0485) across the full matrix"
type: spike           # feature | bug | chore | spike | idea
status: done     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-28
claimed_by: claude:a8ce3b21 2026-10-28
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
A paid Haiku round reports pass rates across the full persona matrix after the round 15 fixes.

## Context
Round 15 (`.sdlc/evals/rounds/2026-10-26-r15-pattern/`) passed 65 of 69 for 0.66 USD; the recheck `2026-10-27-r15-recheck` passed 12 of 12. Fixes since: T-0478 to T-0485 (receipt, itinerary, GameHud requiresAny, claim regex negatives). Same 69-run matrix and runner as round 15.

## Constraints
Cap 5 USD. A new round archive `.sdlc/evals/rounds/2026-10-28-r16-pattern/`; never rewrite a finished one. Each failing cluster gets a proposed fix layer and keyless test in the report, for Kim to rule on; no fixes land here. The lane's `.env` is a symlink to the main checkout's; never read or print it. No em dashes.

## Done when
- `report.md` in the new round folder gives per-cluster round 15 and round 16 numbers and cost.
- `npm run check` passes.

## Acceptance criteria
- `.sdlc/evals/rounds/2026-10-28-r16-pattern/round.json` shows 69 runs, stop done, cap 5, and `totals.costUsd` under 5.
- `report.md` there gives per-cell and per-cluster round 15 and round 16 numbers, the eval:signals churn against `2026-10-26-r15-pattern`, the cost, and a proposed fix layer and keyless test for each failing cluster, with no em dash.
- The round 15 archives are unchanged (`git diff --quiet HEAD -- .sdlc/evals/rounds/2026-10-26-r15-pattern .sdlc/evals/rounds/2026-10-27-r15-recheck`).
- `npm run check` exits 0.
- Lane: solo because size L2 (steps.py lane)

## Outcome

2026-10-28 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: eb742cd01a35
- Changed: Live round 16 passes 67 of 69 Haiku runs for 0.67 USD, every round 15 cluster holds, two new single-run clusters proposed
- Commits: none
- Check: 1 round.json shows 69 runs, stop done, cap 5, costUsd under 5: pass
- Check: 2 report.md has per-cell and per-cluster round 15 and 16 numbers, the eval:signals churn, cost, a f...: pass
- Check: 3 round 15 archives unchanged: pass
- Check: 4 `npm run check` exits 0: pass
- Follow-up: note: no process deviation: lines from redck.py deviations; no red... -> notes.md
- Follow-up: note: criterion 3's check is a plain git diff against HEAD; the r15... -> notes.md
