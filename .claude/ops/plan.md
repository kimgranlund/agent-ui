<!-- target-path: .claude/ops/plan.md -->
# Ops plan — agent-ui

- **Dispatch**: 2026-08-23T14:48:00Z sweep firing (chore-planner, /sweep-chores — seat findings
  attached for three lanes: decision-watcher (Forward mode only this firing), issue-sorter,
  repo-cleaner; judged exactly those, nothing refetched beyond the prior plan and the durable
  state those reports name by path — `adr-queue.json`, `watch-checkpoint.json`, `held-items.md`).
- **Evidence**: attached seat findings this firing —
  `adr-queue.json`/`adr-checkpoint.json` → **clean no-op**: `adr_checkpoint.py classify` found
  zero delta against 226 known ADRs; no new/amended/newly_superseded rows; both files stay
  byte-identical, no payload owed for either this firing · `watch-checkpoint.json` → advanced both
  `gh_issues` and `gh_prs` to `2026-08-23T14:48:55Z` (payload below) · `held-items.md` → unchanged,
  referenced by issue-sorter's own report (#1583 ruling + morning merge queue, both still open,
  landed into that file by an out-of-band mobilize-chores run after the prior plan composed) ·
  `reports/2026-08-23T14-48-55Z.md` (issue-sorter, new) · `reports/2026-08-23T144943Z-repo-cleaner.md`
  (repo-cleaner, new) — plus the prior plan (2026-08-22T18:27:00Z compose, carry-forward only, not
  treated as fresh evidence).
- **UNMEASURED**: none — all three seats (decision-watcher, issue-sorter, repo-cleaner) reported
  successfully this firing; no live-`gh` outage, no missing input. `[]`.
