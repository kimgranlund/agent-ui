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
> | **Supersedes / Superseded by** | Partially superseded by the **2026-07-04 Amendment 2** below (region margin: full-bleed → inset, across the whole family; the card-only 6px override — Amendment 1 — is rescinded), and the **2026-07-05 Amendment 3** below (the scroll affordance — a presence-aware edge-fade mask + the card's whole-container scroll model). **Amendment 5** (accepted, Kim ratified 2026-07-05) further supersedes **Amendment 4** (drops the `[scroll-wrapper]` WRAPPER MODEL — `ui-card-content` itself is now the scroll viewport). **2026-07-05 Amendment 6 (accepted, Kim ratified 2026-07-05)** refines Amendment 5 (unchanged shape) with the scrollbar-hide + keyboard-operability + focus-ring decision. **A 2026-07-08 Amendment 6 refinement (proposed, pending ratification)** restores `ui-card-content`'s INLINE region margin (axis-split from the block-zeroing above) so its text aligns with the header/footer's. **Extended by ADR-0056** (the region-less card humane default — a CSS fallback leg on the "card holds no padding" law: a Card with NO region children gets region-equivalent padding; the law stands for region-bearing composition). **Relates** ADR-0015 (container surface — the PAINT layer this SPACING layer sits beside), ADR-0016 (layout), ADR-0018 (concentric nested-radius — re-based here off the content inline padding), ADR-0041 (widget geometry). |

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

## Amendment 5 — 2026-07-05 — the WRAPPER model is dropped: `ui-card-content` itself is the scroll viewport

Kim simplified the model again, verbatim: *"`<ui-card-content>` should have the mask and manage overflow, and
adjust block-padding and linear gradient coordinates based on presence of the peer footer and header. it
should be set to use 100% of its parent height when `[scrollable]`."* This **drops the author-written
`[scroll-wrapper]`** Amendment 4 introduced — `ui-card-content` becomes the ONE box that both scrolls and
carries the mask, no separate viewport/paint-target split.

- **Content-IS-viewport (the flex carve-out).** `ui-card-content` becomes the scroll shell's **sole** flex
  item (`flex: 1 1 auto; min-block-size: 0; overflow-y: auto`) — the shell keeps `display: flex;
  flex-direction: column` (unchanged mechanism from Amendment 4) purely as the SIZING lever: plain block
  layout's `height: 100%` on an auto-height parent bounded only by `max-block-size` computes to `auto`, never
  100% (a `max-height` alone is never a "specified" height for a child's percentage resolution), but flexbox
  explicitly carves out a definite used-size for a flex item against its container's content-box even when the
  container's own outer size is only max-height-clamped. With header/footer no longer flex items (below),
  content is the shell's only item, so this carve-out alone is what makes `overflow-y: auto` genuinely
  **engage** rather than stay inert (verified: `content.scrollHeight` ≫ `clientHeight`; `card.scrollHeight ===
  card.clientHeight` — the card itself never scrolls; the header/footer rect is byte-identical top vs. mid-scroll,
  both engines, `card.browser.test.ts`).
- **Header/footer become OVERLAID PEERS.** `position: absolute; inset-inline: 0` + one block-edge inset each,
  removed from flow entirely (so content can be the shell's sole item) — no background (Kim: the brackets stay
  see-through; the gradient alone carries the occlusion). They KEEP their generic 6px region margin, which for
  an absolutely-positioned box still offsets it inward from its resolved inset edges, netting the same floating
  6px-inset look the family's regions always carry, just out-of-flow now.
- **One measured source, two consumers.** `traits/scroll-fade.ts` measures the header/footer band directly off
  the card (its `brackets` option) and publishes `--ui-box-head`/`--ui-box-foot`; `ui-card-content` re-declares
  them under its own `--ui-card-box-head`/`-foot` namespace (role-purity) and reads them for BOTH its own
  `padding-block-start`/`-end` (`max(band, plain-6px-pad)`, so a present bracket's band wins and an absent one
  collapses to the plain region pad) AND — via the un-namespaced name — `container-box.css`'s gradient offset
  (unchanged formula). The trait's 3-way split (`viewport`/`paintTarget`/`brackets`) Amendment 4 grew is
  **retired down to two** (`viewport`, measured AND painted; `brackets`, defaulting to `viewport`) — no
  consumer needs `viewport ≠ paintTarget` once content stopped splitting them (`traits/scroll-fade.ts`,
  `scroll-fade.test.ts`).
- **THE HOLD — gradient-only occlusion through the bracket band.** A first cut (a bare `transparent 0 → opaque
  at band+fade` ramp) let content ramp continuously ACROSS the bracket's own band — by the band's own far edge
  it could already be >50% visible, so a crisp, backgroundless bracket sitting over it still showed a
  partially-opaque scrolled line layered underneath (measured cross-engine). The root cause was gradient
  GEOMETRY (the ramp's *start* point, not its depth — stretching `--ui-box-fade` only moves the opaque point
  further out; content *within* the band stays just as visible). The fix: `container-box.css`'s shared mask
  gained `--ui-box-head-hold`/`--ui-box-foot-hold` (both default `0px`) — an extra same-colour stop immediately
  after each edge's anchor, holding the ramp flat through the hold depth before it starts ramping. Two
  coincident stops at the same position/colour are a geometric no-op, so every consumer that never sets these
  (modal/select/menu/combo-box — opaque `background: inherit` brackets) gets a **render-identical** mask (not
  string-identical: the `var(…, 0px)` fallback still serializes two extra coincident stops into the computed
  gradient, only the PAINT is unchanged) — proven by `container-box.test.ts` staying green untouched.
  `ui-card-content` sets both hold vars to its own measured band, so content is genuinely **fully invisible**
  behind bracket text throughout the whole band, with the soft running fade living entirely in the
  `--ui-box-fade`-deep strip just past it.
- **The WHCM bracket-bleed fix.** The shared `[data-fade-top]`/`[data-fade-bottom]` forced-colors rule
  (Amendment 3) drops the mask entirely under WHCM — normally safe (an opaque `background: inherit` bracket
  still occludes on its own), but THIS model's brackets are deliberately backgroundless, so with no mask AND no
  bracket fill, scrolled content bled straight through the header/footer text (a component-review finding).
  `card.css` gained a scroll-mode-only `@media (forced-colors: active)` rule giving the overlaid brackets an
  opaque `background: Canvas` fallback — scoped to both scroll-mode triggers (`[scrollable]` on the card or on
  the content region), so Kim's no-background normal-mode look is untouched. (A ~6px top/bottom gutter sliver
  above/below each bracket stays unmasked in WHCM — the same minor, pre-existing exposure every other
  `[data-box]` consumer has; not chased.)
- **Retired.** The author-written `[scroll-wrapper]` element, its self-healing `MutationObserver` heal in
  `card-content.ts` (mirroring `ui-text`'s `#heal`), and `scroll-fade.ts`'s `paintTarget` option are all gone —
  `ui-card-content` measures and paints itself directly, so none of the three-way split's machinery is needed.

**Sticky-footer-fill still holds for free** — `ui-card-content` is always `flex: 1 1 auto` in scroll mode
(unchanged mechanism), so a short body never strands the footer mid-viewport nor force-overflows a genuinely
short scrollable card (since header/footer no longer occupy flow height at all, being overlaid).

**The trade this supersedes:** Amendment 4's content-band scrollbar (between the brackets) is now moot — with
header/footer entirely out-of-flow overlays, `ui-card-content`'s own scrollbar spans the full card height minus
its own padding, and there is no separate wrapper element to carry a narrower one.

Repairs: `traits/scroll-fade.ts` + `scroll-fade.test.ts` (the `paintTarget` retirement) · `controls/card/card.{css,ts}` +
`card-content.ts` (the wrapper-detection/heal removal) · `card-css.test.ts` / `card.browser.test.ts` (re-baselined +
the new `[structural]`/`[WHCM]` proofs) · `controls/_surface/container-box.css` + `container-box.test.ts` (the HOLD
knob, proven a no-op for the other four `[data-box]` consumers) · `card.md` · `site/pages/card-demo.ts`.

Gates green: `check` (tsc + site) · jsdom 2462 · `test:browser` 714 (Chromium + WebKit) · `size` 22794 / 23552.
**Status: accepted** (Kim ratified, 2026-07-05).

## Amendment 6 — 2026-07-05 (accepted, Kim ratified 2026-07-05) — the scrollbar is HIDDEN; keyboard operability compensates

Amendment 5 (content-is-viewport, gradient-only occlusion via the HOLD) left one tension unresolved: a macOS
**overlay** scrollbar is not a separate compositing layer the mask can exempt — its own ends fade along with
the content it rides over. Kim resolved the either/or (a visible-but-inset bar vs. the running fade) with a
**third option**, verbatim: *"keep native, but hide it."*

- **The scrollbar is HIDDEN, not inset.** `ui-card-content` gets `scrollbar-width: none` (standard/Firefox) +
  `::-webkit-scrollbar { display: none }` (Chromium/WebKit) in scroll mode, both triggers. Native
  `overflow-y: auto` scrolling is **completely unaffected** — only the visible chrome disappears. With no bar
  left to fade, the running see-through fade becomes the region's **sole** scroll affordance — its intended
  job all along, per Kim's original directive.
- **Two prototyped alternatives were rejected first** (a component-review-directed exploration, both engines,
  both real-render pixel-sampled): **`mask-clip`** does not exempt the scrollbar from the mask — it hard-clips
  everything outside its box, so `content-box` deleted the scrollbar entirely rather than keeping it crisp
  (the scrollbar chrome paints outside `content-box`, confirmed by pixel sampling); `padding-box` left it
  fading exactly as before. **`::-webkit-scrollbar-track` inset** (`margin-block`) DID work (WebKit,
  pixel-confirmed: a crisp, genuinely-inset thumb) but trades away the native overlay LOOK fleet-wide for an
  always-visible custom-painted bar — a bigger visual-identity change than Kim asked for. Hiding the bar
  entirely avoids both costs.
- **Keyboard operability (WCAG 2.1.1) is the load-bearing consequence.** A hidden scrollbar removes a
  keyboard user's normal entry point into the region. `card-content.ts` gives `ui-card-content`
  `tabindex="0"` (a real tab stop) + `role="group"` through `internals` whenever it is the scroll viewport —
  REACTIVE, gated on the same `scrollable` signal the fade already tracks (the parent `<ui-card scrollable>`
  keeps its documented read-once-at-connect asymmetry). Where a sibling `ui-card-header` exists,
  `internals.ariaLabelledByElements` best-effort-labels the region by it (a card's header IS its content's
  caption) — feature-detected (`'ariaLabelledByElements' in internals`), since it is a newer `ElementInternals`
  reflection API unsupported in jsdom; a headerless scrollable card gets no name, a documented gap (card.md),
  consistent with the family's existing "unnamed stays generic" ARIA posture (ADR-0014).
- **An EXPLICIT `keydown` handler, not the platform default — a measured call, not a stylistic one.** A
  focused, `tabindex=0`, `overflow:auto` DIV is **not** reliably keyboard-scrollable by the browser's own
  default action across engines: MEASURED (`card.browser.test.ts`) — Chromium scrolled it once genuinely
  trusted-focused (a bare `.focus()` call was insufficient there; a real click was required), but WebKit did
  not move it **at all**, on ArrowDown, PageDown, or End, confirming the exact "Chromium's
  keyboard-focusable-scrollers default is not universal; WebKit lags" risk flagged at design time. Rather than
  gamble on an inconsistent default, `ui-card-content` wires its own handler: `ArrowUp`/`ArrowDown` move 40px,
  `PageUp`/`PageDown` move ~90% of the viewport, `Home`/`End` jump to the extremes — identical px amounts on
  every engine. `event.target === this` guards it from hijacking arrow keys a focused interactive descendant
  owns for its own purpose (e.g. a roving-tabindex control placed inside the content); `preventDefault()` on
  every handled key suppresses whatever the native default action might also attempt, so the increment is
  never doubled.
- **Flagged for Kim's on-device check:** the WebKit default-action gap is measured against Playwright's WebKit
  build, not independently confirmed on Safari proper.
- **The focus ring (ADR-0009) — a delta-review GO-blocker.** The new `tabindex=0` tab stop drew no
  `:focus-visible` ring at all (fleet drift — all 24 other keyboard-focusable controls draw one; WCAG 2.4.7).
  **First draft** (superseded, below) drew the ring directly on `ui-card-content` with the offset **negated**
  (`calc(-1 * var(--ui-focus-ring-offset))`, drawing it INSIDE the border-box) — a positive-offset ring there
  resolved correctly in computed style but painted **nothing visible**, silently clipped by that element's own
  `overflow-y: auto`. **Kim, superseding that draft:** the ring belongs on the **parent `ui-card`** instead —
  `:scope[scrollable]:has(> ui-card-content:focus-visible)` (and the content-signal variant) lets the card
  react to its content region's keyboard-focus state and draw the ring around the whole card. This sidesteps
  the clipping problem entirely rather than working around it: `ui-card` carries no `overflow` of its own, so
  its ring uses the fleet's **standard positive (outward) offset**, identical to every other `:focus-visible`
  consumer (checkbox.css is the fleet reference) — **the negated-offset divergence is REMOVED**, not merely
  documented as a one-off. Verified in-browser, both engines: the `:has()` + `:focus-visible` combination
  resolves correctly on keyboard Tab, the ring paints uncut around the card (including where it crosses beneath
  the overlaid, backgroundless header/footer band), survives `forced-colors` (Chromium CDP-emulated; WebKit
  asserts the non-forced-colors baseline, the documented split), and a mouse click into content draws no ring
  (`:focus-visible` stays keyboard-only).

Repairs: `controls/card/card.css` (the hide rule + the focus-ring rule, now on the card via `:has()`, both
triggers) · `controls/card/card-content.ts` (the reactive tabindex/role/labelling effect + the explicit
keydown handler) · `card.test.ts` (the keyboard-a11y + keydown-arithmetic + disconnect/no-leak jsdom probes) ·
`card-css.test.ts` (the focus-ring CSS-text pin, now asserting the rule on `:scope` via `:has()` with the
STANDARD offset) · `card.browser.test.ts` (the hidden-scrollbar + `[MUST-PROVE]` keyboard + `[ADR-0009]`
focus-ring proofs — keyboard-draws-ring-on-card, not-clipped/standard-offset, mouse-click-no-ring,
forced-colors — both engines) · `card.md`.

Gates green: `check` (tsc + site) · jsdom 2477 · `test:browser` 734 (Chromium + WebKit) · `size` 22949/23552.
**Status: accepted** (Kim ratified, 2026-07-05).

### Amendment 6 refinement — 2026-07-08 (proposed, pending Kim's ratification) — content keeps its INLINE margin

Kim, verbatim + screenshot, after Amendment 6 shipped: *"for contents of `<ui-card-content ...>` do not lose the
default margins."* The image showed content's text sitting ~6px LEFT of the header/footer text — scroll mode's
`margin: 0` on `ui-card-content` (§ Amendment 3/5 above) zeroed **both** axes, but the overlaid header/footer
kept their own 6px region margin (unaffected) — the brackets sat 6px further inset than content, so the two
texts no longer shared a left edge.

**The fix is axis-scoped, not a reversion.** `ui-card-content` now gets `margin-block: 0` (unchanged reasoning:
the flex item's margin box, not just its border box, fills the column, and the block-padding bracket-clearance
formula — `max(band, plain-pad)` — already reserves the exact vertical gutter a present header/footer needs;
`scroll-fade.ts`'s `bandOf()` measures the BRACKET's own rendered size, so a margin restored on content's block
axis would double-stack, not merely be redundant) + `margin-inline: var(--ui-card-region-margin)` (restored —
content is the flex column's CROSS axis, so an inline margin only insets its stretched width, never touching
the block/main-axis sizing at all, and it is what the header/footer's own margin needs matched to align text).

MEASURED, both engines (`card.browser.test.ts`): header/content/footer's own ink (border-box left edge + that
region's own `padding-inline-start`) all resolve to **19px** from the card's outer edge — genuinely coincident,
not merely close — on a short (non-scrolling) card, holding through a genuine mid-scroll re-measurement too
(alignment does not drift once scrolling actually engages). The block gutters the fix must NOT touch (the
existing ~6px top/bottom, Amendment 6 above) are re-proven unchanged in the same mount. A quick visual
screenshot (scratch, not shipped) confirms it beyond the numbers: header/content/footer text lines up on one
left edge.

Repairs: `controls/card/card.css` (the content margin-zeroing leg split into `margin-block: 0` +
`margin-inline: var(--ui-card-region-margin)`) · `card-css.test.ts` (the CSS-text pin updated for the new
declaration shape + a new pin for the restored inline margin) · `card.browser.test.ts` (two new rendered
alignment proofs — short card and mid-scroll).

Gates green: `check` (tsc + site) · jsdom 2478 · `test:browser` 738 (Chromium + WebKit) · `size` 22949/23552
(unchanged). **Status: proposed** — awaiting Kim's ratification.
