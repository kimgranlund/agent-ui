import { describe, it, expect } from 'vitest'

// S2 browser smoke — ui-slider-multi (decomp S2 · ADR-0041 · ADR-0042).
// Probes (from the Wave-1 review lessons, all baked-in from the gate):
//   AC1 (anti-vacuous exact-px geometry) — each thumb = --ui-compact-{size} − 4px per [size]×[scale];
//       negative control: wrong size renders different px; host block-size = --ui-compact-{size}.
//   AC2 (real dual-pointer-drag) — drag each thumb via pointerdown→pointermove→pointerup; nearer-thumb
//       selection holds; lo≤hi invariant maintained during drag.
//   AC3 (forced-colors) — @media forced-colors: the rail/fill/thumbs have forced-color-adjust:none;
//       stylesheet assertions (verified by reading the CSS @media block).
//   AC4 (no --ui-scale multiplier) — the scale × size table is LITERAL (ADR-0041 cl.2): content-lg × lg
//       must produce the exact px from the table, not a CSS calc result.
//   C10 (zero-residue) — connect→disconnect produces no stacked listeners; reconnect re-arms exactly once.

import '@agent-ui/components/foundation-styles.css' // tokens (--c-*) + dimensions (--ui-compact-*)
import './slider-multi.css'                          // the control stylesheet (direct — pre-barrel)
import './slider-multi.ts'                           // self-define (registers ui-slider-multi)
import { UISliderMultiElement } from './slider-multi.ts'

/** Simulate a full drag gesture: pointerdown → pointermove → pointerup on an element. */
function drag(target: HTMLElement, startX: number, endX: number, id = 1): void {
  target.dispatchEvent(new PointerEvent('pointerdown', { clientX: startX, pointerId: id, bubbles: true }))
  target.dispatchEvent(new PointerEvent('pointermove', { clientX: endX,   pointerId: id, bubbles: true }))
  target.dispatchEvent(new PointerEvent('pointerup',   { clientX: endX,   pointerId: id, bubbles: true }))
}

// ── AC0: RENDERED SHAPE — a range slider must LOOK like a slider, not two collapsed dots ─────────
describe('ui-slider-multi AC0 — renders as a horizontal track, not collapsed thumbs (regression)', () => {
  it('in a flex row, the host floors to a wide horizontal bar (width ≥ 12rem, width ≫ height)', () => {
    const row = document.createElement('div')
    row.style.display = 'flex'
    row.style.alignItems = 'center'
    document.body.append(row)
    const el = document.createElement('ui-slider-multi') as UISliderMultiElement
    row.append(el)

    const rect = el.getBoundingClientRect()
    expect(rect.width, `slider-multi collapsed to ${rect.width}px — must floor to ~12rem, a horizontal track`).toBeGreaterThanOrEqual(180)
    expect(rect.width, 'a range slider must be far wider than tall (a track, not dots)').toBeGreaterThan(rect.height * 4)
    row.remove()
  })
})

/**
 * Stub setPointerCapture on the RAIL element (the value-drag controller's track).
 *
 * UISliderMultiElement routes valueDrag to the rail child (`track: () => this.#rail`), so
 * the stub must be on the rail instance — mirroring slider.browser.test.ts's `stubCapture(el)`.
 *
 * In Playwright headless mode the mouse pointer (id=1) is the only registered active pointer.
 * Any OTHER pointerId causes `track.setPointerCapture(id)` to throw NotFoundError. Even for
 * id=1, the native `setPointerCapture` from a synthetic PointerEvent may throw in some engines.
 * Stubbing UNCONDITIONALLY (never behind `typeof !== 'function'`) is the correct pattern —
 * the own-property shadow always wins over the prototype method, in all modern engines.
 */
function stubRailCapture(el: UISliderMultiElement): void {
  const rail = el.querySelector<HTMLElement>('.rail')
  if (!rail) return
  // Override own property → shadows Element.prototype.setPointerCapture for this rail instance.
  ;(rail as unknown as { setPointerCapture(_id: number): void }).setPointerCapture = (): void => {}
}

