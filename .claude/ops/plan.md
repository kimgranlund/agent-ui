<!-- target-path: .claude/ops/plan.md -->
# Ops plan — agent-ui

- **Dispatch**: 2026-08-27T01:10:00Z sweep firing (chore-planner, three-seat sweep per
  `/teamwork:mobilize-chores` → `harness:sweep-chores`; no repo-local `harness/` tree, so this
  firing planned from durable ops state directly, same as every prior firing this session). Judged
  the three fresh seat reports attached to this dispatch (issue-sorter, repo-cleaner,
  decision-watcher) plus the prior plan (`2026-08-26T22:05:00Z`, carry-forward only) and durable
  state (`adr-queue.json` still 7 rows unchanged, `revalidation-queue.json` now 7 rows,
  `revalidation-checkpoint.json`, `watch-checkpoint.json`, `held-items.md`) — plus a live `gh`
  spot-check (issue list/view + label read on #1680/#1681/#1682, `git log`/`git status`) to confirm
  every attached-report claim and this firing's file-level state is real, per the same practice as
  every prior firing.
- **Evidence**:
  `reports/2026-08-27T011000Z-issue-sorter.md` (checkpoint window 22:05:00Z→01:10:00Z; both
  gh_issues/gh_prs reachable; 2 items discovered, #1680/#1681, both already correctly minted at
  filing time — RESUME no-op, no duplicate; 0 PRs; 0 held items; both checkpoint entries advance to
  01:10:00Z) ·
  `reports/2026-08-27T011000Z-repo-cleaner.md` (git surface byte-for-byte unchanged from the prior
  firing's report — same 2-worktree/1-branch/0-open-PR/0-leftover-remote-branch state; the one
  genuinely new item, 2 open issues vs 0 last firing, reset the unchanged-count to 0; `reap-worktrees
  --dry` still reads the standing reviewer worktree as `REAP` — held, not executed, tracked by
  agent-ui#1680, not re-flagged; v0.1.0 release + `9a62617f` selftest fix both accounted for as
  expected state, not drift) ·
  `reports/2026-08-27T011000Z-decision-watcher.md` (forward mode: `adr_checkpoint.py` against the
  freshly re-baselined checkpoint — 226/226 ADRs, nothing changed; confirms `9a62617f` touched no
  ADR content and confirms the 2026-08-26T22:2X:00Z queue-clear on adr-0030/0032/0033/0035 landed
  correctly, those rows now gone from `revalidation-queue.json`. Revalidation mode: cursor 40→45,
  sampled adr-0042..adr-0046 — adr-0044/0045 confirmed (byte-verified against `text-field.css`/
  `overlay.ts`/`combo-box.ts`/`selection-commit.ts`), no action; adr-0042/0043/0046 falsified, all
  via the ADR-0140 rename root cause — adr-0042 and the rename-half of adr-0046 already inside
  agent-ui#1681's original 24-candidate list, adr-0043 a genuine miss appended as #1681's 25th
  instance, adr-0046 also carrying a second, unrelated orphaned-"Status: proposed"-fragment defect
  filed separately) ·
  `git log --oneline -15` (confirms prior plan's own 1.1 landed as `227c87d4`; confirms
  `81394705` fleet-bootstrap cold start and `9a62617f` selftest fix both landed since, neither
  touching ADR content) ·
  `git status --porcelain` (3 modified ops paths — `revalidation-checkpoint.json`,
  `revalidation-queue.json`, `watch-checkpoint.json` — 3 untracked new report files, plus this
  firing's own `sweep-in-flight.json` marker; `adr-checkpoint.json`/`adr-queue.json` correctly
  NOT modified, matching decision-watcher's forward-mode clean no-op) ·
  live `gh issue list --state open --json number,title,labels,updatedAt` (3 open issues:
  #1680/#1681/#1682, each `task` + one `size:*` label only — **no `backlog`/`roadmap` on any**, no
  `needs-ruling` on any; #1682 confirmed to genuinely exist — a first `gh issue view 1682` call
  transient-errored, a second `--repo`-qualified call plus a title-text search both returned it
  live, `state: OPEN`, `createdAt: 2026-08-27T00:59:10Z`, body matches decision-watcher's cited
  defect exactly — **not** a narrated-but-absent claim, the filing genuinely landed) · `gh issue
  view 1680/1681 --json body` (both bodies grepped for a `Blocked-by:` line — **none found on
  either**, per `blocked-by-rules`).
- **UNMEASURED**: none — both `gh` sources reachable all firing (issue-sorter's own check; my own
  live spot-check all succeeded); `git` reachable throughout. `[]`.
- **Corrections vs the prior plan** (2026-08-26T22:05:00Z):
  - Prior 1.1 (land the 22:05:00Z ops state) — **DONE**: commit `227c87d4` ("ops: 2026-08-26T22:05Z
    sweep state — checkpoint re-baseline, 4 ADR queue rows cleared"), confirmed by `git log`.
    Superseded by this firing's own 1.1.
  - Prior 3.1 (queue-clear adr-0030/0032/0033/0035) — **DONE**, per this dispatch's own note and
    independently confirmed: `revalidation-queue.json` no longer carries any of those 4 ids.
    Dropped, not re-proposed.
  - Prior 4.1 (harvest the ADR-restatement-gap fix via `/make-pack`) — **STILL OPEN, carried
    forward, now held at the top of §4 for the 3rd firing running** — `adr-queue.json`'s candidate
    count is flat at 6 of 7 rows (no growth, no shrinkage, since the last firing) — see Verdict.
  - Prior 4.2 (file a task for adr-0040's recurring silent budget re-basing) — **STILL OPEN, not
    filed anywhere yet, carried forward to the 2nd consecutive firing named** — `revalidation-queue.json`'s adr-0040 row is unchanged and no matching issue exists on a live `gh
    issue list` check.
  - Prior 4.3 (harvest adr-0129's dual-maintained-CSS-drift class) — **STILL OPEN, carried
    forward, now 5 consecutive firings unconverted** (queued_at unchanged at
    2026-08-25T17:57:12Z).
  - No entry dropped as parked — 3 open issues exist this firing (#1680/#1681/#1682), none carries
    `backlog` or `roadmap` — nothing to park.
- **New this firing** (issue-sorter): clean no-op — #1680/#1681 both already correctly minted and
  labeled at filing time, no duplicate, 0 PRs, 0 held items, both checkpoint sources advance.
- **New this firing** (repo-cleaner): git surface unchanged from the prior firing; the
  reap-worktrees classification gap still held (tracked #1680, unclaimed); no execute-gate actions.
- **New this firing** (decision-watcher, forward mode): clean no-op, 226/226 ADRs unchanged —
  independently confirms both the checkpoint re-baseline and the adr-0030/0032/0033/0035
  queue-clear landed correctly.
- **New this firing** (decision-watcher, revalidation mode, cursor 40→45): adr-0044/adr-0045
  confirmed, no action. adr-0042/adr-0043/adr-0046 falsified — **all three now fully accounted for
  by exactly two GitHub issues**: adr-0042 and the rename-half of adr-0046 were already inside
  agent-ui#1681's 24-candidate list; adr-0043 was a genuine miss by #1681's original regex sweep,
  now appended as its 25th instance (confirmed live in #1681's own Findings section, dated
  2026-08-27 — the append genuinely landed); adr-0046's second, unrelated defect (the orphaned
  self-contradicting "Status: proposed" fragment on its literal last line) is filed separately as
  agent-ui#1682 (confirmed live, OPEN, body matches). All three **ACTIONED, not open, not
  re-proposed here.**
- **Cross-cutting observation, new this firing**: `revalidation-queue.json`'s 7 open rows now
  resolve to exactly two buckets — 6 rows (adr-0036/0038/0041/0042/0043/0046) trace to the single
  unclaimed `size:big` task agent-ui#1681, and 1 sub-defect (adr-0046's second problem) traces to
  agent-ui#1682 — leaving **adr-0040 as the only revalidation-queue finding with no ticket at all**,
  now the 2nd consecutive firing this has been true. This sharpens 4.2 below from "a new finding"
  to "the one orphaned gap in an otherwise fully-tracked queue."
- **needs-ruling lane**: none this firing — of the 3 open issues, none carries the `needs-ruling`
  label (#1680/#1681/#1682 each carry `task` + one `size:*` label only, verified via live `gh`
  read). §3 is empty for a different reason this firing (see below), not because of this lane.
- **Blocked-by convention (#193)**: 3 open issues this firing (#1680, #1681, #1682); grepped all
  three bodies for a `Blocked-by:` line — **none found on any**. No blocker relationship changes
  any entry's ordering below.
- **Verdict — the revalidation queue's real orphaned surface is now exactly one ADR, and the
  ADR-restatement-gap harvest decision has gone from growing to flat**: `adr-queue.json`'s
  restatement-gap candidate count held at 6 rows this firing (no growth, no shrinkage) — the
  corpus-wide defect shape is fully worked (9 of 9 known instances individually fixed via landed
  Amendments), only the doc-standards convention documenting it for the next ADR author is still
  unwritten; batching has nothing left to wait for. Separately, the cross-cutting observation above
  means the revalidation queue's 7 open rows are no longer 7 independent problems needing 7
  independent triages — 6 are already one filed, unclaimed `size:big` task (#1681) plus one filed
  `size:small` task (#1682); only **adr-0040** sits with zero ticket, zero owner, 2 firings running.
  That makes 4.2 this firing's sharpest, cheapest (~10 min) unblocked action.

Queue order: (1) gated mutations verified safe → (2) blockers → (3) human decisions → (4) hygiene.

## 1. Gated mutations already verified safe

### 1.1 Land this firing's ops state — one commit, ops paths ONLY (dispatching host; 5 min)
- **Action**: `git add` exactly: `.claude/ops/revalidation-queue.json` (modified, +3 rows:
  adr-0042/adr-0043/adr-0046, now 7 total), `.claude/ops/revalidation-checkpoint.json` (modified,
  cursor 40→45), `.claude/ops/watch-checkpoint.json` (modified, both `gh_issues`/`gh_prs` →
  2026-08-27T01:10:00Z), `.claude/ops/reports/2026-08-27T011000Z-issue-sorter.md` (new),
  `.claude/ops/reports/2026-08-27T011000Z-repo-cleaner.md` (new),
  `.claude/ops/reports/2026-08-27T011000Z-decision-watcher.md` (new), plus this plan's own payload
  once applied — then commit on `main`. Do NOT stage `.claude/ops/adr-checkpoint.json` or
  `.claude/ops/adr-queue.json` (both correctly unchanged this firing — forward mode was a clean
  no-op) and do NOT stage `.claude/ops/sweep-in-flight.json` (this sweep's own live marker, same
  exclusion as every prior firing).
- **Owner**: dispatching host (the ops-write split's dispatching session).
- **Evidence**: `git status --porcelain` this compute pass (3 modified + 3 untracked ops paths
  this seat's own remit; `adr-checkpoint.json`/`adr-queue.json` correctly absent from the modified
  set); `ops-write-sandbox-rules` (dispatcher applies + lands payloads).
- **Size**: 5 minutes.

## 2. Blocking other work

(none — 0 open PRs, primary exactly current with `origin/main`; no entry blocks another this
firing; both open task issues, #1680 and #1681, carry no `Blocked-by:` line and name no blocker.)

## 3. Human-decision items

(none this firing — no revalidation row is newly fixed-and-ready for a `queue-clear` confirm
[all 7 open rows still await either agent-ui#1681 or agent-ui#1682 landing, or adr-0040's own
still-unfiled fix], and no issue carries `needs-ruling`. The last batch confirm, §3.1 on the
prior plan, is DONE and dropped above.)

## 4. Hygiene debt

### 4.1 Harvest the ADR-restatement-gap fix now via `/make-pack` (Kim; ~20 min) — held at top of §4 for the 3rd firing running
- **Action**: `adr-queue.json` still carries 6 rows proposing the identical fix (extend
  `.claude/skills/doc-standards/references/adr-log-mechanics.md`'s Amendment/Supersession/
  Extension table with a 4th row for "a header-recorded partial supersession whose Decision-body
  prose goes unrestated until a dedicated Amendment") — adr-0021, adr-0025, adr-0030, adr-0032,
  adr-0033, adr-0035, unchanged since the last firing (no growth, no shrinkage — the corpus-wide
  defect shape is fully worked: all 9 known instances now have their own landed Amendment). The fix
  text is already drafted verbatim in `adr-queue.json`'s own `plan` field — this is purely a
  batching decision, not a design decision, and batching has nothing left to wait for. Same lane as
  the 5-candidate batch shipped via #1607 (commit `e91d612b`).
- **Owner**: Kim (`/make-pack` runner).
- **Evidence**: `.claude/ops/adr-queue.json` (6 of 7 rows, identical `plan` field, byte-unchanged
  vs. the prior firing's read); precedent commit `e91d612b` (#1607).
- **Size**: ~20 minutes once run.

### 4.2 File a task for adr-0040's recurring silent budget re-basing (Kim; ~10 min) — 2nd consecutive firing named, now the queue's only fully-orphaned finding
- **Action**: ADR-0040's own 2026-08-16 Amendment argued explicitly for ending silent,
  script-comment-only budget re-basing after finding 11 prior undocumented instances — yet the
  same row has been silently re-based ≥8 more times since (58KB→70KB+ per `measure-size.mjs`'s own
  comment ladder), none fed back as a further Amendment. Unlike every other row in
  `revalidation-queue.json` (all 6 of the others now trace to agent-ui#1681 or #1682, both
  confirmed filed and live), **adr-0040 still has no ticket at all** — file one (owner: unassigned
  per `revalidation-queue.json`) asking for either a further dated Amendment recording the current
  real budget, or a process fix that makes re-basing feed back automatically — the choice is the
  ticket-owner's, not decided here. Distinct root cause from 4.1/4.3 and from #1681's ADR-0140
  rename-propagation cause (adr-0040's staleness is a re-basing-discipline gap, not a token-rename
  gap) — do not fold it into either.
- **Owner**: Kim (file-task runner); any available dev to action once filed.
- **Evidence**: `.claude/ops/revalidation-queue.json`'s adr-0040 row (full 58KB→70KB+ ladder
  evidence, unchanged since last firing); ADR-0040's own 2026-08-16 Amendment text (the fix it
  argued for, now recurring); live `gh issue list` confirming no matching issue exists.
- **Size**: ~10 minutes to file; further sizing depends on the fix chosen.

### 4.3 Harvest adr-0129's dual-maintained-CSS-drift class (Kim; ~15–20 min) — queued since 2026-08-25T17:57:12Z, now 5 consecutive firings unconverted
- **Action**: `adr-0129`'s row (unchanged mtime and evidence text this firing) flags a
  generalizable defect class — a promoted control's CSS drifting as dual-maintained truth between
  its site-consumer copy and its package-owned canonical copy (GH #1163's root-card logic and
  ADR-0100's container-type repair both independently missed one copy) — not yet covered by any
  `references/*.md`. Distinct fix target from 4.1 (different pattern, different target doc);
  restated again because it is now the single most stale unconverted item in this queue.
- **Owner**: Kim (`/make-pack` runner).
- **Evidence**: `.claude/ops/adr-queue.json`'s adr-0129 row (full evidence text, citing GH #1163
  and ADR-0100, byte-unchanged since 2026-08-25T17:57:12Z);
  `.claude/docs/adr/0129-app-surfaces-m2-composition-and-transport-boundary.md` L70-107 (Amendment
  2, the artboard-extraction precedent this harvest would generalize from).
- **Size**: ~15–20 minutes.

## Standing notes (not queue entries)

- **Prior plan (2026-08-26T22:05:00Z) fully triaged**: its 1.1 landed (`227c87d4`); its 3.1
  (queue-clear) landed and is dropped; its 4.1/4.2/4.3 all carry forward above, each one firing
  more stale.
- **Three open issues this firing, none of them a plan queue entry**: #1680 (reap-worktrees
  classification gap) and #1681 (ADR-0140 rename sweep, now 25 candidates per its own Findings)
  were both already ACTIONED as of the prior firing and remain unclaimed but properly filed; #1682
  (adr-0046's orphaned status-line fragment) is new this firing, confirmed live and correctly
  filed. None carries `backlog`/`roadmap`; none is re-proposed here — filed work stays tracked on
  its own issue, not duplicated into this plan.
- **Repo surface is at a clean floor apart from those 3 unclaimed issues**: 0 open PRs, primary at
  exact parity with `origin/main` — the entire actionable queue this dispatch is hygiene debt (§4);
  §2 and §3 are both empty this firing.
- **Fleet-bootstrap context (standing, not a finding)**: the reviewer seat
  (`.claude/worktrees/agent-ui-reviewer`, branch `reviewer-worktree-2026-08-26`) and the planner
  seat from `/teamwork:fleet-bootstrap` remain live and idle. The reviewer's own worktree is what
  `reap-worktrees.mjs` still misreads as reapable — see agent-ui#1680 (open, unclaimed).
- **Two cross-cutting rename/tooling findings tracked entirely on GitHub, not on this plan**:
  agent-ui#1681 (ADR-0140 rename-propagation, 25 candidates as of this firing) and agent-ui#1682
  (adr-0046's orphaned status line) — both confirmed live, both out of this plan's action list by
  design (filed work is tracked on its own issue).
- **No entry parked this firing** — 3 open issues exist, none carries `backlog`/`roadmap`.
- **Dirty `main` markers**: `.claude/ops/sweep-in-flight.json` (this sweep's own live marker —
  leave until the sweep concludes).
- **gen-ui-kit**: out of this board's scope (dedicated session per Kim's ruling).

*Composed by chore-planner, 2026-08-27T01:10:00Z sweep firing — returned as payload per the #125
ops-write split; written and landed by the dispatching session.*
