# PRD — SaaS Data Workbench (M-A)

> Status: **proposed · v0.1 · 2026-07-30 · Owner: agent-ui** — the PRD the two M-A design intakes were run to make possible ([`../roadmap.md`](../roadmap.md) §3: *"M-A's PRD comes out of these intakes, not before"*). **Not self-approved:** §6 carries three ratifiable recommendations (PRD-D1–D3) and two forks carried to the SPEC (PRD-D4/D5); direction awaits Kim's pass.
> Altitude: owns **why + what-should-exist** for M-A. The two gating forks are already ruled — [ADR-0163](../adr/0163-ui-table-interactive-widening.md) (the `ui-table` widening) and [ADR-0164](../adr/0164-entry-list-extraction-home.md) (the extraction home) — and this document **cites** them; it never re-litigates or restates their reasoning. Behaviour contracts (SPEC) and implementation are downstream (§9).
> Grounding: [`../roadmap.md`](../roadmap.md) §3's M-A block (the ruled scope) · [`../reports/roadmap-wave-2026-07-28/inv-6-saas.md`](../reports/roadmap-wave-2026-07-28/inv-6-saas.md) (the SaaS-pattern gap inventory) · [`../reports/roadmap-wave-2026-07-28/inv-1-agent-admin.md`](../reports/roadmap-wave-2026-07-28/inv-1-agent-admin.md) §5 (agent-admin as provider) · [`../reports/extraction-intake-2026-07-28/intake-notes.md`](../reports/extraction-intake-2026-07-28/intake-notes.md) (ADR-0164's migration-cost analysis + slice briefs) · [`agent-app-surfaces.prd.md`](./agent-app-surfaces.prd.md) (the tier this composes on, and the failure mode §1 below refuses to repeat).
> Decomposition: [`../decompositions/ma-data-workbench.decomp.json`](../decompositions/ma-data-workbench.decomp.json) — both planes, `plan` mode, `coverage_check.py --strict` exit 0. §7's sequencing is that manifest's edge set, not a fresh guess.

## 1. Problem

The fleet can render almost every SaaS screen and has never proven it. `@agent-ui-kit/*` publishes ~50 controls, three shells, a form spine, a router, a code family and an A2UI renderer — and **not one shipped surface anywhere in the repo is the shape a business application actually takes**: a table of records you sort, narrow, select and page through, next to a form that edits one of them.

That is not an aesthetic gap. The 2026-07-28 inventory measured it as the fleet's **biggest single component hole** ([inv-6](../reports/roadmap-wave-2026-07-28/inv-6-saas.md) §1c/§2c): `ui-table` is display-only by ratified contract, no pagination control exists anywhere in `packages/agent-ui`, and there is no documented recipe — not one row — for a data table with a toolbar. The same inventory found the *pattern* half already half-built and trapped: `ui-agent-admin` hand-rolls a working list→edit→save loop across six instantiations, and no other surface can use it, because its styles live inside `agent-admin.css`'s `@scope (ui-agent-admin)` block ([ADR-0164](../adr/0164-entry-list-extraction-home.md) Context §1).

**The failure mode this exists to avoid is already on the record.** [`agent-app-surfaces.prd.md`](./agent-app-surfaces.prd.md) §1 diagnosed it precisely once before: the `a2ui-live` demo was *a complete, working agent app — and every line of its chrome was bespoke*. It proved a composition was **possible** without making it **reusable**, and the cost was a whole PRD and a package to undo. A SaaS workbench built as one clever page would repeat that mistake at larger scale, which is why the deliverable here is deliberately three tiers deep and the page is the *proof*, not the product (PRD-D1).

**Why now, and why this is the largest bet of the arc.** Both gating design forks are frozen and ratified, so the two builds start from settled contracts rather than open questions. The roadmap named this the largest bet precisely because it is the first milestone that spends *across* the whole stack at once — a component-tier widening, an app-tier extraction, a composition, an agent seam, and a pattern-tier write-up — and therefore the first one that can prove the layers actually fit together outside their own demo pages.

## 2. Users

**The verified, in-repo instance (the evidence).** Two, both concrete:

