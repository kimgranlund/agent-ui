---
# button.md frontmatter — the attributes-as-API descriptor for ui-button (ADR-0004). The machine-checkable
# public surface lives HERE (frontmatter); the prose below the fence is the /site doc (Phase 3). The
# `attributes[]` block MUST mirror button.ts `static props` (variant/size/disabled/iconOnly) — the contract↔props
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
  - name: iconOnly
    type: boolean
    default: false
    reflect: true      # reflects to icon-only → the CSS fifth structure (geometry.md "icon-only (no label) → square")
                         # HTML attribute is `icon-only` (an explicit `attribute:` override in button.ts — same
                         # load-bearing reason as attachment.md's mimeType: a literal camelCase observed-attribute
                         # name never matches the always-lowercase real DOM attribute in an HTML document).
                         # Explicit author opt-in — CSS alone cannot detect an empty/text-node label (:has() only
                         # matches elements). Set it when composing a real slotted adornment with NO label text;
                         # the accessible name must then come from `aria-label` (there is nothing in textContent).

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
    optional: true
    description: The label — the default/unnamed children (an explicit `[slot="label"]` is equivalent); the accessible name, filling the 1fr centre cell. May be omitted entirely for an icon-only button (set `icon-only` and supply `aria-label` for the accessible name — see Slots & roles). Adopted into the control-created `<span data-part="label">` wrapper (ADR-0133 — see Parts) so an overflowing label can carry `text-overflow: ellipsis`; the accessible name is unaffected (the wrapper carries no ARIA role, textContent still computes the name).
  - name: trailing
    optional: true
    description: Optional trailing adornment — a light-DOM `[slot="trailing"]` child (commonly a caret/chevron/arrow with `data-role="caret"`) placed in the end cell. Layout only; carry any popup/disclosure meaning via ARIA on the host and mark the glyph aria-hidden.

