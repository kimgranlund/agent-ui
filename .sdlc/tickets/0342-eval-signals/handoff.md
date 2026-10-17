---
id: T-0342
title: "Eval signals over the round archive: one command for pass rates, churn, check fires and spend, with --against"
type: feature        # feature | bug | chore | spike | idea
status: ready     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L3             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P1         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-17
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
See the re-scope below.

## Intent
**A. Eval signals over the round archive** (L3, P1, no deps)
- Goal: one command produces the tables every round report now builds by hand, and comparing against a committed round is the baseline.
- Do:
  1. `scripts/e2e-admin/probe/signals.ts` reads `.sdlc/evals/rounds/*/`. It joins ledger rows to `runs/<name>/report.json` by `out` and to trace lines by `traces` ranges. Rounds with no ledger (r1, r2, t0208) are read from `report.json` alone, with cost unknown.
  2. It prints:
     - pass rate per scenario x model and per preset x model, with sample counts
     - cells with mixed results
     - a histogram of failing checks
     - producer retry codes, each as fired / saved / extra USD
     - spend and latency per turn
     - section digests per persona
  3. `--against <round>` prints churn (fail to pass, pass to fail, fail to fail, pass to pass). It exits 1 on a cell under a per-tag floor (the `floorMet` reading in `tools/corpus-genui/legs/report.ts`) or one that drops by more than a delta.
  4. `run-capped.ts` writes a generated `signals.md` into each round at archive time and lists it in `describeRound`.
  5. The ledger gains `sample` and `effort`.
  6. Fix the scenario derivation at run-capped.ts:255, which buckets every T-0329 sample as its own scenario.
  7. In the same change, repair SPEC CL-R4 (the archive is the store; `.agent-evals/` is dropped; no `ttftMs`) and CL-R9 (the baseline is a round), the e2e-admin README Live rounds section, and AGENTS.md Commands via `.claude/docs/references/commands.md`.
- Done when:
  - `npm run check` exits 0.
  - `npx vitest run --project scripts scripts/e2e-admin/probe/signals.test.mjs` exits 0. It uses two fixture round folders and asserts cell counts, a mixed cell, histogram counts, churn transitions and a floor miss that exits 1.
  - `npm run eval:signals -- --round 2026-10-17-r9-matrix --against 2026-10-16-r8-matrix` exits 0 and matches r9 `report.md`: 22 / 28 / 27 of 29 per model, and churn 6 / 6 / 4 / 71.
  - The T-0329 rounds group into one scenario per arm.

## Context
Re-scope of T-0176 to T-0179 (Kim 2026-10-17), architect record .sdlc/runtime/tasks/0176-eval-scenarios-store/architect-L1.md.

## Constraints
Never read or print .env; live legs only under their cap; keys never enter devtools.

## Acceptance criteria
- `npm run check` exits 0.
- `npx vitest run --project scripts scripts/e2e-admin/probe/signals.test.mjs` exits 0: two fixture round folders (`scripts/e2e-admin/probe/fixtures/signals/rounds/`, one without a ledger) assert cell counts, a mixed cell, the failing-check histogram, retry tallies, churn transitions and a floor miss that exits 1.
- `npm run eval:signals -- --round 2026-10-17-r9-matrix --against 2026-10-16-r8-matrix` exits 0; its By model line gives 22, 28 and 27 of 29 for Haiku, Sonnet and Opus, and its churn table counts 6 / 6 / 4 / 71.
- `npx vitest run --project scripts scripts/e2e-admin/` exits 0 (run-capped writes `signals.md` and the ledger carries `sample` and `effort`).
- `npm run eval:signals -- --round 2026-10-17-t0329-old` exits 0 and shows one scenario cell for the arm's 30 samples, plus one for its pontoon witness.
