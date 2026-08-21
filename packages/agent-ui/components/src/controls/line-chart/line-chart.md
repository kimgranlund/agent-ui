---
# line-chart.md frontmatter — the attributes-as-API descriptor for ui-line-chart (ADR-0004; ADR-0205,
# EXTENDED by ADR-0229 cl.3). The machine-checkable public surface lives HERE (frontmatter); the prose
# below the fence is the /site doc. The `attributes[]` block MUST mirror line-chart.ts `static props`
# (values/label/variant/axes/labels/projected) — the contract<->props trip-wire
# (line-chart-descriptor.test.ts) targets this fence.
tag: ui-line-chart
description: An axis-bearing line or area chart with a value-range baseline; the default state shows always-shown min/max labels, the opt-in `axes` state shows nice-number gridlines + tick/category chips + a gradient area fill + a provisional/now-marker system, single-series, hand-rolled inline SVG.
tier: display          # geometry size-class (Display band — NO control frame/height; ADR-0205 cl.5)
extends: UIElement     # a non-interactive, non-form-associated display LEAF (ADR-0205)
# marginal: not measured this pass — `npm run size` is a manual gate (Kim's ruling); run it once this
# control is wired into a size-budgeted wave.

attributes:            # attributes-as-API — mirrors line-chart.ts `static props`
  - name: values
    type: json          # closest ATTR_TYPES member to "array of number, JSON-string attribute form" (mirrors sparkline's `values`)
    default: ''         # the LIVE default is `[]` (an empty array) — `String([])===''` is what the
                         # contract<->props trip-wire (compareDescriptorToProps) actually compares against,
                         # since it reads `String(config.default)`, not a JSON-stringified form
    reflect: false      # NOT reflected — a JSON-string attribute round-trips through the codec, not setAttribute
    # the live codec is the SAME safe-values codec construction as ui-sparkline's `sparklineValuesProp` —
    # `from(null) = []` (never `null`), so a malformed/removed attribute never reaches the render path.
  - name: label
    type: string
    default: ''
    reflect: true       # TKT-0069 item 2 ruling: label reflects fleet-wide
  - name: variant
    type: enum
    values: [line, area]
    default: line
    reflect: false      # NOT reflected — structural; enumType snaps an unknown attribute value back to 'line'
  - name: axes
    type: boolean       # ADR-0229 cl.3 — opt-in: swaps the min/max label rows for the ADR-0228 tick/gridline/category system
    default: false
    reflect: true       # presence semantics (`from(attr) = attr !== null`) — the `[axes]` CSS selector reads the SAME reflected attribute
  - name: labels
    type: json          # array of string, JSON-string attribute form — optional category labels, index-aligned to `values` (ADR-0229 cl.3)
    default: ''         # LIVE default `[]`; absent/empty ⇒ "value ticks only" (cl.3) — no category-label chips render
    reflect: false
  - name: projected
    type: number
    default: 0          # count of TRAILING points rendered in the provisional state (ADR-0228 cl.4); `[axes]`-only — a no-op in the default state
    reflect: true

properties: []         # no manual accessors beyond the six typed props

events: []             # display-only — emits nothing (no keyboard contract, no interaction)

slots: []              # no light-DOM content model — render() stays the inherited no-op; every child
                        # (both states' layers) is control-built (replaceChildren), never author-slotted

