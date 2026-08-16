<!-- target-path: .claude/ops/plan.md -->
# Ops plan — agent-ui

- **Dispatch**: 2026-08-16 (chore-planner, sweep-7 — /sweep-chores fallback path; focus "clear the
  boards": the caller (a /lead-team session running mobilize-chores) drives every ready issue to a
  build via build-lead dispatches, so the buildable set is ORDERED into parallel-safe waves with
  file/import overlap named, and design-first / human-ruling items are separated out).
- **Evidence**: three fresh seat reports (issue-sorter, repo-cleaner, decision-watcher — all
  measured, payloads already applied to `.claude/ops/`) + one live `gh issue list --json body`
  read for `Blocked-by:` parsing and file-surface judgment + `git worktree list`.
- **Live state at compose**: 23 open issues (#949–#976, all unassigned, all owner-authored, every
  one labeled kind + size — 7 size labels applied by issue-sorter this sweep) · 0 open PRs ·
  origin main-only · local: `main` + ONE new worktree `.claude/worktrees/musing-newton-39ae10`
  (appeared AFTER repo-cleaner's survey, which saw main-only — see 4.3) · 4 applied ops payloads +
  1 pre-existing dirty file uncommitted (see 1.1, 4.1).
- **Blocked-by convention (#193)**: grep of all 23 open bodies for `Blocked-by:` → ZERO hits. The
  convention reorders nothing this sweep. Every "sequence-after" edge below is a planner judgment
  from file/import overlap or an owner ruling quoted from the issue body — NOT an inferred
  `Blocked-by:` edge (the convention forbids inferring one).
- **Corrections vs the prior plan (sweep-6)**: #829/#830 lanes CLOSED (board turned over entirely
  — sweep-6's 2.1 retired); every sweep-6 RESOLVED entry dropped; the adr-0178-amendment harvest
  row is still pending and now has a sibling (adr-0187, this sweep).
- **Verdict**: hygiene fully clean (0 PRs, 0 orphan branches, 0 stale claims); the board is a
  fresh 23-issue intake wave — 17 buildable now in 3 waves, 6 design/ruling-first.

Queue order: (1) gated mutations verified safe → (2) blockers → (3) human decisions → (4) hygiene.

## 1. Gated mutations already verified safe

### 1.1 Land this sweep's state — commit + push `.claude/ops/` ONLY (dispatching session; minutes)
- **Action**: `git add .claude/ops/adr-checkpoint.json .claude/ops/adr-queue.json
  .claude/ops/watch-checkpoint.json .claude/ops/reports/2026-08-16T202951Z.md .claude/ops/plan.md`
  → commit (state-only, never source) → push. Do NOT include the pre-existing dirty
  `.claude/skills/doc-standards/references/status-dialects.md` (4.1 — not the sweep's file).
- **Owner**: `/sweep-chores`'s landing leg (the ops-write split's dispatching session) — host if
  run standalone. Per rulings.md ("Seat-payload landing leg — RULED 2026-08-09").
- **Evidence**: `git status --short` at compose: ` M adr-checkpoint.json · M adr-queue.json ·
  M watch-checkpoint.json · ?? reports/2026-08-16T202951Z.md` — the three seats' payloads
  applied verbatim, unlanded; `.claude/ops/` is git-tracked (standing note).
- **Size**: 5 minutes.

## 2. Blocking other work — the buildable board, in dispatch waves

Owner ruling quoted from #969's body (find-intent round, 2026-08-15): "all `size:big` work
repo-wide runs a mandatory four-phase due-process loop … encoded as a REPO SKILL … First governed
instances: #960, #963, #964 — their eventual dispatches cite the skill." That ruling stands
regardless of whether the skill exists yet: bigs dispatched before #969 lands must run
Understand→Plan→Execute→Evaluate BY HAND in their brief (Plan-phase docs earned per doc-standards;
Evaluate = code-checker verdict AND pixel-truth before close). Waves below put #969 first so the
bigs can cite it.

Overlap legend — files two lanes would both edit (merge-conflict / stale-context risk):
- `site/pages/agent-admin-app.ts` + `app/src/controls/agent-admin/*` (`entry-form.ts`): #949, #950,
  #952 (dogfood migration), #965 (reads the shape — recipe should reflect the extended drawer).
- `site/lib/component-preview.ts` (`sampleFor()`/`SAMPLE_TREES`): #971, #970.
- `app/src/shell-breakpoint.ts` + the nav→select responsive spine: #962, #964 (both bodies name
  the shared spine; #962: "sharing the responsive spine with the TOC-nav slice").
- `components/src/traits/` (new files + any traits barrel/index): #952 (`list-reorder.ts`), #964
  (scroll-spy trait), #974 (`pendingComputed`) — new-file adds; only a shared barrel edit collides.
- `packages/agent-ui/a2ui`: #975 (renderer streaming path) vs #976 (data-model `setPointer`
  helper) vs #972 (`src/examples/`, `corpus/index.json`) — disjoint files, same package; safe in
  parallel, rebase the last one to land.
- Recipe deliverables (#960, #961, #963, #964, #965): each is a docs-site page/example + a
  composition-patterns entry — the ONLY shared surface is whatever docs-site nav/index each
  appends to; append-only, rebase-able, low risk.
- `components/src/dom/view-transition.ts` + one proving surface: #958-morph — no other lane
  touches it (#954's VT use is design-first).

### 2.1 Wave 1 — six lanes, zero pairwise file overlap (build-lead per lane; 1–3 h each)
- **#969** due-process skill (size:big, feature) — `.claude/skills/<name>/` + one-line pointer in
  `.claude/docs/process.md` + a PROVEN enforcement seam (dispatch-brief clause is the repo-local
  seam; a build-lead/dispatch-ticket preload lives in nonoun-plugins — cross-repo, flag if chosen).
  Owner: build-lead (skill-author seat per sorter). Evidence: sorter "ready — self-contained
  meta/process ask". Size: 2–4 h. Zero source overlap. FIRST because #960/#963/#964 cite it.
- **#949** Edit drawer → Instructions + pattern-source kinds (task, small). Owner: build-lead
  (direct build; pixel-checked). Evidence: owner-ratified follow-up, concrete acceptance.
  Size: 1–2 h. Files: `entry-form.ts`, `agent-admin-app.ts`. Sequence-after for #950/#952/#965.
- **#971** replace 8 lorem `Sample content` fallbacks (task, small). Owner: build-lead → the
  example-authoring seat (the issue names it). Evidence: sorter "ready — names its own owning
  seat". Size: 1 h. Files: `site/lib/component-preview.ts`. Sequence-after for #970.
- **#953** ui-swiper CSS-native candy (feature, small). Owner: build-lead (`/build-feature`).
  Evidence: bounded; open item `scrollsnapchange` Chromium-only → pre-decide in brief (3.3) or
  the build records "adopt-with-fallback". Size: 1–2 h. Files: `controls/swiper/*` + docs page.
- **#976** `mutate(path, draft => …)` helper on the a2ui data-model layer (feature, LABEL
  size:small — sorter table said big; label wins, body says "additive and small"). Owner:
  build-lead (`/build-feature`). Evidence: additive, kernel stays sync, no binding-mechanism
  change. Size: 2–3 h. Files: a2ui data-model layer only.
- **#958 — named-morph half ONLY** (feature, small): documented `view-transition-name` scheme
  proven on one surface, opt-in, byte-identical when off. Owner: build-lead (`/build-feature`).
  Evidence: sorter "flag: mismatch — S4 half needs an ADR ruling; morph half independently
  buildable"; body: "S4 and the morph convention are independent slices". Pre-step in the brief:
  "check whether the S4 follow-up issue ADR-0183 promised is already filed — dedupe". S4 grain
  ruling → 3.2. Size: 1–2 h. Files: `dom/view-transition.ts` + one surface + docs.

### 2.2 Wave 2 — after the wave-1 lane that shares its files closes (build-lead per lane; 1–3 h)
- **#950** Add-drawer draft preservation (task, small) — sequence-after #949 (both edit
  `entry-form.ts`/`agent-admin-app.ts`; planner overlap judgment). Owner: build-lead. Evidence:
  owner-ruled fix (close-session 2026-08-15). Size: 1–2 h.
- **#970** a2ui-catalog tier tabs + gallery cross-links (feature, small) — sequence-after #971
  (`component-preview.ts`). Owner: build-lead (`/build-feature`, pixel-checked). Evidence:
  owner-approved 2026-08-15 audit; concrete acceptance (54 entries, one home each, derived links).
  Size: 2–3 h. Files: `site/pages/a2ui-catalog.ts`, `a2ui-gallery.ts`, `component-preview.ts`.
- **#962** ui-settings mobile rail→select collapse verify/add (feature, small) — no wave-1
  overlap; runs in wave 2 only to keep the responsive-spine work (#962 → #964) serialized. Owner:
  build-lead (`/build-feature`; browser-shard test). Evidence: verification-first. Size: 1–2 h.
  Files: `app/src/controls/settings/*`, possibly `shell-breakpoint.ts`.
- **#961** checklist-onboarding recipe (feature, small) — independent (recipe + flow card).
  Owner: build-lead (`/build-feature`). Evidence: all ingredients exist; mint-last stepper
  decision recorded. Size: 1–2 h.
- **#965** card-grid + edit-drawer recipe (feature, small) — sequence-after #949/#950 so the
  recipe extracts the EXTENDED drawer shape (stale-context law), docs-only writes. Owner:
  build-lead. Evidence: precedent PR #948. Open item dirty-guard ADR-vs-recipe → 3.3. Size: 1–2 h.
- **#952** list-reorder trait + agent-admin dogfood migration (feature, small) — sequence-after
  #950 (edits `agent-admin-app.ts`; new `traits/list-reorder.ts`). Owner: build-lead
  (`/build-feature`). Evidence: precedent #921/PR #922; open item commit event name → 3.3 (the
  seven-member event law makes `change` the default). Size: 2–3 h.

### 2.3 Wave 3 — the size:big builds, each running the #969 loop (build-lead per lane; hours–1 day)
- **#960** sign-in/registration recipe (feature, big) — recipe + docs only; passkey and
  password-affordance are recorded verdicts, no new controls. Owner: build-lead (`/build-feature`,
  cites #969). Evidence: sorter "ready (first slice)". Size: 3–5 h. Overlap: docs index only.
- **#963** table-view recipe + columns menu (feature, big) — ZERO `ui-table` API change; drag
  reorder/resize deferred. Owner: build-lead (cites #969). Evidence: delta-scoped vs the shipped
  data-workbench (sorter). Open: per-user view persistence → cross-ref #959 (3.2). Size: 3–5 h.
- **#964** TOC scroll-spy trait + sticky nav→select recipe (feature, big) — sequence-after #962
  (shared responsive spine / `shell-breakpoint.ts`); new trait file in `traits/`. Owner:
  build-lead (cites #969). Evidence: sorter "ready (first slice)"; mint-last `ui-toc`. Size: 4–6 h.
- **#974** `pendingComputed` trait + fleet stale-state ADR PROPOSAL (feature, big) — the trait
  ships; the styling hook does NOT (issue: "ADR BEFORE the styling hook ships") — the build
  returns a `proposed` ADR for Kim's flip (never self-flipped). Owner: build-lead (cites #969).
  Evidence: concrete acceptance, kernel stays sync. Size: 4–6 h. Overlap: `traits/` new file
  (barrel-only collision with #964/#952).
- **#975** streaming reveal-order policy in the a2ui renderer (feature, big) — renderer-only, no
  wire/catalog change; policy shape is the build's design call (Plan phase). Owner: build-lead
  (cites #969). Evidence: sorter "ready — bounded". Size: 4–8 h. Overlap: none after #976 lands.
- **#972** five corpus seeds through the judged pipeline (task, big) — Owner: build-lead → the
  a2ui-corpus-curation pipeline seat (`import-seeds --verdicts`, VerdictsFile committed, 0
  quarantined). Evidence: owner-approved gap map (2026-08-15 audit). Size: 3–5 h. Overlap:
  `a2ui/src/examples/`, `corpus/index.json` only.

## 3. Human-decision items

### 3.1 ADR harvest confirm — 2 pending rows (host asks, Kim rules; minutes + ~1 h per harvest)
- **Action**: one batched AskUserQuestion covering `adr-0178-amendment` (authorship-scoped
  re-ruling pattern → composition-patterns or sibling) and `adr-0187` (opt-in `atFinalize`
  validator signal → a2ui-review / a2ui-payload-authoring or sibling); on YES dispatch
  `/make-pack` per row; adr-queue.json rows advance on landing.
- **Owner**: host (the ask) → Kim (the ruling) → make-pack seat (the harvest).
- **Evidence**: decision-watcher report this sweep (grep-verified: 4 of 5 new/amended ADRs
  already covered; ADR-0187 the one genuine gap); `adr-queue.json` carries both rows `pending`.
- **Size**: 5 minutes to rule; ~1 h per harvest.

### 3.2 Design-first issues — a ruling or a doc BEFORE any build (Kim + design seats; hours each)
- **#954** drill-down container: container (`ui-drill` in `controls/`) vs generalizing nav-rail's
  drill-in into a trait — body: "needs the design ruling before any build". Owner: Kim rules the
  fork (brief recommends the container) → then `/build-feature`. Size: ruling minutes; build big.
- **#956** DataSource seam — fork 1: mint `@agent-ui/data` (zero-dep sibling off components,
  router/code precedent) vs `data/` inside components — "package minting is ADR-worthy". Owner:
  Kim rules → ADR + PRD/SPEC author. Size: ruling minutes; PRD/SPEC hours.
- **#957** streaming AsyncIterable contract — "possibly folds into #956" (self-declared). Owner:
  Kim rules fold-or-separate at the same round as #956; design lands in whichever record wins.
- **#955** gateway client patterns — acceptance IS "a PRD/SPEC-tier design exists"; home package
  = brief open fork 3. Owner: Kim rules home → PRD/SPEC author. Size: hours.
- **#959** storage-adapter seam in `shared` — "seam home needs an owner ruling — it changes what
  lower layers may persist". Owner: Kim → then Slice 1 `/build-feature`. Sorter: not a dup of
  #955–957 but both gate on package/layer placement — RULE #954/#955/#956/#957/#959 placement in
  ONE round (four forks, one conversation).
- **#958 — S4 half**: transition grain for A2UI streamed re-renders (candidate
  `finalize(surfaceId)`; strobe-per-chunk ruled out) — "recorded (ADR amendment or new ADR) before
  any build". Owner: Kim via ADR → build later. Size: ADR hours.

### 3.3 In-brief minor rulings — pre-decide so wave lanes don't stall (caller/Kim; minutes)
Each issue's body names one small open item; the caller can either pre-decide it in the dispatch
brief or instruct the build to record its verdict in Findings:
- #952 commit event name (default `change` — the seven-member event-name law) ·
- #953 `scrollsnapchange` adopt-with-fallback vs defer ·
- #965 dirty-guard convention: fleet ADR vs recipe-level ·
- #960 password strength/assist as a text-field extension? ·
- #964 docs site dogfoods the TOC recipe? ·
- #969 `process.md` pointer line (body: "likely yes").
Owner: caller (mobilize) or Kim. Evidence: each issue's Scope/Open section. Size: 5–10 min total.

### 3.4 Ratifications the waves will PRODUCE (Kim; minutes each, later)
- #974's proposed stale/pending styling-hook ADR (wave 3 output) — Kim flips via
  `adr_ratify.py`; never self-flipped. #958-S4 and #956's package ADR arrive from 3.2.
- Owner: Kim. Evidence: the issues' own "ADR before it ships" clauses. Size: minutes per flip.

## 4. Hygiene debt

### 4.1 Pre-existing dirty file `.claude/skills/doc-standards/references/status-dialects.md` (host; minutes)
- **Action**: host decides commit-or-stash; NOT the sweep's file — excluded from 1.1 (repo-cleaner
  left it untouched per brief; `sync_main.py` withheld).
- **Owner**: host. **Evidence**: `git status` ` M` at compose; repo-cleaner report. **Size**: 5 min.

### 4.2 `adr-queue.json` schema drift — `adr_queue.py pending` throws `KeyError: 'kind'` (host; minutes)
- **Action**: at the 3.1 confirm round, normalize the `adr-0178-amendment` row (add
  `"kind": "harvest"` + `queued_at`) as a state-file edit landed by the dispatching session; ALSO
  flag upstream (nonoun-plugins, `watch-adrs` script) that `pending` should tolerate legacy rows.
- **Owner**: host (state edit) · nonoun-plugins follow-up (script). **Evidence**: decision-watcher
  risk note this sweep. **Size**: 5 min state; small tooling task upstream.

### 4.3 New worktree `.claude/worktrees/musing-newton-39ae10` @ 076790d3 (propose-only; minutes)
- **Action**: NOT in repo-cleaner's survey (it saw main-only minutes earlier) — almost certainly
  the caller's own live /lead-team session worktree. Verify liveness before ANY reap (probe-twice
  rule); no reap script exists in this repo (repo-cleaner: grep exit 1) — propose-only regardless.
- **Owner**: the caller session (confirm it's yours) → next repo-cleaner firing otherwise.
- **Evidence**: `git worktree list` at compose vs repo-cleaner report §Inventory. **Size**: 2 min.

### 4.4 #976 size-label discrepancy (caller; 1 min)
- **Action**: GitHub label = `size:small`; issue-sorter's table row says `big`. Label is what
  mobilize reads and matches the body ("additive and small") — planned as small (2.1). Sanity-check
  at dispatch; relabel only if the build's Understand phase disagrees.
- **Owner**: caller. **Evidence**: `gh issue list --json labels` vs sorter table. **Size**: 1 min.

## Standing notes (not queue entries)

- **Board shape (this compose)**: 23 open issues (#949–#976), 0 PRs, origin main-only, main +
  one live-session worktree (4.3). All issues owner-authored; `held-items.md` empty since first
  firing — nothing trust-gated.
- **#969 due-process ruling applies NOW** to every size:big dispatch (by hand until the skill
  lands): grounding note → earned docs → sliced Findings → checker verdict + pixel-truth.
- **Package-placement forks cluster**: #954 · #955 · #956 · #957 · #959 all wait on a layer/home
  ruling — one Kim round settles five issues (3.2).
- **Branch reaping is near-instant here** — delete-on-merge; future sweeps needn't 1:1 re-verify.
- **gitignore KEEP-LIST fence is permanent** — 7 standing G1 warnings, never re-propose.
- **adr_ratify.py amendment-mode cosmetic** (heading flips, guard blockquote keeps "proposed") —
  deliberate scope, not a bug; widening = Kim ruling + small tooling task.
- **nonoun-plugins cross-repo encoding**: PARKED (Kim, 2026-08-13); 4.2's script tolerance and
  #969's preload seam (if chosen) both ride that follow-up.
- **gen-ui-kit**: out of this board's scope (dedicated session per Kim's ruling).
- **`.claude/ops/` is git-tracked** — landing legs end in commit+push, not just a write (1.1).

*Composed by chore-planner (sweep-7, /sweep-chores fallback path), 2026-08-16 — returned as
payload per the #125 ops-write split; written and landed by the dispatching session.*