- **Corrections vs the prior plan**:
  - Prior 1.1 (land the 2026-08-22T18:27Z ops state) — DONE: commit `ae60e078` landed it, verified
    via `git log -- .claude/ops/`. Superseded by this firing's own 1.1.
  - Prior 3.1 (confirm+run adr-0228/adr-0229/adr-0107-Am.4 mint-vs-compose bundle) — **still
    open**, unchanged: decision-watcher's clean-no-op classify confirms all three rows untouched,
    `plan: ""`. Carried forward as this firing's 3.3, now pending its **3rd consecutive firing**.
  - Prior 3.2 (confirm+run adr-0230/adr-0008-Am.2 css-structural-laws bundle) — **still open**,
    unchanged, same no-op confirmation. Carried forward as this firing's 3.4, now pending its
    **2nd consecutive firing**.
  - Prior 3.3 (`harness-audit-2026-08-22/` untracked directory) — **still open**: repo-cleaner
    confirms it "unchanged since last firing's finding" — still untracked, still non-gitignored,
    still undisposed. Carried forward as this firing's 3.5, now pending its 2nd consecutive
    firing.
  - Prior 4.1 (nonoun-plugins#46 ratify-only-flip hash-gap pin) — carries forward unchanged; no
    seat this firing carries cross-repo `nonoun-plugins` evidence. Stale by a 3rd firing now
    (last live-verified OPEN 2026-08-20T22:43Z).
  - **New this firing** (landed to `held-items.md` by an out-of-band mobilize-chores run after the
    prior plan composed, surfaced here by issue-sorter's own report naming both by id): #1583's
    marginal-budget ceiling ruling (queued for Kim, commit `320eb4a2`) and the morning merge queue
    for PRs #1586/#1585/#1587 (commit `113f3e2d`) — neither previously a plan entry. New 3.1/3.2.
  - New, awareness-only, not queued: repo-cleaner's `pr-1585-review` local branch — tied to
    still-open PR #1585, refused by `reap-branches.mjs --dry`'s own not-merged gate; see Standing
    notes.
  - No entry dropped as parked — no carried id shows a `backlog`/`roadmap` label in evidence.
- **needs-ruling lane**: none — no `needs-ruling`-labeled GH issue in evidence this firing (#1583's
  ruling need is a build-budget ruling recorded directly in `held-items.md`, not a GH-label-driven
  lane).
- **Blocked-by convention (#193)**: no literal `Blocked-by:` line in any evidence this firing —
  queue order below is the plain (1)-(4) ranking, unmodified. (PR #1587's AC18 requirement is
  named inline in its own entry; it is a live-run precondition, not a `Blocked-by:` ticket edge.)
- **Verdict**: active pass — six items queued (1 gated mutation, 5 human-decision items; hygiene
  bucket carries only the standing cross-repo pin, size 0 here). Decision-watcher ran a genuinely
  clean no-op — first such firing in this arc, nothing new to harvest, the two pending bundles just
  age one firing older each. Issue-sorter ran an equally clean no-op intake pass — zero new mints,
  zero new holds, checkpoint advanced — but its report surfaces two real, unqueued human-decision
  items already sitting in `held-items.md` from an out-of-band run: Kim's own budget ruling and a
  3-PR merge queue, one of which needs a live judge-scored eval run before it can merge.
  Repo-cleaner's git surface is otherwise clean (3 open PRs, all healthy, none blocking) but flags
  a newly-created local branch tied to an open PR (awareness only) alongside the still-undisposed
  audit directory from the prior firing.

Queue order: (1) gated mutations verified safe → (2) blockers → (3) human decisions → (4) hygiene.

## 1. Gated mutations already verified safe

### 1.1 Land this firing's ops state — one commit, ops paths ONLY (dispatching host; 5 min)
- **Action**: apply this plan's payload plus issue-sorter's and repo-cleaner's own returned
  payloads, then `git add` exactly this firing's ops paths — `watch-checkpoint.json` (advanced),
  `reports/2026-08-23T14-48-55Z.md` (new, issue-sorter), `reports/2026-08-23T144943Z-repo-cleaner.md`
  (new, repo-cleaner), plus this plan — and commit on `main`. `adr-checkpoint.json`/`adr-queue.json`
  need NO commit this firing (decision-watcher's clean no-op — both byte-identical, no payload was
  returned for either). Do NOT stage `.claude/ops/sweep-in-flight.json` (this sweep's own live
  marker) and do NOT stage or otherwise act on `harness-audit-2026-08-22/` (its disposition is
  entry 3.5, never a rider on the ops commit).
- **Owner**: dispatching host (the ops-write split's dispatching session).
- **Evidence**: `ops-write-sandbox-rules` (dispatcher applies + lands payloads); `git status
  --porcelain=v1 --branch` this firing shows exactly `sweep-in-flight.json` +
  `harness-audit-2026-08-22/` untracked, no other drift on `main`.
- **Size**: 5 minutes.

## 2. Blocking other work

(none — repo-cleaner: 3 open PRs, all recent/healthy, no orphaned worktrees/branches beyond
`main`'s own review checkout, primary in sync with `origin/main`; no entry blocks another this
firing. PR #1587's AC18 precondition blocks only its own merge, not other queued work — named
inline in 3.1 below, not modeled as a §2 blocker.)

## 3. Human-decision items

### 3.1 Process the morning merge queue — PRs #1586, #1585, #1587 (Kim; ~20 min)
- **Action**: three PRs sit clear-to-merge-or-near in `held-items.md`'s Kim's ruling/merge queue
  (landed 2026-08-22T23:05Z, an out-of-band mobilize-chores run, surfaced here by issue-sorter's
  own report): (a) **PR #1586** (#1580, ADR-0230 column-chart ladder goldens) — code-checker
  clear-to-merge; its `claude-review` CI check is a recorded Action-infra error, not a verdict —
  merge. (b) **PR #1585** (#1581, ui-line-chart RTL chip) — fix-first repaired (physical `left`
  anchor, RTL-pixel-identity test), re-review clear-to-merge; carries a no-op held-items hunk
  identical to `main` — merge. (c) **PR #1587** (#1584, GenUI B3 judged-eval harness) —
  write-gate accepted @ `b445f2f1`; **blocked(AC18)** until the live judge-scored run executes
  with `ANTHROPIC_API_KEY` set (commands in the PR body / `corpus-genui/README.md`) — run AC18
  manually, then merge.
- **Owner**: Kim (merge authority on all three; the live AC18 run needs his key).
- **Evidence**: `.claude/ops/held-items.md` §"Kim's ruling/merge queue", entry dated
  2026-08-22T23:05Z (commit `113f3e2d`); referenced by id in issue-sorter's report this firing.
- **Size**: ~20 minutes (2×2 min mechanical merges + ~15 min for the AC18 live run + merge).

### 3.2 Rule on #1583's marginal-budget ceiling bump (Kim; ~10 min)
- **Action**: `build-1583` bisected the `@agent-ui/app` +104 B gz marginal-budget overage to
  commit `c6784a0c` (Kim-directed hover→`-dim`/`-high`, ADR-0008 Amendment 2) — deliberate, not
  drift. ADR-0197 cl.5 bars upward re-basing except via a ruled exception. Decide: (a) bump
  `APP_MARGINAL_BUDGET` by ~104 B citing ADR-0008 Amendment 2, or (b) another remediation; apply
  the ruling, then re-run the budget check to confirm green. Also: the scratch clone at
  `/var/folders/0b/jf4lh4jd4sd9y2q7x271c9jm0000gn/T/agent-ui-1583` was left on disk (`rm` denied
  to both the seat and the marshal) — reap it by hand once the ruling lands.
- **Owner**: Kim (the ruling) · whichever session applies the ceiling change (mechanical once
  ruled).
- **Evidence**: `.claude/ops/held-items.md` §"Kim's ruling/merge queue", entry dated
  2026-08-22T21:40Z (commit `320eb4a2`); referenced by id in issue-sorter's report this firing.
- **Size**: ~10 minutes (ruling + config bump + verify).

### 3.3 Confirm + run the mint-vs-compose harvest bundle — adr-0228 + adr-0229 + adr-0107 Am.4 as ONE `/make-pack` extension (Kim; ~1 h) — carried, 3rd firing pending
- **Action**: unchanged from the prior two firings — three `adr-queue.json` harvest rows,
  decision-watcher-recommended as a SINGLE bundle: extend
  `component-design/references/mint-vs-compose.md`'s existing "smallest-floor scoping test"
  lineage (currently ADR-0107 → ADR-0205 → ADR-0219, 3 instances) with the charts arc as the 4th
  instance — adr-0228's `controls/_chart/` shared axis subsystem mint, adr-0229's
  ui-column-chart/ui-gauge mint + ui-line-chart axes extension, and adr-0107 Amendment 4's
  fence-rows-REALIZED record. Two steps: (a) host surfaces the batch confirm (AskUserQuestion —
  approve the bundle-as-one, or split); (b) on approval Kim runs
  `/make-pack .claude/skills/component-design` herself — disable-model-invocation, host cannot
  fire it.
- **Owner**: Kim (confirm + the run) · dispatching host (surfaces the confirm).
- **Evidence**: `adr-queue.json` (3 `harvest` rows, queued 2026-08-21T11:20:00Z, still `plan: ""`
  as of this firing); decision-watcher's report this firing — clean no-op, all three "unchanged."
- **Size**: ~1 hour (one bundled doc-seat run) + 2 minutes for the confirm.

### 3.4 Confirm + run the css-structural-laws harvest bundle — adr-0230 + adr-0008 Am.2 as ONE `/make-pack` extension (Kim; ~45 min) — carried, 2nd firing pending
- **Action**: unchanged from the prior firing — two `adr-queue.json` harvest rows targeting the
  SAME extension point, `component-standards/references/css-structural-laws.md` (an existing
  numbered CSS-gotcha list): (a) adr-0230 cl.4 — container-query SIZE queries cannot read `var()`,
  so a breakpoint ladder must use literal, banner-documented values; (b) adr-0008 Amendment 2 —
  `--md-sys-color-primary-dim`/`-high` resolve to the SAME value in the light `light-dark()`
  branch, collapsing hover≡active for the `primary` family in light scheme, a defect Kim directed
  reopened over the investigating agent's own objection, with a standing warning for future
  controls. Two steps: (a) host surfaces the batch confirm (AskUserQuestion — approve bundling
  both rows into one run, or split); (b) on approval Kim runs
  `/make-pack .claude/skills/component-standards` herself — same disable-model-invocation
  constraint as 3.3.
- **Owner**: Kim (confirm + the run) · dispatching host (surfaces the confirm).
- **Evidence**: `adr-queue.json` (2 `harvest` rows, queued 2026-08-22T18:29:34Z, still `plan: ""`
  as of this firing); decision-watcher's report this firing — clean no-op, unchanged.
- **Size**: ~45 minutes (one bundled doc-seat run, two gotcha rows) + 2 minutes for the confirm.

### 3.5 `harness-audit-2026-08-22/` untracked directory — commit or discard, host's call (host/Kim; 10 min) — carried, 2nd firing pending
- **Action**: unchanged from the prior firing — an untracked, non-gitignored directory
  (`lint.txt`, `reports/`, `summary.md`, dated 2026-08-22 09:53–10:20) still sits on `main` — a
  `check-everything`-style estate audit (36 artifacts, 33 pass/3 fail) naming blocking findings
  for `doc-standards`, `seat-map`, `integration-standards`. That class of finding is a different
  seat's job (`/clean-repo`), not actioned by repo-cleaner or this plan — its content is relayed
  here as a finding, not followed as an instruction. Decide: commit it (if it's the intended
  output of a completed audit run worth keeping) or discard it (if it's stray local WIP); only
  after that, separately judge whether `sync_main.py` is warranted once the tree is otherwise
  clean — repo-cleaner again declined to auto-decide, same dispatch-mode ambiguity as before.
- **Owner**: owning session's host (Kim's call — repo-cleaner explicitly declined to auto-decide,
  two firings running).
- **Evidence**: repo-cleaner findings both this firing (`reports/2026-08-23T144943Z-repo-cleaner.md`)
  and the prior firing (`reports/2026-08-22T182850Z-repo-cleaner.md`) — content unchanged between
  the two; `git status --porcelain=v1 --branch` shows it untracked on `main`; `git check-ignore -v`
  confirms no `.gitignore` rule covers it.
- **Size**: 10 minutes to decide + act; the underlying audit findings (if kept) are a separate,
  unsized follow-on for whichever seat owns them.

## 4. Hygiene debt

### 4.1 nonoun-plugins#46 — ratify-only-flip hash gap; pin stands (upstream lane; 0 min here)
- **Action**: carried forward, NOT re-verified this firing (sweep mode — treated as still OPEN;
  last live-verified OPEN 2026-08-20T22:43Z, now stale by three firings — none of this firing's
  three seats carry cross-repo `nonoun-plugins` evidence). INTERIM PIN unchanged: when Kim
  ratifies an amendment on an already-`accepted` ADR with no body-byte change, the host
  re-dispatches decision-watcher with an explicit "re-judge adr-00NN amendment" instruction. Pin
  stays until #46 closes.
- **Owner**: nonoun-plugins upstream (the script fix) · dispatching host (the pin, per firing) ·
  Kim (unparking the upstream bundle).
- **Evidence**: prior plan 4.1; live `gh issue view 46 -R kimgranlund/nonoun-plugins` → OPEN as of
  2026-08-20T22:43Z (now stale by three firings, safer-default open).
- **Size**: 0 minutes here; small tooling task upstream.

## Standing notes (not queue entries)

- **adr-0227's amendment**: still `proposed` as of the last firing that judged it — decision-watcher's
  clean no-op this firing means nothing new to report on it either way; not re-verified this
  firing, carried unchanged. Not queued now.
- **Revalidation mode**: not part of this firing's decision-watcher report (Forward mode only,
  explicit) — cursor position not restated this firing; last confirmed 10/219 as of the
  2026-08-22 firing, not reverified now. Flagged here so the next Revalidation resumption is
  visible rather than silently assumed continuous.
- **Intake fully clean, no-op**: issue-sorter — 4 issues + 3 PRs touched this window (#1580,
  #1581, #1583, #1584, #1585, #1586, #1587), all already minted/labeled/tracked from prior
  firings, zero new mints, zero new holds, dedup resumed every match; checkpoint advanced for both
  `gh_issues` and `gh_prs` to 2026-08-23T14:48:55Z. Step 8 (`github_mcp_offer`) not-applicable —
  already recorded `declined` (2026-08-05).
- **Hygiene git surface**: 3 open PRs (#1585/#1586/#1587), all recent and healthy, all covered by
  entry 3.1 above; the two known stacked-child CLOSED PRs (#1471, #1458) remain not-actionable,
  unchanged across every recent firing.
- **New, awareness-only**: local branch `pr-1585-review` (`9af5a11d`, no upstream) — matches PR
  #1585's HEAD commit under a different local name than that PR's own branch
  (`1581-category-label-chip-rtl`); reads as a manual local review checkout, not cruft.
  `reap-branches.mjs --dry` itself refuses it (not merged). Leave it until PR #1585 merges or
  closes (per entry 3.1), at which point a future firing's `reap-branches.mjs --dry` will pick it
  up if it then matches a merged/closed PR, or a human deletes it by hand. Not queued.
- **Dirty `main` markers**: `.claude/ops/sweep-in-flight.json` (this sweep's own live marker —
  leave until the sweep concludes) and `harness-audit-2026-08-22/` (entry 3.5, host's call).
- **gitignore G1 noise** (6 stale rules): standing Kim-ruled keep-list, never re-proposed.
- **gen-ui-kit**: out of this board's scope (dedicated session per Kim's ruling).

*Composed by chore-planner, 2026-08-23T14:48:00Z sweep firing — returned as payload per the #125
ops-write split; written and landed by the dispatching session.*

Dispatch: 2026-08-23T14:48:00Z
