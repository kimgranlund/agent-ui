---
# card.md frontmatter — the attributes-as-API descriptor for the ui-card FAMILY (ADR-0004). The
# machine-checkable surface lives HERE (frontmatter); the prose below the fence is the /site doc. The
# `attributes[]` block mirrors card.ts `static props` (the ...UIContainerElement.surfaceProps spread —
# elevation/brightness) — the contract↔props trip-wire (card-descriptor.test.ts) targets this fence. The
# region sub-elements (ui-card-header/-content/-footer) are documented in the prose body + parts/childModel
# notes; the surface axes per ADR-0015, the one-level nested radius per ADR-0018, the host-as-grid per anatomy.md,
# the region-less humane default (a bare card gets region-equivalent padding) per ADR-0056.
tag: ui-card
tier: container         # geometry size-class (Container/layout band — spacing off --ui-space × density, NO control height; geometry.md)
extends: UIContainerElement  # the FACE container surface base (NOT form-associated; ADR-0015 / ADR-0016)
# marginal: ui-card adds 146 B gz (723 B min) to the self-defining ui-* family (the delta of `npm run size`'s components barrel with vs. without this control's export, tree-shaken — the card family: ui-card + ui-card-header/-content/-footer) — within the per-control ≤ ~2 kB tier budget (plan §10); the family total stays gated each run by `npm run size` (scripts/measure-size.mjs)

attributes:            # attributes-as-API — mirrors card.ts `static props` (the surfaceProps spread + the `scrollable` scroll-mode signal; NO flexProps — a card is a block-flow surface, and the scroll viewport itself in scroll mode)
  - name: elevation
    type: enum
    values: [0, 1, 2, 3, -1, -2, -3]   # the scheme-INVERTING plane (--md-sys-color-neutral-surface-{lowest…highest}); 0 = the neutral base
    default: 0
    reflect: true      # reflects so container.css's [elevation=n] surface repoint applies to JS-set values too
  - name: brightness
    type: enum
    values: [0, 1, 2, 3, -1, -2, -3]   # the scheme-CONSISTENT tonal shift (--md-sys-color-neutral-surface-{dimmest…brightest} / the composition wash); 0 = no shift
    default: 0
    reflect: true      # reflects so container.css's [brightness=m] repoint applies to JS-set values too
  - name: scrollable
    type: boolean
    default: false
    reflect: true      # the scroll-mode hook — <ui-card scrollable> switches the shell to a flex column (header/content/footer); an author-written [scroll-wrapper] child of ui-card-content becomes the real viewport, else the CARD itself is the fallback viewport (a <ui-card-content scrollable> region — the A2UI CardContent.scrollable signal — triggers the same, REVISED 2026-07-06 the wrapper model)

properties:            # IDL beyond attributes-as-API: the two surface accessors (signal-backed) + the scroll signal
  - name: elevation
    description: The surface elevation axis ('-3'…'3'; signed literal union, 0 = neutral). A tracked signal; repoints the role-pure --ui-container-bg plane (ADR-0015).
  - name: brightness
    description: The surface brightness axis ('-3'…'3'; signed literal union, 0 = neutral). Composites a tonal wash over the elevation plane when both are set (ADR-0015 cl.3).
  - name: scrollable
    description: The scroll-mode signal (boolean). `<ui-card scrollable>` switches the shell to a flex column (header/content/footer) — the WRAPPER MODEL (REVISED 2026-07-06). An author-written `[scroll-wrapper]` child of ui-card-content becomes the real `overflow-y:auto` viewport; absent one, the CARD itself is the fallback viewport (the prior, 2026-07-05, behaviour). Either way an AUTOMATIC edge-fade mask paints on ui-card-content (never the card or its sticky header/footer). Also triggerable by marking the content region `[scrollable]` (the A2UI CardContent.scrollable mapping) — that content signal is the fully-reactive form; the ergonomic `<ui-card scrollable>` arms the fade mask at connect, so toggle scroll at runtime via the content region. Needs a constrained card block-size to bite.

