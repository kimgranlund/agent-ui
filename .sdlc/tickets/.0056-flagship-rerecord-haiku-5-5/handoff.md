---
id: T-0056
title: "Re-record the flagship tic-tac-toe match on claude-haiku-5-5 (one paid run)"
type: chore
status: done
size: L1
priority: P3
depends: []
created: 2026-10-08
router: .sdlc/AGENTS.md
---

## Goal
`packages/agent-ui/a2a/corpus/.../flagship.match.jsonl` (the committed flagship transcript, Sonnet 5 as X vs Haiku 4.5 as O) predates the Haiku 5.5 default. `run-flagship.ts` already sets `SEAT_O_MODEL = claude-haiku-5-5` (T-0030). Kim approved ONE paid run on 2026-10-08 (cost: a few cents, mostly the Sonnet 5 seat; hard cap 1 USD).

## Intent
- Do: run `npx tsx packages/agent-ui/a2a/tools/arena/run-flagship.ts` exactly ONCE (no retries beyond one rerun if the process fails before any model call) from the worktree; read the API key only through the repo's existing key helper path that script already uses (process.env or repo-root .env): never print, log, echo or commit the key or any request header; the script writes `matches/flagship.match.jsonl` only if the transcript validates and the isolation gate is clean: if it refuses, report why and stop (no second paid attempt without asking); then update everything that names the old recording: the label 'Flagship (Sonnet 5 vs Haiku 4.5)' in `site/pages/a2a-tic-tac-toe.ts` (~line 50), the T-0030 comment in run-flagship.ts, `a2a/corpus/demo/v0_3_0/a2a.jsonl` and `a2a/tools/corpus/seeds.ts` if they embed the old transcript (use the repo's corpus regeneration flow, never hand-edit generated corpus), and update `packages/agent-ui/a2a/src/arena/fixtures.test.ts` expectations only if the new match legitimately differs (report what changed: winner, move count, tokens); also check `packages/agent-ui/components/src/controls/status-stream/status-stream.browser.test.ts` which names the flagship match.
- Non-goals: other recordings, persona behavior, any second paid run, committing the key.
- Done when: `npm run check` and full `npm test` (--maxWorkers=4) exit 0; the a2a tests and the site tests that load the match pass; the label names Haiku 5.5; report the exact cost if the run prints token counts. Before reporting run `git diff origin/main HEAD | grep '^+' | grep -v '^+++' | grep -c '—'` and expect 0 for added lines.

## Context
Kim approved this on 2026-10-08 ("do 1, 2, 3, 4"). Run everything in the foreground (never wait on a background monitor); `timeout` is not installed; machine load can be high, so use `--maxWorkers=4` and rerun a load-only timeout alone. Judge gates by exit code; never hand-edit generated files. Other tickets running in parallel own disjoint files.

## Constraints
Imports point inward only. Commit locally in the worktree; no push or PR.

## Acceptance criteria
1. The Do items are met and the evidence commands show it.
2. Gates in Done when are green; no em dashes added.

## Closed

2026-10-08: Merged in #1873
