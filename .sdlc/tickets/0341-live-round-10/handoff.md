---
id: T-0341
title: "Live round 10: targeted rerun of round 9 failures and the runs each fix touches ($10 cap)"
type: chore           # feature | bug | chore | spike | idea
status: ready     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-17
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
Measure the round 9 fixes live: each fix's mechanism metric moves as predicted, with no new regressions on the runs they touch.

## Intent
- Do: phase 1, a round 10 generator (`scripts/e2e-admin/probe/round10.ts` plus test, modeled on round9.ts) that selects the round 9 failures plus the runs each fix touches, 3 samples on unstable runs (blackjack-rounds-haiku, the Haiku blackjack openings), a dry run and a cost estimate under $10; the conductor runs the live round; phase 2, the report with churn against round 9 on the same runs, one mechanism metric per fix (T-0328 halts, T-0330 dropped-finding restated, T-0331 and T-0333 check fires, T-0332 NARRATION_UNCORRECTED and reply-only repairs, T-0334 pontoon findings, T-0335 retrieval), provider errors quarantined, and the context-fog-of-war analysis.
- Non-goals: the full 87-run matrix (next round).
- Done when: the generator test passes; round.json spend <= 10 and stop done; report.md has the churn table and one metric per fix; `npm run check` exits 0.

## Context
Kim 2026-10-17: targeted, about $10 (alternate full and targeted; closed-loop-run references/experiment-series.md). Round 9: .sdlc/evals/rounds/2026-10-17-r9-matrix/report.md. Fixes: #2084, #2087, #2088, #2082, #2083, #2093, #2094.

## Constraints
Never read or print .env; key check by HTTP status only. Live spend only under the $10 cap.
