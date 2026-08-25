<!-- target-path: .claude/ops/plan.md -->
# Ops plan — agent-ui

- **Dispatch**: 2026-08-25T00:59:54Z sweep firing (chore-planner, /sweep-chores — seat findings
  attached for three lanes: issue-sorter, repo-cleaner as report files; decision-watcher via its
  applied checkpoint/queue state directly, no separate report file this firing per the dispatch
  brief). Judged those plus the prior plan (carry-forward only) and durable state
  (`held-items.md`, `rulings.md`, `revalidation-queue.json`, `adr-checkpoint.json`,
  `watch-checkpoint.json`); a light live-`gh` spot-check covered exactly the mandatory
  backlog/roadmap parked-label scan on the two currently-open items and confirmation of the
  dispatching host's own pre-planner cleanup (below) — nothing else refetched.
- **Evidence**: `reports/2026-08-25T00:59:54Z-issue-sorter.md` (5 issues + 6 PRs since the
  2026-08-24T17:08:45Z checkpoint, all trusted-author kimgranlund; 4 issues + 5 PRs already
  resolved/merged before this window opened; #1618 relabeled `task`→`needs-ruling`, label minted
  fresh) · `reports/2026-08-25T005954Z-repo-cleaner.md` (1 open PR #1617, healthy, live worktree
  backing it; two findings — an orphaned worktree, a stale local branch — proposed-but-not-executed
  by the seat, since resolved out-of-band, see Corrections) · decision-watcher's applied state:
  `adr-checkpoint.json` (Forward mode: adr-0015 and adr-0129 hashes both advanced — amendment
  activity), `revalidation-checkpoint.json` (cursor 15→20), `revalidation-queue.json`
  (adr-0016/0019/0020 confirmed; adr-0017/adr-0018 newly falsified; adr-0015's row carries its own
  embedded "amendment landed, queue-clear needed" note), `watch-checkpoint.json` (both sources
  advanced to 2026-08-25T00:59:54Z) · the prior plan (2026-08-24T17:08:45Z compose, carry-forward
  only) and `held-items.md`/`rulings.md` (durable state, read for exact carry-forward and ruling
  text, including the live-ruled 2026-08-24 (17:xx) IDR-scope amendment).
