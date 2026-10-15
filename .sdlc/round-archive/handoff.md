---
id: T-0241
title: "Live rounds archive their traces, payloads and spend ledger automatically"
type: feature        # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P1         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-15
router: .sdlc/AGENTS.md  # how to claim and close this ticket
---

## Goal
Kim's ruling (2026-10-15): every live test round keeps all traces, payloads and ledgers so they can be analyzed later. A round run through the capped runner leaves a complete, self-describing archive without the conductor copying files by hand.

## Scope
- `scripts/e2e-admin/probe/run-capped.ts` (T-0225): at the end of a round (and on a cap stop or crash), write into the round folder:
  - `traces/`: exactly the `.agent-traces` lines whose timestamp falls in the round window (`runs/.capped-start` to the end), per day file;
  - `ledger.jsonl`: one line per run with scenario, model, start and end time, exit code, verdict, the trace line range, token usage summed from those lines, and the estimated cost at the PRICES table;
  - `round.json`: the round manifest (commit sha, live-commands file, cap, price table source, totals).
- `runs/` already holds report.json, fixture.json and turn screenshots; keep screenshots on disk and out of git (the round's .gitignore), and say so in round.json.
- Durable home: the round folder in the main checkout (`.sdlc/<round>/`), since lane worktrees are reaped. Document where an archive lives and how to load it in `scripts/e2e-admin/README.md` (Live rounds) and the closed-loop SPEC CL-R7.
- T-0239's trace fields (sections, mini-skills, load modes) land in the same trace lines once that ticket merges; the archive needs no change for them.

## Evidence
Rounds 1 and 2 kept traces only in git-ignored worktree folders and the spend ledger in a /tmp runner log; the conductor backfilled `.sdlc/croupier-closed-loop/`, `.sdlc/live-round-2/` and `.sdlc/composite-moment-checks/` (`traces/`, `runs/`, `runner-ledger.log`) by hand on 2026-10-15.

## Done when
- run-capped.test.mjs: fake traces across the round window produce `traces/`, `ledger.jsonl` and `round.json` with the right line ranges and totals; lines outside the window are excluded.
- A cap stop still writes the archive.
- npm run check plus scripts/e2e-admin tests exit 0.

## Acceptance criteria
- `npx vitest run --project scripts scripts/e2e-admin/probe/run-capped.test.mjs` exits 0: the `archive` cases cover window filtering (lines before `since` and after the end excluded, no empty day file), per-run 1-based line ranges, token and cost sums, `round.json` totals equal to the ledger, a cap stop (`stop: cap`), a restart keeping earlier ledger rows, and a crash (`stop: crash`).
- `npx vitest run --project scripts scripts/e2e-admin/` exits 0.
- `npm run check` exits 0.
- `scripts/e2e-admin/README.md` Live rounds and `.claude/docs/spec/agent-closed-loop.spec.md` CL-R7 say where the archive lives (`.sdlc/<round>/` in the main checkout) and how to load it.

## Scope addition (Kim, 2026-10-15): an entry file per round folder
- The runner also writes `README.md` in the round folder: what the round was (scenarios, models, cap, commit, window, totals), then one entry per file and folder present (`traces/`, `ledger.jsonl`, `round.json`, `runs/<run>/report.json`, `fixture.json`, `turn-<n>.png`, `live-commands.sh`, `report.md` when present), each with its provenance (which script or step wrote it, from which source, when, at which commit) and how to read it (the fields that matter, a jq line or two, how to replay a run keylessly with `npm run chat:probe -- --replay`, how a ledger row points into `traces/` by line range, and that screenshots are git-ignored). Regenerated with the rest of the archive.
- A `--describe <round dir>` mode writes only that README for an existing folder, inventorying what is actually there (so it never claims a file that is absent). Run it on the three backfilled folders in the main checkout: `.sdlc/croupier-closed-loop/`, `.sdlc/live-round-2/`, `.sdlc/composite-moment-checks/` (they hold `traces/`, `runs/`, and a `runner-ledger.log` instead of `ledger.jsonl`; describe that file as the hand-copied runner log from 2026-10-15). Write those three READMEs as files in the main checkout; do not commit them from the lane, and say where they are.
- Done when: a run-capped test asserts the README lists every file the archive wrote and none it did not; `--describe` on a fixture folder lists exactly its contents; npm run check plus scripts/e2e-admin tests exit 0.
- `npx vitest run --project scripts scripts/e2e-admin/probe/run-capped.test.mjs` also covers the scope addition: the `README` cases assert the archive's README names exactly the files the archive wrote, and `--describe` on a backfilled fixture folder names exactly its contents (no `round.json`, `ledger.jsonl`, `live-commands.sh` or `report.md` claimed when absent).

## Scope addition 2 (Kim, 2026-10-15): one home for all test rounds
Kim chose `.sdlc/evals/rounds/` (an allowed top-level `.sdlc` dir per `.sdlc/AGENTS.md`) and moving the existing rounds now.
- Layout: `.sdlc/evals/rounds/<YYYY-MM-DD>-<slug>/` holding `README.md`, `round.json`, `ledger.jsonl`, `live-commands.sh`, `report.md`, `traces/`, `runs/<run>/`; plus `.sdlc/evals/README.md`, a generated index with one row per round (date, ticket, agents, models, runs, pass, spend when known, link), and `.sdlc/evals/fog/` reserved for context-fog-of-war exports (T-0239). Screenshots stay git-ignored (`.sdlc/evals/rounds/*/runs/*/*.png`); JSON, traces and ledgers are committed.
- The runner writes a new round straight into `evals/rounds/<date>-<slug>/` (a `--round <slug>` flag; date from the round start) and regenerates the index. `round.ts` emits `--out` paths under that folder.
- Move the committed rounds with `git mv` in this lane: `.sdlc/croupier-closed-loop/{report.md,live-commands.sh,runs/}` to `evals/rounds/2026-10-14-r1-croupier/`, `.sdlc/live-round-2/{report.md,live-commands.sh,runs/}` to `evals/rounds/2026-10-15-r2-presets/`, and whatever T-0208 committed under `.sdlc/composite-moment-checks/` (live-probe.md as report.md, live-commands.sh, runs/) to `evals/rounds/2026-10-15-t0208-probe/` if it is on main by the time you rebase (otherwise leave a note). Each ticket handoff that owned a round keeps a one-line `Round: .sdlc/evals/rounds/<id>/` pointer. Regenerate `live-commands.sh` paths and fix every repo reference to the old paths (`git grep` for `croupier-closed-loop/runs`, `live-round-2/`, `composite-moment-checks/runs`, report.md paths in docs, README, SPECs, scenario tests). Replay fixtures under `scripts/e2e-admin/probe/replays/` stay where they are.
- The untracked backfilled copies in the main checkout (`traces/`, untracked `runs/` screenshots, `runner-ledger.log`, the three READMEs) are the conductor's to move after merge; list the exact `mv` commands in your report.
- Done when: a test asserts the runner writes under `evals/rounds/<date>-<slug>/` and regenerates the index row; `git grep` finds no stale path to the old run folders outside closed-ticket history; the index lists the three rounds; npm run check plus scripts/e2e-admin tests exit 0.

## Acceptance criteria (scope addition 2)
- `npx vitest run --project scripts scripts/e2e-admin/probe/run-capped.test.mjs` exits 0: the `evals home` case asserts `--round <slug>` writes under `.sdlc/evals/rounds/<date>-<slug>/`, reuses that folder on a restart, and regenerates the `.sdlc/evals/README.md` row.
- `git grep -n -E "\.sdlc/(croupier-closed-loop|live-round-2)/(runs|report\.md|live-commands\.sh)" -- ':!.sdlc/round-archive/handoff.md' ':!*.dispatch.json'` exits 1 (no stale path to the old run folders).
- `.sdlc/evals/README.md` lists the committed rounds (2026-10-14-r1-croupier, 2026-10-15-r2-presets); T-0208's round joins when that ticket lands on main.
