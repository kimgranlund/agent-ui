---
id: T-0445
title: "Live quality round 13: measure the pattern wave against the round 12 baseline"
type: spike        # feature | bug | chore | spike | idea
status: done     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-24
claimed_by: claude:a8ce3b21 2026-10-24
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 30
---

## Goal
A live round 13 measures whether every persona reaches for the 2026-10 pattern wave (OptionDeck, OptionCompare, ConfirmReceipt, AmountPicker, StepFlow, Itinerary) against the round 12 baseline, and files its failure clusters as tickets.

## Context
Roadmap candidate arc 2 (`.claude/docs/roadmap.md`, 2026-10-24 lead). Round 12 is `.sdlc/evals/rounds/2026-10-19-r12-targeted/`; the T-0440 spot sweep is `.sdlc/evals/rounds/2026-10-24-t0440-sweep/`. Rounds run through `scripts/e2e-admin/probe/plan.ts` and `run-capped.ts`, which archive the round. Known gaps to probe: the `CHANGE_CLAIM_IN_REPLY` keyword regex (T-0428's open note), Stylist's nested-card failure on Haiku, SURFACE_CLAIMED (T-0442).

## Constraints
Live spend cap $12 for the round (the round 12 cap). Never rewrite an earlier round archive. Fixes are not built here: each cluster becomes a ticket proposal in the report.

## Done when
- The round archive exists under `.sdlc/evals/rounds/` with its README, signals.md and a report.md that compares against round 12 and names each failure cluster with trace lines.
- Spend is under the cap.
- Lane: solo because size L2 (steps.py lane); overnight goal 2026-10-21

## Acceptance criteria
- The round archive holds its README, signals.md and report.md: `test -f .sdlc/evals/rounds/2026-10-24-r13-pattern/README.md -a -f .sdlc/evals/rounds/2026-10-24-r13-pattern/signals.md -a -f .sdlc/evals/rounds/2026-10-24-r13-pattern/report.md`
- The round finished under the $12 cap: `jq -e '.stop == "done" and .cap == 12 and .totals.costUsd < 12' .sdlc/evals/rounds/2026-10-24-r13-pattern/round.json`
- The churn regenerates from the archive: `npm run -s eval:signals -- --round 2026-10-24-r13-pattern --against 2026-10-19-r12-targeted --min-samples 1`
- No earlier round archive changed: `git diff --quiet HEAD -- .sdlc/evals/rounds/`

## Outcome

2026-10-24 · lane: solo L2 · verdict: pass · verifier: verifier-L2 (sonnet) · base: 8c724c43552b
- Changed: Live round 13 measures the pattern wave against round 12: 69 Haiku runs, 52 pass, $0.67, failure clusters proposed as tickets
- Commits: none
- Check: 1 Round archive holds README, signals.md, report.md: pass
- Check: 2 Round finished under the $12 cap: pass
- Check: 3 Churn regenerates from the archive: pass
- Check: 4 No earlier round archive changed: pass
- Follow-up: note: report.md Process notes say the lane worktree .env was linked to... -> notes.md
