# ADR-0107 — Chart family v1 scope: `ui-sparkline` + `ui-bar-chart`, axis-free, hand-rolled SVG/CSS, Display-class, same-wave catalog rows

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-08
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-07-08 |
> | **Proposed by** | planner (design seat — the chart-family intake, Kim-authorized from the artifact-feed ask; B6 bridge LLD §10 fork 2 is the deferral this intake answers) |
> | **Ratified by** | Kim (host) · 2026-07-08 — Status flipped by Kim's own edit ("proceed") after the intake doc-review (PASS, minor-only, no blocking fix); forks F1–F3 stand as recommended (the stated no-objection default) |
> | **Repairs** | NEW [`../prd/chart-family.prd.md`](../prd/chart-family.prd.md) (authored in this same change — the owning doc whose scope §3 + goals this ADR pins) · the B6 bridge LLD §10 fork-2 row gains its "answered-by" pointer **at ratification** (coordinator housekeeping — that LLD is under doc-review; not edited mid-review per the serialize-maker-and-reviewer rule) |
> | **Supersedes / Superseded by** | (none) — relates [ADR-0087](./0087-a2ui-whole-fleet-catalog-scope-policy.md) (the whole-fleet catalog gate clause 6 obeys) · [ADR-0097](./0097-a2ui-feed-embedded-asks.md) (the ask-feed partition clause 8 leaves untouched) · [ADR-0065](./0065-icon-adapter-swappable-pack-architecture.md) (the pure-core+subpath precedent clause 7 weighs and declines) · [ADR-0102](./0102-css-less-consumer-contract-law.md) (any chart default must survive the CSS-less consumer) · [ADR-0078](./0078-ui-text-three-axis-variant-size-as.md) (the type tokens bar-chart labels read) |

## Context

