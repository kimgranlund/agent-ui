---
# swiper.md frontmatter — the attributes-as-API descriptor for ui-swiper (ADR-0004 / swiper-family.lld.md
# LLD-C1/C2 / ADR-0124). The machine-checkable public surface lives HERE (frontmatter for ui-swiper); the
# prose below the fence is the /site doc and documents all FIVE elements (ui-swiper · ui-swiper-item ·
# ui-swiper-pagination · ui-swiper-paddles · ui-swiper-label — one folder, one writer). The `attributes[]`
# block MUST mirror swiper.ts `static props` (the ...UIContainerElement.surfaceProps spread — elevation/
# brightness — plus orientation/slides-in-view/align/loop/duration/easing/pagination/paddles/active) — the
# contract↔props trip-wire (swiper-descriptor.test.ts) targets this fence. Field set per
# .claude/docs/plan.md §10 / ADR-0004; the surface axes per ADR-0015; the bindable `active` per ADR-0019
# (the ui-tabs `selected`/`select` pattern, LLD-C7).
tag: ui-swiper
tier: pattern            # geometry size-class — geometry.md "Pattern" (container + control-height rows); the fleet's FIRST scroll-snap surface
extends: UIContainerElement  # the ui-tabs base — surface axes + reused internals (ARIA); NOT form-associated (face below)
# marginal: 2406 B gz (8385 B min solo) — re-measured 2026-07-10 after the five-file/five-export-line
# repair (npm run size, ADR-0040 §3); the four leaf descriptors each measure 0 B gz marginal on their own
# barrel line (swiper.ts already imports them transitively, so removing only THEIR line changes nothing —
# ui-swiper's own line carries the family's real cost). RULED at review (2026-07-10, the ADR-0040
# discipline): a 3072 B MARGINAL_OVERRIDES entry (a five-tag family behind one entry — the 2048 default
# is sized for one component) + the family ceiling re-based 34816 -> 38912 B gz; both applied in
# measure-size.mjs, npm run size green.

attributes:              # attributes-as-API — mirrors swiper.ts `static props` (the surfaceProps spread, then the ten swiper-specific props)
  - name: elevation
    type: enum
    values: [0, 1, 2, 3, -1, -2, -3]
    default: 0
    reflect: true      # the scheme-inverting surface plane (ADR-0015); a bare <ui-swiper> is transparent by default
  - name: brightness
    type: enum
    values: [0, 1, 2, 3, -1, -2, -3]
    default: 0
    reflect: true      # the scheme-consistent tonal shift (ADR-0015); 0 = the neutral base
  - name: orientation
    type: enum
    values: [horizontal, vertical]
    default: horizontal
    reflect: true      # selects the scroll axis; rotates the keyboard axis + the paddle glyphs
  - name: slides-in-view
    type: string
    default: ''
    reflect: true      # '' ⇒ responsive-auto (container-query column count); a numeric string pins the visible-slide count
  - name: align
    type: enum
    values: [start, center, end]
    default: start
    reflect: true      # the per-slide scroll-snap-align (the ADR-0039 box-alignment dialect; no *-reverse)
  - name: loop
    type: boolean
    default: false
    reflect: true      # enables the infinite clone-teleport loop
  - name: duration
    type: string
    default: ''
    reflect: true      # '' ⇒ the motion-token default; a CSS <time> overrides the PROGRAMMATIC-advance duration only (native gesture snaps are unaffected, ADR-0124 F1)
  - name: easing
    type: string
    default: ''
    reflect: true      # '' ⇒ the motion-token default; a CSS easing overrides the programmatic-advance curve only (same native-gesture caveat as duration)
  - name: pagination
    type: boolean
    default: false
    reflect: true      # stamp a default-placed dots anchor when no ui-swiper-pagination anchor is present
  - name: paddles
    type: boolean
    default: false
    reflect: true      # stamp a default-placed prev/next anchor when no ui-swiper-paddles anchor is present
  - name: active
    type: string
    default: ''
    reflect: true      # the bindable active-slide identity (ADR-0019; commit path = LLD-C7). '' ⇒ first slide; a real item's `value` wins; else a numeric index; else first

