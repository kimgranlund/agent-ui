<!-- target-path: .claude/ops/plan.md -->
# Ops plan — agent-ui

- **Dispatch**: 2026-08-24T03:15:36Z sweep firing (chore-planner, /sweep-chores — seat findings
  attached for three lanes: decision-watcher, issue-sorter, repo-cleaner; judged exactly those,
  nothing refetched beyond the prior plan and the durable state those reports name by path —
  `held-items.md`, `rulings.md`, `adr-queue.json`).
- **Evidence**: attached seat findings this firing —
  `reports/2026-08-24T031536Z-issue-sorter.md` (3 items since 2026-08-23T20:00:26Z, all trusted
  author, all already minted, zero holds) · `reports/2026-08-24T031536Z-repo-cleaner.md` (git
  surface clean, nothing executed/proposed, `pr-1590` from the prior firing's open item now gone
  entirely) · `adr-queue.json`/`adr-checkpoint.json` (decision-watcher, already applied to disk —
  queue cleared to **0 pending**, checkpoint hashes advanced for adr-0112/adr-0227 only, both
  statuses stayed `accepted`) · decision-watcher's own dispatch-relayed summary (no separate report
  file this firing) → Forward mode clean; **Revalidation mode BLOCKED** — see 3.1 — plus the prior
  plan (2026-08-23T19:40:00Z compose, carry-forward only) and `held-items.md`/`rulings.md` (durable
  state, read for exact carry-forward and ruling-conflict text).
- **UNMEASURED**: none — all three seats reported successfully this firing per the dispatch header;
  `gh` reachable (issue-sorter's checkpoint advance, repo-cleaner's live `gh pr list`); no missing
  input. `[]`.
