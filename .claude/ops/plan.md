<!-- target-path: .claude/ops/plan.md -->
# Ops plan — agent-ui

- **Dispatch**: 2026-08-23T19:40:00Z sweep firing (chore-planner, /sweep-chores — seat findings
  attached for three lanes: decision-watcher, issue-sorter, repo-cleaner; judged exactly those,
  nothing refetched beyond the prior plan and the durable state those reports name by path —
  `adr-queue.json`, `held-items.md`).
- **Evidence**: attached seat findings this firing —
  `adr-checkpoint.json`/`adr-queue.json` (decision-watcher, both changed, payloads in its own
  report) → classify found delta **amended: adr-0112, adr-0227**; two new `harvest` candidates
  queued this firing, total pending now **7** across three target-skill groups · `watch-checkpoint.json`
  (issue-sorter, payload in its own report) → advanced both `gh_issues`/`gh_prs` to
  `2026-08-23T20:00:26Z` · `reports/2026-08-23T20:00:26Z.md` (issue-sorter, new, fenced payload
  returned) · repo-cleaner's own report (narrative only this firing — see gap note below) — plus
  the prior plan (2026-08-23T14:48:00Z compose, carry-forward only, not treated as fresh evidence)
  and `held-items.md` (read for exact carry-forward citation text, unchanged since last landed).
- **UNMEASURED**: none — all three seats (decision-watcher, issue-sorter, repo-cleaner) reported
  successfully this firing; `gh auth status` OK per issue-sorter; no live-`gh` outage, no missing
  input. `[]`.
