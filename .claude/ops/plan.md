<!-- target-path: .claude/ops/plan.md -->
# Ops plan — agent-ui

- **Dispatch**: 2026-08-28T03:40:00Z sweep firing (chore-planner, three-seat sweep). Judged the
  three fresh seat reports attached to this dispatch (issue-sorter, repo-cleaner, decision-watcher,
  all timestamped `2026-08-28T034000Z`) plus the prior plan (`2026-08-28T01:15:00Z`, carry-forward
  only) and durable state (`adr-queue.json` — 1 row, adr-0129, unchanged; `revalidation-queue.json`
  — was stale, now cleared, see Corrections; `revalidation-checkpoint.json` cursor 65;
  `watch-checkpoint.json` both sources at this firing's timestamp; `held-items.md` unchanged,
  nothing held; the `adr-log-mechanics.md` fold-in) — plus targeted live `gh`/`git`
  checks to independently corroborate the dispatch context's two named claims (adr-0058's
  harvest-row fold-in already applied out-of-band; #1692 confirmed mobilizable by two seats).
- **Evidence**:
  `reports/2026-08-28T034000Z-issue-sorter.md` (2 issues in window: #1690 CLOSED via merged PR
  #1691, confirmed independently; #1692 filed, correctly labeled `task`+`size:small`, trusted
  author, no dedup, not held; 1 PR (#1691) merged, no ticket-record action) ·
  `reports/2026-08-28T034000Z-repo-cleaner.md` (0 open PRs; 1 open issue (#1692) confirmed
  unclaimed/unblocked; 1 stale `origin/*` ref pruned; #1690's scratch clone REAP→EXECUTE→re-dry 0
  rows; reviewer worktree still `KEEP(fleet-seat)`; consecutive-unchanged-firing count reset to 0)
  · `reports/2026-08-28T034000Z-decision-watcher.md` (forward mode: adr-0058 hash changed matching
  PR #1691, judged covered-but-extend, queued a NEW `adr-queue.json` harvest row proposing the 12th
  4th-shape worked instance; revalidation mode cursor 60→65, adr-0062–0066 all confirmed, no new
  falsified/untestable — note this report's own claim about `revalidation-queue.json` being
  already-empty was WRONG, see Corrections) ·
  `git show --stat 09446278` (PR #1691's merge commit: touches only
  `.claude/docs/adr/0058-defer-intent-fill-selected-roles.md` and
  `.claude/docs/references/tokens.md`) ·
  direct `Read` of `.claude/docs/adr/0058-defer-intent-fill-selected-roles.md`'s Amendment section
  (confirms the per-family re-verification table matches the falsified row's own flagged numbers
  exactly — only `success` moved to uniform `-600`, danger/warning/info unchanged — the fix is
  real, not assumed) ·
  `git diff .claude/skills/doc-standards/references/adr-log-mechanics.md` (11→12 worked instances;
  adds adr-0058/PR #1691 as "a third drift-source variant: a live AA-contrast re-measurement... no
  other ADR and no script value involved at all") ·
  `git log --oneline -- .claude/ops/adr-queue.json` (last two touches: `ad1d457d`, 2026-08-27,
  cleared 6 unrelated rows, left adr-0129 untouched; `5095d64b`, 2026-08-25T17:55Z, queued
  adr-0129 — 9 sweep firings have now run with this row unconverted) ·
  `gh issue list --state open` (1: #1692) · `gh issue view 1692 --json body,labels,state,createdAt`
  (OPEN, `task`+`size:small` only, no `Blocked-by:` line, owner: unassigned) · `gh pr list
  --state open` (0) ·
  `git rev-parse HEAD` + `git ls-remote origin refs/heads/main` (both `09446278…`, primary at
  exact, push-verified parity with `origin/main`).
- **UNMEASURED**: none — `gh` reachable all firing; `git`/`origin` reachable throughout. `[]`.
- **Corrections vs the prior plan** (2026-08-28T01:15:00Z):
  - Prior 1.1 (land that firing's own ops-state + plan payload) — **DONE**: commit `45f433b0`,
    confirmed by `git log`.
  - Prior 4.1 (harvest adr-0129, 8 consecutive firings unconverted as of that plan) — **STILL
    OPEN, carried forward, now 9 consecutive firings unconverted** (`queued_at` unchanged at
    2026-08-25T17:57:12Z; the only commit touching this file since, `ad1d457d`, explicitly left
    this row alone while clearing 6 others).
  - **adr-0058's forward-mode harvest row** — decision-watcher queued a new `adr-queue.json` row
    this firing proposing adr-0058 as the 4th-shape pattern's 12th worked instance. The dispatching
    session confirmed and applied this fold-in directly (`adr-log-mechanics.md`, 11→12 instances)
    before this plan was composed, and cleared the queue row. Treated as **ACTIONED**, not open.
  - **Ticket #1690** — was open/out-of-scope in the prior plan; now **CLOSED** via merged PR
    #1691, independently reconfirmed by issue-sorter live. Dropped from tracking.
  - **`revalidation-queue.json` discrepancy, found and RESOLVED this firing**: this firing's own
    decision-watcher report claimed (twice) that `revalidation-queue.json` was "already cleared in
    a prior cycle" and "remains empty." Both claims were false — `git show --stat 09446278` proves
    PR #1691 never touched that file, and the file at HEAD still carried the adr-0058 `falsified`
    row (`queued_at: 2026-08-28T01:36:51Z`) verbatim when chore-planner checked. The dispatching
    session then independently verified PR #1691's Amendment genuinely resolves the falsified
    finding — the Amendment's per-family re-verification table (danger 5.26/6.31, warning
    4.76/5.73, success 4.46-fails/5.42, info 4.69/5.68) matches the falsified row's own flagged
    numbers exactly, with only `success` moving to a uniform `-600` pin — and cleared the row
    (`revalidation-queue.json` now `{"candidates": []}`). This closes what chore-planner's own
    synthesis pass had queued as a next-firing item; not carried forward. The decision-watcher
    report text itself is left uncorrected in place (append-only per convention) but this plan's
    own record supersedes its wrong claim.
  - No entry dropped as parked — the sole open issue this firing (#1692) carries neither
    `backlog` nor `roadmap`.
- **New this firing** (issue-sorter): #1690 independently reconfirmed CLOSED via merged PR #1691;
  #1692 filed and correctly classified/labeled, nothing outstanding for intake; nothing held.
- **New this firing** (repo-cleaner): PR #1691 merged, its remote branch already GitHub-deleted (1
  stale ref pruned); #1690's scratch clone REAP-classified, executed, re-verified gone; #1692
  surfaced live (unclaimed, unblocked, ~12 min old at survey); reviewer worktree still
  `KEEP(fleet-seat)`; consecutive-unchanged-firing count reset to 0.
- **New this firing** (decision-watcher, forward mode): adr-0058 hash change → judged
  covered-but-extend, harvest row queued then actioned same-firing (see Corrections). No new
  supersessions (superseded set unchanged: adr-0037/0082/0083/0084/0086/0092).
- **New this firing** (decision-watcher, revalidation mode, cursor 60→65): adr-0062–0066 sampled,
  all 5 **confirmed**. No new falsified/untestable verdicts. The report's own claim about
  `revalidation-queue.json` already being cleared was wrong (see Corrections) — now genuinely
  cleared as of this plan.
- **needs-ruling lane**: none this firing.
- **Blocked-by convention (#193)**: 1 open issue this firing (#1692); its body carries no
  `Blocked-by:` line. No blocker relationship changes this plan.
- **Verdict — a clean conversion firing, with one report-vs-durable-state discrepancy found and
  repaired in the same pass.** Ticket #1690's amendment landed (PR #1691) and its harvest was
  folded in before this plan was composed; a genuine mismatch between this firing's own
  decision-watcher report and the actual `revalidation-queue.json` on disk was caught by
  chore-planner's independent verification and then resolved by the dispatching session, not
  deferred to next firing. What's left: land this firing's ops-state + plan payload (§1.1), keep
  pushing the hygiene item now nine firings stale (§4.1), and pick up #1692 (§4.2). §2 and §3 are
  empty this firing; §4.3 (the queue discrepancy) is resolved, not carried forward.

Queue order: (1) gated mutations verified safe → (2) blockers → (3) human decisions → (4) hygiene.

## 1. Gated mutations already verified safe

### 1.1 Land this firing's ops-state + plan payload (dispatching host; ~3–5 min)
- **Action**: `git add` the 3 new seat reports
  (`reports/2026-08-28T034000Z-{issue-sorter,repo-cleaner,decision-watcher}.md`),
  `adr-checkpoint.json` (adr-0058 re-baselined to its new hash), `adr-queue.json` (adr-0129 only,
  adr-0058's row actioned), `revalidation-checkpoint.json` (cursor 65), `revalidation-queue.json`
  (cleared to empty), `watch-checkpoint.json` (both sources advanced), the `adr-log-mechanics.md`
  fold-in (11→12 worked instances, adr-0058/PR #1691), and this plan's own payload — commit and
  push to `main` in one batch. `sweep-in-flight.json` is this firing's own in-flight marker —
  leave it out of the commit; remove it once this batch lands.
- **Owner**: dispatching host (the ops-write split's dispatching session).
- **Evidence**: `git status --porcelain`; `git rev-parse HEAD` + `git ls-remote origin
  refs/heads/main` (both `09446278…`, confirming primary otherwise current before this batch
  lands).
- **Size**: 3–5 minutes.

## 2. Blocking other work

(none — 0 open PRs live-confirmed, primary exactly current with `origin/main` at `09446278`.)

## 3. Human-decision items

(none this firing — #1692's internal Scope/Open sub-decision, author-a-script vs. correct-the-
citations, is normal ticket-build discretion, queued below at §4.2.)

## 4. Hygiene debt

### 4.1 Harvest adr-0129's dual-maintained-CSS-drift class (Kim; ~15–20 min) — queued since 2026-08-25T17:57:12Z, now 9 consecutive firings unconverted
- **Action**: `adr-0129`'s row (unchanged evidence text this firing) flags a generalizable defect
  class — a promoted control's CSS drifting as dual-maintained truth between its site-consumer copy
  and its package-owned canonical copy (GH #1163's root-card logic and ADR-0100's container-type
  repair both independently missed one copy) — not yet covered by any `references/*.md`. Restated
  again because it remains the single most stale unconverted item in this queue and the gap between
  firings continues widening (8→9).
- **Owner**: Kim (`/make-pack` runner). **Home decided 2026-08-28: `component-packaging`** — the
  exact command is `/harness:make-pack .claude/skills/component-packaging`; the queue row's
  `plan` field carries the one-axis charter. Only the run itself remains.
- **Evidence**: `.claude/ops/adr-queue.json`'s sole remaining row (full evidence text, citing GH
  #1163 and ADR-0100, byte-unchanged since 2026-08-25T17:57:12Z); `git log --oneline -- .claude/
  ops/adr-queue.json` (last touch `ad1d457d` explicitly left this row alone); `.claude/docs/adr/
  0129-app-surfaces-m2-composition-and-transport-boundary.md` L70-107 (Amendment 2, the
  artboard-extraction precedent this harvest would generalize from).
- **Size**: ~15–20 minutes.

### 4.2 Mobilize #1692 — missing `color-verify/contrast-check.py` tool cited by 3 ADRs, never committed (Kim / next available builder; ~30–60 min) — new this firing
- **Action**: ADR-0057/0058/0059 all cite `color-verify/contrast-check.py` as the ground-truth
  contrast-verification tool; it was never committed to this repo. Ticket #1692 already carries a
  complete Summary/Acceptance/Links/Scope-Open shape and offers two resolution paths: (a) author
  the script for real, or (b) correct the three ADRs' citations and canonize the
  OKLCH→linear-sRGB→relative-luminance method ticket #1690 actually used as the standing
  procedure. Independently confirmed mobilizable this firing by both issue-sorter and
  repo-cleaner — queued here at the dispatching session's explicit direction.
- **Owner**: Kim or next available builder dispatch (unassigned on the ticket itself).
- **Evidence**: `gh issue view 1692 --json body,labels,state,createdAt` (OPEN, `task`+`size:small`,
  created 2026-08-28T03:28:39Z, no `Blocked-by:` line, no `backlog`/`roadmap`, no `needs-ruling`);
  `reports/2026-08-28T034000Z-issue-sorter.md` and `reports/2026-08-28T034000Z-repo-cleaner.md`
  (independent mobilizability confirmations).
- **Size**: ~30–60 minutes.

## Standing notes (not queue entries)

- **Prior plan (2026-08-28T01:15:00Z) fully triaged**: its 1.1 landed (`45f433b0`); its 4.1 carries
  forward above, one firing more stale (8→9).
- **Ticket #1690** (ADR-0058 re-verification amendment): now **CLOSED** via merged PR #1691
  (2026-08-28T03:28:17Z), independently reconfirmed live. Dropped from tracking, not carried
  forward.
- **Ticket #1692** (missing `contrast-check.py` tool): filed 2026-08-28T03:28:39Z, OPEN,
  `task`+`size:small`, unclaimed, unblocked — queued at §4.2 this firing only.
- **`adr-queue.json` holds 1 row (adr-0129 only)** — adr-0058's harvest row was queued and
  actioned (folded into `adr-log-mechanics.md` as the 12th worked instance) within this same
  firing window, before this plan was composed.
- **`revalidation-queue.json` holds 0 rows** — the adr-0058 falsified row was genuinely cleared
  this firing after independent verification that PR #1691's Amendment resolves it (see
  Corrections above); this firing's own decision-watcher report claim to the same effect was
  premature/wrong and is noted, not trusted at face value.
- **Repo surface is at a clean floor otherwise**: 0 open PRs, primary at exact parity with
  `origin/main` (`09446278`, push-verified); 1 open issue (#1692, now tracked at §4.2).
- **The #1680 reap-worktrees fix continues to hold live**, re-confirmed independently this firing
  by repo-cleaner.
- **Fleet-bootstrap context (standing, not a finding)**: the reviewer seat
  (`.claude/worktrees/agent-ui-reviewer`, branch `reviewer-worktree-2026-08-26`) remains live and
  idle, `KEEP(fleet-seat)`.
- **No entry parked this firing** — 1 open issue exists (#1692), carries neither `backlog` nor
  `roadmap`.
- **Dirty `main` markers**: none reported by repo-cleaner beyond this sweep's own
  `sweep-in-flight.json` marker (leave until the sweep concludes).
- **gen-ui-kit**: out of this board's scope (dedicated session per Kim's ruling).

*Composed by chore-planner, 2026-08-28T03:40:00Z sweep firing; revalidation-queue.json
discrepancy found by chore-planner and resolved by the dispatching session before landing.
Written and landed by the dispatching session.*
