---
# column-chart.md frontmatter — the attributes-as-API descriptor for ui-column-chart (ADR-0004;
# ADR-0228/ADR-0229). The machine-checkable public surface lives HERE (frontmatter); the prose below the
# fence is the /site doc. The `attributes[]` block MUST mirror column-chart.ts `static props`
# (data/series/label/projected/highlight) — the contract<->props trip-wire (column-chart-descriptor.test.ts)
# targets this fence.
tag: ui-column-chart
description: A category-major stacked (or dense single-series) column chart with a nice-number axis, a projected/ghost trailing column, a now-marker, and a static highlight callout.
tier: display          # geometry size-class (Display band — NO control frame/height/[size]/[scale]; ADR-0229, mirrors ui-bar-chart/ui-line-chart/ui-pie-chart)
extends: UIElement     # a non-interactive, non-form-associated display LEAF

attributes:            # attributes-as-API — mirrors column-chart.ts `static props`
  - name: data
    type: json          # array of {label, values[]} objects, JSON-string attribute form (ADR-0229 cl.2)
    default: ''         # the LIVE default is `[]` — `String([])===''` is what the descriptor<->props
                         # trip-wire (compareDescriptorToProps) actually compares against (`String(config.default)`)
    reflect: false      # NOT reflected — a JSON-string attribute round-trips through the codec, not setAttribute
    # the live codec is the ADR-0229 cl.2 safe-data codec — `from(null) = []` (never `null`); a row
    # survives only with a NON-EMPTY string label and a `values` array whose every entry is a finite,
    # NON-NEGATIVE number (a negative/non-finite value drops the WHOLE row — stack semantics, the
    # ADR-0219 hardening class applied at row grain); ragged rows pad with trailing zeros to the resolved
    # series count, never thrown.
  - name: series
    type: json          # array of strings — the k-th name for the k-th stack segment (ADR-0229 cl.2)
    default: ''         # LIVE default `[]` — absent/empty falls back to auto-named "Series N" (single-series posture)
    reflect: false
  - name: label
    type: string
    default: ''
    reflect: true       # the fleet's label-reflects-fleet-wide convention (TKT-0069 item 2)
  - name: projected
    type: number
    default: 0          # count of TRAILING rows rendered in the projected/ghost state (ADR-0228 cl.4); clamped [0, data.length]
    reflect: true
  - name: highlight
    type: number
    default: null        # row index for the static callout (ADR-0228 cl.5); null/absent = no callout — a display-tier, zero-event prop
    reflect: true

properties: []         # no manual accessors beyond the five typed props

events: []             # display-only — emits nothing (no keyboard contract, no interaction; ADR-0228 cl.5's zero-event ruling)

slots: []              # no light-DOM content model — render() stays the inherited no-op; the plot/columns/
                        # chrome layers are all component-built (replaceChildren), never author-slotted.