- **Corrections vs the prior plan**:
  - Prior 1.1 (land the 2026-08-23T19:40:00Z ops state) — **DONE**: landed by commit `63bc9575`
    ("ops: 2026-08-23 sweep state, held-items refresh, repo-cleaner report"), confirmed by `git log`.
    That same commit bundled a marshal's `held-items.md` refresh the prior plan's own compute pass
    hadn't yet seen — see the next three corrections, all sourced from that refresh plus this
    firing's fresher evidence. Superseded by this firing's own 1.1.
  - Prior 3.1 (rule on #1583's marginal-budget ceiling) — **DONE, resolved out-of-band**:
    `held-items.md`'s "Resolutions, 2026-08-23 (marshal refresh)" section records Kim ruled (a) —
    `APP_MARGINAL_BUDGET` bumped ~104 B citing ADR-0008 Amendment 2, shipped via PR #1588 (merged),
    issue closed. Dropped from the queue. The one piece of that entry NOT yet closed — the scratch
    clone left on disk, `rm` denied to both seat and marshal — is carried forward standalone as
    this firing's new 4.2 (it's a leftover cleanup action now, not a pending ruling).
  - Prior 3.2 (disposition of local branch `pr-1590`) — **DONE, resolved**: repo-cleaner's fresh
    `git branch -vv` this firing shows only `main` and `1600-docs-site-reorganize-sitemap` locally —
    `pr-1590` is gone entirely. Dropped. Note: `held-items.md`'s own "Still Kim's, open" list still
    names `pr-1590` as open — stale against this firing's live git surface, flagged here rather than
    silently trusted (same staleness class as last firing's merge-queue note; `held-items.md` isn't
    chore-planner's file to edit).
  - Prior 3.3/3.4/3.5 (the three ADR-harvest bundles: mint-vs-compose incl. adr-0112, css-structural-
    laws, patterns-table adr-0227 wave-2) — **ALL DONE**: `adr-queue.json` now reads `{"candidates":
    []}` — 0 pending, down from 7 across three target-skill groups. PR #1607 ("docs(skills): harvest
    5 queued ADR lessons into reference docs") shipped and merged 2026-08-23, covering exactly this
    content: `component-design/mint-vs-compose.md`'s 4th smallest-floor instance + the new
    falsifiable-re-open pattern (adr-0112 Am.3), `component-standards/css-structural-laws.md`'s
    3rd law (adr-0230), and `component-patterns/patterns-table.md`'s hover/active pattern +
    sharpened adr-0227 row (wave-2 worked files, PR #1548). Separately, commit `3bdd2772` had already
    repaired the stale "proposed" banners on the ratified adr-0112 Am.3 and adr-0227 wave-2 amendment
    text itself (2026-08-23) — both the banner-cosmetic gap and the harvest-content gap are now
    closed. All three dropped from the queue; no confirm-batch pending.
  - Prior 4.1 (nonoun-plugins#46 ratify-only-flip hash gap) — **carried, unchanged**: no seat carries
    cross-repo `nonoun-plugins` evidence this firing either; last live-verified OPEN 2026-08-20T22:43Z,
    now stale by **five** consecutive firings. Carried forward as this firing's 4.3, same interim pin.
  - No entry dropped as parked — no carried id shows a `backlog`/`roadmap` label in this firing's
    evidence.
- **New this firing** (decision-watcher, Revalidation mode): BLOCKED again — `.claude/docs/rdd`
  still doesn't exist, and the tool's own contract now mandates all three source dirs (ADR/IDR/RDD)
  unconditionally, cited by the seat as issues #655/#656 (repo not stated in the seat's summary).
  This collides with the standing `rulings.md` entry ("Revalidation-mode scope — RULED 2026-08-20:
  ADR/IDR-only... Future firings should not re-surface this as a blocked/gap finding") because that
  ruling's premise — the tool being scopable to two sources — is what apparently changed. New 3.1,
  a genuine stale-ruling tension per the seat, not a re-surfacing of the settled question.
- **New this firing** (issue-sorter): #1608 (bug, severity:major — corpus-genui eval CLI
  `judge --dry-run` still bills the API) and #1609 (task, size:small — retire 6 stale G1
  `.gitignore` rules), both already fully minted, trusted-author, no triage action needed from
  issue-sorter. #1608 is ordinary dev backlog, out of this seat's scope (no ops-mechanics angle —
  not blocking anything currently queued) — noted, not queued. #1609 IS queued as new 4.1: it's real
  hygiene debt, and it directly supersedes this plan's own prior standing note that the 6 G1 rules
  were "a standing Kim-ruled keep-list, never re-proposed" — that note bound ops SEATS from
  re-suggesting the fix; #1609 is Kim's own new, correctly-labeled ticket, not a seat re-proposal, so
  it queues rather than getting suppressed.
- **needs-ruling lane**: none — no `needs-ruling`-labeled GH issue in evidence this firing (3.1's
  RDD-tier tension is a direct decision-watcher/`rulings.md` conflict, not a GH-label-driven lane).
- **Blocked-by convention (#193)**: issue-sorter's report doesn't excerpt #1608/#1609 body text, so
  there's no positive evidence of a `Blocked-by:` line either way this firing (sweep mode judges
  exactly the attached reports, refetching nothing) — treated as unblocked per the convention's own
  "no line" default; queue order below is the plain (1)-(4) ranking, unmodified.
- **Verdict**: quiet consolidation pass — every human-decision item carried into this firing
  resolved out-of-band before it started (the #1583 ceiling ruling via PR #1588, the morning merge
  queue, and all three ADR-harvest confirm-bundles via PR #1607 + the banner-repair commit), and
  repo-cleaner's own carried item (`pr-1590`) resolved itself too. What's left is one fresh
  human-decision item (3.1, a real stale-ruling tension, not a repeat) and two small hygiene items
  (4.1 new, 4.2 a leftover cleanup action from an already-closed ruling), plus the standing upstream
  pin (4.3). Issue-sorter ran a clean 3-item no-op pass; decision-watcher's Forward mode is equally
  clean (0 pending).

Queue order: (1) gated mutations verified safe → (2) blockers → (3) human decisions → (4) hygiene.

## 1. Gated mutations already verified safe

### 1.1 Land this firing's ops state — one commit, ops paths ONLY (dispatching host; 5 min)
- **Action**: the seat outputs are already computed and on disk but not yet committed — `git add`
  exactly: `.claude/ops/adr-checkpoint.json` (modified, adr-0112/adr-0227 hashes advanced),
  `.claude/ops/adr-queue.json` (modified, cleared to 0 candidates), `.claude/ops/watch-checkpoint.json`
  (modified, both sources advanced to 2026-08-24T03:15:36Z), `.claude/ops/reports/2026-08-24T031536Z-issue-sorter.md`
  (new), `.claude/ops/reports/2026-08-24T031536Z-repo-cleaner.md` (new), plus this plan's own
  payload once applied — then commit on `main`. Do NOT stage `.claude/ops/sweep-in-flight.json`
  (this sweep's own live marker, same exclusion as every prior firing).
- **Owner**: dispatching host (the ops-write split's dispatching session).
- **Evidence**: `git status --porcelain` this firing (3 modified + 3 untracked ops paths, confirmed
  live); `ops-write-sandbox-rules` (dispatcher applies + lands payloads).
- **Size**: 5 minutes.

## 2. Blocking other work

(none — repo-cleaner: 0 open PRs, one live worktree (`build-1600`, correctly kept — backs open
issue #1600), primary in sync with `origin/main`, nothing executed or proposed this firing; no
entry blocks another this firing.)

## 3. Human-decision items

### 3.1 Rule on the RDD-tier tension — Revalidation mode BLOCKED again despite the 2026-08-20 ruling (Kim; ~15 min) — new this firing
- **Action**: decision-watcher's Revalidation mode is blocked this firing: `.claude/docs/rdd`
  still doesn't exist, and the tool's own contract now mandates all three source dirs
  (ADR/IDR/RDD) unconditionally, per #655/#656 (repo not stated in the seat's summary). This
  directly collides with the standing `.claude/ops/rulings.md` entry — "Revalidation-mode scope —
  RULED 2026-08-20: ADR/IDR-only, no RDD tier in this repo... Future firings should not re-surface
  this as a blocked/gap finding; treat the two-source scope as this repo's own shape until a real
  RDD-shaped need appears" — because that ruling's own premise (the tool being scopable to two
  sources) is what apparently changed underneath it. This is NOT a re-surfacing of the settled
  question; the settled question's premise moved. Decide: (a) mint an empty `.claude/docs/rdd/`
  placeholder directory to satisfy the tool's new hard mandate while keeping zero real RDD content
  (closest to the 2026-08-20 ruling's original intent), or (b) formally refresh/amend that ruling
  given the underlying tool contract changed. Either way, append a dated amendment to
  `rulings.md` recording which path was taken, so a future firing doesn't re-litigate this same gap.
- **Owner**: Kim (the ruling) · whichever session applies it (mechanical once ruled — either the
  placeholder directory or the rulings.md amendment).
- **Evidence**: decision-watcher's summary this firing (Revalidation mode BLOCKED, citing #655/#656);
  `.claude/ops/rulings.md` "Revalidation-mode scope — RULED 2026-08-20" entry.
- **Size**: ~15 minutes (ruling + whichever mechanical fix).

## 4. Hygiene debt

### 4.1 Implement #1609 — retire 6 stale G1 `.gitignore` rules (any available dev/host; ~15 min) — new this firing
- **Action**: issue #1609 (task, size:small, trusted author, already correctly minted/labeled)
  asks to retire the 6 stale G1 `.gitignore` rules `gitignore_check.py` has flagged as unchanged
  noise on every recent firing. This is Kim's own new ticket, not a seat re-proposal — it
  supersedes this plan's prior standing note that these rules were "a standing Kim-ruled
  keep-list, never re-proposed" (that note bound ops seats from re-suggesting the fix; it doesn't
  bind a real ticket Kim herself filed). Remove the 6 rules named in #1609, verify
  `gitignore_check.py` goes clean, close the issue.
- **Owner**: any available dev, or the dispatching host.
- **Evidence**: issue #1609 (issue-sorter's report this firing); repo-cleaner's report this firing
  — "🟡 The 6 stale .gitignore G1 rules are now tracked by open issue #1609 rather than being pure
  recurring noise — confirm it gets picked up so this line finally clears."
- **Size**: ~15 minutes (labeled size:small).

### 4.2 Reap the #1583 scratch clone left on disk (Kim or any non-sandboxed session; ~2 min) — carried, cleanup-only now that the ruling itself is closed
- **Action**: `/var/folders/0b/jf4lh4jd4sd9y2q7x271c9jm0000gn/T/agent-ui-1583` is still on disk —
  `rm` was denied to both the build seat and the marshal (sandboxing), per `held-items.md`'s
  2026-08-23 resolutions section. The ruling that produced this clone (#1583's budget ceiling) is
  now fully resolved (PR #1588, merged) — this is pure leftover cleanup, not a pending decision.
  `rm -rf` the directory from a session with full filesystem permission.
- **Owner**: Kim, or any session not running under the write-sandbox.
- **Evidence**: `.claude/ops/held-items.md` "Resolutions, 2026-08-23 (marshal refresh)" — "Reap
  scratch clone ... manually (rm denied to seats and marshal)."
- **Size**: ~2 minutes.

### 4.3 nonoun-plugins#46 — ratify-only-flip hash gap; pin stands (upstream lane; 0 min here)
- **Action**: carried forward, NOT re-verified this firing (sweep mode — treated as still OPEN;
  last live-verified OPEN 2026-08-20T22:43Z, now stale by **five** firings — none of this firing's
  three seats carry cross-repo `nonoun-plugins` evidence). INTERIM PIN unchanged: when Kim ratifies
  an amendment on an already-`accepted` ADR with no body-byte change, the host re-dispatches
  decision-watcher with an explicit "re-judge adr-00NN amendment" instruction. Pin stays until #46
  closes.
- **Owner**: nonoun-plugins upstream (the script fix) · dispatching host (the pin, per firing) ·
  Kim (unparking the upstream bundle).
- **Evidence**: prior plan 4.1; live `gh issue view 46 -R kimgranlund/nonoun-plugins` → OPEN as of
  2026-08-20T22:43Z (now stale by five firings, safer-default open).
- **Size**: 0 minutes here; small tooling task upstream.

## Standing notes (not queue entries)

- **ADR harvest fully cleared**: `adr-queue.json` reads 0 pending (down from 7). PR #1607 landed the
  content; commit `3bdd2772` had already repaired the stale "proposed" banners on adr-0112 Am.3 and
  adr-0227 wave-2. Nothing further to confirm-batch.
- **Intake fully clean, no-op**: issue-sorter — 3 items since 2026-08-23T20:00:26Z (#1608, #1609,
  PR #1607), all trusted-author kimgranlund, all already minted/labeled, zero new holds. Checkpoint
  advanced for both `gh_issues` and `gh_prs` to 2026-08-24T03:15:36Z.
- **#1608 (bug, severity:major)** — corpus-genui eval CLI `judge --dry-run` still bills the API.
  Already correctly minted; ordinary dev backlog, no ops-mechanics angle this firing — tracked here
  for visibility only, not queued.
- **#1605 discrepancy, informational only**: `held-items.md`'s 2026-08-23 resolutions say #1605's
  AC18 triage is "now in build (build-1605)," but repo-cleaner's fresh worktree inventory this
  firing lists only `main` + `build-1600` — `build-1605` no longer exists (merged/completed or
  already reaped). #1605 itself remains open and unassigned per repo-cleaner's own check. No ops
  action here (dev backlog, out of this seat's scope) — noted so the next firing isn't surprised.
- **Hygiene git surface**: 0 open PRs, 0 new mutations this firing (repo-cleaner: nothing to
  execute, nothing to propose), 1 live worktree correctly kept, `pr-1590` resolved (gone).
- **Dirty `main` markers**: `.claude/ops/sweep-in-flight.json` only (this sweep's own live marker —
  leave until the sweep concludes).
- **gen-ui-kit**: out of this board's scope (dedicated session per Kim's ruling).

*Composed by chore-planner, 2026-08-24T03:15:36Z sweep firing — returned as payload per the #125
ops-write split; written and landed by the dispatching session.*

Dispatch: 2026-08-24T03:15:36Z
