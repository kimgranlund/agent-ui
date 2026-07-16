---
# ramp.md frontmatter — the attributes-as-API descriptor for ui-ramp (ADR-0004; LLD-C8,
# token-surfaces.lld.md §4). The machine-checkable public surface lives HERE (frontmatter); the prose below
# the fence is the /site doc. The `attributes[]` block MUST mirror ramp.ts `static props` (steps/label/
# scheme) — the contract↔props trip-wire (ramp-descriptor.test.ts) targets this fence.
tag: ui-ramp
description: An ordered strip of color cells, each labeled with real accessible text, showing a tonal or palette series.
tier: display          # Display band — no control frame/height/[size]/[scale] (SPEC-R16/ADR-0118 cl.5)
extends: UIElement     # a non-interactive display LEAF — NOT form-associated (SPEC-R5)
# marginal: 148 B gz — within the 2048 B gz per-control budget (ADR-0080 clause 3); solo 4962 B gz
# (foundation-inclusive, informational). Measured 2026-07-10 (wave M1-c, LLD-C9) via `npm run size` through
# the public `./controls/ramp` entry, after the barrel + component-styles.css wiring landed. Family total
# (`components` barrel): 30593 B gz — within the 30720 B gz ceiling (127 B headroom), no re-base needed.

attributes:            # attributes-as-API — mirrors ramp.ts `static props` (steps, label, scheme)
  - name: steps
    type: json          # closest ATTR_TYPES member to "array of {label,value} objects, JSON-string attribute form" (SPEC-R5)
    default: ''         # the LIVE default is `[]` — `String([])===''` is what the contract↔props trip-wire
                         # (compareDescriptorToProps) actually compares against (`String(config.default)`)
    reflect: false       # NOT reflected — a JSON-string attribute round-trips through the shared LLD-C1 codec
                         # `from(null) = []` (never `null`), so a malformed/removed attribute never reaches render
  - name: label
    type: string
    default: ''         # the strip's accessible name (SPEC-R8: unlabeled is legal, never a silent state)
    reflect: true       # TKT-0069 item 2 ruling: label reflects fleet-wide
  - name: scheme
    type: enum
    values: [auto, light, dark]
    default: auto      # pins the WHOLE strip's color-scheme resolution (shared by every cell)
    reflect: false

properties: []          # no manual accessors beyond the three typed props

events: []              # display-only — emits nothing (SPEC-R5: no events, no keyboard contract)

slots: []               # no light-DOM content model — render() stays the inherited no-op; every cell is
                         # component-built (replaceChildren), never author-slotted

parts:
  - name: cell
    description: The `<div role="listitem" data-part="cell">` — one strip cell per valid step.
  - name: box
    description: The `<span data-part="box" aria-hidden="true">` inside a cell — the color box. `background` is the routed step `value` (SPEC-R2); `color-scheme` carries the strip-shared `scheme` pin. Not separately announced — color cannot be spoken.
  - name: step-label
    description: The `<span data-part="step-label">` — the step's label as real DOM text. Part of the listitem's accessible text content.
  - name: value
    description: The `<span data-part="value">` — the step's value string as real DOM text. Part of the listitem's accessible text content — the printed value is the accessible datum (SPEC-R8).

customStates: []        # NO interaction state and NO motion gate — a display leaf has neither

face:
  formAssociated: false  # a display leaf — extends UIElement, no value/validity participation

aria:
  role: list              # role=list via ElementInternals — CONSTANT, set once in connected() (the ui-bar-chart precedent)
  roleSource: internals    # `this.internals.role = 'list'` — NEVER a host role attribute (the FACE pattern)
  labelSource: label prop  # `internals.ariaLabel = label || null` — an unlabeled strip is legal (SPEC-R8); never aria-hidden
  childRole: listitem      # each rendered cell is a real `role="listitem"` element (a light-DOM attribute — the anatomy.md sanction for interior nodes; only HOST aria rides internals)

