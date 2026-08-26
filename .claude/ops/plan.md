<!-- target-path: .claude/ops/plan.md -->
# Ops plan — agent-ui

- **Dispatch**: 2026-08-26T01:57:30Z sweep firing (chore-planner, /sweep-chores fallback fan-out —
  no repo-local `harness/` tree, so the coordinating session dispatched issue-sorter, repo-cleaner,
  decision-watcher directly via `Agent` rather than the Workflow tool). All three seats reported
  successfully; their state is already applied to `.claude/ops/`. Judged those three reports plus
  the prior plan (carry-forward only) and durable state (`held-items.md`, `rulings.md`,
  `revalidation-queue.json`, `adr-queue.json`, `adr-checkpoint.json`); a light `git log`/`gh`
  spot-check confirmed every prior-plan entry's claimed resolution is real on disk, plus pulled the
  full body/comments of #1653 and #1661 (both named by the seat reports) since their content is
  load-bearing for this firing's §3/§4 entries — not a re-judging of seat evidence.
- **Evidence**: `reports/2026-08-26T01:57:30Z-issue-sorter.md` (20 issues + 16 PRs since the
  2026-08-25T17:55:43Z checkpoint, the docs/catalog audit campaign — all already filed/labeled/
  closed by the campaign's own intake dispatches, all trusted-author kimgranlund, nothing newly
  minted; one observation not acted on: #1653 carries both `bug`+`needs-ruling`; checkpoint
  advanced) · `reports/2026-08-26T015730Z-repo-cleaner.md` (git surface fully clean: 0 open PRs, 1
  worktree (primary, exact match `origin/main`), 10 stale tracking refs pruned; 33 orphaned
  scratch-clone dirs found (~6.4G) — 32 stale, independently verified per-ticket and already
  removed out-of-band by the dispatching host before this compute pass, confirmed absent; 1 live
  (`agent-ui-1634`, correctly untouched); tooling-gap ticket #1661 filed separately; new 🟡: the
  `ops:reap-branches`/`ops:reap-worktrees` npm scripts aren't named in `CLAUDE.md`/`README.md`) ·
  decision-watcher's applied state (no separate report file this firing — state files + this
  dispatch's own prose are the evidence): `adr-checkpoint.json` (Forward mode: confirmed
  adr-0021/adr-0025 restatements landed, no new forward candidate), `adr-queue.json` (3 harvest
  candidates: adr-0129 dual-maintained-CSS-drift class, carried forward; adr-0021 + adr-0025, new,
  both proposing the same `adr-log-mechanics.md` 4th-row extension), `revalidation-checkpoint.json`
  (cursor 25→30), `revalidation-queue.json` (adr-0030 newly falsified, replacing the now-resolved
  adr-0021/adr-0025 rows) · `git log` confirming commits `5095d64b` (prior firing's own ops-state
  land), `6cf0d78a`/`9f002004` (ADR-0021/0025 restatement PRs #1636/#1635), `b96ea3ce` (held-items
  refresh, plan 4.3), `c9065cfa` (PR #1656, ADR-0129 Am.2 extraction, closing #1618) · live `gh
  issue view` on #1653 (full body + the build-1639 investigation comment) and #1661 (full body) ·
  `packages/agent-ui/components/src/controls/column/column.ts:30-42` and
  `.claude/docs/adr/0030-column-default-cross-axis-stretch.md:29-39` (adr-0030's own Decision cl.1
  text vs. shipped code) · `package.json:30-31` (the two `ops:reap-*` script names) vs. `grep` on
  `CLAUDE.md`/`README.md` (neither names them).
- **UNMEASURED**: none — all three seats reported successfully; `gh` and `git` both reachable
  (issue-sorter's checkpoint advance, repo-cleaner's own `gh pr list`/`gh issue list`, this compute
  pass's own live `gh issue view` calls). `[]`.
- **Corrections vs the prior plan** (2026-08-25T17:55:43Z) — three of four entries resolved:
  - Prior 1.1 (land the 2026-08-25T17:55:43Z ops state) — **DONE**: commit `5095d64b` ("ops:
    2026-08-25T17:55Z sweep state — ADR-0129 ratified/harvested, ADR-0021/0025 falsified, plan
    refresh"), confirmed by `git log`. Superseded by this firing's own 1.1.
  - Prior 4.1 (file dated restatement amendments for ADR-0021/ADR-0025) — **DONE, shipped
    end-to-end**: issues #1631 (ADR-0021)/#1632 (ADR-0025) closed via merged PRs #1636 (commit
    `6cf0d78a`)/#1635 (commit `9f002004`). decision-watcher's Forward-mode pass this firing
    independently confirmed both restatements landed correctly. Dropped as completed-per-spec.
  - Prior 4.2 (harvest ADR-0129 Amendment 2 via `/make-pack`) — **STILL OPEN, carried forward as
    new 4.2**: unchanged Kim-batched action, but the queue grew from 1→3 candidates this firing
    (decision-watcher added adr-0021 + adr-0025, both proposing the same target-doc extension). See
    New this firing below.
  - Prior 4.3 (refresh held-items.md's stale "Still Kim's, open" resolutions) — **DONE**: commit
    `b96ea3ce` ("ops: mark held-items.md's stale \"Still Kim's, open\" resolutions closed (plan
    4.3)"); `held-items.md` now reads all three items resolved.
  - No entry dropped as parked — live scan of both currently-open issues (#1634, #1653) carries
    neither `backlog` nor `roadmap`.
- **New this firing** (decision-watcher, via applied state):
  - Forward mode: no new candidate — adr-0129 already ratified/queued last firing; this pass only
    confirmed adr-0021/adr-0025's restatements landed (see Corrections).
  - Revalidation mode: cursor 25→30 — **adr-0030 newly falsified**, a 6th worked instance of the
    same drift class the two pending harvest rows (adr-0021, adr-0025) are about: Decision cl.1's
    own stated design ("the value vocabulary is NOT re-listed... if `flexProps.align` ever grows a
    sixth member, column inherits it with zero drift") no longer matches shipped code —
    `column.ts:42` narrows `align` to a column-local 4-member enum (`center` dropped), with its own
    header comment naming it "Kim's directive," present since the original build commit. Unlike
    adr-0021/0025 (header already recorded the supersession, only the body needed restating),
    adr-0030 carries **no** header Supersedes/Amendment note at all — a slightly earlier stage of
    the same gap. Queues as new 4.1, hygiene debt.
  - The revalidation queue now carries exactly one candidate (adr-0030) — the adr-0021/adr-0025
    rows correctly cleared once their amendments landed.
- **New this firing** (issue-sorter): 20 issues + 16 PRs from the just-completed docs/catalog audit
  campaign, all already correctly filed/labeled/closed by the campaign's own intake dispatches —
  clean no-op for this seat's own remit. One observation, not acted on: #1653 carries both `bug`
  and `needs-ruling` — may be deliberate origin-context from its `docs:file-bug` filing route, or a
  labeling slip; left for a human/later firing rather than guessed at. Checkpoint advanced.
- **New this firing** (repo-cleaner): 32 orphaned scratch-clone directories (~6.4G, a `git clone`
  class `git worktree list` never sees) already resolved out-of-band by the dispatching host before
  this compute pass — confirmed absent. Tooling-gap ticket #1661 filed separately for a real gated
  reap-scratch-clones script. New 🟡: the two existing `ops:reap-*` npm scripts aren't named in
  `CLAUDE.md`/`README.md` today, only in `package.json` and this seat's own prior-firing precedent.
  One live in-progress ticket claim (#1634, build-1634, /status probe hardening, ~47 min old at
  read time) correctly untouched, not a plan entry.
- **needs-ruling lane**: #1653 ("ADR-0023(c) plan-approval write-gate inconsistently enforced") is
  the repo's only `needs-ruling`-labeled issue this firing — referenced by id in §3.1 below, not
  restated as its own prose lane. The issue's own thread already carries an investigation finding
  (build-1639's comment): bug-kind tickets structurally never reach the Phase 5 stage 2a write-gate
  by design (`dispatch-ticket` SKILL.md:87-88) — this is a design question (is the bug-kind/
  feature-kind asymmetry intentional-and-fine, or worth closing), not the process-integrity defect
  originally filed. #1653 carries no assignee and no `Blocked-by:` line.
- **Blocked-by convention (#193)**: checked both open issues' bodies directly — #1634 carries no
  `Blocked-by:` line (also not a plan entry, live build); #1653 carries no `Blocked-by:` line.
  #1661 (named in 4.3) also carries no `Blocked-by:` line. No queue entry sits behind a named
  blocker this firing.
- **Verdict**: full consolidation, third consecutive firing. Three of the prior plan's four
  entries are resolved end-to-end; the fourth (ADR harvest) carries forward unchanged in kind, only
  grown from 1→3 queued candidates. What's new: ADR-0030 joins the falsified-restatement pattern as
  its 6th instance (hygiene), a scratch-clone tooling gap already has its own ticket needing
  someone to actually build it (hygiene), a small doc-naming gap on the reap scripts (hygiene), and
  one human-decision item — #1653, already investigated down to a design question, needs Kim's
  call. No blockers, no parked drops, no UNMEASURED sections, no narrated-but-absent claims.

Queue order: (1) gated mutations verified safe → (2) blockers → (3) human decisions → (4) hygiene.

## 1. Gated mutations already verified safe

### 1.1 Land this firing's ops state — one commit, ops paths ONLY (dispatching host; 5 min)
- **Action**: `git add` exactly: `.claude/ops/adr-checkpoint.json` (modified, Forward-mode
  confirm pass), `.claude/ops/adr-queue.json` (modified, +2 harvest candidates: adr-0021,
  adr-0025), `.claude/ops/revalidation-checkpoint.json` (modified, cursor advanced to 30),
  `.claude/ops/revalidation-queue.json` (modified, adr-0021/adr-0025 rows cleared, adr-0030 row
  added), `.claude/ops/watch-checkpoint.json` (modified, both sources advanced to
  2026-08-26T01:57:30Z), `.claude/ops/reports/2026-08-26T01:57:30Z-issue-sorter.md` (new),
  `.claude/ops/reports/2026-08-26T015730Z-repo-cleaner.md` (new), plus this plan's own payload once
  applied — then commit on `main`. Do NOT stage `.claude/ops/sweep-in-flight.json` (this sweep's
  own live marker, same exclusion as every prior firing).
- **Owner**: dispatching host (the ops-write split's dispatching session).
- **Evidence**: `git status --porcelain=v1 -b` this compute pass (5 modified + 2 untracked ops
  paths, plus the excluded sweep marker); `ops-write-sandbox-rules` (dispatcher applies + lands
  payloads).
- **Size**: 5 minutes.

## 2. Blocking other work

(none — 0 open PRs; primary exactly current with `origin/main` (0 ahead/0 behind); no entry blocks
another this firing.)

## 3. Human-decision items

### 3.1 Rule on #1653 — is the bug-kind/feature-kind write-gate asymmetry intentional, or worth closing (Kim; ~5 min)
- **Action**: #1653 ("ADR-0023(c) plan-approval write-gate inconsistently enforced on bug-kind
  tickets") is the repo's only `needs-ruling`-labeled issue this firing. Its own thread already
  carries the decision text (build-1639's investigation comment): bug-kind tickets structurally
  never reach the Phase 5 stage 2a write-gate by design, per `dispatch-ticket` SKILL.md:87-88 — not
  a process-integrity bug. What's still open is a design question: is that asymmetry between
  bug-kind and feature/task-kind tickets (bug-kind skips the pre-PR-open human visibility gate)
  intentional-and-fine, or worth closing. The comment recommends downgrading severity or closing
  as working-as-designed; Kim's call, not this seat's. Not restated further here — see #1653 for
  the full decision text.
- **Owner**: Kim.
- **Evidence**: `gh issue view 1653` (labels `bug`+`needs-ruling`, no assignee, no `Blocked-by:`
  line); the issue's own investigation comment (build-1639, dispatch-ticket SKILL.md:87-88 cite).
- **Size**: ~5 minutes (a ruling comment + label/close action).

## 4. Hygiene debt

### 4.1 File a dated restatement amendment for ADR-0030 — 6th instance of the falsified-restatement class (any available dev; ~20 min) — new this firing
- **Action**: decision-watcher's Revalidation pass (cursor 25→30) falsified adr-0030: Decision
  cl.1's own text says the shared `flexProps.align` enum is reused verbatim with "the value
  vocabulary... NOT re-listed" so a future sixth member would flow through with "zero drift," but
  shipped code diverges intentionally — `column.ts:30-42` narrows `align` to a column-local
  4-member enum (`['stretch','start','end','baseline']`, `center` dropped), with its own header
  comment naming it "Kim's directive," present since the original build commit. Unlike
  adr-0021/adr-0025 (header already recorded the supersession, only the body needed restating),
  ADR-0030's header carries no Supersedes/Amendment note at all yet. File a task appending a dated
  amendment section restating the actual 4-member column-local enum and citing the code comment,
  mirroring the adr-0015/0017/0018/0021/0025 precedent (issues #1614/#1623/#1624/#1631/#1632 →
  merged PRs #1615/#1625/#1626/#1636/#1635).
- **Owner**: any available dev (`revalidation-queue.json`'s adr-0030 row reads `owner:
  "unassigned"`).
- **Evidence**: `.claude/ops/revalidation-queue.json` (adr-0030 candidate, queued_at
  2026-08-26T02:01:17Z); `.claude/docs/adr/0030-column-default-cross-axis-stretch.md:27-39`
  (Decision cl.1, "zero drift" claim); `packages/agent-ui/components/src/controls/column/column.ts:30-42`
  (the narrowing + its "Kim's directive" comment).
- **Size**: ~20 minutes (single clause, single file to amend).

### 4.2 Harvest 3 ADR-queue candidates into reference docs — via /make-pack (Kim; batch-paced, no urgency) — carried forward, queue grown
- **Action**: `adr-queue.json` now carries 3 harvest candidates: adr-0129 (dual-maintained-CSS-drift
  defect class, GH #1163 + the ADR-0100 `container-type` repair each missing one copy after a
  promotion — not yet covered by any `references/*.md`), and two new rows, adr-0021 + adr-0025,
  both proposing the same target: extend `.claude/skills/doc-standards/references/adr-log-mechanics.md`'s
  Amendment/Supersession/Extension table with a 4th row for "a header-recorded partial supersession
  whose Decision-body prose goes unrestated until a dedicated Amendment" — now a 6-instance pattern
  once 4.1's adr-0030 amendment lands (adr-0007/0017/0018/0021/0025/0030). Same lane as the
  5-candidate batch shipped via #1607 (commit `e91d612b`); no urgency to run solo at 3.
- **Owner**: Kim (chooses when to batch and run `/make-pack`).
- **Evidence**: `.claude/ops/adr-queue.json` (3 candidates: adr-0129 queued_at
  2026-08-25T17:57:12Z, adr-0021/adr-0025 queued_at 2026-08-26T02:01:05Z); precedent commit
  `e91d612b`.
- **Size**: ~20 minutes once batched; the batching itself is unscheduled.

### 4.3 Build the gated reap-scratch-clones script — #1661 (any available dev; ~1-2 hours) — new this firing
- **Action**: repo-cleaner's scratch-clone finding (32 stale dirs, ~6.4G, already resolved
  out-of-band this firing) surfaced a real tooling gap: neither `reap-worktrees.mjs` nor
  `reap-branches.mjs` ever looks at scratch-clone directories outside `.claude/worktrees/`. A
  tracking issue (#1661) is already filed with acceptance criteria (a new gated script or an
  extension of `reap-worktrees.mjs`'s propose-by-default/`--execute` shape, wired into `npm run
  ops:*`, run by `repo-cleaner`'s standing sweep) — this entry queues the actual build, not the
  filing (already done). #1661's own Scope/Open section flags two open sub-problems to resolve
  during the build: reliable candidate discovery (no single hardcoded parent path) and a liveness
  signal for "in-progress" scratch clones (no worktree-lock analog for a plain clone — needs
  something like held-items.md's live-ticket-claim check).
- **Owner**: any available dev.
- **Evidence**: `gh issue view 1661` (full acceptance criteria + Scope/Open); this firing's
  `reports/2026-08-26T015730Z-repo-cleaner.md` (32/33 clone inventory, per-ticket cross-check
  against `gh pr list`/`gh issue view`).
- **Size**: ~1-2 hours (new script + npm wiring + repo-cleaner sweep integration + liveness-signal
  design).

### 4.4 Name `ops:reap-branches`/`ops:reap-worktrees` in CLAUDE.md or README (any available dev; ~10 min) — new this firing
- **Action**: repo-cleaner flagged (🟡) that both existing gated reap scripts are invoked on
  prior-firing precedent alone — neither `CLAUDE.md` nor `README.md` names them today, only
  `package.json`'s own script block. Add one line naming both under CLAUDE.md's existing Commands
  or Always section so a future firing (or a human) can confirm the naming convention without
  relying on this seat's own memory of precedent.
- **Owner**: any available dev.
- **Evidence**: `package.json:30-31` (`ops:reap-branches`, `ops:reap-worktrees` script entries);
  `grep -n "reap" CLAUDE.md README.md` this compute pass (only a prose mention of "reap-on-return"
  in CLAUDE.md:88, no script name in either file).
- **Size**: ~10 minutes.

## Standing notes (not queue entries)

- **Prior plan (2026-08-25T17:55:43Z) nearly fully cleared**: 3 of 4 entries DONE (ops-state land,
  ADR-0021/0025 restatements, held-items refresh); the 4th (ADR harvest) carries forward unchanged
  in kind, grown from 1→3 candidates — see 4.2.
- **#1653's dual `bug`+`needs-ruling` label** (issue-sorter's observation, not acted on) — may be
  deliberate origin-context from its `docs:file-bug` filing route, or a minor convention slip; left
  for a human or a later firing rather than guessed at here.
- **held-items.md's "Kim's ruling/merge queue" section does not yet list #1653** — that ledger is
  issue-sorter's own state file (out of this compute-only seat's write scope); worth a future
  issue-sorter firing adding it there once/if Kim's 3.1 ruling is still pending at that point.
- **Intake clean**: issue-sorter — 20 issues + 16 PRs since the 2026-08-25T17:55:43Z checkpoint,
  all already resolved/labeled from the docs/catalog audit campaign, all trusted-author
  kimgranlund. Checkpoint advanced for both `gh_issues`/`gh_prs`.
- **Zero open PRs, exactly 2 open issues** (#1634 live/untouched, #1653 in §3.1) — cleanest
  git-surface reading of the last several firings (repo-cleaner).
- **No entry parked this firing** — both open issues (#1634, #1653) carry neither `backlog` nor
  `roadmap`.
- **Dirty `main` markers**: `.claude/ops/sweep-in-flight.json` only (this sweep's own live marker,
  session `agent-ui-90` — leave until the sweep concludes).
- **gen-ui-kit**: out of this board's scope (dedicated session per Kim's ruling).

*Composed by chore-planner, 2026-08-26T01:57:30Z sweep firing — returned as payload per the #125
ops-write split; written and landed by the dispatching session.*

Dispatch: 2026-08-26T01:57:30Z
