---
# playing-card.md frontmatter — the attributes-as-API descriptor for ui-playing-card (ADR-0004; ADR-0225,
# GH #1478). The machine-checkable public surface lives HERE (frontmatter); the prose below the fence is
# the /site doc. The `attributes[]` block MUST mirror playing-card.ts `static props`
# (rank/suit/faceDown/size) — the contract<->props trip-wire (playing-card-descriptor.test.ts) targets
# this fence.
tag: ui-playing-card
description: A true standard playing card — corner indices + a real suit-pip field or letter treatment, red/black inks, a CSS-painted back — as a fixed-bridge-aspect display leaf that flips on faceDown and deals in on insertion.
tier: display          # geometry size-class (Display band) — a non-interactive, non-form-associated mark; the [size] em-box ramp is the pie-chart-ring/avatar-F3 REPOINT pattern, not a control-height lever (ADR-0225 cl.5)
extends: UIElement     # a non-interactive, non-form-associated display LEAF (ADR-0225)
# marginal: measured at the build wave via `npm run size` (see the commit's gate evidence)

attributes:            # attributes-as-API — mirrors playing-card.ts's static props (rank, suit, faceDown, size)
  - name: rank
    type: enum
    values: ['', A, '2', '3', '4', '5', '6', '7', '8', '9', '10', J, Q, K]
    default: ''         # blank face — the fleet ''-first graceful-empty law; never wire-exposed (the croupier catalog enum has no '' member)
    reflect: true        # CSS keys the index/pip-field content off the live attribute; mirrors the croupier wire `rank` 1:1
  - name: suit
    type: enum
    values: ['', spades, hearts, diamonds, clubs]
    default: ''          # no suit ink/glyph
    reflect: true        # CSS's [suit=hearts]/[suit=diamonds] red-ink repoint keys off the live attribute; mirrors the croupier wire `suit` 1:1
  - name: faceDown
    type: boolean
    default: false
    reflect: true         # reflects to `face-down` — the CSS flipper-rotation hook + the a11y-label branch both key off the live attribute
    attribute: face-down  # kebab HTML attribute — a literal camelCase observed-attribute name never matches the always-lowercase real DOM attribute (the avatar iconOnly precedent); mirrors the croupier wire `faceDown` 1:1
  - name: size
    type: enum
    values: [sm, md, lg]
    default: md
    reflect: true          # the CSS [size] em-box ramp repoint keys off the live attribute (ADR-0225 cl.5 — the avatar F3 pattern, a fresh card-local em chain, NOT the compact ramp)

properties: []          # no manual accessors beyond the attributes-as-API

events: []               # display-only — emits nothing (no keyboard contract, no interaction, ADR-0225 cl.7)

slots: []                # no light-DOM content model — render() stays the inherited no-op; every part
                          # (flipper/face/back/index/pips) is component-built (replaceChildren), never
                          # author-slotted (ADR-0225 — a display leaf owns all of its own content)

