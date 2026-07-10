---
doc-type: ticket
id: tkt-0007
status: open
date: 2026-07-10
owner:
kind: feature
size: big
---
# TKT-0007 — `ui-swiper`: a CSS-native slideshow/carousel family

## Summary
Kim's ask (2026-07-10): a CSS-native swiper for slideshows of almost any content — `ui-swiper`
hosting `ui-swiper-item`-wrapped slides, with an **infinite carousel loop mode** (the user never
hits a last slide; the wrap-around logistics are fully handled), a highly customizable
pagination system (`ui-swiper-pagination` dots + `ui-swiper-paddles` prev/next, with placement
control) and an optional `ui-swiper-label`, plus first-class UX handling for focus/blur, scroll
wheels, and user selection. Configuration via attributes: easing, duration, and modes —
slides-in-view count, alignment, orientation. Dedup: **greenfield** — no swiper/carousel/
slideshow exists anywhere in the fleet, tickets, or ADR log, and nothing uses scroll-snap yet.

## Research inputs (for the design intake, recorded verbatim)
- **Prior art to learn from:** `/Users/kimba/Projects/adia/gen-ui-kit/packages/web-components/components/swiper/`
  (exists, verified: swiper.class.js · swiper.css · swiper.a2ui.json · swiper.yaml · examples) —
  Kim's earlier CSS-native swiper; the starting contract to promote and extend, not to copy
  blindly (this fleet's laws differ: light-DOM, internals-ARIA, typed props, geometry law).
- **Scope survey:** SwiperJS (https://swiperjs.com/swiper-api) — research its API surface for
  the full idea of scope and possibilities (modes, pagination options, a11y module, loop
  mechanics), as the market-shape reference; the fleet ships the coherent subset, not the API.

## Acceptance
- A full design intake via `agent-ui-component-design` resolves the forks BEFORE any build —
  **this is the designated live-fire shakedown of the TKT-0005 skill estate** (F1 → doc review
  → `component-builder` through its preloaded method → the testing bar): the multi-element
  family shape (the radio/radio-group + toast/toast-region precedents for sub-tag families),
  the CSS-native mechanism (scroll-snap lean per "CSS-native"; the transform alternative
  argued, not assumed), loop-mode mechanics AND its a11y semantics (position announcements
  when there is no "last" slide), pagination/paddles/label composition + placement contract,
  the attribute surface (easing · duration · slides-in-view · alignment · orientation) in the
  fleet's typed-enum dialect, event fit within the allowlist (slide change → `change`/`select`
  — a new event name is a fleet fork), focus/wheel/selection UX, reduced-motion behavior, and
  catalog posture (a content carousel is plausibly agent-emittable — argue it under the
  ADR-0087 gate, don't default it).
- The shipped family meets the full per-control bar (descriptor per element, jsdom +
  cross-engine browser probes incl. whole-shape and real scroll/snap geometry, independent
  review, barrels/exports/size, doc + demo pages).
- Infinite loop mode provably seamless (no visible jump at the wrap seam) and keyboard/AT-safe.

## Links
- The prior-art folder + SwiperJS API URL above (the two research inputs).
- `.claude/skills/agent-ui-component-design/` — the intake procedure this exercises (its
  novelty leg likely fires: no existing geometry class covers a scroll-viewport pattern).
- ADR-0112 (multi-tag family + catalog-posture precedent) · ADR-0046 (container box-model —
  the slides' spacing relationship) · ADR-0057 (pagination dots need a non-color signifier).
- TKT-0005 Findings — the "still owed: F1 shakedown" line this ticket discharges.

## Scope / Open
- **Open (intake forks, named not resolved here):** loop-mode DOM strategy (clone-based vs
  scroll-teleport — the seam-jump problem); whether pagination/paddles/label are separate
  custom elements (as asked) vs slots/parts of `ui-swiper` — the ask's tag names are the
  starting position, the intake argues the composition model; autoplay (SwiperJS has it; NOT
  in the ask — propose as explicit non-goal or fork); touch/pointer drag beyond native scroll
  (CSS-native lean says native scroll gestures first).
- **Non-goal:** porting SwiperJS's full API; virtual slides / lazy modes (fence with triggers).
- **Sequencing:** design intake first (F1), research inputs read there; no build from this
  ticket directly.

## Findings
