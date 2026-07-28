# Synthesis — candidate milestones (2026-07-28)

Three genuinely different strategic bets. Each = ONE user-visible outcome, increments from ≥3
systems, seam contracts frozen first, explicit exclusions, phases, dogfood acceptance.
In-flight designed work absorbed: ADR-0161 → M-B; ADR-0162 S0-S5 → M-C.

---

## M-A · "SaaS Data Workbench" — the fleet earns its data-app stripes

**Outcome:** a site-hosted demo workspace (accounts-or-datasets domain) where a user browses a
sortable/selectable/paginated data table with a search+filter toolbar, opens a record, edits it
through the form spine, and reads an agent-written summary card — all composed from published
fleet primitives inside `ui-workspace-shell`.

**Per-system increments**
- components: the ui-table interaction fork ruled + built (inv-4 §3.1 / inv-6 §3.5/7 — selection,
  header sort); `ui-pagination` (inv-6 §3.4, smallest net-new primitive); the filter-bar recipe
  is pattern-tier over existing controls (inv-6 §3.3 — no new component).
- SaaS patterns: extract entry-list + `ui-settings` generate.ts into a shared home (inv-6 §4/§5);
  the generic CRUD recipe (inv-6 §3.1); the dashboard-page demo composing stat+chart+table+agent
  panel (inv-6 §3.2 — "the dogfood pick").
- shells: prove the workspace-shell "content = data table + toolbar" region convention (inv-6 §4
  names it untested); optionally the command-palette gap (inv-5 §3.1) as a stretch.
- a2ui/agent: the "agent writes into a display card" contract (payload → ui-stat/ui-markdown),
  currently ad hoc (inv-6 §4).

**Seam contracts to freeze first**
1. ui-table interaction: extend the existing control vs mint `ui-data-table` — one ADR, Kim rules
   (decision sheet Q2).
2. Extraction home for entry-list/settings-generator: which package + export surface (likely
   `@agent-ui/components` or a new patterns location — design intake names it).
3. Agent→display-card: the payload shape an agent emits for a summary panel (a2ui provider →
   SaaS consumer, one line in the composition-patterns skill).
4. Shell content-region convention for table+toolbar (shells provider → SaaS consumer).

**Excludes:** line/area/pie charts (unless Kim re-rules ADR-0107 — Q4), tree control, file
upload, association/multi-select linking UI, tab deep-linking via router.

**Phases:** P1 contracts + primitives (table fork ADR, ui-pagination, extraction) → P2 recipes
(CRUD, filter-bar, settings-page rows in composition-patterns) → P3 the demo pages (dashboard +
CRUD flow) proving it end-to-end.

**Dogfood acceptance:** the CRUD demo page (inv-6 §3.8) is the consumer that proves table
interaction, pagination, the extracted entry-list, and the shell region convention in one flow.

---

## M-B · "Personas that don't lie" — the live-agent product loop made trustworthy