parts:                    # data-part nodes inside the component-built flipper/face/back (selected by playing-card.css, not by name from TS)
  - name: flipper
    description: The `<div data-part="flipper">` 3D rotor holding both faces — always in the DOM, `rotateY(0deg)` face-up / `rotateY(180deg)` face-down (ADR-0225 cl.6, the fleet's first 3D transform).
  - name: face
    description: The `<div data-part="face">` front face — holds the two `index` corners + the `pips` center region, painted on `--ui-playing-card-face-surface` (pinned light in BOTH color schemes — a depicted physical object, ADR-0225 cl.4).
  - name: back
    description: The `<div data-part="back">` face-down back — a pure-CSS repeating-gradient cross-hatch lattice inside an inset frame (no image asset, no glyph); its own static `rotateY(180deg)` brings it upright when the flipper rotates (ADR-0225 cl.4/cl.6).
  - name: index
    description: One `<div data-part="index">` corner index (rank text + suit glyph, real text) — the top-left copy is upright; the bottom-right copy additionally carries `data-inverted` and a 180deg rotation (the physical-card mirrored-corner convention, ADR-0225 §4).
  - name: pips
    description: The `<div data-part="pips">` center content region — holds either the rank's pip grid (A, 2–10, from playing-card-pips.ts's per-rank layout table) or a single `letter` child (J/Q/K); empty for the '' blank face.
  - name: pip
    description: One `<span data-part="pip">` suit-glyph pip inside `pips`, imperatively grid-placed per playing-card-pips.ts's table (the pie-chart `--_slice-ink` per-node precedent); carries `data-rotated` when the physical layout prints it upside-down (below the grid's vertical center).
  - name: letter
    description: The `<span data-part="letter">` large center rank letter — J/Q/K's court-art substitute (ADR-0225 "Refused from the full-scope reading": illustrated faces are image-asset territory and illegible at the sm/md ramp; the corner indices carry the real identification).

customStates:            # :state(ready) — the motion gate (ADR-0008 §4a-c): armed one frame past first paint via internals.states (never a host attr) so a card first-painting face-down never animates the flip; only a LATER faceDown change transitions (ADR-0225 cl.6)
  - ready

face:
  formAssociated: false  # NOT a FACE form control — extends UIElement, no value/validity participation

aria:
  role: img                # a single flattened mark (the ui-avatar[label]/ui-swatch posture) — set via ElementInternals
  roleSource: internals    # never a host role/aria-* attribute
  labelSource: derived     # faceDown ⇒ the constant 'Face-down card' (rank/suit NEVER read in that branch — no leak); otherwise '<Rank name> of <suit>' (e.g. "Ace of spades"), null when rank or suit is '' (the blank-face graceful-empty state is a legally unlabeled img)

keyboard: []              # NOT interactive and NOT focusable — no tabindex, no keyboard contract (ADR-0225 cl.7)

geometry:
  sizeClass: display
  inlineSize: var(--ui-playing-card-inline-size)  # em-keyed owned box — sm 3.5em / md 5em (default) / lg 7em via [size] repoint (ADR-0225 cl.5, the avatar F3 pattern; the compact ramp is explicitly NOT reused)
  aspectRatio: 9 / 14      # the bridge card size, 2¼ × 3½ in (ADR-0225 cl.5)
  radius: calc(var(--ui-playing-card-inline-size) * 0.055)  # box-relative, density-invariant (the avatar calc idiom); snaps on a [size] change, never transitions

forcedColors: An explicit `@media (forced-colors: active)` block flattens the face/back to `Canvas`/`CanvasText` (the lattice pattern drops — the CanvasText border alone marks the back) so both faces stay legible under WHCM without relying on hue.
---

# ui-playing-card

`ui-playing-card` is the **Display**-class true card-face/back leaf (ADR-0225) — one standard playing
card, rendered as a real face (mirrored corner indices + a true suit-pip field or J/Q/K letter
treatment, red/black inks) or a CSS-painted back, on a fixed bridge-aspect box that flips on `faceDown`
and deals in on insertion. It is **not** interactive and **not** form-associated: no events, no keyboard
contract, no focus.

```html
<ui-playing-card rank="A" suit="spades"></ui-playing-card>
<ui-playing-card rank="Q" suit="hearts"></ui-playing-card>
<ui-playing-card face-down></ui-playing-card>
```

## Rank + suit → face

`rank` (`''` blank · `A` · `2`–`10` · `J` · `Q` · `K`) and `suit` (`''` · `spades` · `hearts` ·
`diamonds` · `clubs`) mirror the croupier persona catalog's wire enum 1:1 (the `''` blank-face member is
a component-side graceful-empty extension, never wire-exposed). The face shows two mirrored corner
indices (rank text + suit glyph — real text, top-left upright, bottom-right rotated 180deg, the physical
printed-card convention) and a center content region:

