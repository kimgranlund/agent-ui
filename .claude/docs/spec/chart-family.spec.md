# SPEC — Chart Family (`ui-sparkline` + `ui-bar-chart` + catalog surface)

> Status: proposed · v0.1 · 2026-07-08 · Layer: SPEC (execution contract)
> Refines: [`../prd/chart-family.prd.md`](../prd/chart-family.prd.md) — **PRD-G1, PRD-G2, PRD-G3** — under the ratified scope + contract directions of [ADR-0107](../adr/0107-chart-family-v1-scope.md) (accepted; forks F1–F3 as recommended). Every clause of ADR-0107 is binding here; this SPEC adds the behavior contract, it re-litigates nothing.
> Refined by: [`../lld/chart-family.lld.md`](../lld/chart-family.lld.md).
> Altitude: owns **what the two chart controls do and how they behave at every boundary** + the chart rows' catalog contract. Implementation (path math internals, CSS mechanics, file layout) is the LLD's. Filed in the charter home (`docs/spec/`, the a2a-family regime — doc-review F1 ruling 2026-07-08); the catalog surface (§5.2 of [`../spec/a2ui-catalog.spec.md`](../spec/a2ui-catalog.spec.md)) stays a first-class same-wave deliverable, cross-referenced.
> Requirement IDs file-scoped (`SPEC-R1…`); cross-document references qualify by doc name.

---

## 1. Purpose

Contract the v1 chart family ADR-0107 admits: `ui-sparkline` (the series-shape mark) and `ui-bar-chart`
(the magnitude-comparison bar list), both **axis-free**, hand-rolled under the zero-dep pillar,
Display-class, entering the default catalog (`Sparkline`, `BarChart`) in the same wave they ship. The
fence stands: anything in PRD §3's ruled-out list (axes, pie, multi-series, interaction, time axes,
streaming appends) is out of this SPEC's normative reach.

## 2. Definitions

- **Series** — the ordered finite-number array a sparkline draws; order is data order; spacing is ordinal (by index).
- **Datum** — one `{ label, value }` bar-chart entry; a **valid datum** has a `string` label and a finite `number` value.
- **Rendered set** — the input after hardening (SPEC-R3/R7): invalid entries dropped, order preserved. All rendering AND announcement derive from the rendered set, never the raw input.
- **Zero baseline** — the shared origin bar lengths measure from: `lo = min(0, min(values))`, `hi = max(0, max(values))`.

## 3. Requirements

Normative per RFC 2119; each carries an ID, PRD trace, and acceptance criteria.

### 3.1 `ui-sparkline`

**SPEC-R1 — Component contract.** `ui-sparkline` MUST be a Display-class, non-interactive, non-form-associated leaf (`UIElement`; no events, no keyboard contract, no children content model) with exactly three props: `values` (`number[]`, default `[]`; attribute form = the JSON string), `label` (`string`, default `''` — the accessible context, e.g. "Revenue trend"), and `variant` (`'line' | 'area'`, default `'line'`). *(→ PRD-G1; ADR-0107 cl.1/2)*
- **AC1** *Given* `<ui-sparkline values="[3,5,4,8,7]">`, *when* connected, *then* it renders the line mark and `el.values` is the typed array `[3,5,4,8,7]`.
- **AC2** *Given* the descriptor (`sparkline.md`), *then* `tier: display`, `extends: UIElement`, `events: []`, and the `attributes[]` block mirrors `static props` (the descriptor↔props trip-wire).

**SPEC-R2 — Rendering.** The mark MUST be component-built inline SVG that scales to any box, inherits ink (currentColor), and keeps a crisp constant-width stroke at any size/DPR (the exact SVG attribute set — normalized viewBox, `vector-effect: non-scaling-stroke`, `preserveAspectRatio: none` — is pinned by ADR-0107 cl.3 and normatively owned by the LLD; cited here, not restated); `variant="area"` adds the same polyline closed to the baseline as a low-alpha `currentColor` fill under the stroke. No SVG text, no canvas, no library. The mark is derived state: setting `values`/`variant` re-renders; the swap is whole-array (A2UI `updateDataModel` semantics — no append API). *(→ PRD-G1, PRD-G2; ADR-0107 cl.3)*
- **AC1** *Given* a rendered sparkline, *when* its box is resized (wider/taller), *then* the mark fills the new box and the computed stroke width is unchanged (non-scaling stroke).
- **AC2** *Given* `variant="area"`, *then* a fill path is present under the stroke at the token alpha; *given* `variant="line"`, no fill path.
- **AC3** *Given* the surrounding `color` changes (theme/state), *then* the mark's stroke follows it with no component code (currentColor).

