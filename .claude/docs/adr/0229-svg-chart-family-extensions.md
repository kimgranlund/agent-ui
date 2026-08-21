# ADR-0229 — svg-chart family extensions: mint `ui-column-chart` (stacked/dense vertical series, projected + now-marker + highlight callout) and `ui-gauge` (multi-ring radial progress with a real-DOM legend), extend `ui-line-chart` with the axes state + gradient area fill, and pin the category-major multi-series data schema

> Source: agent-ui ADR log (this directory — the numbered files ARE the index; status lives in each ADR's own header). · 2026-08-20
>
> | Field | Value |
> |---|---|
> | **Status** | proposed |
> | **Date** | 2026-08-20 |
> | **Proposed by** | planning-leader (design seat — GH #1561, the svg-chart-system intake; due-process Phases 1–2, GH #969; sibling record [ADR-0228](./0228-chart-axis-inset-series-vocabulary.md) carries the shared vocabulary this type-set consumes) |
> | **Ratified by** | *(awaiting Kim — `ratify ADR-0229` on GH #1561, executed by `scripts/adr_ratify.py`, ADR-0149)* |
> | **Repairs** | booked ON RATIFICATION, applied by the build waves (the ADR-0219 precedent): [ADR-0107](./0107-chart-family-v1-scope.md) gains an Amendment pointer (its cl.1 fence rows for *stacked/multi-series columns* and *the axis system* are realized by THIS named intake, scoped to these types — the Amendment-3/ADR-0219 pattern) · [ADR-0205](./0205-line-chart-v1-axis-vocabulary.md) gains an **Extended by ADR-0229** pointer (its cl.7 gridlines/ticks later-list realized, AND its cl.3 "min/max labels are always shown" law becomes default-state-scoped — the tick pills carry the axis values in the `axes` state; its own Decision stands) · [ADR-0223](./0223-fill-by-default-fleet-sizing-contract.md) role (d) closed table gains the two rows clause 6 names (this ADR is the "extended only by ADR" vehicle) · `chart-family.prd.md` version-bumps + `chart-family.spec.md` gains the new R-clauses at the build wave |
> | **Supersedes / Superseded by** | (none) — **Extends ADR-0205** (two-way pointer per doc-standards §1b: its Decision stands; a separate decision builds on it). Relates [ADR-0107](./0107-chart-family-v1-scope.md) (the one-type-per-mark law clause 1 honors) · [ADR-0219](./0219-pie-donut-part-of-whole-chart.md) (the mint-not-variant precedent, the key-list-IS-the-legend law, and the part-of-whole semantics clause 4 must NOT inherit) · GH #1208's `ui-stat` ring variant (the single-ring progress precedent clause 4 weighs) |

## Context

**The gap, measured against the shipped prop surfaces** (GH #1561's own delta table, verified
against the descriptors): `ui-bar-chart` is a HORIZONTAL, axis-free bar LIST (`data:
{label,value}[]`, zero-baseline magnitudes, printed value as the datum, role=list);
`ui-line-chart` is single-series `values: number[]` with min/max labels + baseline only
(`variant: line|area`, role=img); `ui-sparkline` is an inline glyph (R4-exempt); `ui-pie-chart`
is part-of-whole (`{label,value}[]`, negatives dropped as meaningless, key-list legend). None
render vertical/stacked columns, category axes, multi-series data, projected states, a
now-marker, a highlight callout, gradient fills, or concentric progress rings. The GH #1561
boards need all of these, as one system.

**The precedents that decide the shape of the answer.** ADR-0107 rejected the generic
`ui-chart type=…` (one component wearing N marks = the scope explosion relocated) and named
vertical columns a *foreseen `orientation` extension* of the bar LIST — but the boards' column
chart is not an orientation flip: it is multi-series (a different data codec), axis-bearing (a
different anatomy), stacked (a different geometry law — segments sum, negatives are not
meaningful in a stack), and summary-announced (a different a11y model than the printed-value
list). ADR-0219 faced the same fork for pie and ruled MINT, because "row semantics contradict."
ADR-0205 cl.2 deferred multi-series LINE pending a legend/color-key vocabulary — which ADR-0228
now provides for the ordinal-ramp case — but the boards' area chart is SINGLE-series, so that
deferral is not even triggered here. GH #1208 shipped a single conic-gradient progress ring as
`ui-stat variant="ring"` — a one-metric tile, with no concentric composition and CSS-gradient
(not SVG-arc) craft; the boards' gauge is 2–3 concentric rings sharing one center plus a side
legend, i.e. a chart-family mark, not a stat tile.

**Sibling-system study (prior art to mine, not contracts to copy).** The gen-ui-kit Charts 2.0
SPECs — `~/Projects/adia/gen-ui-kit/docs/ops/spec/spec-charts-2-0-foundations.md` (v0.1.0,
2026-08-20, draft) and `…/spec-charts-2-0-ratio-and-surface.md` (v0.1.1, 2026-08-18, draft),
designed against the SAME Figma boards — were read in full for this record (the shared-vocabulary
half of the study is mined in ADR-0228's Context). Two findings bear on THIS record's forks.
(1) Its checker graded a "card-chart" NEW-COMPONENT decomposition **REBUILD**, ratifying
COMPOSITION over existing chart/card/legend/tooltip primitives and foreclosing a new tag
(REQ-F-017) — that verdict concerns the chart-IN-CARD composition, which this record honors
identically (no `ui-chart-card` mint anywhere; charts compose into `ui-card` per ADR-0228 cl.3);
it does NOT bear against per-type chart tags, because gen-ui-kit is a single `chart-ui type=…`
component — the exact generic-type shape ADR-0107 already rejected for this fleet — so the
new-tags question below stays agent-ui's own call from agent-ui's ratified per-type law.
(2) It left today-datum identification OPEN (its OPEN-2: attribute vs per-datum flag vs clock
auto-derivation); this record RULES the agent-ui form as the `projected` trailing count
(clause 2) — data-driven, no clock, no per-datum flag widening the row schema — a deliberate
divergence, named so the two systems' records can cite each other's reasoning.

**Wire viability is a design input, not an afterthought.** The default catalog's JSON-schema
already carries arrays of objects with typed members (the shipped `BarChart`/`PieChart` `data`
rows) — so a nested `{label, values: number[]}[]` row is expressible today; nothing in this
schema class is un-carryable later. Catalog rows themselves are explicitly a FOLLOW-UP per the
issue's own scope.

## Decision

**We will extend the chart family by TWO new controls — `ui-column-chart` (`ColumnChart`) and
`ui-gauge` (`Gauge`) — plus ONE extension of `ui-line-chart` (the axes state + gradient area
fill), all consuming ADR-0228's shared `_chart/` vocabulary, with a category-major multi-series
data schema.** Seven clauses; SPEC/LLD own mechanisms at the build waves.

1. **Mint `ui-column-chart` — never an `orientation` variant on `ui-bar-chart`.** The vertical,
   axis-bearing series mark: columns from a shared zero baseline, the ADR-0228 axis anatomy
   (gridlines, tick pills, category pills), rounded caps per the boards. One control covers the
   boards' TWO column-shaped archetypes because they differ only in data shape, not mode:
   *stacked multi-series* (each category's values stack, ramp-filled per series) and the *dense
   single-series bar run* (many thin columns) are the `values.length > 1` / `=== 1` cases of one
   schema (clause 2). Extending `ui-bar-chart` instead is rejected as the generic-`type` trap
   relocated INSIDE one control: the codec forks (`value` vs `values[]` + series meta), the
   anatomy forks (axis system vs none), the value-semantics fork (a stack drops negatives as
   meaningless — the ADR-0219 hardening class — where the bar list keeps them as legal
   magnitudes), and the a11y model forks (clause 5). `ui-bar-chart`'s own foreseen `orientation`
   extension stays foreseen for the simple axis-free flip and is NOT consumed by this mint.
2. **The data schema is category-major:** `data: { label: string; values: number[] }[]` +
   `series: string[]`, both bindable, the family's safe-codec hardening class (`from(null)=[]`;
   rows dropped unless label is a non-empty string and every value finite and non-negative —
   stack semantics; ragged rows padded with 0 to the series count, never thrown). The row IS the
   category (month, day) — the `ui-bar-chart` `{label, value}[]` grain with `value` widened to
   `values`, which is also how a producer naturally emits time-bucketed rows. `series[k]` names
   the k-th stack segment; series identity = ORDER + printed series label (legend/callout as
   real DOM) + the shared `--ui-chart-series-{k}-ink` fill (ADR-0228 cl.6 — never hue alone).
   Single-series is `values: [n]` with `series` optional — one shape, no union codec. Projected
   state rides `projected: number` (count of trailing rows rendered in ADR-0228 cl.4's ghost
   grammar; the now-marker renders exactly when `projected > 0`, at the actual/projected
   boundary). The highlight callout rides `highlight: number | null` (row index; ADR-0228 cl.5's
   static part). Wire-viable by construction (Context: the catalog schema already carries this
   class).
3. **Extend `ui-line-chart`: an `axes` opt-in state + the gradient area fill.** In the default
   state, ADR-0205's contract is byte-for-byte untouched (baseline + always-shown min/max rows —
   its cl.1 law holds where it was made). The new reflected boolean `axes` swaps the min/max
   rows for the ADR-0228 tick/gridline/category system (category labels from a new optional
   `labels: string[]` aligned by index; absent labels ⇒ value ticks only) — realizing exactly
   the cl.7 later-list ADR-0205 named, as an EXTENSION (its Decision stands; the min/max rows
   and the tick system never render together — the tick pills ARE the value labels in the axes
   state, so cl.3's "an axis-bearing chart shows its axis values" intent is kept, not
   contradicted). `variant="area"` gains the boards' vertical gradient-to-transparent fill as a
   token-driven paint upgrade (`--ui-line-chart-area-fill-*`, an SVG `<linearGradient>` — CSS
   cannot paint a gradient into an SVG fill cross-engine) with the existing flat low-alpha wash
   as the token fallback. Single-series stands (the boards' area chart is single-series;
   ADR-0205 cl.2's multi-series deferral is untriggered and unchanged). Projected/now-marker
   consume the same `projected: number` grammar as clause 2. A separate `ui-area-chart` mint is
   rejected — it would duplicate the polyline mark and codec wholesale for a paint difference.
4. **Mint `ui-gauge` — never a `ui-pie-chart` extension, never composed `ui-stat` rings.**
   2–3 concentric SVG arc rings, each an INDEPENDENT 0–100 progress value (rounded caps, dark
   track ink), plus the side legend as a real-DOM key list — ADR-0219 cl.5's the-legend-IS-the-
   data-list law verbatim: one `role=listitem` row per ring, `{LABEL} · {value%}` (uppercase
   metric labels read the KICKER typescale row, ADR-0078 cl.2b — never ad-hoc font values).
   Data: `data: { label: string; value: number }[]` (the fleet row verbatim; value clamped
   [0,100] — progress semantics, the GH #1208 `percent` precedent, NOT part-of-whole: rings do
   not sum, which is exactly why extending `ui-pie-chart` is rejected — its whole contract is
   `value / Σ rendered`, and multi-ring in ADR-0219 cl.8's later-list, in that record's
   part-of-whole scope, reads as concentric part-of-whole — which these boards are not). Ring fills step the shared series ramp
   outer→inner. Composing N `ui-stat variant="ring"` tiles is rejected: no concentricity, no
   shared center, N separate boxes — a different artifact than the board's single mark.
5. **A11y postures follow the family's two established laws, per mark.** `ui-column-chart` and
   the `axes`-state line chart announce as `role=img` + a generated, never-null summary
   (per-series totals/extents + point count — the ADR-0205 cl.6 pattern; per-datum values are
   not printed in these marks, so the list model would announce nothing a reader can use).
   `ui-gauge` announces as `role=list` whose key rows carry the datum (label + printed percent —
   the ADR-0219 cl.5/cl.7 pattern; the ring SVG is `aria-hidden`). The callout's text is real
   DOM inside the img-role subtree with its fact repeated in the generated summary (the
   ARIA img pruning rule — sighted text + AT parity, the `ui-line-chart` min/max precedent).
6. **ADR-0223 role (d) grows by exactly two ratified rows:** `ui-column-chart` (16em) and
   `ui-gauge` (16em) whole-shape floors — token-overridable, surviving the fill state, the
   chart-family SPEC-R9 class. Both controls ship block-fill conformant with the `sizing-gates`
   DEBT table still EMPTY (the gate's own law for new controls); the closed role-(d) list's
   "extended only by ADR" condition is satisfied by this clause.
7. **Catalog disposition — follow-up wave, gate-honest:** per GH #1561's own scope the
   `ColumnChart`/`Gauge`/line-chart-widening catalog rows are a SEPARATE intake after the
   controls ship. The SPEC-N2 fleet-derived gate (ADR-0087 class) forces catalog-or-allowlist
   the moment a descriptor lands, so the build waves carry `EXCLUSION_ALLOWLIST` entries naming
   the follow-up issue as their drain (the shipped `LineChart` placeholder precedent — an
   allowlist entry with a named drain is bookkeeping, not a design decision). The clause-2
   schema is the wire contract that follow-up implements; no schema decision is deferred to it.

## Consequences

- **Two new control folders + one control extension + the shared `_chart/` layer land across the
  build waves** — sliced per due-process Phase 3 (a natural wave shape: `_chart/` + column-chart
  first, line-chart axes/gradient second, gauge third, catalog follow-up fourth). Each wave runs
  the full family gate ladder (descriptor trip-wires, browser legs both engines, degenerate-data
  legs, forced-colors, `sizing-gates`, size budget — a family-barrel re-base is likely and is
  measured at the wave, the ADR-0107 Amendment-1 discipline, never guessed here).
- **The family now has two column-shaped controls with different contracts** (`ui-bar-chart`
  list vs `ui-column-chart` axis mark) — the SPEC's usage guidance must say when each applies
  (printed-value comparison of few items → bar list; series over categories/time → columns), or
  producers will guess. Booked into the build wave's SPEC delta.
- **`projected`/`highlight`/`labels`/`axes` widen the display-tier prop surface without widening
  the interaction surface** — descriptors stay zero-event; the rubric's API-minimalism dimension
  should still be argued per control at review (three new props on column-chart is the honest
  cost of the boards' grammar, not free).
- **Negative values are meaningless in a stack and are dropped** (clause 2) — a documented
  hardening difference from `ui-bar-chart` (negatives legal), the same documented-divergence
  class ADR-0219 set for pie.
- **Stale → re-verify at the build waves:** `chart-family.prd.md` bump + §3 fence annotations ·
  `chart-family.spec.md` new R-clauses + usage guidance · ADR-0107 Amendment pointer ·
  ADR-0205 Extended-by pointer · ADR-0223 role (d) table + `sizing-gates.test.ts` allowlist ·
  size-budget re-base · token docs test (`--ui-column-chart-*`/`--ui-gauge-*`) · the catalog
  follow-up issue minted with the clause-7 allowlist drain named.

## Alternatives considered

- **`orientation="vertical"` + stacking on `ui-bar-chart`** — rejected (clause 1): four
  simultaneous contract forks (codec, anatomy, value semantics, a11y) inside one control is the
  generic-`ui-chart` accretion ADR-0107 rejected, wearing a variant attribute; ADR-0219 already
  set the mint-not-variant precedent on weaker grounds.
- **A separate `ui-bar-series` for the dense highlighted board** — rejected: it differs from the
  stacked column chart only by `values.length === 1` and thin-column density (a data fact and a
  CSS fact); a third column-shaped control would be bloat, not clarity.
- **A new `ui-area-chart` instead of extending `ui-line-chart`** — rejected (clause 3): the mark,
  codec, math module, and a11y model are `ui-line-chart`'s own; duplicating a control for a
  gradient + axis state contradicts one-mark-one-control.
- **Extending `ui-pie-chart` to multi-ring** — rejected (clause 4): part-of-whole semantics
  (`value / Σ`, slices sum to the whole) contradict independent per-ring progress; ADR-0219's
  cl.8 multi-ring later-item is a different (concentric part-of-whole) intake and stays open.
- **Composing `ui-stat variant="ring"` tiles** — rejected (clause 4): no concentric geometry;
  the GH #1208 ring is a one-metric tile by design.
- **Series-major schema (`series: {label, values[]}[]` + `categories: string[]`)** — rejected:
  producers emit time-bucketed rows (the category is the natural row key), the category-major
  row keeps `ui-bar-chart`'s `{label, …}` grain, and stacking math iterates categories anyway;
  series-major optimizes for the renderer, not the emitter (the ADR-0107 F3 argument verbatim).
- **Bare `values: number[][]` with no series labels** (the ADR-0205 rejected-alternatives
  sketch) — rejected for STACKED marks: a legend/callout needs printed series identity (order +
  label + value — never fill alone, ADR-0057/0219); an unlabeled stack forces hue-only reading.
  The sketch's insight (indexed ramp identity) survives as the fill half of clause 2.
- **A `value: number | values: number[]` union codec** — rejected: a union at the attribute
  codec doubles the validator surface and the catalog row type for zero producer benefit
  (`values: [n]` is the same emission cost).
- **Hover-driven tooltip instead of the static `highlight` prop** — rejected in ADR-0228 cl.5
  (the tier ruling); this ADR only consumes it.
