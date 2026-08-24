<!-- target-path: .claude/ops/plan.md -->
# Ops plan — agent-ui

- **Dispatch**: 2026-08-24T17:08:45Z sweep firing (chore-planner, /sweep-chores — seat findings
  attached for three lanes: decision-watcher, issue-sorter, repo-cleaner; judged exactly those,
  nothing refetched beyond the prior plan and the durable state those reports name by path —
  `held-items.md`, `rulings.md`, `revalidation-queue.json`, `watch-checkpoint.json`).
- **Evidence**: attached seat findings this firing —
  `reports/2026-08-24T170845Z-issue-sorter.md` (7 items touched since the 2026-08-24T03:15:36Z
  checkpoint, all trusted-author kimgranlund, all already resolved/merged/in-flight; one
  observation — #1605 carries no severity label, pre-existing gap, not repaired, out of
  discovery-only scope) · `reports/2026-08-24T170845Z-repo-cleaner.md` (one gated mutation
  executed — `campaign_close.py 1607`, PR #1607's stray remote branch reaped and reverified gone;
  local `main` was 1 commit behind `origin/main` at report time — RESOLVED by the dispatching
  session same-session, fast-forwarded to `fff8e2d7` and a stray empty eval-verdict stub
  discarded, confirmed live by `git log`/`git status` this compute pass: `main` now reads
  `fff8e2d7 [origin/main]` clean, no stray untracked non-ops file remains; 0 open PRs, 1 live
  worktree `build-1600` correctly kept; #1609's gitignore G1 rules now standing-accepted noise,
  drops from future risk reporting) · `reports/2026-08-24T170845Z-decision-watcher.md` (Forward
  mode clean no-op, 226/226 ADRs, nothing new; Revalidation mode sampled 5 claims, cursor 10→15 —
  adr-0011/12/13/14 confirmed, adr-0015 FALSIFIED, queued to `revalidation-queue.json` owner
  unassigned; new attention finding — `revalidation_checkpoint.py`'s IDR parser requires YAML
  frontmatter this repo's IDR dialect never carries, so the IDR arm has sampled 0 claims ever,
  distinct from the already-ruled-and-now-closed RDD placeholder gap) · `revalidation-queue.json`
  (1 pending: adr-0015 falsified, owner unassigned) · `watch-checkpoint.json` (both `gh_issues`/
  `gh_prs` advanced to 2026-08-24T17:08:45Z) · the prior plan (2026-08-24T03:15:36Z compose,
  carry-forward only) and `held-items.md`/`rulings.md` (durable state, read for exact
  carry-forward and ruling-conflict text, including the live-ruled 2026-08-24 entries covering the
  RDD mint and the #1609/#1605/#1610 mobilize close-out).
- **UNMEASURED**: none — all three seats reported successfully this firing; `gh` reachable
  (issue-sorter's checkpoint advance, repo-cleaner's live `gh pr list`); no missing input. `[]`.
- **Corrections vs the prior plan**:
  - Prior 1.1 (land the 2026-08-24T03:15:36Z ops state) — **DONE**: commit `28151364` ("ops:
    2026-08-24T03:15Z sweep state — ADR queue cleared, checkpoints advanced, plan refresh"),
    confirmed by `git log`. Superseded by this firing's own 1.1.
  - Prior 3.1 (rule on the RDD-tier tension) — **DONE, resolved**: `rulings.md`'s "2026-08-24 —
    Revalidation-mode RDD source" entry records Kim ruled live to mint `.claude/docs/rdd/` as an
    accepted zero-RDD placeholder (the 2026-08-20 ruling's original intent stands, only the
    mechanical realization changed); commit `1672354c` landed it; `.claude/docs/rdd/README.md`
    confirmed present on disk this compute pass. Dropped.
  - Prior 4.1 (#1609 — retire 6 stale G1 `.gitignore` rules) — **DONE, resolved out-of-band, NOT
    as originally framed**: `rulings.md`'s "2026-08-24 — mobilize close-out rulings" #2 records
    #1609 closed as **superseded** — the 2026-08-09 keep-list ruling stands, the six rules stay,
    the recurring `gitignore_check.py` noise is accepted permanently rather than the rules being
    removed. repo-cleaner confirms this firing: issue closed, tool keeps flagging by design, this
    line drops from risk reporting going forward. Dropped — closed as won't-fix, not as
    completed-per-original-spec.
  - Prior 4.2 (reap the #1583 scratch clone) — **STILL OPEN, carried forward unchanged**: neither
    seat touched it this firing, and `/var/folders/0b/jf4lh4jd4sd9y2q7x271c9jm0000gn/T/agent-ui-1583`
    is still present on disk (confirmed, full checkout incl. `node_modules`, not reaped). Carries
    as this firing's 4.2.
  - Prior 4.3 (nonoun-plugins#46 ratify-only-flip hash gap) — **carried, unchanged**: no seat
    carries cross-repo `nonoun-plugins` evidence this firing either; last live-verified OPEN
    2026-08-20T22:43Z, now stale by **six** consecutive firings. Carried forward as this firing's
    4.3, same interim pin.
  - No entry dropped as parked — no carried id shows a `backlog`/`roadmap` label in this firing's
    evidence.
- **New this firing** (decision-watcher, Revalidation mode):
  - adr-0015 **falsified** — cl.1-3 (elevation/brightness model, the `--ui-container-bg`/
    `--ui-container-tint` seam) hold unchanged; cl.4/5 name `--ui-space-{...}`/`--ui-radius-base`,
    which ADR-0140 (2026-07-18) renamed to `--md-sys-space-{...}`/`--md-sys-shape-corner-base` —
    neither old name exists anywhere today. Mechanical, no decision fork (the seat's own "Next
    command" names one clear path) — queues as new 4.1, hygiene debt, not a human-decision item.
  - IDR frontmatter-dialect gap — `revalidation_checkpoint.py`'s IDR parser requires YAML
    frontmatter (`doc-type: idr`, `status: locked`); this repo's `.claude/docs/idr/*.md` carries
    none (H1+blockquote-status-table dialect, `proposed·accepted·superseded` vocabulary, no
    `locked` state exists here at all). Result: the IDR arm has sampled **0 claims ever** since
    inception — a genuine new tooling tension, not a re-surfacing of the closed RDD question (that
    one was "no RDD tier exists"; this one is "an IDR tier exists but the tool can't read its
    shape"). Queues as new 3.1, human-decision — three real forks, no single obviously-correct
    mechanical path the way adr-0015 has one.
- **New this firing** (issue-sorter): nothing new needing action — all 7 touched items (#1611
  doing, #1609/#1605 closed, #1608 closed via merged #1610, PRs #1610/#1612/#1613 merged) were
  already resolved, correctly-labeled records before this window opened. #1605's missing severity
  label is a pre-existing gap on an existing record, flagged as observation only — out of a
  discovery-only seat's scope to repair, and out of this plan's own scope (dev-backlog record
  hygiene, not ops-mechanism debt, same treatment class as #1608 in the prior plan) — carried as a
  standing note only, not queued.
- **needs-ruling lane**: none — no `needs-ruling`-labeled GH issue in evidence this firing (the
  IDR dialect gap is a direct decision-watcher/tooling-contract tension, not a GH-label-driven
  lane, same class as last firing's RDD entry before it closed).
- **Blocked-by convention (#193)**: neither new queue candidate (adr-0015's amendment, the IDR
  ruling) is yet a minted GH issue with body text to check, and none of issue-sorter's 7 touched
  items are new queue entries this firing — no `Blocked-by:` evidence either way; queue order
  below is the plain (1)-(4) ranking, unmodified.
- **Verdict**: another consolidation pass. The prior firing's one open human-decision item
  (RDD-tier tension) resolved via Kim's live ruling and is now minted on disk; its hygiene item
  (#1609) closed as won't-fix rather than fixed-as-specified; its ops-state landing confirmed.
  What's left: one genuinely new human-decision item (the IDR frontmatter-dialect gap — 0 IDR
  claims ever sampled), one new small hygiene fix (adr-0015's falsified cl.4/5 token names), one
  still-open carried cleanup (#1583's scratch clone, confirmed still on disk), and the same stale
  upstream pin (nonoun-plugins#46, now six firings stale). repo-cleaner ran one gated mutation
  (PR #1607's branch reap) and the dispatching session resolved its one proposed-but-withheld item
  (the main fast-forward) same-session; issue-sorter's pass was a clean 7-item no-op.

Queue order: (1) gated mutations verified safe → (2) blockers → (3) human decisions → (4) hygiene.

## 1. Gated mutations already verified safe

### 1.1 Land this firing's ops state — one commit, ops paths ONLY (dispatching host; 5 min)
- **Action**: the seat outputs are already computed and on disk but not yet committed — `git add`
  exactly: `.claude/ops/revalidation-checkpoint.json` (modified, cursor advanced to 15),
  `.claude/ops/revalidation-queue.json` (modified, adr-0015:falsified queued),
  `.claude/ops/watch-checkpoint.json` (modified, both sources advanced to 2026-08-24T17:08:45Z),
  `.claude/ops/reports/2026-08-24T170845Z-decision-watcher.md` (new),
  `.claude/ops/reports/2026-08-24T170845Z-issue-sorter.md` (new),
  `.claude/ops/reports/2026-08-24T170845Z-repo-cleaner.md` (new), plus this plan's own payload
  once applied — then commit on `main`. Do NOT stage `.claude/ops/sweep-in-flight.json` (this
  sweep's own live marker, same exclusion as every prior firing).
- **Owner**: dispatching host (the ops-write split's dispatching session).
- **Evidence**: `git status --porcelain` this firing (3 modified + 3 untracked ops paths,
  confirmed live); `ops-write-sandbox-rules` (dispatcher applies + lands payloads).
- **Size**: 5 minutes.

## 2. Blocking other work

(none — repo-cleaner: 0 open PRs, one live worktree (`build-1600`, correctly kept — backs open
issue #1600), primary back in sync with `origin/main` after the same-session fast-forward, no
entry blocks another this firing.)

## 3. Human-decision items

### 3.1 Rule on the IDR frontmatter-dialect gap — Revalidation's IDR arm has sampled 0 claims ever (Kim; ~15 min) — new this firing
- **Action**: decision-watcher's Revalidation mode reports `revalidation_checkpoint.py`'s IDR
  parser hard-requires YAML frontmatter (`doc-type: idr`, `status: locked`) to identify a
  sampleable claim. This repo's `.claude/docs/idr/*.md` carries no frontmatter at all — an
  H1+blockquote-status-table dialect with `proposed·accepted·superseded` vocabulary, and no
  `locked` state exists in this repo's IDR tier (idr-0005's own table confirms). Net effect: the
  IDR arm of Revalidation mode has sampled 0 claims every firing since inception — a coverage gap
  distinct from the RDD placeholder gap that closed 2026-08-24 (that one was "no RDD tier exists
  here"; this one is "an IDR tier exists but the tool can't parse its shape"). Decide: (a) add
  YAML frontmatter to this repo's existing IDR docs to match the tool's expectation (mechanical,
  but changes every IDR doc's own format), (b) file an upstream bug against `nonoun-plugins`'
  `revalidation_checkpoint.py` to support a frontmatter-free H1+blockquote-status-table IDR
  dialect, or (c) formally scope Revalidation to ADR-only here (same shape as the closed RDD
  ruling) until a real fix lands, amending the 2026-08-20 ruling a second time. Whichever path,
  append a dated amendment to `rulings.md` recording it, so a future firing doesn't re-litigate.
- **Owner**: Kim (the ruling) · whichever session applies it (mechanical once ruled — frontmatter
  edits, an upstream issue filing, or a rulings.md amendment).
- **Evidence**: decision-watcher's report this firing, "Attention — IDR dialect gap" section;
  `.claude/ops/rulings.md` "Revalidation-mode scope — RULED 2026-08-20" and its 2026-08-24
  amendment (the RDD half of this same tension, already closed).
- **Size**: ~15 minutes (ruling + whichever mechanical fix).

## 4. Hygiene debt

### 4.1 File a dated ADR-0015 amendment for the falsified cl.4/5 token names (any available dev; ~15 min) — new this firing
- **Action**: `revalidation-queue.json` carries adr-0015 as falsified, owner unassigned. Cl.1-3
  (elevation/brightness two-axis model, the `--ui-container-bg`/`--ui-container-tint` seam) remain
  byte-identical and confirmed; only cl.4/5's literal token names drifted — they still read
  `--ui-space-{...}`/`--ui-radius-base`, which ADR-0140 (2026-07-18) renamed to
  `--md-sys-space-{...}`/`--md-sys-shape-corner-base`. No functional rework needed, only the
  record's own text. File a task (`file-task`) to append a dated amendment to ADR-0015 restating
  cl.4/5 under the current names, cross-referencing ADR-0140; once landed, the claim clears on
  decision-watcher's next Revalidation pass.
- **Owner**: any available dev (currently unclaimed — `revalidation-queue.json`'s own `owner`
  field reads `"unassigned"`).
- **Evidence**: `.claude/ops/revalidation-queue.json` (adr-0015 candidate, queued_at
  2026-08-24T17:11:36Z); decision-watcher's report this firing, Revalidation-mode table + "Next
  command" line.
- **Size**: ~15 minutes (doc-only amendment + file-task overhead).

### 4.2 Reap the #1583 scratch clone left on disk (Kim or any non-sandboxed session; ~2 min) — carried, still open
- **Action**: `/var/folders/0b/jf4lh4jd4sd9y2q7x271c9jm0000gn/T/agent-ui-1583` is still on disk
  (confirmed this firing — full checkout incl. `node_modules`, not reaped) — `rm` was denied to
  both the build seat and the marshal (sandboxing), per `held-items.md`'s 2026-08-23 resolutions
  section. The ruling that produced this clone (#1583's budget ceiling) closed weeks ago (PR
  #1588, merged) — this is pure leftover cleanup, not a pending decision. `rm -rf` the directory
  from a session with full filesystem permission.
- **Owner**: Kim, or any session not running under the write-sandbox.
- **Evidence**: `.claude/ops/held-items.md` "Resolutions, 2026-08-23 (marshal refresh)" — "Reap
  scratch clone ... manually (rm denied to seats and marshal)"; directory listing confirmed
  present this compute pass.
- **Size**: ~2 minutes.

### 4.3 nonoun-plugins#46 — ratify-only-flip hash gap; pin stands (upstream lane; 0 min here)
- **Action**: carried forward, NOT re-verified this firing (sweep mode — treated as still OPEN;
  last live-verified OPEN 2026-08-20T22:43Z, now stale by **six** firings — none of this firing's
  three seats carry cross-repo `nonoun-plugins` evidence). INTERIM PIN unchanged: when Kim ratifies
  an amendment on an already-`accepted` ADR with no body-byte change, the host re-dispatches
  decision-watcher with an explicit "re-judge adr-00NN amendment" instruction. Pin stays until #46
  closes.
- **Owner**: nonoun-plugins upstream (the script fix) · dispatching host (the pin, per firing) ·
  Kim (unparking the upstream bundle).
- **Evidence**: prior plan 4.3; live `gh issue view 46 -R kimgranlund/nonoun-plugins` → OPEN as of
  2026-08-20T22:43Z (now stale by six firings, safer-default open — not re-verified this firing
  per sweep-mode discipline).
- **Size**: 0 minutes here; small tooling task upstream.

## Standing notes (not queue entries)

- **RDD placeholder + ADR harvest both fully cleared**: `.claude/docs/rdd/README.md` confirmed
  present on disk (commit `1672354c`); `adr-queue.json` still reads `{"candidates": []}` — 0
  pending. Nothing further to confirm-batch on either front.
- **Intake fully clean, no-op**: issue-sorter — 7 items since 2026-08-24T03:15:36Z (#1611 doing,
  #1609/#1605 closed, #1608 closed via merged #1610, PRs #1610/#1612/#1613 merged), all
  trusted-author kimgranlund, all already minted/labeled, zero new holds. Checkpoint advanced for
  both `gh_issues` and `gh_prs` to 2026-08-24T17:08:45Z.
- **#1611 (task, size:small, doing)** — corpus-genui: thread pendingCount/outPath through judge
  --dry-run. Already correctly minted and in-flight; ordinary dev backlog, no ops-mechanics angle
  this firing — tracked here for visibility only, not queued.
- **#1605 missing severity label**: issue-sorter's own observation — pre-existing gap on an
  existing record (only a comment/park-note landed inside it this window), not newly minted here,
  so no create-time label-fallback applies. Dev-backlog record hygiene, not ops-mechanism debt —
  noted so a human or a future explicit re-triage can pick it up; not queued.
- **Hygiene git surface**: 0 open PRs, 1 gated mutation executed and reverified this firing
  (`campaign_close.py 1607` — PR #1607's stray remote branch reaped), 1 live worktree correctly
  kept, `main` back in sync with `origin/main` (`fff8e2d7`) after the dispatching session's
  same-session fast-forward + stray eval-verdict-stub discard.
- **Dirty `main` markers**: `.claude/ops/sweep-in-flight.json` only (this sweep's own live
  marker — leave until the sweep concludes).
- **gen-ui-kit**: out of this board's scope (dedicated session per Kim's ruling).

*Composed by chore-planner, 2026-08-24T17:08:45Z sweep firing — returned as payload per the #125
ops-write split; written and landed by the dispatching session.*

Dispatch: 2026-08-24T17:08:45Z
