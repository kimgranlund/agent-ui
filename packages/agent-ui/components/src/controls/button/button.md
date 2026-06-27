---
# button.md frontmatter — the attributes-as-API descriptor for ui-button (ADR-0004). The machine-checkable
# public surface lives HERE (frontmatter); the prose below the fence is the /site doc (Phase 3). The
# `attributes[]` block MUST mirror button.ts `static props` (variant/size/disabled) — the contract↔props
# trip-wire (s10) and the frontmatter schema (s9) target this fence; s8 ships a minimal "parses + matches
# static props" probe. Field set per docs/plan.md §10 / ADR-0004.
tag: ui-button
tier: control          # geometry size-class (Control band — full control height; geometry.md §"five size-classes")
extends: UIElement     # reactive display control, NOT form-associated (face below)

attributes:            # attributes-as-API — mirrors button.ts `static props`
  - name: variant
    type: enum
    values: [solid, soft, ghost]
    default: solid
    reflect: true      # reflects so the [variant] colour-role repoint in button.css applies to JS-set values
  - name: size
    type: enum
    values: [sm, md, lg]
    default: md
    reflect: true      # reflects so the [size] dimensional-ramp repoint applies to JS-set values
  - name: disabled
    type: boolean
    default: false
    reflect: true      # reflects to a `disabled` attribute → CSS pointer-inert hook + the trait's inert guard

properties: []         # no manual accessors beyond the attributes-as-API (no value-taking property)

events:
  - name: click
    detail: 'null'
    description: Native-parity activation; fired by pointer and by Space/Enter keyboard activation. Inert while disabled.

slots:
  - name: icon
    optional: true
    description: Optional leading icon — a light-DOM `[slot="icon"]` child placed by the presence-driven host-as-grid (ADR-0006). Absent ⇒ slotless bare-label layout.
  - name: trailing
    optional: true
    description: Optional trailing adornment — a light-DOM `[slot="trailing"]` child (a caret, chevron, or arrow) placed by the presence-driven host-as-grid. Layout only; carry any popup/disclosure meaning via ARIA on the host and mark the glyph aria-hidden.

parts: []              # light-DOM, host-as-grid — no shadow parts exposed
customStates: []       # no ElementInternals custom states (:state()) at G5

face:
  formAssociated: false  # NOT a FACE form control — extends UIElement, no value/validity participation

aria:
  role: button         # set via ElementInternals — never a host role/aria-* attribute
  roleSource: internals
  labelSource: textContent  # the light-DOM label text is the accessible name

keyboard:
  - keys: Space
    action: Activate on keyup; keydown calls preventDefault to suppress page scroll → click
  - keys: Enter
    action: Activate on keydown → click
  - note: Disabled is fully inert — no activation, no key handling

geometry:
  sizeClass: control
  blockSize: var(--ui-button-height)   # the vertical lever off the s6 dimensional ramp; padding-block is 0
  paddingBlock: 0
  inlinePad: h/2 (slotless bare label) · ½(h−icon) (leading icon / trailing adornment slot edge)   # the centering law, geometry.md
  gap: var(--ui-button-gap)            # icon↔label column-gap — the one density-bearing quantity (gap = font/2 × density)

forcedColors: A `@media (forced-colors: active)` block keeps the ink + border visible (ButtonText) so the label/outline never vanishes.
---

# ui-button

`ui-button` is the reference FACE control — a light-DOM custom element that renders an activatable
button. It is **not** form-associated: it carries no value and does not participate in form
validation; it styles its host and lets the user's light-DOM children (an optional leading icon and
the label) flow through a presence-driven CSS grid (host-as-grid, ADR-0006). ARIA `role="button"` is
applied through `ElementInternals`, never as a host attribute.

```html
<ui-button>Save</ui-button>
<ui-button variant="soft" size="lg">Continue</ui-button>
<ui-button disabled>Unavailable</ui-button>
```

## Variants

`variant` repoints the colour channel (the default family is `primary`):

- **solid** (default) — filled: accent background, on-accent ink.
- **soft** — tonal: a low container background with on-surface ink.
- **ghost** — text-only: transparent background, accent ink.

## Sizes

`size` selects a step on the dimensional ramp (`sm` · `md` (default) · `lg`), setting the control
height and font; an ancestor `[scale]` multiplies the frame and an ancestor `[density]` multiplies the
icon↔label gap. The block-size is the vertical lever — `padding-block` is always `0`.

## Icon slot

An **optional** leading icon is a light-DOM child carrying `slot="icon"`:

```html
<ui-button>
  <svg slot="icon" aria-hidden="true"><!-- … --></svg>
  Download
</ui-button>
```

When present, the host grid switches from `1fr` (slotless, inline-pad `h/2`) to `auto 1fr`: the icon
gets a square, icon-sized cell with edge-pad `½(h − icon)` and a `column-gap` between icon and label.
That gap is the single density-bearing quantity — it rides `--ui-density`, while the frame stays
density-invariant. The label text is the button's accessible name, so mark decorative icons
`aria-hidden`.

## Trailing adornment

A symmetric **optional** trailing slot takes a caret, chevron, or arrow — the affordance that signals
"opens a menu", "discloses", or "navigates". It is a light-DOM child carrying `slot="trailing"`, and it
composes with the leading icon to give four anatomies:

```html
<ui-button>Save</ui-button>                              <!-- [ label ] -->
<ui-button><svg slot="icon">…</svg>Download</ui-button>  <!-- [ icon | label ] -->
<ui-button>Options<svg slot="trailing">…</svg></ui-button>            <!-- [ label | caret ] -->
<ui-button><svg slot="icon">…</svg>Account<svg slot="trailing">…</svg></ui-button> <!-- [ icon | label | caret ] -->
```

The host grid picks the column template by presence — `1fr` · `auto 1fr` · `1fr auto` · `auto 1fr auto` —
and gives each adornment the same square `½(h − icon)`-edged cell as the leading icon, with the
density-bearing `column-gap` on each side. The trailing glyph is **layout only**: it carries no
semantics, so mark it `aria-hidden` and express any popup/disclosure meaning as ARIA on the host
(`aria-haspopup` / `aria-expanded` via `ElementInternals`), not on the icon.

## Keyboard

- **Space** — activates on `keyup`; `keydown` calls `preventDefault` to suppress page scroll, then a
  native-parity `click` fires on `keyup`.
- **Enter** — activates on `keydown` (a native-parity `click`).
- **disabled** — fully inert: no activation, no key handling, and the host is pointer-inert.

## Accessibility

- `role="button"` is set via `ElementInternals` (no host `role`/`aria-*` attribute).
- The accessible name comes from the light-DOM label text.
- A `forced-colors` block preserves the ink and border so the label and outline survive high-contrast modes.
