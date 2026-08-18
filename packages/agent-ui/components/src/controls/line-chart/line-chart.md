---
# line-chart.md frontmatter — the attributes-as-API descriptor for ui-line-chart (ADR-0004; ADR-0205). The
# machine-checkable public surface lives HERE (frontmatter); the prose below the fence is the /site doc. The
# `attributes[]` block MUST mirror line-chart.ts `static props` (values/label/variant) — the contract<->props
# trip-wire (line-chart-descriptor.test.ts) targets this fence.
tag: ui-line-chart
description: An axis-bearing line or area chart with a value-range baseline and always-shown min/max labels, single-series, hand-rolled inline SVG.
tier: display          # geometry size-class (Display band — NO control frame/height; ADR-0205 cl.5)
extends: UIElement     # a non-interactive, non-form-associated display LEAF (ADR-0205)
# marginal: not measured this pass — `npm run size` is a manual gate (Kim's ruling); run it once this
# control is wired into a size-budgeted wave.

attributes:            # attributes-as-API — mirrors line-chart.ts `static props` (values, label, variant)
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

properties: []         # no manual accessors beyond the three typed props

events: []             # display-only — emits nothing (no keyboard contract, no interaction)

slots: []              # no light-DOM content model — render() stays the inherited no-op; every child
                        # (the two label rows + the svg) is control-built (replaceChildren), never author-slotted

parts:                  # data-part nodes built by line-chart.ts (selected by line-chart.css, not by name from TS)
  - name: label-max
    description: The `<div data-part="label-max">` — the series MAXIMUM, real DOM text (never SVG `<text>`), rendered ABOVE the plot. Always present when the rendered set is non-empty (ADR-0205 cl.3 — min/max labels are the axis vocabulary itself, always shown).
  - name: label-min
    description: The `<div data-part="label-min">` — the series MINIMUM, real DOM text, rendered BELOW the plot. Always present when the rendered set is non-empty.
  - name: line
    description: The `<polyline data-part="line">` inside the svg — the normalized series stroke (`stroke="currentColor"`, `vector-effect="non-scaling-stroke"`). Always present when the rendered set is non-empty.
  - name: area
    description: The `<polygon data-part="area">` — the closed fill under the stroke, closing to the BASELINE (not the geometric bottom edge). Present only when `variant="area"` AND the rendered set has >= 2 points.
  - name: baseline
    description: The `<line data-part="baseline">` — the ADR-0205 cl.1 axis reference (the zero line when the value range spans zero, else the value floor). Always present when the rendered set is non-empty; a subtler `currentColor` stroke (reduced opacity) than the data line.

customStates: []       # NO interaction state and NO motion gate — a display leaf has neither (no :state(); nothing to transition)

face:
  formAssociated: false  # a display leaf — extends UIElement, no value/validity participation

aria:
  role: img              # role=img via ElementInternals — CONSTANT, set once in connected() (never toggled)
  roleSource: internals   # `this.internals.role = 'img'` — NEVER a host role attribute (the FACE pattern)
  labelSource: the generated summary  # `internals.ariaLabel` = lineChartSummary(label, geometry) — recomputed on label/values change; NEVER null, NEVER aria-hidden (ADR-0205 cl.6: no silent state, with or without a label)

keyboard: []           # NOT interactive and NOT focusable — no tabindex, no keyboard contract

geometry:
  sizeClass: display
  minInlineSize: var(--ui-line-chart-min-inline-size)  # 16em default — the whole-shape floor; NO [size] ramp, NO --md-sys-height-* (Display class)
  minBlockSize: var(--ui-line-chart-min-block-size)    # 9em default — room for both label rows + a real plot area
  rowGap: var(--ui-line-chart-row-gap)                 # the density-RESPONSIVE label<->plot rhythm

forcedColors: No dedicated `@media (forced-colors: active)` block — the line/area are `currentColor` stroke/fill (the `ui-sparkline` precedent: resolves to whatever forced ink the consuming context already resolves to); the baseline is the SAME `currentColor` stroke at a reduced `--ui-line-chart-baseline-opacity` (opacity is not a color property — WHCM never flattens it, the same reasoning `ui-sparkline`'s area wash relies on). The min/max labels are plain text and survive untouched.
---

# ui-line-chart

`ui-line-chart` is the **Display**-class axis-bearing line/area chart (ADR-0205) — the fleet's first chart
with real axis vocabulary: a value-range baseline plus always-shown min/max value labels. It answers "what is
the shape of this series, and where does it sit relative to its own floor (or zero)?" It is **not**
interactive and **not** form-associated: no ticks, no gridlines, no legend, no tooltip, no keyboard contract,
no events, and (v1) single-series only (ADR-0205 cl.2, deferred pending a separate legend/color-key vocabulary).

```html
<ui-line-chart values="[3,5,4,8,7]" label="Latency, p50"></ui-line-chart>
<ui-line-chart values="[-4,2,6,-1,3]" variant="area"></ui-line-chart>
```

## Rendering

Three light-DOM children, rebuilt as a whole on every `values`/`variant` change (`replaceChildren`, no
incremental patching — the A2UI `updateDataModel` semantics): a `label-max` text row, the component-built
`<svg>`, and a `label-min` text row. The svg's viewBox is a real chart TILE (a fixed, wider-than-tall box,
not `ui-sparkline`'s decorative normalized 100x100 square) with vertical margin reserved top/bottom so the
plotted line/baseline never touch its own edges — line-chart.css lays the three children out as a 3-row grid
(label-max / svg / label-min), the external counterpart to that same reserved margin. `variant="area"` adds
the same polyline closed to the **baseline** (not the geometric bottom) as a low-alpha `currentColor` fill.

## The baseline (ADR-0205 cl.1)

One `<line data-part="baseline">`, a subtler `currentColor` stroke than the data line: the **zero line**
when the series' value range spans zero (`min <= 0 <= max`), else the series' own **value floor** (`min`) —
an all-positive (or all-negative) series' baseline is its own minimum, not the numeric origin. This is
deliberately different from `ui-bar-chart`'s always-zero baseline law: a line chart's honest floor is
"where this series actually bottoms out," not an assumed zero axis.

## Value labels (ADR-0205 cl.1/cl.3)

The series minimum and maximum are **always shown** as real DOM text (never SVG `<text>`) — unlike
`ui-sparkline`'s optional accessible-name `label`, these are the axis vocabulary itself: an axis-bearing
chart with no visible axis values would not earn the name. A separate `label` prop still supplies the
accessible name / caption, independent of the min/max value labels.

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
— a bare, unstyled chart in a flex row still paints a visible, non-collapsed, proportionally-correct tile
with zero consumer CSS. Stroke width is density-**invariant**; the label<->plot row gap rides the
`--md-sys-space` ladder and responds to an ancestor `[density]` for free. There is no `[size]`/`[scale]`
attribute and no `--md-sys-height-*` lever — labels read the `--md-sys-typescale-body-medium-*` row directly.

## RTL

The series keeps its **physical left-to-right** reading direction in RTL contexts — chronology is data
order, and series charts conventionally stay LTR even in RTL locales (the `ui-sparkline` precedent). SVG
viewBox coordinates are never mirrored.

## Explicitly later (ADR-0205 cl.7)

Tick marks, gridlines, legends, tooltips, multi-series, time axes, streaming/animated updates, hover/keyboard
interaction — each its own future issue.
