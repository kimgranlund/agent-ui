---
# pie-chart.md frontmatter — the attributes-as-API descriptor for ui-pie-chart (ADR-0004; ADR-0219,
# drafted SPEC §5.2 delta). The machine-checkable public surface lives HERE (frontmatter); the prose
# below the fence is the /site doc. The `attributes[]` block MUST mirror pie-chart.ts `static props`
# (data/label/variant) — the contract<->props trip-wire (pie-chart-descriptor.test.ts) targets this fence.
tag: ui-pie-chart
description: A part-of-whole ring (donut, default) or solid pie chart with a printed-percent key list, identity carried by order + label + percent, never hue alone.
tier: display          # geometry size-class (Display band — NO control frame/height/[size]/[scale]; ADR-0219, mirrors ui-bar-chart/ui-line-chart)
extends: UIElement     # a non-interactive, non-form-associated display LEAF (ADR-0219)
# marginal: measured at the build wave via `npm run size` (see the commit's gate evidence) — the manual
# size gate (Kim's ruling); the family size-budget re-base (ADR-0219 Consequences) is a separate,
# host-owned repair step, not this control's own marginal figure.

attributes:            # attributes-as-API — mirrors pie-chart.ts `static props` (data, label, variant)
  - name: data
    type: json          # closest ATTR_TYPES member to "array of {label,value} objects, JSON-string attribute form" (the BarChart row schema verbatim, ADR-0219 cl.2)
    default: ''         # the LIVE default is `[]` (an empty array) — `String([])===''` is what the
                         # contract<->props trip-wire (compareDescriptorToProps) actually compares against,
                         # since it reads `String(config.default)`, not a JSON-stringified form
    reflect: false      # NOT reflected — a JSON-string attribute round-trips through the codec, not setAttribute
    # the live codec is the ADR-0219 cl.2 safe-data codec — `from(null) = []` (never `null`); entries
    # survive only with a NON-EMPTY string label and a finite, NON-NEGATIVE number value (dropped, never
    # coerced/clamped — a negative part-of-whole value is meaningless, a documented hardening difference
    # from ui-bar-chart's own `data` codec, which allows both negatives and empty-string labels).
  - name: label
    type: string
    default: ''
    reflect: true       # TKT-0069 item 2 ruling: label reflects fleet-wide
  - name: variant
    type: enum
    values: [donut, pie]
    default: donut       # ADR-0219 cl.1 — the ring leaves a center for the whole's own caption; enumType snaps unknowns back to 'donut'
    reflect: false       # NOT reflected — structural (the Sparkline/LineChart variant precedent)

properties: []         # no manual accessors beyond the three typed props

events: []             # display-only — emits nothing (no keyboard contract, no interaction)

slots: []              # no light-DOM content model — render() stays the inherited no-op; the ring +
                        # every key row is component-built (replaceChildren), never author-slotted. The
                        # donut's center is a SIBLING composition in the CONSUMER's own layout (ADR-0219
                        # cl.6) — this control accepts no children and paints nothing there itself.

