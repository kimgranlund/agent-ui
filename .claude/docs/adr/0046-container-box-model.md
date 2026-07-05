# ADR-0046 — The container box-model: margin inset, the sticky-region pattern, and the header/content/footer padding system

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-01
>
> | Field | Value |
> |---|---|
> | **Status** | accepted |
> | **Date** | 2026-07-01 |
> | **Proposed by** | orchestration-lead — on Kim's directive that "all containers should have an inset/gap system expressed as children's margins", plus a header/content/footer pattern (sticky headers, dividers) and a fixed region padding (inline 12 · block 4 · gap 8, nested content stepping in one inset per level). Design forks confirmed with Kim (rollout scope; flow-root + margin-collapse). |
> | **Ratified by** | orchestration-lead — on the green `check` + `test` (jsdom) + `test:browser` (both engines) + `size`, and screenshot review of the card + modal + select panels. |
> | **Repairs** | **NEW** `controls/_surface/container-box.css` (+ its structure probe) · `component-styles.css` (`@import`, after `container.css`) · the overlay panels `controls/{select,menu,combo-box}/*.{ts,css}` (`[data-box]` + inset margins; select group-headers sticky) · `controls/card/card.{css}` + its geometry/browser tests (rolled onto the model; nested-radius re-based) · `controls/modal/modal.{ts,css}` + tests. |
> | **Supersedes / Superseded by** | Partially superseded by the **2026-07-04 Amendment 2** below (region margin: full-bleed → inset, across the whole family; the card-only 6px override — Amendment 1 — is rescinded), and the **2026-07-05 Amendment 3** below (the scroll affordance — a presence-aware edge-fade mask + the card's whole-container scroll model). **Extended by ADR-0056** (the region-less card humane default — a CSS fallback leg on the "card holds no padding" law: a Card with NO region children gets region-equivalent padding; the law stands for region-bearing composition). **Relates** ADR-0015 (container surface — the PAINT layer this SPACING layer sits beside), ADR-0016 (layout), ADR-0018 (concentric nested-radius — re-based here off the content inline padding), ADR-0041 (widget geometry). |

## Context

Containers each carried bespoke spacing (card: `:has()` grid + `--ui-space-md` padding; modal: `--ui-space-lg`
shell; overlay panels: ad-hoc option padding). Kim asked for **one** inset/gap system across every container,
expressed as children's margins (so a child can opt out), plus a header/content/footer pattern with **sticky**
headers, dividers, and a fixed region padding.

## Decision

A second shared surface layer, `_surface/container-box.css` — SPACING, beside `container.css`'s PAINT. A
surface opts in with **`[data-box]`**.

1. **Margin inset (the box).** `[data-box]` is a `flow-root` BFC with no inner padding; direct children get a
   uniform **`--ui-box-inset` (0.25rem / 4px)** margin. In a BFC adjacent block margins **collapse** to one
   inset (4px between siblings) and the edge inset is preserved — not doubled. A child overrides to `margin: 0`
   for **full-bleed**; **`[padded]`** = `margin: 0` + inset padding. All rules are `:where()` (specificity 0),
   opt-in, forced-colors-safe.

2. **The sticky-region pattern.** `header`/`footer` (or `[data-region=header|footer]`) are full-bleed +
   `position: sticky` with `background: inherit` (the box surface, so scrolled content never shows through) —
   trivially overridable. `hr` is a full-bleed divider. `content`/`main` is the scroll region between them.

3. **The region padding system (fixed).** The region wrappers carry their own internal padding: **inline 12px
   · block 4px · gap 8px** (`--ui-box-pad-inline` / `-pad-block` / `-gap`, rem-based → density-INVARIANT). A
   **nested content steps its inline padding IN one inset per level (12 → 8 → 4, floored)** so a
   content-inside-content stays concentric with its parent's ink (parent 12 = child inset-margin 4 + child pad
   8). This is expressed as **explicit descendant levels**, NOT a self-referencing custom property.

### Two load-bearing implementation gotchas (both verified in-browser)

- **A self-referencing custom property is a CSS cycle.** `--x: calc(var(--x) - 4px)` is guaranteed-invalid;
  the step-down measured 0px that way. The fix is explicit `content content { … }` descendant levels. (The same
  trap ADR-0018 already records for the nested-radius chain.)
