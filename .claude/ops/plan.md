# Ops plan — agent-ui

- **Dispatch**: 2026-08-29T17:05:00Z sweep firing (chore-planner, fallback fan-out — no
  `sweep_guard.mjs`/`chore-sweep.js` vendored in this repo). Judged the two fresh seat reports
  attached to this dispatch (issue-sorter, repo-cleaner, both timestamped `2026-08-29T170500Z`)
  plus the prior plan (`2026-08-28T03:40:00Z`, carry-forward only) and durable state read directly
  off disk per the dispatch's own instruction: `adr-checkpoint.json` (re-baselined — `formula_
  version: 2` added, adr-0058/adr-0059 hashes changed, 226 ADRs total, confirmed by `git diff`),
  `adr-queue.json` (3 rows — adr-0129 unchanged, two new adr-0058/adr-0059 harvest rows), `revalidation-
  checkpoint.json` (cursor 65→70), `revalidation-queue.json` (2 new falsified rows — adr-0067,
  adr-0069 — up from 0), `watch-checkpoint.json` (both sources advanced to 2026-08-29T17:24:30Z),
  `held-items.md` (unchanged, nothing held). **No decision-watcher report file exists for this
  firing** (the dispatch named only issue-sorter/repo-cleaner report paths and gave decision-
  watcher's own findings as inline prose instead, explicitly flagging "read current state directly
  rather than trusting this summary") — judged as durable state (evidence tier 2), not as an
  attached report, and cross-checked directly against every file's own diff rather than taken on
  the prose's word.
- **Evidence**:
  `reports/2026-08-29T170500Z-issue-sorter.md` (clean; #1699/#1701 correctly skipped, in-flight;
  #1702 reviewed, well-formed, resumed as-is, no mint needed; both checkpoints advanced to
  17:24:30Z; held-items unchanged) ·
  `reports/2026-08-29T170500Z-repo-cleaner.md` (0 stale worktrees/branches; 1 stale `origin/*` ref
  pruned (#1692's merged branch, already GitHub-deleted); 3 open issues live (#1699/#1701 claimed
  in-flight backing 2 live scratch clones, #1702 unclaimed/untouched); 1 open PR (#1700, fresh,
  backs the live planner seat); primary at exact parity with `origin/main`; one non-actionable
  survey gap named — `reap-scratch-clones.mjs`'s scan roots don't discover the #1699 build's
  scratch clone, nothing reapable missed either way) ·
  `git diff .claude/ops/adr-checkpoint.json` (adr-0058/adr-0059 hashes changed, `formula_version:
  2` added — confirms both ADRs were actually re-edited, matching PR #1693/#1696 below) ·
  `git diff .claude/ops/revalidation-checkpoint.json .claude/ops/watch-checkpoint.json` (cursor
  65→70 at `2026-08-29T17:29:50Z`; both gh sources 03:40:00Z→17:24:30Z) ·
  `.claude/ops/adr-queue.json`'s two new rows verbatim (adr-0058/adr-0059, both `queued_at:
  2026-08-29T17:26:20Z`, kind `harvest`: a phantom-tool-citation correction pattern — an ADR citing
  a tool, `color-verify/contrast-check.py`, that was never actually committed to the repo — a
  DIFFERENT defect class from the already-tracked 12-instance "4th shape" restatement pattern;
  checked `origin/main`, no reference anywhere covers it) ·
  `.claude/ops/revalidation-queue.json`'s two new rows verbatim (adr-0067 — Decision cl.1/2 names a
  stale a2ui harness roster, 2 skills + 1 agent pair, against a live corpus of 7 skills + 6 agents
  none matching the named identifiers, no Amendment recorded; adr-0069 — Decision clause 5 claims a
  present-tense `BrowserDirectTransport` "provisioned... a real provisioned dev path," but no such
  class, no `VITE_ANTHROPIC_API_KEY`, no `anthropic-dangerous-direct-browser-access` usage exists
  anywhere in `packages/`/`site/` source; ADR-0200 later built the actual three-backend
  generalization, but its three backends are replay/proxy/a2a, not browser-direct, and its own
  header names no relation to ADR-0069 at all — both rows `owner: unassigned`, unattended firing) ·
  `gh issue view 1692/1694/1695 --json state,mergedAt` + `gh pr view 1693/1696/1697 --json
  state,mergedAt,title` (all four tickets CLOSED via merged PRs: #1692→#1693 05:07:37Z, citation
  correction; #1694→#1696 18:41:05Z, adr-0059 full figure re-audit; #1695→#1697, unrelated
  scratch-clone bootstrap automation now in CLAUDE.md's Commands) ·
  direct `Read` of `.claude/docs/adr/0067-harness-right-sizing-realized-estate.md` and
  `.claude/docs/adr/0069-a2ui-live-agent-demo-shape.md` (neither carries an `## Amendment` section
  today — confirmed via heading grep — so either ticket's fix is a genuinely NEW append) ·
  `grep -rn "color-verify\|contrast-check.py\|phantom" .claude/skills/doc-standards/references/*.md`
  (no hit — corroborates the harvest row's own "not yet covered" claim) ·
  `grep -rl "OKLCH\|contrast ratio\|WCAG" .claude/docs/references/*.md` (`tokens.md` and
  `component-authoring-best-practices.md` are the only hits — a third candidate home, named at §3) ·
  direct read of `revalidation_checkpoint.py`'s `parse_idr_frontmatter`/`scan_idr_claims` (requires
  YAML frontmatter with `doc-type: idr` AND `status == "locked"`) against this repo's own
  `.claude/docs/idr/*.md` (8 files, H1+blockquote-table dialect, NO frontmatter at all, vocabulary
  `proposed · accepted · superseded` — `locked` never used) — confirms the structural finding is
  real: `scan_idr_claims` returns `{}` for this repo on every firing, so the 4 currently-accepted
  IDRs (idr-0005/0006/0007/0008) have never once entered revalidation sampling ·
  `gh issue view {1699,1701,1702} --json body -q .body | grep -i blocked-by` (none of the 3 open
  issues carry a `Blocked-by:` line) · `gh issue list --state open --json number,labels` (3 open:
  #1699/#1701/#1702, none carry `backlog`/`roadmap`/`needs-ruling`) ·
  `git rev-parse HEAD` + `git fetch origin main` + `git ls-remote origin refs/heads/main` (all
  three `9d2075df…`, primary at exact push-verified parity with `origin/main`, matching
  repo-cleaner).
- **UNMEASURED**: none — `gh` reachable all firing (issue-sorter's own check, plus my own live
  corroboration); `git`/`origin` reachable throughout. `[]`. Separately, and NOT an UNMEASURED
  gh/git gap: the specific identities of the ~3 revalidation claims this round's cursor-advance
  (65→70) confirmed (i.e., everything besides the 2 falsified rows) are not independently named
  here, since no decision-watcher report file exists this firing to cite them from — the aggregate
  cursor advance and the queue's exact 2 new rows are confirmed directly against disk; the
  confirmed claims' specific ids are not fabricated to fill the gap.
- **Corrections vs the prior plan** (2026-08-28T03:40:00Z):
  - Prior 1.1 (land that firing's ops-state + plan payload) — **DONE**: commit `4ff58bc3`,
    confirmed by `git log`.
  - Prior 4.1 (harvest adr-0129, 9 consecutive firings unconverted as of that plan) — **STILL
    OPEN, carried forward, now 10 consecutive firings unconverted.** Between that plan and this
    one, an out-of-band commit (`91e665bb`, "fleet stand-down 2026-08-28, adr-0129 harvest home
    decided") added the decided home directly into both `adr-queue.json`'s row and this plan's own
    §4.1 text — not a chore-planner sweep firing, so it does not reset the staleness count; only
    the actual `/make-pack` run would.
  - Prior 4.2 (mobilize #1692) — **DONE**: #1692 closed via merged PR #1693 (path (b) chosen —
    corrected the three ADRs' citations, canonized the OKLCH→OKLab→linear-sRGB→WCAG method as the
    standing procedure). This closure had two follow-on effects, both also now resolved and
    dropped: (a) applying the corrected method to a full re-audit of ADR-0059 surfaced REAL
    post-2026-07-10-ramp-rework figure drift, filed as #1694, fixed via merged PR #1696; (b) an
    unrelated scratch-clone bootstrap gap surfaced during the same build, filed as #1695, fixed via
    merged PR #1697 (now `npm run ops:bootstrap-scratch-clone`, documented in CLAUDE.md). Neither
    follow-on is ops debt — both are closed, regular dev tickets, dropped from tracking, not
    carried forward.
  - **New this firing, not yet actioned (unlike the #1690/#1692 precedent, where the dispatching
    session pre-filed before the plan was composed): the revalidation queue's two falsified rows
    (adr-0067, adr-0069) sit unconverted** — queued at §1 below, not deferred.
  - No entry dropped as parked — all 3 open issues this firing (#1699, #1701, #1702) carry neither
    `backlog` nor `roadmap`.
- **New this firing** (issue-sorter): #1699/#1701 correctly skipped (in-flight); #1702 reviewed,
  well-formed, resumed as-is; nothing held; both checkpoints advanced.
- **New this firing** (repo-cleaner): 1 stale `origin/*` ref pruned; 3 open issues surveyed (2
  claimed/in-flight, 1 unclaimed/untouched); 1 open PR (#1700, fresh, live planner seat); 1
  scratch-clone survey gap named (non-actionable); consecutive-unchanged-firing count reset to 0.
- **New this firing** (decision-watcher, read from durable state, no attached report): forward mode
  re-baselined the checkpoint to formula v2 and queued 2 new harvest candidates (adr-0058,
  adr-0059 — the phantom-tool-citation pattern) alongside the standing adr-0129 row. Revalidation
  mode advanced the cursor 65→70 and queued 2 falsified verdicts (adr-0067, adr-0069) plus named a
  structural finding outside either queue's own row shape: 0 IDR claims have ever entered
  revalidation sampling, a schema/dialect mismatch, not a sampling miss.
- **needs-ruling lane**: none this firing — no open issue carries the label.
- **Blocked-by convention (#193)**: 3 open issues this firing (#1699, #1701, #1702); none carry a
  `Blocked-by:` line (confirmed live). No blocker relationship changes this plan.
- **Verdict — a clean-detection firing: the #1692 thread closed end-to-end with two productive
  follow-ons, and decision-watcher surfaced three genuinely new findings that need action rather
  than being pre-actioned before this plan was composed.** What's left: land this firing's
  ops-state + plan payload (§1.1), file the two falsified-ADR tasks with their Amendments (§1.2,
  §1.3) — both evidence-complete, no further judgment needed — get Kim's home call on the
  adr-0058/0059 harvest pair (§3.1), and keep pushing the adr-0129 harvest (now 10 firings stale,
  §4.1) plus file the IDR-revalidation-schema-gap as its own two-path ticket (§4.2). §2 is empty.

Queue order: (1) gated mutations verified safe → (2) blockers → (3) human decisions → (4) hygiene.

## 1. Gated mutations already verified safe

### 1.1 Land this firing's ops-state + plan payload (dispatching host; ~3–5 min)
- **Action**: `git add` the 2 new seat reports
  (`reports/2026-08-29T170500Z-{issue-sorter,repo-cleaner}.md`), `adr-checkpoint.json`
  (re-baselined, formula v2), `adr-queue.json` (3 rows: adr-0129, adr-0058, adr-0059),
  `revalidation-checkpoint.json` (cursor 70), `revalidation-queue.json` (2 rows: adr-0067,
  adr-0069), `watch-checkpoint.json` (both sources advanced), and this plan's own payload —
  commit and push to `main` in one batch.
- **Owner**: dispatching host (the ops-write split's dispatching session).
- **Evidence**: `git status --porcelain` (5 modified + 2 untracked, listed above); `git rev-parse
  HEAD` + `git ls-remote origin refs/heads/main` (both `9d2075df…`, confirming primary otherwise
  current before this batch lands).
- **Size**: 3–5 minutes.

### 1.2 File task + append Amendment — ADR-0067's Decision names a harness roster that no longer exists (Kim or dispatching host; ~20–30 min) — new this firing
- **Action**: ADR-0067 Decision clauses 1–2 name an exact roster — two skills
  (`a2ui-compose`, `a2ui-corpus-curate`) and one maker/critic agent pair (`a2ui-composer`,
  `a2ui-reviewer`) — realized differently: the live corpus carries 7 a2ui-prefixed skills
  (`a2ui-build`, `a2ui-catalog-rendering-review`, `a2ui-corpus-curation`, `a2ui-multi-catalog`,
  `a2ui-payload-authoring`, `a2ui-prompt-authoring`, `a2ui-review-standards`) and 6 agents
  (`a2ui-build-agent`, `a2ui-payload-authoring-agent`, `a2ui-review-agent`,
  `component-build-agent`, `example-authoring-agent`, `repo-orchestrator-agent`) — none matching
  the named identifiers, and no later ADR records this reorganization as an Amendment or
  Supersession of adr-0067. File a `task` ticket citing `revalidation-queue.json`'s adr-0067 row
  verbatim, then append a `## Amendment` section to ADR-0067 (append-only, T4) restating the
  realized roster against the original Decision text — the underlying capability is confirmed
  still alive, only the named identifiers are stale.
- **Owner**: Kim or dispatching host (`gh issue create` + one `## Amendment` append — no design
  judgment required, the roster restatement is dictated by what already exists on `origin/main`).
- **Evidence**: `.claude/ops/revalidation-queue.json`'s adr-0067 row, full evidence text (queued
  `2026-08-29T17:29:44Z`, `kind: falsified`, `owner: unassigned`); `.claude/docs/adr/
  0067-harness-right-sizing-realized-estate.md` L29-61 (the stale Decision text) — confirmed via
  `Read` to carry no `## Amendment` section yet; `git grep` for the current skill/agent names
  across `.claude/skills/`/`.claude/agents/` (decision-watcher's own cited check).
- **Size**: ~20–30 minutes.

### 1.3 File task + append Amendment — ADR-0069 clause 5's BrowserDirectTransport was never built (Kim or dispatching host; ~20–30 min) — new this firing
- **Action**: ADR-0069 Decision clause 5 claims, present-tense, that a `BrowserDirectTransport` "is
  provisioned behind the same seam" with a real `.env` `VITE_` variant making it "a real
  provisioned dev path, not a paste-a-key hypothetical." No such class exists; no
  `VITE_ANTHROPIC_API_KEY` or `anthropic-dangerous-direct-browser-access` reference exists anywhere
  in `packages/` or `site/` source (only an incidental hit inside a built `site/.fixture-scratch`
  bundle asset, not source). ADR-0200 (ratified 2026-08-17) later built the actual "three backends
  behind one `AgentTransport` seam" generalization CLAUDE.md cites, but its three backends are
  replay/proxy/a2a — no browser-direct/client-key backend — and its own header names no relation to
  ADR-0069 or clause 5 at all. Clauses 1–4 and 6 remain confirmed live. File a `task` ticket citing
  `revalidation-queue.json`'s adr-0069 row verbatim, then append a `## Amendment` recording clause
  5's drop (never built, no successor claims it) while leaving clauses 1-4/6 untouched.
- **Owner**: Kim or dispatching host (`gh issue create` + one `## Amendment` append — mechanical;
  decision-watcher's own grep across `packages/`/`site/` already establishes the negative).
- **Evidence**: `.claude/ops/revalidation-queue.json`'s adr-0069 row, full evidence text (queued
  `2026-08-29T17:29:44Z`, `kind: falsified`, `owner: unassigned`); `.claude/docs/adr/
  0069-a2ui-live-agent-demo-shape.md` L52-102 (Decision clause 5) — confirmed via `Read` to carry
  no `## Amendment` section yet; `packages/agent-ui/devtools/src/transports/backends.ts` (ADR-0200's
  actual realized three: replay/proxy/a2a, no browser-direct).
- **Size**: ~20–30 minutes.

## 2. Blocking other work

(none — 1 open PR live-confirmed (#1700, fresh, backs the live planner seat, blocks nothing),
primary exactly current with `origin/main` at `9d2075df`; none of the 3 open issues carry a
`Blocked-by:` line or block anything else in evidence.)

## 3. Human-decision items

### 3.1 Decide home for the adr-0058/adr-0059 phantom-tool-citation harvest pair (Kim; decision only, ~5–10 min to rule, home's own build sized separately)
- **Action**: Two new `adr-queue.json` harvest rows (adr-0058, adr-0059) both surface the same
  pattern — an ADR citing `color-verify/contrast-check.py` as its ground-truth verification tool
  when the script was never actually committed to the repo, fixed via append-only Amendment plus a
  canonized manual procedure. This is a DIFFERENT defect class from the already-tracked 12-instance
  "4th shape" restatement pattern in `adr-log-mechanics.md`. Three candidate homes, none yet ruled
  out or in: **(a)** a new sibling pattern inside `doc-standards/references/adr-log-mechanics.md`
  (same file, new pattern-family, matching the existing worked-instance convention) — **(b)** a
  dedicated new reference (e.g. a `color-verification-procedure.md`) that canonizes the actual
  OKLCH→OKLab→linear-sRGB(Ottosson)→relative-luminance→WCAG method as an executable procedure, not
  just a doc-process footnote — **(c)** folding into `.claude/docs/references/tokens.md`, which
  already owns this repo's OKLCH/contrast-token contract (`grep` confirms it's one of only two
  references anywhere mentioning OKLCH/WCAG). adr-0059's row also flags a possible SECOND, separate
  axis worth Kim's own judgment: "a token-ramp rework can silently stale a prior ADR's pinned
  contrast figures even when the pairing still clears its floor" (the real figure drift PR #1696
  found) — may fold into the same home as the citation-correction half, or may earn its own.
- **Owner**: Kim (rules the home; the actual `/make-pack`/`/make-skill`/manual-edit execution is a
  separate, smaller follow-on sized once ruled).
- **Evidence**: `.claude/ops/adr-queue.json`'s adr-0058/adr-0059 rows, full evidence + `plan` text
  verbatim (both `queued_at: 2026-08-29T17:26:20Z`); `grep -rn "color-verify\|contrast-check.py\|
  phantom" .claude/skills/doc-standards/references/*.md` (no hit, confirms (a)/(b) both still open);
  `grep -rl "OKLCH\|contrast ratio\|WCAG" .claude/docs/references/*.md` (`tokens.md` +
  `component-authoring-best-practices.md` only — grounds candidate (c)); PR #1693 (citation
  correction) and PR #1696 (adr-0059 figure re-audit) as the two worked instances this harvest
  would generalize from.
- **Size**: ruling itself ~5–10 minutes; the resulting build is out of this plan's scope until
  ruled.

## 4. Hygiene debt

### 4.1 Harvest adr-0129's dual-maintained-CSS-drift class (Kim; ~15–20 min) — queued since 2026-08-25T17:57:12Z, now 10 consecutive firings unconverted
- **Action**: `adr-0129`'s row (unchanged evidence text this firing) flags a generalizable defect
  class — a promoted control's CSS drifting as dual-maintained truth between its site-consumer copy
  and its package-owned canonical copy (GH #1163's root-card logic and ADR-0100's container-type
  repair both independently missed one copy) — not yet covered by any `references/*.md`. Home was
  decided out-of-band 2026-08-28 (commit `91e665bb`, not a chore-planner sweep firing, so it does
  not reset this staleness count); only the run itself remains.
- **Owner**: Kim (`/make-pack` runner) — exact command `/harness:make-pack
  .claude/skills/component-packaging`, the queue row's own `plan` field carries the one-axis
  charter.
- **Evidence**: `.claude/ops/adr-queue.json`'s adr-0129 row (full evidence + decided-home `plan`
  text, byte-unchanged since 2026-08-25T17:57:12Z except the 2026-08-28 home addition);
  `.claude/docs/adr/0129-app-surfaces-m2-composition-and-transport-boundary.md` L70-107 (Amendment
  2, the artboard-extraction precedent this harvest would generalize from).
- **Size**: ~15–20 minutes.

### 4.2 File task — IDR revalidation schema gap: 0 IDR claims have ever entered sampling (Kim or next available builder; ~20–40 min) — new this firing
- **Action**: `revalidation_checkpoint.py`'s `scan_idr_claims` only recognizes an IDR whose file
  carries YAML frontmatter with `doc-type: idr` AND whose status field reads exactly `locked`. This
  repo's own 8 IDR files (`.claude/docs/idr/*.md`) use the H1+blockquote-table dialect — the SAME
  dialect this repo's ADRs use — carry NO frontmatter at all, and use the status vocabulary
  `proposed · accepted · superseded` (never `locked`). The result: `scan_idr_claims` returns `{}`
  for this repo on every firing, so the 4 currently-accepted IDRs (idr-0005, idr-0006, idr-0007,
  idr-0008) have never once been sampled for revalidation since idr-0009's own concept was ratified
  — a structural blind spot, not a sampling-order artifact. File a `task` ticket with an explicit
  two-path Scope/Open (same shape as #1692's own, decision deferred to build time): **(a)** extend
  `revalidation_checkpoint.py`'s IDR scanner to also accept this repo's blockquote-table dialect
  (mirroring how `adr_checkpoint.py` already supports multiple ADR dialects) plus treat `accepted`
  as this repo's terminal ratified state where no `locked` value is ever used, or **(b)** reconcile
  this repo's own IDR convention to actually emit `locked` (and, separately, decide whether to also
  add frontmatter) so the existing script reads it unmodified. The script lives in the harness
  plugin, not this repo — path (a) is a plugin-level change, path (b) is repo-local; name both, let
  whoever builds it choose.
- **Owner**: Kim or next available builder dispatch.
- **Evidence**: `revalidation_checkpoint.py`'s `parse_idr_frontmatter` (gates on `doc-type: idr`)
  and `scan_idr_claims` (gates on `status == "locked"`); `.claude/docs/idr/0001-agents-ship-with-
  declared-teams.md` L1-8 (the blockquote-table dialect, `proposed · accepted · superseded`
  vocabulary stated explicitly in its own header); `ls .claude/docs/idr/*.md` + per-file status
  grep (8 files, 4 `accepted`, 4 `superseded`, 0 `locked`, 0 with frontmatter) — direct
  confirmation, not inference.
- **Size**: ~20–40 minutes (ticket-write only; the fix itself sizes separately once a path is
  chosen).

## Standing notes (not queue entries)

- **Prior plan (2026-08-28T03:40:00Z) fully triaged**: its 1.1 landed (`4ff58bc3`); its 4.1 carries
  forward above, one firing more stale (9→10); its 4.2 (#1692) closed end-to-end with two
  follow-ons, all dropped from tracking (see Corrections).
- **Tickets #1692/#1694/#1695** all CLOSED via merged PRs (#1693, #1696, #1697 respectively) —
  dropped from tracking, not carried forward.
- **Open issues #1699, #1701, #1702**: all correctly resting per issue-sorter/repo-cleaner and per
  this dispatch's own explicit instruction — not touched, not re-triaged, not queued here. #1699/
  #1701 are actively claimed and building; #1702 is a well-formed, resumed-as-is task with no
  assignee yet, unclaimed but not stale (created ~23 min before survey).
- **Open PR #1700** (docs/agent-model-reference): fresh, backs the live planner seat, nothing for
  `campaign_close.py`, not ops debt.
- **`adr-queue.json` holds 3 rows**: adr-0129 (home decided, §4.1), adr-0058 + adr-0059 (home
  undecided, §3.1) — none cleared this firing; clearing them is contingent on Kim's ruling / the
  `/make-pack` run, not something this plan performs.
- **`revalidation-queue.json` holds 2 rows** (adr-0067, adr-0069) — first non-empty state since the
  prior firing cleared it to 0; both queued at §1 above, not deferred.
- **`reap-scratch-clones.mjs` survey gap** (repo-cleaner's own finding): the script's scan roots
  don't discover the #1699 build's scratch clone. Repo-cleaner itself characterizes this as a
  blind spot, not a hygiene defect — nothing reapable is being missed. Named here for continuity,
  not queued as an action.
- **Repo surface**: primary at exact parity with `origin/main` (`9d2075df`, push-verified); 1 open
  PR (#1700, live seat); 3 open issues (#1699/#1701 in-flight, #1702 unclaimed/fresh) — none ops
  debt this firing.
- **Fleet-bootstrap context (standing, not a finding)**: per the out-of-band `91e665bb` stand-down,
  the reviewer/planner/agent fleet rows were released and the bind-team charter ended explicitly;
  repo-cleaner's own live worktree survey this firing (3 worktrees: primary, `agent-ui-planner`
  backing PR #1700, `agent-ui-reviewer` still `KEEP(fleet-seat)`) is the current ground truth,
  read directly rather than assumed from that commit's message.
- **No entry parked this firing** — all 3 open issues carry neither `backlog` nor `roadmap`.
- **Dirty `main` markers**: none reported by repo-cleaner.
- **gen-ui-kit**: out of this board's scope (dedicated session per Kim's ruling).

*Composed by chore-planner, 2026-08-29T17:05:00Z sweep firing — returned as payload per the #125
ops-write split; written and landed by the dispatching session.*