keyboard: []            # NOT interactive and NOT focusable — no tabindex, no keyboard contract

geometry:
  sizeClass: display
  minInlineSize: var(--ui-ramp-min-inline-size)  # 8em default — the whole-shape floor (SPEC-R13 AC1); NO [size] ramp, NO --ui-height-* (SPEC-R16 AC2)
  cellSize: var(--ui-ramp-cell-size)              # per-cell box size — density-invariant

forcedColors: An explicit `@media (forced-colors: active)` block (SPEC-R14) — every cell's box degrades to a `CanvasText` border with its `background` forced `transparent` (never a fake system color); the step-label/value text is real text and survives untouched.
---

# ui-ramp

`ui-ramp` is the **Display**-class ordered-color-series leaf (ADR-0118, token-surfaces v1) — a wrapping
strip of color cells whose whole contract is "show this color series in order," each cell's label/value as
real, accessible text. Order IS the content (a tonal ramp, a palette range). It is **not** interactive and
**not** form-associated: no events, no keyboard contract.

```html
<ui-ramp
  label="Primary tonal range"
  steps='[{"label":"100","value":"--md-sys-color-primary-100"},{"label":"500","value":"--md-sys-color-primary-500"},{"label":"900","value":"--md-sys-color-primary-900"}]'
></ui-ramp>
```

## Rendering

One cell per valid step, in `steps` order: a color box (the same painting + `--var` lane + hairline-border
rules as `ui-swatch`, under the ramp's shared `scheme`) with its per-step `label` as real DOM text. The
cells form a strip that WRAPS rather than overflowing its container. Setting `steps` re-renders the whole
strip (a whole-array swap — there is no incremental-append API, the A2UI `updateDataModel` semantics).

## Degenerate steps

Every case still paints and still announces (never throws — SPEC-R7): `[]`/absent/malformed input renders
zero cells (the host stays `role=list` with zero items — an honest empty state); a step missing a string
`label` or `value` is dropped, the remainder renders in order; a step whose `value` is an invalid color or
undefined `--var` renders transparent + border (the swatch honesty, SPEC-R3), its label still prints;
duplicate labels render as separate cells (the strip is positional, not keyed).

## Accessibility

A ramp is data, not decoration: the host carries `role="list"` via `ElementInternals` (never a host
attribute), named by `label` when non-empty — an unlabeled ramp is legal (never a silent state). Each
rendered cell is a real `role="listitem"` element whose text content is its label plus its printed value —
the two real text spans (`[data-part='step-label']` / `[data-part='value']`). The color box
(`[data-part='box']`) is `aria-hidden` and text-free: color cannot be announced, so no step is ever
color-encoded only (CVD-safe by construction).

## Sizing

The host defaults to an `8em` `min-inline-size` floor (`--ui-ramp-min-inline-size`) — a bare, unstyled ramp
in a flex row still paints a visible, non-collapsed strip with zero consumer CSS (ADR-0102 Lane A). Each
cell's box (`--ui-ramp-cell-size`) is density-invariant; the strip gap (`--ui-ramp-gap`) rides the
`--ui-space` ladder and responds to an ancestor `[density]` for free. There is no `[size]`/`[scale]`
attribute and no `--ui-height-*` lever (SPEC-R16 AC2).

## RTL

The strip keeps its **physical** left-to-right series direction regardless of locale (via `direction: ltr`
on the scope) — a tonal progression conventionally reads light→dark left-to-right (the `ui-sparkline`
series-direction precedent). Note: this also forces LTR base direction on cell text — harmless for the
numeric/hex values cells carry today; revisit if RTL step labels ever become expected content; the
step-label/value text inside each cell stays logical. `dir="rtl"` therefore does NOT mirror the strip's cell
order.

## Forced colors (WHCM)

Every cell's box degrades to a `CanvasText` border with its `background` forced `transparent` — the same
honesty as `ui-swatch`. The step-label/value text is real text and needs no override.
