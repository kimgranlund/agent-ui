---
id: T-0343
title: "Smoke scenarios for every preset, planned from tags, replayed in CI"
type: feature        # feature | bug | chore | spike | idea
status: ready     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L3             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-17
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
See the re-scope below.

## Intent
**B. Smoke scenarios for every preset, planned from tags, replayed in CI** (L3, P2, no deps; live leg keyed)
- Goal: all 15 presets have a smoke case that runs live on demand and keyless in `npm test`, and a new round is planned from tags instead of a hand-written `roundN.ts`.
- Do:
  1. `RoundScenario` gains `tags` (`smoke`, `regression`, `routing`, `long`, mapped from today's `regress-`/`routing-`/`long-` prefixes).
  2. Add one smoke scenario of one or two turns, with `--expect-turn` on the signature composite, for each of the 11 missing presets in `probe/scenarios/<preset>.ts`, and one for each of the 4 existing presets.
  3. `probe/scenarios/plan.ts --tag --persona --model --samples N` prints a `live-commands.sh` with names `<scenario>-<modelShort>-<n>`.
  4. One capped live smoke round on Haiku (`--cap 5`) archived under `.sdlc/evals/rounds/<date>-smoke/`.
  5. Each smoke run becomes a keyless replay through `chat:probe --from-trace`. A red one is pinned with `// expectedFail: T-NNNN`.
  6. Repair SPEC CL-R1 (TS modules are the contract, JSON format dropped), CL-R5 (the comment pin is the mechanism), CL-R6 and CL-R7 (the round cap is the cap), plus the e2e-admin README.
- Done when:
  - `npm run check` exits 0.
  - `npx vitest run --project scripts scripts/e2e-admin/probe/scenarios/ scripts/e2e-admin/probe/replays/` exits 0.
  - `plan.ts --tag smoke --model haiku --samples 1` prints 15 commands, one per preset, and `run-capped.ts --describe` on that output exits 0.
  - The smoke round is archived under $5.
  - 15 smoke replays are committed.

## Context
Re-scope of T-0176 to T-0179 (Kim 2026-10-17), architect record .sdlc/runtime/tasks/0176-eval-scenarios-store/architect-L1.md.

## Constraints
Never read or print .env; live legs only under their cap; keys never enter devtools.