properties:              # IDL beyond attributes-as-API
  - name: slides
    description: Getter — the REAL ui-swiper-item children only (clones excluded), in DOM order.
  - name: activeIndex
    description: Getter — the resolved real index of the active slide (freshly derived from `active`).
  - name: next
    description: Method — advance one slide (wraps into the trailing clone of slide 0 in loop mode; a no-op at the end in non-loop mode).
  - name: prev
    description: Method — retreat one slide (wraps into the leading clone of the last slide in loop mode; a no-op at the start in non-loop mode).
  - name: goTo
    description: 'Method — goTo(index: number): scroll a REAL index into the align position (a JS scroll animation over duration/easing; instant under reduced-motion or mid-teleport).'

events:                  # the family event vocabulary (change·input·select·open·close·toggle)
  - name: select
    detail: '{ value: string, index: number }'
    description: The ONE commit event — fired on a USER-driven active-slide change (scroll settle, paddle, dot, or keyboard) that CHANGES the active slide, never on a programmatic `active` write (binding hygiene) and never twice at a loop wrap seam. NOT `change`.

slots:
  - name: default
    optional: true
    description: ui-swiper-item children (the slides) plus zero or more author-placed chrome anchors (ui-swiper-pagination / ui-swiper-paddles / ui-swiper-label), in any order.

parts:
  - name: track
    description: The control-created `<div data-part="track" role="group" tabindex="0">` — the single owned scroll region (SPEC-R3). ui-swiper-item children are reparented into it; chrome anchors stay host siblings.
  - name: live
    description: The control-created, visually-hidden `<div data-part="live" aria-live="polite">` — announces the position ("Slide n of realCount") on settle, including across a loop wrap (SPEC-R11).

customStates:
  - ready              # the motion gate (ADR-0008 idiom): armed one frame past first paint so the initial position/selection SNAPS and only later changes animate

face:
  formAssociated: false  # NOT a FACE form control — a container (extends UIContainerElement); no value/validity participation

aria:
  role: region             # via internals — the carousel region identity (SPEC-R15)
  roleSource: internals
  roleDescription: carousel  # internals.ariaRoleDescription — the family's fleet-first use of this API (ADR-0124 Consequences)
  labelSource: a present ui-swiper-label (internals element-reflection, ariaLabelledByElements) wins; absent one, internals.ariaLabel = 'Carousel'
  trackRole: group          # the [data-part=track] carries role=group + aria-label (the region label) + tabindex=0 — a single tab stop that AT announces
  slideRole: group          # each REAL ui-swiper-item carries role=group + aria-roledescription=slide + aria-label="{n} of {realCount}" via labelAs (its own internals)

keyboard:
  - keys: ArrowRight
    action: (horizontal) Move to the next slide (wraps in loop mode); preventDefault.
  - keys: ArrowLeft
    action: (horizontal) Move to the previous slide (wraps in loop mode); preventDefault.
  - keys: ArrowDown
    action: (vertical) Move to the next slide (wraps in loop mode); preventDefault.
  - keys: ArrowUp
    action: (vertical) Move to the previous slide (wraps in loop mode); preventDefault.
  - keys: Home
    action: Move to the first real slide; preventDefault.
  - keys: End
    action: Move to the last real slide; preventDefault.
  - note: The [data-part=track] is the single tab stop (tabindex=0). Clone slides are inert — never in the tab order. Focusing content inside a real slide never triggers a spurious teleport.

