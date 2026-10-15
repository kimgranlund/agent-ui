# Fleet retro, agent-ui, 2026-10-07

## Part 1: environment (commands run by me)
1. Plugin path in use: /Users/kimgranlund/.claude/plugins/cache/sdlc-lite/sdlc-lite/0.21.0 (holds scripts/tickets.py; collector reports version 0.21.0). The work ran on 0.20.5 and 0.20.11 until the reload today.
2. claude --version: 2.1.292 (Claude Code)
3. date: Wed Oct 7 05:52:03 PDT 2026. uptime: load averages 14.58 12.02 9.72, 16 users, 20 cpus (collector: load1 14.7).

Counts and costs below are from `fleet_collect.py collect . --since 2026-10-05` (output /private/tmp/claude-501/collect.json): 227 deduped runs, $931.58, 4 interrupted, 0 limit markers, 1 unmetered run.

## Part 2: findings, ranked by cost
| Symptom | Evidence | Mechanism | Cost | Mark | Prevention |
|---|---|---|---|---|---|
| Planning and plan review dominate spend | collector by_role: planner 37 runs $249.96, plan-reviewer 25 runs $186.48; plan_review_share 0.4685 | Full chain plans and reviews every ticket, including ones the solo lane later did cheaply | $436.44 of $931.58 | [V] | Keep size S/M on solo; plan review only for L4/L5 (0.20.11) |
| Full lane costs 3x the solo lane per run | collector by_lane: full 192 runs $710.87; solo 35 runs $220.71 | The lane script printed full for size L work; larger tickets also hold the most builder retries (no-barrels 13 builder, 10 verifier runs) | $710.87 vs $220.71 | [V] | Decompose size L before planning; record the lane reason up front |
| Verifier killed mid-run, then rerun | collector interrupted count 4 (includes a verifier L3, T-0018); log tail showed exit 137 | Heavy check gate run under parallel load; the session ended while the role was alive | 4 interrupted attempts, dollars none in collector | [V] count, [U] cause | Run one gate at a time (gate lock); rerun at L2 as done for T-0015 and T-0018 |
| Long heredoc Bash commands slowed every hook | Observed earlier this session (hooks super-quadratic on long heredocs); fixed upstream in 0.20.11 | block-* hooks scanned the full command text | none measured | [U] | Keep Bash commands under 2 KB, use Write for files (done) |
| Decisions waited on the user | Conversation: ADR ratifications (0232 to 0239), merge approvals, paid fixture call, .env access, seedVersion bump, budget raise | Policy: ADRs never self-ratified; publish and merge need AskUserQuestion | not collected; count none from the collector | [U] | Batch decisions into one /ask round per ticket set (done); pre-agree merge order |
| Solo role could not create branches or worktrees | block-stray-worktree hook denied the solo run (earlier T-0016 and T-0011 runs) | Hook forbids worktree creation inside a role | none measured | [U] | Conductor creates the worktree and branch first (current practice) |
| Parallel lanes limited by work and memory, not load | collector: load1 14.7 on 20 cpus; chromium 42 procs 19,413 MB RSS; claude 13 procs 6,717 MB; worktrees 19 / 1,276 MB; ready tickets now 0 (T-0007 closed as already landed) | The queue is empty, so extra lanes would idle; a browser-heavy gate under memory pressure killed a verifier (exit 137) | none | [V] load and counts, [U] memory link | Keep a ready queue before raising lanes; reap 14 dirty worktrees (stray .sdlc copies); reap orphan chromium |
| Faster: solo T-0019 to T-0021 via sub-agent and merge helper | collector solo role: 17 runs $118.60 | One session end to end plus an independent L1/L2 verifier; merge-seq helper waits on CI | solo $118.60 for 17 runs | [V] | Keep |

## Not checked by me
- Per-ticket wall-clock waits and dollar cost of user-blocked decisions [U].
- Whether the 4 interrupted attempts all share one cause [U].
