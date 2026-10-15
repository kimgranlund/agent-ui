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