parts:                 # light-DOM, host-as-grid — ONE control-created wrapper (ADR-0133), everything else is author content
  - name: label
    description: The control-created `<span data-part="label">` the label region's light-DOM children (the default/unnamed children — anything without a `slot`) are adopted into, MOVED never cloned. Built on connect and self-healed by a `childList` MutationObserver (ui-text's ADR-0078 cl.4 stamp/heal shape, adapted): a stray label child that lands on the host later (parser streaming, or an external `textContent` write — e.g. the A2UI `buttonFactory`'s bound `label`) is re-adopted, and a full clobber that destroys the wrapper rebuilds it fresh. Never created for an empty label (an `icon-only` button keeps its square anatomy untouched — see Slots & roles). Carries `overflow: hidden; text-overflow: ellipsis` (button.css) so a label that overflows the frame's available inline space truncates with a visible ellipsis instead of clipping/overlapping silently; `white-space: nowrap` (already unconditional on the host) inherits into it for free. No geometry change when the label fits (no padding/margin/border of its own; blockified as a grid item, inherits font/line-height/color from the host).
customStates:          # :state(ready) — the motion gate (ADR-0008): armed one frame past first paint via internals.states (never a host attr) so the upgrade SNAPS and only subsequent state changes animate
  - ready

face:
  formAssociated: false  # NOT a FACE form control — extends UIElement, no value/validity participation

aria:
  role: button         # set via ElementInternals — never a host role/aria-* attribute
  roleSource: internals
  labelSource: textContent  # the light-DOM label text is the accessible name; when `icon-only` omits the label, the caller must supply `aria-label` instead (there is no textContent to read)
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
  inlinePad: h/2 (slotless bare label) · ½(h−icon) (leading icon / trailing adornment slot edge) · ½(h−icon) BOTH edges via justify-content, no literal padding (icon-only, no label)   # the centering law, geometry.md
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
(every value is a `--md-sys-color-{family}-{role}` role):

- **solid** — `--md-sys-color-primary` idle → `--md-sys-color-primary-dim` on `:hover` → `--md-sys-color-primary-high` on `:active`.
- **soft** — `--md-sys-color-primary-container-low` idle → `--md-sys-color-primary-container` on `:hover` → `--md-sys-color-primary-container-high` on `:active`.
- **ghost** — `transparent` idle, gaining a low container wash on `:hover`/`:active` (`--md-sys-color-primary-container-low` → `--md-sys-color-primary-container`).

Keyboard focus draws the **shared focus ring** — a `:focus-visible` `outline` from the fleet-wide
`--md-sys-color-focus-ring` role (ADR-0009): keyboard-only (no ring on a mouse click), identical across every control, and
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
<ui-button icon-only aria-label="Dismiss"><svg slot="leading" data-role="icon">…</svg></ui-button> <!-- [ icon-only, no label ] -->
```

The host grid picks the column template by presence — `1fr` · `auto 1fr` · `1fr auto` · `auto 1fr auto` —
giving each adornment a square, `½(h − icon)`-edged cell with the density-bearing `column-gap` between
cells (the one quantity that rides `--md-sys-density`; the frame stays density-invariant). The trailing glyph
is **layout only** — express any popup/disclosure meaning as ARIA on the host (`aria-haspopup` /
`aria-expanded` via `ElementInternals`), never on the glyph.

### Icon-only (no label)

A real slotted adornment with **no label content at all** needs the `icon-only` attribute. CSS alone
cannot tell an empty label apart from a real one — `:has()` only matches *elements*, so the common
`<svg slot="leading">…</svg>Download` pattern's `Download` label is a bare *text node*, invisible to a
selector. Without `icon-only`, that structure still reserves the `1fr` label track and its `h/2` trailing
pad, rendering wider than tall with dead space on the end. Setting `icon-only` swaps in the fifth,
mutually-exclusive structure: **one** column with its `inline-size` set explicitly equal to the control
height (mirroring `block-size`, so a true square holds regardless of border width), content-centered via
`justify-content` — which lands the rendered inset at the same `½(h − icon)` the other structures pad to.
Because there is no label text, the accessible name must come from `aria-label` on the host (the
`ui-toast` close button is the reference usage). `icon-only` assumes a **single** adornment (leading OR
trailing) — the fifth structure is one column, so both slots present together is undefined layout (the
second silently wraps/overflows rather than erroring); no current consumer needs two icons on an
icon-only button, so this is documented rather than fenced.

### Overflow (ADR-0133)

A label that overflows the frame's available inline space truncates to a single line with an
ellipsis instead of clipping or overlapping without affordance. This is unconditional — no prop
opts in — because the label is already forced to one line (`white-space: nowrap`); ellipsis
completes that existing contract rather than adding a new one. The mechanism: `button.ts` adopts
the label region's light-DOM children into a control-created `<span data-part="label">` (moved,
never cloned — see **Parts** in the frontmatter) so `text-overflow` has a real box to attach to
(anonymous host-as-grid text has none). The wrapper is self-healing — a childList `MutationObserver`
re-adopts label content that arrives after connect, including a bound `label` write that replaces
`textContent` wholesale (the A2UI catalog's `Button.label` factory) — so ellipsis keeps working
across dynamic label updates, not just the initial render. The accessible name is unaffected: the
wrapper carries no ARIA role, and the full label text is still read by assistive tech regardless of
visual clipping. There is no `title` reveal mirror (contrast `ui-text[truncate]`, ADR-0106) — button
labels are short, first-order UI copy, not free-form prose, and no evidence has surfaced that a
hover-reveal affordance is needed here.

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
- **Keyboard focus shows a ring** — a `:focus-visible` `outline` from the shared `--md-sys-color-focus-ring` role
  (ADR-0009): identical across the fleet, keyboard-only, and layout-neutral.
- A `forced-colors` block preserves the ink and border so the label and outline survive high-contrast modes;
  the focus ring's `--md-sys-color-focus-ring → Highlight` mapping keeps the ring visible there too.