events: []             # a card is a static surface container — it raises no events

slots:                 # leading/label/trailing name the host-as-grid POSITIONS of the header/footer regions (anatomy.md); the regions themselves are ChildList sub-elements (see parts/childModel)
  - name: leading
    optional: true
    description: Optional leading adornment of a ui-card-header / ui-card-footer — a light-DOM `[slot="leading"]` child in the region's start cell (presence-driven host-as-grid, anatomy.md). Commonly an icon/avatar; mark decorative glyphs aria-hidden.
  - name: label
    optional: false
    description: The default/unnamed children of a header/footer — the accessible content filling the 1fr centre cell (an explicit `slot="label"` is equivalent). A header's label is its title (+ an optional secondary line the author structures).
  - name: trailing
    optional: true
    description: Optional trailing adornment of a header/footer — a light-DOM `[slot="trailing"]` child in the end cell (a status glyph, a unit, or a footer action row). Layout only; decorative glyphs aria-hidden.

parts: []              # the card creates NO control-owned [data-part] nodes (render() stays void); its content model is the region SUB-ELEMENTS (childModel ChildList — ui-card-header/-content/-footer), documented in the prose

customStates: []       # a card has no interaction states (no :state() hooks — it is a static surface)

face:
  formAssociated: false  # a container contributes nothing to a form — NOT form-associated (no value/validity; ADR-0015)

aria:
  role: group (opt-in)   # a card with an accessible name reads as ARIA `group` via internals; an UNNAMED card has no role (a generic container)
  roleSource: internals (when named)   # set THROUGH ElementInternals at connect — NEVER a host role attribute (the family discipline)
  labelSource: aria-label / aria-labelledby   # author-supplied accessible name; its presence opts the card into role=group
  childModel: ChildList — ui-card-header / ui-card-content / ui-card-footer sub-elements (regions = sub-elements; SPEC-R3/R4)

keyboard: []           # a card is not interactive — no keyboard contract (interactive content is the agent's own controls inside it)

geometry:
  sizeClass: container   # Container/layout — spacing off --ui-space × density; a card has NO control height (never reads --ui-height-*)
  padding: var(--ui-card-padding)        # ALWAYS 0 (ADR-0046 box-model) — the card itself holds no padding; each region carries its own fixed regionPadding + regionMargin instead
  regionPadding: var(--ui-card-region-pad-inline) / var(--ui-card-region-pad-block)   # 12px inline + 6px block, rem-based (density-INVARIANT) — REVISED 2026-07-04: card now reads container-box.css's shared ADR-0046 defaults straight (the card-only 6px override is rescinded); identical to modal/select/menu/combo-box
  regionMargin: var(--ui-card-region-margin)   # 6px uniform inset margin around each region (REVISED 2026-07-04: regions are no longer full-bleed). The DEFAULT (non-scroll) shell is BLOCK FLOW (flow-root, not grid/flex, per Kim's "containers should not use grid or flex"), so adjacent region margins COLLAPSE to a clean 6px gutter and the 1px frame border blocks collapse-through at the edges — one uniform margin, no grid gap or first/last split. SCROLL MODE (REVISED 2026-07-06, the wrapper model) is a flex column instead — flex items never margin-collapse, so there the SAME 6px rhythm comes from `gap` + the flex container's own `padding`, not this margin (zeroed in that mode)
  radius: var(--ui-card-radius, var(--ui-radius-base))   # root radius = the shared --ui-radius-base; a nested card decrements one level (ADR-0018)
  nestedRadius: r_child = max(0, r_parent − pad_parent)  # the concentric-corner law, published as --ui-card-child-radius (ONE level; deeper nesting is manual). REVISED 2026-07-04: pad_parent is now 12px (was the card-only 6px override) — with the default --ui-radius-base of 12px, an unreseeded root card's inner radius now floors at EXACTLY 0 (a knife-edge, not the old 6px-positive headroom); reseed --ui-card-radius larger than 12px for a visibly rounded nested corner