Kim's ratified artifact-feed shape names *"a report as a chart or graph"* as the demo centerpiece, and the
default catalog **cannot express one** — the B6 bridge wave shipped by substituting metric-tile Grids and
List tables, recording the gap verbatim (B6 LLD §5: *"the catalog has no Chart type … the Chart gap is
named, not designed"*) and deferring the design to *"its own PRD-level intake"* (§10 fork 2). That is the
forcing constraint: the ask is ratified, the vocabulary does not exist, and no downstream doc may design it
as a rider on another wave.

Two standing laws bound the solution space before any taste enters. **(1) The zero-dependency pillar**
(CLAUDE.md) rules out every charting library — d3, chart.js, uPlot, all of them — so **every mark is
hand-rolled and hand-gated**; the scope decision *is* the cost decision. **(2) Chart scope explodes at the
axis system** — ticks, scale labels, gridlines, legends, label-collision handling are where a "small chart"
becomes a rendering framework. A v1 boundary is therefore only defensible where it needs **no axis at all**.
A third, open finding shapes the type choice: the fleet's CVD audit (the pending non-color-signifier rule)
penalizes any encoding that leans on hue alone.

## Decision

**We will admit a chart family into the fleet with a deliberately axis-free v1 — `ui-sparkline` +
`ui-bar-chart` — hand-rolled under the zero-dep pillar, placed in the existing Display size-class, entering
the default catalog in the same wave they ship.** One decision — the v1 scope + contract direction — realized
in eight clauses; SPEC/LLD own the mechanisms at build (PRD-G1/G2/G3 trace).

1. **The v1 type set** *(PRD-G1)*: `ui-sparkline` (inline series-shape mark: line, plus an `area` variant —
   the same normalized polyline with a closed low-alpha fill) and `ui-bar-chart` (labeled magnitude
   comparison: per-datum label + length-proportional bar + printed value). Both encode by **position/length**
   — the highest-accuracy perceptual channels, and CVD-safe by construction (no hue-only signifier). Ruled
   out for v1, with the fence in PRD §3: axis systems, pie/donut, scatter, line-with-axes, multi-series,
   interaction/animation, time axes, streaming appends. Any axis-bearing type is a **new intake**.
2. **Data contracts a model can emit as JSON** *(PRD-G1; fork F3)*: `ui-sparkline` takes
   `values: number[]` — e.g. `{ "component": "Sparkline", "values": [3, 5, 4, 8, 7] }`; `ui-bar-chart` takes
   `data: { label: string; value: number }[]` — e.g.
   `{ "component": "BarChart", "data": [{ "label": "EMEA", "value": 42 }, { "label": "APAC", "value": 31 }] }`.
   Attribute form is the JSON string; property form is the typed array (the `static props` signal system;
   codec mechanics are LLD business). Range normalization is component-owned (auto min/max); explicit
   `min`/`max` overrides are a *foreseen extension*, not v1.
3. **Rendering follows the mark** *(PRD-G2)*: the **continuous line mark = component-built inline SVG** — a
   normalized-viewBox polyline/path, `stroke="currentColor"`, `vector-effect="non-scaling-stroke"`,
   `preserveAspectRatio="none"`, so it scales to any box, inherits ink, and participates in forced-colors —
   CSS cannot draw it. The **length-proportional box mark = CSS** — grid rows (`label | track | value`) with
   a scaled bar fill — so labels and values stay *real DOM text*: selectable, wrapping, reading the type
   tokens directly, natively visible to AT. No SVG text, no canvas, no library. The path math lives in a
   pure, DOM-free module (unit-testable without a browser), co-located per control (or `controls/_chart/`
   if shared — the `_base`/`_surface` precedent).
4. **A chart is data, not decoration** *(PRD-G2)*: the a11y default **inverts** `ui-icon`'s
   decorative-by-default prior art (ADR-0065 cl.4). `ui-sparkline`: `role=img` via `ElementInternals` with a
   **generated accessible name** — the author-supplied `label` (context, e.g. "Revenue trend") + a computed
   summary (point count, first → last, min/max); with no `label`, the computed summary still announces —
   there is no silent state. `ui-bar-chart`: **list semantics** via internals (the `ui-list` precedent), one
   row per datum announcing "label, value"; the visual bar itself is aria-hidden (the printed value is the
   accessible datum). ARIA via `ElementInternals`, never host attributes (fleet law).
5. **Size class: Display — no new class** *(PRD-G2)*: per `geometry.md`'s five-class table, charts take no
   control height and no `h/2` law. `ui-sparkline` is a non-text display mark sized relative to its type
   context (the `ui-icon` `1em`-default precedent; exact default box + a min-inline-size floor are LLD
   business under the test-the-whole-shape law — a bare sparkline in a flex row must paint visibly, not
   collapse to a dot). `ui-bar-chart` is text-bearing display: labels/values read the
   `--md-sys-typescale-*` matrix (ADR-0078); row rhythm rides gap tokens. Mark geometry (stroke width, bar
   thickness, area alpha) gets its own `--ui-{sparkline,bar-chart}-*` tokens declared in the standard
   `:where()` block — density-invariant px quantities, not `[scale]` lookups.
6. **Catalog + Gen-UI teaching, same wave** *(PRD-G1/G3)*: the SPEC-N2 fleet-derived gate (ADR-0087) forces
   catalog-or-allowlist the moment a descriptor lands, so the build wave lands `Sparkline` + `BarChart`
   catalog rows **in the same wave** as the controls (intra-wave allowlist seed-and-drain permitted;
   end-of-wave residue: none). Both are **display-only rows** — one-way props, no `value:{prop,event}` mark,
   so no ADR-0019 seam slot is consumed. The wave also lands the **report-card exemplar seed** (Card + Text
   + Sparkline trend + BarChart breakdown — the `stats-grid-dashboard` upgrade and the artifact-feed's
   natural upgrade) plus §5.2 Notes usage guidance in the ADR-0087 Fork-A style: *tile for a latest value ·
   Sparkline for the shape of a series · BarChart for comparing magnitudes · List table when exact values
   must be scanned row-by-row.*
7. **Packaging: no new package** — the `@agent-ui/icons` pure-core+subpath split (ADR-0065) was justified by
   **inert vendored data mass**; charts carry no data corpus — only small pure math. A third lower-tier
   sibling would widen the layering trip-wire allowlist (a deliberate ADR-worthy cost per ADR-0065 itself)
   for no benefit at this size. Charts are ordinary `controls/{sparkline,bar-chart}/` folders; the *pattern*
   borrowed is only the pure-core split *inside* the folder (clause 3).
8. **Feed-policy disposition**: ADR-0097's `FEED_SURFACE_TYPES` (the ask partition) does **not** gain chart
   types — asks are commit-gated questions, and that partition's exclusions exist precisely to keep
   dashboards out of ask bubbles. Charts are report *content*: they reach the artifact feed automatically
   through its full-catalog rendering (B6 LLD §7/§10 fork 3). Zero policy edit; the two surfaces stay
   distinct.

### Forks for Kim (each with a firm recommendation; the recommendation is the default absent an objection)

- **F1 — the v1 type set.** *Recommend: `ui-sparkline` + `ui-bar-chart`* (as decided above). The live
  alternatives: sparkline-only (cheaper, but cannot serve "break revenue down by region" — the B6 fixture's
  own second exchange — leaving half the ratified ask table-bound); adding line-with-axes (the first
  axis-bearing type — the exact scope explosion this ADR fences out).
- **F2 — the bar-chart model.** *Recommend: horizontal bar-list* (label left · bar center · value right, one
  row per datum): labels stay horizontal real text (no rotation, no cramping), no baseline axis is owed, it
  reads to AT as a list, and it degrades gracefully in narrow feed bubbles. The alternative — vertical
  columns — needs an x-baseline + under-column label strategy and collapses badly in narrow containers; it
  is the *foreseen extension* (an `orientation` prop), not v1. The name stays `ui-bar-chart`/`BarChart`
  (models know "BarChart"; "BarList" is niche vocabulary) even though v1 renders the list model.
- **F3 — the data-prop shape.** *Recommend: per-type shapes* (clause 2: bare `number[]` for sparkline;
  `{label, value}[]` for bars). The alternative — one unified `{label?, value}[]` for both — optimizes for
  the component author, not the emitter: a model emitting a 30-point trend should not fabricate 30 labels,
  and the catalog teaches per-type prop schemas anyway.

## Consequences

- **The fleet now owns chart correctness with no library to blame.** Path math, degenerate data (empty
  array, single point, all-equal values, negative values, NaN), RTL, forced-colors, DPR — all hand-gated.
  jsdom is blind to painted SVG geometry, so **browser legs are mandatory**, per type, both engines.
- **The catalog surface grows by two display types**, so the corpus, eval shards, and derived prompt
  re-validate over the widened catalog (the ADR-0087 consequence pattern) — and models must be *taught* when
  a chart beats a tile (clause 6's guidance prose is an acceptance item, not decoration).
- **The v1 fence will be pushed** — "just add a y-axis" is the predictable next ask. The PRD §3 ruled-out
  list is the fence: any axis system is a new intake with its own cost argument, never a rider on a build
  wave.
- **A verbosity judgment is baked into sparkline a11y**: AT users get a generated summary, not the data
  series; the *foreseen extension* is an author-supplied long-description slot or data-table fallback. Honest
  cost: a summary is lossy.
- **The family size budget (22 KB, ADR-0049) likely re-bases** — two new controls plus SVG-building code;
  measured at the build wave (`npm run size`, the manual ADR-0040 discipline), not guessed here.
- **Display-class placement means no `[scale]`/`[size]` geometry rows** — if a future consumer wants
  size-ramped charts, that is a geometry-law conversation, not a silent token addition.
- **Stale → re-verify at the build wave:** catalog `catalog.json`/`factories.ts`/`index.test.ts` allowlist ·
  catalog SPEC §5.2 rows + Notes · corpus shelf + derived prompt · `examples` barrels/`allSeeds` · the B6
  fork-2 row pointer (ratification housekeeping, per Repairs).

## Acceptance

This is an **intake** ADR — realized in two stages:

- **Intake (this change):** the sibling PRD exists with gates green (`harness_checks.py prd` exit 0); this
  record passes `adr_check.py` and is indexed; the three forks carry firm recommendations awaiting Kim;
  doc-review is dispatched on both records. No code changes.
- **Build wave (M1/M2, separately dispatched):** descriptors land WITH same-wave catalog rows — SPEC-N2
  fleet-derived gate green, allowlist residue none; a11y probes assert `role=img` + computed name
  (sparkline) and per-row list announcement (bar-chart) via internals; whole-shape browser legs paint
  visible, non-collapsed charts in realistic containers (both engines); degenerate-data legs (empty / single
  / all-equal / negative) pass with rendered, non-throwing output; the report-card exemplar validates
  0-`CATALOG`-error through `validateA2ui` and ships with the §5.2 usage-guidance prose.

## Alternatives considered

- **Adopt a charting library, even build-time-vendored (the Phosphor model, ADR-0066).** Rejected: Phosphor
  vendoring works because icon packs are **inert data**; a chart library is **runtime code** — vendoring it
  is a runtime dependency in costume and breaks the zero-dep pillar in substance, plus none of it would obey
  the token/geometry/forced-colors laws.
- **Do nothing — keep composing tiles and tables.** Rejected: B6 did exactly this and the ratified ask
  remains unserved; no composition of `Text` rows can show the *shape* of a series pre-attentively. The
  substitution was the evidence, not the answer.
- **One generic `ui-chart type="line|bar|pie|…"` component.** Rejected: a single component wearing N chart
  types accretes every type's axis/legend/option surface into one folder — the scope explosion relocated,
  not avoided. Per-type components keep each contract small, tree-shakeable, and separately gateable
  (one-folder-per-control law).
- **Canvas 2D rendering.** Rejected: raster output (blurry under DPR churn), no `currentColor`/token
  theming, invisible to forced-colors, no DOM for AT, and it drags a resize/repaint loop. Inline SVG + CSS
  participate in the existing token and WHCM systems for free.
- **A new `@agent-ui/charts` leaf package (the ADR-0065 model).** Rejected for v1 (clause 7): no vendored
  data mass to keep out of the core; widening the layering trip-wire to a third sibling is a real
  architectural cost with no offsetting benefit at ~two small controls. Re-openable if a chart-type corpus
  (e.g. geo shapes) ever appears.
- **Pie/donut in v1.** Rejected on mechanics, not fashion: angle is a low-accuracy perceptual channel;
  segment identity in a pie is typically hue-only (the open CVD finding says the fleet must not signify by
  hue alone); and a pie needs a legend — an axis-system cousin. Aligned bars answer the same proportion
  question with the strongest channel and printed values.
- **Vertical column chart as the v1 bar model.** Rejected as default (fork F2): owes a baseline and an
  under-column label strategy, and collapses in narrow feed bubbles — the primary v1 host. Recorded as the
  foreseen `orientation` extension.

## Amendment — family size budget re-base 25 → 26 KB (2026-07-08, foreseen)

The Consequences-anticipated re-base ("the family size budget … likely re-bases — two new controls plus
SVG-building code") resolved at wave M1-b: the worst-case all-controls barrel measured **25 847 B gz**
against the 25 600 B gz (25 KB) ceiling — over by 247 B. Both controls are individually cheap
(`bar-chart` 447 B gz · `sparkline` 715 B gz marginal through the ADR-0080 T5 leg, well under the ~2 KB
per-control cap); the overage is the legitimate cost of the family's first hand-rolled mark code.
`scripts/measure-size.mjs` ceiling → **26 KB** (26 624 B gz, ~777 B headroom), recorded in its own
re-base comment chain per convention. The per-control ≤~2 KB marginal cap stays the real gate, unchanged.
