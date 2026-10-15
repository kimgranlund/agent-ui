# Process/infra + ecosystem — foundations vs gap

> Snapshot date: 2026-08-05. Verified against the live tree, `gh issue`/`gh pr` (real numbers,
> queried live), ADR-0145, ADR-0168, and the draft PR #453 worktree — not reused from the
> 2026-07-28 wave without re-checking.

## 1. Foundations that exist

**(a) Gates health**
- The standing gate (`npm run check` = `tsc && check:site && check:tools && check:scripts`) plus
  `npm test`/`npm run test:browser` (six sequential shards) are unchanged in shape since the
  2026-07-28 wave — no gate-architecture churn this window.
- `main` is reported green as of today's roadmap synthesis, **including the browser gate**
  (roadmap.md §2: "`main` green incl. the browser gate (#458→#460)"). That arc is real and closed:
  GH #458 (`ui-pagination` site-preview browser test red on main, chromium+webkit) → fixed by PR
  #460 ("seed via `COMPONENT_INITIAL`", merged 2026-08-05T10:06:13Z).
  GH #457 (SPEC-R1 sortable-default prose) and GH #465 (ADR-0164 cl.3 citation re-home) both
  closed today by PR #467 ("two accepted-SPEC prose repairs + a citation re-home").
  GH #455 (`ui-table` size diet) closed by PR #470 (2558→2517 B gz). GH #454 (app budget breach)
  closed by PR #469 (argued re-base, 74→79 KB).
