# SPEC — `ui-swiper` family

> Status: proposed · v0.1 · 2026-07-10 · Layer: SPEC (execution contract)
> Refines: TKT-0008 (`../tickets/tkt-0008-ui-swiper-family.md`) under the ratified scope + fork directions of
> [ADR-0124](../adr/0124-swiper-family-scroll-snap-loop.md) (proposed; forks F1–F8 as recommended).
>
> **No owning PRD — a deliberate, acknowledged deviation from the family-PRD pattern**, on the same basis
> the `ui-theme-provider` SPEC recorded: this is a scoped component intake whose Problem/Users/Outcomes
> already live in TKT-0008 (a TICKET carrying Summary/Acceptance/Scope). Authoring a PRD here would restate
> the ticket under different frontmatter — the "restated substrate" failure `doc-authoring-standards` names.
> **Known, deliberate gap:** the SPEC↔PRD uplink check fails on this file by construction; recorded here as a
> reviewed deviation, not a silent miss.
> Refined by: [`../lld/swiper-family.lld.md`](../lld/swiper-family.lld.md). Build plan:
> [`../decompositions/swiper-family.decomp.json`](../decompositions/swiper-family.decomp.json)
> (coverage-clean, plan mode).
> Altitude: owns **what the five elements do and how they behave at every boundary** — the prop/event
> contract per element, the loop's observable seamlessness + a11y model, the composition/placement contract,
> the catalog disposition. Implementation (file layout, CSS mechanics, the clone/teleport algorithm, page
> prose) is the LLD's. Requirement IDs file-scoped (`SPEC-R1…`).

---

## 1. Purpose

Contract the family ADR-0124 ratifies: a CSS-native (scroll-snap) carousel — `ui-swiper` presenting
author-supplied `ui-swiper-item` slides in one owned scroll viewport, with an optional pixel-seamless
infinite loop, optional author-placed pagination/paddles/label chrome the coordinator drives, and a bindable
active-slide selection. This SPEC is normative for the contract, the loop's observable behavior, and the
catalog disposition; it is not normative for the clone/teleport algorithm, CSS selectors, or page prose,
which the LLD owns.

## 2. Definitions

- **Slide** — one `ui-swiper-item`, an author-written wrapper around arbitrary content, one per logical slide.
- **Real slide / clone** — in loop mode the coordinator inserts non-authored **clone** copies of edge slides
  to fill the viewport past a seam; every other slide is **real**. Clones are never focusable, announced, or
  counted. **Real-count** = the number of `ui-swiper-item` slides the author wrote.
- **Track** — the coordinator-created scroll container (`[data-part=track]`) the slides live in; the single
  owned scroll region.
- **Seam** — the wrap point in loop mode where the track scrolls from the last real slide back to the first
  (or vice versa). **Seamless** = no visible jump, flash, or reflow at the seam.
- **Active slide** — the real slide currently aligned to the track's snap position (per `align`). Its
  identity is the `active` prop.
- **Anchor** — one of the three chrome tags (`ui-swiper-pagination` / `ui-swiper-paddles` /
  `ui-swiper-label`) placed by the author as a positioned mount point the coordinator fills and wires.
- **Chrome** — the pagination dots, prev/next paddles, and label, collectively.

## 3. Requirements

### 3.1 `ui-swiper` — the coordinator (SPEC-R1…R8)

