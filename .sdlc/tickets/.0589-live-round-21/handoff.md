---
id: T-0589
title: "Live round 21 measures the round 20 cluster fixes"
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
After the round 20 cluster fixes (T-0585 Z, T-0586 G, T-0587 S1, T-0588 S2; PRs 2390 to 2393), does the 69-run Haiku matrix reach 68 or 69 of 69, and are Z, G and S closed?

## Goal
A paid Haiku round reports pass rates across the full persona matrix after the round 20 cluster fixes.

## Context
Round 20 (`.sdlc/evals/rounds/2026-10-29-r20-pattern/`, T-0584) passed 64 of 69 for 0.68 USD with Z recurring and new clusters S and G. Kim approved this paid run 2026-10-29.

## Done when
- `report.md` in the new round folder gives per-cell and per-cluster round 20 and round 21 numbers, eval:signals churn against round 20, cost, whether Z, G and S are closed, any regression from the new checks and the widened heal (false sends-back or wrong heals), and a proposed fix layer and keyless test per failing cluster.
- `npm run check` passes.

## Constraints
Cap 5 USD. Same 69-run Haiku matrix and runner as rounds 16 to 20. A new round archive `.sdlc/evals/rounds/2026-10-29-r21-pattern/`; never rewrite a finished one. No fixes land here. The lane `.env` is a symlink; never read or print it. No em dashes.
- Lane: solo because size L2 (steps.py lane)

## Acceptance criteria
- The round archive `.sdlc/evals/rounds/2026-10-29-r21-pattern/` holds 69 run reports from one capped run at the base commit under the 5 USD cap: `jq -e '.totals.runs == 69 and .totals.costUsd < 5 and .stop == "done"' .sdlc/evals/rounds/2026-10-29-r21-pattern/round.json` exits 0.
- Its 69 `chat:probe` lines equal round 20's once the round slug is normalized: `diff <(sed 's/r20-pattern/rX/g' .sdlc/evals/rounds/2026-10-29-r20-pattern/live-commands.sh | grep '^npm') <(sed 's/r21-pattern/rX/g' .sdlc/evals/rounds/2026-10-29-r21-pattern/live-commands.sh | grep '^npm')` exits 0.
- `report.md` in the round folder gives per-cell and per-cluster round 20 and round 21 numbers that agree with `npm run eval:signals -- --round 2026-10-29-r21-pattern --against 2026-10-29-r20-pattern --min-samples 1`, the cost from `round.json`, a closed or open verdict with evidence for each of Z, G and S, a regression check of the new checks and the widened heal, and a fix layer plus keyless test per failing cluster.
- Each failing run's fixture replays keylessly, with the run's `--expect-component` flags from `live-commands.sh`, and exits 1 on the checks the report names.
- `npm run check` exits 0, and the added report carries no em dash: `! grep -q "$(printf '\342\200\224')" .sdlc/evals/rounds/2026-10-29-r21-pattern/report.md` exits 0.

## Outcome

2026-10-29 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: be8f9dae80e4
- Changed: Live round 21 passes 63 of 69 Haiku runs for 0.68 USD; Z, G and S closed, five new single-run clusters
- Commits: none
- Check: 1 round archive holds 69 runs, cost under 5, stop done: pass
- Check: 2 69 chat:probe lines equal round 20's after slug normalization: pass
- Check: 3 report.md numbers agree with eval:signals, cost from round.json, Z/G/S verdicts, regression check...: pass
- Check: 4 each failing run's fixture replays keylessly with its `--expect-component` flags and exits 1 on t...: pass
- Check: 5 `npm run check` exits 0, and report.md has no em dash: pass
- Follow-up: note: the report's 5 proposed tickets J1, P4c, P5c, H1, Q1 are unfiled by... -> notes.md