- **Content gap must not use flex.** A flex-column content shrinks a tall child and breaks `[scrollable]`
  block-scroll. Content stays `display: block`; the 8px child rhythm comes from an **adjacent-sibling margin**
  (`> * + * { margin-block-start }`) — gap-without-flex, scroll-safe.

### Rollout (foundation + panels first, then the region containers — Kim's scope)

- **Overlay panels** (`select`/`menu`/`combo-box`): panel `[data-box]`, shell padding → 0, option rows inset by
  the box margin. `ui-select` group headers are now **sticky** (pinned, taking the panel surface) with dividers
  between groups.
- **`ui-card`:** no card padding/gap; header/content/footer are full-bleed with the region padding; content
  children get the 8px adjacent-sibling rhythm. The concentric nested-radius chain (ADR-0018) **re-bases off
  the CONTENT inline padding** (a nested card lives in content); full-bleed region fills round to the **outer**
  radius. Region padding is now density-INVARIANT (was `--ui-space`-driven).
- **`ui-modal`:** the `<dialog>` is a `[data-box]` with zero shell padding; author header/content/footer
  regions get the system; loose content falls back to the 4px box inset.

## Consequences

- One spacing vocabulary across the whole container family; a control opts in with `[data-box]` and marks its
  regions. `@scope` hygiene holds by aliasing the shared `--ui-box-*` tokens through per-control `--ui-{name}-*`.
- **Behaviour change:** card/modal region padding is fixed (rem), so **density no longer scales container
  padding** (it still scales the `--ui-space`-based adornment gaps). This was Kim's explicit fixed-px spec.
- Browser tests that import a control sheet directly must also import `container-box.css` to exercise the region
  padding (it lives in the shared layer, not the control sheet) — as the modal smoke now does.

## Alternatives

*(Recorded 2026-07-04 from the shipped Decision + `container-box.css` — the real options weighed at design time.)*

- **Flexbox `gap` for the region-child rhythm** — rejected: a region's content wrapper is `display: block` so
  `overflow: auto` scrolls a block flow; the 8px rhythm is a scroll-safe adjacent-sibling margin, not `gap`.
- **A self-referencing custom property for the nested inline-padding step (12→8→4)** — rejected: CSS treats a
  property that reads itself as a cycle (invalid); explicit per-level descendant selectors realize the step.
- **`--ui-space`-driven, density-scaled region padding** — rejected: Kim's explicit fixed-px (rem) spec makes
  region padding density-INVARIANT (Consequences); density still scales adornment gaps.
- **Per-control bespoke padding instead of one shared `--ui-box-*` vocabulary** — rejected: one spacing
  vocabulary across the whole container family, opted into via `[data-box]` (the Amendment below is the one
  deliberate, scoped opt-*out*).

## Amendment 1 — 2026-07-04 (`ui-card` region padding: a scoped 6px override) — RESCINDED by Amendment 2, below

Per Kim's directive (intent-extracted: "ui-card should have 6px padding by default" + "block-padding for
card-header/content/footer 4px → 6px"), **`ui-card` overrides the shared region-padding default of inline
12px / block 4px with a uniform 6px inline + 6px block** — card-only. The shared model above is UNCHANGED for
every other `[data-box]` surface (modal / select / menu / combo-box / calendar panels keep 12/4). The override
is realized in `card.css` by repointing `--ui-box-pad-inline` / `--ui-box-pad-block` to `0.375rem` on
`:where(ui-card)` and consuming them through a card-private `--ui-card-region-pad-*` intermediary (so a nested
container surface inside a card re-asserts its own 12/4 and cannot inherit the card's 6px). This is a deliberate
divergence from "one spacing vocabulary across the whole container family" (Consequences above), scoped and
documented in `card.css` / `card.md`; the shared vocabulary remains the default that a control opts *out* of.
Independent component-review: GO (cascade robustness confirmed by two mechanisms). Gates green
(check · jsdom 2408 · browser 588).

## Amendment 2 — 2026-07-04 (region margin: full-bleed → INSET, across the whole family; Amendment 1 rescinded)

Per Kim's follow-up directive (same day): **every region (header/content/footer, across ALL SIX `[data-box]`
consumers) becomes inset, not full-bleed** — the model's original "children's margins provide the inset" law (Decision
cl.1 above) now applies to the region wrappers too, not just loose non-region children. This changes both the
shared tokens and the per-family realizations:

