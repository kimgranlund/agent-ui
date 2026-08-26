<!-- target-path: .claude/ops/plan.md -->
# Ops plan — agent-ui

- **Dispatch**: 2026-08-26T16:28:22Z sweep firing (chore-planner, `/sweep-chores` fallback
  fan-out — no repo-local `harness/` tree, so the coordinating session dispatched issue-sorter,
  repo-cleaner, decision-watcher directly via `Agent` rather than the Workflow tool). All three
  seats reported successfully; their state is already applied to `.claude/ops/`. Judged those
  three reports plus the prior plan (carry-forward only) and durable state (`held-items.md`,
  `adr-queue.json`, `revalidation-queue.json`, `revalidation-checkpoint.json`,
  `watch-checkpoint.json`); a light `git log`/mtime spot-check confirmed every prior-plan entry's
  claimed resolution is real on disk (see Corrections below) — not a re-judging of this firing's
  seat evidence, and no live `gh` call of my own beyond what the reports already carry.
- **Evidence**: `reports/2026-08-26T16:28:22Z-issue-sorter.md` (8 issues + 5 PRs since the
  2026-08-26T01:57:30Z checkpoint, all already correctly filed/labeled by the docs/catalog-audit
  session's own intake dispatches; tkt-0098→#1670 migration cleanup confirmed complete —
  `.claude/docs/tickets/tkt-0098-*.md` confirmed absent; checkpoint advanced) ·
  `reports/2026-08-26T162822Z-repo-cleaner.md` (git surface clean: 1 open PR #1671, healthy/fresh
  ~16min old, `Closes #1670`; 1 open issue #1670, live build, correctly excluded; 4 stale tracking
  refs pruned; the newly-merged `ops:reap-scratch-clones -- --execute` gate invoked for real for
  the first time — 6/7 scanned scratch clones REAPed, the 1 genuinely-live one (`agent-ui-1670`)
  correctly held back by the script's own `KEEP(open-ticket)` classification) · decision-watcher's
  applied state (no separate report file this firing, matching the prior firing's own pattern):
  `revalidation-checkpoint.json` (cursor 30→35), `revalidation-queue.json` (adr-0030 carried
  unresolved + **adr-0032/adr-0033/adr-0035 newly falsified**, replacing nothing — all 4 rows now
  open), `adr-queue.json` **UNCHANGED** this firing (mtime confirms: still 3 harvest candidates —
  adr-0129, adr-0021, adr-0025 — decision-watcher deliberately did not add new rows for
  adr-0032/0033/0035 since they target the identical `adr-log-mechanics.md` extension the existing
  adr-0021/adr-0025 rows already propose; it only noted the connection in its own dispatch prose) ·
  `git log --oneline` confirming commits `e664c651` (prior firing's own ops-state land — resolves
  this firing's prior 1.1), `0e06aaf8` (PR #1662, "Closes #1661" — resolves prior 4.3, and its own
  diff also adds the `ops:reap-worktrees`/`ops:reap-branches`/`ops:reap-scratch-clones` line to
  `CLAUDE.md` — resolves prior 4.4 as a side-effect of the same PR), `f8f04988`/`904a7f33`/
  `b42354c7`/`93eae1ab` (PRs #1665/#1667/#1668/#1670-migration, all closing out issues from the
  prior firing's discovery window, none ops-family work) · `ls -la` / `stat` on
  `.claude/docs/adr/0030-column-default-cross-axis-stretch.md` (last modified 2026-08-13, predating
  its 2026-08-26T02:01:17Z falsification — confirms **no fix has landed for adr-0030 since**,
  resolves prior 4.1 as still-open) · direct read of `.claude/docs/adr/0032-*.md:11`
  ("Multiplier ladder superseded for CONTROLS by ADR-0038") and
  `packages/agent-ui/shared/src/tokens/dimensions.css:386-396` (the ADR-0038 header comment
  confirming the literal-lookup replacement, corroborating decision-watcher's adr-0032 finding).
- **UNMEASURED**: none — all three seats reported successfully; `gh` and `git` both reachable
  (issue-sorter's checkpoint advance, repo-cleaner's own `gh pr list`/`gh issue list`). `[]`.
- **Corrections vs the prior plan** (2026-08-26T01:57:30Z) — four of six entries resolved:
  - Prior 1.1 (land the 2026-08-26T01:57:30Z ops state) — **DONE**: commit `e664c651` ("ops:
    2026-08-26T01:57Z sweep state — ADR-0030 falsified, scratch-clone gap ticketed, plan
    refresh"), confirmed by `git log`. Superseded by this firing's own 1.1.
  - Prior 3.1 (Rule on #1653 — bug/feature write-gate asymmetry) — **DONE**: #1653 no longer
    appears in repo-cleaner's live `gh issue list --state open` this firing (exactly 1 open issue,
    #1670, unrelated) — Kim's ruling/close happened somewhere in this window. No commit closes it
    by keyword (the recommended action was a ruling comment + close, not a code change), so this
    is inferred from the open-issue count rather than a linked commit — stated here rather than
    silently assumed. Dropped as resolved.
  - Prior 4.1 (file a dated restatement amendment for ADR-0030) — **STILL OPEN, carried forward
    unchanged as new 4.2's first item**: `0030-column-default-cross-axis-stretch.md` is untouched
    since 2026-08-13 (`stat` this compute pass) — no fix has landed since it was falsified
    2026-08-26T02:01:17Z. This is now the single stalest item on the board: falsified, queued,
    unowned, unbuilt for a full firing.
  - Prior 4.2 (harvest 3 ADR-queue candidates via `/make-pack`) — **STILL OPEN, carried forward as
    new 4.1, re-framed** — see Verdict below for why this firing elevates it rather than
    mechanically re-queuing it at the same "no urgency" framing.
  - Prior 4.3 (build the gated `reap-scratch-clones` script, #1661) — **DONE, shipped AND
    validated live**: commit `0e06aaf8` ("Closes #1661"). Better than shipped-and-idle: this
    firing's own repo-cleaner report confirms the script was invoked for real (`--execute`) and
    worked exactly as designed — 6/7 scratch clones correctly REAPed, the 1 live one correctly
    held back. Dropped as completed-and-proven.
  - Prior 4.4 (name `ops:reap-*` scripts in CLAUDE.md/README) — **DONE**: the same commit
    `0e06aaf8` that closed #1661 also added the three-script line to `CLAUDE.md` (confirmed via
    `git show 0e06aaf8 -- CLAUDE.md`) — a side-effect of the same PR, not a separate one. Dropped.
  - No entry dropped as parked — the one currently-open issue (#1670) carries neither `backlog`
    nor `roadmap` (labels `size:big, feature`).
- **New this firing** (decision-watcher, via applied state): Revalidation mode advanced cursor
  30→35 and **falsified three more ADRs in one pass** — adr-0032 (Decision cl.2's "CONTROL ramp =
  a per-tier `--ui-scale` MULTIPLIER" claim, superseded by ADR-0038's explicit lookup, header
  records it, body doesn't), adr-0033 (Decision cl.2's `pow(--ui-scale, 0.45)` font formula, `pow(`
  now greps zero hits in shipped `dimensions.css`; cl.1 in the *same* ADR already carries an inline
  superseded-caveat, cl.2 doesn't — an inconsistency within the one ADR), adr-0035 (Decision
  cl.2/cl.4's literal font/icon number tables, re-tabled by ADR-0038 to different values, body
  tables never updated). All three are the *same defect shape* already flagged for adr-0021/
  adr-0025 (the open harvest candidate) and adr-0030 (falsified last firing, still unfixed):
  header names the supersession, Decision-body prose doesn't reflect it. `adr-queue.json` was
  correctly left unchanged — these three don't need new harvest rows, they're additional worked
  instances for the *same* pending adr-0021/adr-0025 harvest fix, not a new fix target.
- **New this firing** (issue-sorter): 8 issues + 5 PRs since the prior checkpoint, all already
  correctly filed/labeled/closed by the just-completed session's own intake dispatches — clean
  no-op for this seat's own remit. tkt-0098's local-file loose end confirmed cleaned up.
- **New this firing** (repo-cleaner): the `reap-scratch-clones.mjs` gated script — merged since the
  prior firing — was invoked live for the first time and worked correctly end-to-end (6 REAPed, 1
  correctly held back as `KEEP(open-ticket)`); the scratch-clone tooling gap from two firings ago
  is now fully closed, built, AND proven in production. One fresh, healthy open PR (#1671, ~16 min
  old, `Closes #1670`) — no action, not stale.
- **needs-ruling lane**: none this firing — #1653 (the prior firing's only `needs-ruling`-labeled
  issue) is no longer open; no other issue carries the label. §3 is empty this firing.
- **Blocked-by convention (#193)**: the one open issue (#1670) carries no `Blocked-by:` line
  (also not a plan entry — live build, PR #1671 open against it). Neither new hygiene entry below
  names an existing GH issue yet (adr-0030/0032/0033/0035 restatements aren't filed as issues
  yet — filing is part of the action itself), so no blocker relationship to check on them this
  firing.
- **Verdict — judgment call on the recurring falsified-restatement pattern**: this is now **9
  confirmed instances** of the same defect class corpus-wide (header records a supersession, the
  Decision-body prose is never restated) — adr-0007/0017/0018/0021/0025 (5, named in
  `adr-queue.json`'s own evidence text, all **already fixed** via shipped Amendments, PRs
  #1615/#1625/#1626/#1636/#1635) plus adr-0030 (falsified last firing) plus adr-0032/adr-0033/
  adr-0035 (falsified **this** firing) — **4 currently open and unfixed**, up from 1 a firing ago.
  The harvest fix that would document this pattern for future ADR authors/reviewers
  (`adr-log-mechanics.md`'s missing 4th table row) has sat queued since 2026-08-24 under a
  deliberate "batch-paced, no urgency" framing chosen when it was a single candidate. That framing
  no longer fits: the queue tripled in open-unfixed instances in one firing, the fix itself is
  fully specified and copy-paste ready (`adr-queue.json`'s own `plan` field), and every additional
  un-remediated instance is a live doc lying to whoever reads that ADR's Decision section next.
  This does **not** move the entry out of hygiene debt (queue order is fixed by the entry
  contract, not by this seat's sense of urgency, and nothing here blocks other work or needs a
  human ruling on ambiguous choice — the fix is already decided, just unbatched) — but it does
  move it to the **top of §4** with re-framed urgency language, ahead of the individual per-ADR
  restatement filings, since shipping the documented convention first gives whoever files those 4
  restatement PRs a named pattern to cite instead of re-deriving the rationale each time (as every
  one of the 9 instances' evidence text currently has to). §2 and §3 are both empty this firing —
  hygiene debt is the entire actionable queue this dispatch.

Queue order: (1) gated mutations verified safe → (2) blockers → (3) human decisions → (4) hygiene.

## 1. Gated mutations already verified safe

### 1.1 Land this firing's ops state — one commit, ops paths ONLY (dispatching host; 5 min)
- **Action**: `git add` exactly: `.claude/ops/revalidation-checkpoint.json` (modified, cursor
  30→35), `.claude/ops/revalidation-queue.json` (modified, +3 falsified rows: adr-0032, adr-0033,
  adr-0035, adr-0030 carried unchanged), `.claude/ops/watch-checkpoint.json` (modified, both
  sources advanced to 2026-08-26T16:28:22Z), `.claude/ops/reports/2026-08-26T16:28:22Z-issue-sorter.md`
  (new), `.claude/ops/reports/2026-08-26T162822Z-repo-cleaner.md` (new), plus this plan's own
  payload once applied — then commit on `main`. Do NOT stage `.claude/ops/adr-checkpoint.json` or
  `.claude/ops/adr-queue.json` (both unchanged this firing — confirmed by mtime, still dated from
  the prior firing) and do NOT stage `.claude/ops/sweep-in-flight.json` (this sweep's own live
  marker, same exclusion as every prior firing).
- **Owner**: dispatching host (the ops-write split's dispatching session).
- **Evidence**: file mtimes this compute pass (3 modified + 2 untracked ops paths; 2 unchanged ops
  paths correctly excluded); `ops-write-sandbox-rules` (dispatcher applies + lands payloads).
- **Size**: 5 minutes.

## 2. Blocking other work

(none — 1 open PR, #1671, healthy and fresh (~16 min old), not stale; primary exactly current
with `origin/main`; no entry blocks another this firing.)

## 3. Human-decision items

(none this firing — #1653, the prior firing's only `needs-ruling` item, is closed; no other issue
carries the label; `held-items.md`'s ruling/merge-queue section is fully resolved.)

## 4. Hygiene debt

### 4.1 Harvest the ADR-restatement-gap fix now, not on the next batch — via `/make-pack` (Kim; ~20 min) — re-framed this firing, elevated to top of §4
- **Action**: `adr-queue.json` carries 3 harvest candidates unchanged this firing: adr-0129
  (dual-maintained-CSS-drift class, unrelated lane), and adr-0021 + adr-0025 (both proposing the
  same fix: extend `.claude/skills/doc-standards/references/adr-log-mechanics.md`'s Amendment/
  Supersession/Extension table with a 4th row for "a header-recorded partial supersession whose
  Decision-body prose goes unrestated until a dedicated Amendment"). That pattern has now been
  found **9 times** corpus-wide (adr-0007/0017/0018/0021/0025 — already fixed; adr-0030 — falsified
  last firing, still unfixed; adr-0032/adr-0033/adr-0035 — falsified **this** firing, still
  unfixed): 4 open-and-unfixed instances, tripled in one firing alone. The fix text is already
  drafted verbatim in `adr-queue.json`'s own `plan` field — this is a batching decision, not a
  design decision. Recommend running this now rather than waiting for the batch to grow further;
  each additional un-remediated instance below (4.2) is filed against a doc-standards gap that is
  still open while it's being filed. Same lane as the 5-candidate batch shipped via #1607 (commit
  `e91d612b`).
- **Owner**: Kim (`/make-pack` runner).
- **Evidence**: `.claude/ops/adr-queue.json` (3 candidates, unchanged mtime this firing);
  `.claude/ops/revalidation-queue.json` (4 open falsified rows: adr-0030/0032/0033/0035, all
  citing the identical pattern); precedent commit `e91d612b`.
- **Size**: ~20 minutes once run.

### 4.2 File + land dated restatement amendments for 4 open falsified ADRs (any available dev; ~20 min each, ~80 min total) — adr-0030 carried unresolved, adr-0032/0033/0035 new this firing
- **Action**: four ADRs now carry a header-recorded supersession whose Decision-body prose was
  never restated — file a task per ADR (mirroring the adr-0007/0017/0018/0021/0025 precedent,
  issues #1614/#1623/#1624/#1631/#1632 → merged PRs #1615/#1625/#1626/#1636/#1635) appending a
  dated `## Amendment` section restating current values, citing this plan once 4.1 lands:
  - **adr-0030** (carried, unfixed since 2026-08-26T02:01:17Z, no PR filed yet): Decision cl.1's
    "zero drift" claim vs `column.ts:30-42`'s column-local 4-member `align` enum (`center`
    dropped, "Kim's directive" comment).
  - **adr-0032**: Decision cl.2's "CONTROL ramp = a per-tier `--ui-scale` MULTIPLIER" vs
    `dimensions.css:398-482`'s literal per-tier `(scale × size)` lookup (ADR-0038 supersession,
    header-recorded at adr-0032's own L11-12, body cl.2 unrestated).
  - **adr-0033**: Decision cl.2's `base × pow(--ui-scale, 0.45)` font formula vs zero `pow(`
    hits in shipped `dimensions.css` — note cl.1 in the *same* ADR already carries an inline
    superseded-caveat; cl.2 needs the matching one.
  - **adr-0035**: Decision cl.2/cl.4's literal font/icon number tables vs ADR-0038's re-tabled
    shipped values (content-sm/content-md/ui-lg cells all diverge).
- **Owner**: any available dev — `revalidation-queue.json` rows all read `owner: "unassigned"`;
  may be split across up to 4 separate PRs per precedent, or batched if one dev takes all four.
- **Evidence**: `.claude/ops/revalidation-queue.json` (all 4 candidate rows, full evidence text
  per-ADR); `.claude/docs/adr/0030-column-default-cross-axis-stretch.md:27-39`,
  `.claude/docs/adr/0032-ui-content-scale-tier-system.md:11-12,24-31`,
  `.claude/docs/adr/0033-sublinear-font-glyph-decoupling.md:12,26-35`,
  `.claude/docs/adr/0035-control-font-s1-set-explicit-table.md:12,34-48`;
  `packages/agent-ui/components/src/controls/column/column.ts:30-42`;
  `packages/agent-ui/shared/src/tokens/dimensions.css:386-482`.
- **Size**: ~20 minutes each (single-clause amendments), ~80 minutes if one dev does all four.

## Standing notes (not queue entries)

- **Prior plan (2026-08-26T01:57:30Z) mostly cleared**: 4 of 6 entries DONE this firing
  (ops-state land, #1653 ruling, the reap-scratch-clones build, the CLAUDE.md naming — the latter
  two via the same PR #1662); 2 carried forward, both re-framed above (4.1 harvest elevated, 4.2
  now covers 4 ADRs instead of 1).
- **The scratch-clone tooling gap (#1661) is now closed AND proven**: not just shipped — this
  firing's own repo-cleaner report is the first real invocation, and it worked exactly as
  designed. No further action; noted for the record since two firings ago flagged the gap.
- **held-items.md's "Kim's ruling/merge queue" section does not list #1653** — moot now that
  #1653 is closed; no future action needed on that account.
- **Intake clean**: issue-sorter — 8 issues + 5 PRs since the 2026-08-26T01:57:30Z checkpoint, all
  already resolved/labeled. Checkpoint advanced for both `gh_issues`/`gh_prs`.
- **1 open PR (#1671, healthy/fresh), 1 open issue (#1670, live build)** — both correctly excluded
  from every reap/hygiene classification this firing (repo-cleaner, and independently the
  `reap-scratch-clones` script's own `KEEP(open-ticket)` gate).
- **No entry parked this firing** — the one open issue (#1670) carries neither `backlog` nor
  `roadmap`.
- **Dirty `main` markers**: `.claude/ops/sweep-in-flight.json` only (this sweep's own live marker,
  session `agent-ui-90` — leave until the sweep concludes).
- **gen-ui-kit**: out of this board's scope (dedicated session per Kim's ruling).

*Composed by chore-planner, 2026-08-26T16:28:22Z sweep firing — returned as payload per the #125
ops-write split; written and landed by the dispatching session.*

Dispatch: 2026-08-26T16:28:22Z
