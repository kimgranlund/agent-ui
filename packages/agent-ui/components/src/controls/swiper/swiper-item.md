---
# swiper-item.md frontmatter — the attributes-as-API descriptor for ui-swiper-item (ADR-0004 /
# swiper-family.lld.md LLD-C4). The `attributes[]` block MUST mirror swiper-item.ts `static props` (value) —
# the contract↔props trip-wire (swiper-item-descriptor.test.ts) targets this fence. Prose below documents
# only this element (the primary /site prose lives on swiper.md, the one-folder precedent — ui-tab/ui-tab-panel
# mirror this split against tabs.md).
tag: ui-swiper-item
tier: layout             # geometry size-class — sized entirely by the track; no geometry of its own (SPEC-R9)
extends: UIElement       # NOT form-associated — a slide wrapper carries no value
# marginal: measured at integration (npm run size, ADR-0040 §3) — the five-tag family total

attributes:
  - name: value
    type: string
    default: ''
    reflect: true      # the stable slide identity `active` resolves against; '' ⇒ addressed by real index

properties:
  - name: labelAs
    description: 'Method — labelAs(position: string): void. Applied by the OWNING ui-swiper (a sibling cannot set another element''s protected internals): sets role=group, aria-roledescription=''slide'', and aria-label to `position` (e.g. "2 of 5"), all via ElementInternals. Called only on REAL items — clones are marked aria-hidden/inert directly by the coordinator, never labelled this way.'

events: []               # a slide emits nothing of its own — selection commit is the owning ui-swiper's concern

slots:
  - name: default
    optional: true
    description: Arbitrary author content — the slide's body.

parts: []                # no control-created parts — host-as-content

customStates: []         # no :state() hooks of its own

face:
  formAssociated: false  # NOT a FACE form control

aria:
  role: group              # via internals, applied by the OWNING ui-swiper's labelAs — never self-driven on connect
  roleSource: internals (coordinator-applied)
  roleDescription: slide   # internals.ariaRoleDescription, coordinator-applied
  labelSource: 'a coordinator-supplied position string ("{n} of {realCount}"), via labelAs'

keyboard: []              # no keyboard model of its own — the owning ui-swiper's track is the single tab stop

geometry:
  sizeClass: layout
  note: Sized entirely by the track (grid-auto-columns/-rows, min-inline-size/min-block-size 0, scroll-snap-align/-stop off the track's tokens) — a slide has no geometry law of its own.

forcedColors: No rule of its own — a slide paints only its own light-DOM content.
---

# ui-swiper-item

`ui-swiper-item` is the slide of the `ui-swiper` family (swiper-family.lld.md LLD-C4) — an author-written
wrapper around arbitrary content, one per logical slide. It extends `UIElement`, is **not**
form-associated, and carries no geometry of its own (sized entirely by the owning track). See
`swiper.md` for the family overview, anatomy, and accessibility model.

```html
<ui-swiper>
  <ui-swiper-item value="intro">Welcome</ui-swiper-item>
  <ui-swiper-item value="pricing">Pricing</ui-swiper-item>
</ui-swiper>
```

Each **real** item (clones excluded) carries, via `ElementInternals` — never a host attribute —
`role="group"`, `aria-roledescription="slide"`, and `aria-label="{n} of {realCount}"`, applied by the
owning `ui-swiper` through the public `labelAs` method (a sibling cannot reach another element's protected
`internals`, so the coordinator pushes the label in).
