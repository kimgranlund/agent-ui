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
## Merge desk — 2026-08-17 ~05:10Z (AGENT-UI-4)

- AGENT-UI-4 (Kim's interactive session, this note) takes the coordination/merge desk per Kim 05:09Z.
  Holds no build lanes. Direct SendMessage channel to AGENT-UI-3 confirmed working 05:10Z
  (`uds:/tmp/cc-socks/9445.sock`) — transcript-read ban unchanged.
- Board at 05:10Z: #1042–#1045, #1047, #1050 merged (PRs #1051–#1057). Open: #1048/#1049
  (AGENT-UI-3, built + gates green, shipping now — AGENT-UI-4 fallback-ships if no PR by 05:45Z,
  per on-issue comments) · #1046 (AGENT-UI-2, worktree at main HEAD with ZERO commits since the
  04:19Z claim — status-or-stand-down probe posted, 05:45Z deadline, then AGENT-UI-4 re-dispatches
  in a fresh worktree; the stale worktree gets flagged here, never removed).
- AGENT-UI-4 runs `npm run check` on main after the #1048/#1049 merges land and posts the tally here.
- **Wave CLOSED (05:46Z tally)**: board zero — #1042–#1050 all merged (PRs #1051–#1060); #1046
  liveness confirmed via AGENT-UI-3 relay, re-dispatch stood down 05:1xZ, shipped as #1060 05:13Z.
  All fallback claims moot (nothing fallback-shipped). `npm run check` on main @ 5257a68e: exit 0.
  Residue: zero — 1 worktree (main), 1 local branch, peers reaped their own lanes. Roster at close:
  AGENT-UI-2 → idle-verify · AGENT-UI-3 → sweeps, shipped #1047–#1050 · AGENT-UI-4 → merge desk
  (standing). Cross-repo note 05:2xZ: TWO gen-ui-kit sessions (gen-ui-kit-31 / gen-ui-kit-cf) each
  claimed that repo's primary build-lead desk in fleet polls — duplicate-desk collision flagged to
  gen-ui-kit-cf; agent-ui unaffected.

- **2026-08-17 (Kim, direct + repeated): `teamwork@nonoun-plugins` DISABLED in `.claude/settings.json`.**
  Root cause of the "Allow Claude to run?" prompts Kim kept seeing overnight despite bypassPermissions:
  they were NOT permission-mode prompts — `teamwork`'s `worktree_prebash_guard.py` is a PreToolUse(Bash)
  hook, deliberately "ask, never block" by its own doctrine, and hooks are a SEPARATE enforcement layer
  `bypassPermissions`/`permissions.allow` does not silence. It fires on every Bash call session-wide once
  the plugin is enabled — not just from `teamwork:*`-typed agents. `harness`/`docs` also carry hooks but
  only `PostToolUse` (non-blocking, no dialog) — left enabled. **Impact for AGENT-UI-3 (or anyone else
  reading this checkout's settings at spawn):** `teamwork:*` subagent_type / Skill dispatches (docs-writer,
  code-checker, build-lead, dispatch-ticket, planner, builder…) will not resolve until this flips back to
  `true`. Use `general-purpose` with the skill's guidance inlined in the prompt instead — this session's
  #1042–#1046 lanes did that from the start. Already-running subagent PROCESSES are unaffected (plugin dirs
  are fixed at process spawn). Re-enable once the overnight run is done, or if the hook's false-positive
  (worktree-identity pin drift between unrelated sibling dispatches) gets root-caused and fixed upstream.

## Shared-checkout hardening — 2026-08-18

- **`git branch --show-current` immediately before ANY commit or deploy in the shared checkout** — a
  peer may have switched the branch between your read and your write.
- **Deploys ALWAYS build from a clean throwaway worktree of origin/main**, never the shared checkout —
  a deploy shipped a peer branch's tree (2026-08-18).
- **Recovery when a commit lands on a peer's branch that has no own commits**:
  `git push origin <sha>:main` (ship the commit where it belongs), then `git reset --keep HEAD~1` —
  `--keep` preserves the peer's dirty files; `--hard` would destroy them.