- **SPEC-R1 (identity + base).** `ui-swiper` is a custom element `extends UIContainerElement`, size-class
  `pattern`, **not** form-associated. It self-defines on import and builds its two parts exactly once,
  idempotent across reconnect: the scrolling **track** and a visually-hidden polite **live** region (declared
  `parts: [track, live]` in the descriptor; the selector form is the LLD's). Importing `ui-swiper` registers
  all five family tags.

- **SPEC-R2 (attribute surface).** Typed, reflected props, in the fleet enum dialect:
  - `orientation` — enum `horizontal | vertical`, default `horizontal`. Selects the scroll axis.
  - `slides-in-view` — string, default `''`. `''` ⇒ responsive-auto (container-query column count);
    a numeric string (`'1'`, `'2'`, …) pins the visible-slide count. (String, not number, so `''` =
    responsive is expressible and the value crosses the attribute boundary faithfully — the prior-art
    `slides-per-view` parity.)
  - `align` — enum `start | center | end`, default `start`. The per-slide `scroll-snap-align` (the
    ADR-0039 box-alignment dialect; no `*-reverse`).
  - `loop` — boolean, default `false`. Enables the infinite clone-teleport loop (§3.5).
  - `duration` — string, default `''`. `''` ⇒ the motion-token default; a CSS `<time>` overrides the
    **programmatic**-advance (paddle/dot/keyboard/`goTo`) duration. Native gesture snaps use the UA's own
    smooth-scroll timing and are unaffected (the F1 scroll-snap trade-off; ADR-0124 Consequences).
  - `easing` — string, default `''`. `''` ⇒ the motion-token default; a CSS easing overrides the
    programmatic-advance curve (same native-gesture caveat as `duration`).
  - `pagination` — boolean, default `false`. Stamp a default-placed dots anchor when no
    `ui-swiper-pagination` anchor is present (§3.4).
  - `paddles` — boolean, default `false`. Stamp a default-placed prev/next anchor when no
    `ui-swiper-paddles` anchor is present (§3.4).
  - `active` — string, default `''`. The active-slide identity; reflected; **bindable** (§3.6).
  - Plus the `UIContainerElement.surfaceProps` axes `elevation` / `brightness` (ADR-0015), enum,
    default `0`, reflected.

- **SPEC-R3 (single owned scroll region).** The track is the **only** scrolling element the swiper owns.
  Native touch/trackpad gestures pan it; the swiper does not translate vertical wheel into horizontal
  advance (ADR-0124 F8). Under `orientation=vertical` the axis, the arrow keys, and the paddle icons all
  rotate together.

- **SPEC-R4 (keyboard).** The track part is focusable (`tabindex=0`, `role=group`, a label). With the swiper
  focused: **ArrowRight/ArrowLeft** (horizontal) or **ArrowDown/ArrowUp** (vertical) move to the next/prev
  slide and `preventDefault`; **Home/End** move to the first/last real slide. In non-loop mode Home is the
  first and End the last real slide; in loop mode both still resolve to real endpoints (wrapping is a
  gesture/paddle concern, not Home/End).

- **SPEC-R5 (focus safety).** Tab order follows real-slide DOM order; clone slides are `inert` and never
  receive focus. Advancing via paddle/dot/keyboard does not steal focus from the paddle/dot the user
  operated (the operated affordance keeps focus — the prior-art precedent); focusing content inside a slide
  never triggers a spurious scroll teleport.

- **SPEC-R6 (whole-shape).** A bare `<ui-swiper>` with `ui-swiper-item` children, with zero consumer CSS, in
  a realistic container, renders a **non-collapsed** viewport: the track has the width of its container and a
  height driven by the slides' content (never a 0-height or 0-width sliver — the `ui-slider` DOT-bug guard,
  test-the-whole-shape law). An empty swiper (no items) renders an empty non-erroring track.

- **SPEC-R7 (events ⊂ allowlist).** The swiper emits exactly one family event: `select { value: string,
  index: number }`, on a **user-driven** active-slide change committed at scroll-snap settle (or paddle/dot/
  keyboard). A programmatic `active` write applies silently — **no event echoed** (binding hygiene). No live
  mid-scroll event; settle is the commit. No new event name; `change` is not used.

- **SPEC-R8 (reduced motion).** Under `prefers-reduced-motion: reduce`, programmatic goto (paddle/dot/
  keyboard) is instant (no animation); the loop teleport is instant regardless. No content is hidden or
  removed — reduced motion changes timing only.

### 3.2 `ui-swiper-item` — the slide (SPEC-R9)

