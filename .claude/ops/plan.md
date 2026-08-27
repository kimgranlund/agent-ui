<!-- target-path: .claude/ops/plan.md -->
# Ops plan — agent-ui

- **Dispatch**: 2026-08-27T18:00:00Z sweep firing (chore-planner, three-seat sweep per
  `/teamwork:mobilize-chores` → `harness:sweep-chores`; no repo-local `harness/` tree, so this
  firing planned from durable ops state directly). Judged the three fresh seat reports attached to
  this dispatch (issue-sorter, repo-cleaner, decision-watcher) plus the prior plan
  (`2026-08-27T01:10:00Z`, carry-forward only) and durable state (`adr-queue.json` now 1 row —
  adr-0129 only; `revalidation-queue.json` now 8 rows; `revalidation-checkpoint.json`;
  `watch-checkpoint.json`; `held-items.md` unchanged) — plus one targeted live `gh` check for a
  claim no attached report covered (the dispatch context's assertion that a batched
  adr-0040+adr-0049 ticket was already filed), not a general refetch of report-covered ground.
- **Evidence**:
  `reports/2026-08-27T180000Z-issue-sorter.md` (clean; #1680/#1681/#1682 confirmed closed+merged;
  #1686 confirmed already correctly minted, nothing new to mint; its own discovery search ran
  before the batched ticket below existed, which is why it isn't in that report's 4-item list — a
  fan-out timing gap, not a miss) ·
  `reports/2026-08-27T180000Z-repo-cleaner.md` (#1680's fix confirmed WORKING LIVE — first firing
  ever that `reap-worktrees --dry` reads the reviewer worktree as `KEEP(fleet-seat)` rather than
  `REAP`; 3 scratch-clone dirs from the #1680/#1681/#1682 build dispatches found+reaped, expected
  per the standing catch-all script, not a regression; 0 open PRs, 1 open issue at read time) ·
  `reports/2026-08-27T180000Z-decision-watcher.md` (forward mode: 22 ADRs amended via the ADR-0140
  rename-sweep PR #1685/commit `96ebbd8d`, judged bookkeeping catch-up, no harvest candidate; 4
  `newly_superseded` targets checked, none stale-cited. Revalidation mode, cursor 45→50:
  adr-0047/0048/0050/0051 confirmed; adr-0049 falsified — same root cause as the already-queued
  adr-0040; explicitly recommended ONE batched ticket for both) ·
  `git log --oneline -20` + `git show ad1d457d --stat` (confirms prior plan's own 1.1 landed as
  `3ddb4ff4`; confirms the `/make-pack` wave landed as `ad1d457d`, HEAD, dropping `adr-queue.json`
  from 7 rows to 1 — commit body: "Clears the 6 satisfied harvest rows from adr-queue.json (Kim
  confirmed); adr-0129's unrelated dual-maintained-CSS pattern stays queued"; confirms the three
  build-PR merge commits — `b2a79384` #1684, `16ca4020` #1683, `96ebbd8d` #1685 — all landed,
  matching both seat reports) ·
  `git status --porcelain` (4 modified ops paths — `adr-checkpoint.json`,
  `revalidation-checkpoint.json`, `revalidation-queue.json`, `watch-checkpoint.json` — 3 untracked
  new report files, plus this firing's own `sweep-in-flight.json` marker; `adr-queue.json`
  correctly NOT modified, matching decision-watcher's own "unchanged" claim) ·
  `.claude/ops/revalidation-checkpoint.json` (cursor 50, `last_sampled_at` 2026-08-27T21:53:38Z —
  matches decision-watcher's cited 45→50 advance) ·
  targeted live `gh issue view 1687/1686 --json body,labels,title,state` + `gh issue list --state
  open` (confirms exactly 2 open issues: #1687, "adr-0040 + adr-0049: components family-barrel
  budget stale via silent measure-size.mjs re-basing (recurring root cause)," filed
  2026-08-27T22:51:30Z, `task`-labeled only, unassigned, no `Blocked-by:` line, body explicitly
  covers both claim ids and cites both decision-watcher firings that found them — confirms the
  dispatch-context claim was real, not narrated-but-absent; #1686 confirmed still open, `task`-only,
  unassigned, no `Blocked-by:` line) · `gh pr list --state open` (0, matches repo-cleaner).
- **UNMEASURED**: none — both `gh` sources reachable all firing (issue-sorter's own check; my one
  targeted live spot-check also succeeded); `git` reachable throughout. `[]`.
- **Corrections vs the prior plan** (2026-08-27T01:10:00Z):
  - Prior 1.1 (land the 01:10:00Z ops state) — **DONE**: commit `3ddb4ff4` ("ops: 2026-08-27T01:10Z
    sweep state — 3 new revalidation findings, 2 tasks filed"), confirmed by `git log`. Superseded
    by this firing's own 1.1.
  - Prior 4.1 (harvest the ADR-restatement-gap fix via `/make-pack`, held at top of §4 for 3
    firings running) — **DONE**: commit `ad1d457d` ("docs(doc-standards): harvest the ADR
    partial-supersession-left-unrestated pattern"), HEAD. `adr-queue.json` dropped from 7 rows to
    1 (only adr-0129 remains) — the commit's own body confirms all 6 satisfied rows cleared, Kim
    confirmed. Dropped, not re-proposed.
  - Prior 4.2 (file a task for adr-0040's recurring silent budget re-basing, 2nd consecutive firing
    named) — **SUPERSEDED, not merely done**: this firing's decision-watcher independently falsified
    adr-0049 via the identical root cause and explicitly recommended ONE batched ticket rather than
    two; the dispatching session filed it as **#1687**, confirmed live (open, task-only, unassigned,
    no `Blocked-by:` line, body covers both claim ids). Old 4.2's narrower single-ADR scope is
    retired in favor of #1687. **ACTIONED, dropped, not re-proposed** — do not re-file a separate
    adr-0040-only ticket.
  - Prior 4.3 (harvest adr-0129's dual-maintained-CSS-drift class) — **STILL OPEN, carried forward,
    now 6 consecutive firings unconverted** (queued_at unchanged at 2026-08-25T17:57:12Z; the
    `ad1d457d` commit body explicitly names it as staying queued, unrelated to the pattern that
    commit harvested).
  - No entry dropped as parked — 2 open issues this firing (#1686, #1687), neither carries
    `backlog` or `roadmap`.
- **New this firing** (issue-sorter): clean no-op on all 4 items its own search caught; #1686
  reconfirmed already correctly minted.
- **New this firing** (repo-cleaner): the #1680 fix reads FIXED live for the first time ever
  (`reap-worktrees --dry` → `KEEP(fleet-seat)`, not `REAP`); 3 orphaned scratch-clone dirs from the
  build dispatches reaped via the standing gated catch-all — working as designed, not a regression.
- **New this firing** (decision-watcher, forward mode): 22-ADR bookkeeping-catch-up amendment wave
  (PR #1685) judged no-harvest; 4 `newly_superseded` targets checked clean.
- **New this firing** (decision-watcher, revalidation mode, cursor 45→50): adr-0047/0048/0050/0051
  confirmed; adr-0049 falsified, same root cause as adr-0040 — now tracked together on #1687.
- **Cross-cutting observation, new this firing (chore-planner's own cross-reference — no single
  seat report drew this together)**: `revalidation-queue.json`'s 8 open rows now resolve into
  exactly two buckets. **Six rows — adr-0036/0038/0041/0042/0043/0046 — are the identical ADRs
  decision-watcher's own forward-mode pass this firing classified as `amended` via commit
  `96ebbd8d`** (PR #1685, merged, HEAD~2), the mechanical ADR-0140 `--ui-*`→`--md-sys-*` token-rename
  restatement — and every one of those 6 rows' own falsified-evidence text names "only the literal
  token spelling in the ADR's own prose is stale" as the entire defect. That is exactly what
  `96ebbd8d` restates. **None of the 6 have been queue-cleared yet** — decision-watcher's forward
  mode (which classified the commit) and revalidation mode (which sampled cursor 45–50, unrelated
  indices) ran on disjoint scopes this firing and never cross-referenced the two. This is the same
  shape as the earlier adr-0030/0032/0033/0035 queue-clear, which sat as a §3 batch-confirm entry
  before landing (see prior plan's own dropped 3.1) — queued below as this firing's own 3.1. The
  remaining 2 rows (adr-0040, adr-0049) are exactly the two claim ids #1687 now tracks together —
  every row in the queue now traces to either #1687 or this pending queue-clear; no 9th orphan
  exists.
- **needs-ruling lane**: none this firing — of the 2 open issues, neither carries `needs-ruling`
  (#1686/#1687 each carry `task` only, verified live).
- **Blocked-by convention (#193)**: 2 open issues this firing (#1686, #1687); grepped both bodies
  for a `Blocked-by:` line — **none found on either**. No blocker relationship changes any entry's
  ordering below.
- **Verdict — two multi-firing threads converted this dispatch, and cross-referencing this
  firing's own two seat findings surfaces the next one**: the ADR-restatement-gap harvest (4.1,
  held 3 firings) landed via `ad1d457d`; the adr-0040 filing (4.2, held 2 firings) is subsumed into
  #1687 alongside the newly-falsified adr-0049; the #1680 reap-worktrees fix is independently
  confirmed working live for the first time. What's left: one still-unconverted harvest (adr-0129,
  now 6 firings running, §4) and one newly-surfaced batch-confirm this firing's own
  cross-referencing found — 6 of the revalidation queue's 8 rows are very likely already resolved
  by a commit that landed this very firing (`96ebbd8d`) but haven't been checked off. That
  queue-clear (§3.1) is this firing's sharpest, cheapest action.

Queue order: (1) gated mutations verified safe → (2) blockers → (3) human decisions → (4) hygiene.

## 1. Gated mutations already verified safe

### 1.1 Land this firing's ops state — one commit, ops paths ONLY (dispatching host; 5 min)
- **Action**: `git add` exactly: `.claude/ops/adr-checkpoint.json` (modified, cursor/classify
  advance, zero new candidates), `.claude/ops/revalidation-checkpoint.json` (modified, cursor
  45→50), `.claude/ops/revalidation-queue.json` (modified, +1 row: adr-0049, now 8 total),
  `.claude/ops/watch-checkpoint.json` (modified, both `gh_issues`/`gh_prs` →
  2026-08-27T18:00:00Z), `.claude/ops/reports/2026-08-27T180000Z-issue-sorter.md` (new),
  `.claude/ops/reports/2026-08-27T180000Z-repo-cleaner.md` (new),
  `.claude/ops/reports/2026-08-27T180000Z-decision-watcher.md` (new), plus this plan's own payload
  once applied — then commit on `main`. Do NOT stage `.claude/ops/adr-queue.json` (correctly
  unchanged this firing, still 1 row) and do NOT stage `.claude/ops/sweep-in-flight.json` (this
  sweep's own live marker).
- **Owner**: dispatching host (the ops-write split's dispatching session).
- **Evidence**: `git status --porcelain` this compute pass (4 modified + 3 untracked ops paths in
  this seat's own remit; `adr-queue.json` correctly absent from the modified set);
  `ops-write-sandbox-rules` (dispatcher applies + lands payloads).
- **Size**: 5 minutes.

## 2. Blocking other work

(none — 0 open PRs live-confirmed, primary exactly current with `origin/main` at `ad1d457d`; no
entry blocks another this firing; both open issues, #1686 and #1687, carry no `Blocked-by:` line.)

## 3. Human-decision items

### 3.1 Batch-confirm the queue-clear on 6 revalidation-queue.json rows now that PR #1685 landed the exact fix (decision-watcher next pass, or Kim directly; ~10–15 min)
- **Action**: `revalidation-queue.json`'s adr-0036/0038/0041/0042/0043/0046 rows were each falsified
  purely on stale `--ui-*` token spelling in that ADR's own Decision/Amendment prose — the shipped
  mechanism was already confirmed correct in every case, only the literal wording was stale.
  Commit `96ebbd8d` (PR #1685, merged, landed this same firing) restates exactly that token
  spelling via a new Amendment section on all 22 affected ADRs, including all 6 of these. Spot-check
  each of the 6 ADR files' new Amendment section actually restates the specific token(s) named in
  its own `revalidation-queue.json` evidence text, then clear the confirmed rows via the standard
  ops-write-sandbox scratch-copy + fenced-payload mechanism (decision-watcher's own state file —
  chore-planner does not mutate it directly). Same shape as the earlier
  adr-0030/0032/0033/0035 queue-clear (prior plan's own dropped 3.1). Do not fold in adr-0040/0049
  — those two are already tracked together on #1687, a different root cause (re-basing discipline,
  not token-rename).
- **Owner**: decision-watcher (next firing's cross-check) or Kim directly if faster.
- **Evidence**: `.claude/ops/revalidation-queue.json`'s 6 rows (byte-unchanged since queued_at
  2026-08-26T22:55:49Z / 2026-08-27T00:55:47Z, each citing "only the literal token spelling ...
  is stale"); `reports/2026-08-27T180000Z-decision-watcher.md`'s forward-mode section (git-show
  verified `96ebbd8d` as the mechanical restatement across exactly this 22-ADR set, "no mechanism
  change"); `git log`/`git show 96ebbd8d` (commit landed, confirmed).
- **Size**: ~10–15 minutes.

## 4. Hygiene debt

### 4.1 Harvest adr-0129's dual-maintained-CSS-drift class (Kim; ~15–20 min) — queued since 2026-08-25T17:57:12Z, now 6 consecutive firings unconverted
- **Action**: `adr-0129`'s row (unchanged evidence text this firing, explicitly left queued by the
  `ad1d457d` harvest commit as an unrelated pattern) flags a generalizable defect class — a
  promoted control's CSS drifting as dual-maintained truth between its site-consumer copy and its
  package-owned canonical copy (GH #1163's root-card logic and ADR-0100's container-type repair
  both independently missed one copy) — not yet covered by any `references/*.md`. Distinct fix
  target from the just-landed partial-supersession-restatement pattern; restated again because it
  is now the single most stale unconverted item in this queue.
- **Owner**: Kim (`/make-pack` runner).
- **Evidence**: `.claude/ops/adr-queue.json`'s sole remaining row (full evidence text, citing GH
  #1163 and ADR-0100, byte-unchanged since 2026-08-25T17:57:12Z);
  `.claude/docs/adr/0129-app-surfaces-m2-composition-and-transport-boundary.md` L70-107 (Amendment
  2, the artboard-extraction precedent this harvest would generalize from); commit `ad1d457d`'s own
  body (explicitly leaves this row queued).
- **Size**: ~15–20 minutes.

## Standing notes (not queue entries)

- **Prior plan (2026-08-27T01:10:00Z) fully triaged**: its 1.1 landed (`3ddb4ff4`); its 4.1 landed
  (`ad1d457d`) and is dropped; its 4.2 is subsumed into #1687 and dropped; its 4.3 carries forward
  above, one firing more stale.
- **Two open issues this firing, neither a plan queue entry**: #1686 (doc-standards `evals/` gap,
  unassigned) was already correctly minted before this firing and remains unclaimed; #1687
  (adr-0040+adr-0049 batched, unassigned) is new this firing, confirmed live and correctly filed.
  Neither carries `backlog`/`roadmap`; neither is re-proposed here — filed work stays tracked on
  its own issue, not duplicated into this plan.
- **Repo surface is at a clean floor apart from those 2 unclaimed issues**: 0 open PRs, primary at
  exact parity with `origin/main` (`ad1d457d`) — the entire actionable queue this dispatch is one
  ops-state landing, one batch-confirm, and one hygiene harvest; §2 is empty this firing.
- **The #1680 reap-worktrees fix is confirmed working live, not just merged** — the first firing
  ever (across the whole fleet-bootstrap history) that `reap-worktrees --dry` correctly classifies
  the reviewer worktree as `KEEP(fleet-seat)`. No further action; noted as the positive result it
  is, per repo-cleaner's own report.
- **Fleet-bootstrap context (standing, not a finding)**: the reviewer seat
  (`.claude/worktrees/agent-ui-reviewer`, branch `reviewer-worktree-2026-08-26`) and the planner
  seat from `/teamwork:fleet-bootstrap` remain live and idle.
- **No entry parked this firing** — 2 open issues exist, neither carries `backlog`/`roadmap`.
- **Dirty `main` markers**: `.claude/ops/sweep-in-flight.json` (this sweep's own live marker —
  leave until the sweep concludes).
- **gen-ui-kit**: out of this board's scope (dedicated session per Kim's ruling).

*Composed by chore-planner, 2026-08-27T18:00:00Z sweep firing — returned as payload per the #125
ops-write split; written and landed by the dispatching session.*