**Outcome:** the two flagship persona classes complete flawless live runs — Hotel Concierge books
a real date range the model sees (GH #314), quiz/game personas survive full multi-round IDGRAPH
sessions (GH #307) — and an admin-authored persona can be exported, shared, and re-imported.

**Per-system increments**
- a2ui: ship ADR-0161 as specced (its Repairs cell IS the build list: catalog.ts/types.ts/
  input.ts/factories.ts/catalog.json + tests — inv-2 §3.1); root-cause #307 via the live
  produce() method (inv-2 §3.2) then rule the round-budget/recovery policy (inv-2 §3.5);
  corpus growth pass past the 1-exemplar floor (inv-2 §3.3).
- components: the ADR-0161 factory/row edits (near-zero blast radius, inv-4 §2); GH #315's
  range-band cosmetic fix rides the same Calendar attention.
- agent-admin: persona export/import (inv-1 §3.7 — invents the persona-template pattern inv-1 §4
  says doesn't exist yet); activate the catalog picker with a second real catalog + thread
  `catalogId` (inv-1 §3.4/6) — the picker stops being inert.
- SaaS patterns: the persona-library pattern (save/export/import of a named config) becomes the
  first documented "preset library" row — reusable beyond agent-admin.

**Seam contracts to freeze first**
1. ADR-0161's `ValueSlot[]` union — ratification is the freeze (contract text already written).
2. #307's resume semantics: what `sessionSurfaceSeeds` must guarantee on the action-click resume
   path (a2ui provider → agent-admin consumer) — root-cause BEFORE ruling, per inv-2's warning.
3. Persona export format (agent-admin provider → SaaS pattern consumer): one serialized-config
   schema line.
4. Second-catalog registration shape (what makes a catalog pickable — a2ui → agent-admin).

**Excludes:** the production (non-dev-proxy) live-turn path (inv-1 §3.5 — a real gap, but a
deployment/infra arc of its own); GenUI entirely; any new SaaS component.

**Phases:** P1 repairs (0161 build + #307 root-cause+fix, both bug-anchored) → P2 depth (second
catalog + catalogId, corpus growth) → P3 the persona-library arc (export/import + pattern doc).

**Dogfood acceptance:** the Hotel Concierge live flow proves ADR-0161 (submit snapshot carries
both dates — the ADR's own acceptance); a full IDGRAPH quiz run proves the resume fix; a
round-tripped exported persona proves the library pattern.

---

## M-C · "GenUI speaks fleet" — dogfood authoring end-to-end

**Outcome:** flip the dogfood toggle in agent-admin (or gen-ui-live) and the model authors GenUI
surfaces out of real, upgraded `ui-*` components with fleet tokens — visibly the fleet's own
design language instead of bare model HTML — provable live in one demo session.

**Per-system increments**
- genui/components: ADR-0162's decomp AS WRITTEN — S0 docs → S1 asset pair (`sandbox-frame/
  dogfood/`, committed+freshness-gated) → S2 frame injection + browser probes → S3 prompt segment
  (byte-pinned teaching + drift-gated derived inventory) → S4 surfacing → S5 cross-half set-equal
  gate (inv-3 §2).
- a2ui: `GenuiSurfaceConfig.dogfood` + prompt composition via the a2ui-prompt-author recapture
  flow (inv-2 §3.7's warning: byte-pinned baseline, no ad hoc edits).
- agent-admin: the Surface Options dogfood toggle (S4).
- site: `gen-ui-live` gains the toggle; OPTIONAL stretch — a live-turn GenUI demo surface
  (inv-3 §3.6 names recorded-only as a real gap; today only agent-admin shows GenUI live).
- Follow-through (phase 3, optional): B3's judged pack-idiom eval gains its fleet-idiom
  dimension (inv-3 §3.2, PRD-G6) — the measured floor for "does the model actually use ui-*".

**Seam contracts to freeze first**
1. ADR-0162 ratification — the SPEC v0.5 §11 amendment (SPEC-R12/R13 + the R10 dogfood clause)
   IS the seam contract; everything else is already decomposed.
2. The `assets` prop on `ui-sandbox-frame` (`{css?, js?}` — components provider → genui consumer).
3. The dogfood subpath's export shape (components → a2ui compose-time consumer).
4. Bundle-tags ≡ inventory-tags set-equality (the S5 gate — frame half ↔ prompt half).

**Excludes:** any CSP/sandbox/bridge change (0162 holds posture unchanged); router/code/app
chrome in-frame (ruled out by the ADR); GenUI interactivity beyond the closed 6-member bridge
(PRD §3 non-goal); the naming-collision cleanup (inv-3 §3.7) unless it rides S0's doc pass.

**Phases:** P1 = S0-S2 (assets + frame, browser-provable) → P2 = S3-S5 (prompt + gates +
surfacing) → P3 optional = live gen-ui demo + B3 fleet-idiom eval.

**Dogfood acceptance:** a live agent-admin session with dogfood ON producing a surface whose
rendered DOM contains upgraded `ui-*` elements (real anatomy, not unknown inline elements) —
the ADR's own "docs-page rendering" bar; S5's set-equal gate holds green.

---

## Cross-milestone notes
- M-B and M-C are independent (different files, different ADRs) and each is smaller than M-A;
  either can run while M-A's contract forks are being ruled.
- M-A is the only bet that grows the component fleet; it carries the most design-intake weight
  (table fork, extraction home) and the most net-new code.
- The ratification batch (0160 hygiene + 0161 + 0162) is a prerequisite spanning all three:
  0161→M-B, 0162→M-C, 0160 is record-hygiene for work already merged (inv-5 §2).
- The DEV-only live-path ceiling (spine, cross-cutting #5) caps M-B's and M-C's outcomes at
  dev-session demos; naming it a fourth arc ("production live path") is Kim's call, not assumed.
