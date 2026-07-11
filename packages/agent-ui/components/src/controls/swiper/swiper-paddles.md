---
# swiper-paddles.md frontmatter — the attributes-as-API descriptor for ui-swiper-paddles (ADR-0004 /
# swiper-family.lld.md LLD-C10). `attributes: []` is the deliberate, verified-parseable empty sequence (the
# ui-toast-region precedent) — swiper-paddles.ts declares `static props = {} satisfies PropsSchema`; the
# contract↔props trip-wire (swiper-paddles-descriptor.test.ts) targets the empty bijection. Prose below
# documents only this element (the primary /site prose lives on swiper.md, the one-folder precedent).
tag: ui-swiper-paddles
tier: pattern            # geometry size-class — an author-placed anchor the coordinator fills (LLD-C10)
extends: UIElement       # NOT form-associated — a pure render-target anchor, no value of its own
# marginal: measured at integration (npm run size, ADR-0040 §3) — the five-tag family total

attributes: []            # no configuration in v1 — placement + wiring are entirely the coordinator's

properties:
  - name: fill
    description: "Method — fill(onPrev: () => void, onNext: () => void, orientation: 'horizontal' | 'vertical'): void. Coordinator command (called by the owning ui-swiper's #driveChrome): builds (once, idempotent) two composed ui-buttons wired to onPrev/onNext, rotating their glyphs to `orientation` (caret-left/right horizontal, caret-up/down vertical)."

events: []                 # a paddle click drives the owning ui-swiper's prev/next directly (via the onPrev/onNext callbacks), not a component event of its own

slots: []                  # no author slots — both ui-buttons are coordinator-rendered

parts:
  - name: prev
    description: A coordinator-rendered `<ui-button data-part="prev" variant="ghost" icon-only aria-label="Previous slide">` — the owning ui-swiper toggles its `disabled` PUBLIC prop directly in non-loop mode (never in loop mode).
  - name: next
    description: A coordinator-rendered `<ui-button data-part="next" variant="ghost" icon-only aria-label="Next slide">` — same disable rule as prev.

customStates: []           # no :state() hooks of its own — each composed ui-button carries its own states

face:
  formAssociated: false    # NOT a FACE form control — a pure render-target anchor

aria:
  role: none                 # the anchor itself carries no role; each composed ui-button carries role=button via its own internals + aria-label set externally (the ui-toast close-button precedent)
  roleSource: none
  labelSource: none

keyboard:
  - note: Each composed ui-button is independently focusable (its own tabbable trait) and activates via Space/Enter (pressActivation) — no roving focus of its own; two ordinary tab stops.

geometry:
  sizeClass: pattern
  note: Each composed ui-button keeps its OWN geometry (icon-only square structure, default md size) — this anchor itself contributes only the flex layout wrapping them.

forcedColors: Each composed ui-button carries its own independent forced-colors treatment (button.css); this anchor paints nothing of its own.
---

# ui-swiper-paddles

`ui-swiper-paddles` is an author-placed **anchor** the owning `ui-swiper` fills with two composed,
icon-only `ui-button`s wired to `prev`/`next` (swiper-family.lld.md LLD-C10). See `swiper.md` for the
family overview and the chrome-composition model (author-placed anchor vs. the `[paddles]` boolean stamp
fallback).

```html
<ui-swiper>
  <ui-swiper-item>One</ui-swiper-item>
  <ui-swiper-item>Two</ui-swiper-item>
  <ui-swiper-paddles></ui-swiper-paddles>
</ui-swiper>
```

In non-loop mode the paddles disable at the ends (the coordinator toggles each `ui-button`'s `disabled`
prop directly); in loop mode they never disable, since the carousel has no terminal slide.