- **Tokens (`container-box.css`):** `--ui-box-inset` `0.25rem`(4px) → **`0.375rem`(6px)**; `--ui-box-pad-block`
  `0.25rem`(4px) → **`0.375rem`(6px)**; `--ui-box-pad-inline` **unchanged** at `0.75rem`(12px); `--ui-box-gap`
  unchanged at `0.5rem`(8px, the region's own child rhythm — unrelated to the inter-region gutter).
- **`header`/`footer`/`main`/`[data-region]` are REMOVED from the full-bleed (`margin: 0`) override list** —
  they now fall through to the generic `[data-box] > *` rule (`margin: var(--ui-box-inset)`, 6px) like any
  other child. Only `hr` and an explicit `[data-full-bleed]` opt-out remain full-bleed. The flow-root BFC's
  margin-collapse (Decision cl.1) is what keeps every gutter — frame↔region AND region↔region — at a uniform
  6px rather than doubling; this was already the mechanism for loose children, now extended to regions.
- **The nested-content padding-step (cl.3) re-derives automatically**: L1 stays 12px; L2 (`pad-inline − inset`)
  becomes 12−6=**6px** (was 8px); L3+ floor (`pad-block`) becomes **6px** (was 4px) — L2 and the floor now
  coincide (a harmless consequence of inset and pad-block both landing on 6px), not an inversion.
- **`ui-card` (Amendment 1's override) is RESCINDED.** Card no longer repoints `--ui-box-pad-inline`/`-block`;
  it reads the shared 12px/6px region defaults straight, matching modal/select/menu/combo-box exactly — "one
  spacing vocabulary across the whole container family" (the original Consequences line) is restored without
  exception. Because `ui-card` is `display: grid` (not the shared flow-root BFC), its own margin-collapse
  doesn't exist for free — `card.css` reconciles the same 6px-everywhere outcome via a grid row-`gap` (6px) +
  a first/last-child margin split (every region gets a 6px inline margin unconditionally; only the first
  region gets a block-start edge margin and only the last a block-end edge margin — the grid `gap` covers the
  space between middle regions). A region fill's corner-rounding also changes: since a region no longer meets
  the card's outer edge, it now rounds **all four** of its own corners to the concentric `--ui-card-inner-radius`
  (was: only the card-edge corners, clipped to the OUTER `--ui-card-radius`).
- **A flagged consequence, not silently patched around:** `ui-card`'s nested-radius law (ADR-0018,
  `r_child = max(0, r_parent − pad_parent)`) now decrements against the 12px shared pad-inline (was the
  rescinded 6px override). With the default `--ui-radius-base` of 12px, an **unreseeded root card's** inner
  radius now floors at **exactly 0** (12−12), not the old 6px-positive headroom — a real visual change (a
  nested card/region fill needs `--ui-card-radius` reseeded larger than 12px to show a rounded corner by
  default). Recorded for Kim; no compensating mechanism was invented to hide it.
- **ADR-0056's region-less card fallback re-derives too:** its padding now mirrors a region's OWN ink-padding
  (12px inline / 6px block, was 6/6) — deliberately the simpler of two readings (it does NOT also add the
  region's separate 6px positional margin, which a bare card's single flattened box has no equivalent layer
  for); flagged in `card.css`/`card.md` in case full margin+padding parity is wanted instead.
- **`ui-calendar` — the SIXTH `[data-box]` consumer, previously unlisted.** Amendment 1 named the calendar; this
  amendment's first pass (and the "five families" count) dropped it. Its `[data-part=panel][data-box]` +
  `<header data-part=nav>` genuinely takes the inset change (nav full-bleed → inset 6px, block padding 4→6px, grid
  child margin 4→6px). The `calendar.css` comments were repaired to the 6px reality and — a latent gap surfaced in
  the fix — its browser test was **not importing `container-box.css` at all**, so its box-model assertions were
  vacuous (unlike every sibling's browser test). The import + a nav-inset assertion (margin/sticky `inset-block-start`
  = 6px, both engines) were added. See `calendar.css` / `calendar.browser.test.ts`.

Every affected test (`container-box.test.ts`/`.browser.test.ts`, `card-geometry.test.ts`/`card.browser.test.ts`,
`modal.browser.test.ts`, plus the `select`/`menu`/`combo-box` option-row margin fallback literals) was
re-baselined against the new values. Gates green: `check` · jsdom · `test:browser` (both engines) · `size`.

## Amendment 3 — 2026-07-05 (the scroll affordance: a presence-aware edge-fade mask + the card's whole-container scroll)

The inset-region change (Amendment 2) created a scroll problem: as a container scrolls, content passing a sticky
header/footer shows in the 6px inset gutter beside the bracket (the bracket no longer full-bleeds to the frame).
Kim's resolution is a **scroll-fade mask**, plus a settled card scroll model — both landed this day.

- **The presence-aware edge-fade mask (`traits/scroll-fade.ts`, NEW — a cross-family trait).** A JS scroll +
  `ResizeObserver` listener toggles `data-fade-top`/`data-fade-bottom` on the scroll viewport and publishes the
  sticky bracket's measured band as `--ui-box-head`/`--ui-box-foot` (or `0px` when that edge has no bracket).
  `container-box.css` ramps a `mask-image` linear-gradient that fades content **past** the bracket offset — so
  content is masked until it clears a present header/footer, and a bracketless edge collapses (`var(…, 0px)`) to a
  plain viewport-edge fade, byte-identical to no-bracket. Chosen over `animation-timeline: scroll()` for testability
  + cross-engine safety. Kim's steer: the brackets need **no edge-reaching background** — the gradient carries the
  occlusion; a bit of see-through in the inset gutter is intended.
- **Consumers.** The overlay **panels** (modal/select/menu/combo-box) wire it at their `[data-box]` panel viewport
  (their sticky group-labels stay masked). **`ui-card`** wires it at the CARD viewport (below). The trait self-gates
  on ACTUAL overflow (a non-scrolling surface never fades) and tears down fully on disconnect / reactive-off.
- **The card's whole-container scroll model (settled after two iterations).** **[SUPERSEDED 2026-07-06 by Amendment 4 — the wrapper model; card-as-viewport is now only the no-wrapper fallback.]** `<ui-card scrollable>` — or the
  A2UI-mapped `<ui-card-content scrollable>` signal — makes the **card ITSELF the scroll viewport** (`overflow-y:
  auto` + `isolation: isolate`), with header/footer `position: sticky` (`inset-block: --ui-card-region-margin` =
  6px, `background: inherit`), so the whole container scrolls as one and the brackets pin at its edges ("footer stays
  put"). The card is **not** `[data-box]`, so it wires the equivalent sticky-region + generic `[data-fade-*]` mask
  locally in `card.css`; block flow is unchanged (scroll mode only adds `overflow` + sticky — no flex). A short-lived
  inner-content-viewport (flex-column) model was tried and **superseded** — it trapped the scroll in the middle
  region (Kim: "the whole container should scroll") and never committed.
- **The cross-engine bottom-gutter.** With a footer, the sticky footer holds the ~6px bottom gutter through scroll;
  without one, the last region's own `padding-block-end` (inside its border-box → always in the scroll extent) keeps
  content off the card edge — sidestepping the WebKit scroll-container last-child *margin* quirk. Both are
  render-and-measured, both engines (`card.browser.test.ts`).
- **A documented LOW limitation (not patched around):** `card-content.ts` arms the fade off the content region's
  own `scrollable` (fully reactive) OR the parent `<ui-card scrollable>` read once at connect. A RUNTIME toggle of
  the parent attribute engages CSS scroll but re-arms the JS fade only on reconnect; the content-region signal
  (A2UI's path) is the fully-reactive form. Narrowed in `card.ts`/`card.md` rather than adding a parent-attribute
  observer (bytes + an upgrade-safety regression for the standalone-content case).

**Budget.** The `scroll-fade` trait pushes the `components` family barrel past the 22 KB gz cap → re-based
**22 → 23 KB** (ADR-0049 Amendment 1; Kim-approved after reviewing the eventual distributed size — a real consumer
ships ~5–14 KB, the 22.6 KB family total is the all-controls worst case; per-control `exports` + a marginal gate
booked for G8). Independent component-review of the settled card model: **GO / SHIPPABLE** (all three carried
findings resolved or reclassified LOW). Gates green: `check` (tsc + site) · jsdom · `test:browser` (Chromium +
WebKit) · `size` (post-rebase, 22770 / 23552).

## Amendment 4 — 2026-07-06 (the card scroll model: whole-container → the WRAPPER model, Kim via /intent-extract)

Amendment 3's card scroll model (card = the scroll viewport, mask on the card) had a flaw Kim caught: a `mask-image`
on the whole card fades the sticky header/footer too — the gradient's transparent end sits exactly where the
brackets float (Amendment 3's own "a bit of see-through in the bracket zone"). Two fixes were tried and measured
in-browser before the resolution:

1. **Mask moved to `ui-card-content` (the scrolled child).** Brackets crisp ✓, but the fade went **invisible
   mid-scroll for long content** — `mask-image` paints relative to the masked element's OWN box, and a *scrolled*
   child's box leaves the visible window, so the fade zone scrolls out of view (proven in-browser).
2. **The WRAPPER model (Kim's original sketch, ratified via /intent-extract) — the resolution.** An author-written
   **`[scroll-wrapper]` inside `ui-card-content` is the scroll viewport**; `ui-card-content` is a **fixed** frame
   carrying the mask. Because a box that never scrolls IS the visible window throughout, the fade is **visible across
   the whole scroll** AND the sticky header/footer (siblings, outside the masked content) stay crisp.

Mechanics:
- **Scroll mode is a flex column** (header auto / content 1fr / footer auto) — a scoped exception to the card's
  default block-flow "no grid/flex" (needed to size `ui-card-content` to fill so the wrapper has bounded height).
  The default non-scroll card is unchanged (block flow). Two empirical flex fixes: flex items don't margin-collapse
  (6px gutters reproduced via `gap` + the flex container's `padding`); and that padding + the sticky `inset-block`
  double-stacked to 12px once stuck → sticky inset set to `0`. `flex: 1 1 auto` on content replaces the
  `min-block-size: 100%` sticky-footer-fill hack (which force-overflowed a short card by ~the header+footer height —
  now fixed and asserted).
- **The trait grew a 3-way split** (`scroll-fade.ts`): `viewport` (measured — the wrapper), `paintTarget` (painted —
  `ui-card-content`), `brackets` (queried for the sticky header/footer — the CARD). The two new options default to
  `viewport`, so the overlay panels are byte-identical.
- **The wrapper is author-written, NEVER auto-injected** (auto-injection would disturb A2UI's positional child
  reconcile). **No-wrapper fallback:** `<ui-card scrollable>` without a `[scroll-wrapper]` degrades to Amendment 3's
  card-as-viewport behaviour (mask still on content; fade only near the scroll extremes) — documented, not an error.
  **A2UI:** a scrollable A2UI card emitting the wrapper is a **deferred follow-up** (A2UI renders `CardContent`
  children directly today).
- **Wrapper detection self-heals** (`card-content.ts`, mirroring `ui-text`'s childList-heal precedent): a
  `MutationObserver` re-wires `scrollFade` on a genuine `[scroll-wrapper]`-presence flip (an imperative late-append
  would otherwise strand the trait on the fallback while the CSS `:has()` layout already flipped). Torn down with the
  wiring on disconnect.

**The trade Kim ratified:** the scroll now lives in the wrapper, so the scrollbar is **content-band** (between the
brackets), NOT the full-height "whole container scrolls" bar Amendment 3 described — Kim confirmed this trade (a
running see-through fade + crisp brackets, GPU-smooth) over the full-height bar via /intent-extract.

Gates green: `check` (tsc + site) · jsdom 2462 · `test:browser` 726 (Chromium + WebKit) · `size` 22899 / 23552.
Independent component-review: **GO / SHIPPABLE** (all 10 dims ≥4; the childList-heal + a footer-fill assertion were
applied from its two LOW findings).
