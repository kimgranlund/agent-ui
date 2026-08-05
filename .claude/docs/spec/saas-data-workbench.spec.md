# SPEC — SaaS Data Workbench (M-A)

> Status: accepted · v0.1 · 2026-08-05 · Layer: SPEC (execution contract)
> Refines: [`saas-data-workbench.prd.md`](../prd/saas-data-workbench.prd.md) (v0.2, ratified by Kim
> 2026-07-31) — this document turns PRD-G1–G6 and the §7 MA-1…MA-4 sequencing into testable clauses,
> and rules the three forks the PRD delegated (**PRD-D4/D5/D6**, §3 below). PRD-D1–D3 and PRD-D7 are
> already ruled by Kim; they are cited here, never re-opened. Composes on the two ratified gating
> records — [ADR-0163](../adr/0163-ui-table-interactive-widening.md) (the `ui-table` widening) and
> [ADR-0164](../adr/0164-entry-list-extraction-home.md) (the entry-list extraction home) — cited by
> clause, never re-litigated. Build plan: the PRD's own decomposition manifest
> [`ma-data-workbench.decomp.json`](../decompositions/ma-data-workbench.decomp.json) (both planes,
> `coverage_check.py --strict` exit 0); this SPEC is that manifest's **t19** and the gate on its
> t19→t12 edge ("the composition build is dispatched from a fixed behaviour contract").
> Altitude: owns the four workbench parts' **behaviour contract at every boundary** plus the three
> fork rulings. Why/what is the PRD's; implementation belongs to the build slices — **no LLD is
> owed** (PRD §9: MA-3 is a site page composed from shipped primitives; MA-1/MA-2 build from their
> ADRs' Repairs rows + the manifest). Requirement IDs file-scoped (`SPEC-R#` / `SPEC-N#`); every id
> traces to a PRD-G id (§6, the clause map).
> The §3 rulings are **recommendations for Kim's confirmation at this SPEC's ratification** — each
> carries its alternatives on record; nothing here self-ratifies.

---

## 1 · Purpose

Fix the behaviour contract for M-A's flagship composition — one site-hosted workbench page where a
user sorts, narrows, selects and pages through a data table, opens and edits a record through the
form spine, and reads an agent-written summary of the current view — plus the component, mechanism
and pattern tiers underneath it, so that MA-3's composition seat is dispatched from settled contract
rather than from the PRD's outcome prose.

## 2 · Definitions

- **The four parts** — data table · filter toolbar · record-edit flow · agent summary card, composed
  inside `ui-workspace-shell` (PRD §5's ruled inventory; the frame and the data are substrate, not
  parts).
- **Matching set** — ADR-0163 cl.7's term, adopted verbatim: the rendered set after BOTH narrowing
  stages (facet `filter` AND `search`); with neither active it is the whole rendered set. Select-all,
  the header checkbox's state, and `pageCount` are all computed against this one universe.
- **View state / view key** — the tuple of table state the summary describes: `filter` + `search` +
  `sort` + `page` (+ the selection count). A **view key** is its serialized identity, the key a
  recorded summary is stored under and the key a probe asserts against.
- **The fixture** — the seeded in-repo dataset module (PRD-D2, ratified): the workbench's only data
  source. All record fields scalar (SPEC-N4).
- **Recorded summary** — a committed, validator-passing A2UI JSONL payload keyed to one view key
  (§3, PRD-D5 ruling).
- **The published seam (summary)** — `ui-surface-host`'s own public surface: the
  `ingest`/`finalize`/`dispose` methods + `onClientMessage` registration its descriptor documents
  (`packages/agent-ui/app/src/controls/surface-host/surface-host.md`; the element "owns **only** the
  mount + stream seam — it never calls a transport", ADR-0129 cl.1).

## 3 · Rulings — the three PRD-delegated forks (proposed; Kim confirms at ratification)

### PRD-D4 — the agent-summary mechanism → **candidate (a): an A2UI payload rendered by `ui-surface-host` into catalog `Card`/`Text`/`Stat` rows**

The PRD names exactly two shipped candidates (PRD §6, D4): **(a)** an A2UI payload rendered by
`ui-surface-host` into catalog `Card`/`Text`/`Stat` rows — catalog-bounded, reusing the ratified
renderer seam; **(b)** host-side prose through `ui-markdown` (`@agent-ui/code`) — simpler, but
catalog-invisible by construction, since `a2ui` never imports `code`
([ADR-0119](../adr/0119-code-prose-family-v1-scope.md)). No third mechanism exists or is minted.

**Recommendation: (a).** Rationale, from mechanics:

1. **It is the seam PRD-G4's own acceptance names.** PRD-G4 requires "no renderer or transport
   wiring beyond the published seam ruled in PRD-D4 — reviewed against the page's imports."
   `ui-surface-host` IS the published mount/stream seam: a public `@agent-ui/app` element whose
   whole API is `ingest(jsonlLine)`/`finalize()`/`dispose()` + `onClientMessage`, standalone-usable
   with "no conditional behaviour keyed on ancestry" (its descriptor's SPEC-R3 note), and
   structurally incapable of bespoke transport wiring — "there is no transport/provider-shaped prop
   anywhere on this element's public surface" (its descriptor's SPEC-R8 note, `surface-host.md`);
   the ruling behind it is [ADR-0129](../adr/0129-app-surfaces-m2-composition-and-transport-boundary.md)
   cl.1, which fixes that the element "exposes no transport/provider-shaped type".
   The page's summary wiring reduces to: look up the current view key's payload, `ingest` its lines,
   `finalize`.
2. **Catalog reachability is load-bearing, not decorative.** The PRD's C3 constraint is the
   CSS-less-consumer law ([ADR-0102](../adr/0102-css-less-consumer-contract-law.md)): a capability
   needing consumer glue effectively doesn't exist for the catalog's primary consumer. Candidate (a)
   proves the exact lane that consumer uses — agent-emitted catalog rows through the shipped
   renderer — so what the workbench demonstrates transfers; candidate (b) proves a lane
   (`ui-markdown` prose) that is catalog-invisible by construction, so the demo's fourth part would
   teach a mechanism the primary consumer can never reach. PRD §2 names that consumer explicitly:
   an agent producing payloads against the catalog that, after MA-1, can express the widened table
   for the first time (ADR-0163 cl.9) — mechanism (a) exercises the same lane.
3. **The honest cost, stated:** the fixture must carry real, validator-passing A2UI JSONL rather
   than a prose string — more authoring effort than (b)'s one `markdown` prop. That cost is the
   proof value: PRD §1 rules the page is the *proof*, not the product.

**Alternative on record — (b), `ui-markdown` prose:** genuinely simpler (one string prop, real
sanitized fleet DOM), and legal for a site page (PRD C2: the page lives in `site/` and may compose
across packages that may not import each other). Rejected because it converts PRD-G4 from "the
fleet has a settled agent-writes-into-a-display-card contract" (inv-6 §4's named gap) into "this
one page renders agent prose" — the contract stays unsettled for the catalog consumer, which is the
user the goal exists for. Per PRD-G4's third acceptance line, the shipped surface uses candidate
(a) and the review records it.

### PRD-D5 — live vs. recorded summary → **recorded**

**Recommendation: recorded.** The summary payloads are committed fixtures — validator-passing A2UI
JSONL keyed by view key — replayed through the §2 published seam. No live turn runs on the page.

Rationale, from mechanics:

1. **A ratified fence already decides the default.** PRD-D2 (ratified, not re-openable here) rules:
   "a page probe asserts **zero network requests at runtime**", because "the moment a fetch layer
   appears, the demo is testing the network instead of the fleet" (PRD §4). A live summary IS a
   network request at runtime. A live ruling would therefore need a dev-only overlay the gates never
   exercise — precedent exists (`ui-agent-admin`'s real turn loop behind the dev proxy), but it buys
   this page nothing new: the live seam is already proven there, while the recorded backbone is what
   the deterministic, offline gates (PRD-G6) can actually judge. `gen-ui-live` is the deliberate
   recorded-only precedent the PRD cites for exactly this shape.
2. **The PRD's fixture predicate holds — quoted verbatim, satisfied directly.** PRD-G4's first
   acceptance line reads:
   > The summary is **keyed to view state, provably**: the fixture carries **≥ 2 recorded summaries
   > keyed to distinct view states**, and a probe drives the view from one key to the other and
   > asserts the rendered summary matches the **current** key. *(Under a live ruling of PRD-D5 the
   > same predicate holds against the live response's key; the assertion does not change shape.)*
   Under this ruling the predicate is satisfied in its primary form: the fixture commits ≥ 2
   summary payloads under distinct view keys, and SPEC-R9's probe drives the view from one key to
   the other, asserting the rendered summary matches the current key against the committed
   transcript. And the ruling deliberately preserves the predicate's other arm: SPEC-R9 is written
   against "the rendered summary matches the current view key" with no reference to where the lines
   came from — if Kim rules live at ratification (or a live overlay is ever added), the same
   assertion holds against the live response's key, unchanged in shape. The published
   `@agent-ui/a2ui/agent` replay backbone documents this parity as its own contract:
   `createRecordedTransport` "implements the same `AgentTransport` seam the live overlay does, so
   the page is identical either way" (`recorded-transport.ts`'s own module-header contract, in the
   pack [ADR-0137](../adr/0137-a2ui-agent-producer-toolkit-export.md) exports).
   Recording now forecloses nothing; a later live overlay is a transport swap, not a redesign.

**Alternative on record — live:** proves the producer seam end-to-end on this surface and makes the
summary genuinely responsive to arbitrary view states. Rejected for this wave because it either
breaches the ratified zero-network predicate or ships as an ungated dev overlay; its proof value is
already carried by agent-admin's live loop; and the recorded fixture is what keeps PRD-G4 checkable
by exit code (PRD §3's own law: gates judged by exit codes).

### PRD-D6 — the record-edit vehicle → **`ui-modal`**

Both candidates ship; the choice is argued from their real descriptors
(`packages/agent-ui/app/src/controls/master-detail/master-detail.md`,
`packages/agent-ui/components/src/controls/modal/modal.md`), per PRD §5's "no primitive is missing —
purely a composition choice."

**Recommendation: `ui-modal`.** Rationale, from the descriptors:

1. **The list side already exists — it is the workbench's own table.** `ui-master-detail` supplies a
   second resizable split whose master pane would demote the table into a fraction of the content
   region. The table owns its own scroll region and a `--ui-table-min-inline-size` floor
   (`table.md` geometry), and after MA-1 adds a pagination footer; a permanently docked detail pane
   taxes exactly the inline axis the table needs — inside a shell content region assumption A1
   already flags as untested ("content = data table + toolbar", PRD §8).
2. **The drill-in threshold fights the shell.** `ui-master-detail` collapses to ONE pane below
   `40rem` of its **own container** width (`master-detail.md` geometry, `narrowThreshold`). Inside
   `ui-workspace-shell`, whose rails and panes narrow the content region, the workbench would
   routinely cross that line — hiding the table behind the edit view exactly when PRD-G3's probe
   wants "opening and saving a record updates the **visible** row."
3. **`ui-master-detail` expects list content this page cannot legally author.** Its contract:
   "the **consumer's** own list content sets `.selected = key` (a click handler…)" — it "has no
   item-picking UI" of its own. The workbench's list is the stamped `ui-table`: rows are never
   focusable, and interactive anatomy is fenced to selection cells, sort header buttons and the
   pagination footer (ADR-0163 cl.3; cl.1 keeps interactive chips/editable cells fenced). Wiring
   row-click handlers into control-owned stamped anatomy is not a published seam and has no
   keyboard path — the vehicle's own driving convention is unavailable here.
4. **`ui-modal` delivers the edit lifecycle from the platform.** Top-layer stacking, `::backdrop`,
   focus containment, Escape-dismiss, and focus **restore** to the opener
   ([ADR-0017](../adr/0017-native-dialog-modal.md); `modal.md` keyboard contract) — the bounded
   open→edit→save/close shape a draft/commit form wants, with `ui-form-provider`/`ui-field`
   validation working unchanged inside the dialog. Its host is `display: contents` and the dialog
   renders in the top layer: the vehicle contributes **zero layout** to the page, so PRD-G3's
   sheet fence (no shell/layout frame rules) and the AC19 membership (PRD-D7) stay trivially clean.
5. **Honest costs, stated:** while the dialog is open the table is obscured (top layer) — the
   "updates the visible row" assertion runs after save/close, which SPEC-R8 encodes; and default
   light-dismiss (Escape/backdrop) discards typed input — `persistent` exists on the descriptor if
   the build wants to block backdrop dismissal, a build-time choice this SPEC deliberately leaves
   open (SPEC-R8 requires only that dismissal-without-save never mutates the store).

**Alternative on record — `ui-master-detail`:** keeps list and form simultaneously visible and
resizable, and is the PRD §1 problem-statement image ("a table … next to a form that edits one of
them"). Right when the list is consumer-authored content — its descriptor's own usage — wrong here
on mechanics 1–3 above. The PRD also notes the extracted `mountEntryList` loop as "a third shape
for the list side"; it is not a fork member (ADR-0164 cl.3 froze it as a mount-function mechanism,
not an edit-surface vehicle), and its machinery is reused on the store/validation side regardless
(SPEC-R8, the manifest's t10→t14 edge).

## 4 · Requirements (SPEC-R)

Every acceptance line is a checkable predicate; gates are judged by **exit codes**, never by reading
output (the PRD §3 law, repo-standing).

- **SPEC-R1 — The widened table exercises all four capabilities** *(serves PRD-G1 · mechanism
  ADR-0163 cl.2/3/4/5/7)*. With every capability enabled on the workbench's fixture data, one
  cross-engine probe (Chromium AND WebKit) shows: activating a sortable header cycles
  ascending→descending and reorders rows, with `aria-sort` on exactly one `<th>` (cl.5); select-all
  under an active filter checks exactly the **matching set** and reads indeterminate when partial
  (cl.4/cl.7); `page-size=10` over 25 rows renders 10 `<tr>` plus a footer navigator reading 3 pages
  (cl.6); the host table's computed role is still `table` throughout (cl.3, the correctness crux).
  The view pipeline order is normative: filter → search → sort → page window (cl.7); selection is
  held against the whole rendered set and survives filter/sort/page changes by construction (cl.7).
- **SPEC-R2 — Byte-identity at defaults** *(serves PRD-G1 · ADR-0163 cl.10)*. With `selectable=''`,
  no `sortable` column, `page-size=0`, `search=''`, `filter=[]`, the committed byte-identity probe
  asserts serialized-DOM equality against the pre-widening baseline — exit 0. The baseline is
  captured from the pre-widening DOM before the first widening diff (the manifest's t6→t1 edge).
- **SPEC-R3 — `ui-pagination` stands alone** *(serves PRD-G1, PRD-G6 · ADR-0163 cl.6)*. The minted
  control mounts standalone with no table present; `pages < 2` renders nothing (the honest empty
  state); the active stop carries `aria-current="page"`; the host announces as a labelled
  `navigation`; its `pagination.md` descriptor↔props trip-wire is green.
- **SPEC-R4 — The catalog expresses the widened table** *(serves PRD-G1, PRD-G4's consumer ·
  ADR-0163 cl.9)*. The `Table` row carries the three-slot multi-slot value mark
  (`selected/select`, `sort/change`, `page/change`) with `search`/`filter` bindable one-way in; a
  `Pagination` row exists with `FEED_EXCLUDED` disposition; catalog gates exit 0 with the feed
  partition total.
- **SPEC-R5 — The entry-list machinery is consumable AND styled outside `ui-agent-admin`**
  *(serves PRD-G2 · ADR-0164 cl.1/2/4/7)*. A standalone smoke test mounts a section from
  `@agent-ui/app/entry-list` + `./entry-list.css` with `createMemoryStore` and stub handlers,
  asserting `ui-agent-admin` appears nowhere in the tree AND the section's `[data-part]` anatomy
  carries non-default computed styles (the "styled" half, cl.4's genuinely new construction).
  `npm run check` exits 0 with all three subpaths (`./entry-list`, `./entry-list.css`,
  `./entry-data`) resolving, every pre-existing `@agent-ui/app` import site compiling unchanged,
  and no root-barrel export name renamed (cl.1/cl.2). agent-admin's existing jsdom, browser and
  visual suites pass **unchanged** — the gate on the `@scope` proximity risk cl.4 names; agent-admin
  consumes the extraction with no second copy (cl.7).
- **SPEC-R6 — The four parts compose with zero bespoke chrome** *(serves PRD-G3)*. The page renders
  inside `ui-workspace-shell`; its own stylesheet declares no shell/layout frame rules (SPEC-N6).
  One probe exercises all four parts interoperating: a toolbar filter narrows the table → a sort
  reorders the narrowed set → a selection **survives** the filter change (ADR-0163 cl.7's
  view-independent selection identity) → opening and saving a record updates the visible row.
  Assumption A1 (`ui-workspace-shell` hosts a "content = data table + toolbar" region with no new
  shell work) is re-verified as MA-3's first act, before the composition build commits (PRD §8).
- **SPEC-R7 — The toolbar drives the table's own state, never its data** *(serves PRD-G3, PRD-G1 ·
  ADR-0163 cl.2 · PRD-D3, ratified)*. Search rides a `ui-text-field` bound to the table's `search`
  prop; facets ride `ui-form-popover` + a check group in its panel, the page aggregating the checked
  set into one `{ key, values[] }` `filter` entry, with the popover's `label` carrying the summary
  state (the ratified PRD-D3 vehicle — not re-opened here). The toolbar never reassigns the table's
  `rows` prop: asserted by the bound array's identity being unchanged across a filter interaction.
  The toolbar shows a **visible results count** (the taught mitigation for ADR-0163 cl.2's recorded
  zero-result silence — no `aria-live` region is built; that stays the named foreseen extension).
- **SPEC-R8 — The record-edit flow: list → open → validate → save** *(serves PRD-G3 · PRD-D6 ruling
  §3 · ADR-0164 cl.3)*. The edit surface is a `ui-modal` hosting the form spine
  (`ui-form-provider` + `ui-field` + FACE controls) over the current record's scalar fields.
  Acceptance: (a) the open affordance is a real, keyboard-focusable control **outside** the table's
  stamped anatomy (SPEC-N8 — it neither rides fenced interactive cells, ADR-0163 cl.1, nor appears
  contextually on selection, PRD §4); (b) with an invalid value entered, save is blocked with a
  field-level error and the store is not written; (c) a valid save writes the in-session store, the
  modal closes, focus restores to the opener (`modal.md`'s ADR-0017 cl.4 contract), and the
  corresponding visible table row shows the new value; (d) dismissal without save (Escape/backdrop)
  mutates nothing. The flow's store/validation machinery is imported from the extracted public
  subpaths (ADR-0164 cl.3's frozen contract / the `createMemoryStore` precedent), never re-typed —
  the manifest's t10→t14 edge.
- **SPEC-R9 — The agent summary is keyed to view state, provably** *(serves PRD-G4 · PRD-D4/D5
  rulings §3)*. The summary card is a `ui-surface-host` region rendering committed, validator-passing
  A2UI payloads of catalog `Card`/`Text`/`Stat` rows. The fixture carries ≥ 2 recorded summaries
  keyed to distinct view states; a probe drives the view from one key to the other and asserts the
  rendered summary matches the **current** key — the assertion names the view key only, never the
  transport, so it holds unchanged under any later live overlay (the PRD's own shape-invariance
  note, quoted in §3). The page module contains no renderer or transport wiring beyond the §2
  published seam — reviewed against the page's imports, which name only published surfaces. No
  third mechanism is minted; the review records candidate (a) as the shipped one.
- **SPEC-R10 — The data is a seeded fixture with in-session persistence** *(serves PRD-G3/PRD-G4's
  substrate · PRD-D2, ratified)*. The fixture is an in-repo module that type-checks; every record
  field is scalar (SPEC-N4); a page probe asserts zero network requests at runtime; edits are real,
  observable, and gone on reload — stated visibly on the page (the honest-cost label PRD-D2
  requires).
- **SPEC-R11 — The S9 exemplar-path gate exists before the rows that depend on it** *(serves
  PRD-G5)*. `site/lib/docs-grammar.test.ts` gains S9: walking `.claude/skills/*/SKILL.md`,
  extracting backticked repo-relative paths from each table's Owner·exemplar column, `existsSync`-ing
  each — proven RED on a planted bogus exemplar path and GREEN on revert, with the pre-existing
  20-path exemplar corpus passing. (S9 is a real build item: the pre-existing S3 sweep walks
  `.claude/docs` only and blanks backticked text by construction, GH #321 — it cannot fire here.)
- **SPEC-R12 — Four pattern rows, each S9-swept** *(serves PRD-G5 · ADR-0164 cl.5)*.
  `agent-ui-composition-patterns` carries four new rows: the data-table toolbar, the record-CRUD
  loop, the schema-driven settings page, and the resource-list manager (the last two are ADR-0164
  cl.5's, ratified and owed already). Each row names an owner ADR id and an in-repo exemplar path
  that resolves under S9 — cl.5's bare-filename shorthands ("`agent-admin.ts`'s `settingsItem`",
  "`#makeSection`") are expanded to full repo-relative paths at authoring time, member names kept
  as prose beside them (the PRD-G5 constraint). Each exemplar points at the shipped workbench page
  or at agent-admin, never a scratch file; each row's answer column names the **mechanism** (the
  props/seam a reader wires), not just a tag.
- **SPEC-R13 — Fleet DoD, layering and budgets hold** *(serves PRD-G6)*. At each milestone close,
  `npm run check && npm test` exit 0 and all six browser shards exit 0, judged by exit codes. The
  per-package `layering.test.ts` trip-wires stay green — in particular `a2ui` never imports `app`,
  and `app` never imports `router` ([ADR-0115](../adr/0115-spa-router-v1-scope.md)). `npm run size`
  carries line-items for the `components` marginal (table + `ui-pagination`) and for `app` (the
  `entry-list/` folder), each within budget or with a re-base recorded and argued in the wave's own
  record (ADR-0163 Consequences pre-records the likely family-ceiling re-base). `ui-pagination`
  ships its descriptor and passes the descriptor↔props trip-wire.
- **SPEC-R14 — The two AC19 sheet-set appends land, reviewed** *(serves PRD-G3/PRD-G6 · PRD-D7,
  ratified · ADR-0164 cl.4)*. `entry-list.css` joins the
  [shell-archetypes SPEC](./shell-archetypes-m5.spec.md) AC19 spacing-drift gate's sheet set at
  MA-2 (ADR-0164 cl.4's own one-line append), and the workbench page's sheet joins at MA-3 per
  PRD-D7's ratified ruling — each as AC19's own extension mechanism prescribes: "extending the set
  is a one-line reviewed append (the `FOCUS_TIMING_FILES` precedent, GH #56)" — never automatic
  (the [roadmap's](../roadmap.md) per-sheet law). Acceptance: the gate is green with both sheets in
  its set, exit 0.

## 5 · Constraints and non-requirements (SPEC-N)

The PRD §4 fences, carried into contract form. The six load-bearing ones are quoted verbatim —
"a fence with no reason is a fence that moves," and a fence re-worded is a fence half-moved.

- **SPEC-N1 — No fetch layer** *(PRD §4, verbatim)*: "**No data-fetching, transport or backend
  layer.** The workbench's rows come from a **seeded, in-repo fixture module**; a page probe asserts
  zero network requests at runtime (PRD-D2)." Enforced by SPEC-R10's probe and SPEC-R9's
  imports review.
- **SPEC-N2 — In-session persistence only** *(PRD §4, verbatim)*: "**Persistence is in-session
  only.** Edits are real, observable and **gone on reload** — the `createMemoryStore` precedent,
  stated visibly on the page. No backend, no `localStorage` contract, no sync (PRD-D2)."
- **SPEC-N3 — No new multi-select control** *(PRD §4, verbatim)*: "**No new multi-select control.**
  The facet affordance composes from shipped controls (PRD-D3)." The fence is inherited from
  ADR-0163 cl.1, not minted here; PRD-D3's vehicle (`ui-form-popover` + check group) is ratified
  and SPEC-R7 realizes it. The recorded residual stands: the N-commits→one-`filter`-entry
  aggregation is page-side glue; closing it for the CSS-less consumer is its own future intake
  (PRD-D3's honest residual, carried not buried).
- **SPEC-N4 — Scalar fixture fields only** *(PRD §4, verbatim)*: "**No association / relationship
  editing, and the fixture's record fields stay scalar.** No 'assign dataset to account', no
  to-many linking field on any workbench record." This is what keeps SPEC-N3 coherent rather than
  convenient (PRD §5's non-gap analysis): no workbench record ever needs the multi-select field the
  FACE suite lacks.
- **SPEC-N5 — The workbench frame is never agent-emittable** *(PRD §4, verbatim)*: "**The workbench
  frame is never agent-emittable.** The agent writes into **one region**; the chrome is
  host-authored (the [`agent-app-surfaces.prd.md`](../prd/agent-app-surfaces.prd.md) PRD-D2
  boundary)." Under the §3 PRD-D4 ruling, that one region is the SPEC-R9 `ui-surface-host` mount —
  the agent's payload composes catalog rows *inside* it and nothing outside it.
- **SPEC-N6 — The page sheet declares no shell-frame rules; AC19 membership is D7's, not assumed.**
  PRD-G3's fence verbatim: "its own stylesheet declares no shell/layout frame rules (no frame
  grid/flex, no rail or pane sizing) — reviewed against the sheet." Membership in the AC19 gate's
  set was a separate ruling precisely because the roadmap rules AC19 extension "an open, per-sheet
  decision… never automatic" — PRD-D7 ruled it YES (ratified), realized as SPEC-R14's reviewed
  append.
- **SPEC-N7 — The ADR-0163 cl.1 fence line bounds the whole wave** *(PRD §4/C5)*. Filter
  **operators** beyond the facet shape (ranges, comparisons, per-cell expressions), an in-table
  query input, column resizing, cell renderers, interactive chips and editable cells stay fenced —
  each re-enters only by its own record. No virtualization and no row-cap change: pagination is
  this wave's answer to scale; the report-family SPEC's no-virtualization posture stands verbatim
  (ADR-0163 cl.10).
- **SPEC-N8 — Selection is read out, never acted on** *(PRD §4)*. Verbatim: "Selection is **read
  out** (`selected` / the `select` event, and the summary card may describe it) — it is never
  **acted on**: no 'delete selected', no batch edit, no contextual action bar appearing on
  selection." Consequence for SPEC-R8: the record-open affordance is persistent page anatomy, not
  selection-contextual, and never consumes the multi-select set; the summary card may describe the
  selection count (read-out, sanctioned).
- **SPEC-N9 — The remaining PRD §4 fences hold unrestated**: no new charts
  ([ADR-0107](../adr/0107-chart-family-v1-scope.md) stands); no router on the page — section
  switching is local state, `app` never imports `router` (ADR-0115); no production SaaS application
  (primitives, a mechanism, recipes, one proof page); no `ui-agent-admin` redesign — it renders
  byte-equivalently as the extraction's first consumer and no second copy of the machinery may
  appear (ADR-0164 cl.7).
- **SPEC-N10 — Sequencing is the manifest's edge set, binding on dispatch** *(PRD §7)*. MA-1 and
  MA-2 are fully independent and start in parallel (disjoint file sets). MA-3 is dispatched only
  after BOTH builds land AND this SPEC exists (the t19→t12 edge) — with one early exception: the
  seeded fixture (SPEC-R10) has no build dependency and may be authored during MA-1/MA-2. MA-4
  trails MA-3's toolbar and record slices — except ADR-0164 cl.5's two rows, which ship **with**
  MA-2, already owed by a ratified record. S9 (SPEC-R11) is edge-free but must exist before any
  MA-4 row is accepted against it (the t20→t16/t17 edges). If the wave is cut short, PRD-G5's rows
  are the last thing cut, not the first (PRD risk R4 — the `a2ui-live` failure, not repeated).

## 6 · Clause map (SPEC id → PRD-G / PRD-D → ADR clauses cited)

| SPEC id | Serves | ADR clauses load-bearing |
|---|---|---|
| SPEC-R1 | PRD-G1 | ADR-0163 cl.2, cl.3, cl.4, cl.5, cl.6, cl.7 |
| SPEC-R2 | PRD-G1 | ADR-0163 cl.10 |
| SPEC-R3 | PRD-G1, PRD-G6 | ADR-0163 cl.6 |
| SPEC-R4 | PRD-G1, PRD-G4 (consumer) | ADR-0163 cl.9 |
| SPEC-R5 | PRD-G2 | ADR-0164 cl.1, cl.2, cl.4, cl.7 |
| SPEC-R6 | PRD-G3 | ADR-0163 cl.7 (selection survival) |
| SPEC-R7 | PRD-G3, PRD-G1 · PRD-D3 (ratified) | ADR-0163 cl.2 (state props + zero-result residual) |
| SPEC-R8 | PRD-G3 · PRD-D6 (§3 ruling) | ADR-0163 cl.1/cl.3 (affordance fence) · ADR-0164 cl.3 |
| SPEC-R9 | PRD-G4 · PRD-D4/D5 (§3 rulings) | — (seam: ADR-0129 cl.1, ADR-0137) |
| SPEC-R10 | PRD-G3, PRD-G4 · PRD-D2 (ratified) | — |
| SPEC-R11 | PRD-G5 | — |
| SPEC-R12 | PRD-G5 | ADR-0164 cl.5 |
| SPEC-R13 | PRD-G6 | ADR-0163 Consequences (size re-base) |
| SPEC-R14 | PRD-G3, PRD-G6 · PRD-D7 (ratified) | ADR-0164 cl.4 |
| SPEC-N1 | PRD §4 · PRD-D2 | — |
| SPEC-N2 | PRD §4 · PRD-D2 | — |
| SPEC-N3 | PRD §4 · PRD-D3 | ADR-0163 cl.1 (inherited fence) |
| SPEC-N4 | PRD §4 | — |
| SPEC-N5 | PRD §4 | — |
| SPEC-N6 | PRD-G3 · PRD-D7 | — |
| SPEC-N7 | PRD §4 / C5 | ADR-0163 cl.1, cl.10 |
| SPEC-N8 | PRD §4 | ADR-0163 cl.4/cl.8 (selection as read-out state) |
| SPEC-N9 | PRD §4 | ADR-0164 cl.7 |
| SPEC-N10 | PRD §7 | — |

## 7 · Acceptance for this document

This SPEC ships `proposed`; Kim confirms the three §3 rulings at ratification (the rulings are
recommendations, alternatives on record — nothing here self-flips). Document gates:
`site/lib/docs-grammar.test.ts` (status keyword + the relative-link sweep) exit 0 inside
`npm run check`'s `check:site` step. Downstream, the manifest's t19 acceptance is discharged the
same way: "a SPEC exists whose SPEC-R ids each trace to a PRD-G id and which passes
`site/lib/docs-grammar.test.ts` (exit 0)" — §6 is that trace.