parts:                  # data-part nodes inside the component-built ring/rows (selected by pie-chart.css, not by name from TS)
  - name: ring
    description: The `<svg data-part="ring" aria-hidden="true">` — the whole ring/disc mark. Always aria-hidden; the HOST carries role=list and the key rows ARE the accessible rendering (ADR-0219 cl.5/cl.7).
  - name: track
    description: The `<path data-part="track">` inside the ring — the empty/all-zero full annulus (or disc) drawn when the rendered total is 0 (ADR-0219 cl.2). Painted in `--ui-pie-chart-track-ink`; mutually exclusive with `slice` paths.
  - name: slice
    description: One `<path data-part="slice" data-index="N">` per rendered datum, in data order (N = 0-based, DOM order = data order = clockwise order from 12 o'clock — ADR-0219 cl.4). Fill rides a row-scoped `--_slice-ink` hook set to one of the six `--ui-pie-chart-slice-{1..6}-ink` ramp tokens, cycling past 6; separated by a constant-width `--ui-pie-chart-separator-ink` stroke.
  - name: key-swatch
    description: The `<span data-part="key-swatch" aria-hidden="true">` leading each key row — a small filled circle matching its slice's SAME `--_slice-ink` token (ADR-0219 cl.4 — the fill is a shared, non-sole identity carrier). Aria-hidden; contributes no text.
  - name: key-label
    description: The `<span data-part="key-label">` — the datum's label, real DOM text. Part of the listitem's `{label} · {percent}` text content (ADR-0219 cl.3).
  - name: key-percent
    description: The `<span data-part="key-percent">` — the Intl `style:'percent'`-formatted share of the rendered total (0 decimals default), real DOM text — the accuracy carrier for the weak angle channel (ADR-0219 cl.3).

customStates: []       # NO interaction state and NO motion gate — a display leaf has neither (no :state(); nothing to transition)

face:
  formAssociated: false  # a display leaf — extends UIElement, no value/validity participation

aria:
  role: list             # role=list via ElementInternals — CONSTANT, set once in connected() (the ui-bar-chart/ui-list precedent)
  roleSource: internals   # `this.internals.role = 'list'` — NEVER a host role attribute (the FACE pattern)
  labelSource: label prop  # `internals.ariaLabel = label || null` — an unlabeled list is legal; never aria-hidden
  childRole: listitem      # each rendered key row is a real `role="listitem"` element (a light-DOM attribute — the anatomy.md sanction for interior nodes; only HOST aria rides internals)

keyboard: []           # NOT interactive and NOT focusable — no tabindex, no keyboard contract

geometry:
  sizeClass: display
  minInlineSize: var(--ui-pie-chart-min-inline-size)  # 16em default — the whole-shape floor (ADR-0219, SPEC-R9 AC1 precedent); NO [size] ramp, NO --md-sys-height-*
  ringSize: var(--ui-pie-chart-ring-size)              # 8em default — the ring's fixed box, density-invariant mark geometry
  rowGap: var(--ui-pie-chart-row-gap)                  # key-row rhythm — rides [density] for free (ADR-0103)
  colGap: var(--ui-pie-chart-col-gap)                  # ring<->key-list rhythm

forcedColors: An explicit `@media (forced-colors: active)` block — every slice AND the key-swatch flatten to `CanvasText` (separators/track background to `Canvas`, the track keeping a `CanvasText` border) so the ring stays visible under WHCM without relying on hue; identity survives untouched via the key list's real text (ADR-0219 cl.7).
---

# ui-pie-chart

`ui-pie-chart` is the **Display**-class part-of-whole chart (ADR-0219) — the chart family's fourth
control, admitted by lifting ADR-0107's pie/donut fence on its own three stated conditions (weak angle
channel, hue-only identity, needs-a-legend). It answers "what share of this whole does each part have?"
with a ring (default) or solid pie mark plus a printed-percent key list. It is **not** interactive and
**not** form-associated: no hover, no exploded slices, no keyboard contract, no events.

```html
<ui-pie-chart data='[{"label":"EMEA","value":42},{"label":"APAC","value":31},{"label":"Americas","value":27}]' label="Revenue by region"></ui-pie-chart>
<ui-pie-chart variant="pie" data='[{"label":"Allocated","value":1240},{"label":"Unallocated","value":260}]'></ui-pie-chart>
```

## Rendering

One `<path>` slice per valid datum, in data order, drawn clockwise from 12 o'clock inside a normalized
square viewBox — `variant="donut"` (default) cuts a hole at the ring's center, `variant="pie"` is a
solid disc. Slice sweep is proportional to `value / Σ rendered` (the rendered total). Fill steps down a
**single-family lightness ramp** — `--ui-pie-chart-slice-1-ink` (brightest) through `-6-ink` (dimmest),
cycling past 6 slices — six pairwise-distinct primary **tone primitives** per scheme via `light-dark()`
(light `primary-300 → -800`, dark `primary-200 → -700`, in 100-steps; strictly monotone, slice 1 always
brightest — the ADR-0219 cl.4 Amendment: the originally-named emphasis-role chain resolved non-distinct
and non-monotone in the shipped estate), surfaced as plain tokens so a consumer re-maps the ramp without
touching the control; adjacent slices are separated by a constant-width, non-scaling stroke so identity
never rides hue alone. Setting `data`/`variant` re-renders the whole mark — there is no incremental-append API (A2UI
`updateDataModel` semantics).

