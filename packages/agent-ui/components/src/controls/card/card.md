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

attributes:            # attributes-as-API — mirrors card.ts `static props` (the surfaceProps spread; NO flexProps — a card is a grid surface, not a flex line)
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

properties:            # IDL beyond attributes-as-API: the two surface accessors (signal-backed, from UIContainerElement.surfaceProps)
  - name: elevation
    description: The surface elevation axis ('-3'…'3'; signed literal union, 0 = neutral). A tracked signal; repoints the role-pure --ui-container-bg plane (ADR-0015).
  - name: brightness
    description: The surface brightness axis ('-3'…'3'; signed literal union, 0 = neutral). Composites a tonal wash over the elevation plane when both are set (ADR-0015 cl.3).

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
  padding: var(--ui-card-padding)        # ALWAYS 0 (ADR-0046 box-model) — the card itself holds no padding; each region carries its own fixed regionPadding instead
  regionPadding: var(--ui-card-region-pad-inline) / var(--ui-card-region-pad-block)   # 6px inline + 6px block, rem-based (density-INVARIANT) — a CARD-ONLY override of the shared container-box.css ADR-0046 default (12px/4px); repointed on :where(ui-card) itself, modal/select/menu/combo-box are unaffected
  radius: var(--ui-card-radius, var(--ui-radius-base))   # root radius = the shared --ui-radius-base; a nested card decrements one level (ADR-0018)
  nestedRadius: r_child = max(0, r_parent − pad_parent)  # the concentric-corner law, published as --ui-card-child-radius (ONE level; deeper nesting is manual)

forcedColors: A `@media (forced-colors: active)` block keeps the card border visible (CanvasText) and drops the [scroll-fade] mask (a mask over system text harms legibility); the surface itself survives via container.css's role-layer Canvas mapping.
---

# ui-card

`ui-card` is the surface container of the G9 layout family — the **first non-form container with a default
plane**. It `extends UIContainerElement` (the FACE surface base; **not** form-associated), folds the
`elevation` / `brightness` **surface axes** (ADR-0015) into its props, and lays its three region
sub-elements out as a **presence-driven grid**. It carries no native element and renders no wrapper — the
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
not slots): **`ui-card-header`**, **`ui-card-content`**, **`ui-card-footer`**. The card is a grid: the
header takes a top `auto` row, the footer a bottom `auto` row, the content the `1fr` slack. The grid is
**presence-driven** (`:has()`) — an absent region leaves **no phantom row**. All three (and the card) are
`UIContainerElement` subclasses that self-define on import.

`ui-card-header` and `ui-card-footer` reuse the family **leading / label / trailing** host-as-grid anatomy
(`anatomy.md`): a `slot="leading"` adornment in the start cell, the default children as the accessible
label in the `1fr` centre, an optional `slot="trailing"` adornment (a footer's action row, a header's
overflow glyph). Because a card region has no control height, the adornment cells size **intrinsically** —
the grid *structure* is reused, not the control-frame glyph sizing.

`ui-card-content` is the body — plain flow content, no anatomy — and carries two pure-CSS hooks:

- **`scrollable`** → a scrolling viewport (`overflow:auto`; the body's `min-block-size:0` lets the `1fr`
  track shrink below its content). It **requires a constrained card block-size** to bite — give the card a
  `max-block-size` / `height`, or place it in a sized flex/grid parent — otherwise the card just grows.
  (Named `scrollable`, not `scroll`, to avoid shadowing the native `Element.scroll()` method.)
- **`scroll-fade`** → a `mask-image` edge fade (the top/bottom band fades to transparent so scrolled
  content reads as continuing past the edge). The shipped behaviour is a **static symmetric fade** (robust
  on every engine, WebKit included); a scroll-driven refinement (fading only at the *scrollable* edge via
  `animation-timeline: scroll()`) is a noted follow-up.

## Region padding — a card-only 6px override (diverges from ADR-0046)

The card itself holds **no** padding (the box-model law); each region (`ui-card-header` / `ui-card-content` /
`ui-card-footer`) carries a fixed, rem-based (density-**invariant**) region padding instead. Where ADR-0046's
shared model (`container-box.css`, also ridden by `ui-modal` and the `ui-select`/`ui-menu`/`ui-combo-box`
overlay panels) fixes that region padding at **inline 12px / block 4px**, `ui-card` **repoints** the shared
`--ui-box-pad-inline` / `--ui-box-pad-block` tokens to a **uniform 6px inline + 6px block** — on its own
`:where(ui-card)` token block, at specificity 0, so it never leaks into modal/select/menu/combo-box (they
read `container-box.css`'s own 12/4 straight off `[data-box]`; a card is not itself `[data-box]`). This is a
deliberate **divergence from the ADR-0046 region-padding default** for `ui-card` specifically (Kim,
2026-07-04) — the ADR record itself needs an amendment line to note the card exception; this doc + `card.css`
carry the working note in the meantime. A `ui-card-content` has no nested-padding *stepping* law (unlike the
shared `[data-region='content']`/`main` model it diverges from) — a card is never marked `[data-region]`, so
its region padding stays flat at 6px regardless of nesting depth; only the **radius** chain steps one level
(ADR-0018, below).

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

renders with the same inline/block inset a real region would carry (6px/6px) and the same 8px rhythm between
its children. This is a **CSS-only fallback**, not a factory rewrite — the payload tree, the component tree,
and the rendered DOM stay identical; nothing synthetic is inserted. It is `:has()`-driven, so it is
**streaming-safe by construction**: a region child arriving after the fact (a `ui-card-header` streamed in
once the bare body already rendered) flips the fallback off and the presence-driven region grid on, in the
same reflow, with no double padding.

**Mixed composition gets no fallback.** A card that already has a region child PLUS loose siblings (`<ui-card>
<ui-card-content>…</ui-card-content><div>…</div></ui-card>`) is not touched — a region present means the
author owns the structure; the loose sibling renders at the plain box-model default. This is documented
behaviour, not a bug to repair.

**The fallback is mercy, not parity.** Sticky header/footer and `scrollable`/`scroll-fade` content are
capabilities of the real region sub-elements — the fallback cannot give a bare card sticky edges or a scroll
viewport. Reach for `ui-card-header` / `ui-card-content` / `ui-card-footer` whenever the card needs those; the
fallback exists only to keep the default humane, not to replace the taught idiom.

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