- **Gap this firing (named, not absorbed)**: repo-cleaner's report names its own target report
  path in prose (`.claude/ops/reports/2026-08-23T200011Z-repo-cleaner.md`, "content = this report
  verbatim") but never emitted the matching fenced, target-pathed payload block for it —
  narrated-but-absent per `ops-write-sandbox-rules`. This plan does not fabricate that fence on
  repo-cleaner's behalf (chore-planner computes only `plan.md`); the dispatching session may
  reconstruct the file from repo-cleaner's raw report text if it chooses, but that path is
  excluded from entry 1.1's authoritative commit list below until a real fenced block backs it.
- **Corrections vs the prior plan**:
  - Prior 1.1 (land the 2026-08-23T14:48Z ops state) — DONE: confirmed by the fact this firing
    read the 14:48-dispatch plan back as the current file on disk. Superseded by this firing's own
    1.1.
  - Prior 3.1 (process the morning merge queue — PRs #1586/#1585/#1587) — **DONE**: repo-cleaner's
    `gh pr list --state open` returns 0 this firing; all three are now MERGED. Dropped. (Note:
    `held-items.md` itself still shows this queue as pending — that file wasn't touched by either
    seat this firing, so it's now stale against live truth; flagged here, not auto-edited — no
    seat returned a payload for it.)
  - Prior 3.2 (rule on #1583's marginal-budget ceiling) — **still open**, unaddressed by any seat
    this firing; carried forward verbatim as this firing's 3.1, now pending its **2nd consecutive
    firing**. `held-items.md` confirms the entry's content is unchanged.
  - Prior 3.3 (mint-vs-compose bundle: adr-0228+adr-0229+adr-0107 Am.4) — **still open**,
    unchanged per decision-watcher's classify; carried forward as this firing's 3.3, now pending
    its **4th consecutive firing**, and joined by a genuinely new row this firing (adr-0112 — see
    below).
  - Prior 3.4 (css-structural-laws bundle: adr-0230+adr-0008) — **still open**, unchanged; carried
    forward as this firing's 3.4, now pending its **3rd consecutive firing**.
  - Prior 3.5 (`harness-audit-2026-08-22/` untracked directory) — **resolved**: repo-cleaner's
    report this firing is explicitly full/non-abbreviated and its "Dirty main" section enumerates
    exactly one untracked item (`.claude/ops/sweep-in-flight.json`) — the directory is no longer
    present. Dropped.
  - Prior "new, awareness-only" `pr-1585-review` local branch — no longer mentioned in
    repo-cleaner's full report this firing (its 5-row reap-dry list doesn't include it, and PR
    #1585 is now merged); treated as resolved by the same full-coverage inference as the audit
    directory above. Dropped from standing notes.
  - **New this firing** (decision-watcher, 2 new `harvest` rows): **adr-0112** (Amendment 3,
    ratified 2026-08-23, PR #1597 — named-trigger re-open pattern, ui-avatar box off the Indicator
    ramp onto the control-height ladder) and **adr-0227**'s amendment (ratified 2026-08-23, GH
    #1545/PR #1548 — wave-2 adoption: skill-pack shelf + AgentTeam records). New 3.3 (joins
    existing bundle) and new 3.5 (own entry).
  - **New this firing** (repo-cleaner, proposed-but-not-executed): local branch `pr-1590`
    (`dc6cd350`) — not matched to any open/merged PR by headRefName, 1 pending commit per `git
    cherry`; the reap script's own gate refused it. New 3.2.
  - **Executed already, not queued**: repo-cleaner ran `reap-branches.mjs --execute` and
    `reap-worktrees.mjs --execute` directly (its own gated-mutation authority) — 5 local branches
    deleted (`1581-category-label-chip-rtl`, `fix/1592-genui-cli-no-key-proof`,
    `fix/red-tests-1593-1594`, `pr-1595`, `worktree-agent-af1db69e831407fc6`), 0 worktrees reaped
    (only candidate, `build-1600`, correctly kept — dirty/live, backs open issue #1600).
  - No entry dropped as parked — no carried id shows a `backlog`/`roadmap` label in this firing's
    evidence (issue-sorter's own search excludes both labels at read time; #1583 wasn't in this
    firing's discovery window, so no fresh label signal either way — carried forward under the
    existing default).
- **needs-ruling lane**: none — no `needs-ruling`-labeled GH issue in evidence this firing (#1583's
  ruling need is a build-budget ruling recorded directly in `held-items.md`, not a GH-label-driven
  lane).
- **Blocked-by convention (#193)**: no literal `Blocked-by:` line in any evidence this firing —
  queue order below is the plain (1)-(4) ranking, unmodified.
- **Verdict**: active pass — decision-watcher surfaced 2 genuinely new harvest candidates
  (adr-0112's named-trigger re-open pattern, adr-0227's wave-2 extension), bringing total pending
  ADR harvest rows to 7 across three target-skill groups. Issue-sorter ran an equally clean no-op
  intake pass — 13 issues + 14 PRs touched, all already minted/labeled/tracked, zero new mints,
  zero new holds, checkpoint advanced. Repo-cleaner had its most active firing in this arc:
  resolved two prior carried entries outright (merge queue → all 3 PRs now merged; the untracked
  audit directory → no longer present), executed 5 gated branch reaps directly, and surfaced one
  new unresolved branch (`pr-1590`) needing a human read — but also left its own report's stated
  output path unbacked by a fenced payload block, named above rather than silently absorbed.

Queue order: (1) gated mutations verified safe → (2) blockers → (3) human decisions → (4) hygiene.

## 1. Gated mutations already verified safe

### 1.1 Land this firing's ops state — one commit, ops paths ONLY (dispatching host; 5 min)
- **Action**: apply this plan's payload plus decision-watcher's and issue-sorter's own returned
  payloads, then `git add` exactly this firing's ops paths — `adr-checkpoint.json` (amended
  adr-0112/adr-0227 hashes), `adr-queue.json` (2 new harvest rows), `watch-checkpoint.json`
  (advanced), `reports/2026-08-23T20:00:26Z.md` (new, issue-sorter), plus this plan — and commit on
  `main`. Do NOT stage `.claude/ops/sweep-in-flight.json` (this sweep's own live marker). Do NOT
  land `reports/2026-08-23T200011Z-repo-cleaner.md` from this plan's own payload set — no fenced
  block backs that path this firing (see the Gap note above); land it separately only once a real
  fenced payload exists for it, or by hand-copying repo-cleaner's raw report text if the
  dispatching session judges that acceptable.
- **Owner**: dispatching host (the ops-write split's dispatching session).
- **Evidence**: `ops-write-sandbox-rules` (dispatcher applies + lands payloads); decision-watcher's
  and issue-sorter's own fenced payload blocks, this firing.
- **Size**: 5 minutes.

## 2. Blocking other work

(none — repo-cleaner: 0 open PRs, one live worktree (`build-1600`, correctly kept — backs open
issue #1600), primary in sync with `origin/main`, 5 dead local branches reaped; no entry blocks
another this firing.)

## 3. Human-decision items

### 3.1 Rule on #1583's marginal-budget ceiling bump (Kim; ~10 min) — carried, 2nd firing pending
- **Action**: unchanged from the prior firing — `build-1583` bisected the `@agent-ui/app` +104 B
  gz marginal-budget overage to commit `c6784a0c` (Kim-directed hover→`-dim`/`-high`, ADR-0008
  Amendment 2) — deliberate, not drift. ADR-0197 cl.5 bars upward re-basing except via a ruled
  exception. Decide: (a) bump `APP_MARGINAL_BUDGET` by ~104 B citing ADR-0008 Amendment 2, or (b)
  another remediation; apply the ruling, then re-run the budget check to confirm green. Also: the
  scratch clone at `/var/folders/0b/jf4lh4jd4sd9y2q7x271c9jm0000gn/T/agent-ui-1583` is still on
  disk (`rm` denied to both the seat and the marshal, per `held-items.md`) — reap it by hand once
  the ruling lands.
- **Owner**: Kim (the ruling) · whichever session applies the ceiling change (mechanical once
  ruled).
- **Evidence**: `.claude/ops/held-items.md` §"Kim's ruling/merge queue", entry dated
  2026-08-22T21:40Z (commit `320eb4a2`); unaddressed by any seat this firing, content confirmed
  unchanged.
- **Size**: ~10 minutes (ruling + config bump + verify).

### 3.2 Disposition of local branch `pr-1590` (Kim/host; ~10 min) — new this firing
- **Action**: `reap-branches.mjs --dry` classified `pr-1590` (`dc6cd350`) as PROPOSED but refused
  to reap it — not matched to any open/merged PR by headRefName, and `git cherry origin/main` shows
  1 pending commit. Determine whether this is a stale manual checkout of merged PR #1590's content
  (safe to delete by hand) or genuinely unmerged work (needs a PR opened or the work otherwise
  disposed of), then act accordingly.
- **Owner**: Kim or the dispatching host (investigate the branch's diff against `origin/main` and
  against PR #1590's merged content).
- **Evidence**: repo-cleaner's report this firing, `reap-branches.mjs --dry` output (5 REAP rows +
  this 1 PROPOSED row).
- **Size**: ~10 minutes.

### 3.3 Confirm + run the mint-vs-compose harvest bundle — adr-0228 + adr-0229 + adr-0107 Am.4 + adr-0112, ONE `/make-pack` extension to `component-design` (Kim; ~1 h) — carried, 4th firing pending; 4th row newly joined
- **Action**: unchanged core scope from the prior three firings, now joined by a 4th row — extend
  `component-design/references/mint-vs-compose.md`'s existing "smallest-floor scoping test"
  lineage (currently ADR-0107 → ADR-0205 → ADR-0219, 3 instances) with the charts arc as the 4th
  instance (adr-0228's `controls/_chart/` shared axis subsystem mint, adr-0229's
  ui-column-chart/ui-gauge mint + ui-line-chart axes extension, adr-0107 Amendment 4's
  fence-rows-REALIZED record) — **and**, newly this firing, adr-0112 Amendment 3 (ui-avatar's box
  moving off the ADR-0041 Indicator ramp onto the control-height ladder because its own 2026-07-08
  named, falsifiable re-open condition fired on a live surface): decision-watcher names this
  "likely a new entry near the mint-vs-compose/geometry lineage," same skill
  (`component-design`), exact placement TBD by `/make-pack`'s own Phase 2 — same relationship
  adr-0008 already has to adr-0230 in entry 3.4 below, so it bundles into the same single-skill run
  rather than a separate confirm. Two steps: (a) host surfaces the batch confirm (AskUserQuestion —
  approve the 4-row bundle-as-one, or split); (b) on approval Kim runs
  `/make-pack .claude/skills/component-design` herself — disable-model-invocation, host cannot fire
  it.
- **Owner**: Kim (confirm + the run) · dispatching host (surfaces the confirm).
- **Evidence**: `adr-queue.json` (4 `harvest` rows targeting this skill: 3 queued
  2026-08-21T11:20:00Z, `plan: ""`; adr-0112 queued 2026-08-23T20:02:29Z, new); decision-watcher's
  report this firing.
- **Size**: ~1 hour (one bundled doc-seat run, now 4 rows) + 2 minutes for the confirm.

### 3.4 Confirm + run the css-structural-laws harvest bundle — adr-0230 + adr-0008, ONE `/make-pack` extension to `component-standards` (Kim; ~45 min) — carried, 3rd firing pending
- **Action**: unchanged from the prior two firings — two `adr-queue.json` harvest rows targeting
  the SAME extension point, `component-standards/references/css-structural-laws.md` (an existing
  numbered CSS-gotcha list): (a) adr-0230 cl.4 — container-query SIZE queries cannot read `var()`,
  so a breakpoint ladder must use literal, banner-documented values; (b) adr-0008 Amendment 2 —
  `--md-sys-color-primary-dim`/`-high` resolve to the SAME value in the light `light-dark()`
  branch, collapsing hover≡active for the `primary` family in light scheme, a defect Kim directed
  reopened over the investigating agent's own objection, with a standing warning for future
  controls. Two steps: (a) host surfaces the batch confirm (AskUserQuestion — approve bundling both
  rows into one run, or split); (b) on approval Kim runs
  `/make-pack .claude/skills/component-standards` herself — same disable-model-invocation
  constraint as 3.3.
- **Owner**: Kim (confirm + the run) · dispatching host (surfaces the confirm).
- **Evidence**: `adr-queue.json` (2 `harvest` rows, queued 2026-08-22T18:29:34Z, still `plan: ""`
  as of this firing); decision-watcher's report this firing — unchanged.
- **Size**: ~45 minutes (one bundled doc-seat run, two gotcha rows) + 2 minutes for the confirm.

### 3.5 Confirm + run the patterns-table.md adr-0227 wave-2 extension (Kim; ~20 min) — new this firing
- **Action**: `component-patterns/references/patterns-table.md`'s existing ADR-0227 row already
  generically forward-names "then skill-packs/teams" but cites only the wave-1 worked file
  (`persona-roster-source.ts`); the amendment ratified 2026-08-23 (GH #1545/PR #1548) adds wave-2
  adoption — the skill-pack shelf (`skill-pack-store.ts: createSkillPackSource`) and AgentTeam
  records (`agent-team.ts: createAgentTeamSource`) joining the `DataSource`/`resource()`/
  `mutation()` roster. This is a sharpen/extend of the existing row, not a new lane — a single
  small `/make-pack` extension naming the wave-2 worked files + PR #1548. Two steps: (a) host
  surfaces the batch confirm (AskUserQuestion); (b) on approval Kim runs
  `/make-pack .claude/skills/component-patterns` herself.
- **Owner**: Kim (confirm + the run) · dispatching host (surfaces the confirm).
- **Evidence**: `adr-queue.json` (1 `harvest` row, queued 2026-08-23T20:02:29Z, new this firing);
  decision-watcher's report this firing.
- **Size**: ~20 minutes (single-row extension) + 2 minutes for the confirm.

## 4. Hygiene debt

### 4.1 nonoun-plugins#46 — ratify-only-flip hash gap; pin stands (upstream lane; 0 min here)
- **Action**: carried forward, NOT re-verified this firing (sweep mode — treated as still OPEN;
  last live-verified OPEN 2026-08-20T22:43Z, now stale by four firings — none of this firing's
  three seats carry cross-repo `nonoun-plugins` evidence). INTERIM PIN unchanged: when Kim ratifies
  an amendment on an already-`accepted` ADR with no body-byte change, the host re-dispatches
  decision-watcher with an explicit "re-judge adr-00NN amendment" instruction. Pin stays until #46
  closes.
- **Owner**: nonoun-plugins upstream (the script fix) · dispatching host (the pin, per firing) ·
  Kim (unparking the upstream bundle).
- **Evidence**: prior plan 4.1; live `gh issue view 46 -R kimgranlund/nonoun-plugins` → OPEN as of
  2026-08-20T22:43Z (now stale by four firings, safer-default open).
- **Size**: 0 minutes here; small tooling task upstream.

## Standing notes (not queue entries)

- **adr-0227's amendment**: RATIFIED this firing (2026-08-23, GH #1545/PR #1548) — previously
  noted as still `proposed`. Its harvest action is entry 3.5 above; not restated as its own prose
  lane per the `needs-ruling`-lane convention's spirit (the ADR itself is the source of the
  decision text).
- **Revalidation mode**: not part of this firing's decision-watcher report (Forward mode only,
  implicit — no Revalidation section returned) — cursor position not restated this firing; last
  confirmed 10/219 as of the 2026-08-22 firing, not reverified now. Flagged here so the next
  Revalidation resumption is visible rather than silently assumed continuous.
- **Intake fully clean, no-op**: issue-sorter — 13 issues + 14 PRs touched this window (#1545,
  #1580, #1581, #1583, #1584, #1589, #1592, #1593, #1594, #1599, #1600, #1604, #1605; PRs
  #1585-#1588, #1590, #1591, #1595-#1598, #1601-#1603, #1606), all already
  minted/labeled/tracked, zero new mints, zero new holds; checkpoint advanced for both `gh_issues`
  and `gh_prs` to 2026-08-23T20:00:26Z. Only #1600 remains open and unresolved-by-triage (already
  properly labeled/claimed, live worktree `build-1600` backs it — no triage action needed). Step 8
  (`github_mcp_offer`) not-applicable — already recorded `declined` (2026-08-05).
- **Hygiene git surface**: 0 open PRs (down from 3 — all merged, resolving prior 3.1), 5 dead local
  branches reaped this firing, 1 live worktree correctly kept, only `pr-1590` (entry 3.2) left
  unclassified.
- **Dirty `main` markers**: `.claude/ops/sweep-in-flight.json` only (this sweep's own live marker —
  leave until the sweep concludes); the prior firing's `harness-audit-2026-08-22/` finding is
  resolved (no longer present per repo-cleaner's full report this firing).
- **gitignore G1 noise** (6 stale rules): standing Kim-ruled keep-list, never re-proposed.
- **gen-ui-kit**: out of this board's scope (dedicated session per Kim's ruling).

*Composed by chore-planner, 2026-08-23T19:40:00Z sweep firing — returned as payload per the #125
ops-write split; written and landed by the dispatching session.*

Dispatch: 2026-08-23T19:40:00Z
