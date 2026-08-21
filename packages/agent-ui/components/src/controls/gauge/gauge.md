---
# gauge.md frontmatter — the attributes-as-API descriptor for ui-gauge (ADR-0004; ADR-0229 cl.4). The
# machine-checkable public surface lives HERE (frontmatter); the prose below the fence is the /site doc.
# The `attributes[]` block MUST mirror gauge.ts `static props` (data/label) — the contract<->props
# trip-wire (gauge-descriptor.test.ts) targets this fence.
tag: ui-gauge
description: A multi-ring radial gauge — concentric, independent 0-100 progress rings (never part-of-whole) with a real-DOM label/value legend column.
tier: display          # geometry size-class (Display band — NO control frame/height/[size]/[scale]; ADR-0229, mirrors ui-bar-chart/ui-pie-chart/ui-column-chart)
extends: UIElement     # a non-interactive, non-form-associated display LEAF

attributes:            # attributes-as-API — mirrors gauge.ts `static props` (data, label)
  - name: data
    type: json          # array of {label, value} objects, JSON-string attribute form (ADR-0229 cl.4) — the fleet's {label,value}[] row verbatim
    default: ''         # the LIVE default is `[]` — `String([])===''` is what the descriptor<->props
                         # trip-wire (compareDescriptorToProps) actually compares against (`String(config.default)`)
    reflect: false      # NOT reflected — a JSON-string attribute round-trips through the codec, not setAttribute
    # the live codec is the ADR-0229 cl.4 safe-data codec — `from(null) = []` (never `null`); a datum
    # survives only with a NON-EMPTY string label and a finite number value (dropped, never coerced);
    # the surviving value is CLAMPED into [0, 100] — never DROPPED for being out of range, a documented
    # hardening DIVERGENCE from ui-pie-chart's `cleanData` (which drops a negative/non-finite value):
    # each ring is an INDEPENDENT progress reading, not a part-of-whole share, so an over/under-run value
    # clamps to its displayable end instead of being meaningless.
  - name: label
    type: string
    default: ''
    reflect: true       # the fleet's label-reflects-fleet-wide convention (TKT-0069 item 2)

properties: []         # no manual accessors beyond the two typed props

events: []             # display-only — emits nothing (no keyboard contract, no interaction)

slots: []              # no light-DOM content model — render() stays the inherited no-op; the rings
                        # layer + every legend row is component-built (replaceChildren), never author-slotted.

parts:                  # data-part nodes inside the component-built rings/legend DOM (selected by gauge.css)
  - name: rings
    description: The `<svg data-part="rings" aria-hidden="true">` — the zero-inset concentric-ring layer. Always aria-hidden; the HOST carries role=list and the legend rows ARE the accessible rendering (ADR-0229 cl.4/cl.5).
  - name: track
    description: One `<circle data-part="track" data-index="N">` per ring — the full, unfilled track circle (N = 0-based, outer→inner ring order = data order).
  - name: progress
    description: One `<circle data-part="progress" data-index="N">` per ring — the rounded-cap progress arc, revealed via `stroke-dasharray`/`stroke-dashoffset` to exactly the ring's clamped percent. Fill rides a ring-scoped `--_ring-ink` hook (one of the six `--ui-gauge-series-{1..6}-ink` ramp tokens, cycling past 6, outer ring first).
  - name: legend
    description: The `<div data-part="legend">` — the inset chrome layer holding every real-DOM legend row, padded by `--ui-gauge-chrome-inset` so it floats INSIDE the box rather than pushing/shrinking the rings layer.
  - name: key-swatch
    description: The `<span data-part="key-swatch" aria-hidden="true">` leading each legend row — a small filled circle matching its ring's SAME `--_ring-ink` token (the fill is a shared, non-sole identity carrier, ADR-0057).
  - name: key-label
    description: The `<span data-part="key-label">` — the datum's label, real DOM text, reading the KICKER typescale row (ADR-0078 cl.2b, uppercase). Part of the listitem's `{label} · {percent}` text content.
  - name: key-percent
    description: The `<span data-part="key-percent">` — the Intl `style:'percent'`-formatted clamped value (0 decimals default), real DOM text — the accuracy carrier alongside the ring's fill.

customStates: []       # NO interaction state and NO motion gate — a display leaf has neither

face:
  formAssociated: false  # a display leaf — extends UIElement, no value/validity participation

aria:
  role: list             # role=list via ElementInternals — CONSTANT, set once in connected() (the ui-pie-chart precedent)
  roleSource: internals   # `this.internals.role = 'list'` — NEVER a host role attribute (the FACE pattern)
  labelSource: label prop  # `internals.ariaLabel = label || null` — an unlabeled list is legal; never aria-hidden
  childRole: listitem      # each rendered legend row is a real `role="listitem"` element (a light-DOM attribute — the anatomy.md sanction for interior nodes; only HOST aria rides internals)

keyboard: []           # NOT interactive and NOT focusable — no tabindex, no keyboard contract

geometry:
  sizeClass: display
  minInlineSize: var(--ui-gauge-min-inline-size)  # 16em default — the whole-shape floor (ADR-0229 cl.6 role-(d) row)
  minBlockSize: var(--ui-gauge-min-block-size)    # 16em default — a real ring box, not a sliver, on the SAME role-(d) floor

forcedColors: An explicit `@media (forced-colors: active)` block — the track flattens to `Canvas`, every progress ring to `CanvasText` — identity survives via the legend's real text, never hue alone (ADR-0057).
---

# ui-gauge

