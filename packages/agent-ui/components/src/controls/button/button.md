---
# button.md frontmatter — the attributes-as-API descriptor for ui-button (ADR-0004). The machine-checkable
# public surface lives HERE (frontmatter); the prose below the fence is the /site doc (Phase 3). The
# `attributes[]` block MUST mirror button.ts `static props` (variant/size/disabled) — the contract↔props
# trip-wire (s10) and the frontmatter schema (s9) target this fence; s8 ships a minimal "parses + matches
# static props" probe. Field set per .claude/docs/plan.md §10 / ADR-0004.
tag: ui-button
tier: control          # geometry size-class (Control band — full control height; geometry.md §"five size-classes")
extends: UIElement     # reactive display control, NOT form-associated (face below)
# bundle: the self-defining ui-* family is 4435 B gz (11660 B min) — within the 8192 B gz budget; enforced each run by `npm run size` (scripts/measure-size.mjs)

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

slots:                 # slots name a POSITION; a slotted adornment's CONTENT role is carried on the node via `data-role` (see Slots & roles)
  - name: leading
    optional: true
    description: Optional leading adornment — a light-DOM `[slot="leading"]` child placed in the start cell by the presence-driven host-as-grid (ADR-0006; renamed from `icon` — the slot names a POSITION, not its content). Absent ⇒ the slotless bare-label layout.
  - name: label
    optional: false
    description: The label — the default/unnamed children (an explicit `[slot="label"]` is equivalent); the accessible name, filling the 1fr centre cell.
  - name: trailing
    optional: true
    description: Optional trailing adornment — a light-DOM `[slot="trailing"]` child (commonly a caret/chevron/arrow with `data-role="caret"`) placed in the end cell. Layout only; carry any popup/disclosure meaning via ARIA on the host and mark the glyph aria-hidden.

parts: []              # light-DOM, host-as-grid — no shadow parts exposed
customStates:          # :state(ready) — the motion gate (ADR-0008): armed one frame past first paint via internals.states (never a host attr) so the upgrade SNAPS and only subsequent state changes animate
  - ready

face:
  formAssociated: false  # NOT a FACE form control — extends UIElement, no value/validity participation

aria:
  role: button         # set via ElementInternals — never a host role/aria-* attribute
  roleSource: internals
  labelSource: textContent  # the light-DOM label text is the accessible name
  disabledState: internals.ariaDisabled  # disabled AX state — a reactive effect sets ariaDisabled 'true' when disabled / null otherwise off the `disabled` prop (ADR-0010); never a host aria-disabled attr, and not a native form `disabled` (ui-button is not form-associated)

keyboard:
  - keys: Space
    action: Activate on keyup; keydown calls preventDefault to suppress page scroll → click
  - keys: Enter
    action: Activate on keydown → click
  - note: Focusable by default — the `tabbable` trait sets tabindex=0 (role=button focus parity); disabled removes the host from the tab order (native <button disabled> parity), so a disabled control is never keyboard-focusable
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
validation; it styles its host and lets the user's light-DOM children (an optional leading adornment,
the label, and an optional trailing adornment) flow through a presence-driven CSS grid (host-as-grid,
ADR-0006). ARIA `role="button"` is applied through `ElementInternals`, never as a host attribute.

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
height and font; an ancestor `[scale]` (the two-band tier `ui-sm…content-lg`, default `ui-md`; ADR-0032)
multiplies the frame and an ancestor `[density]` (`compact/comfortable/spacious`) multiplies the
icon↔label gap. The block-size is the vertical lever — `padding-block` is always `0`.

## States

The control authors its own interaction states — these are **real**, not browser defaults. Each variant takes
its `:hover`/`:active` shades from a colour-role **ladder step** (never a `color-mix` — components hold zero
colour opinions; ADR-0008), so the change reads in the real palette and survives `forced-colors` for free
(every value is a `--c-{family}-{role}` role):

- **solid** — `--c-primary` idle → `--c-primary-dim` on `:hover` → `--c-primary-high` on `:active`.
- **soft** — `--c-primary-container-low` idle → `--c-primary-container` on `:hover` → `--c-primary-container-high` on `:active`.
- **ghost** — `transparent` idle, gaining a low container wash on `:hover`/`:active` (`--c-primary-container-low` → `--c-primary-container`).

