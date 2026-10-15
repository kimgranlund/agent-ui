---
id: T-0178
title: "Agent eval framework 3: judged checks with a pinned judge model, rubrics per persona, seeded known-bad transcripts"
type: feature         # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: [T-0176]    # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
Checks that need judgement (persona voice, game rules followed, asked before acting, answered the question) run as scored, reproducible signals, and the judge itself is tested.

## Intent
- Do:
  - A `judge` expectation type in the scenario format: rubric id, threshold. Rubrics as data per persona or capability (e.g. blackjack rules: dealer stands on 17, natural pays 3:2, bankroll arithmetic; concierge: confirms before booking).
  - Judge runs through the dev proxy with a pinned model and temperature, returns per-criterion scores with quoted evidence; results go into the run row.
  - Calibration: seeded known-good and known-bad transcripts per rubric; `npm run eval:judge -- selftest` must score bad below threshold and good above, live only (keyed), and is counted against the $5 cap.
  - Deterministic first: any rule checkable from the data model or surface (bankroll after a hand, card totals) is a deterministic check in T-0176 format, not a judge.
- Done when: `npm run check` exit 0; judge selftest live run passes and its cost is reported; three persona rubrics (croupier, concierge, quizmaster) with calibration sets; documented.

## Context
- Keys server-side only (ADR-0073). Commit off origin/main, never push.

## Constraints
- Zero new dependencies. No em dashes.
