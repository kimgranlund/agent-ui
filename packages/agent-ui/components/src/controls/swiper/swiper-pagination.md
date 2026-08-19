---
# swiper-pagination.md frontmatter — the attributes-as-API descriptor for ui-swiper-pagination (ADR-0004 /
# swiper-family.lld.md LLD-C9). The `attributes[]` block MUST mirror swiper-pagination.ts `static props`
# (type) — the contract↔props trip-wire (swiper-pagination-descriptor.test.ts) targets this fence. Prose
# below documents only this element (the primary /site prose lives on swiper.md, the one-folder precedent).
tag: ui-swiper-pagination
tier: pattern            # geometry size-class — an author-placed anchor the coordinator fills (LLD-C9)
extends: UIElement       # NOT form-associated — a pure render-target anchor, no value of its own
# marginal: measured at integration (npm run size, ADR-0040 §3) — the five-tag family total

attributes:
  - name: type
    type: enum
    values: [dots, fraction]
    default: dots
    reflect: true      # dots = one indicator per real slide; fraction = a single "n / realCount" readout

properties:
  - name: renderInto
    description: 'Method — renderInto(count: number, active: number, onSelect: (i: number) => void): void. Coordinator command (called by the owning ui-swiper''s #driveChrome): render `count` indicators (or the fraction) and mark `active`. `onSelect(i)` is the coordinator''s `goTo`. Idempotent — re-running with the same `count` reuses the existing dot nodes.'

events: []                # a dot click drives the owning ui-swiper's goTo directly (via the onSelect callback), not a component event of its own

slots: []                 # no author slots — every child (the dots or the fraction span) is coordinator-rendered

parts:
  - name: dot
    description: One coordinator-rendered `<button type="button" data-part="dot">` per real slide (type=dots only) — keyboard-operable (native button semantics), aria-label="Go to slide n", aria-current="true" on the active one. Deliberately NOT `ui-button` — see "Why a native button" below (GH #1447).
  - name: fraction
    description: A coordinator-rendered `<span data-part="fraction">` holding the "n / realCount" text (type=fraction only).

customStates: []          # no :state() hooks — the active dot is distinguished by [aria-current] + size, not a custom state

face:
  formAssociated: false   # NOT a FACE form control — a pure render-target anchor

aria:
  role: none                # the anchor itself carries no role; each dot is a native <button> (implicit button role) with aria-current marking the active one
  roleSource: none
  labelSource: none

keyboard:
  - note: Each dot is a native <button> — Tab reaches every dot in DOM order (one tab stop each); Enter/Space activate it (native button semantics), calling the coordinator's onSelect.

geometry:
  sizeClass: pattern
  dotSize: var(--ui-swiper-dot-size)             # the compact widget ramp
  dotSizeActive: var(--ui-swiper-dot-size-active) # the ACTIVE dot's size-larger non-colour signifier (ADR-0057)
  gap: var(--md-sys-space-xs)

forcedColors: The dots map to system colours (CanvasText idle, Highlight active) in addition to their SIZE signifier, so the active indicator survives WHCM without relying on hue alone.
---

# ui-swiper-pagination

`ui-swiper-pagination` is an author-placed **anchor** the owning `ui-swiper` fills and wires wherever it
is written (swiper-family.lld.md LLD-C9). `type=dots` (default) renders one keyboard-operable indicator per
real slide; `type=fraction` renders a single "n / realCount" readout. See `swiper.md` for the family
overview and the chrome-composition model (author-placed anchor vs. the `[pagination]` boolean stamp
fallback).

```html
<ui-swiper>
  <ui-swiper-item>One</ui-swiper-item>
  <ui-swiper-item>Two</ui-swiper-item>
  <ui-swiper-pagination></ui-swiper-pagination>
</ui-swiper>
```

The active dot is distinguished by **size**, never colour alone (ADR-0057) — `aria-current="true"` is the
real ARIA fact the size/colour treatment keys off.

## Why a native button, not `ui-button` (GH #1447 — decline documented)

GH #1447 (the #1445 fleet sweep's straggler audit) asked whether the dots should align to `ui-button`,
citing ADR-0163's `ui-pagination` (cl.6, composing `ui-button` for every page stop) and ADR-0160's
`ui-conversation` action-chip row (cl.3, `ui-button size="sm" variant="soft"`) as the fleet's own
stamps-`ui-button` precedent. Both cited precedents are genuinely different geometry from this control's
dots, so the conversion is **declined**:

- **Both precedents are CONTROL-tier, labelled affordances.** `ui-pagination`'s page stops carry a page
  *number* as their label; the conversation action chip carries the action's own text label. `ui-button` is
  `tier: control` (button.md) — one of geometry.md's five size-classes, floored at the Control band's
  smallest step (`size="sm"` ⇒ `--md-sys-height-sm`, 24px) by its own documented squareness law
  (`min-inline-size = height`, button.css `:scope[icon-only]`). Neither precedent renders below that floor.
- **This control's dots are geometry.md's OTHER size system — the compact realm, not Control.** The dot ramp
  is `--ui-swiper-dot-size: var(--md-sys-compact-sm)` (14px idle, +2px active — swiper.css) — the
  ALWAYS-COMPACT widget family (checkbox · radio · switch · slider · tag · badge · chip · kbd; geometry.md
  "The compact realm"), a size system geometry.md itself calls out as structurally separate from the five
  control-band size-classes `ui-button` belongs to. A real `ui-button` cannot render a genuine 14px/16px
  square without either overriding `--ui-button-height` below its own ramp's floor (fighting the geometry
  law the family itself enforces) or ballooning the dot to ≥24px — well over 1.5× today's ACTIVE size and
  nearly double the idle size, wrecking the subtle size-step-is-the-signifier design ADR-0057 already
  establishes for this control (a 2px active/idle delta, not a control-tier jump).
- **The keyboard-operability rationale in `swiper-pagination.ts`'s own header comment is independently true
  but not the controlling reason.** `ui-button` provides the identical Tab-stop + Enter/Space activation via
  its own `tabbable`/`pressActivation` traits, so a real `<button>`'s "keyboard-operable for free" is not,
  by itself, an argument against `ui-button` — the geometry-tier mismatch above is what actually blocks the
  conversion.

A native `<button>` stays the right element here: it is the one primitive that renders honestly at the
compact realm's 14px floor with zero fighting of either geometry law.