Keyboard focus draws the **shared focus ring** — a `:focus-visible` `outline` from the fleet-wide
`--c-focus-ring` role (ADR-0009): keyboard-only (no ring on a mouse click), identical across every control, and
layout-neutral (`outline` paints outside the box, so the geometry law is untouched). `disabled` holds at idle —
`pointer-events: none` means `:hover`/`:active` never match, and a disabled host is out of the tab order, so the
focus ring never lifts on it either.

## Slots & roles

The anatomy separates **position** (which slot) from **role** (what's placed in it). There are three
position regions:

- **`slot="leading"`** — an optional adornment in the start cell.
- **the label** — the default/unnamed children (an explicit `slot="label"` is equivalent); the accessible name, in the centre cell.
- **`slot="trailing"`** — an optional adornment in the end cell.

What goes *into* a leading/trailing slot carries its own **role** on the node via **`data-role`** —
`icon` or `caret` today, `tag` / `badge` reserved for later. `data-role` (not the ARIA `role` attribute)
keeps the taxonomy off the ARIA channel; adornments are decorative, so mark them `aria-hidden` — the label
stays the accessible name. Position drives layout; a role only adds tuning when it needs it (e.g. a
`caret`'s rotation).

Sizing is **role-driven**, not slot-driven. A `data-role="icon"` fills the icon-sized cell
(`--ui-button-icon`, the icon ramp). A `data-role="caret"` is an **inline affordance sized to the label
font** — `--ui-button-glyph` (`= --ui-button-font`), *not* the icon ramp — so it stays at text scale,
**centers** within the icon-sized cell, and lands at the emergent `½(h − font)` trailing edge instead of
rendering oversized. This two-axis anatomy (positional slots × a `data-role` role axis) **extends** the
host-as-grid of ADR-0006 and is the family adornment standard (ADR-0012).

```html
<ui-button>Save</ui-button>                                                          <!-- [ label ] -->
<ui-button><svg slot="leading" data-role="icon">…</svg>Download</ui-button>          <!-- [ leading | label ] -->
<ui-button>Options<svg slot="trailing" data-role="caret">…</svg></ui-button>         <!-- [ label | trailing ] -->
<ui-button><svg slot="leading" data-role="icon">…</svg>Account<svg slot="trailing" data-role="caret">…</svg></ui-button> <!-- [ leading | label | trailing ] -->
```

The host grid picks the column template by presence — `1fr` · `auto 1fr` · `1fr auto` · `auto 1fr auto` —
giving each adornment a square, `½(h − icon)`-edged cell with the density-bearing `column-gap` between
cells (the one quantity that rides `--ui-density`; the frame stays density-invariant). The trailing glyph
is **layout only** — express any popup/disclosure meaning as ARIA on the host (`aria-haspopup` /
`aria-expanded` via `ElementInternals`), never on the glyph.

## Keyboard & focus

- **Tab** — the host is focusable by default: the `tabbable` trait sets `tabindex="0"` (role=button focus
  parity), so a keyboard user reaches it like a native button. The trait reacts to the `disabled` prop —
  `disabled` removes the host from the tab order (`removeAttribute('tabindex')`, native `<button disabled>`
  parity), so a disabled control is skipped.
- **Space** — activates on `keyup`; `keydown` calls `preventDefault` to suppress page scroll, then a
  native-parity `click` fires on `keyup`.
- **Enter** — activates on `keydown` (a native-parity `click`).
- **disabled** — fully inert: no activation, no key handling, the host is pointer-inert, and it is removed
  from the tab order (so the focus ring never shows on a disabled control).

## Accessibility

- `role="button"` is set via `ElementInternals` (no host `role`/`aria-*` attribute).
- The accessible name comes from the light-DOM label text.
- **Disabled is announced** via `ElementInternals.ariaDisabled` — a reactive effect sets it `'true'` when the
  `disabled` prop is set and clears it (`null`) otherwise (ADR-0010). It is an AX state on `internals`, never a
  host `aria-disabled` attribute, and not a native form `disabled` (`ui-button` is not form-associated, so it
  has no platform disabled state).
- **Keyboard focus shows a ring** — a `:focus-visible` `outline` from the shared `--c-focus-ring` role
  (ADR-0009): identical across the fleet, keyboard-only, and layout-neutral.
- A `forced-colors` block preserves the ink and border so the label and outline survive high-contrast modes;
  the focus ring's `--c-focus-ring → Highlight` mapping keeps the ring visible there too.