parts:                  # data-part nodes inside the component-built three-layer DOM (selected by column-chart.css)
  - name: plot
    description: The `<svg data-part="plot" aria-hidden="true">` — the zero-inset plot layer's gridlines + now-marker. Always aria-hidden; the HOST carries role=img and a generated summary is the accessible rendering.
  - name: grid-line
    description: One `<line data-part="grid-line">` per nice-number tick (ADR-0228 cl.2) — subtle, decorative, never load-bearing for reading a value (the tick's own printed pill is).
  - name: now-dot
    description: The `<circle data-part="now-dot">` — the now-marker's baseline dot at the actual/projected boundary (ADR-0228 cl.4). Absent when `projected` names no boundary.
  - name: now-tick
    description: The `<line data-part="now-tick">` — a SHORT tick rising from the now-dot, never a full-height rule (ADR-0228 cl.4). Absent under the same condition as now-dot.
  - name: columns
    description: The `<div data-part="columns" aria-hidden="true">` — the CSS-drawn stacked column marks, zero-inset (plot-layer citizen).
  - name: category
    description: One `<div data-part="category">` per rendered row — a stack track carrying `data-highlight` when it is the `highlight` row.
  - name: segment
    description: One `<div data-part="segment" data-series="N">` per stack segment, fill riding a row-scoped `--_seg-ink` hook (one of the six `--ui-column-chart-series-{1..6}-ink` ramp tokens, cycling past 6). A PROJECTED row collapses to ONE `data-projected` ghost segment spanning its total (hollow, dashed outline, no fill) rather than per-segment outlines.
  - name: chrome
    description: The `<div data-part="chrome">` — the inset chrome layer holding every real-DOM text chip (tick-label/category-label/callout), padded by `--ui-column-chart-chrome-inset` so labels float INSIDE the plot box.
  - name: tick-label
    description: One `<div data-part="tick-label">` chip per nice-number gridline — the printed value-scale reading, real DOM text.
  - name: category-label
    description: One `<div data-part="category-label">` chip per THINNED category index (ADR-0228 cl.2's collision law — corner-clamped ends, dropped intermediates on overlap, never shrunk type) — the row's label, real DOM text.
  - name: callout
    description: The `<div data-part="callout">` rendered only when `highlight` names a valid row — `{value} · {category}`, real DOM text (ADR-0228 cl.5's static, zero-event callout).
  - name: callout-value
    description: The `<span data-part="callout-value">` inside the callout — the highlighted row's printed total, real DOM text.
  - name: callout-label
    description: The `<span data-part="callout-label">` inside the callout — the highlighted row's category label, real DOM text.

customStates: []       # NO interaction state and NO motion gate — a display leaf has neither

face:
  formAssociated: false  # a display leaf — extends UIElement, no value/validity participation

aria:
  role: img              # role=img via ElementInternals — CONSTANT, set once in connected() (the ui-line-chart precedent)
  roleSource: internals   # `this.internals.role = 'img'` — NEVER a host role attribute (the FACE pattern)
  labelSource: generated  # the generated summary (per-series totals/extents + point count + the highlighted row's fact, ADR-0229 cl.5) — never null, never aria-hidden

keyboard: []           # NOT interactive and NOT focusable — no tabindex, no keyboard contract

geometry:
  sizeClass: display
  minInlineSize: var(--ui-column-chart-min-inline-size)  # 16em default — the whole-shape floor (ADR-0229 cl.6 role-(d) row)
  minBlockSize: var(--ui-column-chart-min-block-size)    # 16em default — a real plot height, not a sliver, on the SAME role-(d) floor
  columnGap: var(--ui-column-chart-column-gap)           # between adjacent category tracks — rides [density] for free

forcedColors: An explicit `@media (forced-colors: active)` block — gridlines/now-marker flatten to system inks, every segment fill flattens to `CanvasText` with a `Canvas` border keeping adjacent series distinguishable, and every chip flattens to a bordered `Canvas`/`CanvasText` pill — identity survives via the generated summary + callout text, never hue alone (ADR-0057).
---

# ui-column-chart

`ui-column-chart` is the **Display**-class axis-bearing chart family's fifth control (ADR-0229 cl.1) — a
category-major stacked (or dense single-series) column mark consuming the shared axis/inset/series
vocabulary [ADR-0228](../../../../../.claude/docs/adr/0228-chart-axis-inset-series-vocabulary.md) mints:
nice-number gridlines, real-DOM tick/category-label pills, a projected/ghost trailing column, a
baseline-dot-plus-short-tick now-marker, and a static highlight callout. It is **not** interactive and
**not** form-associated: no hover, no keyboard contract, no events — emphasis is authored data, not a
gesture.

```html
<ui-column-chart
  data='[{"label":"Mar","values":[8,4,2]},{"label":"Apr","values":[10,5,3]},{"label":"May","values":[9,6,4]},{"label":"Jun","values":[11,7,4]},{"label":"Jul","values":[12,7,5]},{"label":"Aug","values":[6,4,2]}]'
  series='["Product","Services","Support"]'
  projected="1"
  highlight="3"
  label="Revenue by month"
></ui-column-chart>
```

## The two-layer model (ADR-0228 cl.1-3)

The **plot layer** — gridlines + the CSS-drawn stacked column marks — spans the chart box edge-to-edge
at zero inset. The **chrome layer** — every tick-label/category-label pill and the highlight callout, all
real DOM text — floats **on top**, inset from all four edges by ONE knob
(`--ui-column-chart-chrome-inset`). Labels never push the plot inward; they inset *within* it — dropping
this chart into a padding-less `ui-card`-style container reproduces board geometry with zero consumer
CSS.

## The data schema (ADR-0229 cl.2)

`data: { label: string; values: number[] }[]` — the row **is** the category (month, day); `series[k]`
names the *k*-th stack segment. Single-series is `values: [n]` with `series` optional (one shape, no
union codec) — the **dense single-series** board archetype and the **stacked multi-series** archetype
are the `values.length === 1` / `> 1` cases of this one schema. A row survives hardening only with a
non-empty string `label` and every `values` entry finite and **non-negative** — a negative or non-finite
entry drops the **whole row** (stack semantics: a negative segment has no legal position in a stack, the
same documented hardening class [ADR-0219](../../../../../.claude/docs/adr/0219-pie-donut-part-of-whole-chart.md)
set for part-of-whole data). Ragged rows (fewer `values` than `series` names) pad with trailing zeros to
the resolved series count — never thrown.

## Projected + now-marker (ADR-0228 cl.4)

`projected` names the count of **trailing** rows rendered as a hollow, dashed-outline ghost (one shape
per row, never a per-segment outline) — the boards' "not yet actual" August column. The **now-marker** —
a baseline dot plus a **short** tick, never a full-height rule — renders exactly when `projected > 0` at
the boundary between the last actual and first projected category, computed by the shared axis math.

## The highlight callout (ADR-0228 cl.5)

`highlight` names a row index; that row's chip reads `{printed total} · {category label}`, real DOM text
— a **static**, data-driven part with no hover, no focus, no keyboard. The agent/author decides what is
highlighted; the display tier's zero-interaction contract is unchanged. The callout's fact is **repeated**
in the generated accessible summary (the ARIA img-pruning rule — sighted text + AT parity).

## Series identity (ADR-0228 cl.6)

Segment fill steps down the shared six-step `--ui-column-chart-series-{1..6}-ink` lightness ramp
(aliasing `_chart/chart-axis.css`'s `--ui-chart-series-{1..6}-ink`, cycling past 6) — identity is carried
by **order + the printed series label (in the generated `role="img"` summary, ADR-0229 cl.5) + the ramp
fill**, fill never the sole carrier (ADR-0057). Each series' own printed total names it by label — the
mark's stack segments carry no DOM text of their own (a per-segment printed value would re-open the
label-collision/axis-system escalation the shared chip vocabulary already owns); the summary is where a
multi-series stack's identity is spelled out, not merely implied by fill order. Rounded caps apply only
to the **topmost** segment of each stack.

## Degenerate data

Every case still paints the host box and still announces (never throws): `[]`/absent/malformed `data`
renders an empty host (the generated summary reads "no data"); an all-zero rendered set still resolves a
real, positive scale and paints zero-length segments; a single category renders one column; a `highlight`
index outside the rendered range is silently ignored (no callout, no error). **No sorting, no folding** —
the mark makes no analysis; the agent orders its own data.

## Accessibility

A chart is data, not decoration: the host carries `role="img"` via `ElementInternals`, named by a
**generated summary** — per-series totals/extents + category count, plus the highlighted row's fact when
set — never null, never a silent state (the `ui-line-chart` precedent). Per-datum values are not printed
individually in this mark (a stacked total does not read cleanly as a flat list), so `role=img` +
a generated summary is the correct model, not `role=list`.

## Sizing

The host defaults to a `16em` `min-inline-size`/`min-block-size` floor (ADR-0229 cl.6's new role-(d)
row) — a bare, unstyled chart in a flex row still paints a visible, non-collapsed, proportionally-correct
box with zero consumer CSS. Mark geometry (segment radius, column gap) is density-**responsive** where
tokened to `--md-sys-space`, density-**invariant** where it is a fixed shape constant (the chip pill
radius). There is no `[size]`/`[scale]` attribute — chip/label text reads the
`--md-sys-typescale-label-medium-*` row directly.

## Forced colors (WHCM)

Gridlines and the now-marker flatten to system inks; every segment fill flattens to `CanvasText` with a
`Canvas` border (keeping adjacent series visually distinct under WHCM); every chip flattens to a bordered
`Canvas`/`CanvasText` pill. Identity survives untouched: the generated summary + callout text need no
override.

## Explicitly later

Hover/keyboard interaction and events (ADR-0228 cl.7), a `ratio` aspect-pin attribute (cl.7 — charts
adapt to their measured box by density thinning instead), log/dual axes, a typed time axis, streaming
point-append. Catalog disposition (the `ColumnChart` A2UI row) is a separate, later intake per
[ADR-0229](../../../../../.claude/docs/adr/0229-svg-chart-family-extensions.md) cl.7.
