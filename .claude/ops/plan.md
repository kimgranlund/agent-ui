# Ops plan — agent-ui

- **Dispatch**: 2026-08-30T00:20:00Z sweep firing (agent-ui-marshal, session agent-ui-93;
  chore-planner, fallback fan-out). All three seat reports exist on disk and are judged exactly as
  attached (evidence tier 1): `reports/2026-08-30T002000Z-{decision-watcher,issue-sorter,
  repo-cleaner}.md`. Plus the prior plan (`2026-08-29T17:05:00Z`, carry-forward only) and durable
  state read directly off disk: `adr-checkpoint.json` (226 ADRs unchanged; a full-file pretty-print
  reformat around exactly 3 real hash changes — adr-0067, adr-0069, adr-0227 — confirmed by `git
  diff`, matching decision-watcher's own count), `adr-queue.json` (3 rows: adr-0129 unchanged/
  home-decided; adr-0067 + adr-0069 new harvest rows, `plan: ""`, awaiting a home), `revalidation-
  checkpoint.json` (cursor 70→75), `revalidation-queue.json` (1 row — adr-0072 falsified cl.5; the
  two prior rows, adr-0067/adr-0069, cleared — resolved via merged PRs #1705/#1706), `watch-
  checkpoint.json` (both gh sources advanced 17:24:30Z→00:20:00Z), `held-items.md` (unchanged,
  nothing held), `improvement-plan-2026-08-29.md` (context/continuity only, not fresh evidence —
  see Standing notes).
- **Evidence**:
  `reports/2026-08-30T002000Z-decision-watcher.md` (forward mode: 226 ADRs, 0 new, 0 superseded, 3
  amended — adr-0067/adr-0069/adr-0227; adr-0067 + adr-0069 classified as fresh instances of
  adr-log-mechanics.md's already-tracked "4th shape," harvest-queued; adr-0227 explicitly named NOT
  a candidate — same-file Persona→Agent rename note tied to GH #1699, an ephemeral project record,
  not a knowledge-pack fact. Revalidation mode: cursor 70→75, n=5, sampled adr-0072..adr-0076;
  adr-0072 falsified cl.5 (cross-turn max-turns cap + named state machine never built — grepped
  `session.ts`/`produce.ts`/`agent-transport.ts`/`a2ui-live.ts`/`a2ui-agent.ts`, zero hits for
  `maxTurns`/`turnCount`/the named state labels; only per-generation caps exist, ADR-0070's
  `maxRounds` + GH #49's tool-loop cap), queued owner-unassigned; adr-0073/0074/0075/0076 all
  confirmed verbatim; adr-0067/adr-0069's revalidation-queue rows cleared, resolved via #1703/#1704) ·
  `reports/2026-08-30T002000Z-issue-sorter.md` (checkpoint window 17:24:30Z→00:20:00Z; 7 issue hits
  + 6 PR hits, every one already resolved/closed/merged or already-minted per dispatch context; no
  new triage action; `held-items.md`/`friendlies.json` both unchanged, no payload for either; both
  checkpoint entries advance) ·
  `reports/2026-08-30T002000Z-repo-cleaner.md` (5 PRs merged since 17:05Z — #1705/#1706/#1707/
  #1708/#1712 — all remote branches already GitHub-deleted; #1699/#1702 resolved via #1708/#1707;
  planner worktree now at `main`'s own tip (detached `0d49969d`); 3 new open issues #1709/#1710/
  #1711, unclaimed; `reap-scratch-clones` dry-run: 3 REAP (`T/agent-ui-1702`, `T/agent-ui-1703`,
  `T/agent-ui-1704`) + 1 KEEP(dirty) (`scratchpad/agent-ui-1701`, active build) + 1 by-hand REAP
  (`scratchpad/1699-clone`, script-blind per the #1710 gap); nothing executed, dry-run only per
  scope; consecutive-unchanged-firing count reset to 0) ·
  `git log --oneline -10` (the full corrections chain: `1134c8ad` prior-plan landing, `3c954c05`
  #1703→#1705 merge, `9ba844aa` #1702→#1707 merge, `2d400eb1` #1704→#1706 merge, `b371558a`
  #1699→#1708 merge, `f11c79ed` #1700 merge, `daef2b9e` rigour-plan commit, `3b5b52fb` seat-map
  laws + #1709/#1710/#1711 filed, `6d247a34` Kim's adr-0058/0059 home ruling + fable retier,
  `0d49969d` #1712 merge — adr-log-mechanics 5th shape + docs-only gate rule) ·
  `git show 6d247a34 -- .claude/ops/adr-queue.json` (Kim's home decision for adr-0058/adr-0059,
  2026-08-29T17:01:16-07:00: "sibling pattern in adr-log-mechanics.md, the phantom-tool-citation
  class ... Chartered to agent-ui-planner") ·
  `git show 0d49969d --stat` + commit body (PR #1712: adr-log-mechanics.md gains the 5th shape;
  `adr-queue.json`'s two harvest rows clear; process.md gains the docs-only gate rule) ·
  direct `Read` of `.claude/skills/doc-standards/references/adr-log-mechanics.md` L56-89 (the "4th
  shape" definition + its 12 worked instances, adr-0007 through adr-0058 — the exact list adr-0067/
  adr-0069 would extend) and L91-125 (the now-landed 5th shape, phantom-tool-citation, 2 worked
  instances) ·
  `gh issue view 1713 --json body,labels,state,createdAt` (ADR-0072's task — filed 2026-08-30
  by kimgranlund, the marshal's parallel filing per this dispatch's own instruction; full Acceptance/
  Scope-Open/Links text; default: drop clause 5, name the shipped guard set, cite `revalidation-
  queue.json`'s adr-0072 row + this issue) ·
  `gh issue view {1709,1710,1711} --json body,labels,state` (all OPEN, `task`/`task`/`bug`,
  `size:small`, author `kimgranlund`; #1709 carries a two-path Scope/Open — plugin-level scanner
  extension vs repo-local dialect change — decided at build time; #1710's own Findings already
  root-caused the fix direction; #1711 already carries three cited sightings + a named fix shape) ·
  `gh issue list --state open --json number,labels` (5 open: #1701, #1709, #1710, #1711, #1713 —
  none carry `backlog`/`roadmap`/`needs-ruling`) ·
  `gh issue list --state open --json number,body -q '...' | grep -i blocked-by` (zero hits across
  all 5 open issue bodies) ·
  `gh pr list --state open` (empty — no open PRs this firing) ·
  `git rev-parse HEAD` + `git fetch origin main` + `git ls-remote origin refs/heads/main` (all
  `0d49969d…`, primary at exact push-verified parity with `origin/main`) ·
  `git diff .claude/ops/{adr-checkpoint,revalidation-checkpoint,watch-checkpoint,adr-queue,
  revalidation-queue}.json` (corroborates decision-watcher's claims exactly — 3 real hash changes
  in a full-file reformat; cursor 70→75; both watch sources 17:24:30Z→00:20:00Z) ·
  `.claude/ops/improvement-plan-2026-08-29.md` (read as continuity context, not a fresh finding —
  its P1 items D/F are already actioned this firing, its G/H/C(3) items are exactly #1709/#1710/
  #1711, its I ruling landed via `6d247a34`, its L items are this plan's own §3.1/§4.1).
- **UNMEASURED**: none — `gh` reachable all firing (issue-sorter's own check, corroborated live);
  `git`/`origin` reachable throughout. `[]`.
- **Corrections vs the prior plan** (2026-08-29T17:05:00Z):
  - Prior 1.1 (land that firing's ops-state + plan payload) — **DONE**: commit `1134c8ad`.
  - Prior 1.2 (file task + Amendment, ADR-0067) — **DONE**: filed as #1703, Amendment appended and
    merged via PR #1705 (commit `3c954c05`).
  - Prior 1.3 (file task + Amendment, ADR-0069) — **DONE**: filed as #1704, Amendment appended and
    merged via PR #1706 (commit `2d400eb1`).
  - Prior 3.1 (decide home for the adr-0058/adr-0059 phantom-tool-citation harvest) — **RULED AND
    LANDED**: Kim decided the home 2026-08-29 (commit `6d247a34` — sibling pattern in
    `adr-log-mechanics.md`, chartered to `agent-ui-planner`), landed as the file's 5th shape via
    merged PR #1712 (commit `0d49969d`); `adr-queue.json`'s two rows cleared in the same PR. DONE,
    dropped from tracking.
  - Prior 4.1 (harvest adr-0129, 10 firings unconverted as of that plan) — **STILL OPEN, carried
    forward, now 11 consecutive firings unconverted.** No `/make-pack` run has landed between that
    plan and this one.
  - Prior 4.2 (file task — IDR revalidation schema gap) — **DONE**: filed as #1709, carrying the
    exact two-path Scope/Open this plan specified.
  - **New this firing, not yet actioned**: decision-watcher's revalidation sweep (cursor 70→75)
    found one new falsified row, adr-0072 clause 5 — pre-filed by the marshal in parallel with this
    dispatch as **#1713** (per the dispatch's own instruction: queue "build it," not "file it" —
    §1.2 below). adr-0067/adr-0069's forward-mode classification (13th/14th "4th shape" instance)
    is new this firing too, queued at §3.1. Three more rigour-plan tickets (#1709, #1710, #1711)
    were filed this evening ahead of this dispatch and sit unmobilized, queued at §4.2–§4.4.
  - No entry dropped as parked — none of the 5 open issues this firing (#1701, #1709, #1710, #1711,
    #1713) carry `backlog` or `roadmap`.
- **New this firing** (issue-sorter): no new triage action — every discovered item (7 issues, 6
  PRs) already resolves to a landed disposition; both checkpoints advance to 00:20:00Z.
- **New this firing** (repo-cleaner): 5 more PRs merged and reaped clean; #1699/#1702 resolved;
  3 new unclaimed issues surveyed (#1709/#1710/#1711); 4 scratch clones read REAP/KEEP, none
  executed (dry-run scope) — the marshal is executing this reap directly, in parallel with this
  dispatch, per its own instruction; not a queue action here.
- **New this firing** (decision-watcher): forward mode found 3 amended ADRs, 2 harvest-worthy
  (adr-0067, adr-0069 — 13th/14th "4th shape" instances) and 1 explicitly not a candidate
  (adr-0227). Revalidation mode advanced the cursor 70→75, cleared adr-0067/adr-0069's own rows
  (now resolved), and queued exactly one new falsified verdict (adr-0072 cl.5).
- **needs-ruling lane**: none this firing — no open issue carries the label.
- **Blocked-by convention (#193)**: 5 open issues this firing (#1701, #1709, #1710, #1711, #1713);
  none carry a `Blocked-by:` line (confirmed live, all 5 bodies grepped). No blocker relationship
  changes this plan's ordering.
- **Verdict — a clean landing firing: every one of the prior plan's four open items resolved
  (three DONE, one RULED+LANDED), decision-watcher's revalidation sweep surfaced exactly one new
  falsified clause (adr-0072, already pre-filed as #1713 by the marshal), and three rigour-plan
  tickets (#1709/#1710/#1711) sit filed and ready for the marshal's own confirm round.** What's
  left: land this firing's ops-state + plan payload (§1.1), build #1713's Amendment (§1.2), get
  Kim's quick nod on folding adr-0067/adr-0069 into the already-established "4th shape" list
  (§3.1), keep pushing adr-0129's harvest (now 11 firings stale, §4.1), and hand #1709/#1710/#1711
  to the next builder round (§4.2–§4.4). §2 is empty.

Queue order: (1) gated mutations verified safe → (2) blockers → (3) human decisions → (4) hygiene.

## 1. Gated mutations already verified safe

### 1.1 Land this firing's ops-state + plan payload (dispatching host; ~3–5 min)
- **Action**: `git add` the 5 modified state files (`adr-checkpoint.json` — reformatted, 3 real
  hash changes; `adr-queue.json` — 2 new harvest rows; `revalidation-checkpoint.json` — cursor 75;
  `revalidation-queue.json` — 1 row, adr-0072; `watch-checkpoint.json` — both sources advanced),
  the 3 new seat reports (`reports/2026-08-30T002000Z-{decision-watcher,issue-sorter,
  repo-cleaner}.md`), and this plan's own payload — commit and push to `main` in one batch.
- **Owner**: dispatching host (the ops-write split's dispatching session).
- **Evidence**: `git status --porcelain` (5 modified + 3 untracked, listed above); `git rev-parse
  HEAD` + `git ls-remote origin refs/heads/main` (both `0d49969d…`, confirming primary otherwise
  current before this batch lands).
- **Size**: 3–5 minutes.

### 1.2 Build ADR-0072's Amendment via #1713 (Kim or next available builder; ~20–30 min) — new this firing
- **Action**: #1713 (already filed by the marshal in parallel with this dispatch — per the
  dispatch's own instruction, queued here as "build it," not "file it") asks for an append-only
  `## Amendment` to `.claude/docs/adr/0072-a2ui-live-multi-turn-session-model.md` recording that
  clause 5's cross-turn "demo-level max-turns cap" and its named session state machine (`idle →
  generating(turn N) → streaming → awaiting-interaction → ...`) were never built; naming the
  per-generation guards that DO exist (ADR-0070's `maxRounds`, GH #49's tool-loop cap) as the
  shipped guard set; dropping the clause by default (Kim may override in the ticket's own
  Scope/Open); citing `revalidation-queue.json`'s adr-0072 row and this issue; carrying the
  `proposed — Kim ratifies` marker per `scripts/adr_ratify.py`'s marker grammar. Clauses 1-4 stand
  untouched.
- **Owner**: Kim or next available builder (`gh issue view 1713` for the full Acceptance list — no
  further judgment required beyond the ticket's own stated default).
- **Evidence**: `gh issue view 1713` full body (Acceptance/Links/Scope-Open verbatim, filed
  2026-08-30); `.claude/ops/revalidation-queue.json`'s adr-0072 row (falsified, cl.5, `owner:
  unassigned`, evidence text verbatim); decision-watcher's own grep citations (`session.ts`,
  `produce.ts`, `agent-transport.ts`, `a2ui-live.ts`, `a2ui-agent.ts` — zero hits for `maxTurns`/
  `turnCount`/the named state labels).
- **Size**: ~20–30 minutes (mechanical — same shape as the prior firing's #1703/#1704 Amendments).

## 2. Blocking other work

(none — 0 open PRs this firing (`gh pr list --state open`, empty); none of the 5 open issues carry
a `Blocked-by:` line or block anything else in evidence.)

## 3. Human-decision items

### 3.1 Confirm home for adr-0067/adr-0069's 13th/14th "4th shape" harvest (Kim; ~2–5 min confirm, append itself ~10–15 min once ruled) — new this firing
- **Action**: adr-0067's and adr-0069's revalidation-mode Amendments (GH #1703/#1704, merged via
  PR #1705/#1706) are fresh instances of the SAME "4th shape" (partial supersession left
  unrestated) that `.claude/skills/doc-standards/references/adr-log-mechanics.md` already tracks
  12 worked instances of (adr-0007 through adr-0058, L82-89) — decision-watcher's own forward-mode
  classification names both exactly this way, and `adr-queue.json`'s two rows (queued
  2026-08-30T00:20:00Z, `plan: ""`) await a home decision before either can be folded in. Unlike
  the adr-0058/adr-0059 pair (3 genuinely distinct candidate homes, resolved 2026-08-29), this pair
  has no real alternative to weigh: the file already IS the home for all 12 prior instances, and
  adr-0067/adr-0069 match the shape mechanically (a later finding superseded one clause each, the
  body prose never caught up). **Propose**: extend the "4th shape" worked-instances list with
  adr-0067 (13th, PR #1705) and adr-0069 (14th, PR #1706), same one-line-per-instance convention
  already used for the first 12. **Ruled 2026-08-30 after this plan was composed**: Kim confirmed the fold; chartered to
  agent-ui-planner the same round, PR pending. Remains here only until that PR lands.
- **Owner**: Kim (confirm only — the list-append execution sizes separately, once ruled).
- **Evidence**: `.claude/ops/adr-queue.json`'s adr-0067/adr-0069 rows, full evidence text verbatim
  (both `queued_at: 2026-08-30T00:20:00Z`, `owner` field n/a on this queue's own schema);
  `adr-log-mechanics.md` L56-80 (the 4th shape's own definition — header-recorded supersession,
  body prose unrestated — matching both findings precisely) and L82-89 (the exact list format
  being extended); decision-watcher's own forward-mode table ("a fresh instance of
  adr-log-mechanics.md's 4th shape" cited for both rows).
- **Size**: confirm ~2–5 minutes; the append ~10–15 minutes once ruled (two one-line list entries,
  same convention as the last 12).

## 4. Hygiene debt

### 4.1 Harvest adr-0129's dual-maintained-CSS-drift class (Kim; ~15–20 min) — queued since 2026-08-25T17:57:12Z, now 11 consecutive firings unconverted
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

### 4.2 Mobilize #1709 — IDR revalidation blind spot (Kim or next available builder; ~20–40 min ticket work, per its own body)
- **Action**: #1709 (rigour plan G, filed 2026-08-29) records that `revalidation_checkpoint.py`'s
  `scan_idr_claims` requires YAML frontmatter `doc-type: idr` + `status: locked`; this repo's 8
  IDRs use the H1+blockquote-table dialect with `proposed/accepted/superseded` vocabulary and no
  frontmatter, so 0 IDR claims have ever entered revalidation sampling. The ticket already carries
  a two-path Scope/Open (plugin-level scanner extension vs repo-local dialect/frontmatter change),
  explicitly deferred to build time — not a call for this seat or this plan. Filed, unclaimed,
  ready to mobilize; no further triage needed.
- **Owner**: Kim or next available builder (dispatch order is the marshal's own confirm round,
  running after this plan).
- **Evidence**: `gh issue view 1709` full body (Acceptance/Scope-Open/Links verbatim).
- **Size**: ~20–40 minutes (ticket's own estimate) once a path is chosen.

### 4.3 Mobilize #1710 — reap-scratch-clones scan gap (next available builder; small, per its own label)
- **Action**: #1710 (rigour plan H, filed 2026-08-29) already root-caused the gap in its own
  Findings: `scanRoot`'s immediate-child name pattern (`<repoName>-<digits>(-suffix)?`) missed a
  `<digits>-clone`-shaped scratchpad dir (the #1699 build's clone); the sibling `agent-ui-1701`
  clone in the same root WAS found, so the root walk itself is sound — only the child-name match
  needs widening (to any dir containing `.git`, or the `<digits>-clone` shape). Fix direction
  named, `--selftest` coverage specified. Filed, unclaimed, ready to mobilize.
- **Owner**: next available builder.
- **Evidence**: `gh issue view 1710` full body, including its own dated Findings entry (root cause
  answered 2026-08-29).
- **Size**: small (per the ticket's own `size:small` label — root cause pre-answered, a mechanical
  widen + one positive/negative `--selftest` case).

### 4.4 Mobilize #1711 — import-seeds.test.ts timeout budget (next available builder; small/minor, per its own labels)
- **Action**: #1711 (rigour plan C item 3, filed 2026-08-29, third sighting per Kim's second-sighting
  bar) records that `import-seeds.test.ts`'s subprocess-spawning describe blocks run under vitest's
  default 5000 ms budget and red under host contention while passing in isolation (43/43 green in
  ~2.6 s alone). The ticket already names the repo's own precedent fix shape (a per-file module-scope
  `vi.setConfig({ testTimeout: 30_000 })`, citing `vitest.browser.config.ts`'s GH #347 rationale) and
  leaves two scoped clarifying questions for the builder (whole-file vs per-describe scope; whether
  the sandbox block needs its own larger budget). Filed, unclaimed, ready to mobilize.
- **Owner**: next available builder.
- **Evidence**: `gh issue view 1711` full body (Repro/Classification/Acceptance verbatim).
- **Size**: small (per the ticket's own `size:small`/`severity:minor` labels — single-file,
  precedent-shaped fix).

## Standing notes (not queue entries)

- **Prior plan (2026-08-29T17:05:00Z) fully triaged**: 1.1/1.2/1.3 DONE, 3.1 RULED+LANDED, 4.1
  carries forward above (10→11), 4.2 DONE (filed as #1709). See Corrections.
- **Tickets #1699, #1702, #1703, #1704** all CLOSED via merged PRs (#1708, #1707, #1705, #1706
  respectively) — dropped from tracking, not carried forward.
- **PRs #1705–#1708 and #1712** all MERGED, all remote branches already GitHub-deleted at merge
  time — nothing for `campaign_close.py`.
- **Open issue #1701**: CLOSED after this plan was composed (PR #1714 merged at `0e668ece`,
  2026-08-30); dropped from tracking.
- **`adr-queue.json` holds 3 rows**: adr-0129 (home decided, §4.1), adr-0067 + adr-0069 (home
  proposed, pending Kim's confirm, §3.1) — none cleared this firing.
- **`revalidation-queue.json` holds 1 row** (adr-0072) — its task is already filed as #1713 and
  queued at §1.2 above, not deferred.
- **Scratch-clone reap (4 clones: 3 via `ops:reap-scratch-clones -- --execute`, 1 by hand for
  `scratchpad/1699-clone`)** is being executed directly by the dispatching marshal in parallel with
  this dispatch, per its own instruction — not a queue action here.
- **Agent seat retiered to `fable+medium`** (Kim's ruling, 2026-08-29, commit `6d247a34`) —
  informational, already landed, not an open item.
- **Rigour plan (`improvement-plan-2026-08-29.md`) status, for continuity**: P0 items A/B/C(1,2)
  are marshal-practice/seat-map changes already adopted (no repo ticket needed); C(3) is #1711
  above. P1: D filed cross-repo (claude-plugins #993-#996 per this repo's own seat-map law K,
  record-only intake in a foreign repo — not tracked here); E landed (PR #1712's process.md
  docs-only gate rule); F resolved this firing (decision-watcher returned its own report file for
  the first time, unlike the 2026-08-29T17:05Z firing); G is #1709 (§4.2); H is #1710 (§4.3). P2:
  I ruled and landed (`6d247a34`); J (harness docs-plugin cache version bump to 1.21.15, Kim,
  trivial) still outstanding — cross-plugin, not this repo's ops debt, named here for continuity
  only, not queued; K adopted (seat-map law, record-only intake in foreign repos, already in
  effect); L is this plan's own §3.1/§4.1; M is a teamwork-plugin fix, cross-plugin, not tracked
  here.
- **No entry parked this firing** — none of the 5 open issues (#1701, #1709, #1710, #1711, #1713)
  carry `backlog` or `roadmap`.
- **Dirty `main` markers**: none reported by repo-cleaner; `primary_checkout_check.py` clean.
- **Repo surface**: primary at exact parity with `origin/main` (`0d49969d`, push-verified); 0 open
  PRs; 5 open issues (#1701 in-flight/informational, #1709/#1710/#1711 unclaimed rigour-plan
  tickets awaiting mobilization at §4.2–§4.4, #1713 unclaimed new falsification task at §1.2).
- **Fleet worktrees**: 3 (primary; `agent-ui-planner`, detached at `main`'s own tip; `agent-ui-
  reviewer`, `KEEP(fleet-seat)`) — both non-primary worktrees kept per repo-cleaner's own dry-run
  despite the 2026-08-28 fleet stand-down (commit `91e665bb`); read directly as current ground
  truth each firing, not assumed from that commit's message (unchanged standing note).
- **gen-ui-kit**: out of this board's scope (dedicated session per Kim's ruling).

*Composed by chore-planner, 2026-08-30T00:20:00Z sweep firing — returned as payload per the #125
ops-write split; written and landed by the dispatching session.*
