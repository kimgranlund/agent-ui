# LLD — `ui-swiper` family (`ui-swiper` · `ui-swiper-item` · `ui-swiper-pagination` · `ui-swiper-paddles` · `ui-swiper-label`)

> Refines: [`../spec/swiper-family.spec.md`](../spec/swiper-family.spec.md) (SPEC-R1…R14) under
> [ADR-0124](../adr/0124-swiper-family-scroll-snap-loop.md) (proposed; every fork as recommended). Build
> plan: [`../decompositions/swiper-family.decomp.json`](../decompositions/swiper-family.decomp.json)
> (coverage-clean, plan mode). · proposed · 2026-07-10 · planner
>
> **Composes on:** `UIContainerElement` (surface axes + reused protected `internals`) for `ui-swiper` — the
> `ui-tabs` base — and `UIElement` for the four leaf tags. **No new package**: one control folder,
> `controls/swiper/`. The fleet's FIRST scroll-snap surface — the track's positioning is CSS, the coordinator
> owns only clone/teleport/wiring/announcement. Catalog work is two `catalog.json` rows + three
> `EXCLUSION_ALLOWLIST` entries (LLD-C12).
>
> **Freeze discipline.** §3's interfaces are the fan-out contract. A builder who cannot satisfy one STOPS and
> escalates — the fix is a coordinated LLD repair (an ADR amendment), never a local deviation. §11 is the
> frozen-interface-vs-real-code check every named API passed.

## 1 · Intent

Realize SPEC-R1…R14: a scroll-snap carousel family. `ui-swiper` builds a scroll track, drives optional
author-placed chrome, runs a clone-teleport infinite loop, and exposes a bindable `active` selection; the
four leaf tags are the slide and the three chrome anchors.

## 2 · Layout & files (one writer per file)

```
packages/agent-ui/components/src/controls/swiper/
  swiper.ts              LLD-C1/C2/C3/C5/C6/C7 — UISwiperElement (coordinator): props, track, loop, keyboard, events, chrome drive
  swiper-item.ts         LLD-C4 — UISwiperItemElement (slide)
  swiper-pagination.ts   LLD-C9 — UISwiperPaginationElement (dots/fraction anchor)
  swiper-paddles.ts      LLD-C10 — UISwiperPaddlesElement (prev/next anchor)
  swiper-label.ts        LLD-C11 — UISwiperLabelElement (accessible-name anchor)
  swiper.css             LLD-C8 — @scope track/slide/chrome geometry + scroll-snap + reduced-motion
  swiper.md              swiper descriptor (primary)
  swiper-item.md · swiper-pagination.md · swiper-paddles.md · swiper-label.md   per-element descriptors
  *.test.ts · *.browser.test.ts   the probe sets
```

`swiper.ts` imports the four leaf modules (registering all five tags), so the barrel needs only
`export * from './swiper/swiper.ts'` (the `ui-tabs` precedent).

**Component ids (LLD-C1…C12 — the requirement→component spine the SPEC Trace binds to):**

| id | Component | Section · file |
|---|---|---|
| LLD-C1 | `ui-swiper` identity + parts + carousel-region ARIA | §3.2 · §8 · `swiper.ts` |
| LLD-C2 | `ui-swiper` props schema | §3.2 · `swiper.ts` |
| LLD-C3 | the owned scroll track + native gestures | §3.2 · `swiper.ts`/`swiper.css` |
| LLD-C4 | `ui-swiper-item` | §3.1 · `swiper-item.ts` |
| LLD-C5 | the infinite loop (clone-teleport + loop a11y) | §5 · `swiper.ts` |
| LLD-C6 | keyboard + focus safety | §6 · `swiper.ts` |
| LLD-C7 | bindable `active` + `select` commit | §4 · `swiper.ts` |
| LLD-C8 | geometry, tokens, whole-shape, reduced-motion | §7 · `swiper.css` |
| LLD-C9 | `ui-swiper-pagination` drive | §3.3 · §9 · `swiper-pagination.ts` |
| LLD-C10 | `ui-swiper-paddles` drive | §3.3 · §9 · `swiper-paddles.ts` |
| LLD-C11 | `ui-swiper-label` + region-label wiring | §3.3 · §9 · `swiper-label.ts` |
| LLD-C12 | catalog rows + `EXCLUSION_ALLOWLIST` | §11 · a2ui catalog |

Descriptor fidelity (SPEC-R16) is cross-cutting (§10), realized per element, not a numbered component.

