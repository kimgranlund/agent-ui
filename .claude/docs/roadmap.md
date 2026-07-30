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
> moment an issue closes and this doc isn't the place re-reading it. Last synthesis pass: 2026-07-28.

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

## 2 · Now — current state (as of 2026-07-29)

> **Arc status, 2026-07-29.** **M-C is DONE** (dogfood mode shipped and dogfood-accepted live).
> **M-A's two forks are frozen** — ADR-0163 and ADR-0164 both ratified, so that build is unblocked and
> its PRD is the next step. **M-B is in flight with no DoD box met**, and its phase 1 is blocked on Kim:
> [#307](https://github.com/kimgranlund/agent-ui/issues/307) needs live error text before the
> round-budget policy can be ruled. §3 carries the per-milestone detail; `goals.md` carries the
> box-by-box evidence.
>
> Three open issues, all deliberate: **#307** (blocked, above), **#359** (Mode-B flake — a test's own
> bounded wait false-settles or exhausts silently under load, so no timeout raise can reach it; split out
> of #347 once #347's own timeout remedy proved it covers only the other mode), **#361** (ADR-0165
> contradicts itself on whether an archived refusal still needs an allowlist entry — a doc-coherence
> repair). **#340** closed with #360, and **#347** closes with the real-timing-headroom PR that carries
> this line. Two open PRs at this sweep (#358, #362); `main` green.

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
- **M-B — "Personas that don't lie" (first). 🟡 IN FLIGHT** — groundwork landed (ADR-0161 built via
  #318; corpus at 24 judged records via #337; two pipeline defects fixed, ADR-0165 ratified), but
  **no DoD box is met** — all four are live-run proofs and none has been run. Phase 1 is **blocked on
  Kim**: [#307](https://github.com/kimgranlund/agent-ui/issues/307) needs the live error text to tell
  an IDGRAPH failure from a PARSE one, and the round-budget/recovery policy cannot be ruled before
  that root cause is known. Per-box status in [`goals.md`](goals.md). Scope:
  The flagship live-agent loop made trustworthy.
  Phase 1 is bug-anchored repairs: build ADR-0161 as specced — the `value` mark widens to one or
  more slots, the root cause behind calendar-range/multi-thumb selections never reaching the
  model (its Repairs cell already enumerates every file) — and root-cause the quiz/game personas'
  round-budget exhaustion on the same-surface resume path via the live `produce()` method
  *before* ruling the round-budget/recovery policy. Phase 2 is depth: a second real catalog plus
  a threaded `catalogId` (the admin's catalog picker stops being one-catalog-by-construction),
  and corpus growth past the one-exemplar floor. Phase 3 is the persona-library arc: persona
  export/import in `ui-agent-admin`, documented as the first reusable preset-library pattern.
  Acceptance is dogfooded: the Hotel Concierge persona books a real date range the model sees, a
  full multi-round IDGRAPH quiz session survives resume, and an exported persona round-trips.
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
- **M-A intakes — "SaaS Data Workbench". 🟢 BOTH FORKS FROZEN 2026-07-29 — the build is unblocked.**
  Both design intakes finished and both ADRs are now **ratified**:
  [ADR-0163](adr/0163-ui-table-interactive-widening.md) (the `ui-table` widening) and
  [ADR-0164](adr/0164-entry-list-extraction-home.md) (the extraction home). Neither build has started.
  **The PRD is written**: [`prd/saas-data-workbench.prd.md`](prd/saas-data-workbench.prd.md)
  (`proposed` v0.1, 2026-07-30) — PRD-G1–G6, the MA-1…MA-4 sequencing, and three decisions awaiting
  Kim's pass (PRD-D1–D3); the build follows it. Scheduling is Kim's: the lane is free now that M-C is
  done, but M-B still holds an unmet DoD. Original framing:
  M-A — a
  site-hosted demo workspace where a sortable/selectable/paginated data table, a filter toolbar,
  a record-edit form flow, and an agent-written summary card compose from published fleet
  primitives inside `ui-workspace-shell` — is the largest bet and is gated on two genuine design
  forks. Both run as design intakes during M-B so the build starts contract-frozen: **(1) the
  `ui-table` widening ADR** — Kim ruled 2026-07-28 to widen the ratified display-only contract
  itself (selection, sort, filter, pagination land on `ui-table`), deliberately against the
  synthesis's separate-interactive-tier recommendation; the intake produces its own `proposed`
  ADR amending the display-only contract — report-family SPEC-R1 under ADR-0111, realized in the
  `table.md` descriptor rows + report-family LLD-C9 (ADR-0004's descriptor-as-contract
  instrument) — a ruled contract change, never a drive-by edit; and
  **(2) the extraction home** for the entry-list + settings-generator proto-patterns (today
  agent-admin-local files) — which package and export surface. M-A's PRD comes out of these
  intakes, not before; the build itself is scheduled when the lane frees.
- **Per-control catalog intake — now.** Five newer controls (`ui-status-stream`, `ui-toast`,
  `ui-command-modal`, `ui-textarea`, `ui-theme-provider`) landed after the A2UI catalog's 56
  types with no recorded in-or-out decision. Kim ruled 2026-07-28: one small per-control pass,
  now — each control ruled **in** (a catalog row) or **out** (the exclusion allowlist), with the
  reason recorded either way, ending the silent drift.
- **AC19's sheet set — widen deliberately, or not.** The spacing-drift gate covers the shell
  family today (every `@agent-ui/app` sheet + the shell-composing site sheets). Whether it extends
  further — components-package sheets, the remaining site sheets — is an open, per-sheet decision;
  the gate's own design makes each extension a one-line reviewed append, never automatic.
- (The older proposed scope intakes — content, feed, and report families, the a2ui expert system —
  remain parked intakes, not scheduled work.)

## 4 · Later — deferred, revisit-triggered

- **Linear, for this repo specifically.** ADR-0145 chose GitHub Issues as the work-item backend
  here. If Linear becomes the standard elsewhere in the user's work, the open question is whether
  this repo follows (and how the ID-spine convention — ADR/SPEC/LLD citing an issue — survives a
  backend swap) — not a live fork today, just the thing that would reopen ADR-0145 if raised.
- **GenUI B3 — the judged pack-idiom eval.** Out of the GenUI SPEC's contract by its own §6 cut:
  PRD §8 m3 (judge-scored pack-idiom use) realized as a judged corpus-rubric shard plus its docs
  page (PRD-G6) — a named manual live-model run, never part of the deterministic gates (SPEC-N3).
  Revisit when the producer's output quality needs a measured floor.

---

*Closed items move here, one dated line each, rather than being deleted from §3 silently:*

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
