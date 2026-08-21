# PRD — Chart / Data-Visualization Component Family

> Status: **accepted · v1.4 · Owner: agent-ui** — ratified by Kim 2026-07-08 (the 0107/0109/0110 ratification round, `db025d4`: intake doc-review PASS + Kim's "proceed"; forks F1–F3 stand as recommended, per ADR-0107's Ratified-by cell). Began life as a scope INTAKE (v0.1 proposed, 2026-07-08); this header cell was synced by the design seat when the SPEC/LLD were authored — the ratification pass updated the ADR-side cells only. **v1.1, 2026-08-19:** §3's pie/donut ruled-OUT bullet is admitted — `ui-pie-chart` enters the family under [ADR-0219](../adr/0219-pie-donut-part-of-whole-chart.md), which lifts ADR-0107's fence on its own three stated conditions (angle weakness answered by printed percents, hue-only identity answered by a lightness-ramp fill + order/label/percent carriers, the legend requirement answered by a real-DOM key list, never an SVG legend layer) — an additive scope widening; PRD-G1–G3, the M1–M2 targets, and §5's closed forks are untouched. **v1.2, 2026-08-21 (GH #1565, svg-charts wave 1):** §3 admits the shared axis/inset/series vocabulary (`controls/_chart/`, [ADR-0228](../adr/0228-chart-axis-inset-series-vocabulary.md)) and `ui-column-chart` (the category-major stacked/dense-single-series axis-bearing mark, [ADR-0229](../adr/0229-svg-chart-family-extensions.md)) — the axis-systems fence §3 named is REALIZED, scoped to this one new type (ADR-0107 Amendment 4); the pie/donut admission and every other §3 fence (scatter, log/dual axes, a typed time axis, `ui-gauge`/the `axes`-state `ui-line-chart` widening — both later waves of the SAME ADR-0229 — and the follow-up A2UI catalog rows, ADR-0229 cl.7) stay untouched by this bump. **v1.3, 2026-08-21 (GH #1566, svg-charts wave 2):** §3 admits the `ui-line-chart` `axes` state (ADR-0229 cl.3, EXTENDING ADR-0205 — its Decision stands, its cl.3 min/max-labels law becomes default-state-scoped) plus the gradient area fill and the provisional/now-marker system — the "`axes`-state `ui-line-chart` widening" §3 fence-bullet named as a later wave is REALIZED by this bump; `ui-gauge` and the `ColumnChart`/`Gauge`/`LineChart`-axes catalog rows remain later waves/a follow-up intake, untouched here. The pie-ramp repoint (ADR-0228 cl.6) landed CODE-side in wave 1 already — this wave only re-verified its regression guard, no further §3 text change owed for it. **v1.4, 2026-08-21 (GH #1567, svg-charts wave 3):** §3 admits `ui-gauge` (ADR-0229 cl.4) — the multi-ring radial gauge: concentric, INDEPENDENT 0-100 progress rings (never part-of-whole, never a `ui-pie-chart` extension), outer→inner in data order, stepping the shared series ramp, plus a real-DOM label/value legend column consuming the ADR-0228 inset mechanism generalized to a radial mark (the axis/today-marker/projected chrome itself stays N/A, per ADR-0228's own per-mark grammar) — the "`ui-gauge`" §3 fence-bullet named as a later wave is REALIZED by this bump, and this closes out the THIRD and LAST of the three ADR-0229 control waves (`ui-column-chart` wave 1, `ui-line-chart`'s `axes` state wave 2, `ui-gauge` wave 3). Its A2UI catalog row (`Gauge`) remains a later wave/follow-up intake (GH #1568, svg-charts wave 4, alongside `ColumnChart`'s and the `axes`-state `LineChart`'s own rows), untouched here.
> Altitude: this document owns **why + what-should-exist** for the chart family. The scope/contract-direction decision record is [ADR-0107](../adr/0107-chart-family-v1-scope.md); behavior contract: [`../spec/chart-family.spec.md`](../spec/chart-family.spec.md) · implementation: [`../lld/chart-family.lld.md`](../lld/chart-family.lld.md) (both PROMOTED at doc-review 2026-07-08; filed in the charter homes per that review's F1 ruling — the family chain stays in one filing regime, the a2a precedent). Build decomp: [`../decompositions/chart-family-build.decomp.json`](../decompositions/chart-family-build.decomp.json).
> **Sibling-vs-extension ruling:** this is a **new sibling PRD** (filed under `.claude/docs/prd/` per the authoring charter, the agent-app-surfaces PRD-D6 precedent) — not an extension. Neither existing PRD owns it: `agent-app-surfaces.prd.md` owns app *chrome*, the A2UI expert-system PRD owns *generation reliability*; charts are fleet **content vocabulary** (a `@agent-ui/components` control family with an a2ui catalog surface). The B6 bridge LLD §10 fork 2 explicitly deferred this as "its own PRD-level intake, not a rider on B6" — this document is that intake.
> Grounding: Kim's ratified artifact-feed ask (*"a report as a chart or graph"*, B6 LLD header, 2026-07-08) · [`../lld/a2a-a2ui-bridge.lld.md`](../lld/a2a-a2ui-bridge.lld.md) §5 (the Chart gap "named, not designed") + §10 fork 2 (the deferral) · `CLAUDE.md` (zero-dependency pillar) · [`../references/geometry.md`](../references/geometry.md) (the five size-classes) · [ADR-0087](../adr/0087-a2ui-whole-fleet-catalog-scope-policy.md) / catalog SPEC-N2 (whole-fleet coverage gate) · the `stats-grid-dashboard` seed (`packages/agent-ui/a2ui/src/examples/catalog-coverage.ts`) — the idiom charts must beat.

## 1. Problem

Agents produce quantitative results — reports, metrics, trends, breakdowns — and the fleet can only show them as **printed numbers**. The shipped report vocabulary is the metric-tile idiom (`Grid` of `Card`+`Text` tiles, the `stats-grid-dashboard` seed) and the List-templated table (`dynamic-lists`). Both are good at *latest value*; both are blind to the two questions a report exists to answer pre-attentively:

1. **The shape of a series** — is revenue rising, flat, volatile? A tile shows one number; a table makes the reader integrate every row in their head.
2. **The comparison of magnitudes** — which region dominates, by how much? A table answers only after reading every cell; aligned bars answer at a glance.

The gap is already a recorded defect, not a hypothesis: Kim's ratified artifact-feed shape names *"a report as a chart or graph"* as the demo's centerpiece, and the B6 bridge wave shipped by **substituting** tiles and tables because the default catalog has no chart type — the B6 LLD §5 records the vocabulary-honesty note verbatim (*"the catalog has no Chart type … the Chart gap is named, not designed"*) and §10 fork 2 defers the design here.

**Who has the problem.** (1) *The artifact-feed demo* — the grounded internal instance: its "report" artifacts are tiles-and-tables stand-ins for the chart Kim asked for. (2) *Models emitting A2UI payloads* — asked for "the revenue trend," a model has no honest vocabulary: it can emit the latest number, not the trend. (3) *App developers* embedding agent reports, who would otherwise hand-roll or import a charting library — which the zero-dependency pillar forbids.

**Why charts must beat the stats-grid idiom to earn a place.** The tile/table idiom already covers "latest value + delta" well. Chart types are justified **only** where numbers-as-text structurally fail — series-shape and magnitude-comparison. Anything the existing idiom already serves stays out of scope; that boundary is what keeps v1 small (§3).

## 2. Goals & success metrics

Stable IDs; priority tiers (must/should/could); metrics carry baseline + target + timeframe. Milestones M1/M2 in §4. Downstream SPEC requirements trace to these IDs.

| ID | Priority | Outcome |
|---|---|---|
| **PRD-G1** | must | An agent can emit a chart: series-trend and magnitude-comparison types exist in the fleet and the default catalog |
| **PRD-G2** | must (cross-cutting) | Charts hold every fleet pillar — zero-dep rendering, geometry-law sizing, token theming, AT announcement, cross-engine proof |
| **PRD-G3** | should | The report artifact upgrades: a Gen-UI exemplar teaches models when and how to use charts, and the feed/corpus surfaces inherit it |

**PRD-G1 — An agent can emit a chart (flagship).** The two failing questions in §1 each get a catalog-reachable component type: a series-shape type (sparkline) and a magnitude-comparison type (bar chart), with data props a model can emit as plain JSON.
- *Metric*: chart component types in the default catalog, each validator-clean over a realistic payload.
- *Baseline*: **0** (`catalog.json` declares no chart type; B6 LLD §5 is the recorded evidence).
- *Target*: **≥ 2** (`Sparkline`, `BarChart`) declared, factory-bound, and exercised by a validator-clean exemplar payload.
- *Timeframe*: **M1** (the first build wave — not authorized by this intake).

**PRD-G2 — Charts hold every fleet pillar (cross-cutting).** Chart controls are ordinary `ui-*` citizens: hand-rolled SVG/CSS (no charting library, no runtime dependency), sized under the geometry law's class taxonomy, themed via the token roles (`currentColor`/`--md-sys-color-*`), announced to assistive tech (no chart is silent — a chart is data, not decoration), and proven whole-shape in real browsers.
- *Metric*: the fleet DoD gates over the new controls — `npm run check && npm test`, the browser legs (Chromium + WebKit), descriptor trip-wires, `npm run size` — plus an a11y probe per type asserting the announced role + accessible name/structure.
- *Baseline*: n/a (no chart controls exist).
- *Target*: **all gates green at M1**, including the a11y probes and a whole-shape browser assertion (a bare chart in a realistic container paints a visible, non-collapsed box — the fleet's test-the-whole-shape law).
- *Timeframe*: **M1**.

**PRD-G3 — The report artifact upgrades.** The artifact-feed's natural upgrade: a **report-card exemplar seed** (metric tile + sparkline trend + bar-chart region breakdown, composing `Card`/`Text` with the new types) joins the examples shelf, so models are *taught* the idiom — including when a chart beats a tile — and the corpus/derived-prompt surfaces re-validate over the widened catalog (the ADR-0087 consequence pattern).
- *Metric*: exemplar seeds containing chart types, validator-clean and rendered in the examples surfaces.
- *Baseline*: **0** (the closest existing seed is `stats-grid-dashboard`, chart-free by necessity).
- *Target*: **≥ 1** report-card exemplar in `allSeeds`, validator-clean, with usage-guidance prose in the catalog SPEC §5.2 Notes (the ADR-0087 Fork-A "specific guidelines" precedent); corpus + derived prompt re-validated.
- *Timeframe*: **M2**.

## 3. Scope

**In scope (v1):**
- `ui-sparkline` — inline, tiny, **zero-axis** series-shape mark (line, with an area variant), sized to live inside a metric tile or a text line.
- `ui-bar-chart` — **axis-free** labeled bar comparison (per-datum label + bar + printed value; no ticks, no gridlines, no legend — the value is printed, so no axis is owed).
- `ui-pie-chart` — **v1.1, ADR-0219**: the part-of-whole mark (`variant: 'donut' | 'pie'`, default `donut`), reusing `BarChart`'s `{label, value}[]` data row. Identity per slice carries by order + label + printed percent + a single-family lightness-ramp fill (never hue alone, ADR-0057); the legend IS a real-DOM key list (`role=list`), never an SVG legend layer — the same axis-free, no-analysis posture as `Sparkline`/`BarChart`.
- **v1.2, ADR-0228/ADR-0229 (svg-charts wave 1, GH #1565):** the shared axis/inset/series vocabulary (`controls/_chart/` — pure nice-number axis math + the shared chrome CSS: the two-layer full-bleed model, chip-label collision rules, the `--ui-chart-series-{1..6}-ink` ramp `ui-pie-chart`'s own ramp now aliases) and `ui-column-chart`, the family's fifth control: a category-major stacked (or dense single-series) column mark (`data: {label, values[]}[]` + `series[]`), nice-number gridlines, real-DOM tick/category-label pills, a projected/ghost trailing column, a baseline-dot-plus-short-tick now-marker, and a static `highlight` callout (zero-event, display tier unchanged). `role=img` + a generated summary (per-series totals/extents), not `role=list` — per-datum totals do not read cleanly as a flat list.
- **v1.3, ADR-0229 cl.3 (svg-charts wave 2, GH #1566):** `ui-line-chart` gains an opt-in `axes` state
  (EXTENDING ADR-0205, whose default state stays byte-for-byte untouched) consuming the SAME shared
  `_chart/` vocabulary — nice-number gridlines + tick-label chips over the series' own `[min,max]`
  domain, optional category-label chips (`labels: string[]`, index-aligned; absent ⇒ value ticks only),
  the provisional/now-marker system (`projected`, the `ui-column-chart` mechanism reused for the time
  axis), and a gradient-to-transparent area fill (`variant="area"`, applying in BOTH states — an SVG
  `<linearGradient>` paint upgrade, not a DOM-shape change). ADR-0205's own cl.3 "min/max labels always
  shown" law becomes default-state-scoped once `axes` exists.
- **v1.4, ADR-0229 cl.4 (svg-charts wave 3, GH #1567):** `ui-gauge`, the family's sixth control — a
  multi-ring radial gauge: `data: {label, value}[]` (the fleet row verbatim), each ring an INDEPENDENT
  0-100 progress value (never part-of-whole — a gauge with three rings never sums them), outer→inner in
  data order, stepping the shared `--ui-chart-series-{1..6}-ink` ramp; a real-DOM label/value legend
  column (`role=list`/`role=listitem`, the `ui-pie-chart` key-list pattern) is the ONLY accessible
  rendering, never a generated `role=img` summary. Consumes the SAME shared `_chart/` inset mechanism
  (ADR-0228 cl.1-3), generalized to a radial mark — the rings layer bleeds edge-to-edge at zero inset,
  the legend column floats on top inset by exactly `--ui-gauge-chrome-inset`; the axis/tick/gridline/
  today-marker/projected chrome stays N/A (ADR-0228's own per-mark N/A grammar for radial types).
- Same-wave default-catalog rows (`Sparkline`, `BarChart`, `PieChart`) + the report-card exemplar seed (PRD-G3) — forced by the SPEC-N2 whole-fleet gate the moment the descriptors land. `ColumnChart`'s, `Gauge`'s, and the `axes`-state `LineChart`'s own catalog rows are a named FOLLOW-UP wave (ADR-0229 cl.7, GH #1568) — each control ships its own wave with a named allowlist entry, never a rider.

**Out of scope (v1) — the fence, each with its reason:**
- ~~**Axis systems**~~ **(ticks, gridlines, scale labels, legends)** — where chart scope explodes; the v1 types are chosen precisely because neither owes an axis. **Realized, scoped to `ui-column-chart` (v1.2) AND `ui-line-chart`'s `axes` state (v1.3) — ADR-0228/ADR-0229, ADR-0107 Amendment 4** — every other axis-bearing type (scatter, log/dual axes, a typed time axis) remains a **new intake**, never a rider. `ui-gauge` (v1.4) is explicitly a RADIAL, axis-free mark — ADR-0228's own N/A grammar excludes it from this axis-system vocabulary entirely; its real-DOM legend is admitted under the SAME `ui-pie-chart`/ADR-0219 key-list precedent, not this fence. Legends otherwise stay fenced for every axis-bearing type (the `ui-column-chart`/`ui-line-chart` chip vocabulary is not a legend).
- ~~**Pie/donut**~~ — **admitted under ADR-0219's conditions (v1.1, 2026-08-19).** The original fence read: "angle is a low-accuracy perceptual channel and typical pie coloring is hue-only category encoding, colliding with the fleet's non-color-signifier posture (the open CVD finding); aligned bars answer the same proportion question with the strongest channel." Tested against mechanics, that closing claim proved only half-true — `BarChart` encodes magnitude, not a visible whole — and each of the three conditions (angle, hue-only identity, the legend) now has a by-construction answer (`ui-pie-chart`, above); see [ADR-0219](../adr/0219-pie-donut-part-of-whole-chart.md) for the full analysis. `Scatter`/`line-with-axes`/`multi-series`/`stacked-bars` (below) remain fenced — this admission is scoped to the single part-of-whole mark, not a general axis-system opening.
- **Scatter, line-with-axes, multi-series, stacked/grouped bars** — all drag axes, legends, or series-color systems (the same explosion). ~~Stacked/multi-series COLUMNS~~ **realized (v1.2, `ui-column-chart`, ADR-0228/ADR-0229)** — `ui-bar-chart` itself stays exactly as fenced (axis-free, no stacking, its own foreseen `orientation` flip untouched). ~~`ui-line-chart`'s single-series `axes` state~~ **realized (v1.3, ADR-0229 cl.3)** — single-series only, ADR-0205 cl.2's multi-series deferral stays UNTRIGGERED and unchanged; scatter and true multi-series line/legend vocabulary, and grouped (non-stacked) bars remain fenced.
- **Hover tooltips / data exploration, zoom/brush, animation** — interaction machinery a report artifact doesn't need; charts here are display-class output, not analysis tools.
- **Time-axis handling** (`{x,y}` pairs, irregular intervals) — v1 series are ordinal (evenly spaced by index).
- **Streaming point-append APIs** — data arrives as whole-array prop swaps (matching A2UI `updateDataModel` semantics anyway).
- **Any third-party charting library**, including build-time vendoring — the zero-dep pillar; vendored *code* is a runtime dependency in costume (unlike the icons pack's inert data — ADR-0107 Alternatives).

## 4. Milestones

| Milestone | Delivers | Gate |
|---|---|---|
| **M0 (this intake)** | This PRD + ADR-0107 (scope + contract directions + Kim forks) — docs only | doc-review + Kim's fork answers; harness gates green |
| **M1** | The two controls + descriptors + same-wave catalog rows + a11y/browser/geometry probes (PRD-G1, PRD-G2) | fleet DoD + SPEC-N2 fleet-derived gate green with **no allowlist residue** |
| **M2** | Report-card exemplar + §5.2 usage guidance + corpus/prompt re-validation; feed surfaces inherit (PRD-G3) | examples/corpus gates green; exemplar renders in the gallery |

## 5. Open decisions

The genuine forks were owned by [ADR-0107](../adr/0107-chart-family-v1-scope.md) §Forks and are **resolved** — Kim ratified all three as recommended (2026-07-08, the no-objection default): **F1** = `ui-sparkline` + `ui-bar-chart` · **F2** = the horizontal bar-list model (name stays `BarChart`) · **F3** = per-type data shapes (`values: number[]` / `data: {label,value}[]`). The contract *directions* (rendering split, a11y contract, size-class placement, packaging, catalog/feed dispositions) are recorded there; the mechanisms are owned by the SPEC/LLD named in the header. No open decisions remain at PRD altitude.
