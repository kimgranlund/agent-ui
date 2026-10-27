---
id: T-0475
title: "Live round 15 measures T-0467 to T-0470 and the round 14 fails"
type: spike           # feature | bug | chore | spike | idea
status: done     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: [T-0472, T-0474]          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-26
claimed_by: claude:a8ce3b21 2026-10-26
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
A paid Haiku round reports pass rates for the round 14 clusters after their fixes.

## Context
Round 14 (`.sdlc/evals/rounds/2026-10-26-r14-pattern/`) passed 64 of 69 for 0.65 USD. Fixes since: T-0467, T-0468, T-0469, T-0470 and the wave 2 guards. Run after wave 2 merges. Wave 3.

## Constraints
Cap 5 USD. A new round archive; never rewrite a finished one. Each failing cluster gets a proposed fix layer and keyless test, filed by Kim's ruling. No em dashes.

## Done when
- `report.md` in a new round folder gives per-cluster before and after numbers and cost.
- `npm run check` plus the touched folders' tests pass.
- Lane: solo because size L2 (steps.py lane)

## Acceptance criteria
- `.sdlc/evals/rounds/2026-10-26-r15-pattern/round.json` shows 69 runs, stop done, cap 5, and `totals.costUsd` under 5.
- `report.md` there gives per-cell and per-cluster round 14 and round 15 numbers, the eval:signals churn against `2026-10-26-r14-pattern`, the cost, and a proposed fix layer and keyless test for each remaining failing cluster, with no em dash.
- The round 14 archive is unchanged (`git diff --quiet 00655fd5c -- .sdlc/evals/rounds/2026-10-26-r14-pattern`).
- `npm run check` exits 0.

## Outcome

2026-10-26 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: 00655fd5cde3
- Changed: Live round 15 passes 65 of 69 Haiku runs for 0.66 USD, every round 14 fixed cluster at 3 of 3, four failing clusters proposed for Kim
- Commits: none
- Check: 1 round.json shows 69 runs, stop done, cap 5, totals.costUsd under 5: pass
- Check: 2 report.md gives per-cell and per-cluster round 14 and round 15 numbers, the eval:signals churn, c...: pass
- Check: 3 round 14 archive unchanged: pass
- Check: 4 `npm run check` exits 0: pass
- Follow-up: note: the report's reproduction claims for W2, P4 and Y were checked only... -> notes.md