- **UNMEASURED**: none — all three seats reported successfully this firing (decision-watcher via
  its applied state, no gap); `gh` reachable (issue-sorter's checkpoint advance; this compute
  pass's own live spot-check). `[]`.
- **Corrections vs the prior plan** (2026-08-24T17:08:45Z) — every entry resolved:
  - Prior 1.1 (land the 2026-08-24T17:08:45Z ops state) — **DONE**: commit `fbdcdb18` ("ops:
    2026-08-24T17:08Z sweep state — ADR-0015 falsified, IDR dialect gap flagged, plan refresh"),
    confirmed by `git log`. Superseded by this firing's own 1.1.
  - Prior 3.1 (rule on the IDR frontmatter-dialect gap) — **DONE, resolved**: Kim ruled live,
    same firing, before this plan's next compose (`rulings.md`'s "2026-08-24 (17:xx) —
    Revalidation-mode scope, IDR-tier amendment" entry) — stays ADR-only until upstream
    (`nonoun-plugins`) supports the frontmatter-free dialect; commit `34958349` landed the ops-state
    acknowledgment. Dropped — not re-surfaced as a gap per the ruling's own instruction.
  - Prior 4.1 (file a dated ADR-0015 amendment for falsified cl.4/5 token names) — **DONE, shipped
    end-to-end**: issue #1614 filed and closed, PR #1615 merged, commit `97227ee0` ("docs(adr):
    repoint ADR-0015 cl.4/5 token names to md-sys grammar (#1614) (#1615)") — confirmed live on
    disk, `.claude/docs/adr/0015-container-surface-space-token-model.md:165` carries the dated
    Amendment. Dropped as completed-per-spec. One follow-up surfaces new this firing below (the
    `revalidation-queue.json` row itself still needs a human queue-clear — a distinct, smaller
    action from the amendment work, which is done).
  - Prior 4.2 (reap the #1583 scratch clone) — **DONE**: `/var/folders/0b/jf4lh4jd4sd9y2q7x271c9jm0000gn/T/agent-ui-1583`
    confirmed absent this compute pass (`ls` — no such file or directory). Dropped, fully resolved.
  - Prior 4.3 (nonoun-plugins#46 / claude-plugins#929 ratify-only-flip hash gap) — already closed
    as of the prior plan itself (commits `9bb9f3fe`, `fa827447`); not carried forward as a numbered
    entry.
  - **Two findings resolved out-of-band, pre-planner** (not from the prior plan — new this firing,
    already closed before this compute pass started): the dispatching host removed the orphaned
    worktree `corpus-wave-6-seeds` (5 commits verified already on
    `origin/a2ui-design-mode-triage-fixes` before removal) and deleted the stale local branch
    `pr-1617-review` (0 unique commits vs. PR #1617's real branch, per repo-cleaner's own
    verification) — both confirmed absent from `git worktree list`/`git branch -vv` this compute
    pass. Not queued; already executed, noted for continuity only.
  - No entry dropped as parked — live scan of the only two currently-open items (#1617, #1618)
    carries neither `backlog` nor `roadmap` on either id.
- **New this firing** (decision-watcher, via applied state):
  - Forward mode: adr-0129's hash advanced — a NEW proposed Amendment 2 (shared artboard-core
    extraction to `@agent-ui/app/artboard.{css,ts}`, zero behavior/public-API change), gated on
    Kim's explicit ratify comment. issue-sorter minted issue #1618 `needs-ruling` for exactly this
    gate this firing. Queues as new 3.1, human-decision, referenced by id only.
  - Revalidation mode: cursor 15→20 — adr-0016/0019/0020 confirmed; **adr-0017 and adr-0018 both
    falsified**, same drift class as adr-0015's now-closed gap (a stale token/prop name superseded
    by a later ratified ADR): adr-0017's `[dismissable]` prop was inverted to `persistent` by
    ADR-0020 (cl.1/2/4/5 stand); adr-0018's `--ui-radius-base` was renamed to
    `--md-sys-shape-corner-base` by ADR-0140 (cl.2/3 stand). Both need a dated restatement
    amendment mirroring adr-0015's own #1614/#1615 fix. Queues as new 4.1, hygiene debt.
  - adr-0015's `revalidation-queue.json` row carries its own embedded note: the amendment is
    confirmed landed, and the row "should be queue-cleared by a human" — decision-watcher flags
    but never clears its own queue by design. Queues as new 4.2, hygiene debt (mechanical, tiny).
- **New this firing** (issue-sorter): #1618 correctly relabeled `task`→`needs-ruling` (label minted
  fresh, didn't exist before) — referenced in §3.1, not restated. All other 4 discovered issues +
  5 of 6 PRs already resolved before this window opened — no action.
- **New this firing** (repo-cleaner): 1 open PR (#1617), healthy — live worktree
  `frontier-swiper-fixes` backs it, tracking `behind 2` (routine, ancestor-of, not a conflict), no
  stale-open risk. The seat's two proposed-but-not-executed findings were resolved directly by the
  dispatching host before this compute pass — see Corrections above.
- **needs-ruling lane**: #1618 is this firing's one `needs-ruling`-labeled issue — referenced by id
  in §3.1 below; the ratify-comment procedure and full amendment text live on the issue and on
  ADR-0129's own `## Amendment (2026-08-24, proposed — Kim ratifies)` section
  (`.claude/docs/adr/0129-app-surfaces-m2-composition-and-transport-boundary.md:70`), not restated
  here.
- **Blocked-by convention (#193)**: checked #1618's and #1617's bodies directly — neither carries a
  `Blocked-by:` line. No queue entry sits behind a named blocker this firing; ranking is the plain
  (1)-(4) order.
- **Verdict**: full consolidation. Every entry carried from the prior plan (2026-08-24T17:08:45Z)
  is now resolved end-to-end: its ops-state landing confirmed, its IDR ruling landed same-firing,
  its ADR-0015 amendment task shipped issue→PR→live doc, its scratch-clone cleanup confirmed gone,
  and its stale upstream pin stayed closed. Two more findings (an orphaned worktree, a stale review
  branch) surfaced and were resolved out-of-band by the dispatching host before this compute pass
  even started. What's left standing: one new human-decision item (ratify or decline ADR-0129
  Amendment 2, gated on issue #1618) and two small new hygiene items (restate adr-0017/adr-0018
  under current names; queue-clear adr-0015's now-resolved revalidation row). No blockers, no
  parked drops, no UNMEASURED sections.

Queue order: (1) gated mutations verified safe → (2) blockers → (3) human decisions → (4) hygiene.

## 1. Gated mutations already verified safe

### 1.1 Land this firing's ops state — one commit, ops paths ONLY (dispatching host; 5 min)
- **Action**: the seat outputs are already computed and on disk but not yet committed — `git add`
  exactly: `.claude/ops/adr-checkpoint.json` (modified, adr-0015/adr-0129 hash advance),
  `.claude/ops/revalidation-checkpoint.json` (modified, cursor advanced to 20),
  `.claude/ops/revalidation-queue.json` (modified, adr-0017/adr-0018 falsified rows added +
  adr-0015's resolved-note appended), `.claude/ops/watch-checkpoint.json` (modified, both sources
  advanced to 2026-08-25T00:59:54Z), `.claude/ops/reports/2026-08-25T00:59:54Z-issue-sorter.md`
  (new), `.claude/ops/reports/2026-08-25T005954Z-repo-cleaner.md` (new), plus this plan's own
  payload once applied — then commit on `main`. Do NOT stage
  `.claude/ops/sweep-in-flight.json` (this sweep's own live marker, same exclusion as every prior
  firing).
- **Owner**: dispatching host (the ops-write split's dispatching session).
- **Evidence**: `git status --porcelain=v1 -b` this compute pass (4 modified + 2 untracked ops
  report/queue paths, plus the excluded sweep marker, confirmed live); `ops-write-sandbox-rules`
  (dispatcher applies + lands payloads).
- **Size**: 5 minutes.

## 2. Blocking other work

(none — 1 open PR (#1617), healthy, live worktree backing it; primary exactly current with
`origin/main` (0 ahead/0 behind); no entry blocks another this firing.)

## 3. Human-decision items

### 3.1 Ratify or decline ADR-0129 Amendment 2 — gated on issue #1618 (Kim; ~5 min to decide + comment) — new this firing
- **Action**: decision text, tradeoffs, and the exact ratify procedure live entirely on issue
  #1618 (`needs-ruling`, minted this firing by issue-sorter) and on ADR-0129's own
  `## Amendment (2026-08-24, proposed — Kim ratifies)` section — referenced here, not restated
  (ruled 2026-08-17: a needs-ruling issue is the single source of its own decision text). In
  short: extract the shared ~40-line artboard visual core to `@agent-ui/app/artboard.{css,ts}`,
  consumed by both `surface-host.{css,ts}` and the site's `canvas-surface.ts`, zero behavior/
  public-API change. Post the literal comment `ratify ADR-0129 amendment` on #1618 to flip it (or
  comment declining/proposing an alternative). Ratifying triggers
  `scripts/adr_ratify.py 0129 <comment-url>` and a downstream build dispatch (6 files, bounded
  refactor per the issue's own stated acceptance criteria) — that build is dev work, out of this
  plan's own ops-mechanism scope once the ratify gate clears.
- **Owner**: Kim (the ratify/decline decision) · whichever session runs `adr_ratify.py` once ruled.
- **Evidence**: issue #1618 (OPEN, `needs-ruling`); `.claude/ops/adr-checkpoint.json` (`adr-0129`
  hash advanced this firing — Forward mode confirms the amendment landed on disk, proposed);
  `.claude/docs/adr/0129-app-surfaces-m2-composition-and-transport-boundary.md:70`.
- **Size**: ~5 minutes for the ratify decision itself; the triggered build is separately sized
  once dispatched.

## 4. Hygiene debt

### 4.1 File dated restatement amendments for ADR-0017 and ADR-0018 — same falsified-token/prop-name drift class as ADR-0015 (any available dev; ~20 min) — new this firing
- **Action**: decision-watcher's Revalidation pass (cursor 15→20) falsified both:
  - adr-0017 cl.3 still reads the pre-ADR-0020 `[dismissable]` prop name; ADR-0020 inverted it to
    `persistent` (default OFF, presence-boolean) — confirmed live in `modal.ts`. Cl.1/2/4/5
    (control-owned dialog part, open-driven `showModal()`/close, focus restore, dialog ARIA) stand,
    byte-accurate. ADR-0017's own header already says "Superseded in part by ADR-0020" but the
    Decision body text itself was never restated.
  - adr-0018 cl.1 still reads `var(--ui-radius-base)`; ADR-0140 renamed the family to
    `--md-sys-shape-corner-base` — confirmed live in `card.css`. Cl.2/3 (the cycle-free two-token
    publish/read split, one-level-only decrement) stand, byte-accurate.
  Same mechanical, no-decision-fork shape as adr-0015's own fix (issue #1614 → PR #1615, merged,
  commit `97227ee0`) — file one task (or two, dev's choice) to append a dated amendment section to
  each ADR restating the current names, cross-referencing ADR-0020/ADR-0140 respectively. Once
  landed, both claims clear on decision-watcher's next Revalidation pass.
- **Owner**: any available dev (currently unclaimed — both `revalidation-queue.json` rows read
  `owner: "unassigned"`).
- **Evidence**: `.claude/ops/revalidation-queue.json` (adr-0017/adr-0018 candidates, queued_at
  2026-08-25T01:03:52Z); `.claude/docs/adr/0017-native-dialog-modal.md` header row;
  `.claude/docs/adr/0018-css-one-level-nested-radius.md` cl.1; precedent commit `97227ee0`.
- **Size**: ~20 minutes (two doc-only amendments + task-filing overhead).

### 4.2 Queue-clear the adr-0015 row from revalidation-queue.json — amendment already landed (dispatching host or Kim; ~2 min) — new this firing
- **Action**: adr-0015's own `revalidation-queue.json` entry carries a self-appended note: its
  falsified cl.4/5 gap is now fixed on disk (issue #1614, PR #1615, commit `97227ee0`, confirmed
  live this compute pass) — the row looks resolved, but decision-watcher never clears its own
  queue by design (queue-clear is a human/host action). Remove the `adr-0015` object from the
  `candidates` array in `.claude/ops/revalidation-queue.json` — leave `adr-0017`/`adr-0018` in
  place.
- **Owner**: dispatching host (mechanical) or Kim.
- **Evidence**: `.claude/ops/revalidation-queue.json`'s own adr-0015 entry ("UPDATE 2026-08-25
  sweep: ... this row looks resolved; a human should verify and queue-clear it");
  `.claude/docs/adr/0015-container-surface-space-token-model.md:165` (the landed amendment).
- **Size**: ~2 minutes.

## Standing notes (not queue entries)

- **Prior plan fully cleared**: every 2026-08-24T17:08:45Z entry (1.1 ops-state, 3.1 IDR ruling,
  4.1 ADR-0015 amendment, 4.2 scratch-clone reap, 4.3 upstream pin) confirmed resolved this
  compute pass — see Corrections above.
- **Two findings resolved out-of-band, pre-planner**: orphaned worktree `corpus-wave-6-seeds`
  (removed by the dispatching host, its 5 commits verified already on
  `origin/a2ui-design-mode-triage-fixes` first) and stale local branch `pr-1617-review` (deleted,
  0 unique commits vs. PR #1617's real branch) — both confirmed absent from `git worktree list`/
  `git branch -vv` this compute pass. Not queued; already executed.
- **Intake clean**: issue-sorter — 5 issues + 6 PRs since the 2026-08-24T17:08:45Z checkpoint, all
  trusted-author kimgranlund, all already resolved except #1618 (correctly relabeled
  `needs-ruling`). Checkpoint advanced for both `gh_issues`/`gh_prs` to 2026-08-25T00:59:54Z.
- **One open PR (#1617), healthy**: live worktree `frontier-swiper-fixes` backs it, tracking
  `behind 2` (routine, ancestor-of, not a conflict) — no stale-open risk.
- **No entry parked this firing** — live scan of the only two open items (#1617, #1618) carries
  neither `backlog` nor `roadmap`.
- **Dirty `main` markers**: `.claude/ops/sweep-in-flight.json` only (this sweep's own live
  marker — leave until the sweep concludes).
- **gen-ui-kit**: out of this board's scope (dedicated session per Kim's ruling).

*Composed by chore-planner, 2026-08-25T00:59:54Z sweep firing — returned as payload per the #125
ops-write split; written and landed by the dispatching session.*

Dispatch: 2026-08-25T00:59:54Z
