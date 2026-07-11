---
# swiper-label.md frontmatter — the attributes-as-API descriptor for ui-swiper-label (ADR-0004 /
# swiper-family.lld.md LLD-C11). `attributes: []` is the deliberate, verified-parseable empty sequence (the
# ui-toast-region precedent) — swiper-label.ts declares `static props = {} satisfies PropsSchema`; the
# contract↔props trip-wire (swiper-label-descriptor.test.ts) targets the empty bijection. Prose below
# documents only this element (the primary /site prose lives on swiper.md, the one-folder precedent).
tag: ui-swiper-label
tier: display            # geometry size-class — author text, no interactive/structural surface of its own
extends: UIElement       # NOT form-associated — carries no value
# marginal: measured at integration (npm run size, ADR-0040 §3) — the five-tag family total

attributes: []            # no configuration — the author's light-DOM text IS the accessible name

properties: []            # no public methods — every behaviour lives on the OWNING ui-swiper (it reads this element's id + textContent)

events: []                 # no events of its own

slots:
  - name: default
    optional: false
    description: The author's text — becomes the owning ui-swiper's accessible name (region aria-labelledby, via internals element-reflection).

parts: []                  # no control-created parts — host-as-content

customStates: []           # no :state() hooks of its own

face:
  formAssociated: false    # NOT a FACE form control

aria:
  role: none                 # this element carries no role of its own — the OWNING ui-swiper points its region aria-labelledby at this element's id (internals element-reflection), applied by the coordinator, never self-driven here
  roleSource: none
  labelSource: 'this element''s own light-DOM text content, read by the owning ui-swiper'

keyboard: []                # no keyboard model of its own

geometry:
  sizeClass: display
  note: Inline flow only — no geometry law of its own (display-only text).

forcedColors: No rule of its own — inherits ambient text colour.
---

# ui-swiper-label

`ui-swiper-label` is an author-placed anchor whose light-DOM text becomes the owning `ui-swiper`'s
accessible name (swiper-family.lld.md LLD-C11, SPEC-R15). It extends `UIElement`, is **not**
form-associated, and behaves entirely EMPTY on its own — every wiring fact (reading its `id`, assigning
one if absent, pointing the region's `aria-labelledby` at it via internals element-reflection) lives on
the owning `ui-swiper`. See `swiper.md` for the family overview.

```html
<ui-swiper>
  <ui-swiper-label>Featured products</ui-swiper-label>
  <ui-swiper-item>One</ui-swiper-item>
  <ui-swiper-item>Two</ui-swiper-item>
</ui-swiper>
```

Absent a `ui-swiper-label`, the region falls back to `aria-label="Carousel"`.
