# PRD — Chart / Data-Visualization Component Family

> Status: **accepted · v1.0 · Owner: agent-ui** — ratified by Kim 2026-07-08 (the 0107/0109/0110 ratification round, `db025d4`: intake doc-review PASS + Kim's "proceed"; forks F1–F3 stand as recommended, per ADR-0107's Ratified-by cell). Began life as a scope INTAKE (v0.1 proposed, 2026-07-08); this header cell was synced by the design seat when the SPEC/LLD were authored — the ratification pass updated the ADR-side cells only.
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
- Same-wave default-catalog rows (`Sparkline`, `BarChart`) + the report-card exemplar seed (PRD-G3) — forced by the SPEC-N2 whole-fleet gate the moment the descriptors land.

**Out of scope (v1) — the fence, each with its reason:**
- **Axis systems** (ticks, gridlines, scale labels, legends) — where chart scope explodes; the v1 types are chosen precisely because neither owes an axis. Any axis-bearing type is a **new intake**, never a rider.
- **Pie/donut** — angle is a low-accuracy perceptual channel and typical pie coloring is hue-only category encoding, colliding with the fleet's non-color-signifier posture (the open CVD finding); aligned bars answer the same proportion question with the strongest channel.
- **Scatter, line-with-axes, multi-series, stacked/grouped bars** — all drag axes, legends, or series-color systems (the same explosion).
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