1. **The library itself, as its own first consumer.** Every SaaS-shaped claim the fleet makes today is argued from inventory prose. There is no site demo of a data-grid workflow, no CRUD flow, no workspace-settings surface independent of agent-admin's domain (inv-6 §2, all three PAGE rows read "none"). Nothing falsifies the claim that these primitives compose, because nothing composes them.
2. **`ui-agent-admin`, the surface that already needed this and paid for it locally.** It built the entry-list machinery because no shared home existed ([inv-1](../reports/roadmap-wave-2026-07-28/inv-1-agent-admin.md) §5 lists it as *the* one exportable mechanism). It is the demonstrated demand and, after MA-2, the extraction's first consumer.

**The forward-looking audience (the growth case, not the evidence).** A developer evaluating `@agent-ui-kit/*` for an admin console, an internal tool or a B2B product — the largest realistic consumer segment for a component library — who lands on the docs site and currently cannot tell whether the fleet does tables, filters or record editing at all. And, one layer out, an **agent** producing A2UI payloads against a catalog that, after MA-1, can express a selectable/sortable/paginated table for the first time ([ADR-0163](../adr/0163-ui-table-interactive-widening.md) cl.9).

The tier is justified by the two grounded internal instances. The external audience is what it also serves.

## 3. Outcomes

Stable IDs; goals stated as **outcomes**, with the mechanism owned downstream (the two ratified ADRs already fix most of it — §6). Every acceptance below is a checkable predicate; gates are judged by **exit codes**, never by reading output.

| ID | Priority | Outcome |
|---|---|---|
| **PRD-G1** | must (component tier) | The fleet has an interactive data table — sort, selection, filter/search, pagination — and a reusable page navigator |
| **PRD-G2** | must (mechanism tier) | The admin-pattern machinery is consumable **and styled** outside `ui-agent-admin`, from a public subpath |
| **PRD-G3** | must (flagship) | The four workbench parts compose inside `ui-workspace-shell` with zero bespoke chrome |
| **PRD-G4** | must | An agent writes a summary of the current view into the workbench with no bespoke renderer/transport wiring |
| **PRD-G5** | must (pattern tier) | The assembly is reproducible from documented recipes, not by copying the page |
| **PRD-G6** | must (cross-cutting) | Fleet DoD, the layering law and the size budgets hold across the whole wave |

**PRD-G1 — an interactive data table exists (component tier).** The capabilities every SaaS data pattern needs stop being absent from the fleet. *(Mechanism: [ADR-0163](../adr/0163-ui-table-interactive-widening.md), ratified — ten clauses; this goal does not re-open them.)*
- *Baseline*: 0 of 4 capabilities; `ui-table` is display-only by ratified contract; no pagination control exists anywhere in `packages/agent-ui` (inv-6 §1c).
- *Acceptance*:
  - [ ] With every capability enabled, one cross-engine probe (Chromium **and** WebKit) shows: activating a sortable header cycles ascending→descending and reorders rows, with `aria-sort` on **exactly one** `<th>`; select-all under an active filter checks **exactly the matching set** and reads indeterminate when partial; `page-size=10` over 25 rows renders 10 `<tr>` plus a footer navigator reading 3 pages.
  - [ ] The host table's **computed role is still `table`** with every capability on (ADR-0163 cl.3's correctness crux).
  - [ ] With defaults (`selectable=''`, no `sortable` column, `page-size=0`, `search=''`, `filter=[]`), the committed byte-identity probe asserts serialized-DOM equality against the pre-widening baseline — **exit 0** (cl.10).
  - [ ] `ui-pagination` ships with its `pagination.md` descriptor↔props trip-wire green and mounts standalone, with no table present.
- *Timeframe*: **MA-1**.

**PRD-G2 — the machinery is consumable outside agent-admin (mechanism tier).** A second surface can reuse the list→edit→save loop by importing it, not by re-typing it. *(Mechanism: [ADR-0164](../adr/0164-entry-list-extraction-home.md), ratified.)*
- *Baseline*: `mountEntryList` has **no public surface**, and its whole style block lives inside `agent-admin.css`'s `@scope (ui-agent-admin)` — an outside consumer gets a working but **unstyled** section (ADR-0164 Context §1).
- *Acceptance*:
  - [ ] A standalone smoke test mounts a section from `@agent-ui/app/entry-list` + `./entry-list.css` with `createMemoryStore` and stub handlers, asserting **`ui-agent-admin` appears nowhere in the tree** *and* the section's `[data-part]` anatomy carries non-default computed styles — the "styled" half, not only the "working" half.
  - [ ] `npm run check` exits 0 with all three subpaths resolving, every pre-existing `@agent-ui/app` import site compiling unchanged, and **no root-barrel export name renamed**.
  - [ ] agent-admin's existing jsdom, browser and visual suites pass **unchanged** — the gate on the `@scope` proximity risk ADR-0164 cl.4 names.
