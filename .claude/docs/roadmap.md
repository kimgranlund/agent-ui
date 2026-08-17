# agent-ui — roadmap

> Status: living, forward-looking. Companion to [`plan.md`](./plan.md) (architecture — the closed
> foundation build) and [`goals.md`](./goals.md) (the dated milestone/DoD ledger). Distinct from
> both: this file is prose + priority, not a checklist of what already shipped — it says what's
> current and what's next, and is **revised in place** at each synthesis pass rather than appended
> to forever (the one exception: closed items move to a dated line under §4, never silently
> deleted). Work-item tracking — the churn of individual bugs/features, their status, comments —
> lives in GitHub Issues ([ADR-0145](adr/0145-ticket-tier-github-issues-backend.md)) or, on other
> projects, Linear — **never here**. An issue may cite a section of this doc the same way it cites
> an ADR/SPEC/LLD id; this doc never enumerates issues by number, because that list goes stale the
> moment an issue closes and this doc isn't the place re-reading it. Last synthesis pass: 2026-08-05 evening (the M-D → M-E → M-F arc ruled).

## 1 · Why a fourth doc

Four documents now cover four different questions, and conflating any two of them is exactly the
kind of drift `process.md` exists to prevent:

| Doc | Question it answers | Shape | Update cadence |
|---|---|---|---|
| [`plan.md`](./plan.md) | What is this, architecturally, and why these choices? | Prose, mostly closed/historical | Rare — only when a foundational decision moves |
| [`goals.md`](./goals.md) | What did each milestone require, and is it done? | Dated milestones, DoD checklists | Per milestone close (append-only in spirit) |
| `CHANGELOG.md` | What shipped, and when? | Dated, one entry per ticket/wave | Per ship |
| **`roadmap.md`** (this file) | What's true *right now*, and what's next — and why? | Now/Next/Later, revised in place | Per synthesis pass (milestone boundary or ratification batch) — **not** per commit |
| GitHub Issues (or Linear) | What's the status of *this one* bug/feature? | Individual records | Continuous |

The split that matters: **issues own the churn, this doc owns the narrative.** An issue tracker
fragments into hundreds of atomic, mostly-closed records — nothing in it coalesces into "where is
this project going and why." A roadmap trapped inside a SaaS tool's project view has the opposite
problem — invisible to anyone (or any agent) reading the repo directly, and it doesn't survive a
tool swap. So the narrative stays a versioned file, diffable and git-blamable next to the code it
describes, and issues/PRs *cite into it* rather than replace it.

**The ledger gap — ruled, no longer open.** `goals.md` stopped at the icon adapter (2026-07-04)
and `CHANGELOG.md` at 2026-07-13; the weeks of shipped work after those dates were never
backfilled. Kim ruled on 2026-07-23: **historical-only** — both stay pure historical ledgers,
append-only going forward, **never backfilled**, and this roadmap's §2 is the one source of
"current state." The gap is therefore the ruled shape of the doc set, not a defect awaiting a
decision (dated line in §4).

## 2 · Now — current state (as of 2026-08-05)

