---
id: T-0423
title: "The r12 targeted eval report and the evals README state the corrected counts, baseline and ticket"
type: chore           # feature | bug | chore | spike | idea
status: done     # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L1             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-23
claimed_by: claude:a8ce3b21 2026-10-23
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
budget_usd: 5
---

## Goal
The r12 targeted eval report and `.sdlc/evals/README.md` state the facts the verifier found (14 of 45, the earlier live baseline, the ask ids per opening, the round's ticket), so the record no longer contradicts its own data.

## Context
From the 2026-10-23 notes triage (verified still true against main):
- notes.md:540: fix-now: `.sdlc/evals/rounds/2026-10-19-r12-targeted/report.md:39` "r11 14 of 53": the r11 denominator counts 8 plain opening "Deal" Buttons (r11 lines 21, 92, 101, 173, 177, 184, 252, 260, blackjack bet strips) that are not Deal again Buttons; under the same definition as the r12 44 it is 14 of 45. The 12 and 14 lone-Row counts are unchanged, as is the verdict.
- notes.md:541: fix-now: `report.md:33` "No earlier live baseline" for T-0363 is stale: `2026-10-18-t0362-smoke` (commit 1f6873fcae, before T-0363 merged in 6e347b8c2) ran mentalist and negotiator once each, both failing `no surface this turn updated holds GameHud` / `missing GameHud`, a 0 of 2 pre-fix baseline that strengthens "holds".
- notes.md:542: fix-now: `report.md:33` names `ask-1` for all six openings; :200 (`smoke-negotiator-first-offer-haiku-3`) pairs `hud-1` with `ask-2`.
- notes.md:543: decide: `.sdlc/evals/README.md:31` attributes r12 to T-0343: `run-capped.ts:526` `roundTicket` takes the first ticket id the round names and finds plan.ts's "(T-0343)" attribution in the generated `live-commands.sh` header (round.json names none). The fog record says T-0376. Same for the t0362-smoke row.

## Constraints
Records only; never rewrite a finished round's evidence (traces, verdicts), only the report prose and README row; if run-capped.ts roundTicket is wrong, fix it with a test.

## Done when
npm run check plus the touched folders' tests pass; no em dashes in added lines.
- Lane: solo because size L1 (steps.py lane); overnight goal 2026-10-21

## Conductor note
2026-10-23: the r12 report.md edits were reverted: a finished round archive is never rewritten (Kim's standing rule). Its three report errata (notes.md:540-542) stay recorded in notes.md; this ticket ships the roundTicket root-cause fix and the regenerated evals README.

## Outcome

2026-10-23 · lane: solo L1 · verdict: pass · verifier: verifier-L1 (opus) · base: 00837f149b62
- Changed: The eval round index reads a round's own ticket, not its generator's; notes follow-ups triaged
- Commits: none
- Check: 1 npm run check plus the touched folders' tests pass: pass
- Check: 2 no em dashes in added lines: pass
- Follow-up: note: .sdlc/runtime/tasks/0423-r12-eval-report-facts/0423-solo-L1.md... -> notes.md
- Follow-up: note: .sdlc/notes/notes.md the quoted em dashes in the travel persona... -> notes.md
