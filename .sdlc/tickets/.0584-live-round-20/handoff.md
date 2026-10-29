---
id: T-0584
title: "Live round 20 measures the round 19 cluster fixes"
type: spike           # feature | bug | chore | spike | idea
status: done
size: L2
priority: P2
depends: []
created: 2026-10-29
claimed_by: claude:a8ce3b21 2026-10-29
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Question
After the round 19 cluster fixes (T-0582 P5b and P4b, PR 2388; T-0583 Z, PR 2387), does the 69-run Haiku matrix return to 68 or 69 of 69, and are P5b, P4b and Z closed?

## Goal
A paid Haiku round reports pass rates across the full persona matrix after the round 19 cluster fixes.

## Context
Round 19 (`.sdlc/evals/rounds/2026-10-29-r19-pattern/`, T-0581) passed 62 of 69 for 0.67 USD with new clusters P5b, Z and P4b and cluster R closed. Rounds 17 and 18 passed 68 of 69. Kim approved this paid run 2026-10-29.

## Done when
- `report.md` in the new round folder gives per-cell and per-cluster round 19 and round 20 numbers, eval:signals churn against round 19, cost, whether P5b, P4b and Z are closed, any regression from the widened checks (false sends-back), and a proposed fix layer and keyless test per failing cluster.
- `npm run check` passes.

## Constraints
Cap 5 USD. Same 69-run Haiku matrix and runner as rounds 16 to 19. A new round archive `.sdlc/evals/rounds/2026-10-29-r20-pattern/`; never rewrite a finished one. No fixes land here. The lane `.env` is a symlink; never read or print it. No em dashes.
- Lane: solo because size L2 (steps.py lane)

## Acceptance criteria
- The round archive `.sdlc/evals/rounds/2026-10-29-r20-pattern/` holds 69 run reports from one capped run at the base commit under the 5 USD cap: `jq -e '.totals.runs == 69 and .totals.costUsd < 5 and .stop == "done"' .sdlc/evals/rounds/2026-10-29-r20-pattern/round.json` exits 0.
- Its 69 `chat:probe` lines equal round 19's once the round slug is normalized: `diff <(sed 's/r19-pattern/rX/g' .sdlc/evals/rounds/2026-10-29-r19-pattern/live-commands.sh | grep '^npm') <(sed 's/r20-pattern/rX/g' .sdlc/evals/rounds/2026-10-29-r20-pattern/live-commands.sh | grep '^npm')` exits 0.
- `report.md` in the round folder gives per-cell and per-cluster round 19 and round 20 numbers that agree with `npm run eval:signals -- --round 2026-10-29-r20-pattern --against 2026-10-29-r19-pattern --min-samples 1`, the cost from `round.json`, a closed or open verdict with evidence for each of P5b, P4b and Z, a regression check of the widened checks, and a fix layer plus keyless test per failing cluster.
- Each failing run's fixture replays keylessly and exits 1 on the checks the report names.
- `npm run check` exits 0, and the added report carries no em dash: `! grep -q "$(printf '\342\200\224')" .sdlc/evals/rounds/2026-10-29-r20-pattern/report.md` exits 0.

## Outcome

2026-10-29 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: b97e7cf47e69
- Changed: Live round 20 passes 64 of 69 Haiku runs for 0.68 USD; P5b closed, Z recurs, new clusters S and G
- Commits: none
- Check: 1 Round archive holds 69 runs, capped, stop done: pass
- Check: 2 69 chat:probe lines equal round 19's after slug normalization: pass
- Check: 3 report.md numbers agree with eval:signals, cost from round.json, P5b/P4b/Z verdicts with evidence...: pass
- Check: 4 Each failing run replays keylessly and exits 1 on the checks named: pass
- Check: 5 `npm run check` exits 0 and report.md has no em dash: pass
- Follow-up: note: the red-checkpoint deviation check printed no deviation lines; no... -> notes.md
- Follow-up: note: the claim that the three T-0583 branches never fired live and that... -> notes.md