**SPEC-R3 — Input hardening & degenerate series.** All behavior derives from the rendered set. Required handling, per case — none may throw, and every case still paints the host box (SPEC-R9's floors) and announces (SPEC-R4):

| Input | Rendered mark | Notes |
|---|---|---|
| `[]`, absent, or malformed attribute JSON / non-array value | none (empty host) | malformed JSON MUST NOT throw — the prop codec falls back to `[]` |
| non-finite entries (`NaN`, `±Infinity`, non-numbers) | dropped, remainder renders | the rendered set is what the summary counts |
| exactly 1 finite point | a visible point mark at vertical center | not a line (a single point has no shape) |
| all-equal values (`max === min`, n ≥ 2) | a horizontal line at vertical center | the zero-range normalization case |
| negative values | normalized within `[min, max]` — same math, no special case | auto range per ADR-0107 cl.2 (explicit `min`/`max` overrides are the foreseen extension, not v1) |

*(→ PRD-G2; ADR-0107 Consequences "degenerate data … all hand-gated")*
- **AC1** *Given* each row above, *when* rendered, *then* the stated mark results, no exception escapes, and the host box still paints (whole-shape law).
- **AC2** *Given* `values="[1, null, 2, \"x\", NaN]"` set as a property with invalid members, *then* the rendered set is `[1, 2]` and the summary says 2 points.

**SPEC-R4 — A11y contract (the announced summary).** A sparkline is data, not decoration: `role=img` via `ElementInternals` (never host attributes), with a **generated accessible name** — there is no silent state, with or without `label`. The name is `label` (when non-empty) + `": "` + the computed summary over the rendered set:

- **n ≥ 2:** `{n} points, starts {first}, ends {last}, low {min}, high {max}`
- **n = 1:** `1 point, value {v}`
- **n = 0:** `no data`

Numbers are formatted with the platform default-locale `Intl.NumberFormat` (the same formatting SPEC-R6 prints). *(→ PRD-G2; ADR-0107 cl.4)*

> **The verbosity ruling (the doc-review's SPEC-reopenable item, decided here).** Candidates weighed:
> (a) *terse* — count + endpoints only; (b) *full facts* — count + endpoints + extrema (**chosen**);
> (c) *interpretive* — a computed trend word ("rising"); (d) *full enumeration* — read every value.
> (b) wins because the two questions a sparkline exists to answer (PRD §1: shape + volatility) need
> endpoints AND extrema; the cost over (a) is ~6 words. (c) is rejected as unsound, not just verbose — a
> computed "rising" on a non-monotonic series asserts an analysis the mark does not make. (d) is
> unbounded; the honest lossiness of a summary is ADR-0107's recorded cost, and the foreseen extension
> (author long-description / data-table fallback) stays out of v1. The English-only wording is a known
> limitation of the fleet (no i18n layer), stated, not hidden.

- **AC1** *Given* `label="Revenue trend"` and rendered set `[3,5,4,8,7]`, *then* `internals.role === 'img'` and the accessible name is `Revenue trend: 5 points, starts 3, ends 7, low 3, high 8`.
- **AC2** *Given* no `label` and an empty rendered set, *then* the name is `no data` and the element is still `role=img` — never `aria-hidden`, never nameless.
- **AC3** *Given* the a11y probe reads the computed name for n=1 and all-equal inputs, *then* the SPEC-R4 wordings hold exactly (the probe pins the sentence forms).
- **AC4** *Given* rendered set `[1200, 3400]` under the test environment's `en-US` default locale, *then* the name reads `2 points, starts 1,200, ends 3,400, low 1,200, high 3,400` — the `Intl.NumberFormat` grouping is observable, not merely asserted.

### 3.2 `ui-bar-chart`

**SPEC-R5 — Component contract.** `ui-bar-chart` MUST be a Display-class, non-interactive, non-form-associated leaf with exactly two props: `data` (`{ label: string; value: number }[]`, default `[]`; attribute form = the JSON string) and `label` (`string`, default `''`). The name is `BarChart`/`ui-bar-chart` even though v1 renders the horizontal bar-list model (fork F2's ratified naming). *(→ PRD-G1; ADR-0107 cl.1/2, fork F2/F3)*
- **AC1** *Given* `{ "component": "BarChart", "data": [{ "label": "EMEA", "value": 42 }, { "label": "APAC", "value": 31 }] }` rendered via the catalog, *then* two rows render, EMEA's bar longer than APAC's, values printed.
- **AC2** *Given* the descriptor (`bar-chart.md`), *then* `tier: display`, `events: []`, attributes mirror `static props`.

**SPEC-R6 — Rendering (the bar-list model).** One row per valid datum, in data order: **label · bar · printed value** on a shared grid so bars are length-comparable and labels/values stay **real DOM text** (selectable, wrapping, token-typed — no SVG text). Bar length is proportional to `|value|` over the zero-baseline span; when negatives are present, bars **diverge** from the shared zero point (negative bars extend toward inline-start of it) — still axis-free: no ticks, no gridlines, no legend, no scale labels. Every value is printed with the default-locale `Intl.NumberFormat` (signed values keep their sign) — the printed value is the datum's exact reading, which is why no axis is owed. Long labels wrap within a bounded label column rather than truncating silently or starving the bars. *(→ PRD-G1, PRD-G2; ADR-0107 cl.3, fork F2)*
- **AC1** *Given* values `[40, 20, 10]`, *then* rendered bar inline-sizes are within ε of the 4:2:1 proportion.
- **AC2** *Given* `[-20, 10, 30]`, *then* all three bars measure from one shared zero offset, the `-20` bar extends to the inline-start side of it, and the printed values read `-20`, `10`, `30` (locale-formatted).
- **AC3** *Given* a label longer than the label column, *then* it wraps (row grows block-wise); the bar and value cells remain visible and aligned.

**SPEC-R7 — Input hardening & degenerate data** *(→ PRD-G2)*. Same discipline as SPEC-R3, per case — none may throw:

| Input | Rendering |
|---|---|
| `[]`, absent, malformed attribute JSON, non-array | zero rows; the host announces an empty list (SPEC-R8) |
| entries that are not valid datums (missing/non-string label, non-finite value) | dropped; remaining rows render in order |
| exactly 1 valid datum | one full row; its bar spans the full track (it is the max) |
| all-equal positive values | all bars full length — equality visible at a glance |
| all-zero values | all bars zero length; printed `0`s carry the reading |
| all-negative values | the shared zero point sits at the track's inline-end (`hi = max(0, …) = 0`); every bar extends toward inline-start of it, longest = most negative; printed signed values carry the reading |
| duplicate labels | both rows render (the list is positional, not keyed) |

- **AC1** *Given* each row above, *then* the stated rendering, no exception, and (for non-empty rendered sets) a painted, non-collapsed host.

**SPEC-R8 — A11y contract (list semantics).** Via `ElementInternals`: the host is `role=list` (the `ui-list` precedent) named by `label` when non-empty; each rendered row is a `role=listitem` node whose text content announces the label and the **printed value — the accessible datum**. The visual bar (track + fill) is `aria-hidden`: it repeats the value in the length channel and MUST NOT be announced. No datum is color-encoded only: magnitude travels by length + printed number (position/length encoding is CVD-safe by construction — ADR-0057 conformance is structural, no intent-role is used to carry meaning). *(→ PRD-G2; ADR-0107 cl.4; ADR-0057)*
- **AC1** *Given* two valid datums, *then* `internals.role === 'list'` and exactly two `role=listitem` descendants exist, each containing the label text and the formatted value text.
- **AC2** *Given* the bar/track nodes, *then* they carry `aria-hidden` and no text.
- **AC3** *Given* an empty rendered set, *then* the host remains `role=list` with zero items (AT reads "list, 0 items" — the honest empty state).

### 3.3 Cross-cutting (both controls)

**SPEC-R9 — Tokens, defaults, and the CSS-less consumer.** Mark geometry rides component-owned tokens — `--ui-sparkline-*` / `--ui-bar-chart-*`, density-invariant px/em quantities per ADR-0107 cl.5 (the declaring-selector mechanics — the standard specificity-0 token block — are the LLD's, per the fleet convention). Under **ADR-0102 Lane A**, every rendered-correctness concern has a component-owned safe default: a bare, unsized chart in any container (including a flex row) MUST paint a visible, non-collapsed, proportionally-correct box with zero consumer CSS — sizing floors are token defaults, and page-author CSS survives only as override freedom. Ink defaults: sparkline = `currentColor`; bar fill = a token defaulting to a fleet color role with ≥ 3:1 contrast against the surface (WCAG 1.4.11 — the fill is the data-bearing graphic; the track is decorative). *(→ PRD-G2; ADR-0102; ADR-0107 cl.5)*
- **AC1** *Given* a bare `<ui-sparkline values="[1,5,2]">` and a populated `<ui-bar-chart>` each inside an unstyled flex row, *when* painted (browser, both engines), *then* each bounding box ≥ its token floor — never a dot/sliver (test-the-whole-shape).
- **AC2** *Given* the family-coherence token gate, *then* each control's `:where()` block declares only its own `--ui-{name}-*` (∪ shared allowlist).

**SPEC-R10 — Forced colors (WHCM).** Both marks MUST remain legible under `forced-colors: active`: the sparkline stroke follows the forced ink (currentColor resolves to the consuming context's system color — the `ui-icon` precedent); the bar fill MUST render in a system ink (an explicit `forced-colors` block — a background-drawn fill is otherwise forced to `Canvas` and vanishes), with the track distinguishable from the fill; the printed value is real text and survives untouched. *(→ PRD-G2)*
- **AC1** *Given* forced-colors emulation (browser leg), *then* the sparkline stroke and every bar fill paint in system inks (computed-style assertion — the ADR-0102 sanctioned visual proof), and fill ≠ track rendering.

**SPEC-R11 — RTL.** In an RTL context: `ui-bar-chart` rows follow the writing direction (labels at inline-start, values at inline-end, bars grow from inline-start — logical CSS throughout, no physical-direction assumptions); `ui-sparkline` **keeps its series direction physical left→right** — chronology/order is data order, and series charts conventionally keep LTR reading in RTL locales (the SVG coordinate space is deliberately not mirrored). *(→ PRD-G2)*
- **AC1** *Given* `dir="rtl"` (browser leg), *then* bar rows mirror (measured positions) and the sparkline's first point remains at the physical left edge.

**SPEC-R12 — Geometry posture (Display class).** Neither control takes a `[size]` attribute, a `[scale]` geometry row, or any control height (`geometry.md` five-class table; ADR-0107 cl.5 — a size-ramped chart is a future geometry-law conversation, not a token addition). `ui-sparkline` sizes relative to its type context (em/lh-derived token defaults — the `ui-icon` `1em` posture, widened to a mark box). `ui-bar-chart` is text-bearing display: labels/values read the `--md-sys-typescale-*` matrix (ADR-0078); row rhythm rides the `--ui-space` ladder (density-responsive for free — the ADR-0103 radio-group precedent); mark geometry (stroke width, bar thickness) is density-invariant. *(→ PRD-G2)*
- **AC1** *Given* `[density]` on an ancestor, *then* bar row gap changes and stroke width / bar thickness / floors do not.
- **AC2** *Given* the descriptor geometry blocks, *then* neither declares a `size` attribute nor consumes `--ui-height-*`.

### 3.4 Catalog + teaching surface

**SPEC-R13 — Catalog rows, same wave.** The default catalog MUST declare `Sparkline` and `BarChart` in the same wave the descriptors land (SPEC-N2's fleet-derived gate, ADR-0087; end-of-wave allowlist residue: none). Both rows are **display-only**: one-way props, **no `value:{prop,event}` mark** (no ADR-0019 seam slot consumed), no children. Row contracts (the `a2ui-catalog.spec.md` §5.2 table gains these rows in the same change — that table stays the normative coverage home; this SPEC is their derivation):

| A2UI type | `ui-*` widget | Properties |
|---|---|---|
| `Sparkline` | `ui-sparkline` | `values` (array of number, **bindable**, `mapsTo: values`) · `label` (string, bindable) · `variant` (enum `line`/`area`, non-bindable — structural) |
| `BarChart` | `ui-bar-chart` | `data` (array of `{label: string, value: number}` objects, **bindable**, `mapsTo: data`) · `label` (string, bindable) |

The rows declare full item schemas; the shared validator MUST accept literal arrays/objects for these props at least at top-level type depth (deeper per-item checking is permitted, not required, in v1 — the components' own hardening SPEC-R3/R7 is the safety net either way, and a data-model `{path}` bind resolves to the same typed arrays). *(→ PRD-G1, PRD-G3; ADR-0107 cl.6)*
- **AC1** *Given* the fleet-derived coverage gate over the shipped descriptors, *then* `Sparkline` + `BarChart` are declared AND factory-bound with zero allowlist residue.
- **AC2** *Given* the ADR-0107 cl.2 example payloads (verbatim), *when* validated via `validateA2ui`, *then* 0 `CATALOG` errors; *given* `values` bound as `{ "path": "/trend" }` with an array in the data model, *then* the sparkline renders that series and re-renders on `updateDataModel`.

**SPEC-R14 — Teaching: guidance + exemplar.** The catalog SPEC §5.2 Notes MUST gain the when-to-use guidance (ADR-0087 Fork-A style): *metric tile for a latest value · `Sparkline` for the shape of a series · `BarChart` for comparing magnitudes · `List` table when exact values must be scanned row-by-row.* The examples shelf MUST gain the **report-card exemplar seed** (Card + Text + Sparkline trend + BarChart breakdown — the `stats-grid-dashboard` upgrade), validator-clean, in `allSeeds`; corpus + derived prompt re-validate over the widened catalog (the ADR-0087 consequence pattern). *(→ PRD-G3)*
- **AC1** *Given* the exemplar seed, *then* `validateA2ui` reports 0 errors and it renders in the examples surface (browser-verified).
- **AC2** *Given* the corpus/derived-prompt gates, *then* they run green over the widened catalog.

*(ADR-0107 cl.8 trace — a deliberate no-op: no ADR-0097 `FEED_SURFACE_TYPES` edit is owed or permitted in this wave; charts reach the artifact feed via its full-catalog rendering.)*

## 4. Non-functional requirements

| ID | Requirement | Target |
|---|---|---|
| **SPEC-N1** | Zero runtime dependency | No charting library, no vendored chart code, no new package (ADR-0107 cl.7 — ordinary `controls/{sparkline,bar-chart}/` folders); imports point inward only |
| **SPEC-N2** | Cross-engine proof | jsdom is blind to painted SVG/graphic geometry — browser legs (Chromium + WebKit) are mandatory per control: whole-shape, proportion, WHCM, RTL |
| **SPEC-N3** | Fleet gates stay green | file-set, family-coherence, descriptor↔props trip-wires, site per-tier page set (`{name}-doc.html` for tier=display), `npm run check && npm test` |
| **SPEC-N4** | Size budget honesty | `npm run size` run at the build wave (manual, ADR-0040); the ADR-0049 family budget re-base, if needed, recorded — never silently absorbed |
| **SPEC-N5** | Series cost posture | Rendering is O(n) over the rendered set with **no point cap** in v1 (a 10k-point series renders; responsiveness is the author's data-size judgment) — the LLD §7 ledger's huge-series row realizes this, it does not invent it |

## 5. Open items (non-normative)

- Foreseen extensions, deliberately out of v1 (each re-enters only by its own record): explicit `min`/`max` range overrides · bar `orientation` (vertical columns, fork F2) · a number-format prop · an author-supplied long-description/data-table a11y fallback · any axis-bearing type (a **new intake**, per the fence).

## 6. Traceability

| Requirement | PRD goal(s) |
|---|---|
| SPEC-R1–R8 | PRD-G1 (the two types exist and behave), PRD-G2 (fleet pillars: a11y, degenerates) |
| SPEC-R9–R12 | PRD-G2 (tokens, WHCM, RTL, geometry law, CSS-less consumer) |
| SPEC-R13 | PRD-G1 (catalog-reachable), PRD-G3 (rows feed the teaching surface) |
| SPEC-R14 | PRD-G3 (exemplar + guidance + corpus re-validation) |
| SPEC-N1–N5 | PRD-G2 (zero-dep, cross-engine, gates, size, series cost) |
