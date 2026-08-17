<!-- target-path: .claude/ops/peer-coordination.md -->
# Peer-session coordination — standing record

- **Charter**: the AGENT-UI session (host, `/lead-team` 2026-08-15) coordinates board work across
  concurrent peer sessions. Peers are separate host processes — NOT reachable by SendMessage;
  this file + the PR #924 thread + ADR-0005 claims ARE the coordination channel.
- **Roster (2026-08-15)**: AGENT-UI (coordinator; merges) · AUTHORKIT (estate-overhaul campaign,
  worktree `overhaul-2026-08-14`, locked) · UIBUILD-01 · UIBUILD-02.

## Standing lane protocol

1. **Claim before touching** (ADR-0005): assignee + dated claim comment on the issue; check
   `gh issue view N` for an existing claim FIRST. First claim wins; a stood-down lane says so
   on the record (zero salvage — see PR #924 thread, #925–#928 instance).
2. **Seats/peers never merge**: draft PRs only, session named in the PR body. AGENT-UI verifies
   (mergeable + gates evidence + Findings write-back) and merges serially, re-running
   `npm run check && npm test` on main between merges, judged by exit codes only.
3. **Owner rulings park, never build**: a decide-later issue gets an options+recommendation
   affordance comment with a `ruling: X` reply verb; whoever claims after the ruling executes it.
4. **Machine discipline**: foreground gates; stagger full `npm test` runs (concurrent suites
   poison each other — flaky-gates). Red on a loaded machine → isolate before believing it.
   Measured instance: 2026-08-15, load 30–52, three non-overlapping failing sets, all green
   in isolation.
5. **Residue**: each session reaps its OWN worktrees/branches after merge; nobody force-removes
   another session's worktree. Stale peer residue gets flagged here, not deleted.

## State (last updated 2026-08-15, post board-zero)

- Board: 0 open issues · 0 open PRs. Overnight tally: #917–#921 built+merged (PRs #919/#922/#923),
  W2 #925–#935 merged (PRs #939–#943, #946), W3 #936/#938 executed by peers, #937 closed-parked
  (reopen when claude-plugins#253 lands or Kim rules `ruling: B` on the issue).
- Residue: SWEPT CLEAN (Kim-authorized reconcile, 2026-08-15 ~03:0xZ): all 5 stale worktrees
  removed after PR-MERGED/content-equivalence verification (the overhaul worktree's ledger
  commit proven patch-equivalent on main via `git cherry` before removal); every non-main
  local and remote branch deleted (all PR-MERGED; feat/845 was CLOSED-superseded by PR #864).
  Repo state: 1 worktree (main), 1 local branch, origin/main only, working tree clean.
- Full-suite `npm test` on this host reds under fleet load (live claude sessions at 17-28% CPU
  each — no orphans to reap); per-file isolation runs are the reliable verdict. Most
  load-sensitive file: `a2ui/src/live-agent/produce-loop.test.ts` (2 loaded reds, 2 isolated
  greens) — a Mode-B bounded-wait suspect if it ever reds in isolation.
- Gate note on main: S9 exemplar sweep widened to skill references/ (commit 341fe63f) after the
  W2 extractions moved the cited tables.

## Lane split — 2026-08-16 (two hosts on one board)

- AGENT-UI (`agent-ui-team-lead`, Kim: "stop new tasks, complete the running ones") holds
  #954 #956 #964 #999 #1004 #1009 #1010.
- AGENT-UI-2 (`/goal` board-clear host, this note) claimed on-issue: #1000 (verify+close after
  #956 lands) · #1002 #1003 #1005 #1006 #1007 #1008 · #959 remaining slice; #1001 closed
  (repairs none-owed by construction). Each host ships its OWN lanes (push → PR → merge →
  verify MERGED → reap, never chained) and re-runs `npm run check` on main between merges.

## #956 n5 tail — 2026-08-17 (AGENT-UI host)

- PR **#1029** (`956-data-n5` @ b403e4fa+) carries the whole n5 tail (checker minors · size line-items +
  tree-shake probe · data-doc page · ADR-0192 consequences note). The peer's local `956-n5-tail`
  (worktree `w956`, one commit = the same minors as 401a1a9b, unpushed) is SUPERSEDED — peer may drop
  it. AGENT-UI finishes #1029 (open Major: `resource.dispose()` aborts the live leg; minors; stream
  browser shard) and merges; peer then verifies+closes #1000 per its own claim.
- Main full `npm test` showed 7 `ui-drill` wiring failures (`_page.ts` drill refs) at ~02:30Z — being
  checked by the AGENT-UI finisher; if real, fixed on the same PR or its own small PR.
- 2026-08-17 04:3xZ — AGENT-UI-3 (`/lead-team`, mobilize-chores + hygiene) joined. Docs wave split:
  AGENT-UI-2 ships #1042–#1046 (five `agent-*` worktrees on `104x-*` branches — do not touch);
  AGENT-UI-3 takes #1047–#1049 (claims released on-issue, same lane brief). Second merger on
  NAV/CARD_GROUPS/sitemap/llms/theme-fixture conflicts rebases keep-both + regenerates.

## Lane split — 2026-08-17 ~04:30Z (AGENT-UI-2 + AGENT-UI-3)

- AGENT-UI-2 (session "Complete work without permissions") holds #1042–#1046 (docs-writer lanes,
  5 worktrees under `.claude/worktrees/agent-*`, claimed 04:19Z).
- AGENT-UI-3 (`/lead-team` + sweep-chores host, this note) holds #1047–#1049 — handed over by
  AGENT-UI-2 at 04:26Z, re-claimed on-issue 04:29Z; three docs-writer lanes in isolated worktrees,
  branches `1047-testing-guide` · `1048-a2ui-producer-guide` · `1049-app-leftovers`.
- Each host ships its OWN lanes (push → draft PR → verify gates → merge → verify MERGED → reap);
  additive conflicts expected on `_page.ts`, `site/main.ts`, both sitemap.json, llms.txt, the
  theme-provider-built.css fixture — the SECOND merger rebases + regenerates; `npm run check` on
  main between merges, exit codes only.
- AGENT-UI-3 also runs this cycle's sweep-chores (issue-sorter · repo-cleaner · decision-watcher →
  chore-planner) and owns hygiene: stale local `956-*` branches / `origin/docs/subpath-coverage-gaps`
  (PR-MERGED verification before any deletion; peer worktrees never touched).
- **LAW (2026-08-17, Kim):** never call `mcp__ccd_session_mgmt__list_events` / `search_session_transcripts`
  on a peer session — each call raises an app-level grant card to Kim regardless of bypassPermissions
  (root-caused: those were the only grant-raising calls of the day). Peer state = on-issue claims, PR list,
  `git worktree list` + branch heads, this file. `list_sessions`/`get_session` metadata is fine.
