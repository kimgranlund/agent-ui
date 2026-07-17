---
# swatch.md frontmatter — the attributes-as-API descriptor for ui-swatch (ADR-0004; LLD-C8,
# token-surfaces.lld.md §4). The machine-checkable public surface lives HERE (frontmatter); the prose below
# the fence is the /site doc. The `attributes[]` block MUST mirror swatch.ts `static props` (value/label/
# scheme) — the contract↔props trip-wire (swatch-descriptor.test.ts) targets this fence.
tag: ui-swatch
description: A bordered color box that shows one resolved color value alongside its token name as accessible text.
tier: display          # Display band — no control frame/height/[size]/[scale] (SPEC-R16/ADR-0118 cl.5)
extends: UIElement     # a non-interactive display LEAF — NOT form-associated (SPEC-R1)
# marginal: 118 B gz — within the 2048 B gz per-control budget (ADR-0080 clause 3); solo 4789 B gz
# (foundation-inclusive, informational). Measured 2026-07-10 (wave M1-c, LLD-C9) via `npm run size` through
# the public `./controls/swatch` entry, after the barrel + component-styles.css wiring landed. Family total
# (`components` barrel): 30593 B gz — within the 30720 B gz ceiling (127 B headroom), no re-base needed.

attributes:            # attributes-as-API — mirrors swatch.ts `static props` (value, label, scheme)
  - name: color
    type: string
    default: ''        # a literal CSS color OR a --var name (cssValue routes it — SPEC-R2)
    reflect: false
  - name: label
    type: string
    default: ''        # the token name / caption (SPEC-R1)
    reflect: true       # TKT-0069 item 2 ruling: label reflects fleet-wide
  - name: scheme
    type: enum
    values: [auto, light, dark]
    default: auto      # color-scheme pin; 'auto' = inherit ambient (SPEC-R2)
    reflect: false

properties: []          # no manual accessors beyond the three typed props

events: []              # display-only — emits nothing (SPEC-R1: no events, no keyboard contract)

slots: []               # no light-DOM content model — render() stays the inherited no-op; box + value are
                         # component-built (replaceChildren on first run, mutated in place thereafter)

parts:
  - name: box
    description: The `<span data-part="box">` — the bordered color box. `background` is the routed `value` (SPEC-R2); `color-scheme` carries the `scheme` pin. Not separately announced — color cannot be spoken.
  - name: value
    description: The `<span data-part="value">` — the composed `label`/`value` string as real DOM text (SPEC-R2/R4). The SAME string is also the accessible name (internals.ariaLabel) — one composition, two surfaces.

customStates: []        # NO interaction state and NO motion gate — a display leaf has neither

face:
  formAssociated: false  # a display leaf — extends UIElement, no value/validity participation

aria:
  role: img              # role=img via ElementInternals — CONSTANT, set once in connected() (SPEC-R4, ADR-0118 cl.4)
  roleSource: internals   # `this.internals.role = 'img'` — NEVER a host role attribute (the FACE pattern)
  labelSource: composed name (label + ', ' + value; value or label alone; 'swatch' when neither — SPEC-R4, never nameless)

keyboard: []            # NOT interactive and NOT focusable — no tabindex, no keyboard contract

geometry:
  sizeClass: display
  inlineSize: var(--ui-swatch-box-size)   # 2rem default box — NO [size] ramp, NO --md-sys-height-* (SPEC-R16 AC2)
  blockSize: var(--ui-swatch-box-size)

forcedColors: An explicit `@media (forced-colors: active)` block (SPEC-R14) — the box degrades to a `CanvasText` border with its `background` forced `transparent` (never a fake system color); the value/label text is real text and survives untouched.
---

# ui-swatch

`ui-swatch` is the **Display**-class color-identity leaf (ADR-0118, token-surfaces v1) — a bordered color
box whose whole contract is "show this one color value, resolved live," with the token name/caption as
real, accessible text. It is **not** interactive and **not** form-associated: no events, no keyboard
contract.

```html
<ui-swatch color="oklch(0.6 0.03 225)" label="primary-500"></ui-swatch>
<ui-swatch color="--md-sys-color-primary-container" label="primary-container" scheme="dark"></ui-swatch>
```

## Rendering

The box's `background` is the `value` string, routed through the shared `--var` lane (LLD-C1): a literal
color paints directly; a value beginning `--` paints `var(<value>)`, resolved live in the element's context
— **no color math anywhere**, the browser is the only resolver (ADR-0118 cl.2/3). The `scheme` prop, when
`light`/`dark`, sets `color-scheme` on the box so a `light-dark()`-valued token resolves under the pinned
scheme; `auto` (the default) sets nothing and inherits the ambient scheme. The box carries a hairline
`--md-sys-color-outline-variant` border so a swatch painting the page's own surface color never disappears
(SPEC-R2 AC3). No SVG, no canvas, no library.

## Degenerate value

Every case still paints the host box and still announces (never throws — SPEC-R3): an empty/absent `value`
renders transparent (border only — the honest "no color" state); an undefined `--var` also resolves
transparent (`var()` with no fallback → invalid → transparent, no throw); an invalid color string is simply
dropped by the browser's CSS parser (no component guard needed). The composed name still announces in
every case (SPEC-R4).

## Accessibility

A swatch is data, not decoration: `role="img"` via `ElementInternals` (never a host attribute), with a
**composed accessible name** — `label` + `", "` + `value` when both are set, the value alone with no
label, and `"swatch"` when neither (never nameless, never a silent state). The color itself cannot be
announced — only its name/value, which is why the composed string is also the visible `[data-part='value']`
text content: the printed datum and the accessible name are the same string, in lockstep by construction.

## Sizing

The host defaults to a `2rem × 2rem` box (`--ui-swatch-box-size`) — an EXPLICIT token size, not `auto`: a
swatch has no intrinsic content, so a bare `<ui-swatch>` in an unstyled flex row still paints a visible,
non-collapsed square with zero consumer CSS (ADR-0102 Lane A). There is no `[size]`/`[scale]` attribute and
no `--md-sys-height-*` lever (SPEC-R16 AC2) — the value text reads the `--md-sys-typescale-body-medium-*` row
directly.

## Forced colors (WHCM)

The box degrades to a `CanvasText` border with its `background` forced `transparent` — an explicit
override, because a color box cannot paint under `forced-colors: active` and a system color that
misrepresents the token would be dishonest. The value/label text is real text and needs no override.
