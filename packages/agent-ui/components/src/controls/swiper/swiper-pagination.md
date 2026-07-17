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
    description: One coordinator-rendered `<button type="button" data-part="dot">` per real slide (type=dots only) — keyboard-operable (native button semantics), aria-label="Go to slide n", aria-current="true" on the active one.
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