- Recent gate-shaped defects this window, all resolved same-day: adr_ratify's checklist parser
  (nested `·` truncation, GH #394, PR #026e03e-adjacent commit) got its own test/gate; the
  sitemap gate (`adr-index.json` regeneration, GH #447 "main's sitemap gate red") was a same-day
  fix-and-close; the calendar range-mode date-dependent probe (GH #403, month-rollover) was
  fixed. No gate-related issue is currently OPEN — `gh issue list --state open` returns exactly
  three items (#468, #438, #421; see §2/§4), none gate-shaped.
- ADR-0168 (accepted 2026-08-04, ratified via `adr_ratify.py` against a verified PR-comment
  utterance) shipped clean this time — its README-index-row regression (GH #416, "ADR-0168's
  README index row drops its Status cell, sitemap gate fails 166≠167") was caught and closed the
  same wave.

**(b) Docs coherence**
- The doc set (PLAN/GOALS/CHANGELOG/ROADMAP split, `roadmap.md` §1's own table) is stable and
  restated verbatim in the current `roadmap.md` (`.claude/docs/roadmap.md`) — no structural drift.
- `roadmap.md` itself was resynthesized today (PR #466, "2026-08-05 synthesis — M-A closed, the
  2026-07-28 arc complete") — the doc is being actively kept current, not left stale.
- Drift IS actively caught and repaired as a matter of routine, not left to accumulate: PR #467
  fixed two accepted-SPEC prose defects (GH #457, #465) plus a code-comment citation; a prior
  wave's row 37 fix ("row 37's owner cites the actual store mechanism, not ADR-0164 cl.3",
  commit `5418efa`) is the same pattern — citation-accuracy repairs land as their own small PRs
  rather than piling up.
- The `agent-ui-doc-standards` skill remains the single dialect authority (status vocabulary,
  ID spine, who may flip what) and is cited correctly throughout ADR-0145/0168.

**(c) The Linear question (roadmap.md §4 + ADR-0145)**
- **Disposition: settled narrow, explicitly parked wider.** ADR-0145 (`.claude/docs/adr/0145-ticket-tier-github-issues-backend.md`,
  accepted 2026-07-17/18, Ratified by Kim) ruled the TICKET tier — and *only* the TICKET tier —
  moves to GitHub Issues; ADR/SPEC/LLD/PRD/PLAN/ROADMAP are explicitly never delegated to any
  backend (F1). Its own "routing-table pattern" citation is the general doctrine this decision
  narrows from.
- `roadmap.md` §4 (Later — deferred) carries the live parked question verbatim: *"Linear, for this
  repo specifically. ADR-0145 chose GitHub Issues as the work-item backend here. If Linear
  becomes the standard elsewhere in the user's work, the open question is whether this repo
  follows... not a live fork today, just the thing that would reopen ADR-0145 if raised."*
  No issue or PR currently touches this — it is a pure watch-item, not active work.
- Mechanism detail (F2 in ADR-0145): `kind` uses GitHub's *default* `bug`/`enhancement` labels
  (Issue Types is org-only, unavailable on this personal-account repo — a build-time amendment
  Kim ruled 2026-07-18); `size` is a `size:small`/`size:big` label; `status` is Issue
  state+close-reason plus a `doing` label; Findings write-back is a dated Issue comment. This
  mechanism is live and in continuous use — every issue referenced in this report (#438, #421,
  #468, #453/#452/#449 etc.) carries exactly this label shape.

**(d) MCP and GitHub issue #438**
- `gh issue view 438` confirms: **OPEN**, title *"MCP client integration for the tool-enablement
  layer (deferred by ADR-0168)"*, labels `enhancement` + `size:big`.
- Body states the deferral precisely: *"Tracking record for ADR-0168's recorded non-goal:
  adopting an MCP client so integrations become drop-in rather than hand-authored manifests...
  Trigger condition: Revisit when a real external-integration need lands — the first candidate
  named by SPEC v0.9 / GH #49's direction is the hotel booking/PMS integration."*
- **Verified against ADR-0168's actual text** (`.claude/docs/adr/0168-*.md`, accepted 2026-08-04):
  its Non-goals section states verbatim — *"MCP client integration — deferred to its own future
  ADR; it changes the shell's dependency posture and is not prejudged here."* Roadmap.md's
  characterization ("#438, MCP client, deferred by ADR-0168") is accurate — not a fabricated or
  stale citation.
- A fresh **2026-08-05 triage comment** on #438 (today's hygiene sweep, Kim/OWNER) reconfirms:
  *"DELIBERATELY DEFERRED by ADR-0168's own Non-goals... No action owed until an MCP consumer need
  arrives; not stale, not unowned."* This is current-as-of-today disposition, not inherited from
  the prior wave.
- Separately, the **draft PR #453** worktree's spec (below) independently reaches its own MCP
  ruling — SPEC-R8, "MCP Apps posture: considered non-goal as a delivery vehicle" — a *different*
  MCP surface (MCP Apps, the UI-delivery iframe-bridge extension) than #438's MCP *client*
  question. The two are not duplicates: #438 is about A2UI's tool-enablement layer adopting an
  MCP client for tool dispatch; SPEC-R8 is about whether A2UI should ship its own UI over an
  MCP-Apps iframe bridge. Both currently land on "not now," for different reasons, in different
  records.

**(e) The a2ui-ecosystem PR #453 / worktree evidence**
- `gh pr view 453`: **DRAFT, OPEN**, branch `spec/a2ui-ecosystem-findings`, one file changed —
  `.claude/docs/spec/a2ui-ecosystem-alignment.spec.md` (263 additions). Worktree present at
  `.claude/worktrees/spec-ecosystem` (`git worktree list` confirms branch
  `spec/a2ui-ecosystem-findings`, HEAD `ad53b90`).
- Read in place (not modified) as input evidence. The SPEC is `proposed`, v0.1, dated 2026-08-05,
  refining `prd/a2ui-expert-system.prd.md` (PRD-G6/G7). It records a dated, confidence-marked
  ecosystem survey (§2) and mints eight FUTURE-only requirements SPEC-R1–R8 (§3), each routed to
  an existing spec/harness/pack rather than building anything itself (SPEC-N1). Headline findings
  cited as evidence, not judged:
  - **Verified drift**: this repo's `protocol.ts:120` / `renderer/surface.ts` still carry
    `surfaceProperties?: object`, a field the real v1.0-RC spec source removed (SPEC-R6(b) is the
    open ruling: keep as tolerated extension, or drop).
  - **AG-UI transport priority raised** (SPEC-R1) — the shipped 2026 cross-vendor pattern carries
    A2UI JSONL inside AG-UI's event stream; this amends the *parked*
    `a2ui-streaming-pipeline.spec.md`'s own open transport-priority question.
  - **No upstream conformance suite exists** (upstream issue #2150) — SPEC-R5 proposes packaging
    this repo's own validator fixtures as a contribution/differentiation lane.
  - **A2A version-gap flagged unverified** (SPEC-R6(c)): this repo's `@agent-ui/a2a` pins v0.3.0;
    an external claim of a "v1.0, April 2026" A2A spec is stated `[unverified]` and routed to a
    dated audit, not acted on directly.
  - **`a2ui-protocol-facts` pack re-sync needed** (SPEC-R7) — the user-scope pack carries a stale
    theme→`surfaceProperties` rename claim and the old `google/A2UI` URL; routed to `/make-pack`,
    not a repo build.
  - All eight action rows (§5) are named-but-not-yet-filed — the SPEC explicitly defers
    `gh issue create` to when each is picked up, per ADR-0145.
- This PR is the single open PR blocking nothing (`main` is green independent of it) — it awaits
  Kim's ratification read, exactly as roadmap.md §2 states.

## 2. The gap

**(a) Gates**
- No open gate-shaped defect exists at this snapshot — the gate layer is in a genuinely clean
  state (rare; worth naming as a fact, not assuming steady-state).
- PATTERN gap: no single doc enumerates "which gate catches what class of defect" (sitemap gate
  vs docs-grammar gate vs browser-shard gate vs adr-status-guard) — that map lives only in commit
  history and scattered skill references (`agent-ui-component-testing`, `agent-ui-doc-standards`).
  Not urgent (no defect traces to this today) but a latent onboarding gap.

**(b) Docs coherence**
- No systemic drift found this snapshot; the repairs found (GH #457/#465/#454/#455) are the
  normal, small, same-day-closed churn of an actively maintained doc set — not evidence of a
  backlog.
- One still-open thread: #465's own Findings note "one ratified-prose spot awaiting Kim's
  sanction" (per roadmap.md §2) — i.e. #465 is closed at the code-repair level but has a
  sub-item still waiting on a human read. Worth flagging as a genuinely open (if tiny) loose end.

**(c) The Linear question**
- COMPONENT/PATTERN: none — this is a pure organizational/backend question, not a build gap.
- The gap is definitional: ADR-0145 gives no criteria for *when* "Linear becomes the standard
  elsewhere" would be true, or how the ID-spine convention (ADR/SPEC/LLD citing `#NNN`) would
  survive a backend swap if it ever happened. That's explicitly named as the reopening question,
  not resolved — appropriately left unresolved since there is no live trigger.

**(d) MCP (client integration, #438)**
- COMPONENT: no MCP client exists in `tools/agent/` today; the manifest-registry mechanism
  (`registerIntegration()`, ADR-0168 cl.1) is the only enablement path, by design.
- The gap is intentional and well-fenced: #438's own acceptance criteria require a *new proposed
  ADR* (not a ticket, not a drive-by build) before any MCP-client code lands — a correctly high
  bar for a dependency-posture change to the site-internal shell.
- SPEC-R8 (PR #453, separate MCP surface) similarly rules MCP Apps a non-goal as a UI-delivery
  vehicle, with a named re-entry condition (a catalog-governed A2UI-inside-MCP-Apps bridge pattern
  emerging upstream) — also correctly fenced, not silently closed.

**(e) Ecosystem alignment (PR #453's SPEC)**
- The SPEC itself is the gap-map for this axis; nothing in it is built (SPEC-N1). The two
  requirements with the widest blast radius if deferred too long: SPEC-R6(b) (repo-local drift —
  `surfaceProperties` field left over from a spec version this repo no longer targets) and
  SPEC-R1 (AG-UI transport priority — the parked streaming SPEC's own open item, now answered by
  external convergence but not yet built).
- PAGE/PROCESS gap: the SPEC's §5 action rows are all "file when picked up" — meaning zero GitHub
  Issues exist yet for any of SPEC-R1–R7 (SPEC-R8 is self-contained, no issue needed). If this SPEC
  ratifies without a deliberate filing pass, its eight action rows could silently stall the same
  way roadmap.md §1 warns issue-tracking fragments do.

## 3. Candidate first slices (ordered by evidence-to-effort)

1. Ratify PR #453 (`docs(spec): a2ui-ecosystem-alignment`) — zero-cost (Kim's read only), unblocks
   filing SPEC-R1–R7 as real GitHub Issues per its own §5 routing table.
2. File SPEC-R6 (version-pin + drift audit, 4 arms) as the first issue off #453 once ratified —
   it's the cheapest (`size:small`) and resolves the one CONFIRMED repo-local drift
   (`surfaceProperties`) plus the A2A version-gap uncertainty in one dated pass.
3. File SPEC-R4 (orchestrator surface-ID prefixing on the `Session` seam) — `size:small`, a
   concrete safety gap (subagent surface-ID collisions) with a spec-source citation already in
   hand.
4. Close #465's dangling "ratified-prose spot awaiting Kim's sanction" sub-item — small, already
   surfaced, just needs the human read named in roadmap.md §2.
5. File SPEC-R2 (render-depth guard) — `size:small`, a real fault-isolation gap (stack-overflow
   risk on pathological payloads) with a clear route (`a2ui-runtime.spec.md`'s existing SPEC-N4
   family).
6. Larger, `size:big` items — SPEC-R3 (deceptive-composition eval lane) and SPEC-R5 (conformance-
   suite packaging) — are real but should wait until the smaller SPEC-R2/R4/R6 rows prove the
   filing pattern works cleanly.
7. #438 (MCP client) and SPEC-R8 (MCP Apps) both stay parked until a real external trigger
   (the named hotel/PMS integration, or an upstream MCP-Apps + catalog bridge pattern) — no
   action recommended now; re-litigating either without a trigger would violate ADR-0168's own
   Non-goals ruling.
8. The Linear question (roadmap.md §4) — no action; correctly parked, revisit only if Linear
   becomes the cross-project standard elsewhere.

## 4. Cross-system dependencies

- SPEC-R1 (PR #453) depends on / amends `a2ui-streaming-pipeline.spec.md` — a *parked* spec, not
  an active one; building SPEC-R1 without first un-parking that spec would create an orphaned
  amendment.
- SPEC-R6(c)'s A2A audit depends on `@agent-ui/a2a`'s pinned `PROTOCOL_VERSION` (v0.3.0,
  `packages/agent-ui/a2a/src/index.test.ts:10`) staying the single source of truth — any version
  bump there must trace back to this audit's ruling, not happen independently.
- SPEC-R7 (pack re-sync) is a **user-scope** action (`/make-pack` on the `a2ui-protocol-facts`
  pack, agent-protocols plugin) — it is NOT a repo file and cannot be closed by a repo-side PR;
  the dependency crosses the repo/harness boundary explicitly and correctly, per the SPEC's own
  routing table.
- ADR-0168's manifest-registry mechanism (cl.1–cl.6) is the shared substrate both #438 (MCP
  client) and any future keyed integration (the named hotel/PMS work) build on — #438's own
  acceptance criteria correctly require weighing `auth:'serverKey'` (ADR-0168 cl.4) and
  `ToolDef`/dispatch-time validation (cl.3) before an MCP client is designed, so the two records
  are already correctly sequenced (ADR-0168 first, #438 second).
- The gate layer (`npm run check`/`test`/`test:browser`) is the one dependency every candidate
  slice above shares implicitly — none of the SPEC-R rows name their own gate yet (that's part of
  each row's own future acceptance criteria, not filed separately).

## 5. Risks

- **Filing drift risk**: PR #453's eight SPEC-R rows are named but not yet GitHub Issues. If the
  SPEC ratifies and the filing pass is skipped or delayed, the same fragmentation-into-silence
  roadmap.md §1 warns about (an issue list "goes stale the moment an issue closes") could instead
  manifest as the *opposite* failure — requirements that never even became issues. Low probability
  given this repo's demonstrated same-day-filing discipline (#454/#455/#457/#458/#465 all filed
  and closed within the current wave), but worth flagging since it's a new SPEC, not yet proven.
- **`surfaceProperties` drift risk**: until SPEC-R6(b) rules explicitly, this repo's wire types
  (`protocol.ts:120`, `renderer/surface.ts`) carry a field the upstream v1.0-RC spec removed.
  Low blast radius today (nothing consumes it incompatibly), but it is a live, verified
  divergence from the spec this repo claims to track (`SUPPORTED_VERSIONS`).
- **MCP double-surface risk**: two separate "MCP" questions are now on record (#438's client-side
  tool-dispatch question; SPEC-R8's Apps/UI-delivery question). Both are correctly distinguished
  in this report, but a future reader skimming issue titles/labels alone could conflate them —
  worth a cross-reference note if/when either is picked up.
- **Linear reopening risk is near-zero today** — no signal in the tree that Linear is being
  adopted elsewhere in the user's work; ADR-0145's own reopening condition is unmet. Flagging only
  because the roadmap explicitly keeps the question alive rather than closing it, which is the
  correct call but means it needs re-checking at each future synthesis pass rather than assumed
  settled forever.
- **Gate-health snapshot risk**: this report explicitly did NOT run `npm run check` (out of scope
  for this seat, per the task brief) — "no open gate-shaped issue" is inferred from `gh issue
  list` + recent commit/PR history, not a live gate run. If a regression landed in the last few
  commits without yet surfacing as an issue, this report would miss it.