## 3 · Frozen class interfaces

### 3.1 `ui-swiper-item` — the slide (LLD-C4)

```ts
import { UIElement } from '../../dom/element.ts'
import { prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'

const props = {
  value: { ...prop.string(), reflect: true }, // stable slide identity for `active`; '' ⇒ real index
} satisfies PropsSchema

export interface UISwiperItemElement extends ReactiveProps<typeof props> {}
export class UISwiperItemElement extends UIElement {
  static props = props
  /** Applied BY the coordinator (a sibling cannot set another element's protected internals): role=group,
   *  aria-roledescription='slide', aria-label='{n} of {realCount}'. Set on the REAL item only. */
  labelAs(position: string): void   // internals.role='group'; internals.ariaRoleDescription='slide'; internals.ariaLabel=position
  protected connected(): void       // no self-driven ARIA; the coordinator owns labelling (it holds the real/clone/count truth)
}
```

`labelAs` is a public method the coordinator calls (the `ui-tab.link()` precedent — a method that mutates
this element's own protected internals from a coordinator command). `internals` is `protected` on the base,
so the coordinator cannot reach into it directly; the method is the seam.

### 3.2 `ui-swiper` — the coordinator (LLD-C1/C2/C3/C5/C6/C7)

```ts
import { UIContainerElement } from '../../dom/container.ts'
import { prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import { UISwiperItemElement } from './swiper-item.ts'
import { UISwiperPaginationElement } from './swiper-pagination.ts'
import { UISwiperPaddlesElement } from './swiper-paddles.ts'
import { UISwiperLabelElement } from './swiper-label.ts'

const ORIENTATIONS = ['horizontal', 'vertical'] as const
const ALIGNMENTS = ['start', 'center', 'end'] as const

const props = {
  ...UIContainerElement.surfaceProps,                              // elevation/brightness (ADR-0015)
  orientation:     { ...prop.enum(ORIENTATIONS, 'horizontal'), reflect: true },
  'slides-in-view':{ ...prop.string(), reflect: true },            // '' ⇒ responsive-auto; numeric string pins columns
  align:           { ...prop.enum(ALIGNMENTS, 'start'), reflect: true },
  loop:            { ...prop.boolean(), reflect: true },
  duration:        { ...prop.string(), reflect: true },            // '' ⇒ token default; CSS <time>
  easing:          { ...prop.string(), reflect: true },            // '' ⇒ token default; CSS easing
  pagination:      { ...prop.boolean(), reflect: true },           // stamp default dots anchor if none present
  paddles:         { ...prop.boolean(), reflect: true },           // stamp default paddles anchor if none present
  active:          { ...prop.string(), reflect: true },            // bindable active-slide identity (ADR-0019; commit path = LLD-C7)
} satisfies PropsSchema

export interface UISwiperElement extends ReactiveProps<typeof props> {}
export class UISwiperElement extends UIContainerElement {
  static props = props

  get slides(): UISwiperItemElement[]       // REAL items only (clones excluded), DOM order
  get activeIndex(): number                 // resolved real index (the #resolveIndex result)
  next(): void                              // advance one slide (wraps in loop mode)
  prev(): void                              // retreat one slide (wraps in loop mode)
  goTo(index: number): void                 // scroll a real index into the align position via a rAF scroll animation over --ui-swiper-duration/easing (§7); instant under reduced-motion + for the loop teleport

  protected connected(): void               // build parts once; capture slides; loop setup; wire chrome; listeners; effect
}
```

Attribute-name props with a hyphen (`slides-in-view`) are declared with the quoted key; the accessor is
reached as `this['slides-in-view']` (the fleet's props system keys accessors by the declared name). The
`String` codec crosses the attribute boundary faithfully; `''` is the responsive-auto sentinel read in CSS.

Internal state (private): `#track`, `#live`, `#slides: UISwiperItemElement[]`, `#leadingClones`,
`#trailingClones`, `#activeIndex`, `#scrollHandler`, `#resizeObserver`, `#teleporting` (re-entrancy guard),
`#baseId`. The ARIA element-reflection helper `reflectAriaElements(internals, name, elements)` is **not a
shared fleet export** — it is a module-private 3-line peer copy redefined in each folder (`tab.ts:24`,
`tab-panel.ts:19`, `form.ts:120`); `swiper.ts` ships its own 4th peer copy (no import).

`connected()` order: `#ensureParts()` (idempotent track + live region) → capture real slides → apply the
region's own internals (`this.internals.role = 'region'`, `this.internals.ariaRoleDescription = 'carousel'`;
label via `#applyRegionLabel()`) → `#rebuildLoop()` (clones, if `loop`) → `#labelSlides()` → `#driveChrome()`
→ `this.listen(this.#track, 'scroll', this.#onScroll, { passive: true })` + `this.listen(this, 'keydown',
this.#onKeydown)` → the `active` effect (`this.effect(() => this.#applyActive())`) → arm `:state(ready)` one
frame past paint (`requestAnimationFrame(() => this.internals.states?.add('ready'))`, the `ui-tabs`
motion-gate precedent). A `MutationObserver` on the host child list rebuilds clones + re-labels + re-drives
chrome when the author adds/removes slides.

### 3.3 `ui-swiper-pagination` (LLD-C9) · `ui-swiper-paddles` (LLD-C10) · `ui-swiper-label` (LLD-C11)

```ts
// swiper-pagination.ts
const PAGINATION_TYPES = ['dots', 'fraction'] as const
const props = { type: { ...prop.enum(PAGINATION_TYPES, 'dots'), reflect: true } } satisfies PropsSchema
export class UISwiperPaginationElement extends UIElement {
  static props = props
  /** Coordinator command — render `count` indicators (or the 'n / count' fraction) and mark `active`.
   *  onSelect(i) is the coordinator's goTo. */
  renderInto(count: number, active: number, onSelect: (i: number) => void): void
}

// swiper-paddles.ts — no props; the coordinator fills two composed ui-buttons and wires prev/next.
export class UISwiperPaddlesElement extends UIElement {
  static props = {} satisfies PropsSchema
  fill(onPrev: () => void, onNext: () => void, orientation: 'horizontal' | 'vertical'): void
}

// swiper-label.ts — no props; author text is the accessible name. The coordinator reads its id (assigning one
// if absent) and points the region's aria-labelledby at it via internals element-reflection.
export class UISwiperLabelElement extends UIElement { static props = {} satisfies PropsSchema }
```

Each leaf self-defines with the idempotent guard `if (!customElements.get('ui-swiper-…'))
customElements.define(…)`. The empty-schema (`{} satisfies PropsSchema`) is the `ui-form-provider` /
`ui-toast-region` precedent (an `attributes: []` descriptor).

## 4 · The `active` effect + selection (LLD-C7)

`#resolveIndex()` mirrors `ui-tabs`: `''` ⇒ 0; a real item whose `value` equals `active` wins; else a numeric
in-range index; else 0. `#applyActive()` (inside `this.effect`) reads `this.active` (tracked), resolves the
real index, and `goTo(index)` if the track is not already there. A user gesture (scroll settle / paddle / dot
/ key) calls `#commit(index)`: eager-set `#activeIndex`, write `this.active = identity` (reflects + wakes the
effect), and `this.emit('select', { value: identity, index })` **only when the real index changed** — so the
renderer's own two-way write (ADR-0019) never echoes. `identity` = the item's `value` or `String(index)`.

## 5 · The infinite loop — clone-teleport (LLD-C5, SPEC-R10/R11)

- **Clone band size** `k = ceil(slidesInView) + 1` (read from the computed `--ui-swiper-columns`, the
  prior-art `#getColumns` pattern). `#rebuildLoop()` (loop only): deep-clone the last `k` real slides →
  prepend; deep-clone the first `k` → append. Each clone: `cloneNode(true)`, **`removeAttribute('id')` on the
  clone and every descendant** (no duplicate ids), `setAttribute('aria-hidden', 'true')`, `inert = true`,
  `dataset.swiperClone = ''`. Clones are excluded from `get slides` (filtered by the absence of the clone
  marker).
- **Initial position** — scroll the first real slide to the align position without animation
  (`scroll-behavior: auto`) so the leading clones sit off-viewport at start.
- **Teleport** — `#onScroll` (passive) computes the settled snap index across the *full* track (clones
  included). When the settled index falls in the leading clone band, set `#teleporting`, jump the scroll
  offset forward by exactly the real-set extent (the distance from the first-real to first-trailing-clone
  snap target) with `scroll-behavior: auto`, then clear `#teleporting` on the next frame; symmetric for the
  trailing band. The jump lands on the pixel-identical real slide → seamless (SPEC-R10).
  - **No double-`select` at the seam — the primary guard is the changed-index test, not the flag.** On the
    clone-band settle the coordinator eager-sets `#activeIndex` to the settled slide's **real-twin** index
    *before* the teleport; the post-teleport scroll then settles on that same real index → `#commit`'s
    emit-only-when-`changed` (§4) sees `changed === false` → no emit. `#teleporting` is a *secondary* guard
    (it also suppresses any interim scroll-event handling during the jump); a builder must not rely on the
    flag's frame-timing alone — the changed-index test is what makes double-emit impossible.
- **Announcement** — after settle (debounced to the snap end), `#activeIndex` = the REAL index of the
  settled slide (a clone maps to its real twin by `k`-offset arithmetic); the `[data-part=live]` region text
  is set to `Slide {realIndex+1} of {realCount}` (SPEC-R11). Paddles never disable in loop mode.
- **Non-loop** — no clones; `next/prev` clamp at `[0, realCount-1]`; paddles disable at the ends (the
  coordinator toggles the composed `ui-button`s' `disabled`).
- **Resize → recompute → rebuild.** `#resizeObserver` (on the host) fires when the width crosses a
  `@container` breakpoint under `slides-in-view=''` (responsive columns): the observed column count changes,
  so `k = ceil(slidesInView) + 1` changes, so the clone band is stale. On a column-count change the
  coordinator recomputes columns and re-runs `#rebuildLoop()` (batched to a microtask, coalesced with the
  child-list `MutationObserver` path) — otherwise a widened swiper leaves a too-small clone band and a visible
  seam. A resize that does not change the column count is a no-op.

## 6 · Keyboard + focus (LLD-C6, SPEC-R4/R5)

The `[data-part=track]` is `tabindex=0`, `role=group`, `aria-label` = the region label (so it is a single
tab stop that AT announces). `#onKeydown` on the host: ArrowForward/ArrowBack along the orientation axis →
`next()`/`prev()` + `preventDefault`; Home/End → `goTo(0)` / `goTo(realCount-1)` + `preventDefault`. Focusing
content inside a slide never teleports (the `#teleporting` guard only fires on clone-band *settle*, not on
`scrollIntoView`-from-focus of a real slide). Clones are `inert` → never in the tab order.

## 7 · Geometry + tokens (LLD-C8, no token.css edit)

`@scope (ui-swiper)`. The track: `display: grid; grid-auto-flow: column` (row for vertical);
`grid-auto-columns: calc((100% - (var(--ui-swiper-columns) - 1) * var(--ui-swiper-gap)) /
var(--ui-swiper-columns))`; `overflow-{x|y}: auto`; `scroll-snap-type: {x|y} mandatory`; `scrollbar-width:
none`. Slides: `scroll-snap-align: var(--ui-swiper-align)`; `scroll-snap-stop: always`; `min-inline-size: 0`.

| Token | Value | Note |
|---|---|---|
| `--ui-swiper-columns` | `1` | responsive-auto via `@container` when `slides-in-view=''`; pinned by `[slides-in-view="n"]` |
| `--ui-swiper-align` | `start` | repointed by `[align=center|end]` |
| `--ui-swiper-gap` | `var(--ui-space-md)` | inter-slide gap off the space ladder (density-responsive) |
| `--ui-swiper-duration` | `var(--ui-motion-medium)` | scroll/goto timing; `[duration]` overrides via inline `style` |
| `--ui-swiper-easing` | `var(--ui-motion-standard-easing)` | `[easing]` overrides via inline `style` |
| `--ui-swiper-dot-size` / `-active` | compact px + `+ --ui-space-1` | active dot **larger** = the non-color signifier (ADR-0057) |
| `--ui-swiper-dot-color` / `-active` | `--md-sys-color-outline` / `--md-sys-color-primary` | ROLE-level; consumed, never defined |

Paddles compose `ui-button` (icon-only, `variant=ghost`), nav-icon sized to context (geometry.md's named
carousel exception) — no new color role. Reduced-motion: `@media (prefers-reduced-motion: reduce) {
[data-part=track] { scroll-behavior: auto } }`. Vertical orientation swaps the grid flow + overflow axis +
snap axis.

**`duration`/`easing` mechanism (ADR-0124 Consequences — the F1 trade-off).** Native `scroll-behavior:
smooth` uses UA-fixed timing and ignores author custom properties, so `duration`/`easing` **cannot** shape a
native gesture snap. They shape **programmatic** advances only (`goTo`/paddle/dot/keyboard), and `goTo` honors
them by running a **JS scroll animation** (a `requestAnimationFrame` `scrollTo` step over `--ui-swiper-duration`
with the `--ui-swiper-easing` curve), NOT `scroll-behavior: smooth`. The coordinator applies the non-empty
props as inline custom-property overrides (`this.style.setProperty('--ui-swiper-duration', this.duration)`) that
its own animation reads. Under `prefers-reduced-motion` and for the loop teleport, `goTo` skips the animation
and sets the scroll offset instantly.

## 8 · Anatomy & ARIA (SPEC-R1/R9/R11/R12)

- Host: `internals.role = 'region'`, `internals.ariaRoleDescription = 'carousel'`; `aria-labelledby` → a
  `ui-swiper-label` if present (element-reflection `reflectAriaElements(internals, 'ariaLabelledByElements',
  [label])`, the `ui-tab-panel` precedent), else `internals.ariaLabel = 'Carousel'`.
- `[data-part=track]`: the scroll container + tab stop (role=group, tabindex=0, label).
- `[data-part=live]`: `aria-live="polite"`, visually hidden, holds the position string.
- Each real `ui-swiper-item`: `role=group` + `aria-roledescription='slide'` + `aria-label='{n} of
  {realCount}'` via `labelAs` (internals). Clones: `aria-hidden` + `inert`, no role.

## 9 · Chrome drive (LLD-C9/C10/C11, SPEC-R12)

`#driveChrome()`: find a descendant `ui-swiper-pagination` / `ui-swiper-paddles` / `ui-swiper-label`. For each
absent one whose boolean (`pagination`/`paddles`) is set, stamp a default-placed anchor (pagination below the
track; paddles overlaid on the track). Then: `pagination.renderInto(realCount, activeIndex, i => this.goTo(i))`;
`paddles.fill(() => this.prev(), () => this.next(), this.orientation)`; point the region label at the label
anchor. Re-run on child mutation + on `active` change (to move the active dot / update the fraction). A
present anchor is driven in place; the boolean only bootstraps a missing one (present wins).

## 10 · Descriptors (per element)

Five `{name}.md`. `swiper.md`: `tier: pattern`, `extends: UIContainerElement`, `face.formAssociated: false`,
`attributes[]` mirroring `static props` 1:1 (surfaceProps + the ten above), `events: [select]`,
`parts: [track, live]`, `customStates: [ready]`, `aria` block (role=region via internals + roledescription),
`keyboard` block, `geometry.sizeClass: pattern`, `forcedColors`. `swiper-item.md`: `tier: layout`,
`extends: UIElement`, `attributes: [value]`, `aria.role: group` (via internals, coordinator-applied),
`slots: [default]`. `swiper-pagination.md`: `tier: pattern`, `attributes: [type]`. `swiper-paddles.md` /
`swiper-label.md`: `tier: pattern`/`display`, `attributes: []` (the `ui-toast-region` empty-schema
precedent). Every descriptor passes `validateComponentDescriptor` + `compareDescriptorToProps` +
`compareDescriptorToSource`.

## 11 · The catalog (LLD-C12, SPEC-R13)

`catalog.json`: a `Swiper` row (children = `SwiperItem`; `value: { prop: 'active', event: 'select' }`,
ADR-0019) + a `SwiperItem` row. `EXCLUSION_ALLOWLIST` in `catalog/default/index.test.ts` gains
`'SwiperPagination'`, `'SwiperPaddles'`, `'SwiperLabel'` (author placement refinements — the reasoned second
arm of ADR-0087, the Toast/ThemeProvider precedent). Allowlist residue drains to zero; the whole-fleet
coverage gate stays green. The catalog factories bind `Swiper`→`ui-swiper`, `SwiperItem`→`ui-swiper-item`.

## 12 · Frozen-interface-vs-real-code check

Every API named in §3–§9 verified against shipped source (2026-07-10):

- `UIContainerElement` + `static surfaceProps` — `dom/container.ts:37,62` ✓ (the `ui-tabs` base).
- `prop.string()` (`def=''`), `prop.enum(values, def)`, `prop.boolean()` (`def=false`) — `dom/props.ts:104–120`
  ✓; the `{ ...prop.x(), reflect: true }` spread is the `ui-tabs` `selected` idiom ✓.
- `PropsSchema` / `ReactiveProps<typeof props>` — `dom/props.ts` ✓; declare-merge interface pattern ✓.
- `this.effect(fn)` — `dom/element.ts:148` ✓. `this.listen(target, type, handler, opts?)` — `:160`, the
  `{ passive: true }` scroll option is a valid `AddEventListenerOptions` ✓. `this.emit<D>(type, detail?)` —
  `:172` ✓. `protected get internals(): ElementInternals` — `:195` ✓.
- `internals.role` (`tab.ts:40`) / `internals.ariaLabel` / element-reflection — the helper
  `reflectAriaElements(internals, 'ariaLabelledByElements', [el])` is a **module-private per-folder peer copy**
  (def at `tab.ts:24`, again at `tab-panel.ts:19`/`form.ts:120`, wired at `tab.ts:53` / `tab-panel.ts:38`), NOT
  a shared export — `swiper.ts` reimplements the 3 lines (§3.2) ✓.
- `internals.states?.add('ready')` motion gate — `controls/tabs/tabs.ts:112` ✓.
- Idempotent self-define `if (!customElements.get('ui-…')) customElements.define(…)` — `controls/tabs/tabs.ts:177` ✓.
- **`internals.ariaRoleDescription` — ⚠ NOT used anywhere in the fleet today** (verified: zero hits in
  `controls/`). ARIAMixin declares it and `ElementInternals` implements it in Chromium/WebKit/Firefox, but
  jsdom's `ElementInternals` may not. **Build-time obligation (n29, a risk, not a blocker):** verify it sets
  the AX role-description in the browser leg (read back via the accessibility tree / a real-engine probe);
  if jsdom lacks the setter, guard the jsdom probe (read via `internals` where present, skip where not — the
  `states?.` optional-chain precedent) and let the browser leg carry the truth. The prior art set
  `aria-roledescription` as a **host attribute** — forbidden here (ARIA via internals only); this is the one
  API whose fleet-first status makes it the LLD's sharpest risk.

## 13 · Build sequence (waves; one writer per file)

Waves + node grouping are owned by the decomp (`swiper-family.decomp.json` `_note`); restated here only as the
file-write order (one writer per file):

**M1 (core):** swiper-item.ts (n5) → swiper.ts parts+props+track+scroll+region-ARIA (n3,n4,n6,n14) →
keyboard/events/active (n7,n11,n12,n13) → swiper.css (n15,n16) → loop + loop-a11y (n9,n10) → reduced-motion
(n8) → descriptors + trip-wires (n21) → jsdom + browser probes (n27,n28) → component-reviewer GO (n30).
**M2 (chrome):** swiper-pagination/paddles/label + drive (n17,n18,n19). **M3 (catalog + site):** catalog rows
+ allowlist (n20) → site doc/demo (n23,n24) →
barrels/exports/size (n29).

## 14 · Risks / tradeoffs

- **`ariaRoleDescription` fleet-first** (§12) — the sharpest risk; browser-verified, jsdom-guarded.
- **Clone-teleport re-entrancy** — the `#teleporting` guard must suppress the teleport's own scroll events or
  `select` double-fires; the browser leg asserts exactly one `select` per user wrap.
- **Scroll-settle detection** — no cross-engine "snap settle" event; debounce `scroll` (passive) to the
  quiescent point. INSTRUMENT-BRIDGE: the browser leg drives real scroll + waits for settle; jsdom asserts
  only the DOM math.
- **`slides-in-view=''` responsive-auto** depends on production `@container` CSS → a built-output leg (n28).
- **MutationObserver churn** — rebuilding clones on every child mutation is O(k); batched to microtask.

## 15 · Gates (definition of done)

`npm run check` (+ site) green · `npm test` (jsdom: descriptor trip-wires, resolveIndex, active effect,
clone-count/inert/id-strip math, keyboard routing) green · `npm run test:browser` (Chromium + WebKit:
whole-shape, real scroll-snap geometry, the seamless-teleport scroll-position proof, one-`select`-per-wrap,
`ariaRoleDescription` role-description, forced-colors) green · `npm run size` by hand (a five-tag family —
re-bases the family total; the marginal measured + pinned, ADR-0040) · a2ui catalog coverage green with two
rows + three drained allowlist entries · independent component-reviewer GO before each wave commit.

## 16 · Open (named, not blocking)

- Autoplay, mouse click-drag, wheel-to-advance, virtual slides, effects, progressbar pagination — all fenced
  non-goals (SPEC §4); named foreseen extensions if asked.
- `ui-swiper-pagination type=fraction` shares the `[data-part=live]` announcement phrasing — confirm no
  double-announcement (fraction is visual, live region is AT; the browser leg checks).