- **SPEC-R9.** `ui-swiper-item` is a custom element `extends UIElement`, size-class `layout`, **not**
  form-associated, holding one optional `value` prop (string, default `''`, reflected — the stable slide
  identity used by `active`; falls back to real index). Each real item carries, via `ElementInternals`
  (never a host attribute): `role=group`, `aria-roledescription="slide"`, and `aria-label` = a coordinator-
  supplied position string `"{n} of {realCount}"`. It is sized by the track (min-size 0, snap-align +
  snap-stop from the track's tokens); it has no geometry of its own.

### 3.3 The infinite loop (SPEC-R10…R11)

- **SPEC-R10 (seamlessness).** With `loop` set, scrolling (or paddling) past the last real slide continues to
  the first real slide and vice versa with **no visible jump** at the seam — the active slide's content is
  pixel-identical before and after the wrap. The user can advance indefinitely in either direction and never
  reaches a disabled boundary; paddles never disable in loop mode. Proven by a real-browser scroll-position
  assertion (jsdom has no scroll layout): after a clone-band settle the track's scroll offset equals the
  equivalent real slide's snap target within ε and the announced index is the real index.

- **SPEC-R11 (loop a11y — position without a "last").** Because loop mode has no terminal slide, position is
  announced as **real-index / real-count** (e.g. "Slide 3 of 5"), not "last slide"; each real item's
  `aria-label` counts only real slides; clones are `aria-hidden` + `inert` and contribute to neither the
  count nor the tab order nor the pagination dots. The `[data-part=live]` polite live region announces the
  new position on settle so AT users track wrap movement.

### 3.4 Chrome composition + placement (SPEC-R12)

- **SPEC-R12.** The three chrome tags are **author-placed anchors the coordinator drives**, with a boolean
  stamp fallback (ADR-0124 F3):
  - `ui-swiper-pagination` (`UIElement`, `tier: pattern`) — a dots row the coordinator fills with one
    indicator per real slide (or, per its own `type` prop `dots | fraction`, an "n / realCount" readout).
    Dots are keyboard-operable (a dot goes to its slide); the active dot is distinguished by **size**, not
    color alone (ADR-0057). Placement is wherever the author writes the tag.
  - `ui-swiper-paddles` (`UIElement`, `tier: pattern`) — a prev/next pair the coordinator fills with two
    composed `ui-button`s (icon-only, ghost, nav-icon sized to context per geometry.md), wired to prev/next,
    labelled "Previous/Next slide", axis-rotated under `orientation=vertical`.
  - `ui-swiper-label` (`UIElement`, `tier: display`) — author text that becomes the carousel's accessible
    name: the swiper points its region `aria-labelledby` at it (`ElementInternals` element-reflection).
  - **When an anchor is present** the coordinator drives it in place. **When it is absent and the matching
    `[pagination]`/`[paddles]` boolean is set**, the coordinator stamps a default-placed anchor of that kind
    (below the track / overlaid on the track respectively). A present anchor always wins over the boolean.
    With neither, that chrome simply does not exist (the swiper still scrolls natively).

### 3.5 Catalog disposition (SPEC-R13)

- **SPEC-R13.** Under the ADR-0087 catalog-or-allowlist gate: `ui-swiper` and `ui-swiper-item` earn default-
  catalog rows (`Swiper`, `SwiperItem`) — a content carousel is agent-emittable; the agent emits `ui-swiper`
  with `[pagination]`/`[paddles]` booleans and `ui-swiper-item` children (no chrome tags needed).
  `ui-swiper-pagination`, `ui-swiper-paddles`, and `ui-swiper-label` take reasoned `EXCLUSION_ALLOWLIST`
  entries (author placement refinements, not agent-composed content). The `Swiper` row exposes the two-way
  `active` seam (`value: { prop: 'active', event: 'select' }`, ADR-0019). Allowlist residue drains to zero;
  the whole-fleet coverage gate stays green.

### 3.6 Bindable `active` (SPEC-R14)

- **SPEC-R14.** `active` is a reflected string the renderer two-way-binds (LLD-C7 / ADR-0019): the agent
  **sets** it to move the carousel (programmatic → the coordinator scrolls to that slide, no event echoed); a
  **user gesture** commits it and emits the one `select`. Resolution: `''` ⇒ first slide; a value matching a
  real item's `value` wins; else a numeric index in range; else the first slide (the `ui-tabs` `#resolveIndex`
  precedent).