> **Arc status, 2026-08-05 (evening): the NEXT ARC IS RULED — M-D → M-E → M-F** (the same-day
> intake wave [`reports/roadmap-wave-2026-08-05/`](reports/roadmap-wave-2026-08-05/) + Kim's
> in-session decision round; the sheet's Q1–Q4 all answered). The prior arc (M-C 07-29 · M-B 08-04
> · M-A 08-05) is fully closed — §4's dated lines. The ruled order and standing decisions:
> **M-D** per-persona A2UI catalogs — GH #421 REOPENED by Kim's own ruling; its design intake
> (GH #472) is in flight and its ADR gates the build. **M-E** upstream-drift correctness — with
> Q3 pre-ruled: `protocol.ts`'s `surfaceProperties` DROPS (upstream v1.0-RC removed it; GH #477
> carries the ruling). **M-F** the second SaaS composition + the association/multi-select intake.
> The ecosystem SPEC ([`spec/a2ui-ecosystem-alignment.spec.md`](spec/a2ui-ecosystem-alignment.spec.md))
> was ratified the same round (Q4) and its action rows filed (GH #473–#477); its R7 pack re-sync
> is a user-scope harness action, R1 waits on its own streaming-SPEC revision.
> `main` green across every gate incl. size (post #469/#470); the standing checkpoints (#455/#468)
> and the ADR-0168 MCP deferral (#438) remain deliberate.

- **Component foundation — complete.** G0–G9 + the Control Suite + the icon adapter: the reactive
  kernel, FACE element layer, templating/directives, and ~50 `ui-*` controls across the
  Indicator/Range/Input/Overlay/Container/report/content/feed/chart families. Closed, not actively
  growing — recent additions are single-control refinements riding reviews (`ui-menu`'s
  selectable-item variant, `ui-disclosure`'s `slot="summary"` foreseen extension — ADR-0158), plus
  one genuinely new control: `ui-sandbox-frame`, the GenUI containment host (below).
  `ui-status-stream` grew the most of any single control this window: worst-child escalation with
  the elapsed-timer/retry refinements (ADR-0146 F5/F6, ADR-0153 — which minted `action`, the
  seventh fleet event name), then the **receipt pattern** (ADR-0159, proposed) — closed-table
  live/done label pairs so a settled step never wears a progressive "-ing…" form, two opt-in
  props (`oneline`: one morphing line while a turn runs; `receipt`: auto-collapse to a one-line
  summary on turn end, error stays loud), and a per-step raw-source reveal (a `progressDetail`
  sibling rung, fail-closed, capped) — all riding the shared `ui-timeline-item` disclosure
  anatomy, zero new public surface on that control.
- **The shell system — the current center of gravity.** The named-archetype family (ADR-0151):
  `ui-super-shell`, a two-level recursive rail+pane grammar on an 18px module, with
  `ui-workspace-shell`/`ui-chat-shell` as presets; resizable panes + tab collapse (ADR-0154); the
  responsive band ladder and menu⇄X toggle law (ADR-0155). `ui-app-shell` is **removed** (ADR-0156,
  Option C ruled and ratified; the removal gate closed 2026-07-26 — §4's dated line): the migration
  window is over, ADR-0082/0083/0084 carry `superseded` with clause-5 forward pointers, and the
  super-shell family is the package's one shell grammar. The
  shell-system **laws** are spec'd and enforced ([shell-archetypes
  SPEC](spec/shell-archetypes-m5.spec.md), accepted v0.7): the two-system spacing ladder (SPEC-R11)
  backed by a deterministic spacing-drift gate born at zero (AC19 — every `@agent-ui/app` sheet
  plus the shell-composing site sheets); scope-proximity display overrides (SPEC-R12); live floors
  that hold under passive resize, not just drag (SPEC-R13, AC20) with measurement-based
  auto-collapse; the mid-window overlay keeping an auto-collapsed side reachable (SPEC-R14,
  AC21); and the narrow-stack canvas floor as a dedicated, reachable axis — the canvas can't be
  squeezed to zero, and its floor is a real scroll seam, not a clipped edge (SPEC-R15). The
  docs-site chrome itself rides the family — down to the nav rail's group labels, which read the
  fleet kicker typescale role rather than a bare font-size.
- **`ui-agent-admin` — re-hosted and reworked.** Its chrome now composes the
  chat-shell/super-shell grammar (ADR-0154); its tab strips are the fleet `ui-tabs` control in the
  ADR-0144 `fill` posture; Settings/Context share one fold pattern (heading-row chevrons); summary
  controls ride `slot="summary"` (ADR-0158). Substance grew too: a provider-grouped model grid
  with a default-radio system, add-from-library capability packs (skills/workflows/resources/
  tools) with real tool execution in the live loop, Surface Options (Markdown · A2UI catalog ·
  GenUI — the once-PRD-gated row now live: a fail-closed off-by-default toggle plus the
  pattern-source picker), and a much larger persona roster (games, hospitality/travel). The
  conversation composer now owns the provider and Gen-UI-mode pickers in-field (the site's
  standalone provider-switcher retired), and the full-viewport standalone surface
  (`agent-admin-app.html`) is a listed, discoverable site page — Kim's 2026-07-25 overturn of the
  earlier deliberate opt-out — while staying shell-less, since its whole point is the production
  surface, not a docs-wrapped preview. The long-standing page-freeze was root-caused and fixed —
  an unbounded synchronous client-turn loop, now bounded and deferred. The chat surface itself is
  chromeless: A2UI render surfaces carry no host background/padding/width-cap on the chat path,
  and agent turns de-bubble entirely
  (sender label above, bare full-width content, streaming included) while user turns keep a
  compact bubble.
- **A2UI layer (`@agent-ui/a2ui`)** — the zero-dep renderer/validator/default-catalog, structural
  resend reconciliation (ADR-0128), and the live-agent **producer toolkit** (ADR-0137, persona
  seam ADR-0138) — now with the live-turn lifecycle progress channel built into the transport
  meta-line (ADR-0146), produce-halt surfacing, in-persona self-correct feedback, and the dev
  live-agent proxy ported to a Cloudflare Worker (ADR-0152).
- **GenUI surface — shipped end to end (B0–B2).** The ruled identity: free-form HTML/CSS/JS in a
  sandboxed iframe — "contained, not forbidden" ([PRD](prd/genui-surface.prd.md) v0.4 ·
  [SPEC](spec/genui-surface.spec.md) v0.3, both `proposed`, every fork ruled; D6 = the in-house
  wire, MCP-Apps-shaped safety model, atomic HTML). `ui-sandbox-frame` (components) is the
  fail-closed containment host — CSP · closed agent↔frame bridge · token bridge. B2 made the
  path real: the canonical wire reader/writer at `@agent-ui/a2ui/agent` (`genui-line` — the
  site's B1-era stub is now a thin re-export of it), `produce()` peeling genui lines ahead of
  heal/validate with structural defects tallied as `GENUI_*` failure codes on the turn trace,
  three curated pattern-source packs plus a degradation-safe prompt block (SPEC-R9), and
  `ui-agent-admin` mounting GenUI surfaces inside its real turn loop on a parallel path beside
  the A2UI client. The `gen-ui-live` site demo stays deliberately recorded-only. What's left is
  out of the SPEC's own contract: B3, the judged pack-idiom eval (§4).
- **A2A protocol layer (`@agent-ui/a2a`)** — pinned to spec v0.3.0, the tic-tac-toe
  isolation-proof arena, its own concepts corpus.
- **`@agent-ui/router`** — the memory-first SPA router (ADR-0115).
- **`@agent-ui/code`** — the code+prose family: zero-dep core, `./highlight`, `./markdown`, and
  `./editor` (`ui-code-editor`, CodeMirror 6 — the one sanctioned runtime dependency, ADR-0139) —
  now with a richtext live-preview mode whose revealed line is raw source only (ADR-0147, as
  amended).
- **Theming** — the `--md-sys-*` consolidation (ADR-0140), the theme-pack pipeline (ADR-0141, 10
  packs live in the docs-site header), the theme-provider ink re-root at scheme boundaries
  (ADR-0148), and the fleet's one viewport-responsive token, the compact-body breakpoint
  (ADR-0150).
- **Published and deployed.** The packages publish **scoped as `@agent-ui-kit/*`** to the live npm
  registry — per-package READMEs with CDN usage, an install-from-registry consumer smoke in CI —
  and the docs site auto-deploys to `ui.nonoun.io` on every push to main. This closes the
  library-emit deferral that sat in §4 since G8 (dated line below).
- **Vocabulary + process.** The anatomy-attribute axis vocabulary is law (ADR-0157 →
  [`references/naming.md`](references/naming.md) §6): `data-part` = control-created anatomy,
  `data-slot` = the consumer-side slot claim, orthogonal state/variant axes each their own
  attribute, `data-role` = author content-model kinds. ADR ratification is PR-native and
  mechanized — Kim's utterance, verified and flipped by script (ADR-0149). The ticket archive
  under `.claude/docs/tickets/` is now **fully closed** (98 files; the last two stragglers shipped
  — see §4); all work-item churn lives in GitHub Issues (ADR-0145). Gate hygiene hardened in the
  same window: the browser gate runs six sequential shards including the isolated focus-timing
  class, and the visual gate is deterministic (zero pixel tolerance when re-capturing baselines;
  calendar baselines pinned to a never-today month).

## 3 · Next — concrete, near-term

- **ui-slider label/value layout patterns (GH #1141, `size:small`, filed 2026-08-17).** The #1126
  readout is transient-only and single-placement; agent-rendered sliders (blackjack bet) show no
  value at rest. Add a `layout` prop — standard (label left / value right, above the track,
  default) · inline (label/track/value on one row) · block (label above-center, value
  below-center) — with a default-visible readout.
- **Ask-flow COMPLETION state (GH #1101, `size:big`, filed 2026-08-17).** Kim's live test-chat
  report: a multi-step intake flow ends on a bare summary card — no closing prose turn, no
  end-of-flow affordance (done/start-over/handoff). Two halves: producer/prompt guidance in
  `@agent-ui/a2ui` `./agent`, plus a surface-side affordance on the summary card or page chrome.
  Adjacent to ADR-0196 (per-card settling, not flow completion) and the #1065 shared-template
  question — this may be where the a2ui-live/agent-admin shared-chrome lift gets forced.
- **M-D — "Personas with their own catalogs" (first of the 2026-08-05 arc). 🟡 IN FLIGHT** — built
  from the RATIFIED [ADR-0172](adr/0172-persona-catalog-composition-intake.md) (GH #421's reopened
  intake, frozen 2026-08-05): each persona composes `shared primitives + the shared system-patterns
  tier + its own package-level local-pattern catalog-schema` — realized as a compose-time OVERLAY
  over ADR-0169's two-catalog registry (no third wire-visible catalog id), the persona carrying only
  its catalog SELECTION on the ADR-0170 seam. Next artifact per the ADR's own Repairs cell: **M-D's
  SPEC** (then the build — GH #480). After M-D: **M-E** (upstream-drift correctness; Q3 pre-ruled,
  GH #477 drops `surfaceProperties`) then **M-F** — per
  [ADR-0175](adr/0175-association-multiselect-field-design-intake.md) (ratified 2026-08-06, GH
  #498): a multi-select FIELD primitive is minted for the record-edit/binding case (PRD-D3's
  composed facet vehicle stands, unreopened, for the filter case); its wire value rides the
  ORIGINAL single two-way slot with an array-typed prop, not ADR-0161's multi-slot mechanism;
  to-many association/relationship editing is fenced OUT as its own, later, harder intake. Next
  artifact: [`spec/multi-select-field.spec.md`](spec/multi-select-field.spec.md) (this SPEC), then
  M-F's own LLD/build — the 2026-08-05 wave's ruled order (§2).
- **The 2026-07-28 intake ruled the next arc.** A six-system inventory wave (agent-admin · a2ui ·
  GenUI · components · shells · SaaS patterns) fed a dependency-spine synthesis and three
  candidate milestones; Kim ruled the order on 2026-07-28. The full wave record — six inventories
  plus the spine/milestones/decision syntheses — lives at
  [`reports/roadmap-wave-2026-07-28/`](reports/roadmap-wave-2026-07-28/). The ruled order:
  **M-B → M-C, with M-A's two design forks intaken in parallel during M-B** so M-A starts
  contract-frozen. One gate spans the arc: the **three-ADR ratification batch** —
  [ADR-0161](adr/0161-catalog-multi-slot-two-way-value-marks.md) (M-B's first phase builds from
  its ratified text), [ADR-0162](adr/0162-genui-agent-ui-dogfood-mode.md) (likewise M-C's build),
  and [ADR-0160](adr/0160-chat-redesign-agent-bubble-reversal-header-flat-action-chips.md)
  (record hygiene — the chat redesign is already merged, so a lingering `proposed` would misstate
  reality). Ratification is Kim's owner-only Status flip; each milestone's build starts only from
  the ratified text. The in-flight ADR-0161/0162 design slices fold into these milestones' first
  phases; they are not separate arcs.
- **M-B — "Personas that don't lie". 🟢 DONE 2026-08-04** — all five DoD boxes proven by live runs
  (goals.md carries the dated evidence addenda): the Hotel Concierge submit snapshot carried a real
  user-picked date range (ADR-0161's criterion, PR #405's evidence note); a full multi-round quiz
  survived the action-click resume path with the round-budget/recovery policy exercised live (#307
  closed on 34 cumulative clean turns); persona export/import round-trips byte-equal (PR #410, the
  persona-library pattern page); and the second catalog — **upstream A2UI Basic, `a2ui-basic`**
  (ADR-0169, ratified) — is pickable with `catalogId` threaded end-to-end (PR #430, live
  catalog-switch proof). Follow-ups spawned, none blocking: #429 (E7 validate-time gate), #409
  (toggle rehydration), #404 (PARSE-flake record). See §4's dated line.
- **M-C — "GenUI speaks fleet" (second). 🟢 DONE 2026-07-29** — S1–S5 all merged (#336/#338/#345),
  Proof-of-mode run live by Kim, DoD met; see [`goals.md`](goals.md) for the evidence and the one
  recorded deviation (the live run was on `gen-ui-live`, not agent-admin). Two ratified-contract
  conflicts the build exposed were ruled and repaired in #351 (SPEC-R13(b)'s unsatisfiable
  single-parser requirement → a parity-proven reader; the descriptor format's missing compound-family
  field → `.define()`-site derivation, closing a 64-vs-59 taught-tag gap), and the wave's app-barrel
  size breach in #356. Original scope, for the record:
  surfaces out of real, upgraded `ui-*` components with fleet tokens — visibly the fleet's own
  design language instead of bare model HTML, provable live in one demo session. The build is
  ADR-0162's S0–S5 decomposition as written
  ([`decompositions/genui-dogfood.decomp.md`](decompositions/genui-dogfood.decomp.md)): the docs
  pass → the committed, freshness-gated
  CSS+IIFE asset pair under `sandbox-frame/dogfood/` → frame injection with browser probes → the
  byte-pinned prompt segment with its drift-gated derived inventory → surfacing (the agent-admin
  Surface-Options toggle, plus `gen-ui-live`) → the cross-half bundle-tags ≡ inventory-tags
  set-equality gate. An optional third phase adds a live GenUI demo surface (today only
  agent-admin shows GenUI live) and B3's fleet-idiom eval dimension. Acceptance is dogfooded: a
  live session with dogfood ON produces a surface whose rendered DOM contains upgraded `ui-*`
  elements — real anatomy, not unknown inline elements — with the set-equality gate green.
- **M-A — "SaaS Data Workbench". 🟢 DONE 2026-08-05** — the full contract chain closed in order:
  intakes frozen (ADR-0163/0164, ratified) → PRD accepted (v0.2, Kim 2026-07-31) → SPEC accepted
  (v0.1, Kim 2026-08-05 — ruling D4 A2UI-via-`ui-surface-host` · D5 recorded · D6 `ui-modal`) →
  MA-1 `ui-table` widened in place + `ui-pagination` minted + the catalog expression (PR #456,
  size re-based per Kim's "checkpoint not ratchet" ruling, #455 the shrink follow-up) → MA-2
  entry-list extraction (PR #459) → MA-3 the workbench page, every PRD fence probe-proven (PR
  #463) → MA-4 the exemplar-cited pattern rows (PR #464). Follow-ups spawned, none blocking:
  #465 (citation re-home incl. one ratified-prose spot), #457, #455, #454. See §4's dated line.
- **Per-control catalog intake — RESOLVED in-tree** (stale-line repair 2026-08-05, per the intake
  wave's inv-2 §3 verification): the five once-uncataloged controls are all dispositioned — four
  PERMANENT allowlist exclusions with cited ADRs, one catalog row. No open work; the 2026-07-28
  ruling was executed and this line simply lagged it.
- **Identity & account flow family — COMPLETE, S1–S5 ALL SHIPPED (2026-08-08).**
  ([GH #490](https://github.com/kimgranlund/agent-ui/issues/490) ·
  [ADR-0176](adr/0176-identity-account-flow-family-design-intake.md), ratified 2026-08-06.) The
  ADR's four frozen rulings govern: the per-flow lane cut (exactly ONE new control — the code-entry
  field, shipped as `ui-otp-field` — everything else pattern composition or documented idiom,
  ADR-0102's three lanes repurposed); the hard demo-only security fence (mock transport, never real
  auth); the catalog-exposure ruling; and cl.4's five-slice build sequence. The decomposition
  manifest ([`decompositions/identity-flow.decomp.md`](decompositions/identity-flow.decomp.md))
  carries the leaf/tier map and dependency edges. All three open forks are RULED (2026-08-07:
  OQ1 build the `ui-progress` discrete-segments prop at S4 · OQ2 generic icons, no brand marks ·
  OQ3 interactive demos on the shared mock transport, X1 a hard S1 prerequisite) — none still gate
  anything. Shipped: **S1** Registration + Email+Password (PR #561) · **S2** Codes + Magic Link,
  incl. the new `ui-otp-field` control (PRs #596/#578, LLD PR #582) · **S3** Social Auth (PR #605).
  **S4** Onboarding shipped (PR #621, the OQ1-ruled `ui-progress` segments prop,
  [GH #614](https://github.com/kimgranlund/agent-ui/issues/614)) · **S5** Account Management
  shipped (PR #622, [GH #615](https://github.com/kimgranlund/agent-ui/issues/615)); family-close
  debts resolved (PR #620, [GH #611](https://github.com/kimgranlund/agent-ui/issues/611)).
  Family-wide layout cards (S3-c class) remain unbuilt — the one deliberately-open remnant, needing
  its own intake if ever wanted.
- **Agent-authoring flow family — COMPLETE, S1–S4 ALL SHIPPED (2026-08-09, same-day intake→ship).**
  ([GH #633](https://github.com/kimgranlund/agent-ui/issues/633) ·
  [ADR-0178](adr/0178-agent-authoring-conversational-persona-hydration.md), ratified 2026-08-09 ·
  manifest [`decompositions/agent-authoring-flow.decomp.md`](decompositions/agent-authoring-flow.decomp.md) ·
  LLD [`lld/agent-authoring-flow.lld.md`](lld/agent-authoring-flow.lld.md).) Shipped: **S1**
  blank path (PR #639) · **S2** the `personaPatch` producer arm + authoring gate, SPEC v0.14
  R29/R30 (PR #642) · **S3** the guided authoring flow — Builder persona, three-filter
  drop-never-coerce apply gate, dual-context anatomy, the Kim-ruled STORE-IDENTITY consumption
  fence (LLD PR #643, build PR #645) · **S4** the try-it toggle (PR #647). **S5 (NL-edit
  everywhere) is parked-IN** (Kim's pre-signal) carrying its inherited question: the fence
  deliberately blocks arbitrary-chat patching, so S5's intake rules its own consumption path
  (LLD §15). Residue: [GH #644](https://github.com/kimgranlund/agent-ui/issues/644) (prose-arm
  history isolation under the degrade config, in progress).

- **Planner-stage pilot — the wire half is IN, the loop half is unscheduled. 🟡**
  ([ADR-0174](adr/0174-planner-stage-pilot-sequential-opt-in-loop.md), ratified 2026-08-06.) An
  opt-in, SEQUENTIAL plan→execute→synthesize loop composed entirely from already-shipped
  `Session`/`produce()`/meta-line/status-stream mechanics — no new component, no new transport.
  Its sequencing is the ADR's cl.5 ruling, **not** the filing issue's "depends on AG-UI +
  SPEC-R4" framing: `AgentTransport` already isolates transports (an AG-UI arrival is an
  implementation swap behind an interface built for swaps), and orchestrator surface-ID prefixing
  is load-bearing only for a future CONCURRENT-step upgrade this ADR explicitly declines to
  design. What that leaves, in order: **(1) the `plan` meta-line arm — DONE**
  ([`spec/a2ui-live-agent.spec.md`](spec/a2ui-live-agent.spec.md) SPEC-R20, PR #537): a
  model-authored, additive, shallow-validated `plan` field on the ADR-0088 envelope (a malformed
  `plan` drops only `plan`), passed through by `produce()` with no integrity check and no retry
  arm, `AgentTransport.turn` byte-identical. **(2) recorded/live parity — DONE** (PR #551):
  `RecordedTurn`/`createRecordedTransport` carry the same `{note, plan}` shape the `ask` arm
  already rides. **(3) the host-side half — designed, buildable today, NOT scheduled:** the
  persona-scoped opt-in gate, the plan-runner module (N sequential `produce()` calls over one
  growing `Session`), the step projection onto the existing status-stream grouping, and the
  closing synthesis turn. It waits on a scheduling decision only — the ruled arc is M-D → M-E →
  M-F — not on any missing mechanism. **(4) the concurrent/parallel-step upgrade** stays an
  unwritten design (its surface-ID-prefixing precondition has since landed; the design has not).
- **AC19's sheet set — widen deliberately, or not.** The spacing-drift gate covers the shell
  family today (every `@agent-ui/app` sheet + the shell-composing site sheets). Whether it extends
  further — components-package sheets, the remaining site sheets — is an open, per-sheet decision;
  the gate's own design makes each extension a one-line reviewed append, never automatic.
- (The older proposed scope intakes — content, feed, and report families, the a2ui expert system —
  remain parked intakes, not scheduled work.)

## 4 · Later — deferred, revisit-triggered

- *(The identity & account flow family moved to §3 — its design intake is ratified, no longer
  deferred: [ADR-0176](adr/0176-identity-account-flow-family-design-intake.md), executing that
  ADR's own on-ratification repair.)*
- **Linear, for this repo specifically.** ADR-0145 chose GitHub Issues as the work-item backend
  here. If Linear becomes the standard elsewhere in the user's work, the open question is whether
  this repo follows (and how the ID-spine convention — ADR/SPEC/LLD citing an issue — survives a
  backend swap) — not a live fork today, just the thing that would reopen ADR-0145 if raised.
- **Sync read surface on shared's localStorage StorageAdapter tier (GH #1077).** ADR-0193's seam is
  async-by-ruling, so PR #1027 migrated app memory-store's write path only — hydration stays a direct
  synchronous prefix scan (SettingsStore must answer construct→get same-tick). An optional sync
  capability on the localStorage tier alone (getSync/keysSync or a snapshot() warm cache) would
  unblock the full read-path migration; ADR-0193 amendment territory — design ruling before build.
- **ui-menu selected-option scroll-centering + default focus on open (GH #1100, size:small).** An
  overflowing menu panel opens at scroll offset 0 today; the selected option should open centered
  in the viewport and focused (ARIA listbox pattern). `ui-select`/`ui-multi-select` share the panel.
- **GenUI B3 — the judged pack-idiom eval.** Out of the GenUI SPEC's contract by its own §6 cut:
  PRD §8 m3 (judge-scored pack-idiom use) realized as a judged corpus-rubric shard plus its docs
  page (PRD-G6) — a named manual live-model run, never part of the deterministic gates (SPEC-N3).
  Revisit when the producer's output quality needs a measured floor.
- *(The GH #421 per-persona-catalogs deferral that lived here moved to §3's M-D milestone on
  ADR-0172's ratification — its three questions are FROZEN answers now, not open framing:
  package-level per-persona catalog-schema homes · a compose-time overlay over ADR-0169's registry
  (no third wire-visible id) · a new named system-patterns tier. The ADR-0172 Repairs-cell move,
  2026-08-05.)*

---

*Closed items move here, one dated line each, rather than being deleted from §3 silently:*

- **2026-08-05** — **M-A "SaaS Data Workbench" closed — and with it the whole 2026-07-28
  three-milestone arc** (M-C 07-29 · M-B 08-04 · M-A 08-05). One day intake-to-done for the build:
  SPEC accepted (D4/D5/D6 ruled) → MA-1 (#456, `ui-table` interactive widening + `ui-pagination` +
  catalog rows, argued size re-base) → MA-2 (#459, entry-list extraction — a parallel session's
  lane) → MA-3 (#463, the workbench page: form-popover facets, modal record-edit, recorded
  `ui-surface-host` summary, zero-network probe, AC19 join) → MA-4 (#464, pattern rows S9-proven
  against the page). En route: a duplicate MA-1 lane detected and wound down (the
  check-main-before-dispatch lesson), #458's preview red fixed (#460), and the two-session
  collision + follow-up set (#454/#455/#457/#465) all recorded.

- **2026-08-04** — **M-B "Personas that don't lie" closed** (the 2026-07-28 intake's first milestone):
  all five DoD boxes proven by live runs — ADR-0161's range-submit criterion, the multi-round quiz
  resume under the ruled recovery policy, the persona-library round-trip (PR #410 / ADR-less pattern
  page), and the second catalog `a2ui-basic` = upstream A2UI Basic v0.9.1 ([ADR-0169](adr/0169-a2ui-basic-catalog-upstream-interop.md),
  ratified) with `catalogId` threaded end-to-end (PR #430). En route: the calendar month-rollover
  date-pin (#403/PR #405) and the ADR-0168/0169 README-row repair.

- **2026-07-18** — [ADR-0143](adr/0143-timeline-item-recursive-nesting-accordion.md) shipped:
  `ui-timeline-item` recursive nesting + shared accordion (TKT-0091, commits `a726a8b`/`fe6fe00`).
- **2026-07-23** — [ADR-0144](adr/0144-pane-tab-content-region-rule-system.md) built: the pane/tab
  content-region rule system — `ui-tabs`' opt-in `fill` posture shipped (CSS-only, `tabs.ts`/
  `tabs.css`) and composes `ui-agent-admin`'s strips; TKT-0093 closed.
- **2026-07-23** — [ADR-0146](adr/0146-live-turn-lifecycle-progress-channel.md) built: the
  live-turn lifecycle progress channel (the transport meta-line) plus the status-stream
  grouping/escalation legs (F5/F6, refined by ADR-0153); TKT-0083 closed. With both stragglers
  done the frozen ticket archive is fully closed.
- **2026-07-23** — the "ratification-lag backlog" item for ADR-0131–0137 verified **moot**: every
  one of those files has carried `accepted` since its shipping session — what actually lagged is
  the README index rows. Repaired the same day the synthesis found it (record hygiene,
  Kim-authorized, no Status cell touched): all seven index rows aligned (six in the first pass,
  the 0134 row — missed by that pass's own row check — in the follow-up that shipped with this
  synthesis) + three contradictory Ratified-by cells corrected.
- **2026-07-23** — the `goals.md`/`CHANGELOG.md` backfill question **decided** (Kim, 2026-07-23):
  historical-only — both stay pure historical ledgers, append-only going forward, never
  backfilled; this roadmap is the one source of "current state" (§1).
- **2026-07-23** — **library emit / publish** (a §4 deferral since G8) resolved: the packages
  publish scoped as `@agent-ui-kit/*` to the live registry, proven by an install-from-registry
  consumer smoke in CI, and the docs site auto-deploys to `ui.nonoun.io` on push to main.
- **2026-07-24** — **GenUI B1 shipped** (§3's named next slice at the last pass): `ui-sandbox-frame`,
  the fail-closed GenUI containment host, landed in components with its doc + demo pages, followed
  the same day by the recorded `gen-ui-live` chat demo.
- **2026-07-25** — **GenUI B2 shipped**, closing the arc's buildable slices (B0–B2): the canonical
  wire reader/writer at `@agent-ui/a2ui/agent`, `produce()`'s genui-line peel with `GENUI_*`
  failure codes on the turn trace, the three pattern-source packs + degradation-safe prompt block
  (SPEC-R9 — its prompt-loading parenthetical corrected by the SPEC's docs-only v0.3 amendment),
  the admin Surface-Options GenUI row gone live, and the parallel mount path into agent-admin's
  real turn loop. The GenUI entry retires from §3 into §2's current state; B3 stays deferred (§4).
- **2026-07-28** — **the next-arc intake ran and ruled** (closing §3's "the next feature arc is
  Kim's call at the next intake"): the six-system inventory wave + three-milestone synthesis
  ([`reports/roadmap-wave-2026-07-28/`](reports/roadmap-wave-2026-07-28/)); Kim ruled M-B
  ("Personas that don't lie") → M-C ("GenUI speaks fleet") with M-A's ("SaaS Data Workbench")
  two design forks intaken in parallel during M-B, `ui-table`'s display-only contract to be
  widened by its own `proposed` ADR, and a per-control catalog intake for the five uncataloged
  controls. §3 carries the arc; `goals.md` carries the M-B/M-C DoD entries.
- **2026-07-26** — **the `ui-app-shell` removal gate closed** (§3's last named open item): the
  folder + exports retired (merge `9db4596`), ADR-0082/0083/0084 flipped `superseded` by Kim's
  own owner-reserved Status-cell edit (`8261636` — `adr_ratify.py` covers `proposed`→`accepted`
  only, no script path exists for `accepted`→`superseded`), their clause-5 forward pointers
  landing via `f0debd6`, and the CLAUDE.md/README/getting-started rows updated — ADR-0156
  clauses 4–5's full surface. §2's shell-system entry now reads removed, not deprecated.
