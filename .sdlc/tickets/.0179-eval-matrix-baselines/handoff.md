---
id: T-0179
title: "Agent eval framework 4: live matrix (personas x models x efforts x N) under a $5 cap, baselines, pass-rate floors, digest-affected selection"
type: feature         # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: [T-0176, T-0163]  # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
Before a prompt or content change lands, the live matrix shows whether behaviour got better or worse, within a fixed spend.

## Intent
- Do:
  - `npm run eval:matrix -- [--personas ...] [--models ...] [--efforts ...] [--samples 3] [--max-usd 5]`: plans the cells, estimates cost first, runs in priority order (regressions, then smoke, then capability), stops at the cap (Kim: $5 per run), reports coverage.
  - Baselines: `--save-baseline <name>` stores per-cell pass rates and metrics; a run compares against the latest baseline and fails a cell that drops below its floor (pass rate floor per tag, e.g. smoke 0.9 over N samples) or regresses more than a set delta.
  - Affected selection: with T-0163's bundle digests, `--affected` runs only scenarios whose persona bundle digest changed since the baseline.
- Done when: `npm run check` exit 0; a keyless test of planning, cap stop and baseline comparison on a fixture store; one live matrix run (2 personas x Haiku and Sonnet x 3 samples) under $5 with a saved baseline; documented.

## Context
- Builds on T-0176 store and runner, T-0163 compiler digests. Commit off origin/main, never push.

## Constraints
- Never exceed the cap; zero new dependencies. No em dashes.

## Outcome

2026-10-17 · lane: full L2 · verdict: closed by reason (Covered or superseded by the 2026-10-17 eval re-scope (live rounds, run-capped, replays); remaining work in the new eval-signals and eval-smoke-scenarios tickets and T-0178) · verifier: none · base: none
- Changed: see commits
- Commits: none