parts:                  # data-part nodes built by line-chart.ts (selected by line-chart.css, not by name from TS)
  - name: label-max
    description: DEFAULT state only. The `<div data-part="label-max">` — the series MAXIMUM, real DOM text (never SVG `<text>`), rendered ABOVE the plot. Always present when the rendered set is non-empty and `axes` is false (ADR-0205 cl.3 — min/max labels are the axis vocabulary itself, always shown in the default state; ADR-0229 cl.3 makes this default-state-SCOPED once `axes` exists).
  - name: label-min
    description: DEFAULT state only. The `<div data-part="label-min">` — the series MINIMUM, real DOM text, rendered BELOW the plot. Always present when the rendered set is non-empty and `axes` is false.
  - name: plot
    description: AXES state only. The `<svg data-part="plot" aria-hidden="true">` — the zero-inset plot layer (gridlines, baseline, line/area, now-marker), viewBox `0 0 100 100` (the shared `_chart/axis-math.ts` percent convention). Always aria-hidden; the HOST carries role=img.
  - name: grid-line
    description: AXES state only. One `<line data-part="grid-line">` per nice-number tick (ADR-0228 cl.2) — subtle, decorative, never load-bearing for reading a value (the tick's own printed pill is).
  - name: line
    description: The `<polyline data-part="line">` inside the svg — the normalized series stroke (`stroke="currentColor"`, `vector-effect="non-scaling-stroke"`). Always present when the rendered set is non-empty. In the AXES state with a `projected` span, this covers the ACTUAL points only (the trailing projected points render as `line-projected` instead).
  - name: line-projected
    description: AXES state only, present only when `projected > 0`. The `<polyline data-part="line-projected">` — a DASHED continuation starting at the last actual point (contiguous with `line`), rendering the provisional span (ADR-0228 cl.4 / REQ-F-015).
  - name: area
    description: The `<polygon data-part="area">` — the closed fill under the stroke, closing to the BASELINE (not the geometric bottom edge), painted via the `area-gradient` linearGradient (ADR-0229 cl.3). Present only when `variant="area"` AND at least 2 ACTUAL points render. Suppressed entirely over the projected span (REQ-F-015's fill-suppressed treatment).
  - name: area-gradient
    description: Present only alongside `area`. The `<linearGradient>` inside a `<defs>` — an instance-unique id, top-to-bottom over the area shape's own bounding box (ADR-0229 cl.3's gradient-to-transparent paint upgrade).
  - name: area-gradient-stop-start
    description: The `<stop offset="0%">` inside `area-gradient` — `stop-opacity` reads `--ui-line-chart-area-fill-stop-start`.
  - name: area-gradient-stop-end
    description: The `<stop offset="100%">` inside `area-gradient` — `stop-opacity` reads `--ui-line-chart-area-fill-stop-end`.
  - name: baseline
    description: The `<line data-part="baseline">` — the ADR-0205 cl.1 axis reference (the zero line when the value range spans zero, else the value floor), inherited UNCHANGED into the AXES state (ADR-0228 cl.2's own citation). Always present when the rendered set is non-empty; a subtler `currentColor` stroke (reduced opacity) than the data line.
  - name: now-dot
    description: AXES state only, present only when `projected` names a real actual/projected boundary. The `<circle data-part="now-dot">` — the now-marker's baseline dot (ADR-0228 cl.4, the `ui-column-chart` mechanism reused verbatim for the time axis).
  - name: now-tick
    description: AXES state only, present under the same condition as now-dot. The `<line data-part="now-tick">` — a SHORT tick rising from the now-dot through the category-label band, never a full-height rule.
  - name: chrome
    description: AXES state only. The `<div data-part="chrome">` — the inset chrome layer holding every real-DOM text chip (tick-label/category-label), padded by `--ui-line-chart-chrome-inset` so labels float INSIDE the plot box.
  - name: tick-label
    description: AXES state only. One `<div data-part="tick-label">` chip per nice-number gridline — the printed value-scale reading, real DOM text.
  - name: category-label
    description: AXES state only, present only when `labels` is non-empty. One `<div data-part="category-label">` chip per THINNED index with a real label (ADR-0228 cl.2's collision law) — real DOM text. Absent labels ⇒ value ticks only (ADR-0229 cl.3).

customStates: []       # NO interaction state and NO motion gate — a display leaf has neither (no :state(); nothing to transition)

face:
  formAssociated: false  # a display leaf — extends UIElement, no value/validity participation

aria:
  role: img              # role=img via ElementInternals — CONSTANT, set once in connected() (never toggled)
  roleSource: internals   # `this.internals.role = 'img'` — NEVER a host role attribute (the FACE pattern)
  labelSource: the generated summary  # `internals.ariaLabel` = lineChartSummary(label, geometry) — recomputed on label/values change; NEVER null, NEVER aria-hidden (ADR-0205 cl.6: no silent state, with or without a label). UNCHANGED by `axes` (ADR-0229 cl.5 — the axes-state chart reads the SAME cl.6 pattern).

keyboard: []           # NOT interactive and NOT focusable — no tabindex, no keyboard contract

geometry:
  sizeClass: display
  minInlineSize: var(--ui-line-chart-min-inline-size)  # 16em default — the whole-shape floor; NO [size] ramp, NO --md-sys-height-* (Display class); UNCHANGED by `axes`
  minBlockSize: var(--ui-line-chart-min-block-size)    # 9em default — room for both label rows + a real plot area (default state) or the plot+chrome overlay (axes state)
  rowGap: var(--ui-line-chart-row-gap)                 # the density-RESPONSIVE label<->plot rhythm (default state only — `axes` is a one-cell overlay, no row-gap)

forcedColors: DEFAULT state — no dedicated block — the line/area are `currentColor` stroke/fill, resolving to whatever forced ink the consuming context already resolves to; the baseline is the SAME `currentColor` stroke at a reduced `--ui-line-chart-baseline-opacity` (opacity is not a color property — WHCM never flattens it). The gradient-filled area (`variant="area"`, both states) flattens to a solid `CanvasText` fill — a paint-server is not currentColor-resolvable under WHCM. AXES state additionally flattens gridlines/now-marker to system inks and chips to a bordered `Canvas`/`CanvasText` pill (the `ui-column-chart` precedent). The min/max labels (default state) are plain text and survive untouched.
---

# ui-line-chart

`ui-line-chart` is the **Display**-class axis-bearing line/area chart (ADR-0205, **Extended by ADR-0229**
cl.3). The **default state** answers "what is the shape of this series, and where does it sit relative to
its own floor (or zero)?" with a value-range baseline plus always-shown min/max value labels — no ticks,
no gridlines, no legend, no tooltip. The **opt-in `axes` state** (ADR-0229 cl.3) swaps the min/max labels
for the shared ADR-0228 tick/gridline/category system, a gradient area fill, and a provisional/now-marker
system for the time axis. It is **not** interactive and **not** form-associated in either state: no
keyboard contract, no events, and (v1) single-series only (ADR-0205 cl.2, deferred pending a separate
legend/color-key vocabulary).

```html
<ui-line-chart values="[3,5,4,8,7]" label="Latency, p50"></ui-line-chart>
<ui-line-chart values="[-4,2,6,-1,3]" variant="area"></ui-line-chart>
<ui-line-chart
  axes
  values="[18,21,19,24,27,23]"
  labels='["Mar","Apr","May","Jun","Jul","Aug"]'
  variant="area"
  projected="1"
  label="Revenue trend"
></ui-line-chart>
```

## Rendering (default state)

Three light-DOM children, rebuilt as a whole on every `values`/`variant` change (`replaceChildren`, no
incremental patching — the A2UI `updateDataModel` semantics): a `label-max` text row, the component-built
`<svg>`, and a `label-min` text row. The svg's viewBox is a real chart TILE (a fixed, wider-than-tall box,
not `ui-sparkline`'s decorative normalized 100x100 square) with vertical margin reserved top/bottom so the
plotted line/baseline never touch its own edges — line-chart.css lays the three children out as a 3-row grid
(label-max / svg / label-min), the external counterpart to that same reserved margin. `variant="area"` adds
the same polyline closed to the **baseline** (not the geometric bottom) as a gradient `currentColor` fill
(see "The gradient area fill" below — this is unchanged by `axes`).

## The `axes` state (ADR-0229 cl.3)

Setting `axes` swaps the DEFAULT state's min/max label rows for the shared `_chart/` two-layer full-bleed
model (ADR-0228), the SAME mechanism `ui-column-chart` consumes: a zero-inset `[data-part="plot"]` svg
(nice-number gridlines over the series' OWN `[min, max]` domain — never zero-forced, the baseline law
stays inherited) plus a `[data-part="chrome"]` layer of real-DOM tick-label chips (the value scale) and,
when the optional `labels` prop supplies a string per index, category-label chips (month/day names) —
**absent `labels` renders value ticks only** (ADR-0205 cl.3's "an axis-bearing chart shows its axis
values" intent, now carried by the tick pills instead of the min/max pair). The chrome is inset from the
plot by `--ui-line-chart-chrome-inset`; the plot itself never shrinks to make room (Kim's
zero-padding-container contract) — dropping this chart into a padding-less `ui-card`-style container
reproduces the board geometry with zero consumer CSS.

## Provisional span + now-marker (`axes` + `projected`, ADR-0228 cl.4)

`projected` names a trailing count of points rendered as **not yet actual**: the polyline splits into a
solid `line` (actual points) and a dashed `line-projected` continuation (starting at the last actual point,
so the stroke stays visually contiguous) — a line-style provisionality carrier, never a hue change. The
area fill (`variant="area"`) is **suppressed** over the projected span entirely (this control's own
considered call for the gen-ui-kit foundations spec's REQ-F-015, mirroring `ui-column-chart`'s hollow-ghost
"no fill" idiom for the same signal). The **now-marker** — a baseline dot plus a SHORT tick through the
category-label band, never a full-height rule — renders at the actual/projected boundary, the exact
`ui-column-chart` mechanism reused for the time axis. **The now-marker specifically** is a no-op whenever
`axes` is false or `projected` names no real boundary (`<= 0` or `>= values.length` — REQ-F-016's typed
absence, since there is no boundary to sit at either way). The **provisional-span rendering** is a no-op
only at `projected <= 0` (a single solid `line`, no `line-projected`) — at `projected >= values.length`
it is NOT a no-op: every point renders dashed (`line-projected` spans the whole series, no solid `line` at
all), the honest reading of "every point is provisional."

## The gradient area fill (ADR-0229 cl.3, both states)

`variant="area"` paints its fill through an SVG `<linearGradient>` (CSS cannot paint a gradient into an SVG
fill cross-engine) — two stops read `--ui-line-chart-area-fill-stop-{start,end}` (`stop-opacity`,
`currentColor`), fading from the line down to the baseline. `--ui-line-chart-area-opacity` still multiplies
on top, unchanged default — a consumer who already customized it keeps working, and setting the two new
stop tokens EQUAL reproduces the original flat low-alpha wash exactly (the token fallback the boards'
gradient upgrade names). This applies identically in the default and `axes` states.

## The baseline (ADR-0205 cl.1)

One `<line data-part="baseline">`, a subtler `currentColor` stroke than the data line: the **zero line**
when the series' value range spans zero (`min <= 0 <= max`), else the series' own **value floor** (`min`) —
an all-positive (or all-negative) series' baseline is its own minimum, not the numeric origin. This is
deliberately different from `ui-bar-chart`'s always-zero baseline law: a line chart's honest floor is
"where this series actually bottoms out," not an assumed zero axis.

## Value labels (ADR-0205 cl.1/cl.3, default-state-scoped by ADR-0229 cl.3)

In the **default state**, the series minimum and maximum are **always shown** as real DOM text (never SVG
`<text>`) — unlike `ui-sparkline`'s optional accessible-name `label`, these are the axis vocabulary itself:
an axis-bearing chart with no visible axis values would not earn the name. This "always shown" law is now
**scoped to the default state**: once `axes` is set, the tick-label chips carry the axis values instead
(the same intent, a richer vocabulary) — the two systems never render together. A separate `label` prop
still supplies the accessible name / caption in either state, independent of the value labels.

## Degenerate data

Every case still paints the host box and still announces (never throws): empty/absent/malformed `values`
renders nothing (the box paints via the CSS floors); non-finite entries are dropped, the remainder renders;
exactly one finite point renders a visible dot at the plot's vertical/horizontal center (round `stroke-linecap`
on a zero-length segment, the `ui-sparkline` precedent) with its baseline coincident with that single value;
all-equal values render a flat horizontal line, with the baseline coincident with the line (both values equal
the shared value, which is also the floor unless that shared value is exactly `0`).

## Accessibility

A chart is data, not decoration: `role="img"` via `ElementInternals`, with a **generated accessible name** —
never a silent state, with or without `label`. The name is `label` (when non-empty) + `": "` + a computed
summary over the rendered set:

- 2+ points: `{n} points, low {min}, high {max}`
- 1 point: `1 point, value {v}`
- 0 points: `no data`

Numbers are formatted with the platform default-locale `Intl.NumberFormat` — the same numbers the min/max
label rows print. The min/max label text sits inside the `role="img"` subtree (presentational per the ARIA
img-role pruning rule, same as the svg) — it is for SIGHTED readers (selectable, zoomable, token-typed text);
the generated `ariaLabel` carries the equivalent fact for assistive technology.

## Sizing

The host defaults to a `16em` x `9em` floor (`--ui-line-chart-min-inline-size` / `--ui-line-chart-min-block-size`)
— UNCHANGED by `axes` — a bare, unstyled chart in a flex row still paints a visible, non-collapsed,
proportionally-correct tile with zero consumer CSS. Stroke width is density-**invariant**; the
label<->plot row gap (default state) rides the `--md-sys-space` ladder and responds to an ancestor
`[density]` for free. There is no `[size]`/`[scale]` attribute and no `--md-sys-height-*` lever — labels
read the `--md-sys-typescale-body-medium-*` row (default state) or the chip typescale (axes state) directly.

## RTL

The series keeps its **physical left-to-right** reading direction in RTL contexts — chronology is data
order, and series charts conventionally stay LTR even in RTL locales (the `ui-sparkline` precedent). SVG
viewBox coordinates are never mirrored, in either state.

## Explicitly later

Legends, a typed time axis, streaming/animated updates, hover/keyboard interaction, multi-series (ADR-0205
cl.2/cl.7) — each its own future issue. Tick marks, gridlines, and the category axis are now REALIZED by
the `axes` state above (ADR-0229 cl.3) — the ADR-0205 cl.7 later-list items this wave discharges.
