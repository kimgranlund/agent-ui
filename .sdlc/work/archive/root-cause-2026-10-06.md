# Root-cause report, agent-ui, 2026-10-06

Evidence first. [V] verified by a command or log line, [U] unverified or inferred.

## 1. Load limits
- [V] Machine: `sysctl` 20 logical CPUs = 16 performance + 4 efficiency. Load sampled 6 to 24; the stop line of 40 was never reached.
- [V] Per-process snapshot (`ps -axo pcpu`): agent-ui processes were 2% of CPU in total. Roles wait on the model API. Spikes come from gates and other sessions: maison sessions about 212%, Chromium test runs about 180%, `fseventsd` 100% (file-watch churn, many worktrees) [U on the cause], about 57 `claude` processes about 340%.
- [V] Runaway hooks: `block-pattern-kill.sh`, `block-stray-worktree.sh`, `block-disk-scan.sh` each at about 100% CPU for 30+ s, parent a solo run for another project (pid 49913). The author reproduced it: 0.24 s at 1 KB, 8.8 s at 4 KB, over 40 s at 8 KB of heredoc. Three cores per Bash call. My own long heredocs trigger the same.
- [V] Gate durations from logs: a2ui `src` vitest 841 tests, 11.4 s; site jsdom suite about 54 s; CI full jsdom suite about 5 minutes. `npm run check` measured with `/usr/bin/time -l`: 40.4 s wall, 39.9 s user + 9.4 s sys (about 1.2 cores average), peak RSS 1.38 GB, exit 0. So a check costs roughly one core for 40 s; the heavy phases are `npm test` (CI about 5 min) and the browser shards [U, not timed here].
- Sane ceiling [U]: count heavy gates, not lanes. Idle lanes cost about nothing, so 8 or more role lanes are fine. Cap concurrent heavy gates machine-wide at 2 (full `npm test`, browser shards, `tsc`). Needs a shared lock across sessions; a per-repo cap cannot see other repos.

## 2. Friction and CI, with mechanism
- [V] #1826 CI red, local green: `state-grammar-gates.test.ts` runs only in `npm test`; step verifiers ran `npm run check`. Prevention: the last step of a chain runs `npm test` once.
- [V] Deploy failed after #1824 (run 37413639124, Cloudflare error 10021, "fs-shim: no bundled directory listing"): esbuild dropped the bare effect-only import of `worker/process-shim.ts`. No gate loaded the Worker bundle; the deploy was the first test. Fix #1828 added `worker-bundle.test.ts` (dry-run bundle load).
- [V] ADR number collision: T-0012 and T-0014 both took ADR-0235 in sibling worktrees. No allocator; found by a plan reviewer by luck.
- [V] Rebase conflicts only in generated or shared lines: `site/public/adr-index.json`, the `check:scripts` chain in `package.json`, the SPEC version header. Regenerate, never merge by hand.
- [V] Repo disallows auto-merge; marking a draft ready re-runs CI (cost, and it blocks the merge until green).
- [V] The earlier `npm run size` was red at base before the barrel work; the 801 B overage on the demo-only `all` row came from gzip reacting to import order (1.9 KB spread measured by the builder).

## 3. Stalls and restarts, by class
- 429 session limit [V]: `plan-reviewer-L1-2.log` has `api_error_status 429`, "resets 1:40pm". `run.sh` exits 1 with no resume marker. Prevention: `run.sh` detects 429, records the reset time, and the conductor schedules the rerun.
- Permission prompt stall [V]: `planner-L3-3.log` shows a denied `rm` (`user-rejected`). Prevention: planner briefs say `git rm` or leave deletions to the builder.
- 12 planner results and 5 plan reviews for no-barrels [V counts]. Mechanisms [V]: specgate flagged 13 duplicate criteria; scope allow-lists omit paths widened earlier, because guards diff against the base commit, so steps 5, 6, 7 and 8 each blocked once; `split --only` runs guards and refuses a red guard when the tree already holds the work; a step written before the ADR was ratified. Prevention: generate criteria and allow-lists, inherit widenings automatically, and have the planner dry-run its guards for green at base.
- Stale lanes [V]: T-0003 step 3 blocked because the lane predated #1805, #1806 and #1819; T-0014 had to resync twice. Handled by the manual route; the stale-lane route exists from 0.20.9.
- My errors [V]: three role runs started detached with `&` (untracked), a missed finished notification for hours, widen applied but never confirmed (step 7 fail). Prevention: confirm exit output of every `widen`; never background without tracking.
- `steps.py swap` refused a swap whose old/new text lacked the `(guard)` prefix match [V]; fell back to widen.

## 4. Other insight (cost and duration from `runs.jsonl`, deduped by attempt_id, 193 runs, $787)
- By role [V]: planner 37 runs $250 (avg 20 min); plan-reviewer 25 runs $186 (10 min); builder 53 runs $181 (7.8 min); architect 9 runs $101 (19 min); verifier 47 runs $59 (3.3 min); filer 16 runs $5; solo 4 runs $4.4.
- Planning plus plan review is 55% of spend; builders 23%; verifiers 7.5%. Plan review value [V]: it found real defects (vacuous loader scenarios, no typecheck between steps, ADR renumber, #1828 dependents) but also repeated "builder readiness" findings on L-size plans that a builder resolves by reading code. Suggestion [U]: review only L4 and L5 steps; turn readiness findings into builder notes.
- Solo vs chain [V data, U comparability]: T-0004 padding solo $2.69, 712 s, plus an L3 verifier $4.45; chain M tickets cost $33 (dogfood), $46 (persona manifest). Sizes differ, so this is indicative only.
- Lane script [V]: printed `solo` for S and M, `full` for L; I overrode to solo for T-0015, T-0016 and T-0011 on the user's preference. Three solo-L data points are in flight.
- specgate [V]: mechanical duplicate-criterion refusals twice (13 and 3 findings); a planner self-check would remove them.
- Board and budget gate: not used in this run [V].
