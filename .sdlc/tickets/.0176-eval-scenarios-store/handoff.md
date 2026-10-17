---
id: T-0176
title: "Agent eval framework 1: scenario format, replay in CI, runs.jsonl signal store, 15 persona smoke scenarios"
type: feature         # feature | bug | chore | spike | idea
status: done        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L3             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P1         # P1 | P2 | P3
depends: [T-0174, T-0181]  # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
First piece of the agent eval framework Kim approved 2026-10-14 (order: scenarios and run store first; live cap $5 per run). Use cases are data files; one runner (chat:probe) plays them live or replayed; every run writes one signal row.

## Intent
- Do:
  1. Scenario format: `scenarios/<persona>/<id>.scenario.json` (pick the home beside `scripts/e2e-admin/probe/`), with a JSON schema and validator: id, persona, models[], efforts[], tags[] (smoke, regression, capability, persona-rules), steps[] (say, click, fill, wait), per-turn expectations (no-halt, no-json-as-prose, no-surface-loss, expect-component, data-model assertions by JSON pointer, render-lint), optional replay fixture per model. Fold the existing e2e:admin scenarios and the T-0174 replays into the format, or adapt them, rather than keep two formats.
  2. Runner: `npm run eval:scenarios -- [--tag smoke] [--persona croupier] [--model haiku-5-5] [--live] [--samples N] [--max-usd 5]` built on chat:probe. Replay is the default and keyless; `--live` hard-stops at the cap (default $5, Kim) using token usage and the price table already used for traces, and reports coverage.
  3. Signal store: every scenario run appends one row to `.agent-evals/runs.jsonl` (git-ignored, like `.agent-traces`): run id, time, scenario, persona, model, effort, mode, sample, prompt bundle digest when available (T-0163 adds it; until then the assembled-prompt digest), each check result, retry count and codes, tokens in/out, cost estimate, latency and time to first token, links to trace id and screenshots. Document the row schema.
  4. `npm run eval:signals` prints the aggregates from the store: pass rate per scenario x model, flaky (mixed) cells, failure-code histogram, retry rate and retry-surface-loss rate, cost and latency per turn.
  5. Seed 15 smoke scenarios, one per preset persona, each one or two turns, plus the three regressions from Kim's 2026-10-14 failures (Croupier Haiku, Croupier Deal, Concierge booking) tagged regression; regressions that stay red until T-0172 lands are marked `expectedFail: T-0172` so CI stays green and flips when fixed (a fixed expectedFail must fail the run, so the mark gets removed).
  6. CI: replay mode of the smoke and regression tags rides `npm test` (or a check:scripts leg if fast); live never runs in CI.
- Non-goals: report page (T-0177), judge (T-0178), matrix and baselines (T-0179).
- Done when: `npm run check` exit 0; scenario schema validator rejects a seeded bad scenario; `npm run eval:scenarios` (replay, all) exit 0; a live smoke of 2 personas on Haiku stays under its cap and writes rows; `npm run eval:signals` prints the aggregates from those rows; docs in CLAUDE.md Commands and the e2e-admin README.

## Context
- Builds on T-0174 (`npm run chat:probe`, `--from-trace`), T-0151 traces, e2e:admin fixtures, `eval:agent-behavior` (fold its useful legs in or link). Keys only through the dev proxy (ADR-0073). Commit off origin/main, never push; heavy tests via `gate_lock.py run`, foreground.

## Constraints
- Zero new dependencies. Never print keys. No em dashes.

## Outcome

2026-10-17 · lane: full L3 · verdict: closed by reason (Covered or superseded by the 2026-10-17 eval re-scope (live rounds, run-capped, replays); remaining work in the new eval-signals and eval-smoke-scenarios tickets and T-0178) · verifier: none · base: none
- Changed: see commits
- Commits: none