## The key list IS the legend (ADR-0219 cl.5)

Every rendered slice gets one real `role="listitem"` row: **`{label} · {percent}`**, real DOM text —
never an SVG legend layer. Percent is `value / Σ rendered`, `Intl`-formatted (`style: 'percent'`, 0
decimals default). Slice *k* and key row *k* share the same index (DOM order = data order = clockwise
order), the same label, the same printed percent, and the same fill token — the fill is a **shared,
non-sole** identity carrier (a small swatch leads each row); the label + percent are what actually carry
identity, satisfying the fleet's never-hue-alone rule (ADR-0057) by construction.

## The donut center (ADR-0219 cl.6)

`variant="donut"` leaves a visible hole at the ring's geometric center — this control paints **nothing**
there and accepts no children. The hole exists so a **consumer** can compose a sibling element (a `Stat`
or `Text` reading "Total · 1,240") into the same visual space via their own layout (e.g. a shared CSS
grid cell) — the center caption is not part of this control's markup or API.

## Degenerate data

Every case still paints the host box and still announces (never throws): `[]`/absent/malformed `data`
renders an empty track ring + zero key rows (the host stays `role=list` with zero items); entries
missing a non-empty string `label` or a finite, **non-negative** numeric `value` are dropped — a
negative part-of-whole value is meaningless and is **dropped, not clamped** (a documented hardening
difference from `ui-bar-chart`, where negatives are legal magnitudes); an all-zero rendered set (every
surviving value is exactly `0`) also paints only the empty track ring, with no key rows — the whole-shape
law holds either way; exactly one valid datum renders a full ring/disc (100%) with one key row reading
`{label} · 100%`. **No "Other" folding, no sorting** — the mark makes no analysis; the agent orders its
own data (best read at ≤6 slices — the usage note, not an enforced truncation).

## Accessibility

A chart is data, not decoration: the host carries `role="list"` via `ElementInternals` (the
`ui-bar-chart` precedent), named by `label` when non-empty — an unlabeled chart is legal (never a silent
state, never `aria-hidden`). Each rendered slice is a real `role="listitem"` row whose text content is
`{label} · {percent}` — the ring `<svg>` is `aria-hidden`, entirely decorative; the key list is the
accessible rendering (the same law `ui-bar-chart`/`ui-line-chart` apply).

## Sizing

The host defaults to a `16em` `min-inline-size` floor (`--ui-pie-chart-min-inline-size`) — a bare,
unstyled chart in a flex row still paints a visible, non-collapsed ring with zero consumer CSS. The
ring itself is a fixed `--ui-pie-chart-ring-size` (`8em` default) square — density-**invariant** mark
geometry; key-row/ring-to-list gaps ride the `--md-sys-space` ladder and respond to an ancestor
`[density]` for free. There is no `[size]`/`[scale]` attribute and no `--md-sys-height-*` lever — key-row
text reads the `--md-sys-typescale-body-medium-*` row directly.

## Forced colors (WHCM)

Every slice and the key-swatch flatten to `CanvasText`; separators and the empty track background flatten
to `Canvas` (the track keeps a `CanvasText` border) — an explicit override, because a fill-drawn SVG shape
is otherwise forced to `Canvas` (invisible) under `forced-colors: active`. Identity survives untouched:
the key list's label + percent text needs no override.

## Explicitly later (ADR-0219 cl.8)

Hover/interaction, exploded slices, multi-ring, a `proportionBar` variant (the length-channel cousin,
rejected as the v1 default), per-slice color overrides from the wire, a `centerLabel` prop (the donut
center composition seam, if seeds prove clumsy), and a real categorical palette token family (the moment
a second non-ordinal multi-category mark lands) — each its own future issue.