- **A, 2–10** — the rank's TRUE pip count, laid out on the physical-card grid (`playing-card-pips.ts`'s
  per-rank table); pips strictly below the vertical center print upside-down (`data-rotated`) so the
  layout reads correctly from either end.
- **J, Q, K** — a large center rank LETTER (illustrated court art is image-asset territory against the
  zero-dep law and illegible at the `sm`/`md` ramp — ADR-0225's deliberate refusal); the corner indices,
  identical to every other rank, carry the actual identification.
- **`''` (either prop blank)** — a blank face: no pips, no letter, no index text.

## Suit inks — pigment, not intent

Spades/clubs (and the blank face) paint `--ui-playing-card-ink`, a near-black flat constant; hearts/diamonds
repoint to `--ui-playing-card-ink-red`, a mid-dark step off the danger LADDER's flat mode-independent
primitives — explicitly PIGMENT, never the `danger` intent role (ADR-0225 cl.3). Both hold ≥4.5:1 contrast
against the face surface in **both** color schemes structurally (neither token depends on `color-scheme`).
Color is a redundant carrier here: rank text + shape-distinct suit glyphs already carry identity
(ADR-0057/ADR-0219 cl.4).

## The face is pinned light; the back follows the theme

`--ui-playing-card-face-surface` is a depicted-object exception (ADR-0225 cl.4) — it stays light in BOTH
color schemes (a card face doesn't invert). The face-down back is the opposite: a pure-CSS repeating-gradient
cross-hatch lattice inside an inset frame (no image asset, no glyph), painted from `--ui-playing-card-back-
surface`/`-back-ink`, which alias the accent/primary semantic-role ramp — the back **is** themed table
furniture, so it follows the scheme like any other themed surface.

## Sizing

`inline-size` rides `--ui-playing-card-inline-size`, an em-keyed owned box (`sm` 3.5em · `md` 5em default
· `lg` 7em via `[size]`) — the pie-chart-ring / avatar-F3 REPOINT pattern (ADR-0225 cl.5). `aspect-ratio:
9 / 14` holds the bridge card proportion (2¼ × 3½ in) at every size tier; radius and every interior
index/pip/letter size are `calc()` fractions of the box — density-invariant mark geometry that SNAPS on a
`[size]` change, never transitions.

## Flip + deal (ADR-0225 cl.6 — the fleet's first 3D transform)

Setting `faceDown` rotates the flipper rotor 180deg (`rotateY`, `perspective` on the host,
`backface-visibility: hidden` on both faces — both faces stay in the DOM always). The transition is gated
behind `:state(ready)` (armed one frame past first paint): a card that first-paints face-down never
animates; only a later `faceDown` change transitions, on the fleet's shared motion tokens.
`prefers-reduced-motion` swaps the rotation instantly (static, never nothing). On insertion, the host plays
an unconditional `@starting-style` deal entrance (a small fade + settle, the `ui-drawer` mechanism verbatim);
`prefers-reduced-motion` suppresses it. Neither motion mints a new token or a configurable prop — nothing is
tunable, so there is nothing to silently no-op.

## Accessibility

`internals.role = 'img'`; the accessible name is derived, never leaked while concealed: `faceDown` computes
the constant `"Face-down card"` — the rank/suit props are never even READ in that branch, so there is no
transient leak, only a structurally-absent one. Face-up, the name reads `"<Rank name> of <suit>"` (e.g.
`"Ace of spades"`), or is unset (`null`, a legally unlabeled img) when either prop is `''`.

## Explicitly refused (ADR-0225)

Illustrated court art for J/Q/K, rank-enum widening (Jokers — the croupier wire contract stays untouched),
interactivity (selection/click/events — compose `ui-choice-card` instead), and a `deal`/motion-config prop
(zero configurability is the recommendation, not an omission — see Flip + deal above).
