<!-- target-path: .claude/ops/plan.md -->
# Ops plan — agent-ui

- **Dispatch**: 2026-08-25T17:55:43Z sweep firing (chore-planner, /sweep-chores fallback fan-out —
  no repo-local `harness/` tree, so the coordinating session dispatched issue-sorter, repo-cleaner,
  decision-watcher directly via `Agent` rather than the Workflow tool). All three seats reported
  successfully; their state is already applied to `.claude/ops/` by the dispatching session. Judged
  those three reports plus the prior plan (carry-forward only) and durable state (`held-items.md`,
  `rulings.md`, `revalidation-queue.json`, `adr-queue.json`, `adr-checkpoint.json`); a light `git
  log`/`gh` spot-check confirmed, at the dispatch's own explicit request, that the prior firing's
  queue-clear commit (`851f1b8f`) landed correctly and that every prior-plan entry's claimed
  resolution is real on disk — not a re-judging of seat evidence.
- **Evidence**: `reports/2026-08-25T17:55:43Z-issue-sorter.md` (3 issues + 3 PRs since the
  2026-08-25T00:59:54Z checkpoint — #1623/#1624 CLOSED, already labeled `task`+`size:small`;
  #1618 OPEN `needs-ruling`+`in-flight`, no action; PRs #1625/#1626/#1617 MERGED, trusted-author
  kimgranlund — clean no-op sweep, checkpoint advanced) · `reports/2026-08-25T175543Z-repo-cleaner.md`
  (git surface fully clean: 0 open PRs — #1617 merged since last firing — 0 orphaned worktrees, 0
  stale local branches, primary exact match with `origin/main`; both findings flagged last firing
  independently confirmed resolved; exactly 1 open issue #1618, live in-progress build claim
  (build-1618, ~13h fresh) correctly untouched) · decision-watcher's applied state:
  `adr-checkpoint.json` (Forward mode: adr-0017/adr-0018 restatements landed, no new candidate;
  adr-0129 Amendment 2 ratified, queued as a harvest candidate), `adr-queue.json` (1 candidate:
  adr-0129 harvest), `revalidation-checkpoint.json` (cursor 20→25), `revalidation-queue.json`
  (adr-0021 and adr-0025 both newly falsified, owner unassigned; adr-0015/0017/0018 rows correctly
  absent — confirmed queue-cleared by commit `851f1b8f`, matching the dispatch's own note verbatim)
  · the prior plan (2026-08-25T00:59:54Z compose, carry-forward only) and `held-items.md`/`rulings.md`
  · `git log` confirming commits `959e7698` (ratify ADR-0129 Amendment 2), `c28f79fe`/`b8687d26`
  (ADR-0018/0017 restatements, PRs #1625/#1626), `c03701a9` (queue-clear adr-0015), `851f1b8f`
  (queue-clear adr-0017/0018), `b7232680` (PR #1617 merge).
- **UNMEASURED**: none — all three seats reported successfully; `gh` and `git` both reachable
  (issue-sorter's checkpoint advance, repo-cleaner's own `gh pr list`/`gh issue list`, this compute
  pass's own confirms). `[]`.
- **Corrections vs the prior plan** (2026-08-25T00:59:54Z) — every entry resolved:
  - Prior 1.1 (land the 2026-08-25T00:59:54Z ops state) — **DONE**: commit `1cde0e3b` ("ops:
    2026-08-25T00:59Z sweep state — ADR-0017/0018 falsified, plan refresh"), confirmed by `git log`.
    Superseded by this firing's own 1.1.
  - Prior 3.1 (ratify or decline ADR-0129 Amendment 2, gated on #1618) — **DONE, ratified**: Kim
    posted the literal `ratify ADR-0129 amendment` comment 2026-08-25T04:51:45Z
    (github.com/kimgranlund/agent-ui/issues/1618#issuecomment-5405393381); `adr_ratify.py` flipped
    it, commit `959e7698` ("docs(adr): ratify ADR-0129 Amendment 2 (shared artboard core
    extraction)") — confirmed live, the ADR's Amendment header now reads "(2026-08-24, **ratified**
    — kimgranlund, [utterance], verified 2026-08-25)". A build claimed the extraction 3 minutes
    later (comment 2026-08-25T04:54:52Z, build-1618, branch `1618-adr-0129-amendment-2`) — fresh
    (~13h old per repo-cleaner), correctly untouched, dev work out of this plan's ops-mechanism
    scope. Issue #1618 stays OPEN tracking that build only; its `needs-ruling` label is now stale
    (see Standing notes — not queued as a distinct action).
  - Prior 4.1 (file dated restatement amendments for ADR-0017/ADR-0018) — **DONE, shipped
    end-to-end**: issues #1623 (ADR-0017)/#1624 (ADR-0018) both filed and closed, PRs #1625
    (commit `c28f79fe`, ADR-0018 cl.1 → `--md-sys-shape-corner-base`)/#1626 (commit `b8687d26`,
    ADR-0017 cl.3 → `persistent`) merged. Dropped as completed-per-spec.
  - Prior 4.2 (queue-clear the adr-0015 row) — **DONE**: commit `c03701a9` ("ops: queue-clear
    ADR-0015's resolved revalidation row (plan 4.2)"); `revalidation-queue.json` carries no
    adr-0015 entry this firing.
  - Same-session follow-through (not itself a numbered prior entry): once #1625/#1626 landed,
    adr-0017's and adr-0018's own now-resolved revalidation rows were queue-cleared too, commit
    `851f1b8f` — confirmed: `revalidation-queue.json` carries exactly two candidates this firing
    (adr-0021, adr-0025); adr-0015/0017/0018 do not reappear. Matches the dispatching session's own
    note verbatim.
  - No entry dropped as parked — live scan of the only currently-open issue (#1618) carries
    neither `backlog` nor `roadmap`.
- **New this firing** (decision-watcher, via applied state):
  - Forward mode: adr-0129's proposed Amendment 2 flipped to **ratified** (see Corrections above)
    and now reads as a genuinely new decision rather than a restatement — queued as a harvest
    candidate in `adr-queue.json` (dual-maintained-CSS-drift defect class, cites GH #1163 + the
    ADR-0100 `container-type` repair each missing one copy after a promotion; not yet covered by
    any `references/*.md`). Queues as new 4.2, hygiene debt (batched knowledge-management lane).
  - Revalidation mode: cursor 20→25 — **adr-0021 and adr-0025 both newly falsified**, same drift
    class as the now-closed adr-0015/0017/0018 gaps (stale Decision-body text superseded by a
    later ratified ADR, no in-file restatement amendment):
    - adr-0021: its unconditional host `min-inline-size` floor no longer holds by default —
      ADR-0223 cl.2/3(b) narrowed it to the `[inline]` (hug) posture only (`text-field.css:169-179`
      already implements the narrowing and names it in a comment); ADR-0021's own header carries no
      Supersedes/Amendment note reflecting the change.
    - adr-0025: cl.1 (variant enum), cl.3/3a (`--ui-type-*` family), cl.4 (ElementInternals heading
      mechanism) superseded by ADR-0078's three-axis model; cl.2/cl.5 stand. Narrower gap than the
      others: ADR-0025's header already records "Superseded by ADR-0078 — in part" at clause
      granularity (confirmed live) — only the in-file Decision-body restatement itself is missing.
    Both need a dated restatement amendment mirroring the adr-0015/0017/0018 precedent. Queues as
    new 4.1, hygiene debt.
- **New this firing** (issue-sorter): clean no-op — 3 issues + 3 PRs discovered, all already
  resolved/labeled from prior firings, all trusted-author kimgranlund. Checkpoint advanced. No
  action.
- **New this firing** (repo-cleaner): git surface fully clean — 0 open PRs, 0 orphaned worktrees, 0
  stale local branches, primary exact match with `origin/main`. Both findings proposed last firing
  independently confirmed resolved. One live in-progress ticket claim (#1618/build-1618) correctly
  untouched, fresh, no action proposed.
- **New this firing** (ledger hygiene, this compute pass): `held-items.md`'s 2026-08-23
  "Resolutions" section lists three items as "Still Kim's, open" that are all independently
  confirmed resolved since — see 4.3.
- **needs-ruling lane**: none outstanding this firing. #1618 is the repo's only `needs-ruling`
  -labeled issue, but the ruling it names (ratify/decline ADR-0129 Amendment 2) is already made —
  see Corrections. The label lagging the ruling is a labeling detail, not a live decision. §3 is
  empty this firing.
- **Blocked-by convention (#193)**: checked #1618's body directly — no `Blocked-by:` line. No
  queue entry sits behind a named blocker this firing.
- **Verdict**: full consolidation, second consecutive firing. Every entry from the prior plan
  (2026-08-25T00:59:54Z) is resolved end-to-end, including its own human-decision item (ADR-0129
  Amendment 2 ratified, build in flight). What's new: the freshly-ratified amendment itself queues
  as a harvest candidate (hygiene, batched, no urgency), the same falsified-restatement class
  recurs one cursor-band further out (adr-0021, adr-0025), and one ledger-hygiene finding
  (`held-items.md` reads three already-resolved items as still open). No blockers, no parked
  drops, no UNMEASURED sections, no human-decision items outstanding.

Queue order: (1) gated mutations verified safe → (2) blockers → (3) human decisions → (4) hygiene.

## 1. Gated mutations already verified safe

### 1.1 Land this firing's ops state — one commit, ops paths ONLY (dispatching host; 5 min)
- **Action**: `git add` exactly: `.claude/ops/adr-checkpoint.json` (modified, adr-0017/adr-0018
  restatement + adr-0129 ratify hash advance), `.claude/ops/adr-queue.json` (modified, adr-0129
  harvest candidate added), `.claude/ops/revalidation-checkpoint.json` (modified, cursor advanced
  to 25), `.claude/ops/revalidation-queue.json` (modified, adr-0021/adr-0025 falsified rows added),
  `.claude/ops/watch-checkpoint.json` (modified, both sources advanced to 2026-08-25T17:55:43Z),
  `.claude/ops/reports/2026-08-25T17:55:43Z-issue-sorter.md` (new),
  `.claude/ops/reports/2026-08-25T175543Z-repo-cleaner.md` (new), plus this plan's own payload once
  applied — then commit on `main`. Do NOT stage `.claude/ops/sweep-in-flight.json` (this sweep's
  own live marker, same exclusion as every prior firing).
- **Owner**: dispatching host (the ops-write split's dispatching session).
- **Evidence**: `git status --porcelain=v1 -b` this compute pass (5 modified + 2 untracked ops
  report/queue paths, plus the excluded sweep marker); `ops-write-sandbox-rules` (dispatcher
  applies + lands payloads).
- **Size**: 5 minutes.

## 2. Blocking other work

(none — 0 open PRs; primary exactly current with `origin/main` (0 ahead/0 behind); no entry
blocks another this firing.)

## 3. Human-decision items

(none outstanding this firing — ADR-0129 Amendment 2's ratify/decline decision, the prior plan's
3.1, is resolved: ratified 2026-08-25T04:51:45Z, build-1618 executing the extraction. #1618 stays
open tracking that build only; see the needs-ruling lane note above.)

## 4. Hygiene debt

### 4.1 File dated restatement amendments for ADR-0021 and ADR-0025 — same falsified-token/prop drift class as ADR-0015/0017/0018 (any available dev; ~30 min) — new this firing
- **Action**: decision-watcher's Revalidation pass (cursor 20→25) falsified both:
  - adr-0021: unconditional host `min-inline-size` floor narrowed to the `[inline]` (hug) posture
    only by ADR-0223 cl.2/3(b) — `text-field.css:169-179` already implements the narrowing with a
    comment naming it, but ADR-0021's own header carries no Supersedes/Amendment note reflecting
    the change.
  - adr-0025: cl.1 (variant enum), cl.3/3a (`--ui-type-*` token family), cl.4 (ElementInternals
    heading mechanism) superseded by ADR-0078's three-axis model; cl.2/cl.5 stand. ADR-0025's
    header already records "Superseded by ADR-0078 — in part" at clause granularity — only the
    in-file Decision-body restatement is still missing.
  File one task (or two, dev's choice) appending a dated amendment section to each, mirroring the
  adr-0015/0017/0018 precedent (issues #1614/#1623/#1624 → PRs #1615/#1625/#1626, commits
  `97227ee0`/`c28f79fe`/`b8687d26`). Once landed, both claims clear on decision-watcher's next
  Revalidation pass.
- **Owner**: any available dev (both `revalidation-queue.json` rows read `owner: "unassigned"`).
- **Evidence**: `.claude/ops/revalidation-queue.json` (adr-0021/adr-0025 candidates, queued_at
  2026-08-25T17:59:51Z); `.claude/docs/adr/0021-text-field-min-inline-size-floor.md` header row;
  `.claude/docs/adr/0025-ui-text-display-primitive-type-scale.md` header row (already has the
  supersede note; body doesn't); `packages/agent-ui/components/src/controls/text-field/text-field.css:169-179`.
- **Size**: ~30 minutes (adr-0025 touches 3 clauses vs. adr-0021's one).

### 4.2 Harvest ADR-0129 Amendment 2 into a reference doc — via /make-pack (Kim; batch-paced, no urgency) — new this firing
- **Action**: `adr-queue.json` queues adr-0129's newly-ratified Amendment 2 as a harvest candidate
  — the dual-maintained-CSS-drift defect class (GH #1163's root-card logic + the ADR-0100
  `container-type` repair each missing one copy after a promotion) isn't yet covered by any
  `references/*.md`. Same lane as the 5-candidate batch shipped via #1607 (commit `e91d612b`) —
  currently a 1-item queue; that precedent batched to 5 before running `/make-pack`, so there's no
  urgency to run this solo.
- **Owner**: Kim (chooses when to batch and run `/make-pack`).
- **Evidence**: `.claude/ops/adr-queue.json`'s adr-0129 entry (`kind: "harvest"`, queued_at
  2026-08-25T17:57:12Z); `.claude/docs/adr/0129-app-surfaces-m2-composition-and-transport-boundary.md:70-107`
  (the ratified Amendment 2 text); precedent commit `e91d612b`.
- **Size**: ~15 minutes once batched; the batching itself is unscheduled.

### 4.3 Refresh held-items.md's stale "Still Kim's, open" resolutions (dispatching host or Kim; ~5 min) — new this firing
- **Action**: `held-items.md`'s "Resolutions, 2026-08-23 (marshal refresh)" section lists three
  items as "Still Kim's, open" that are all independently confirmed resolved since: the #1583
  scratch clone (reaped — confirmed absent as of the 2026-08-24T17:08:45Z firing's own corrections)
  · local branch `pr-1590` (gone — this firing's repo-cleaner `git branch -a` shows local `main`
  only) · the 5 pending ADR harvest candidates (landed via #1607, commit `e91d612b`, plus the
  stale-proposed-banner repair, commit `3bdd2772`). Strike or replace that bullet list with a
  resolved note so the ledger stops reading as open debt.
- **Owner**: dispatching host (mechanical) or Kim.
- **Evidence**: `.claude/ops/held-items.md` "Resolutions, 2026-08-23" section; commits `e91d612b`,
  `3bdd2772`; this firing's `reports/2026-08-25T175543Z-repo-cleaner.md` (`git branch -a`: local
  `main` only).
- **Size**: ~5 minutes.

## Standing notes (not queue entries)

- **Prior plan fully cleared, including its own human-decision item**: ADR-0129 Amendment 2
  ratified 2026-08-25T04:51:45Z (commit `959e7698`); build-1618 executing the extraction (branch
  `1618-adr-0129-amendment-2`, fresh ~13h, correctly untouched).
- **#1618's `needs-ruling` label is stale** — the ruling it names is already made; expected to
  clear naturally once build-1618's PR merges and the issue closes. Not queued as a distinct
  action (issue-sorter's normal labeling remit, not a live decision).
- **Intake clean**: issue-sorter — 3 issues + 3 PRs since the 2026-08-25T00:59:54Z checkpoint, all
  already resolved/labeled, all trusted-author kimgranlund. Checkpoint advanced for both
  `gh_issues`/`gh_prs`.
- **Zero open PRs, zero orphaned worktrees, zero stale local branches** — cleanest git-surface
  reading of the last several firings (repo-cleaner).
- **No entry parked this firing** — the only open issue (#1618) carries neither `backlog` nor
  `roadmap`.
- **Dirty `main` markers**: `.claude/ops/sweep-in-flight.json` only (this sweep's own live marker,
  session `agent-ui-90` — leave until the sweep concludes).
- **gen-ui-kit**: out of this board's scope (dedicated session per Kim's ruling).

*Composed by chore-planner, 2026-08-25T17:55:43Z sweep firing — returned as payload per the #125
ops-write split; written and landed by the dispatching session.*

Dispatch: 2026-08-25T17:55:43Z
