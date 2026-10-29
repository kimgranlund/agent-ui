---
id: T-0581
title: "Live round 19 measures the cluster R fix"
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
After the cluster R fix (T-0578, PR 2383), does the 69-run Haiku matrix hold 68 or 69 of 69, and is cluster R closed?

## Goal
A paid Haiku round reports pass rates across the full persona matrix after the cluster R fix.

## Context
Round 18 (`.sdlc/evals/rounds/2026-10-29-r18-pattern/`, T-0572) passed 68 of 69 for 0.68 USD with one new cluster R (an unparseable forced-repair round lost its repair ask). T-0578 fixed it in produce.ts. Kim approved this paid run 2026-10-29.

## Done when
- `report.md` in the new round folder gives per-cell and per-cluster round 18 and round 19 numbers, eval:signals churn against round 18, cost, whether R is closed, and a proposed fix layer and keyless test per failing cluster.
- `npm run check` passes.

## Constraints
Cap 5 USD. Same 69-run Haiku matrix and runner as rounds 16 to 18. A new round archive `.sdlc/evals/rounds/2026-10-29-r19-pattern/`; never rewrite a finished one. No fixes land here. The lane `.env` is a symlink; never read or print it. No em dashes.
- Lane: solo because size L2 (steps.py lane)

## Acceptance criteria
1. `jq -e '.totals.runs == 69 and .stop == "done" and .cap == 5 and .totals.costUsd < 5' .sdlc/evals/rounds/2026-10-29-r19-pattern/round.json` exits 0.
2. `.sdlc/evals/rounds/2026-10-29-r19-pattern/report.md` gives per-cell and per-cluster round 18 and round 19 numbers, the eval:signals churn against round 18, cost, whether R is closed, and a fix layer plus keyless test per failing cluster, each claim traceable to a trace line or run report.
3. `git diff --quiet 6e1b2734db753dbde22876bac204eac91addd3ab -- .sdlc/evals/rounds/2026-10-29-r18-pattern` exits 0 (round 18 archive unchanged).
4. `npm run check` exits 0.

## Outcome

2026-10-29 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: 6e1b2734db75
- Changed: Live round 19 passes 62 of 69 Haiku runs for 0.67 USD; R closed, three new check-coverage clusters P5b, Z and P4b
- Commits: none
- Check: 1 round.json totals/stop/cap: pass
- Check: 2 report.md content: pass
- Check: 3 round 18 archive unchanged: pass
- Check: 4 `npm run check`: pass
- Follow-up: note: the red-checkpoint deviation script printed no process deviation... -> notes.md
- Follow-up: note: .sdlc/evals/rounds/2026-10-29-r19-pattern/report.md "Is R closed"... -> notes.md