geometry:
  sizeClass: pattern
  columns: var(--ui-swiper-columns)     # responsive-auto via @container when slides-in-view=''; pinned by [slides-in-view="n"]
  gap: var(--ui-swiper-gap)             # inter-slide gap off the space ladder (density-responsive)
  align: var(--ui-swiper-align)         # the per-slide scroll-snap-align
  duration: var(--ui-swiper-duration)   # programmatic-advance timing
  easing: var(--ui-swiper-easing)       # programmatic-advance curve
  surface: --ui-container-bg             # the shell plane (ADR-0015 surface seam); transparent by default — a plane is asked-for via elevation/brightness

forcedColors: The pagination dots keep a non-colour (size) signifier under WHCM AND map to system colours (CanvasText idle, Highlight active) so they remain visible against Canvas; ui-button (paddles) carries its own independent forced-colors treatment.
---

# ui-swiper · ui-swiper-item · ui-swiper-pagination · ui-swiper-paddles · ui-swiper-label

`ui-swiper` is a CSS-native (scroll-snap) carousel family — the fleet's first scroll-snap surface
(ADR-0124). It presents author-supplied `ui-swiper-item` slides in one owned scroll viewport, with an
optional pixel-seamless infinite loop, optional author-placed pagination/paddles/label chrome the
coordinator drives, and a bindable `active` selection. It extends `UIContainerElement` (the `ui-tabs`
base) and is **not** form-associated.

```html
<ui-swiper loop pagination paddles>
  <ui-swiper-label>Featured</ui-swiper-label>
  <ui-swiper-item>Slide one</ui-swiper-item>
  <ui-swiper-item>Slide two</ui-swiper-item>
  <ui-swiper-item>Slide three</ui-swiper-item>
</ui-swiper>
```

## Anatomy

On connect, `ui-swiper` creates a `<div data-part="track" role="group" tabindex="0">` (the single owned
scroll region) and a visually-hidden `<div data-part="live" aria-live="polite">`, then **reparents** its
`ui-swiper-item` children into the track (chrome anchors stay host siblings, driven in place). The host
itself carries `role="region"` + `aria-roledescription="carousel"` via `ElementInternals` — never a host
attribute.

## The infinite loop

With `loop` set, the coordinator clones the edge slides (`aria-hidden` + `inert` + id-stripped, excluded
from `slides`) to fill the viewport past either seam, and teleports the scroll offset by exactly the
real-set extent on a clone-band settle — pixel-seamless, no visible jump. Position is always announced as
real-index/real-count; paddles never disable in loop mode.

## Selection

`active` is bindable (ADR-0019): the agent **sets** it to move the carousel (programmatic → no event
echoed); a user gesture (scroll settle, paddle, dot, keyboard) commits it and emits the one `select {
value, index }`. Resolution mirrors `ui-tabs`: `''` ⇒ first slide; a value matching a real item's `value`
wins; else a numeric index; else the first slide.

## Chrome

`ui-swiper-pagination` / `ui-swiper-paddles` / `ui-swiper-label` are author-placed **anchors** the
coordinator fills and wires wherever they are written; absent an anchor, the matching `pagination`/
`paddles` boolean stamps a default-placed one. A present anchor always wins over the boolean.

## Accessibility

- `role="region"` + `aria-roledescription="carousel"` (via internals) on the host; the accessible name is
  a present `ui-swiper-label` (element-reflection) or `"Carousel"`.
- Each real slide carries `role="group"` + `aria-roledescription="slide"` + `aria-label="{n} of
  {realCount}"` via its own internals (`labelAs`, applied by the coordinator).
- The `[data-part=live]` polite region announces position changes, including loop wraps.
- Pagination dots are keyboard-operable native `<button>`s with `aria-current` on the active one; the
  active dot is distinguished by **size**, not colour alone (ADR-0057).

## Motion

Programmatic advances (paddle/dot/keyboard/`goTo`) animate over `--ui-swiper-duration`/`--ui-swiper-easing`
via a JS scroll animation — native gesture snaps use the UA's own timing (F1 — `scroll-behavior: smooth`
ignores custom properties). Under `prefers-reduced-motion`, programmatic advances are instant and the loop
teleport is already instant.
