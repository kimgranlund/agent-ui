---
id: T-0341
title: "Live round 10: targeted rerun of round 9 failures and the runs each fix touches ($10 cap)"
type: chore           # feature | bug | chore | spike | idea
status: done     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
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

## Acceptance criteria
Phase 1 (solo, keyless):
- `npx vitest run scripts/e2e-admin/probe/scenarios/round10.test.mjs` exits 0: the generator derives the failed runs from the round 9 ledger, each fix's runs from the round 9 trace lines carrying its signal, the unstable runs from round 1 BET_TABLE_MISSING on Haiku blackjack openings (3 samples), and the costs from the round 8 and 9 ledgers; the test pins each to its trace evidence, the estimate to at most $8, and the executable `live-commands.sh` with its `# est` lines to the generated script.
- `npx vitest run scripts/e2e-admin/probe/run-capped.test.mjs` exits 0: a run whose `# est` would take the spend past the cap is skipped and recorded in round.json `capSkipped`.
- `node --experimental-strip-types scripts/e2e-admin/probe/run-capped.ts --describe .sdlc/evals/rounds/2026-10-17-r10-targeted/live-commands.sh` exits 0 (33 runs parse as live probes).
- `npm run check` exits 0.

Phase 2: `.sdlc/evals/rounds/2026-10-17-r10-targeted/round.json` has `totals.costUsd` <= 10 ($7.22) and `stop` done; its report.md has the generated churn table against round 9 (`npm run eval:signals -- --round 2026-10-17-r10-targeted --against 2026-10-17-r9-matrix --min-samples 1` exits 0), one mechanism metric per fix, the 3-sample results, the provider-error quarantine line and the fog clusters with one proposed ticket each; `.sdlc/evals/fog/2026-10-17-r10-targeted.json` names the published fog report.

## Outcome

2026-10-17 · lane: full L2 · verdict: pass · verifier: none · base: db992ec8bd62
- Changed: Round 10 targeted: 25 of 33, $7.22; halts 6 to 0; T-0328, T-0332, T-0334, T-0335 fixed live; clusters filed
- Commits: none
- Check: 1 round10 generator test: pass
- Check: 2 run-capped cap-skip test (must fail on the old runner): pass
- Check: 3 `run-capped.ts --describe .../live-commands.sh`: pass
- Check: 4 `npm run check`: pass
- Check: 5 Phase 2 round.json: pass
- Check: 6 Phase 2 churn command: pass
- Check: 7 report.md content and fog record: pass
- Follow-up: note: .sdlc/evals/rounds/2026-10-17-r10-targeted/report.md Comparison set... -> notes.md
- Follow-up: note: origin/main has moved to 3c9bac639 #2102 since the merge base... -> notes.md
