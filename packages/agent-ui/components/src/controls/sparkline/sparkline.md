---
# sparkline.md frontmatter — the attributes-as-API descriptor for ui-sparkline (ADR-0004; LLD-C7,
# chart-family.lld.md §4). The machine-checkable public surface lives HERE (frontmatter); the prose below
# the fence is the /site doc. The `attributes[]` block MUST mirror sparkline.ts `static props`
# (values/label/variant) — the contract<->props trip-wire (sparkline-descriptor.test.ts) targets this fence.
tag: ui-sparkline
description: An inline, axis-free line or area mark that shows the shape of a numeric series at a glance.
tier: display          # geometry size-class (Display band — NO control frame/height; SPEC-R12/ADR-0107 cl.5)
extends: UIElement     # a non-interactive, non-form-associated display LEAF (SPEC-R1)
# marginal: 715 B gz — within the 2048 B gz per-control budget (ADR-0080 clause 3); solo 5309 B gz
# (foundation-inclusive, informational). Measured 2026-07-08 (wave M1-b, LLD-C8, `npm run size` through the
# public `./controls/sparkline` entry) after the barrel + component-styles.css wiring landed. The whole-family
# `components` barrel measured 25847 B gz — over the old 25 KB ceiling by 247 B once BOTH chart controls
# wired in; RESOLVED same-wave by the ADR-0107 ## Amendment (the Consequences-anticipated re-base): the
# ceiling is now 26 KB (26624 B gz), recorded in scripts/measure-size.mjs's re-base comment chain.

attributes:            # attributes-as-API — mirrors sparkline.ts `static props` (values, label, variant)
  - name: values
    type: json          # closest ATTR_TYPES member to "array of number, JSON-string attribute form" (SPEC-R1)
    default: ''         # the LIVE default is `[]` (an empty array) — `String([])===''` is what the
                         # contract<->props trip-wire (compareDescriptorToProps) actually compares against,
                         # since it reads `String(config.default)`, not a JSON-stringified form
    reflect: false      # NOT reflected — a JSON-string attribute round-trips through the codec, not setAttribute
    # the live codec is the SPEC-R3 safe-values codec — `from(null) = []` (never `null`), so a malformed/
    # removed attribute never reaches the render path. component-descriptor.ts's `kindOf` classifies this
    # (and any codec whose `from(null)` is an array) as "json" — the fleet's first array-typed prop, a clean
    # bijection against compareDescriptorToProps (M1-b shared-infra fix).
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

events: []             # display-only — emits nothing (SPEC-R1: no events, no keyboard contract)

slots: []              # no light-DOM content model — render() stays the inherited no-op; the ONLY child is
                        # the control-built <svg> (createElementNS + replaceChildren), never author-slotted

parts:                  # data-part nodes inside the control-built <svg> (selected by sparkline.css, not by name from TS)
  - name: line
    description: The `<polyline data-part="line">` — the normalized series stroke (`stroke="currentColor"`, `vector-effect="non-scaling-stroke"`). Always present when the rendered set is non-empty.
  - name: area
    description: The `<polygon data-part="area">` — the closed fill under the stroke (`fill="currentColor"` at `--ui-sparkline-area-opacity`). Present only when `variant="area"` AND the rendered set has >= 2 points.

customStates: []       # NO interaction state and NO motion gate — a display leaf has neither (no :state(); nothing to transition)

face:
  formAssociated: false  # a display leaf — extends UIElement, no value/validity participation

aria:
  role: img              # role=img via ElementInternals — CONSTANT, set once in connected() (never toggled)
  roleSource: internals   # `this.internals.role = 'img'` — NEVER a host role attribute (the FACE pattern)
  labelSource: the generated summary  # `internals.ariaLabel` = sparklineSummary(label, geometry) — recomputed on label/values change; NEVER null, NEVER aria-hidden (SPEC-R4 AC2: no silent state, with or without a label)

keyboard: []           # NOT interactive and NOT focusable — no tabindex, no keyboard contract

geometry:
  sizeClass: display
  inlineSize: var(--ui-sparkline-inline-size)   # 8em default — the deterministic sizing ruling (SPEC-R9 AC1); NO [size] ramp, NO --md-sys-height-* (SPEC-R12 AC2)
  blockSize: var(--ui-sparkline-block-size)     # 1lh default — rides the ambient line box

forcedColors: No dedicated `@media (forced-colors: active)` block (SPEC-R10) — the mark is `currentColor` stroke/fill, which resolves to whatever forced ink the CONSUMING context already resolves to (the `ui-icon` precedent); the area wash is that same ink at the `--ui-sparkline-area-opacity` token (opacity is not a color property — WHCM never flattens it).
---

# ui-sparkline

`ui-sparkline` is the **Display**-class series-shape mark (ADR-0107, chart-family v1) — an inline,
axis-free chart that answers one question: "what is the shape of this series?" It is **not** interactive
and **not** form-associated: no ticks, no legend, no keyboard contract, no events.

```html
<ui-sparkline values="[3,5,4,8,7]" label="Revenue trend"></ui-sparkline>
<ui-sparkline values="[3,5,4,8,7]" variant="area"></ui-sparkline>
```

## Rendering

The mark is component-built inline SVG — a normalized 0..100 x 0..100 viewBox polyline, `stroke="currentColor"`,
`vector-effect="non-scaling-stroke"` (a crisp constant-width stroke at any box size or DPR),
`preserveAspectRatio="none"` (fills the host box exactly). `variant="area"` adds the same polyline closed to
the bottom edge as a low-alpha `currentColor` fill under the stroke. Ordinal spacing by index; the vertical
range auto-normalizes to the rendered set's min/max. Setting `values`/`variant` re-renders the whole mark —
there is no incremental-append API (A2UI `updateDataModel` semantics).

## Degenerate data

Every case still paints the host box and still announces (never throws): empty/absent/malformed input
renders nothing (the box paints via the CSS floors); non-finite entries (`NaN`, `Infinity`, non-numbers) are
dropped, the remainder renders; exactly one finite point renders a visible dot at vertical center (round
`stroke-linecap` on a zero-length segment); all-equal values render a flat horizontal line at vertical
center; negative values normalize within `[min, max]` with no special-casing.

## Accessibility

A sparkline is data, not decoration: `role="img"` via `ElementInternals`, with a **generated accessible
name** — there is no silent state, with or without `label`. The name is `label` (when non-empty) + `": "` +
a computed summary over the rendered set:

- 2+ points: `{n} points, starts {first}, ends {last}, low {min}, high {max}`
- 1 point: `1 point, value {v}`
- 0 points: `no data`

Numbers are formatted with the platform default-locale `Intl.NumberFormat`. The summary is a lossy fact
sheet (count, endpoints, extrema), not a full data readout or an interpretive trend word — an honest,
recorded cost (ADR-0107).

## Sizing

The host defaults to an explicit `8em x 1lh` box (`--ui-sparkline-inline-size` / `--ui-sparkline-block-size`)
— a deterministic default, not an `auto` one: a percentage-sized SVG inside a shrink-to-fit flex item falls
back to the browser's 300px replaced-element intrinsic, which would paint inconsistently across containers.
Override either token, or set `inline-size`/`block-size` directly, to size the mark to a layout.

## RTL

The series keeps its **physical left-to-right** reading direction in RTL contexts — chronology is data
order, and series charts conventionally stay LTR even in RTL locales. SVG viewBox coordinates are never
mirrored.