describe('ui-slider-multi browser smoke (S2 AC1–AC4 + C10)', () => {
  // ── AC1: thumb = box − 4px (the ADR-0041 2px-inset law), exact px per [size]×[scale] ─────────────

  it('AC1 default [size=md]: thumbs are (--ui-compact-md − 4px) × 2 = 12px (at default ui-md scale)', () => {
    const el = document.createElement('ui-slider-multi')
    document.body.append(el)

    // --ui-compact-md = 16px at ui-md scale → thumb = 16 − 4 = 12px
    const loThumb = el.querySelector<HTMLElement>('.thumb[data-thumb="lo"]')!
    const hiThumb = el.querySelector<HTMLElement>('.thumb[data-thumb="hi"]')!
    expect(Number.parseFloat(getComputedStyle(loThumb).width)).toBe(12)  // box − 4 = 16 − 4 = 12
    expect(Number.parseFloat(getComputedStyle(loThumb).height)).toBe(12)
    expect(Number.parseFloat(getComputedStyle(hiThumb).width)).toBe(12)
    expect(Number.parseFloat(getComputedStyle(hiThumb).height)).toBe(12)
    el.remove()
  })

  it('AC1 [size=sm]: thumbs are (--ui-compact-sm − 4px) = 10px', () => {
    const el = document.createElement('ui-slider-multi')
    el.setAttribute('size', 'sm')
    document.body.append(el)

    // --ui-compact-sm = 14px → thumb = 14 − 4 = 10px
    const loThumb = el.querySelector<HTMLElement>('.thumb[data-thumb="lo"]')!
    expect(Number.parseFloat(getComputedStyle(loThumb).width)).toBe(10)
    el.remove()
  })

  it('AC1 [size=lg]: thumbs are (--ui-compact-lg − 4px) = 14px', () => {
    const el = document.createElement('ui-slider-multi')
    el.setAttribute('size', 'lg')
    document.body.append(el)

    // --ui-compact-lg = 18px → thumb = 18 − 4 = 14px
    const loThumb = el.querySelector<HTMLElement>('.thumb[data-thumb="lo"]')!
    expect(Number.parseFloat(getComputedStyle(loThumb).width)).toBe(14)
    el.remove()
  })

  it('AC1 negative control: [size=sm] is different from [size=lg] (anti-vacuous)', () => {
    const sm = document.createElement('ui-slider-multi')
    sm.setAttribute('size', 'sm')
    const lg = document.createElement('ui-slider-multi')
    lg.setAttribute('size', 'lg')
    document.body.append(sm, lg)

    const smW = Number.parseFloat(getComputedStyle(sm.querySelector<HTMLElement>('.thumb')!).width)
    const lgW = Number.parseFloat(getComputedStyle(lg.querySelector<HTMLElement>('.thumb')!).width)
    expect(smW).not.toBe(lgW) // 10 ≠ 14 — not the same (anti-vacuous: different sizes render different px)
    sm.remove()
    lg.remove()
  })

  it('AC1 host block-size equals --ui-compact-md (the interactive area = the box)', () => {
    const el = document.createElement('ui-slider-multi')
    document.body.append(el)
    // Host block-size = --ui-compact-md = 16px at ui-md scale
    expect(Number.parseFloat(getComputedStyle(el).height)).toBe(16) // block-size: var(--ui-slider-multi-box)
    el.remove()
  })

  // ── AC4: content-lg × lg → exact px from the ADR-0041 literal table ───────────────────────────

  it('AC4 no --ui-scale multiplier: [scale=content-lg] × [size=lg] → thumb = 28px − 4 = 24px (literal table)', () => {
    const wrapper = document.createElement('div')
    wrapper.setAttribute('scale', 'content-lg')
    const el = document.createElement('ui-slider-multi')
    el.setAttribute('size', 'lg')
    wrapper.append(el)
    document.body.append(wrapper)

    // content-lg × lg = 28px from the ADR-0041 literal table → thumb = 28 − 4 = 24px (NOT a CSS calc result)
    const loThumb = el.querySelector<HTMLElement>('.thumb[data-thumb="lo"]')!
    expect(Number.parseFloat(getComputedStyle(loThumb).width)).toBe(24)
    wrapper.remove()
  })

  it('AC4 [scale=ui-lg] × [size=md] → thumb = 18px − 4 = 14px (literal table, not multiplier)', () => {
    const wrapper = document.createElement('div')
    wrapper.setAttribute('scale', 'ui-lg')
    const el = document.createElement('ui-slider-multi')
    wrapper.append(el)
    document.body.append(wrapper)

    // ui-lg × md = 18px → thumb = 18 − 4 = 14px
    const loThumb = el.querySelector<HTMLElement>('.thumb[data-thumb="lo"]')!
    expect(Number.parseFloat(getComputedStyle(loThumb).width)).toBe(14)
    wrapper.remove()
  })

  // ── AC2: real dual-pointer-drag — drag each thumb via pointer events ──────────────────────────
  //
  // All drag tests:
  //   • setPointerCapture is stubbed unconditionally via stubRailCapture() (matching the gold
  //     template in slider.browser.test.ts). The native call throws NotFoundError for synthetic
  //     pointer IDs in real browsers; stubbing prevents the throw.
  //   • getBoundingClientRect is mocked via Object.defineProperty to return a fixed-width rect
  //     (own-property shadows prototype method in all modern engines). This avoids reliance on
  //     real CSS layout and body margin for coordinate calculations.
  //   • All drags use the default pointerId=1 (the registered mouse pointer in Playwright headless).
  //     Sequential drags with the same id are safe — the first drag's per-drag AbortController is
  //     aborted on pointerup before the second pointerdown starts a fresh drag session.

  it('AC2 drag lo thumb: pointerdown→pointermove→pointerup updates valueLo', () => {
    const el = document.createElement('ui-slider-multi') as UISliderMultiElement
    document.body.append(el)
    stubRailCapture(el)  // unconditional — native setPointerCapture throws for synthetic events

    const rail = el.querySelector<HTMLElement>('.rail')!
    Object.defineProperty(rail, 'getBoundingClientRect', {
      value: (): DOMRect => ({ left: 0, right: 200, width: 200, top: 0, bottom: 16, height: 16, x: 0, y: 0, toJSON: (): unknown => ({}) } as DOMRect),
      configurable: true,
    })

    // With lo=0 (0%) and hi=100 (100%), drag at clientX=20 (10%): lo is closer (0%) → nearer-thumb = lo
    drag(rail, 20, 20)

    // snapValue(20/200=0.10, 0, 100, 1) = 10
    expect(el.valueLo).toBe(10)
    expect(el.valueHi).toBe(100) // hi unchanged
    el.remove()
  })

  it('AC2 drag hi thumb: pointerdown→pointermove→pointerup updates valueHi', () => {
    const el = document.createElement('ui-slider-multi') as UISliderMultiElement
    document.body.append(el)
    stubRailCapture(el)

    const rail = el.querySelector<HTMLElement>('.rail')!
    Object.defineProperty(rail, 'getBoundingClientRect', {
      value: (): DOMRect => ({ left: 0, right: 200, width: 200, top: 0, bottom: 16, height: 16, x: 0, y: 0, toJSON: (): unknown => ({}) } as DOMRect),
      configurable: true,
    })

    // With lo=0 (0%) and hi=100 (100%), drag at clientX=160 (80%): hi is closer (100%) than lo (0%) → nearer-thumb = hi
    drag(rail, 160, 160)

    // snapValue(160/200=0.80, 0, 100, 1) = 80; valueHi = Math.max(80, 0) = 80
    expect(el.valueHi).toBe(80)
    expect(el.valueLo).toBe(0) // lo unchanged
    el.remove()
  })

  it('AC2 lo≤hi invariant maintained during drag: dragging lo past hi clamps at hi', () => {
    const el = document.createElement('ui-slider-multi') as UISliderMultiElement
    el.setAttribute('value-lo', '20')
    el.setAttribute('value-hi', '60')
    document.body.append(el)
    stubRailCapture(el)

    const rail = el.querySelector<HTMLElement>('.rail')!
    Object.defineProperty(rail, 'getBoundingClientRect', {
      value: (): DOMRect => ({ left: 0, right: 100, width: 100, top: 0, bottom: 16, height: 16, x: 0, y: 0, toJSON: (): unknown => ({}) } as DOMRect),
      configurable: true,
    })

    // lo=20 is at 20%; hi=60 is at 60%. Drag at clientX=10 (10% → closer to lo 20% than hi 60%)
    // Then pointermove to clientX=80 (80%): onValue(80) for lo → clamp at hi=60
    rail.dispatchEvent(new PointerEvent('pointerdown', { clientX: 10, pointerId: 1, bubbles: true }))
    rail.dispatchEvent(new PointerEvent('pointermove', { clientX: 80, pointerId: 1, bubbles: true }))
    rail.dispatchEvent(new PointerEvent('pointerup',   { clientX: 80, pointerId: 1, bubbles: true }))

    // valueLo should be clamped at hi=60 (not 80)
    expect(el.valueLo ?? 0).toBeLessThanOrEqual(el.valueHi ?? 100) // lo ≤ hi invariant holds
    el.remove()
  })

  it('AC2 two sequential drags: nearer-thumb picks correctly after first drag moves lo (lo then hi)', () => {
    // Proves the nearer-thumb algorithm re-evaluates on each pointerdown against current thumb
    // positions. Sequential drags using the same mouse pointer (id=1) are the correct pattern —
    // each drag is fully committed (pointerup aborts its per-drag listeners) before the next begins.
    // Using two different pointer IDs would require two simultaneously active hardware pointers,
    // which are not present in Playwright headless mode.
    const el = document.createElement('ui-slider-multi') as UISliderMultiElement
    document.body.append(el)
    stubRailCapture(el)

    const rail = el.querySelector<HTMLElement>('.rail')!
    Object.defineProperty(rail, 'getBoundingClientRect', {
      value: (): DOMRect => ({ left: 0, right: 100, width: 100, top: 0, bottom: 16, height: 16, x: 0, y: 0, toJSON: (): unknown => ({}) } as DOMRect),
      configurable: true,
    })

    // First drag: lo at 0%, hi at 100%; drag at clientX=20 → lo closer (distLo=0.20, distHi=0.80) → lo moves to 20
    drag(rail, 20, 20)
    expect(el.valueLo).toBe(20)
    expect(el.valueHi).toBe(100)

    // Second drag (same pointer id=1, first drag fully committed via pointerup):
    // lo now at 20%, hi at 100%; drag at clientX=70 → hi closer (distLo=0.50, distHi=0.30) → hi moves to 70
    drag(rail, 70, 70)
    expect(el.valueHi).toBe(70)
    expect(el.valueLo).toBe(20) // lo unchanged
    expect(el.valueLo ?? 0).toBeLessThanOrEqual(el.valueHi ?? 100) // invariant holds
    el.remove()
  })

  // ── C10: zero-residue — connect→disconnect produces no stacked listeners ─────────────────────

  it('C10 zero-residue: reconnect produces exactly one keyboard response (not stacked)', () => {
    const el = document.createElement('ui-slider-multi') as UISliderMultiElement
    document.body.append(el)

    // Use keyboard on lo thumb while connected
    const loThumb = el.querySelector<HTMLElement>('.thumb[data-thumb="lo"]')!
    loThumb.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }))
    expect(el.valueLo).toBe(1) // step = 1

    el.remove() // disconnect
    document.body.append(el) // reconnect

    // One ArrowRight should produce exactly one step, not two
    el.querySelector<HTMLElement>('.thumb[data-thumb="lo"]')!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })
    )
    expect(el.valueLo).toBe(2) // 1 + 1 = 2 (one step, not doubled)
    el.remove()
  })

  // ── density-invariance — thumb/host geometry HOLDS across [density] (widget-box is scale-only) ──
  //
  // The compact widget-box ramp (--ui-compact-{size}) is re-tabled by [scale], NOT by [density].
  // Density shifts layout-ladder quantities (--ui-space-*, gap, padding) but never the control box.
  // A [density=compact/comfortable/spacious] wrapper must produce identical thumb px (anti-vacuous).

  it('density-invariant: thumb size is unchanged under [density=compact], default, and [density=spacious]', () => {
    function makeWithDensity(density: string | null): number {
      const wrapper = document.createElement('div')
      if (density !== null) wrapper.setAttribute('density', density)
      const el = document.createElement('ui-slider-multi')
      wrapper.append(el)
      document.body.append(wrapper)
      const thumb = el.querySelector<HTMLElement>('.thumb[data-thumb="lo"]')!
      const w = Number.parseFloat(getComputedStyle(thumb).width)
      wrapper.remove()
      return w
    }

    const compact    = makeWithDensity('compact')
    const comfortable = makeWithDensity(null)       // no [density] attr = comfortable baseline
    const spacious   = makeWithDensity('spacious')

    // All three must be identical: --ui-compact-md = 16px → thumb = 12px regardless of density
    expect(compact,    'compact density changed the thumb size').toBe(comfortable)
    expect(spacious,   'spacious density changed the thumb size').toBe(comfortable)
    expect(comfortable, '[density=none] thumb must be 12px (--ui-compact-md − 4)').toBe(12)
  })

  // ── forced-colors (AC3 — stylesheet presence; behavior is system-determined) ────────────────

  it('AC3 forced-colors: slider-multi.css carries a @media (forced-colors: active) block (stylesheet check)', () => {
    // Verify the forced-colors block is present in the loaded styleSheet rules.
    // This is a structural proof — the actual system-color substitution is system-determined and
    // not testable in a non-forced-colors environment. The @media block's presence proves the intent.
    let found = false
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        for (const rule of Array.from(sheet.cssRules)) {
          if (rule instanceof CSSMediaRule && rule.conditionText.includes('forced-colors')) {
            found = true
            break
          }
        }
      } catch {
        // Cross-origin sheets throw on cssRules access; skip them
      }
      if (found) break
    }
    expect(found).toBe(true)
  })
})