### 3.7 Carousel region identity & accessible name (SPEC-R15)

- **SPEC-R15.** The `ui-swiper` **host itself** is announced to assistive tech as a carousel: `role="region"`
  + `aria-roledescription="carousel"`, both applied through `ElementInternals` (never a host attribute — the
  FACE law). Its accessible name resolves as: a present `ui-swiper-label` (via internals element-reflection,
  `aria-labelledby`) wins; absent one, `aria-label="Carousel"`. This is the family's **fleet-first** use of
  `internals.ariaRoleDescription` (ADR-0124 Consequences names it the sharpest build-time risk; it is
  browser-verified and jsdom-guarded).

### 3.8 Descriptor fidelity (SPEC-R16)

- **SPEC-R16.** Each of the five elements ships a `{name}.md` descriptor whose `attributes[]` mirror the
  element's live `static props` 1:1 and whose `parts`/`slots`/`events`/`customStates` tell the truth about the
  source — enforced by the standing contract↔props and contract↔source trip-wires
  (`validateComponentDescriptor` · `compareDescriptorToProps` · `compareDescriptorToSource`), zero drift.

## 4. Non-goals (explicit fences)

- **Autoplay** (auto-advance, pause-on-hover/focus, `autoplay-pause`/`autoplay-resume` events) — ADR-0124
  F6; a named foreseen extension, not v1.
- **Mouse/pen click-drag beyond native scroll** — ADR-0124 F7; native gestures only in v1.
- **Wheel-to-advance axis translation** (SwiperJS `mousewheel`) — ADR-0124 F8.
- **Virtual / lazy slides** — all slides are real DOM; no windowing.
- **Transition effects** (fade/cube/coverflow/cards/flip) — scroll-snap is slide-only.
- **Progressbar pagination** — dots + fraction only in v1.
- **Porting SwiperJS's full API** — the fleet ships the coherent subset above.

## 5. Acceptance

Each SPEC-R# is verified by the acceptance predicate of its bound decomp node in
[`../decompositions/swiper-family.decomp.json`](../decompositions/swiper-family.decomp.json) — those runnable
`accept` predicates (naming a real `npm test` / `npm run test:browser` target and an observable assertion) are
the **criteria of record**, and the §6 Trace table below is the binding (requirement → node). A requirement is
met when its node's `accept` passes green under the gates the LLD §15 names; the whole intake is accepted when
every node's `accept` is green and the independent `component-reviewer` returns GO for each wave (n30).

## 6. Trace

| Requirement | LLD component | Decomp node |
|---|---|---|
| SPEC-R1 identity/parts | LLD-C1 | n3 |
| SPEC-R2 attribute surface | LLD-C2 | n4 |
| SPEC-R3 owned scroll region | LLD-C3 | n6 |
| SPEC-R4 keyboard | LLD-C6 | n11 |
| SPEC-R5 focus safety | LLD-C6 | n12 |
| SPEC-R6 whole-shape | LLD-C8 | n16 |
| SPEC-R7 events | LLD-C7 | n13 |
| SPEC-R8 reduced motion | LLD-C8 | n8 |
| SPEC-R9 ui-swiper-item | LLD-C4 | n5 |
| SPEC-R10 loop seamlessness | LLD-C5 | n9 |
| SPEC-R11 loop a11y | LLD-C5 | n10 |
| SPEC-R12 chrome composition | LLD-C9/C10/C11 | n17,n18,n19 |
| SPEC-R13 catalog | LLD-C12 | n20 |
| SPEC-R14 bindable active | LLD-C7 | n7 |
| SPEC-R15 carousel region identity | LLD-C1 (§8 anatomy) | n14 |
| SPEC-R16 descriptor fidelity | LLD §10 (cross-cutting) | n21 |
