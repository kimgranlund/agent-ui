---
id: T-0174
title: "chat:probe: drive the real agent-admin chat headless (live or replay), assert on it, and turn any trace into a keyless replay test"
type: feature         # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P1         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-14
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
A closed loop for the live chat: an agent (or Kim) can run one persona turn sequence in the real agent-admin chat headless, live or replayed, get the trace, a screenshot and pass/fail assertions back, and turn any captured trace into a keyless regression. Kim 2026-10-14 chose "build it, live allowed" (live spends API credit).

## Intent
- Do:
  1. `npm run chat:probe -- --agent <preset id> --model <id> [--effort <level>] --say "<text>" [--click <action or button label>] [--say ...] [--replay <trace or fixture>] [--out <dir>]`. Build on what exists: the `e2e:admin` runner and fixtures (`scripts/e2e-admin/`), the dev proxy and trace log (T-0151, `.agent-traces`, `npm run traces`), the devtools replay transport. Boots its own vite on a free port (like `test:eval-catalog`), Playwright Chromium, the agent-admin page, picks the preset and model, plays the steps, waits for each turn to settle.
  2. Per turn it records: the trace id and line (from `.agent-traces`), the outcome, retries and codes, the surfaces rendered (ids and component types), a full-page screenshot, and the transcript text. Writes `<out>/report.json` plus PNGs, prints a short table.
  3. Assertions, each a named check, exit 1 on any fail: no halt; no A2UI JSON shown as prose text in the chat; every surface the model created in any round is present after self-correct (no silent loss); optional `--expect-component <Type>` (e.g. CardTable, BookingForm); the dogfood render lint rules run on the rendered surfaces (reuse the render-lint helpers); reasoning captured when thinking is on (warn-level until T-0172 lands).
  4. `npm run chat:probe -- --from-trace <trace id or 'last'>` converts a captured trace (the full model output per round) into a keyless replay fixture plus a test file under the e2e-admin or testkit home, so a live failure becomes a regression in one command.
  5. Live mode reads the key only server-side through the existing dev proxy; never prints or logs key values; trust boundary unchanged (ADR-0073: keys and produce() never enter devtools).
  6. Docs: one section in CLAUDE.md Commands and the e2e-admin README; local only, not a CI gate.
- Non-goals: fixing the producer bugs (T-0172 uses this tool); new admin UI.
- Done when: `npm run check` exit 0; a keyless selftest of the probe (replay a recorded fixture, all checks green; a seeded fixture with raw JSON in prose and one with a dropped surface each fail their named check) exits 0 and is wired into `check:scripts` only if it is fast (under 30s), else documented; one live smoke run against a cheap model (Haiku, one "hello" turn) succeeds and its report is in the ticket folder; `--from-trace last` produces a replay test that passes; `npm run e2e:admin` still exit 0.

## Context
- Kim's live failures to reproduce next (T-0172): Croupier "Black jack" then Deal on Sonnet 5 (PARSE then IDGRAPH halt), Croupier on Haiku 5.5 (A2UI JSON shown as prose, outcome ok), Concierge "hello" then a table booking on Sonnet 5 (IDGRAPH, retry dropped the ask-1 surface). Traces in `.agent-traces/2026-10-14.jsonl`.
- Commit on `chore/chat-probe-loop` off origin/main, never push. Heavy tests via `gate_lock.py run`, foreground; never idle on a monitor.

## Constraints
- Zero new dependencies (Playwright is already a dev dependency). Never print key values. No em dashes.

## Acceptance criteria
verifier: L3
- `npm run check` exits 0 (it now runs `node scripts/chat-probe.mjs selftest`, the fast DOM-free leg).
- `node scripts/chat-probe.mjs selftest` exits 0: green-button and recorded-haiku-hello replay offline with no failing check; seeded-json-prose fails `no-json-as-prose` and `no-surface-loss`; seeded-dropped-surface fails exactly `no-surface-loss`.
- `node scripts/chat-probe.mjs selftest --browser` exits 0 (the same four fixtures replayed in the real agent-admin page, same verdicts).
- `npx vitest run --project scripts scripts/e2e-admin/probe/replays/` exits 0 (the regression `--from-trace last` wrote from the live smoke trace).
- `python3 -c "import json,sys; sys.exit(json.load(open('.sdlc/chat-probe-loop/smoke/report.json'))['verdict'] != 'pass')"` exits 0 (the live Haiku 5.5 "hello" smoke on concierge; `turn-1.png` and `fixture.json` beside it).
- `npm run e2e:admin` exits 0.
- `grep -n "chat:probe" CLAUDE.md scripts/e2e-admin/README.md` exits 0 (the docs).
