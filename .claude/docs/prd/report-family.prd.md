# PRD — Report / Status Component Family (`ui-table` · `ui-stat` · `ui-badge`)

> Status: **proposed · v0.1 · Owner: agent-ui** — a scope INTAKE (2026-07-08), the [ADR-0107](../adr/0107-chart-family-v1-scope.md) chart-intake pattern applied to the report family. No build is authorized by this document.
> Altitude: this document owns **why + what-should-exist** for the report/status family. The scope/contract-direction decision record is [ADR-0111](../adr/0111-report-family-v1-scope.md); SPEC/LLD are authored at the build wave, not here.
> **Sibling-vs-extension ruling:** this is a **new sibling PRD** (filed under `.claude/docs/prd/`, the chart-family precedent). Neither existing PRD owns it: `chart-family.prd.md` owns the *graphical* report vocabulary (series-shape + magnitude marks); the A2UI expert-system PRD owns *generation reliability*; `agent-app-surfaces.prd.md` owns app *chrome*. Tabular data, metric tiles, and status tokens are fleet **content vocabulary** (a `@agent-ui/components` control family with an a2ui catalog surface) that no chart type serves — the chart PRD's own §1 boundary ("anything the existing idiom already serves stays out of scope") is exactly where this family begins.
> Grounding: the catalog SPEC §5.2 four-way guidance (`.claude/docs/specs/specs/a2ui-catalog.spec.md:207-210` — two of its four verdicts route to *hand-composed idioms*, not components) · the metric-tile idiom seeds (`packages/agent-ui/a2ui/src/examples/patterns.ts:183-187` · `catalog-coverage.ts:319-323` + `stats-grid-dashboard`) · [`../references/geometry.md`](../references/geometry.md) (the five size-classes + the compact realm, whose roster names `tag · badge · chip` — never ported) · [ADR-0087](../adr/0087-a2ui-whole-fleet-catalog-scope-policy.md) / catalog SPEC-N2 (whole-fleet coverage gate) · [ADR-0097](../adr/0097-a2ui-feed-embedded-asks.md) + its Amendment (the feed partition is TOTAL) · [ADR-0057](../adr/0057-intent-non-color-signifier-rule.md) (whose Consequences name "any badge/alert/toast/tag family" as the forward trigger — this is that family arriving) · [ADR-0102](../adr/0102-css-less-consumer-contract-law.md) (every prop decision routes through the three-lane chooser).

## 1. Problem

Agents produce three report shapes the fleet still cannot express as first-class vocabulary — each currently served by a **taught idiom papering over a missing type**:

1. **Exact values scanned row-by-row.** The shipped §5.2 guidance itself routes this need to "*a `List` table when exact values must be scanned row-by-row*" — i.e. the official answer to "show me a table" is *hand-compose one out of `List`/`Row`/`Text`*. A List-of-Rows table has no header association, no `th` scope, no SR table navigation, no typed cells, and every model re-invents its column layout from scratch. The guidance is the recorded evidence: the fleet teaches the workaround because the type does not exist.
2. **A labeled metric with its delta.** The "metric tile" (caption label + `h3`-variant value in a Card) is the corpus's **most-taught composition** — hand-assembled in at least three seeds (`patternDashboardSeed`, `stats-grid-dashboard`, the ADR-0107 report-card exemplar's own tile) — with no component behind it. Every tile fakes an `h3` heading for typography, polluting the document outline with headings that are not headings, and no two models compose the tile identically.
3. **Status at a glance.** The precursor fleet's compact-realm roster (`geometry.md`: "kbd · slider · slider-multi · radio · switch · **tag · badge · chip**") carried a status-token vocabulary that was never ported. An agent reporting per-row or per-item state (passed/failed/pending) has only colored `Text` — and ADR-0057 makes a hue-only status **unshippable by rule**, so today there is no *legal* way to emit compact status at all.

**Who has the problem.** (1) *Models emitting A2UI payloads* — asked for "the revenue breakdown by region as a table," a model must improvise a List-of-Rows grid; asked to "flag the failing checks," it has no status token. (2) *The report/artifact surfaces* (the artifact feed, the report-card exemplar) — their tiles are hand-composed and their tables are semantic lies. (3) *App developers* embedding agent reports, who inherit the same missing vocabulary.

