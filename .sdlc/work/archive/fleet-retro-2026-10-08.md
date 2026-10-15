# Fleet retro, agent-ui, 2026-10-08

## Part 1: environment (commands run by me)
1. Plugin path in use: /Users/kimgranlund/.claude/plugins/cache/sdlc-lite/sdlc-lite/0.21.3/scripts (holds tickets.py). The lanes this session were dispatched on 0.21.0 to 0.21.2.
2. claude --version: 2.1.294 (Claude Code)
3. date: Thu Oct 8 06:04:32 PDT 2026. uptime: load averages 6.73 6.07 5.37, 15 users.

Collector: `fleet_collect.py collect . --since 2026-10-07` (output /private/tmp/claude-501/collect2.json): 8 runs, $0.4841, 97.9 s, 6 unmetered, 0 interrupted, 0 limit markers, plan_review_share 0.0, chromium 45 procs 10,129 MB, claude 8 procs 6,348 MB.
The collector covers only runs it can meter; this session's sub-agent lanes (about 20 solo and verifier runs) are mostly in the 6 unmetered. I quote no dollar figure beyond the collector's.

## Part 2: findings, ranked by cost

| Symptom | Evidence | Mechanism | Cost | [V] or [U] | Prevention |
|---|---|---|---|---|---|
| Verifier base sha was the build commit, so a diff against it is empty | `dispatch.py prepare verifier` printed `Base sha: <HEAD>` for T-0022, T-0023, T-0026 to T-0032 lanes (this session, 8 times) | prepare reads the current HEAD after the solo committed, not the pre-build commit; I corrected it by hand in each prompt | about 1 extra tool call per verifier; a wrong verdict if missed | [V] | record the pre-build sha in the solo dispatch file and have prepare read it |
| Verifier fails on small, mechanical misses cost a full second verifier | T-0025 (missing-file message), T-0034 (2 em dashes), T-0032 (scope too wide) | solo's own checks skip the project rule list (em dashes, negative control for the missing case) | 3 extra verifier runs and 3 solo rework sends, cost not in the collector | [U] cost, [V] count | have the solo run a `git diff | grep` em-dash check and a missing-input negative control before reporting verify: needed |
| Lanes cannot see untracked `.sdlc/`, so `fanout.py run` refused | `fanout.py run --dry-run` exit 2: "not committed ... lanes see only committed files" (T-0024 to T-0026) | `.sdlc/` is untracked by decision, and the lane worktrees are cut from a commit | one dry run plus one user question | [V] | let fanout copy untracked task folders into the lane, as the sub-agent route does by hand (`cp -r .sdlc/<slug>`) |
| Tier names changed mid-session (S/M/L to L1/L2/L3), so my lane script broke twice | `solo_run.py run --tier L2` rejected on 0.21.1 ("choose from L, M, S"), then `sdlc-lite:solo-M` disappeared on 0.21.2 | plugin upgrades landed while lanes were running; the cache served different versions per call | 2 failed lane creations and a rebuilt helper script | [V] | pin one plugin version per session and print the accepted tier names in `solo_run.py --help` |
| `dispatch.py record` kept the first result file and I reran verifiers under new names | `verifier-L2-2.md`, `verifier-L1.md` (T-0025, T-0032, T-0034) | a failed verdict is recorded, then a second prepare creates `-2`; the next-action script read the task dir, not the step | none measured | [U] | none |
| Sub-agent idle notices repeat the same result, so I re-read long reports | the duplicate idle notices for T-0022, T-0024, T-0030 reports | each stop notifies again with the full text | tokens, unmeasured | [U] | send a one-line result in the idle notice and keep the long report in the file |
| Solo lane for size M and S went through solo without a planner or plan review | collector plan_review_share 0.0 for 2026-10-07 onward; last retro had it at 0.4685 | solo is the default lane for small tickets; plan review only for L4 and L5 | previous retro: planning plus review $436.44 of $931.58; this window cannot be compared (6 of 8 runs unmetered) | [U] | keep |

## Not checked by me
- Per-ticket wall-clock and dollar cost of the sub-agent lanes (unmetered in the collector).
- Whether the `1 error during load` after `/reload-plugins` is the plugin or an MCP server.
- Decisions that waited on the user: about a dozen AskUserQuestion rounds this session (merge, ratify, branch cleanup, Haiku choices); none stalled a lane beyond one reply. [U] for wall-clock.