`ui-gauge` is the **Display**-class multi-ring radial gauge (ADR-0229 cl.4) — the chart family's sixth
control. It answers "how is each of these metrics doing, right now?" with 2 or more CONCENTRIC rings,
each an **independent** 0-100 progress value, plus a real-DOM label/value legend column (the
CPU/MEMORY/DISK board shape). It is **not** interactive and **not** form-associated: no hover, no
keyboard contract, no events.

```html
<ui-gauge
  data='[{"label":"CPU","value":72},{"label":"Memory","value":54},{"label":"Disk","value":31}]'
  label="System load"
></ui-gauge>
```

## Never a `ui-pie-chart` extension (ADR-0229 cl.4)

Each ring reads its **own** 0-100 value — rings never sum, and there is no "share of a whole" math
anywhere in this control. A gauge with rings at 90/60/30 renders three independent readings, never a
90/60/30-of-180 split; extending `ui-pie-chart` (whose entire contract is `value / Σ rendered`) would be
the wrong math. Composing N `ui-stat variant="ring"` tiles is also rejected: that control is a
one-metric tile with no concentric geometry — N tiles are N separate boxes with no shared center, a
different artifact than this control's single concentric mark.

## The data schema

`data: { label: string; value: number }[]` — the fleet's `{label, value}[]` row verbatim (the same
shape `ui-bar-chart`/`ui-pie-chart` use). A datum survives hardening with a non-empty string `label` and
a finite number `value`; the surviving value is **clamped** into `[0, 100]` — **never dropped** for
being out of range (a documented divergence from `ui-pie-chart`'s hardening, which drops a
negative/non-finite value: a part-of-whole share is meaningless when negative, but an independent
progress reading of `-20` or `140` is simply an over/under-run of a real metric, clamped to its
displayable end — the GH #1208 `ui-stat variant="ring"` precedent).

## Rings, outer → inner (ADR-0229 cl.4)

Rings render in **data order**, outer to inner: the first datum is the outermost, largest-radius ring;
each subsequent datum steps inward. Ring fill steps the shared six-step
`--ui-gauge-series-{1..6}-ink` lightness ramp (aliasing `_chart/chart-axis.css`'s
`--ui-chart-series-{1..6}-ink`, cycling past 6) in the SAME outer→inner order — the outermost ring
always gets the ramp's brightest step. Rounded caps read the boards' law via `stroke-linecap: round`.

## The two-layer inset model (ADR-0228 cl.1-3, generalized to a radial mark)

The **rings layer** — the concentric SVG marks — spans the host box edge-to-edge at zero inset (its own
element box is never shrunk to reserve legend room). The **legend layer** — every label/value row, real
DOM text — floats **on top**, inset from all four edges by ONE knob (`--ui-gauge-chrome-inset`,
aliasing the shared `--ui-chart-chrome-inset`) and right-aligned within that padded box. The ring
drawing itself is pinned to the box's start edge (`preserveAspectRatio="xMinYMid meet"`), so a wide host
letterboxes genuinely empty room at the end edge for the legend — no shrinking, no overlap, by
construction. Dropping this chart into a padding-less `ui-card`-style container reproduces the board
geometry with zero consumer CSS.

## Axis/today/provisional grammar: N/A

Per ADR-0228's own per-mark N/A grammar for radial/part-of-whole types, `ui-gauge` renders **no**
gridlines, tick/category-label chips, now-marker, or projected-ghost treatment — its only chrome is the
label/value legend column above.

## Accessibility (ADR-0219 cl.5/cl.7 pattern)

The **legend list IS the accessible rendering**: the host carries `role="list"` via `ElementInternals`,
named by `label` when non-empty (an unlabeled list is legal, never a silent state). Each rendered ring
gets a real `role="listitem"` row whose text content is exactly `{label} · {value%}` — the ring `<svg>`
is `aria-hidden` and never double-announces. There is no generated `role="img"` summary here (unlike
`ui-column-chart`/the `axes`-state `ui-line-chart`): the legend rows already carry every datum as flat,
list-readable facts.

## Degenerate data

Every case still paints the host box (never throws): `[]`/absent/malformed `data` renders an empty host
— `role="list"` with zero items (AT reads "list, 0 items", the honest empty state); a missing/empty
label or a non-finite value drops that entry, siblings render; an out-of-range value (negative or
`> 100`) still renders its ring, clamped to `0`/`100`. **No sorting, no folding** — the mark makes no
analysis; the agent orders its own data (outer-to-inner IS the data order).

## Sizing

The host defaults to a `16em` `min-inline-size`/`min-block-size` floor (ADR-0229 cl.6's role-(d) row) —
a bare, unstyled gauge in a flex row still paints a visible, non-collapsed box with zero consumer CSS.
Ring stroke width is density-invariant mark geometry; legend row rhythm rides `--md-sys-space` for free
under `[density]`. There is no `[size]`/`[scale]` attribute — the legend label reads the
`--md-sys-typescale-kicker-small-*` row (uppercase), the percent reads
`--md-sys-typescale-label-medium-*`.

## Forced colors (WHCM)

The track flattens to `Canvas`; every progress ring flattens to `CanvasText`. Identity survives
untouched: the legend's real text needs no override.

## Explicitly later

Hover/keyboard interaction and events (ADR-0228 cl.7). Catalog disposition (the `Gauge` A2UI row) is a
separate, later intake per [ADR-0229](../../../../../.claude/docs/adr/0229-svg-chart-family-extensions.md)
cl.7 — GH #1568 (svg-charts wave 4).
