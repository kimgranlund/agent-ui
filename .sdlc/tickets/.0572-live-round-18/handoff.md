---
id: T-0572
title: "Live round 18 measures the round after the October 29 A2UI changes"
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
After the October 29 A2UI renderer and check changes, does the 69-run Haiku matrix hold round 17's 68 of 69, is cluster P5 closed, and did the new checks cause any regression?

## Goal
A paid Haiku round reports pass rates across the full persona matrix after the 2026-10-28 and 29 A2UI renderer and check changes.

## Context
Round 17 (`.sdlc/evals/rounds/2026-10-29-r17-pattern/`, T-0532) passed 68 of 69 for 0.66 USD with one new cluster P5 (cart receipt without an AmountPicker). Changes since: the renderer applies only catalog-declared props (T-0552), media URL scheme gate and format (T-0553, T-0563, T-0565), a2ui-basic defaults (T-0555), dropped mapped-prop reset plus INERT_PROP and RECEIPT_TOTAL_PATH checks (T-0556), the AmountPicker receipt check for P5 (T-0550), the catalogs subpath (T-0530). Kim approved this paid run 2026-10-29.

## Done when
- `report.md` in the new round folder gives per-cell and per-cluster round 17 and round 18 numbers, eval:signals churn against round 17, cost, whether P5 is closed, any regression the new checks caused (new repair rounds or false sends-back), and a proposed fix layer and keyless test per failing cluster.
- `npm run check` passes.

## Constraints
Cap 5 USD. Same 69-run Haiku matrix and runner as rounds 16 and 17. A new round archive `.sdlc/evals/rounds/2026-10-29-r18-pattern/`; never rewrite a finished one. No fixes land here. The lane `.env` is a symlink; never read or print it. No em dashes.
- Lane: solo because size L2 (steps.py lane)

## Acceptance criteria
1. `jq -e '.totals.runs == 69 and .stop == "done" and .cap == 5 and .totals.costUsd < 5' .sdlc/evals/rounds/2026-10-29-r18-pattern/round.json` exits 0.
2. `.sdlc/evals/rounds/2026-10-29-r18-pattern/report.md` gives per-cell and per-cluster round 17 and round 18 numbers, the eval:signals churn against round 17, cost, whether P5 is closed, any regression from the new checks, and a fix layer plus keyless test per failing cluster, each claim traceable to a trace line or run report.
3. `git diff --quiet 11d20e79fa13b142689f8f458db0efe1ca1ca67e -- .sdlc/evals/rounds/2026-10-29-r17-pattern` exits 0 (round 17 archive unchanged).
4. `npm run check` exits 0.

## Outcome

2026-10-29 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: 11d20e79fa13
- Changed: Live round 18 passes 68 of 69 Haiku runs for 0.68 USD; P5 closed, no regression from the new checks, one new cluster R
- Commits: none
- Check: 1 round.json totals and cap: pass
- Check: 2 report.md content and traceability: pass
- Check: 3 round 17 archive unchanged: pass
- Check: 4 npm run check: pass
- Follow-up: note: .sdlc/evals/README.md r15-recheck row ticket changed T-0483 to... -> notes.md
- Follow-up: note: report.md Process notes record that run-capped.ts skips the... -> notes.md
