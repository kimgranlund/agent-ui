---
doc-type: ticket
id: tkt-0008
status: open
date: 2026-07-10
owner:
kind: feature
size: big
---
# TKT-0008 — `ui-swiper`: a CSS-native slideshow/carousel family

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

### 2026-07-10 — F1 design intake complete (frozen, review-passed, awaiting Kim's ratification)

Ran the full `agent-ui-component-design` intake. Record set authored, doc-reviewed (three fresh-context
seats), findings applied, gates green. **No code written.** The build dispatches only on ADR ratification.

**Artifacts (all NEW):**
- ADR: [`../adr/0124-swiper-family-scroll-snap-loop.md`](../adr/0124-swiper-family-scroll-snap-loop.md)
  (`proposed`; README row added; `npx vitest run adr` green, 33 tests) — **ADR-0124**, eight forks F1–F8, all
  firm recommendations, none self-ratified.
- SPEC: [`../spec/swiper-family.spec.md`](../spec/swiper-family.spec.md) (SPEC-R1…R16).
- LLD: [`../lld/swiper-family.lld.md`](../lld/swiper-family.lld.md) (LLD-C1…C12; the frozen-interface-vs-real-
  code check in §12 PASSED — every named API verified against shipped source, no invented API).
- Decomp: [`../decompositions/swiper-family.decomp.json`](../decompositions/swiper-family.decomp.json)
  (`coverage_check.py --strict` exit 0 — 29 nodes · 19 actions · 19 hosts · 13 edges, plan mode).

**Classification:** family of five tags — `ui-swiper` (`UIContainerElement`, `tier: pattern`,
catalog-emittable) · `ui-swiper-item` (`UIElement`, `tier: layout`, emittable) · `ui-swiper-pagination` /
`ui-swiper-paddles` (`UIElement`, `tier: pattern`, allowlisted) · `ui-swiper-label` (`UIElement`, `tier:
display`, allowlisted). **The novelty leg fired on the MECHANISM, not geometry** — `geometry.md` already covers
the shell (`pattern` tier) and names the carousel paddle nav-icon exception, so NO new geometry row; the
greenfield is the scroll-snap viewport (the fleet's first scroll-snap surface).

**Fork resolutions (the hard centers):**
- **F1 mechanism = scroll-snap grid track (CSS-native)**, not transform.
- **F2 infinite loop = clone-based scroll-teleport** (clone `k=ceil(slides-in-view)+1` real slides each side,
  `aria-hidden`+`inert`+id-stripped+uncounted; teleport on the clone-band snap-settle with `scroll-behavior:
  auto`; position = real-index/real-count, paddles never disable). **Key finding: the adia prior art's `loop`
  is really a REWIND** (`swiper.class.js:170` jumps `goTo(0)` at the boundary) — a visible snap-back the
  ticket's "no visible jump at the wrap seam" forbids; the fleet must go beyond the prior art here.
- **F3 composition = author-placed anchor tags the coordinator drives + a `[pagination]`/`[paddles]` boolean
  stamp-if-absent fallback** (present anchor wins) — honors the ask's separate-tags + placement control AND
  one-node agent emission.
- **F4 selection = bindable `active` prop committed by `select`** (the `ui-tabs` `selected`/`select` pattern,
  ADR-0019/LLD-C8), not `change`.
- **F5 catalog = `Swiper`+`SwiperItem` emittable; the three chrome tags `EXCLUSION_ALLOWLIST`** (author
  refinements — the Toast/ThemeProvider precedent).
- **F6 autoplay = NON-GOAL v1** (unasked; WCAG 2.2.2 liability). **F7 pointer-drag-beyond-native = deferred**
  (native gestures only). **F8 wheel = native only, no axis translation** (one-owned-scroll-region law).

**Sharpest build-time risk (flagged, not blocking):** `internals.ariaRoleDescription` is used NOWHERE in the
fleet today (verified) — the region's `aria-roledescription="carousel"` is the family's fleet-first use; it is
browser-verified + jsdom-guarded in the test plan (n14/n28/n29). The prior art set it as a host attribute,
forbidden here (ARIA-via-internals law).

**Doc review:** three `scribe:doc-reviewer` seats, pre-armed for the blockquote-header house style (generic
`doc_lint` abstains by design). Verdicts: ADR light-REVISE, SPEC REVISE, LLD REVISE — **no CRITICAL**; the
frozen-interface audit PASSED. All findings applied: added the ADR native-smooth-scroll timing consequence
(custom `duration`/`easing` shape programmatic advances only — native gesture snaps use UA timing, so `goTo`
runs a JS scroll animation, not `scroll-behavior: smooth`); minted **SPEC-R15** (carousel-region identity) +
**SPEC-R16** (descriptor fidelity) + an Acceptance section; minted the **LLD-C1…C12** component-id table and
fixed the C7/C8 active-binding contradiction; corrected the §13 build-sequence node-ids (swiper.css = n15,
restored n14/n15); clarified the double-`select` primary guard (changed-index test, not the `#teleporting`
flag) + the `#resizeObserver`→rebuild path; re-anchored the three browser-only decomp accepts (n7/n8/n10) off
jsdom. Delta re-validation green (coverage `--strict` exit 0, adr gate 33/33).

**Skill feedback (for the estate):** (1) the intake procedure held well — the "verify every frozen API against
a real shipped consumer" discipline caught that `reflectAriaElements` is a private per-folder peer copy (not a
shared export) BEFORE the LLD froze it as an import. (2) One gap worth a skill note: the F1 scroll-snap choice
has a non-obvious downstream consequence (native smooth-scroll ignores custom timing props) that only surfaced
in doc review — the intake could prompt "does the chosen CSS-native mechanism honor the configured attribute
surface?" as a standing fork-sheet check when a mechanism is greenfield.

**Status:** design FROZEN pending ratification. Next action: Kim/orchestration-lead flips ADR-0124
`proposed → accepted`, then the `component-builder` builds M1 (core) → M2 (chrome) → M3 (catalog+site) against
the LLD as contract, with the `component-reviewer` GO gate before each wave commit.
