# Fleet retro, agent-ui, 2026-10-09

## Part 1: environment (commands run by me)
1. Plugin path: /Users/kimgranlund/.claude/plugins/cache/sdlc-lite/sdlc-lite/0.22.1 (holds scripts/tickets.py). This round's lanes ran on 0.22.0 after a mid-run `/reload-plugins`; 0.22.1 loaded afterwards.
2. claude --version: 2.1.294 (Claude Code)
3. date: Fri Oct 9 00:40:46 PDT 2026. uptime: load averages 11.09 9.06 9.01, 19 users.

Collector: `fleet_collect.py collect . --since 2026-10-08`: 14 runs deduped, $0.00, 14 unmetered (8 solo, 6 verifier), 0 interrupted, 0 limit markers, plan_review_share null, ci skipped, chromium 49 procs 11,282 MB, claude 7 procs 6,837 MB, 3 worktrees 184 MB. Every dollar figure below is "unmetered"; I quote none.

## Part 2: findings, ranked by cost

| Symptom | Evidence | Mechanism | Cost | [V] or [U] | Prevention |
|---|---|---|---|---|---|
| Sub-agent lanes are invisible to the cost collector | collector `runs.unmetered` 14 of 14, `cost_usd` 0.0 | sub-agent solo and verifier rows are written unpriced; I ran `dispatch.py record --transcript` for verifiers but the solo rows were never priced with `fanout.py land --transcript` or `solo_run.py complete` | unmeasured (all 14 runs) | [V] | have `record` and the solo idle path price the row from the transcript automatically |
| My lane helper broke on a version bump and on spawn names | `/private/tmp/claude-501/mk-lane.sh` still pins 0.21.2; spawn denied once: "no dispatch record for 'solo-L1-flagship-rerecord'" | helper hard-codes the plugin path and the old `solo-L1-<slug>` names; 0.22.0 uses `<ticket>-solo-L1`; `solo_run.py` also made a nested worktree when another solo was live | 3 failed spawns or re-prepares, about 5 minutes | [V] | have `solo_run.py` print the final spawn JSON and honor `--no-worktree` when a lane tree already exists; no plugin change needed for the path pin (mine) |
| Verifier base sha was the build commit on 0.22.0 | `prepare verifier` printed `Base sha: d1120019` for T-0054 and T-0056 though the pre-build sha was 39921d40 | solo with a pre-made worktree: the first dispatch sha is the lane's HEAD after the solo committed; peer notes said T-0366 fixed it | 1 prompt correction per verifier, 2 occurrences | [U] (T-0058 and T-0059 printed the right sha; I did not confirm what changed) | 0.22.1 base-sha rule (T-0381/T-0382) should cover it; recheck on the next lane |
| Handoff em-dash grep counts Kim's unrelated local commit | solo reports for T-0055, T-0056, T-0057: `git diff origin/main HEAD \| grep -c '—'` gave 3 to 29 | the criterion diffs against `origin/main` while local main carries an unpushed handoff commit | 3 solo reports plus 3 verifier notes; no rework | [V] | write the grep against the build commit (`HEAD~1`), not `origin/main` |
| Fleet nudges about "2 queued" with nothing queued | 4 peer messages 2026-10-08/09; `.sdlc/AGENTS.md` shows ready 0, proposed 0; `gh pr list` and `gh issue list` empty | the fleet monitor counts something other than ready or proposed tickets (cause unchecked) | 4 conductor turns | [U] (source of the "2" not checked) | show which tickets the "queued" count names |
| Solo plus L1/L2 verifier was the cheap path for every ticket | 6 tickets T-0054 to T-0059, no planner, no plan review, no replan; each merged first try after one verifier | lane `solo` default for size S and M | unmeasured (14 runs unmetered) | [U] cost, [V] count | keep |
| Idle notices carry the full report twice | 6 teammate idle notifications, each repeating the solo or verifier result, then a second read of the file | each stop notifies with the whole report | tokens, unmeasured | [U] | send a one-line result in the idle notice, keep the report in the file |

## Not checked by me
- Wall-clock per ticket and any dollar cost of the 14 runs (unmetered).
- Why the fleet monitor counts 2 queued lanes.
- Whether the `mcp` brand-design disconnect after `/reload-plugins` came from the plugin or the host.