forcedColors: A `@media (forced-colors: active)` block keeps the card border visible (CanvasText); the shared container-box.css `[data-fade-top]`/`[data-fade-bottom]` rule drops the scroll-fade mask generically (a mask over system text harms legibility) — the surface itself survives via container.css's role-layer Canvas mapping.
---

# ui-card

`ui-card` is the surface container of the G9 layout family — the **first non-form container with a default
plane**. It `extends UIContainerElement` (the FACE surface base; **not** form-associated), folds the
`elevation` / `brightness` **surface axes** (ADR-0015) into its props, and stacks its three region
sub-elements in **plain block flow** (a `flow-root` BFC — *not* grid/flex, per Kim's "containers should not
use grid or flex; let contents space themselves"). It carries no native element and renders no wrapper — the
agent's light-DOM regions are the content.

```html
<ui-card>
  <ui-card-header>Account<span slot="trailing" aria-hidden="true">⋯</span></ui-card-header>
  <ui-card-content>Body copy…</ui-card-content>
  <ui-card-footer><button slot="trailing">Save</button></ui-card-footer>
</ui-card>

<ui-card elevation="1">A raised card</ui-card>
<ui-card aria-label="Summary">A named card — reads as an ARIA group</ui-card>
```

## The region sub-elements (regions = sub-elements)

A card composes three **region sub-elements** as a `ChildList` (the ratified "regions = sub-elements",
not slots): **`ui-card-header`**, **`ui-card-content`**, **`ui-card-footer`**. The shell is **block flow**:
the three regions stack in normal document order, each floating inside the frame on a uniform 6px inset
margin (the margins *collapse* in the BFC to a clean 6px gutter). Presence is handled **for free** — an
absent region simply contributes **no box** (no grid track to null out, no `:has()` row template). All three
(and the card) are `UIContainerElement` subclasses that self-define on import.

`ui-card-header` and `ui-card-footer` reuse the family **leading / label / trailing** host-as-grid anatomy
(`anatomy.md`) — this is the one place grid remains, *inside* a region, because end-alignment of the
trailing cell genuinely needs it (the rule stops at the shell): a `slot="leading"` adornment in the start
cell, the default children as the accessible label in the `1fr` centre, an optional `slot="trailing"`
adornment (a footer's action row, a header's overflow glyph). Because a card region has no control height,
the adornment cells size **intrinsically** — the grid *structure* is reused, not the control-frame glyph sizing.

`ui-card-content` is the body — plain flow content, no anatomy. It also carries the **edge-fade mask** (below),
in **both** scroll shapes.

### Scroll mode — the WRAPPER MODEL (REVISED 2026-07-06, Kim ratified via `/intent-extract`)

**`<ui-card scrollable>`** (or a `[scrollable]` content region — the A2UI-mapped `CardContent.scrollable`
signal — either triggers it) puts the card into scroll mode: the shell switches to a **flex column** — header
(auto) / content (`1fr`, fills the space between them) / footer (auto). It **requires a constrained card
block-size** to bite — give the card a `max-block-size` / `height`, or a bounded flex/grid parent. (Named
`scrollable`, not `scroll`, to avoid shadowing the native `Element.scroll()` method.) What actually scrolls
depends on whether the agent wrote a `[scroll-wrapper]` child:

```html
<ui-card scrollable style="max-block-size: 20rem">
  <ui-card-header>Title</ui-card-header>
  <ui-card-content>
    <span scroll-wrapper>…long body…</span>
  </ui-card-content>
  <ui-card-footer>Footer stays put</ui-card-footer>
</ui-card>
```

- **`[scroll-wrapper]` present (the recommended shape)** — a bare styling-hook **attribute**, element-agnostic
  (`span`/`div`), **author-written** and **never auto-injected** (an A2UI `CardContent.scrollable` payload stays
  a straight positional payload≡DOM mapping — the wrapper is an opt-in an agent adds, not something the renderer
  synthesizes). This wrapper — nested **two levels below** the header/footer — becomes the **real**
  `overflow-y:auto` scroll viewport. `ui-card-content` itself becomes a **fixed flex frame** around it (never
  scrolling) that carries the edge-fade mask.
- **`[scroll-wrapper]` absent — the FALLBACK shape** — degrades gracefully (not an error) to the **prior**
  (2026-07-05) behaviour: the **card itself** is the scroll viewport (`overflow-y:auto`), with `ui-card-content`
  flowing inside it exactly as before. Reach for this only when the wrapper isn't worth the extra markup; it
  carries the fade-only-at-the-scroll-extremes limitation documented below.

Detection **self-heals**: declarative HTML and A2UI always have the wrapper present (if at all) by connect time,
but an imperative caller may `append()` it *after* the card has already connected — a childList
`MutationObserver` on `ui-card-content` (`card-content.ts`, mirrors `ui-text`'s own `#heal`) re-detects the
wrapper on every mutation and re-wires the fade only on a genuine presence flip, so the late-append path arms
correctly too.

The **edge-fade mask is AUTOMATIC** in scroll mode, in **either** shape — no opt-in prop. `traits/scroll-fade.ts`
(wired from `card-content.ts`) always **paints** `data-fade-top`/`data-fade-bottom` on `ui-card-content`, but
**measures** whichever element actually scrolls (the wrapper, or the card as the fallback) — the shared
`container-box.css` mask rules read the flags on content. It is **edge-aware** (only the edge that genuinely
hides content fades) and **self-gates on real overflow**. The trait's presence-aware offsets
(`--ui-box-head`/`--ui-box-foot`) always measure the **card's** sticky header/footer bands (regardless of which
shape is in play, since header/footer are always the card's own direct children) and are published on
`ui-card-content`, so the fade formula ramps past a present bracket. The sticky header/footer **never carry the
mask at all and stay fully crisp at every scroll position, in either shape** (verified cross-engine).

> **Why the wrapper fixes the flagged consequence (measured cross-engine, Chromium + WebKit, both 2026-07-05 and
> 2026-07-06):** `mask-image` paints relative to the masked element's *own* border-box (0%–100% of its height).
> Under the **FALLBACK** shape, `ui-card-content` is both the masked element *and* the thing being scrolled — its
> "full height" is the entire un-clipped scroll extent, so for content genuinely taller than roughly
> 2×(bracket band + fade depth), the visible fade only appears within the first/last ~60–90px of the *total*
> scroll range; through the middle of a long scroll, text is cut hard at the header/footer boundary with no
> visible fade. Under the **WRAPPER** shape, `ui-card-content` is masked but **never scrolls** — its "full
> height" *is* the small, fixed, currently-visible frame (the space between header/footer), so the identical
> 0%–100% gradient is genuinely viewport-registered and stays visible through the **whole** scroll, at any
> content length (screenshotted + measured cross-engine — `card.browser.test.ts`'s `[MUST-PROVE]` leg). The
> header/footer crispness holds regardless of which shape is used — only the fade's *visibility through the
> middle of a long scroll* differs.

The sticky brackets carry **no background** (Kim, 2026-07-05): in the wrapper shape content scrolls inside the
wrapper and never passes under a bracket, so none is needed; in the no-wrapper fallback shape (where the card
itself scrolls under them) content will show through — the degraded path accepts the see-through, the wrapper
shape is the occlusion-clean one. The fade is deliberately JS-driven (not `animation-timeline: scroll()`) — a
handful of scroll-position comparisons, robust on every engine including WebKit.

> Cosmetic (not chased): in the wrapper shape, the mask sits on `ui-card-content`, one box out from the
> `[scroll-wrapper]` that actually scrolls — it clips the wrapper's own scrollbar ends too, not just its content.
> Negligible at the fade depth (a handful of px); flag it if it ever becomes visually material.

**Sticky-footer-fill, for free:** `ui-card-content` is always `flex: 1 1 auto` in scroll mode (replacing the
short-lived `min-block-size: 100%` percentage recipe, which had a flagged side effect — it *always* overflowed
a short card by the header+footer's own height, since the fill target was the card's *full* height with
header/footer occupying *additional* flow height on top of that). `flex-grow` gives a **short** content region
the SAME fill (a short body no longer strands the footer mid-viewport) *without* that side effect — flex-grow
only adds *leftover* positive space, never forcing height beyond content's own natural size — so a genuinely
short scrollable card no longer force-overflows at all (measured; `card.browser.test.ts`'s `[fixed]` leg).
Genuinely **tall** content in the fallback shape hits flex-shrink's default floor at its own natural height, so
the card's own bound + `overflow-y:auto` still catches the overflow, unchanged from the prior revision.

Flex items never margin-collapse (unlike the default block-flow BFC) — scroll mode therefore zeroes each
region's own margin and reproduces the identical 6px rhythm with `gap` (between items) + the flex container's
own `padding` (frame↔first/last-item). The sticky header/footer's `inset-block-*` is `0`, not
`--ui-card-region-margin` — the frame↔bracket 6px gutter now comes from that same container `padding`, and an
*additional* 6px inset would double-stack to a rendered 12px once the bracket is actually stuck (a load-bearing
fix, measured cross-engine).

> The bottom gutter is robust across engines (the fallback shape, where the card itself scrolls): with a
> footer, the sticky footer holds a 6px gutter through scroll; without one, the last region's OWN
> `padding-block-end` (inside its border-box → always in the scroll extent) keeps content off the card edge —
> not a scroll-container last-child *margin*, which WebKit historically dropped from the extent.

## Region padding + margin — the shared model, uniform across the family (ADR-0046, revised 2026-07-04)

The card itself holds **no** padding (the box-model law). Each region (`ui-card-header` / `ui-card-content` /
`ui-card-footer`) now reads the **shared** `container-box.css` region model straight — **inline 12px / block
6px** padding, plus a **6px inset margin** — identical to `ui-modal` and the `ui-select`/`ui-menu`/`ui-combo-box`
overlay panels. (An earlier card-only 6px-inline override, and a full-bleed-region default, are both **rescinded**
by this revision — one spacing vocabulary across the whole container family, restoring ADR-0046's original intent.)

A region is **inset**, not full-bleed: it floats inside the card frame with a uniform 6px gutter (frame↔region
and region↔region alike). `ui-card` is now `display: flow-root` (plain block flow, matching
`container-box.css`'s flow-root BFC) — so **one uniform `margin` on every region** is all it takes: adjacent
region margins *collapse* against each other (6px + 6px → a single 6px gutter), and the card's 1px frame border
blocks collapse-through at the outer edges so the frame↔region gutter is exactly 6px too. No grid row-gap, no
first/last-child edge-margin split — an absent region simply contributes no box (presence-driven for free), and
every gutter reconciles to 6px, never 12 (proven in `card.browser.test.ts`).

A region that paints a fill now rounds **all four** of its own corners to the card's decremented
`--ui-card-inner-radius` (the same concentric value a nested card reads) — it no longer meets the card's outer
edge, so clipping to the outer radius (the old full-bleed behaviour) would look oversized/mismatched.

A `ui-card-content` has no nested-padding *stepping* law (unlike the shared `[data-region='content']`/`main`
model) — a card is never marked `[data-region]`, so its region padding stays flat at 12px/6px regardless of
nesting depth; only the **radius** chain steps one level (ADR-0018, below).

**A flagged consequence:** removing the card-only 6px-inline override means the nested-radius chain now
decrements against 12px (was 6px). With the default `--ui-radius-base` of 12px, an **unreseeded root card's**
inner radius now floors at **exactly 0** (12 − 12), not the old 6px-positive headroom — an author who wants a
visibly rounded nested corner needs to reseed `--ui-card-radius` larger than 12px.

## The region-less humane default (ADR-0056)

A `ui-card` with **no region child** (no `ui-card-header` / `ui-card-content` / `ui-card-footer`) applies
region-equivalent padding + content rhythm to its own box, so a bare-children card reads as **padded** rather
than the box-model's zero-padding default:

```html
<ui-card>
  <p>First</p>
  <p>Second</p>
</ui-card>
```

renders with the same OWN-ink padding a real region's padding would carry (12px/6px, was 6px/6px under the
rescinded card-only override) and the same 8px rhythm between its children. (It mirrors a region's padding
only, not its separate 6px positional margin, which a bare card's single flattened box has no equivalent layer
for.) This is a **CSS-only fallback**, not a factory rewrite — the payload tree, the component tree,
and the rendered DOM stay identical; nothing synthetic is inserted. It is `:has()`-driven, so it is
**streaming-safe by construction**: a region child arriving after the fact (a `ui-card-header` streamed in
once the bare body already rendered) flips the fallback off and lets the region take its place as a normal
block-flow box, in the same reflow, with no double padding.

**Mixed composition gets no fallback.** A card that already has a region child PLUS loose siblings (`<ui-card>
<ui-card-content>…</ui-card-content><div>…</div></ui-card>`) is not touched — a region present means the
author owns the structure; the loose sibling renders at the plain box-model default. This is documented
behaviour, not a bug to repair.

**The fallback is mercy, not parity.** Scroll mode (sticky header/footer bracketing the scrolling card, with
its automatic edge fade) is a capability of the real region sub-elements — the fallback
cannot give a bare card sticky brackets. Reach for `ui-card-header` / `ui-card-content` /
`ui-card-footer` whenever the card needs those; the fallback exists only to keep the default humane, not to
replace the taught idiom.

## Surface — elevation × brightness

`elevation` (the scheme-**inverting** plane) and `brightness` (the scheme-**consistent** tonal shift) are
signed literal-union props (`'-3'…'3'`, `0` = the neutral base) inherited from `UIContainerElement`. They
repoint the role-pure `--ui-container-bg` / `--ui-container-tint` seam in
`controls/_surface/container.css` (the family surface mapping); a card reads **no** colour role directly.
The base seam defaults to `transparent`, so a card seeds its **own** default
`--ui-container-bg: var(--md-sys-color-neutral-surface)` — an un-elevated card still reads as a surface. `0` in either
axis leaves the neutral plane unchanged.

## Nested radius — one level (ADR-0018)

Concentric rounded rectangles need the inner radius to shrink with nesting: the **concentric-corner law**
is `r_child = max(0, r_parent − padding_parent)`. A root `ui-card` rounds to the shared `--ui-radius-base`;
a card publishes its inner radius to descendants as `--ui-card-child-radius`, and a **nested** card (inside
a `ui-card-content`) reads it for its own radius — **one level**, pure CSS, no JS observer. The normal
nesting is **card › ui-card-content › card**. A card placed as a *direct* child of **another card** (no region
wrapper between — regardless of whether the outer card is bare or region-bearing) is the **depth-≥2 manual
case**: the direct-child card matches both `:where(ui-card)` (declaring its own inner radius) and its parent's
publish rule (setting `--ui-card-child-radius` directly on it) — a genuine multi-property CSS cycle that
collapses its radius to `0`. Set an explicit `border-radius` on the nested card to reseed the chain. **The
ADR-0056 region-less fallback does not change this** — it only ever sets padding/gap, never the radius chain,
so direct nesting stays the pre-existing manual case whether or not the outer card is bare. (The JS
arbitrary-depth controller was rejected — ADR-0018.)

## Accessibility

ARIA is **minimal and opt-in** (the widgets-not-elements posture): a card with an author-supplied
accessible name (`aria-label` / `aria-labelledby`) reads as an ARIA **`group`** set through `internals`
(**never** a host `role` attribute); an unnamed card is a generic container with no role. A region's
adornment glyphs are decorative — mark them `aria-hidden` so the region's label stays the accessible name.
A card itself is not interactive; interactive content is the agent's own controls placed inside it.