**Why these three must beat the idioms to earn a place.** Charts (ADR-0107) answered *pre-attentive* questions the idioms structurally could not. This family answers the complementary *exact-reading* questions where the idioms function but are **semantically dishonest and unteachable**: fake headings, fake tables, illegal status color. The boundary that keeps v1 small: anything interactive (sorting, chips, selection) is out (§3) — this family is display vocabulary, not analysis tooling.

## 2. Goals & success metrics

Stable IDs; priority tiers (must/should/could); metrics carry baseline + target + timeframe. Milestones M1/M2 in §4. Downstream SPEC requirements trace to these IDs.

| ID | Priority | Outcome |
|---|---|---|
| **PRD-G1** | must | An agent can emit a real table, a metric stat, and a status badge: the three types exist in the fleet and the default catalog |
| **PRD-G2** | must (cross-cutting) | The family holds every fleet pillar — native/zero-dep rendering, geometry-law sizing, token theming, ADR-0057-legal intent, AT announcement, cross-engine proof |
| **PRD-G3** | should | The teaching layer stops teaching the workaround: the §5.2 guidance re-bases onto the new types, the exemplar retires the hand-composed tile, and the feed partition dispositions land |

**PRD-G1 — An agent can emit report/status vocabulary (flagship).** Each failing shape in §1 gets a catalog-reachable component type — `Table` (typed columns + rows), `Stat` (label + value + optional delta/caption), `Badge` (label + intent) — with data props a model can emit as plain JSON (the ADR-0107 cl.2 posture).
- *Metric*: report/status component types in the default catalog, each validator-clean over a realistic payload.
- *Baseline*: **0** (`catalog.json` declares no table, stat, or badge type; §5.2's guidance to hand-compose is the recorded evidence).
- *Target*: **≥ 3** (`Table`, `Stat`, `Badge`) declared, factory-bound, and exercised by a validator-clean exemplar payload.
- *Timeframe*: **M1** (the first build wave — not authorized by this intake).

**PRD-G2 — The family holds every fleet pillar (cross-cutting).** The controls are ordinary `ui-*` citizens: zero-dep rendering (the table is a *real native `<table>`* stamped in light DOM — native AX for free), sized under the geometry law (Display class for table/stat; the compact realm's first consumer for badge, ADR-0041), themed via token roles, intent never by color alone (ADR-0057 — badge intent and stat delta each co-carry a non-color signifier), and proven whole-shape in real browsers (a wide table scrolls **inside its own container**, never the page — the ADR-0102 Lane A overflow law).
- *Metric*: the fleet DoD gates over the new controls — `npm run check && npm test`, browser legs (Chromium + WebKit), descriptor trip-wires, `npm run size` — plus an a11y probe per type (native table semantics reachable; stat delta direction announced as text; badge intent glyph present per intent) and an ADR-0057 conformance row per intent-keyed rule.
- *Baseline*: n/a (no such controls exist).
- *Target*: **all gates green at M1**, including the overflow-in-own-container browser leg and the whole-shape law (a bare stat/badge in a flex row paints visibly, never collapses).
- *Timeframe*: **M1**.

**PRD-G3 — The teaching layer stops teaching the workaround.** The §5.2 four-way guidance re-bases (*`Stat` for a latest value · `Sparkline` for the shape of a series · `BarChart` for comparing magnitudes · `Table` when exact values must be scanned row-by-row*) so neither hand-composed idiom remains the official answer; the report-card exemplar upgrades its hand tile to `Stat`; a table-bearing exemplar joins the shelf; corpus + derived prompt re-validate over the widened catalog (the ADR-0087 consequence pattern); and each new type receives its ADR-0097 feed-partition disposition (the partition is TOTAL — the gate goes red at M1 without them).
- *Metric*: guidance prose + exemplar seeds referencing the new types, validator-clean; feed dispositions recorded in `feed-catalog.ts`.
- *Baseline*: **0** (the guidance names the idioms; the exemplars hand-compose; no dispositions exist).
- *Target*: the re-based §5.2 guidance landed; **≥ 1** exemplar exercising all three types in `allSeeds`, validator-clean; the partition gate green with all three types dispositioned.
- *Timeframe*: **M2** (guidance + exemplar) with the partition dispositions owed at **M1** (they gate the catalog rows themselves).

## 3. Scope

**In scope (v1):**
- `ui-table` — a **static, display-only data table**: `columns` + `rows` JSON rendered as a real table with genuine header association (native table semantics); typed cells (`string`/`number`); wide tables scroll inside the component, never the page. (Rendering mechanism — the light-DOM stamp, Intl formatting, end-alignment — is ADR-0111 cl.3's.)
- `ui-stat` — label + value + optional delta (direction carried by glyph + sign, never color alone) + optional caption; Display-class typography **without heading semantics** (retires the fake-`h3` idiom).
- `ui-badge` — a compact-realm, **non-interactive** status/label token; intent roles (`neutral`/`info`/`success`/`warning`/`danger`) each co-carrying a component-drawn non-color glyph (ADR-0057).
- Same-wave default-catalog rows (`Table`, `Stat`, `Badge`) + feed-partition dispositions (M1), the §5.2 guidance re-base + the exemplar upgrade/addition (M2) — forced by the SPEC-N2 whole-fleet gate and the ADR-0097 total partition the moment the descriptors land.

**Out of scope (v1) — the fence, each with its reason (each re-entry is a new intake, never a rider):**
- **Table interactivity** — sorting, row selection, pagination, virtualization, column resizing, editable cells: each drags focus/keyboard/state machinery that converts a display type into an application widget (the axis-system analog of ADR-0107's fence — where table scope explodes).
- **Cell renderers / nested components in cells** — arbitrary children per cell re-opens the renderer's child model and the validator's shallow-schema posture; v1 cells are `string | number` text.
- **Interactive chips** — dismissible/selectable/focusable tokens change the component class (focus ring, keyboard contract, form participation — the ADR-0042 value-control bases), not just the styling; fenced as their own intake.
- **Anchored count-dots / notification badges** — overlay-positioning machinery against another control's corner; a different mechanism family than an inline token.
- **Stat sparkline slot** — a chart *inside* the stat is pure composition today (`Row`/`Column` of `Stat` + `Sparkline` — the report-card exemplar's own shape); a child seam would make `Stat` a container (see ADR-0111 fork F2).
- **Delta valence coloring** — v1 encodes delta *direction* only (glyph + sign); "up is good" is false for churn-class metrics, so valence needs its own prop and its own intake (foreseen extension, ADR-0111 Consequences).

## 4. Milestones

| Milestone | Delivers | Gate |
|---|---|---|
| **M0 (this intake)** | This PRD + ADR-0111 (scope + contract directions + Kim forks) — docs only | doc-review + Kim's fork answers; harness gates green |
| **M1** | The three controls + descriptors + same-wave catalog rows + feed-partition dispositions + a11y/browser/geometry probes (PRD-G1, PRD-G2) | fleet DoD + SPEC-N2 fleet-derived gate green with **no allowlist residue** + the ADR-0097 partition gate green |
| **M2** | §5.2 guidance re-base + exemplar upgrade/addition + corpus/prompt re-validation (PRD-G3) | examples/corpus gates green; exemplar renders in the gallery |

## 5. Open decisions

The genuine forks are owned by [ADR-0111](../adr/0111-report-family-v1-scope.md) §Forks, each with a firm recommendation awaiting Kim: **F1** the table `rows` shape (records keyed by column key — recommended — vs positional arrays) · **F2** the stat composition seam (no child seam in v1 — recommended — vs a `ChildList`) · **F3** the badge/chip boundary (one non-interactive `ui-badge`, chips fenced — recommended) · **F4** the `Stat` feed disposition (OUT — recommended, against the intake dispatch's initial lean, argued from the chart-family precedent). The contract *directions* (native-table stamp, typed cells, geometry placements, catalog/teaching/feed dispositions) are recorded there; mechanisms are SPEC/LLD business at the build wave. No other open decisions at PRD altitude.
