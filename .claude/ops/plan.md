<!-- target-path: .claude/ops/plan.md -->
# Ops plan — agent-ui

- **Dispatch**: 2026-08-27T23:20:00Z sweep firing (chore-planner, three-seat sweep per
  `/teamwork:mobilize-chores` → `harness:sweep-chores`; no repo-local `harness/` tree, so this
  firing planned from durable ops state directly). Judged the three fresh seat reports attached to
  this dispatch (issue-sorter, repo-cleaner, decision-watcher, all timestamped
  `2026-08-27T232000Z`) plus the prior plan (`2026-08-27T18:00:00Z`, carry-forward only) and
  durable state (`adr-queue.json` — 1 row, adr-0129, unchanged; `revalidation-queue.json` — 0 rows,
  first time ever empty; `revalidation-checkpoint.json` cursor 55; `watch-checkpoint.json` both
  sources at this firing's timestamp; `held-items.md` unchanged, nothing held) — plus two targeted
  live checks for ground no attached report covered: a `Blocked-by:` grep on #1686's body (per
  `blocked-by-rules`) and a push-verification re-read (`git fetch origin main` + `git ls-remote`)
  on the two direct-to-main commits the dispatch context named as already landed.
- **Evidence**:
  `reports/2026-08-27T232000Z-issue-sorter.md` (clean; #1687 independently re-confirmed CLOSED via
  merged PR #1688 at 23:11:35Z; #1686 independently re-confirmed still OPEN/claimed/`in-flight`, no
  PR yet — both against live `gh`, not taken on the dispatch's word) ·
  `reports/2026-08-27T232000Z-repo-cleaner.md` (0 open PRs; 1 open issue, matches expectation;
  reviewer worktree still `KEEP(fleet-seat)`, #1680 fix holding a second firing running; scratch
  clone `agent-ui-1687` independently re-verified via `gh pr view 1688` before reap-execute;
  `agent-ui-1686`'s live dirty clone correctly left alone) ·
  `reports/2026-08-27T232000Z-decision-watcher.md` (forward mode: adr-0040/adr-0049 both classified
  `amended`, tracing to `720b907d`/#1688 — the same commit that resolved their own falsified
  revalidation rows; flagged an open 4th-vs-5th-shape classification question, explicitly not
  self-resolved, named for the dispatching session. Revalidation mode, cursor 50→55: adr-0052
  through adr-0056 all confirmed, nothing queued) ·
  `git log --oneline -8` (confirms, in order: `720b907d` #1688 merge → `b2dc8ecb`
  "fold adr-0040/adr-0049 into the 4th-shape worked instances," Kim's ruling recorded verbatim in
  the commit body — same shape, different drift source, no 5th shape split → `676b8415`
  "checkpoint advance, revalidation queue emptied," landing this firing's 3 reports + all 3
  checkpoints + the revalidation-queue clear in one commit) ·
  `git status --porcelain` (clean — nothing left uncommitted in `.claude/ops/` this firing) ·
  `git fetch origin main` + `git rev-parse HEAD`/`origin/main` + `git ls-remote origin
  refs/heads/main` (all three return `676b8415…` — the two direct-to-main commits are confirmed
  landed on `origin/main`, not merely committed locally, per `ops-write-sandbox-rules`'
  push-verification convention) ·
  `gh issue list --state open --json number,title,labels,assignees,updatedAt` (exactly 1 open
  issue, #1686, labels `task`+`in-flight`, matches both seat reports) ·
  `gh issue view 1686 --json body -q .body | grep -i blocked-by` (no match — no `Blocked-by:` line,
  confirms the prior firing's own live check still holds; body unedited since, only a claim comment
  appended) · `gh pr list --state open` (0, matches repo-cleaner).
- **UNMEASURED**: none — both `gh` sources reachable all firing (issue-sorter's own check; my two
  targeted live checks also succeeded); `git`/`origin` reachable throughout. `[]`.
- **Corrections vs the prior plan** (2026-08-27T18:00:00Z):
  - Prior 1.1 (land the 18:00:00Z ops state — checkpoints + the 6-row revalidation-queue batch
    confirm) — **DONE**: commit `a3b31a0d`, confirmed by `git log`.
  - Prior 3.1 (batch-confirm the 6-row revalidation-queue clear via PR #1685's restatement) —
    **DONE**, same commit `a3b31a0d` — the queue-clear landed exactly as proposed.
  - Prior 4.1 (harvest adr-0129, 6 consecutive firings unconverted as of that plan) — **STILL OPEN,
    carried forward, now 7 consecutive firings unconverted** (`queued_at` unchanged at
    2026-08-25T17:57:12Z; no commit since touches this row).
  - **Not a prior-plan entry, but explicitly resolved this firing (named for continuity):**
    decision-watcher's forward-mode pass this firing found adr-0040/adr-0049 already amended (via
    #1687/#1688, itself the resolution of the prior plan's own tracked ticket) and flagged an open
    classification question (4th shape vs. a new 5th shape). The dispatching session ruled it
    directly (commit `b2dc8ecb`: "same shape, different drift source, no 5th shape split"),
    folded both into `adr-log-mechanics.md`'s worked-instances list, and cleared both from
    `adr-queue.json` (back to 1 row) and `revalidation-queue.json` (down to 0 rows) — all **ACTIONED
    this firing, landed and pushed, not carried as an open item.**
  - No entry dropped as parked — the sole open issue this firing (#1686) carries neither `backlog`
    nor `roadmap`.
- **New this firing** (issue-sorter): #1687 independently reconfirmed closed via merged PR #1688;
  #1686 reconfirmed still open/claimed, no re-classification needed (unchanged since prior firing).
- **New this firing** (repo-cleaner): 1 stale `origin/*` ref pruned (#1688's merged branch); the
  #1687 scratch clone reaped (independently re-verified against the PR's MERGED state first); the
  #1686 scratch clone correctly left alone (`KEEP(dirty)`, live build).
- **New this firing** (decision-watcher, forward mode): adr-0040/adr-0049 classified `amended`,
  tracing to the same commit that resolved their falsified revalidation rows — resolved via the
  dispatching session's direct ruling and action, per Corrections above.
- **New this firing** (decision-watcher, revalidation mode, cursor 50→55): adr-0052–0056 all
  confirmed; nothing queued.
- **Milestone, new this firing (chore-planner's own cross-reference)**: `revalidation-queue.json`
  is now **empty (0 rows) for the first time since this ops seat began tracking it** — the 6-row
  batch confirm (prior plan's 3.1, landed `a3b31a0d`) plus this firing's final 2-row clear
  (adr-0040/adr-0049, landed `676b8415`) drained it completely. Not a queue entry — a state fact
  worth naming so the next firing doesn't read an empty queue as a gap.
- **needs-ruling lane**: none this firing — the sole open issue (#1686) carries `task`+`in-flight`
  only, verified live.
- **Blocked-by convention (#193)**: 1 open issue this firing (#1686); grepped its body for a
  `Blocked-by:` line live — **none found**, consistent with the prior firing's own check (body
  unedited since, only a claim comment appended). No blocker relationship changes this plan.
- **Verdict — the cleanest floor this plan has recorded: both live threads converted and already
  landed+pushed before this seat was even dispatched, leaving one bookkeeping commit and one
  long-carried harvest.** The adr-0040/adr-0049 thread closed end-to-end (ticket → PR → ADR
  restatement → harvest → both queues cleared) inside a single firing window; the
  revalidation-queue hit zero rows for the first time. What's left: land this plan's own payload
  (§1.1, the only uncommitted ops-state artifact) and keep pushing on the one hygiene item now
  seven firings stale (§4.1). §2 and §3 are empty this firing — no blockers, no pending human
  decisions.

Queue order: (1) gated mutations verified safe → (2) blockers → (3) human decisions → (4) hygiene.

## 1. Gated mutations already verified safe

### 1.1 Land this firing's plan.md — the only remaining uncommitted ops-state artifact (dispatching host; ~2 min)
- **Action**: `git add .claude/ops/plan.md` (this payload, once applied) and commit on `main`.
  Nothing else needs staging this firing — the 3 new seat reports, `adr-checkpoint.json`,
  `revalidation-checkpoint.json`, `revalidation-queue.json` (now empty), and `watch-checkpoint.json`
  are ALL already committed and pushed (commit `676b8415`, confirmed against `origin/main` via
  `git ls-remote`) — unlike every prior firing's 1.1, this one is not bundling a batch of ops-state
  changes, just this plan's own payload.
- **Owner**: dispatching host (the ops-write split's dispatching session).
- **Evidence**: `git status --porcelain` (clean — confirms nothing else pending); `git rev-parse
  HEAD`/`origin/main` + `git ls-remote origin refs/heads/main` (all three = `676b8415…`, confirmed
  pushed); `ops-write-sandbox-rules` (dispatcher applies + lands payloads; direct-to-main
  push-verification convention cited, not re-derived).
- **Size**: 2 minutes.

## 2. Blocking other work

(none — 0 open PRs live-confirmed, primary exactly current with `origin/main` at `676b8415`; the
sole open issue, #1686, carries no `Blocked-by:` line and is already in-flight/building, not
proposed for mobilization per this dispatch's own instruction.)

## 3. Human-decision items

(none this firing — the one pending human-decision thread, decision-watcher's flagged 4th-vs-5th
shape classification question, was ruled directly by the dispatching session before this plan was
composed (commit `b2dc8ecb`: "same shape, different drift source, no 5th shape split") and is
already actioned, not carried forward as open. The prior firing's own 3.1 batch-confirm also
already landed (`a3b31a0d`). No new human-decision item surfaced this firing.)

## 4. Hygiene debt

### 4.1 Harvest adr-0129's dual-maintained-CSS-drift class (Kim; ~15–20 min) — queued since 2026-08-25T17:57:12Z, now 7 consecutive firings unconverted
- **Action**: `adr-0129`'s row (unchanged evidence text this firing) flags a generalizable defect
  class — a promoted control's CSS drifting as dual-maintained truth between its site-consumer copy
  and its package-owned canonical copy (GH #1163's root-card logic and ADR-0100's container-type
  repair both independently missed one copy) — not yet covered by any `references/*.md`. Distinct
  fix target from the just-landed 4th-shape restatement pattern (which this firing's own
  adr-0040/adr-0049 fold-in extended, not this row); restated again because it remains the single
  most stale unconverted item in this queue and the gap between firings is widening (6→7).
- **Owner**: Kim (`/make-pack` runner).
- **Evidence**: `.claude/ops/adr-queue.json`'s sole remaining row (full evidence text, citing GH
  #1163 and ADR-0100, byte-unchanged since 2026-08-25T17:57:12Z, confirmed still the only row —
  the two adr-0040/adr-0049 rows this firing's decision-watcher scratch-queued were cleared back
  out same-firing via commit `b2dc8ecb`, never landed to the real file with adr-0129 alongside
  them); `.claude/docs/adr/0129-app-surfaces-m2-composition-and-transport-boundary.md` L70-107
  (Amendment 2, the artboard-extraction precedent this harvest would generalize from).
- **Size**: ~15–20 minutes.

## Standing notes (not queue entries)

- **Prior plan (2026-08-27T18:00:00Z) fully triaged**: its 1.1 landed (`a3b31a0d`); its 3.1 landed
  (`a3b31a0d`, same commit); its 4.1 carries forward above, one firing more stale.
- **One open issue this firing, not a plan queue entry**: #1686 (doc-standards `evals/` gap) is
  actively claimed and building (branch `1686-doc-standards-has-no`, claimed 23:00:13Z, ~20 min old
  at report time) — correctly excluded from mobilization per this dispatch's own instruction; not
  duplicated into this plan. #1687 is CLOSED (merged via #1688) and dropped, not re-proposed.
- **`revalidation-queue.json` is empty for the first time ever** — see the Milestone note above.
  Zero rows is the correct, non-gap state; the next firing should read it as a floor, not a miss.
- **`adr-queue.json` is down to its single most-stale row (adr-0129 only)** — every other row this
  firing's decision-watcher scratch-queued (adr-0040, adr-0049) was resolved same-firing and never
  reached the real file's steady state.
- **Repo surface is at a clean floor**: 0 open PRs, primary at exact parity with `origin/main`
  (`676b8415`, push-verified) — the entire actionable queue this dispatch is one plan-payload
  landing and one long-carried hygiene harvest; §2 and §3 are both empty this firing.
- **The #1680 reap-worktrees fix continues to hold live**, second firing running (repo-cleaner's
  own re-confirmation, independent of the prior firing's report).
- **Fleet-bootstrap context (standing, not a finding)**: the reviewer seat
  (`.claude/worktrees/agent-ui-reviewer`, branch `reviewer-worktree-2026-08-26`) remains live and
  idle, `KEEP(fleet-seat)`.
- **No entry parked this firing** — 1 open issue exists, carries neither `backlog` nor `roadmap`.
- **Dirty `main` markers**: none reported by repo-cleaner beyond this sweep's own
  `sweep-in-flight.json` marker (leave until the sweep concludes).
- **gen-ui-kit**: out of this board's scope (dedicated session per Kim's ruling).

*Composed by chore-planner, 2026-08-27T23:20:00Z sweep firing — returned as payload per the #125
ops-write split; written and landed by the dispatching session.*
