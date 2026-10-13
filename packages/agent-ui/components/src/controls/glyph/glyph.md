---
# glyph.md frontmatter: the attributes-as-API descriptor for ui-glyph (ADR-0004 / ADR-0245 clauses 4 and 5).
# The machine-checkable public surface lives HERE (frontmatter); the prose below the fence is the /site doc.
# The `attributes[]` block MUST mirror glyph.ts `static props` (symbol, label); the contract<->props
# trip-wire (glyph-descriptor.test.ts) targets this fence.
tag: ui-glyph
description: A functional mark (check, x, plus, minus, a caret, dot, more, warning, info) drawn from the library path table in its own glyph box.
tier: display          # geometry size-class (Display band: no control frame or height); the ui-icon sibling
extends: UIElement     # a non-interactive display LEAF: not form-associated, not a UIContainerElement surface
uses: []
# marginal: not yet measured; measured at the fleet size gate (npm run size)

attributes:            # attributes-as-API, mirrors glyph.ts `static props` (symbol, label)
  - name: symbol
    type: string
    default: ''
    reflect: false     # NOT reflected; one of the closed twelve marks (glyph-paths.ts GLYPH_SYMBOLS). Empty clears the host; an unknown name renders an empty `<svg data-glyph-missing>`. The same prop name ui-icon takes (ADR-0245 cl.4)
  - name: label
    type: string
    default: ''
    reflect: true      # TKT-0069 item 2 ruling: label reflects fleet-wide

properties: []         # no manual accessors beyond the two typed props

events: []             # display-only: emits nothing (not interactive)

slots: []              # no light-DOM content model; the ONLY child is the control-built <svg>, never author-slotted content

parts: []              # no data-part parts; the svg is selected by tag (glyph.css `:scope svg`)

customStates: []       # no interaction state and no motion gate: a display leaf has neither

face:
  formAssociated: false  # a display leaf: extends UIElement, no value or validity participation

aria:
  role: img              # role=img ONLY when `label` is non-empty (a meaningful mark); decorative (aria-hidden) otherwise
  roleSource: internals  # a reactive connected() effect off `label` sets internals.role/.ariaLabel/.ariaHidden, never a host attribute
  labelSource: label prop  # `label` (non-empty) IS the accessible name; a decorative mark (label='') has none and is aria-hidden

keyboard: []           # NOT interactive and NOT focusable: no tabindex, no keyboard contract

geometry:
  sizeClass: display
  inlineSize: var(--ui-glyph-slot)   # the shared icon slot, `--md-sys-icon-box` (2n) in an opt-in region, 1em outside one
  blockSize: var(--ui-glyph-slot)
  padding: var(--ui-glyph-inset)     # c on each side, so the mark box is 2n - 2c (`--md-sys-glyph-box`)

forcedColors: No dedicated `@media (forced-colors: active)` block. The host paints nothing of its own; `color: inherit` means the svg's `currentColor` stroke tracks whatever forced-colors ink the consuming context resolves to.
---

# ui-glyph

`ui-glyph` is the functional-mark atom: one of twelve library marks in its own glyph box.

It draws a check, an x, a plus or minus, a caret, a dot, a more (three dots), a warning or an info mark. It
is the **Display**-class sibling of `ui-icon` (ADR-0245 clause 4): an icon is pictorial art from the
swappable pack, a glyph is library geometry with its own, smaller box. Both take the same `symbol` prop.

```html
<ui-glyph symbol="caret-down"></ui-glyph>
<ui-glyph symbol="check" label="Done"></ui-glyph>
<div data-tier="product" data-scale="sm"><ui-glyph symbol="plus"></ui-glyph></div>
```

## The closed set

`symbol` takes one of twelve marks: `check`, `x`, `plus`, `minus` (also the indeterminate dash),
`caret-up`, `caret-down`, `caret-left`, `caret-right`, `dot`, `more`, `warning`, `info`. Pictorial names such
as `eye` or `calendar-blank` stay icons. A new mark joins the set only by amending ADR-0245. An empty
`symbol` clears the host; a name outside the set renders an empty `<svg data-glyph-missing>` rather than a
guess.

One path table owns every mark (`glyph-paths.ts`). Each mark is a stroke path in a fixed 16-unit square,
drawn with `currentColor` and a non-scaling stroke, so the stroke width is a token rather than a property of
the drawing; `dot` and `more` are filled.

## Sizing

The host is the shared **icon slot**: `2n` wide and tall, inset `c` on each side, so the mark box is
`2n - 2c` and an icon and a glyph in neighbouring slots share the slot box and the centre line. Inside an
opt-in `data-tier` region these read the derived foundation tokens (`--md-sys-icon-box`, `--md-sys-c`,
`--md-sys-glyph-stroke`, ADR-0245): at the library root (`data-tier="product" data-scale="sm"`) the mark is
8 / 10 / 12 px for sizes sm / md / lg with a 1.5px stroke. Outside a region the slot is `1em` with a
`0.125em` inset, like `ui-icon`'s `1em` cell. Override `--ui-glyph-slot`, `--ui-glyph-inset` or
`--ui-glyph-stroke` on the host to resize one mark.

## Accessibility

`ui-glyph` is **decorative by default** (`aria-hidden`, no role): a caret or a check usually accompanies a
control that already names itself. A non-empty `label` makes the mark **meaningful**: `role="img"` and
`aria-label` through `ElementInternals`, with `aria-hidden` cleared. Use `label` only when the mark is the
sole carrier of its meaning.
