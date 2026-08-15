# LLD — `ui-tabs` vertical orientation (GH #581) + `overflow="menu"` (GH #586)

> Status: proposed · v1 · 2026-08-08 · Layer: components (`controls/tabs/`) · designer (component-design)
>
> Refines: GH #581 (vertical orientation) + GH #586 (overflow="menu") — one intake, one LLD, two build
> slices. Why ONE doc: the two axes compose (the overflow fit measurement flips from inline-size to
> block-size under vertical; the trigger's pin edge flips with it), both arms touch the SAME three files
> (`tabs.ts` / `tabs.css` / `tabs.md`), and the §7 composition matrix is a single contract — two thin LLDs
> would duplicate the interaction/geometry sections and open a cross-doc drift seam. Build plan:
> [`../decompositions/tabs-vertical-overflow-ship.decomp.json`](../decompositions/tabs-vertical-overflow-ship.decomp.json)
> (coverage-clean, plan mode).
>
> **Composes on:** the shipped tabs compound (`controls/tabs/`, ADR-0015/ADR-0019/ADR-0144) + the
> `roving-focus` trait (connect-resolved axis, the radio-group ADR-0095 / `toolbar.lld.md` §3 precedent) +
> the shipped `ui-menu` (sanctioned sibling-control import — the `command-modal → modal` / `avatar → icon`
> precedent) + `@agent-ui/icons` `setIcon` (`swiper-paddles.ts` precedent) + the GH #536/#540/#542/#543
> spacing law and its pinned probes. **No new package, no new trait, no new base class, no new event, no
> new token, no ADR** (§9 — every fork resolved additively inside shipped vocabulary).
>
> **Freeze discipline.** §5's interfaces are the fan-out contract. A builder who cannot satisfy one STOPS
> and escalates — the fix is a coordinated LLD repair, never a local deviation.

## 1 · Intent

Give the shipped tabs compound two additive, reflected enum props:

- **`orientation`** (`'horizontal' | 'vertical'`, default `'horizontal'`) — vertical renders the tablist
  strip as a column beside the panel: flex axis, `aria-orientation`, arrow axis (Up/Down per the APG tabs
  pattern), divider side, and indicator edge all follow. Reference consumer: the docs site's tabs demo page
  gains a vertical left-nav-plus-content specimen.
- **`overflow`** (`'scroll' | 'menu'`, default `'scroll'`) — `menu` collects the tabs that don't fit behind
  a tab-height 3-dot icon-button (`dots-three`, the fleet's ruled overflow glyph, GH #168) that opens a
  shipped `ui-menu` of PROXY items; committing a proxy runs the exact tab-selection path (ONE `select`
  event — the tabs vocabulary; GH #586's body says "change", corrected here, see §9).

Both defaults keep every existing consumer byte-identical (negative controls in the test plan).

## 2 · Classification & precedent rows

Unchanged — this is a variant-of-existing, not a new control: base class `UIContainerElement`, tier
`pattern`, tags/classes/tokens untouched. Catalog posture: `ui-tabs` is already catalogued (`Tabs`,
`factories.ts:274`); per-prop agent exposure is a separate decision — **deferred** for both props (§9).

Precedent rows recorded (each verified against shipped source, not summaries):

| Mechanism | Reused from | Verified fact |
|---|---|---|
| `orientation` prop | `radio-group.ts:71`, `swiper.ts:37` | `prop.enum(['horizontal','vertical'] as const, …)`, reflected; canon name (naming.md §12 — `axis` is the recorded exception) |
| Connect-resolved roving axis | `toolbar.lld.md` §3 + `radio-group.ts:129-147` | the trait's `orientation` is a VALUE read once at invoke; a live flip is a named escalation (shared-trait amendment), not v1 |
| `overflow` prop + `menu` member | `toolbar.ts:20` | `OVERFLOWS = ['wrap','scroll']` with `menu` explicitly fenced as the additive member; tabs adopts `['scroll','menu']` (no `wrap` — a wrapping tablist breaks the strip metaphor) |
| Overlay/menu vehicle | `menu.ts` | trigger = first element child at connect; panel = `[data-part=panel]` (live-queryable); items live-queried by role each keydown; `select` detail `{value: data-value ?? text, index}`; Escape/outside-click light-dismiss + focus restore to trigger via `overlay()`; disabled/`aria-disabled` commit guards (PR #566) |
| 3-dot glyph | `icons/src/types.ts:16` + `swiper-paddles.ts:20` | `setIcon(el, 'dots-three')` from `@agent-ui/icons` — an allowed controls-layer import |
| Hardcoded trigger `aria-label` | `swiper-paddles.ts:50,61` | control-created icon buttons carry a literal English `aria-label` ('Previous slide') — sanctioned |
| Roving skips + negative syncIndex | `roving-focus.ts:76,86-88,184` | items re-read live per keydown; `[disabled]`/`[aria-disabled=true]` skipped; a negative `syncIndex` return = "no update" |
| Event bubbling | `dom/element.ts:263` | `emit()` is `bubbles:true, composed:true` — the inner menu's events WILL reach `ui-tabs` listeners unless contained (§5 C8) |

Not a duplicate of `ui-nav-rail`: vertical tabs keep tab/tabpanel semantics (content switching with owned
panels); the rail is navigation. One line in `tabs.md` will say so.

## 3 · Fork sheet — #581 vertical orientation

| Row | Ruling | Why |
|---|---|---|
| Prop shape | `orientation` reflected enum, default `'horizontal'` — a prop, not a mode/tag | one axis flag, everything else derived; the issue's presumed arm confirmed; swiper/radio-group vocabulary |
| Capture semantics | roving axis connect-resolved as a VALUE; CSS follows the reflected attribute live; `tabs.md` documents "keyboard axis re-resolves on reconnect" | `toolbar.lld.md` §3 ruled exactly this; the live-accessor trait amendment is the named escalation, not v1 |
| `aria-orientation` | `setAttribute('aria-orientation','vertical')` on the `[data-part=tablist]` div when vertical; NO attribute when horizontal | parts use setAttribute (the `role=tablist` precedent on the same div); tablist's implicit default is horizontal — byte-identical default DOM |
| Arrow axis | vertical ⇒ ArrowUp/ArrowDown via the trait's `orientation` option; Left/Right unbound under vertical; Home/End unchanged | APG tabs vertical variant; the trait already implements the axis swap |
| Shell layout | `:scope[orientation=vertical]` → `display:flex; flex-direction:row`; strip `flex-direction:column; flex:none`; visible panel `flex:1 1 auto; min-inline-size:0` | strip inline-size = max-content (widest tab); hidden panels are `display:none` so the row holds exactly [strip · panel] |
| Divider side | strip `border-block-end` → `border-inline-end` under vertical | the divider sits between strip and panel in both axes; logical property = RTL-safe |
| Indicator edge | `ui-tab::after` under vertical: `inset-block:0; inset-inline-end:0; inline-size:var(--ui-tabs-indicator-size)` (block-size auto) | mirrors horizontal exactly — the indicator rides the SAME edge as the divider (the edge facing the panel) |
| #536 label-box law vertically | zero `padding-inline` STANDS (the #542 probe's negative extends to vertical); the row's full-width hit area comes from the column's cross-axis STRETCH, not padding; labels align `justify-content:flex-start` under vertical | the law's substance is "spacing rides the gap, never per-tab padding" — stretch adds no padding; a list reads start-aligned (center is a horizontal-strip convention); full-width rows are the left-nav use case the issue names |
| Gap/tokens | `--ui-tabs-strip-gap` applies unchanged (flex `gap` follows the main axis) — 16 px between rows at density 1; ZERO new tokens | one token, both axes; a consumer wanting a tighter list repoints the token (the shipped seam) |
| Geometry | tab `block-size: var(--ui-tabs-tab-height)` HOLDS (rows keep control height); `white-space:nowrap` holds; strip overflow flips `overflow-x:auto` → `overflow-y:auto` under vertical | geometry.md Pattern class: block-size is the control band in both axes; physical overflow properties (not `overflow-block`) — vertical writing modes out of scope, noted in §9 |
| `[fill]` × vertical | `[fill][orientation=vertical]`: shell = flex ROW at `block-size:100%`; strip = pinned column with `overflow-y:auto`; visible panel keeps `flex:1 1 auto; min-block-size:0; overflow-y:auto` | §7 matrix; the panel scroll leg + scrollbar seams are unchanged |
| Site surfaces | tabs demo page gains the vertical specimen (gated); descriptor `tabs.md` attributes + keyboard map updated; the docs site's own left nav does NOT swap in this build | issue's open Q ruled: the demo page is the reference consumer; re-plumbing site chrome is its owner's call, out of scope |

## 4 · Fork sheet — #586 overflow="menu"

| Row | Ruling | Why |
|---|---|---|
| Prop shape | `overflow` reflected enum `['scroll','menu']`, default `'scroll'` | today's `overflow-x:auto` IS `'scroll'`; toolbar's fenced vocabulary adopted; additive |
| Proxy vs reparent | **PROXY** — verified, not just accepted: reparenting a `ui-tab` into the menu (a) puts `role=tab` outside its required `tablist` context, (b) invalidates `tabs.ts`'s connect-time `#tabs` capture + pair-by-DOM-order wiring, (c) churns DOM identity under the #542 probes and focus. Overflowed tabs get `data-overflowed` + `display:none`, skipped by roving; the menu renders proxy `<div role="menuitem" tabindex="-1" data-value="{identity}">{label}</div>` rows | the issue's pre-argument holds under source verification |
| Vehicle | compose the shipped `ui-menu` as a control-created shell child `[data-part=overflow]` (a `ui-menu` wrapping a `<button>` trigger); proxies maintained directly in its `[data-part=panel]` (live-queried by the menu — verified) with role/tabindex set by tabs (the menu's auto-stamp runs at connect only) | buys overlay, light-dismiss, focus-restore-to-trigger (the "Escape returns to the trigger" acceptance — shipped behavior), trigger ARIA (`aria-haspopup`/`aria-expanded`/`aria-controls`), panel naming (GH #535), roving+type-ahead, and the PR #566 disabled commit guards for free |
| Trigger placement | in `overflow="menu"` mode the SHELL becomes a grid: horizontal `"strip trigger" auto "panel panel" 1fr / 1fr auto`; vertical `"strip panel" 1fr "trigger panel" auto / auto 1fr`. The `ui-menu` part is `display:none` whenever every tab fits (K=N) | keeps the trigger OUT of the `role=tablist` element (a non-tab tablist child is an ARIA required-owned-children violation), needs no absolute positioning, and leaves the DOM flat so `:scope > [data-part=tablist]` selectors + the #542 probes hold |
| Trigger in the arrow ring | **NO — deviation from the issue's "final arrow stop", flagged for review**: the trigger is its own Tab stop after the tablist (native button order). Mechanics: the roving keydown listener is scoped to the strip (`container: strip`); the trigger lives outside the strip, so once focused, its arrow keys never reach the trait — a "final arrow stop" would be half-broken (arrows in, no arrows out) or force the listener up to the shell, which would intercept panel arrows (the exact reason `container` exists). Two focus stops on the strip line (selected tab · trigger) is the standard shipped-design-system shape | verify-don't-accept: the pre-argued shape fails against the shipped trait's mechanics |
| Trigger anatomy | square icon button: `inline-size = block-size = var(--ui-tabs-tab-height)`; `setIcon(btn,'dots-three')`; ink `--ui-tabs-ink`(+hover); shared focus ring; literal `aria-label="More tabs"` | zero new tokens; paddles precedent for the literal label; tab-height square makes the fit reserve token-derived (below) |
| Visible-set model / selected-in-overflow | **Pure function, selected always pinned — deviation from the issue's "trigger carries the selected ink + indicator", flagged for review**: visible set = f(cached widths, available main-size, selected identity) = the longest DOM-order prefix that fits alongside the (always-included) selected tab; DOM order is preserved (display swap only), so a promoted selected tab renders as the LAST visible slot exactly as the issue asks. A menu commit "promotes" purely by setting `selected` through the ONE commit path — zero extra state. Consequence: the selected tab is NEVER overflowed (stronger than "never invisible" — it is always a visible, labeled tab), so the trigger-carries-indicator state is unreachable and is dropped rather than built dead | same recompute serves user commits, programmatic/agent writes, and resize — no promoted-history state, no oscillation input, fewer probes; an agent's `selected` write surfaces the tab (what a user click would have produced) instead of lighting chrome the agent never addressed |
| Menu contents | exactly the overflowed tabs (N−K proxies), rebuilt on every fit change; proxy `data-value` = the tab's commit identity (`key`, else DOM index as string), label = the tab's `textContent` snapshot; a tab carrying `disabled`/`aria-disabled` mirrors it onto its proxy (menu's guards then block commit) | proxy list and strip visibility derive from one fit result — they cannot disagree |
| Commit path + event containment | tabs listens for the menu's `select` ON the `ui-menu` element, calls `stopPropagation()`, maps `data-value` → full-list index, and runs the existing `#commit(index,…)` → ONE tabs `select`. The menu's `toggle`/`close` are contained the same way | `emit()` bubbles+composed (verified `element.ts:263`): uncontained, the REAL harms (doc-review repair 2 — the renderer's `installInputBinding` reads `el[readProp ?? prop]` at event time, never the event detail, so the data model itself is safe): (a) every menu commit surfaces TWO `select` events on `ui-tabs`, the leaked one carrying the PROXY index space in `detail.index`; (b) menu `toggle`/`close` surface outside tabs' declared `{select}` event contract. `ui-tabs`' event surface stays exactly `{select}` |
| Measurement | one `ResizeObserver` on the strip (guarded `typeof ResizeObserver !== 'undefined'` — jsdom; fit behavior is browser-suite territory). Available = the strip's content-box INLINE-size (horizontal) / BLOCK-size (vertical). Reserve = `--ui-tabs-tab-height` resolved + one gap — token-derived, never measured from the trigger. Fit: if Σ(cached sizes) + (N−1)·gap ≤ available ⇒ K=N, menu part hidden; else K = max k with selected pinned + prefix fitting alongside the reserve; floor K=1 (the selected tab always renders; below that the strip clips — recorded edge). **Cache-validity guard (doc-review repair 1):** a menu-mode tabs CONNECTING inside a `display:none` ancestor (the fleet ships this — tabs inside a non-selected panel via `tabs.ts:101` `panel.hidden`, or an unopened modal) measures an all-zero cache; without a guard, fit reads K=N forever and overflow NEVER engages (total failure, not an off-by-one). `#applyFit` therefore REMEASURES the cache before computing whenever the cache is all-zero OR the strip's observed main-size transitions 0→nonzero (the reveal edge the RO delivers) | gap read from computed style at fit time (density-live); reserve needs no DOM measure; the guard's remeasure inputs are still render-independent (all tabs unhidden for the pass), so the oscillation immunity holds |
| Hysteresis | fit is computed ONLY from the CACHED full-set sizes + the observed available size — never from currently-rendered subset geometry, so hiding tabs cannot feed back into the observer. Cache: per-tab inline-size measured at connect (all tabs still visible, pre-hide) + one `document.fonts.ready` remeasure; vertical needs NO per-tab cache (every row is the uniform token height — pure arithmetic). Dynamic tab add/remove is unsupported by the shipped control (connect-time `#tabs` capture — unchanged constraint) | the issue's cached-widths oscillation guard, made concrete |
| Strip overflow in menu mode | `overflow: clip` on the fit axis (no scrolling — the menu replaces scroll) | belt-and-braces against programmatic scroll of a "fully fitting" strip |
| A11y summary | tabs stay `role=tab` inside `role=tablist`; roving covers exactly the visible tabs (trait re-reads live; `syncIndex` returns the selected tab's VISIBLE-list position); the menu is a `role=menu` of `role=menuitem` proxies ("switch to X" commands) — proxies never claim tab semantics | APG-clean split; index-space mapping frozen in §5 |
| Site surfaces | tabs demo page gains an overflow="menu" specimen (bounded-width strip); descriptor `tabs.md` gains the prop + the `overflow` part + keyboard note | standing descriptor/site gates drag automatically |

## 5 · Interfaces (frozen)

```ts
// controls/tabs/tabs.ts — additions. Every cited API verified against shipped source (§2).

const ORIENTATIONS = ['horizontal', 'vertical'] as const
const OVERFLOWS = ['scroll', 'menu'] as const // toolbar.ts:20's fenced vocabulary, `wrap` inapplicable

const props = {
  ...UIContainerElement.surfaceProps,
  selected: { ...prop.string(), reflect: true },
  fill: { ...prop.boolean(false), reflect: true },
  // #581 — the strip axis. Reflected (CSS keys off [orientation=vertical]); the roving axis is
  // connect-resolved as a VALUE (radio-group/toolbar precedent; re-resolves on reconnect).
  orientation: { ...prop.enum(ORIENTATIONS, 'horizontal'), reflect: true },
  // #586 — the strip's not-enough-room strategy. 'scroll' = today's overflow-x auto, byte-identical.
  overflow: { ...prop.enum(OVERFLOWS, 'scroll'), reflect: true },
} satisfies PropsSchema
```

```ts
// C6 — connected() deltas (same file, same writer):
//   • strip.setAttribute('aria-orientation','vertical') iff vertical; removeAttribute otherwise.
//   • rovingFocus({ …, orientation: this.orientation, items: () => this.#visibleTabs(),
//       initialIndex/syncIndex: () => this.#visibleTabs().indexOf(this.#tabs[this.#activeIndex]),  // -1 ⇒ no-update (trait contract)
//       onMove: (vi) => this.#commit(this.#tabs.indexOf(this.#visibleTabs()[vi]), false) })
//   • #visibleTabs(): UITabElement[] — this.#tabs minus [data-overflowed]; identity when overflow!=='menu'.

// C7 — the overflow part (created lazily, once, iff overflow==='menu' at connect; persists like #tablist):
//   <ui-menu data-part="overflow"><button type="button" aria-label="More tabs">…setIcon('dots-three')…</button></ui-menu>
//   appended AFTER the strip as a shell child. Proxies are maintained in the menu's live
//   [data-part=panel] (menu.ts #itemsIn is a live role query — verified): tabs sets role=menuitem,
//   tabindex=-1, data-value, textContent, and mirrors disabled/aria-disabled per rebuild.

// C8 — containment + commit relay:
//   this.listen(menuEl, 'select', (e) => { e.stopPropagation();
//     const v = (e as CustomEvent<{value:string}>).detail.value
//     this.#commit(this.#indexOfIdentity(v), /*moveFocus*/ true) })
//   this.listen(menuEl, 'toggle', (e) => e.stopPropagation())
//   this.listen(menuEl, 'close',  (e) => e.stopPropagation())

// C9 — fit (one private method, called from the RO callback + connect + fonts.ready):
//   #applyFit(): reads cached sizes (horizontal) or the height token (vertical), available main-size,
//   gap + reserve from computed style; pins the selected tab; stamps/clears data-overflowed;
//   hides/shows the overflow part (hidden = K===N); rebuilds proxies. Pure w.r.t. rendered subset.
//   CACHE-VALIDITY GUARD (doc-review repair 1): before computing, REMEASURE the cache when it is
//   all-zero OR the observed strip main-size transitions 0→nonzero — a menu-mode tabs connected
//   inside a display:none ancestor (non-selected panel, unopened modal) otherwise caches zeros and
//   overflow never engages; the reveal-time RO tick re-runs over the same dead cache without this.
```

CSS plan (`tabs.css`, same sectioned blocks, zero new tokens): a `:scope[orientation='vertical']` block
(shell row · strip column · divider `border-inline-end` · indicator `inset-inline-end` · label
`justify-content:flex-start` · `overflow-y:auto`), a `:scope[overflow='menu']` block (shell grid per §4 ·
`[data-part=overflow]` trigger geometry off `--ui-tabs-tab-height` · `ui-tab[data-overflowed]{display:none}` ·
strip `overflow:clip`), and their composition corners (§7). Forced-colors: the existing block already covers
the indicator/divider; the trigger inherits the shared button/icon forced-colors behavior.

## 6 · Components

| ID | Component | File | Traces |
|---|---|---|---|
| LLD-C1 | `orientation` + `overflow` props schema | `controls/tabs/tabs.ts` | GH #581 · GH #586 |
| LLD-C2 | vertical CSS block (shell row, strip column, divider/indicator edges, start-aligned labels, axis overflow) | `controls/tabs/tabs.css` | GH #581 §3 |
| LLD-C3 | `aria-orientation` on the strip part + connect-resolved roving axis | `controls/tabs/tabs.ts` | GH #581 §3 |
| LLD-C4 | menu-mode CSS block (shell grid, trigger geometry, `[data-overflowed]`, `overflow:clip`) + composition corners | `controls/tabs/tabs.css` | GH #586 §4 · §7 |
| LLD-C5 | `#visibleTabs()` + roving index-space mapping | `controls/tabs/tabs.ts` | §5 C6 |
| LLD-C6 | the `[data-part=overflow]` part (ui-menu + trigger + `setIcon`) | `controls/tabs/tabs.ts` | §5 C7 |
| LLD-C7 | event containment + proxy-commit relay | `controls/tabs/tabs.ts` | §5 C8 |
| LLD-C8 | `#applyFit()` — RO wiring, size cache, reserve, selected pinning, proxy rebuild | `controls/tabs/tabs.ts` | §5 C9 |
| LLD-C9 | descriptor: attributes rows, `overflow` part, keyboard-map vertical variant, nav-rail non-overlap line | `controls/tabs/tabs.md` | §3 · §4 |
| LLD-C10 | descriptor↔props trip-wire extension | `controls/tabs/tabs-descriptor.test.ts` | LLD-C9 |
| LLD-C11 | jsdom suite: prop reflect/defaults, byte-identical negatives, containment (no `toggle`/`close`/menu-`select` leak), programmatic-write silence | `controls/tabs/tabs.test.ts` | §8 |
| LLD-C12 | browser suite: vertical geometry + keyboard axis; fit/promote/restore; N−K proxies; ONE `select`; Escape→trigger focus; #542 probes stay green; §7 corners — both engines | `controls/tabs/tabs.browser.test.ts` | §8 |
| LLD-C13 | site: tabs demo page vertical + overflow specimens | `site/pages/tabs-demo.ts` (or the page's actual home — builder verifies) | §3 · §4 |

One writer per file; the two build slices (§10) serialize on `tabs.ts`/`tabs.css`/`tabs.md`.

## 7 · Composition matrix (ruled, all eight corners)

| orientation × overflow × fill | Behavior |
|---|---|
| horizontal · scroll (· ±fill) | today — byte-identical, negative controls |
| horizontal · menu | fit axis = inline; trigger = grid col 2 on the strip line |
| vertical · scroll | strip column, `overflow-y:auto` |
| vertical · menu | fit axis = block; trigger at the strip column's block-end; an UNBOUNDED vertical strip never overflows (K=N by construction — the column grows); bounding comes from `[fill]` or an author-bounded host |
| fill · horizontal · menu | grid rows `auto 1fr`; panel keeps the scroll leg + seam |
| fill · vertical · scroll/menu | shell row at `block-size:100%`; strip pinned + own scroll (scroll) or fit-managed (menu); panel scroll leg unchanged |

## 8 · Test plan (the component-testing bar)

- **jsdom (LLD-C10/C11):** enum defaults/reflection/fail-open; descriptor trip-wire; event containment
  (a synthetic menu `select` dispatched inside never surfaces on a `ui-tabs` listener; detail identity
  checked); programmatic `selected` write to an "overflowed" tab emits nothing (binding hygiene held).
  RO-dependent behavior is NOT asserted in jsdom (guarded API).
- **Browser, both engines (LLD-C12):** fixed 320px strip with wide tabs → K visible + trigger visible +
  exactly N−K proxies; menu commit → ONE `select` (spy count), committed tab visible as last slot,
  indicator on it; resize wider → trigger hidden, all tabs shown; roving skips hidden (arrow walk order);
  Escape from open menu → focus on trigger; hidden-connect reveal (repair 1): connect inside a
  `display:none` ancestor, reveal, and overflow ENGAGES (K < N, trigger visible); vertical: strip beside panel (whole-shape bounding boxes,
  the test-the-whole-shape law), Up/Down move selection, Left/Right inert, divider/indicator on the
  inline-end edge, zero `padding-inline` (the #536 negative extended), 16px row gap at density 1;
  the existing #542/#543 horizontal probes UNTOUCHED and green (the trigger is a shell child, not a
  tablist child); §7's `fill×vertical×menu` corner smoke. Shard placement per the six-shard law —
  extend the tabs shard, never re-monolith.
- **Gates:** `npm run check` + `npm test` + `npm run test:browser` exit codes; docs-grammar (this doc);
  no built-output leg needed — no production-CSS-only mechanism is introduced (plain flex/grid in the
  shipped sheet, covered by the standing browser suite path).

## 9 · Risks, non-forks, open items

- **No ADR — ruled, default-no held:** both props are additive with shipped-vocabulary values; no new
  event (the ONE commit event stays `select`); no new token, part names descriptor-declared, no geometry
  novelty (Pattern class holds vertically — control-height rows either axis). The #536-law-read-vertically
  interpretation and the visible-set model are LLD-level design, recorded here; nothing is hard to reverse.
- **Two flagged deviations from GH #586's worked design** (rulings in §4, for cheap veto at doc review):
  (1) trigger = Tab stop, not the strip's final arrow stop; (2) selected is always pinned visible, so the
  trigger-carries-indicator state is dropped as unreachable. Plus one correction: the issue's "one `change`"
  is the tabs vocabulary's ONE `select` (`tabs.md` events; the A2UI binding listens to `select`).
- **Catalog exposure deferred** for both props: `Tabs` factory/validator/prompt pins untouched (zero a2ui
  bytes this build — ADR-0144 Q1 cl.4 shows per-prop exposure is its own ruling; file a follow-up issue
  when an agent surface wants either).
- **Chat-shell at compact** (GH #575's owner): whether the shell adopts `overflow="menu"` instead of
  horizontal scroll is OPEN, routed as a follow-up — this build changes nothing under the shell's
  `overflow` default.
- **Width-cache staleness** — the named likelier invalidator is runtime LABEL mutation (a consumer
  changing a captured tab's `textContent` — no observation path exists; doc-review repair 3), plus late
  font swap after `fonts.ready` and ancestor `[density]` font effects: the fit may run on stale sizes
  until the next reconnect; consequence is one tab too many/few, not oscillation (inputs stay
  render-independent) and not the hidden-connect total failure (that case is CLOSED by §4's
  cache-validity guard). Accepted; recorded in `tabs.md` if observed.
- **Vertical writing modes** (`writing-mode` on ancestors) are out of scope — physical overflow
  properties chosen deliberately; revisit only with a real consumer.
- **K=1 floor**: a strip narrower than selected-tab + trigger clips — recorded edge, no special casing.

## 10 · Build slices (dispatchable, sequential — same files)

1. **Slice A — #581 vertical** (LLD-C1 orientation half, C2, C3, C9–C13 vertical legs): gates green,
   commit.
2. **Slice B — #586 overflow** (LLD-C1 overflow half, C4–C8, C9–C13 overflow legs + the §7 corners):
   gates green, commit.

Each slice's acceptance predicates live in the decomposition manifest (leaf `accept` fields). Findings
write-back: a dated comment on each issue at ship, including §9's deviations/correction on GH #586.