- *Timeframe*: **MA-2**.

**PRD-G3 — the four parts compose with zero bespoke chrome (flagship).** The workbench is assembled from published primitives inside `ui-workspace-shell`; the composition, not any single control, is what is being proven.
- *Baseline*: no site demo of a data-grid workflow, a CRUD flow, or a domain-neutral workspace surface exists (inv-6 §2, all three PAGE rows).
- *Acceptance*:
  - [ ] The page renders inside `ui-workspace-shell` and **its own stylesheet declares no shell/layout frame rules** (no frame grid/flex, no rail or pane sizing); the AC19 spacing-drift gate is green with that sheet in its set.
  - [ ] One probe exercises all four parts interoperating: a toolbar filter narrows the table → a sort reorders the narrowed set → a selection **survives** the filter change → opening and saving a record updates the visible row.
  - [ ] The toolbar **never reassigns the table's `rows` prop** — asserted by the bound array's identity being unchanged across a filter interaction (the difference between driving the control and hand-filtering around it).
- *Timeframe*: **MA-3**.

**PRD-G4 — an agent writes into the workbench with no bespoke wiring.** The fourth ruled part: an agent-authored summary of what the user is currently looking at. *(Mechanism is **open** — PRD-D4/D5; this goal fixes the outcome and the fence, not the vehicle.)*
- *Baseline*: "agent writes into a display card" is **ad hoc** — no settled contract (inv-6 §4).
- *Acceptance*:
  - [ ] A probe asserts the summary region renders agent-authored content **derived from the current view** (it changes when the view's filter/selection changes, or the SPEC records why it deliberately does not).
  - [ ] The page module contains **no renderer or transport wiring beyond the published seam** ruled in PRD-D4 — reviewed against the page's imports, which name only published surfaces.
  - [ ] **No new mechanism is minted** for this: the shipped surface uses one of the two candidates in PRD-D4, and the review records which.
- *Timeframe*: **MA-3**.

**PRD-G5 — reproducible from recipes, not by copying the page (pattern tier).** The goal that keeps M-A from being another `a2ui-live` (§1).
- *Baseline*: 0 SaaS-pattern rows — inv-6 §2 records a PATTERN gap in **all four** of its categories.
- *Acceptance*:
  - [ ] `agent-ui-composition-patterns` carries **four** new rows: the data-table toolbar, the record-CRUD loop, the schema-driven settings page, and the resource-list manager (the last two are [ADR-0164](../adr/0164-entry-list-extraction-home.md) cl.5's, ratified and owed already).
  - [ ] Each row names an **owner ADR id** and an **in-repo exemplar path that resolves** — the S3 dangling-link sweep in `site/lib/docs-grammar.test.ts` is green, and each exemplar points at the shipped workbench page or at agent-admin, never at a scratch file.
  - [ ] Each row's answer column names the **mechanism** (the props/seam a reader wires), not just a control's tag — the shape every existing row in that skill already holds.
- *Timeframe*: **MA-2** (the two ADR-0164 rows) and **MA-4** (the two workbench rows).

**PRD-G6 — DoD, layering and budgets hold (cross-cutting).** The wave extends the fleet without regressing its standing bar.
- *Baseline*: n/a — the discipline exists; this wave must not regress it.
- *Acceptance*:
  - [ ] At each milestone close: `npm run check && npm test` **exit 0** and all six browser shards **exit 0**, judged by exit codes.
  - [ ] The per-package `layering.test.ts` trip-wires stay green — in particular `a2ui` still never imports `app`, and `app` still never imports `router`.
  - [ ] `npm run size` carries line-items for the `components` marginal (table + `ui-pagination`) and for `app` (the `entry-list/` folder), each **within budget or with a re-base recorded and argued** in the wave's own record — never silently absorbed (ADR-0163 Consequences already flags the family-ceiling re-base as likely).
  - [ ] The one new element, `ui-pagination`, ships its `{name}.md` descriptor and passes the descriptor↔props trip-wire.
- *Timeframe*: continuous from **MA-1**.

## 4. Non-goals

The roadmap names exclusions; these sharpen them. Each carries its rationale — a fence with no reason is a fence that moves.

- **No data-fetching, transport or backend layer.** The workbench's rows come from a **seeded, in-repo fixture module**; a page probe asserts zero network requests at runtime (PRD-D2). — *this is a component library proving composition, not an application framework; the moment a fetch layer appears, the demo is testing the network instead of the fleet.*
- **Persistence is in-session only.** Edits are real, observable and **gone on reload** — the `createMemoryStore` precedent, stated visibly on the page. No backend, no `localStorage` contract, no sync (PRD-D2). — *a persistence contract is a product decision with its own intake; faking one teaches a pattern nobody should copy.*
- **No new charts.** Line, area, pie and axis charts stay deferred by [ADR-0107](../adr/0107-chart-family-v1-scope.md); the workbench's ruled four parts do not include a chart, and a "dashboard grid" recipe is a separate item (inv-6 §2a). — *the roadmap ruled four parts; a fifth is a rider.*
- **No virtualization and no row-cap change.** Pagination is this wave's answer to scale; the report-family SPEC's no-virtualization posture stands verbatim ([ADR-0163](../adr/0163-ui-table-interactive-widening.md) cl.10). — *cited, not re-decided.*
- **Nothing on ADR-0163 cl.1's fence line.** Filter **operators** beyond the facet shape (ranges, comparisons, per-cell expressions), an in-table query input, column resizing, cell renderers, interactive chips and editable cells stay fenced; each re-enters only by its own record. — *the fence moved once, deliberately and by exactly four admissions; a workbench build is precisely the pressure that erodes it by drive-by.*
- **No new multi-select control.** The facet affordance composes from shipped controls (PRD-D3). — *default-no; a new primitive earns its own ADR, not a rider on a demo.*
- **No production SaaS application.** M-A ships primitives, a mechanism, recipes and **one proof page** — not accounts, auth, permissions, or a real domain. — *primitives, not products (the same fence [`agent-app-surfaces.prd.md`](./agent-app-surfaces.prd.md) §3 holds).*
- **No `ui-agent-admin` redesign.** It becomes the extraction's first consumer and must render **byte-equivalently**; a second copy of the machinery may not appear ([ADR-0164](../adr/0164-entry-list-extraction-home.md) cl.7). — *the extraction exists to kill the copy-paste fork, not to start one.*
- **No router.** The workbench is one page; section switching is local state. `app` never imports `router` ([ADR-0115](../adr/0115-spa-router-v1-scope.md)). — *catalog-invisibility is structural, not a preference.*
- **The workbench frame is never agent-emittable.** The agent writes into **one region**; the chrome is host-authored (the [`agent-app-surfaces.prd.md`](./agent-app-surfaces.prd.md) PRD-D2 boundary). — *letting the agent emit its own container is a security inversion.*

## 5. Composition inventory

What the four ruled parts need, what already ships, and where the genuine holes are. **The two known builds are ADR-0163 and ADR-0164; this section's job is to find whatever else the four parts require** — and to record what was checked and found *not* to be a gap, which is the half an inventory usually omits.

| Workbench part | Covered by (shipped) | Gap | Disposition |
|---|---|---|---|
| **Data table** | `ui-table` — native `<table>`, typed columns/rows, scroll region, caption/ARIA (ADR-0004, report-family LLD-C9) | all four interactions; **no pagination control anywhere in the fleet** | **[ADR-0163](../adr/0163-ui-table-interactive-widening.md) build → MA-1** |
| **Filter toolbar** | `ui-toolbar` (`role=toolbar` + roving focus) · `ui-text-field` (search) · `ui-menu` with `menuitemcheckbox` items (GH #55) · `ui-segmented-control` / `ui-select` (single-value facets) · `ui-button` | (a) the table has no filter state to drive; (b) **no fleet control emits a multi-VALUE facet set**; (c) zero-result filters announce nothing | (a) ADR-0163 cl.2 → MA-1 · (b) **PRD-D3, open** · (c) recorded residual, carried (below) |
| **Record-edit flow** | `ui-form-provider` + `ui-field` + the full FACE control suite (ADR-0050/0051) · `ui-master-detail`/`-pane` (list→detail) · `ui-modal` (dialog edit) · `ui-settings` + `SettingsSchema` + `generate.ts` (schema→form) · `mountEntryList` (the micro-CRUD loop) | the entry-list machinery is **unstyled** outside `ui-agent-admin` | **[ADR-0164](../adr/0164-entry-list-extraction-home.md) build → MA-2** |
| **Agent summary** | `ui-card`/`ui-stat`/`ui-text` (catalog rows exist) · `ui-surface-host` (the A2UI mount seam) · `@agent-ui/a2ui/agent` (`buildSystemPrompt`/`produce`) · `ui-markdown` (`@agent-ui/code`, catalog-invisible by construction) | **no settled "agent writes into a display card" contract** (inv-6 §4) | **PRD-D4/D5, open** — carried to the SPEC; no new mechanism minted |
| **The frame** | `ui-workspace-shell` / `ui-super-shell` (ADR-0151/0154/0155/0156) | none — but "content = data table + toolbar" is an **untested combination** (inv-6 §4) | not a missing primitive; assumption **A1**, re-verified as MA-3's first act |
| **The data** | nothing — and nothing should | n/a | **PRD-D2**: seeded fixture + in-memory store |

**Checked and found NOT to be gaps** (recorded so the SPEC does not re-derive them):
- *The record-edit vehicle* — `ui-master-detail` (list→detail) and `ui-modal` (dialog edit) both ship. The choice between them is a composition decision the SPEC owns; **no primitive is missing**.
- *The A2UI expressibility of the widened table* — [ADR-0161](../adr/0161-catalog-multi-slot-two-way-value-marks.md)'s multi-slot value mark is ratified and already carries two consumers; the widened `Table` row is the third (ADR-0163 cl.9). No catalog-mechanism work is owed.
- *An entry-list element* — ADR-0164 cl.3 froze the mount-function shape against six proven instantiations. Minting `ui-entry-list` is not in this wave.

**The one residual carried into the surface.** ADR-0163 cl.2 records that a zero-result filter renders an honest empty `<tbody>` **and announces nothing** in v1. The workbench is the first surface where filtering is a first-class user affordance, so it is where that silence becomes user-visible: PRD-G5's toolbar recipe teaches a **visible results count**, and a built-in `aria-live` region remains the named foreseen extension — not this wave's work.

## 6. Decisions

**Inherited — already ratified; cited, never re-opened.**

| Record | What it settles for M-A |
|---|---|
| [ADR-0163](../adr/0163-ui-table-interactive-widening.md) (accepted) | The table widens in place — selection, sort, filter, pagination on `ui-table`; `ui-pagination` minted; native `table` role kept; the new fence line |
| [ADR-0164](../adr/0164-entry-list-extraction-home.md) (accepted) | The entry-list machinery re-homes to `app/src/controls/entry-list/` with three public subpaths; the settings remainder closes at the pattern tier |

**This PRD's own — three recommendations for ratification, two forks carried down.**

| ID | Question | Recommendation | Owner |
|---|---|---|---|
| **PRD-D1** | What does "SaaS UI patterns" deliver? | **Three tiers; the page is the proof, not the product** | ratify here |
| **PRD-D2** | The demo's data + persistence shape | **Seeded in-repo fixture; in-memory, in-session persistence; no fetch layer** | ratify here |
| **PRD-D3** | The multi-value facet affordance | **Default-no — no new control; compose it** | ratify here |
| **PRD-D4** | The agent-summary mechanism | **Open** — two shipped candidates, no third minted | → SPEC |
| **PRD-D5** | Is the summary live or recorded? | **Open** — precedent is split | → SPEC |

**PRD-D1 — the deliverable shape.** *Recommendation:* M-A delivers **three tiers** — (i) **component**: the ADR-0163 builds, permanent fleet primitives; (ii) **mechanism**: ADR-0164's public subpaths; (iii) **pattern**: four `agent-ui-composition-patterns` rows — and **one demo page whose role is to falsify the other three**, not to be reused. The alternative (one impressive page, patterns documented later if at all) is the exact failure [`agent-app-surfaces.prd.md`](./agent-app-surfaces.prd.md) §1 already diagnosed and paid to undo: a composition proven possible and left un-reusable. That precedent is why PRD-G5 is `must` and carries its own acceptance rather than riding along as documentation.

**PRD-D2 — data and persistence.** *Recommendation:* rows come from a **seeded in-repo fixture module**; edits persist **in memory for the session** via the `createMemoryStore` precedent and are visibly labelled as such; **no fetch layer, no backend, no `localStorage` contract**. Rationale from mechanics, not taste: the fleet's own gates are deterministic and offline, and a demo that reaches the network turns every gate run into a test of the network. The honest cost — a reload discards edits — is stated on the page rather than hidden behind fake durability.

**PRD-D3 — the multi-value facet affordance.** ADR-0163 cl.2's `filter` prop is `{ key, values[] }[]` — **multi-value per column** — and the inventory (§5) finds no fleet control that emits a multi-value set: `ui-select` and `ui-segmented-control` are single-value, and `ui-menu`'s `menuitemcheckbox` items (GH #55) commit **one at a time with no aggregate value prop**, so a consumer aggregates the checked set itself. *Recommendation:* **default-no — mint nothing.** The workbench composes `ui-menu` checkbox items (or a checkbox group) with page-side aggregation; a demo page has TypeScript and can afford four lines of glue. **The honest residual, recorded not buried:** for the CSS-less A2UI consumer ([ADR-0102](../adr/0102-css-less-consumer-contract-law.md)) that glue does not exist, so an agent can *emit* a facet filter but cannot *offer the user a facet picker* without one — if that becomes a real ask, it is a new intake and its own ADR, not a rider here.

**PRD-D4 — the agent-summary mechanism (open, → SPEC).** Two shipped candidates, both legitimate: **(a)** an A2UI payload rendered by `ui-surface-host` into catalog `Card`/`Text`/`Stat` rows — catalog-bounded, reuses the ratified renderer seam; **(b)** host-side prose through `ui-markdown` (`@agent-ui/code`) — simpler, but catalog-invisible by construction, since `a2ui` never imports `code`. The PRD fixes only the **fence**: whichever is chosen, **no third mechanism is minted** for this surface. The SPEC rules it with the trade-off stated.

**PRD-D5 — summary liveness (open, → SPEC).** The precedent is genuinely split: `gen-ui-live` is **deliberately recorded-only**, while `ui-agent-admin` runs a real turn loop behind the dev proxy. Recording keeps the gates hermetic and PRD-D2 coherent; live proves the seam. The SPEC rules it, and PRD-G4's acceptance is written to hold either way — it asserts *derived from the current view*, not *fetched at runtime*.

## 7. Sequencing

The manifest's edge set, stated. Every edge in [`../decompositions/ma-data-workbench.decomp.json`](../decompositions/ma-data-workbench.decomp.json) carries a `why`; the verdict below is what those edges imply.

**MA-1 and MA-2 are fully independent and start in parallel.** They touch disjoint packages with **zero file overlap** — MA-1 is `components` + `a2ui` (table, pagination, catalog); MA-2 is `app` only (`entry-list/`, agent-admin, `app/package.json`). Nothing in the manifest connects them. Running them serially buys nothing.

- **MA-1 — the ADR-0163 build** (7 slices). Two **serial** slices first: the **byte-identity baseline must be captured from the pre-widening DOM**, so it lands before the first widening diff; then the **view pipeline + search/filter state**, because select-all's matching set, sort's position and the page window are all defined by it. Then **selection · sort · the standalone `ui-pagination`** fan out in parallel; **table windowing** joins the pipeline to the control; the **catalog row + `Pagination` row** is the **serial integration slice** (one writer on `catalog.json`/`factories.ts`); the **owning-doc repairs** land last, once the shipped surface stops moving.
- **MA-2 — the ADR-0164 build** (3 slices, strictly serial, one seat — the [intake notes'](../reports/extraction-intake-2026-07-28/intake-notes.md) S1): the split + subpaths → the CSS re-scope → agent-admin consumes + the standalone smoke (which asserts *styled*, so it needs the sheet). The intake's **S2 docs slice** (ADR-0164 cl.5's two pattern rows) forks off as soon as the subpath names exist.
- **MA-3 — the workbench surface.** Gated on **both** builds landing **and** on the SPEC (§9), so the composition seat is dispatched from a fixed contract rather than from this PRD. **One slice parallelizes early:** the seeded fixture has no dependency on either build — author it during MA-1/MA-2. Then the page, then the toolbar and the record flow, then the summary card.
- **MA-4 — the pattern tier.** Trails MA-3's toolbar and record slices, because the rows document what those slices actually built.

**Critical path:** baseline → view pipeline → windowing → the page → the record flow → the recipe rows. **MA-2 has slack** (3 small slices against MA-1's 7) and joins the path only where the record flow reuses the extracted machinery.

**Verdict:** dispatch **MA-1 and MA-2 concurrently now**; author the workbench SPEC **during** them so MA-3 is never blocked on doc work; run MA-3 as a single composition seat once both land; MA-4 last — except ADR-0164's two rows, which ship **with** MA-2, since they are already owed by a ratified record.

## 8. Constraints, assumptions, risks

**Constraints.**
- **C1** — Zero runtime dependencies; strict TS (`erasableSyntaxOnly` · `verbatimModuleSyntax` · explicit `.ts` extensions).
- **C2** — The import DAG holds unchanged: `shared ← components ← a2ui ← app`, with `router`/`code` as sibling branches. The demo page lives in `site/`, so it may compose across packages that may not import each other.
- **C3** — The **CSS-less-consumer law** ([ADR-0102](../adr/0102-css-less-consumer-contract-law.md)): a capability requiring consumer glue does not exist for the catalog's primary consumer. It is the reason the table owns windowing and filter *state* at all, and the reason PRD-D3's residual is recorded rather than shrugged off.
- **C4** — The fleet DoD is non-negotiable ([`../process.md`](../process.md)): descriptor + trip-wire + cross-engine browser truth + a size line-item, per new element.
- **C5** — ADR-0163 cl.1's fence line is the boundary for the whole wave (§4).

**Assumptions — each with its re-verification trigger.**
- **A1** — `ui-workspace-shell` hosts a "content = data table + toolbar" region with no new shell work. **Explicitly unverified**: inv-6 §4 calls it an untested combination. *Re-verify as MA-3's first act, before the composition build commits.*
- **A2** — The four parts need no fifth primitive beyond §5's inventory. *Re-verify at SPEC time, when the parts' behaviour is fixed.*
- **A3** — `ui-menu`'s `menuitemcheckbox` items are a sufficient facet affordance for the demo (PRD-D3). *Verified against `menu.md`'s GH #55 rows on 2026-07-30; re-verify if the SPEC needs an aggregate value prop.*
- **A4** — The widened table's marginal fits the per-control cap, or the family ceiling re-bases with an argument. *Measured by `npm run size` at MA-1; ADR-0163's Consequences already pre-records the likely re-base.*

**Risks.**
- **R1 — the `@scope` proximity change (MA-2).** ADR-0164 cl.4 names it: moving the entry-list block to its own scope root alters proximity ranking against composed controls' scoped blocks — the exact mechanism `agent-admin.css`'s own comments record losing to before. The existing visual and computed-style suites are the **only** thing between that and a silent agent-admin regression; they must run and be judged by exit code, not skipped as "unchanged files."
- **R2 — size re-base (MA-1).** The table stops being the family's simplest control. Recorded, argued, never silently absorbed (PRD-G6).
- **R3 — the zero-result silence (§5).** Most visible on exactly this surface; mitigated at the recipe tier, not by new component surface.
- **R4 — shipping the page without the rows.** The `a2ui-live` failure, repeated. If the wave is cut short, PRD-G5's rows are the **last** thing cut, not the first — that ordering is the whole point of PRD-D1.

## 9. What this earns next

- **A SPEC for the workbench surface** — the follow-on this PRD names and does not write. It owns the four parts' behaviour contract, the record-edit vehicle (master-detail vs modal), and rules **PRD-D4** and **PRD-D5**; its `SPEC-R#` ids trace to PRD-G1–G6. It is authored **during** MA-1/MA-2 (§7) so MA-3 is never gated on doc work.
- **Not earned here — an LLD.** MA-3 is a site page composed from shipped primitives; there is no component or interface decomposition to own. MA-1 and MA-2 are already carried by their ratified ADRs' Repairs rows and the decomposition manifest, which is what the build seats implement from.
- **Not earned here — another ADR.** Both gating forks are ratified. PRD-D3's default-no is a **fence**, not a new decision. If Kim overturns it and a multi-select control is minted, **that** earns its own intake and its own ADR — it does not ride this wave.
