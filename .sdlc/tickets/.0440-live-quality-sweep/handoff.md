---
id: T-0440
title: "Live chat:probe sweep across personas after the 2026-10-22 changes"
type: spike           # feature | bug | chore | spike | idea
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
A live chat:probe sweep across every persona (croupier, quizmaster, mentalist, concierge, restaurant, travel, stylist and the builder interview) after the 2026-10-22 and 2026-10-23 changes (single pick as OptionDeck, quiz tap-commit, heading scale, say-claim repair) reports per persona pass or fail on the named checks plus a judgment of whether picks commit, with traces saved and any regression filed as a ticket proposal.

## Context
Kim approved live spend for this sweep 2026-10-24 (a few dollars). Runner and keys: .claude/docs/references/commands.md (chat:probe, the workspace key). Never read or print .env or keys.

## Constraints
Spend cap: about 5 USD total; Haiku 5.5 as the default model, one Sonnet pass on the two hardest personas. Record evidence under the ticket folder; a regression found becomes a proposed ticket text in the report, not a fix.

## Done when
A report table per persona with trace paths and costs; any regression has a reproducer (--from-trace replay) checked in when cheap.
- Lane: solo because size L2 (steps.py lane); overnight goal 2026-10-21

## Acceptance criteria
- `.sdlc/tickets/0440-live-quality-sweep/report.md` has one row per persona (croupier, quizmaster, mentalist, concierge, restaurant, travel, stylist, builder interview) with trace lines and cost, a pick-commit judgment, and total spend under 5 USD.
- Every probe run the table cites has `report.json` and `fixture.json` under `.sdlc/evals/rounds/2026-10-24-t0440-sweep/runs/`, and its ledger row carries the cost the table states.
- `npm run chat:probe -- --replay .sdlc/evals/rounds/2026-10-24-t0440-sweep/runs/pick-mentalist-answer-deck-haiku-1/fixture.json` exits 1 (the regression reproduces keyless).
- No product code changed: `git diff --name-only` and untracked files touch only `.sdlc/`.

## Outcome

2026-10-24 · lane: solo L2 · verdict: closed by reason (spike: live sweep measured, report and round archive committed; findings filed as T-0442 and T-0443) · verifier: none · base: b066d868331f
- Changed: see commits
- Commits: none
