# Decomp — Control suite Wave 2: Range family (ui-slider · ui-slider-multi)

> #49 Wave 2 (milestone **G6.5**). Composes on **Wave 0** (`UIRangeElement` + the `value-drag` controller,
> ADR-0042 / `range-element.lld.md`, built + committed · the `--ui-compact`/`--ui-widget-inset` tokens ADR-0041).
> File-disjoint per control dir. **checkbox is the gold template** — bake the Wave-1 review lessons in UPFRONT
> (below). · proposed · 2026-06-30 · planning-lead

## Shared pattern (every Range leaf)

`class UI{Name}Element extends UIRangeElement { static role = 'slider' }` — the base owns `{value, min, max,
step, size}`, the ARIA slider machine, keyboard step, and the geometry consumption; the leaf provides the
**thumb count + the `.css` paint + the `host.use(valueDrag)` binding**. Motion = **unconditional CSS +
reduced-motion** (the Indicator/Range family pattern — NO `:state(ready)` gate; the base does not arm `ready`,
ADR-0042 LLD-C6).

## Slices (file-disjoint by exact path; parallel)

### S1 — `ui-slider`  (`controls/slider/`)  ⭐ ratifies ADR-0042 Range half
- **Files:** `slider.ts` · `slider.css` · `slider.md` · `slider.test.ts` · `slider.browser.test.ts`.
- **Leaf scope:** `role='slider'`; a **rail** (a thin fill line) inside the `--ui-compact-{size}` interactive
  box + a **thumb** = `box − 4px` (inset `--ui-widget-inset` 2px, ADR-0041), a circle at `--value-pct`; the
  **fill** (min→value). `host.use(valueDrag, {track, min, max, step, onValue: v => this.value = v})` (RNG-C4)
  maps pointer→value; keyboard step (Arrow ±step, Page ±10×, Home/End → min/max, RNG-C3); ARIA
  `valuenow/min/max` via internals (RNG-C2). The controller sets `--value-pct` (the paint), the host sets the
  thumb inset/fill off it.
- **Probes (jsdom):** value clamp+snap to `[min,max]`/`step`; keyboard step (Arrow/Page/Home/End); `input`
  (live) + `change` (commit); `ariaValueNow/Min/Max`; disabled-inert.
- **Browser smoke (⭐ the ADR-0042 Range-half → accepted gate, G6.5):** the interactive box = `--ui-compact`
  per `[size]×[scale]` (**exact px, not `>0`**); the **thumb = box − 4px** (the 2px-inset rendered-px proof);
  a **real pointer-drag** (pointerdown→move→up) moves the thumb AND updates `value` (the value-drag proof);
  forced-colors (`forced-color-adjust: none` on the rail/thumb so the track survives) + reduced-motion;
  C10 `inspect()` zero-residue.

### S2 — `ui-slider-multi`  (`controls/slider-multi/`)
- **Files:** `slider-multi.ts` · `slider-multi.css` · `slider-multi.md` · `slider-multi.test.ts` ·
  `slider-multi.browser.test.ts`.
- **Leaf scope:** `value: [lo, hi]` (the subclass widens the value type + codec); **two thumbs** (two
  `--value-pct-lo`/`--value-pct-hi`), **two `valueDrag` bindings**; the **nearer-thumb-grabs** rule on
  pointerdown; the **lo ≤ hi invariant** (a dragged thumb clamps at its sibling, never swaps identity);
  the fill = lo→hi. ARIA: two `slider` foci (or `aria-valuetext` lo/hi).
- **Probes (jsdom):** the pair clamp/snap; lo≤hi held (drag lo past hi → pinned at hi); nearer-thumb selection;
  keyboard per-thumb; the `[lo,hi]` form value.
- **Browser smoke:** two thumbs each `box − 4px`; real drag of each (nearer-thumb) with lo≤hi held; forced-colors;
  C10 zero-residue.

## The Wave-1 review lessons — BAKED IN (the reviewer CONFIRMS, doesn't catch)

Every Range slice's DoD includes, from the gate, the four things the Wave-1 review flagged:
1. **contract↔props trip-wire with BITING NCs** — the `{name}.md` descriptor's attributes/events/states match
   `static props`, AND a **negative control that actually bites**: a `@ts-expect-error` on a non-member
   `size`/`role`, and a descriptor-vs-props mismatch that FAILS the trip-wire (not a vacuous pass).
2. **`inspect()` C10 zero-residue** — connect→disconnect proven via `inspect()` (0 subscribers) + the
   `AbortSignal` (0 listeners) + the value-drag controller's pointer listeners released; reconnect re-subscribes
   clean; the controller's `release()` idempotent.
3. **anti-vacuous browser geometry** — assert the **exact px** per `[size]×[scale]` (`box === --ui-compact-{size}`,
   `thumb === box − 4`), NOT `> 0`; a negative control (a wrong size renders a different px).
4. **forced-colors** — `forced-color-adjust: none` where a token color is load-bearing (the rail/fill/thumb must
   stay visible); the value/thumb survive `forced-colors: active`.
5. **size/motion (the ADR-0042 LLD-C1/C6 refinement)** — `size` is inherited from `UIRangeElement` (a typed
   reflected prop, NOT a per-leaf re-declaration); **no `:state(ready)` CSS** (the base doesn't arm it — a ready
   gate is dead; use unconditional transitions + reduced-motion, the checkbox pattern).

## Per-control DoD (the full G6 bar + reviewer BEFORE commit)

✓ jsdom probes · ✓ `tsc` clean · ✓ `{name}.md` descriptor + the biting contract↔props trip-wire · ✓ the
**cross-engine** browser smoke (Chromium + WebKit — anti-vacuous exact-px + the real pointer-drag + forced-colors)
· ✓ contrast · ✓ **component-reviewer ≥ 4 BOTH axes BEFORE commit** (the gold-template bar, checkbox) · ✓ the
**gz marginal** in `{name}.md`.

## Dependencies + fan-out

- **Blocks on:** Wave 0 (`UIRangeElement` + `value-drag`, committed) + the `--ui-compact`/`--ui-widget-inset`
  tokens (committed).
- **File-disjoint:** S1/S2 touch only `controls/slider/` and `controls/slider-multi/` — parallel. Barrels +
  `BASE_CLASSES` + the family gz re-base are the integration slice (wave boundary). Each self-gates its own path.
- **Maps to:** goals.md **§G6.5** (Range — new; keep goals honest). S1's green smoke ratifies **ADR-0042's
  Range half → accepted**.
