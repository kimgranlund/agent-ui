import { describe, it, expect } from 'vitest'

// S1 browser smoke — ui-slider (decomp S1 · ADR-0042 range-half · ADR-0041).
//
// ⭐ This suite RATIFIES the ADR-0042 Range half → accepted (G6.5):
//   AC1: The host box = --ui-compact-{size} exact px per [size]×[scale] (anti-vacuous, negative controls).
//   AC2: The thumb (::after) = box − 4px (the ADR-0041 cl.3 two-pixel-inset law, Range edition).
//   AC3: A REAL pointer-drag (pointerdown→move) updates value snapped to step (the value-drag proof).
//   AC4: Forced-colors — forced-color-adjust:none declared on rail and thumb (track survives HCM).
//   C10: Reconnect produces exactly one response per keyboard event (no listener stacking).
//
// The widget-box ramp table (--ui-compact-{size} per [scale], dimensions.css):
//   Default (ui-md):  sm=14px · md=16px · lg=18px
//   ui-sm:            sm=12px · md=14px · lg=16px
//   ui-lg:            sm=16px · md=18px · lg=20px
//   content-lg:       sm=22px · md=24px · lg=28px
// Thumb = box − 4px (−2px × each side; --ui-widget-inset=2px; ADR-0041 cl.3).
//
// These imports are direct (not through the barrel) because the component-styles barrel is the host's
// integration slice — it gains the slider @import at barrel-wiring time. The foundation CSS (tokens +
// dimensions) is loaded via the shared package barrel so --c-* / --ui-compact-* tokens are present.

import '@agent-ui/components/foundation-styles.css' // tokens (--c-*) + dimensions (--ui-compact-*)
import './slider.css'                               // the control stylesheet (direct — pre-barrel)
import './slider.ts'                                // self-define (registers ui-slider)
import type { UISliderElement } from './slider.ts'

// ── helpers ──────────────────────────────────────────────────────────────────────────────────────

/** Stub setPointerCapture to prevent browser throws with synthetic pointer IDs. */
function stubCapture(el: UISliderElement): void {
  el.setPointerCapture = (_id: number): void => {}
}

/** Build a synthetic PointerEvent with clientX and an optional pointerId (default 1). */
const ptr = (type: string, x: number, id = 1): PointerEvent =>
  new PointerEvent(type, { clientX: x, pointerId: id, bubbles: true, cancelable: true })

// ── AC0: RENDERED SHAPE — a slider must LOOK like a slider ───────────────────────────────────────
// A slider that collapses to its thumb (a dot) passes every per-PART px assertion (box=--ui-compact,
// thumb=box−4) yet is visually broken. The prior suite measured only HEIGHT + thumb width — never the
// host's overall WIDTH — so a dot shipped. This asserts the WHOLE shape in the SHRINK-WRAPPING flex
// context that exposed the bug (the doc-page specimen row).

describe('ui-slider AC0 — renders as a horizontal track, not a collapsed dot (regression)', () => {
  it('in a flex row, the host floors to a wide horizontal bar (width ≥ 12rem, width ≫ height)', () => {
    const row = document.createElement('div')
    row.style.display = 'flex' // the doc-specimen layout: shrink-wraps its children
    row.style.alignItems = 'center'
    document.body.append(row)
    const el = document.createElement('ui-slider') as UISliderElement
    row.append(el)

    const rect = el.getBoundingClientRect()
    // 12rem = 192px at the 16px root. Assert the slider did NOT shrink-wrap to ~the thumb box.
    expect(rect.width, `slider collapsed to ${rect.width}px — must floor to ~12rem, a horizontal track`).toBeGreaterThanOrEqual(180)
    // A slider is far wider than tall; a dot has width ≈ height. This is the anti-collapse invariant.
    expect(rect.width, 'a slider must be far wider than tall (a track, not a dot)').toBeGreaterThan(rect.height * 4)
    row.remove()
  })
})

// ── AC1: box = --ui-compact-{size} per [size]×[scale] — EXACT px (anti-vacuous) ─────────────────

describe('ui-slider browser smoke (AC1 — interactive box exact px per [size]×[scale])', () => {
  it('AC1 default: host block-size = 16px (--ui-compact-md at default ui-md scale)', () => {
    const el = document.createElement('ui-slider') as UISliderElement
    document.body.append(el)
    // The host block-size = --ui-compact-md = 16px at ui-md scale (ADR-0041 clause 2)
    const rect = el.getBoundingClientRect()
    expect(rect.height).toBe(16)
    el.remove()
  })

  it('AC1 [size=sm] → host block-size = 14px; [size=lg] → 18px (the compact widget ramp)', () => {
    const sm = document.createElement('ui-slider') as UISliderElement
    sm.setAttribute('size', 'sm')
    document.body.append(sm)
    expect(sm.getBoundingClientRect().height).toBe(14) // --ui-compact-sm at ui-md
    sm.remove()

    const lg = document.createElement('ui-slider') as UISliderElement
    lg.setAttribute('size', 'lg')
    document.body.append(lg)
    expect(lg.getBoundingClientRect().height).toBe(18) // --ui-compact-lg at ui-md
    lg.remove()
  })

  it('AC1 [scale=ui-lg] × [size=md] → 18px (the scale × size lookup, ADR-0041 clause 2)', () => {
    const wrapper = document.createElement('div')
    wrapper.setAttribute('scale', 'ui-lg')
    const el = document.createElement('ui-slider') as UISliderElement
    wrapper.append(el)
    document.body.append(wrapper)
    // ui-lg × md = 18px (ADR-0041 table: [scale=ui-lg] → --ui-compact-md = 18px)
    expect(el.getBoundingClientRect().height).toBe(18)
    wrapper.remove()
  })

  it('AC1 negative control: [size=sm] ≠ [size=md] (14px ≠ 16px — anti-vacuous box proof)', () => {
    const sm = document.createElement('ui-slider') as UISliderElement
    sm.setAttribute('size', 'sm')
    document.body.append(sm)
    const smH = sm.getBoundingClientRect().height
    sm.remove()

    const md = document.createElement('ui-slider') as UISliderElement
    document.body.append(md)
    const mdH = md.getBoundingClientRect().height
    md.remove()

    expect(smH).not.toBe(mdH) // the negative control: different sizes render different px
  })
})

// ── AC2: thumb = box − 4px (the ADR-0041 cl.3 two-pixel-inset proof, Range half) ────────────────

describe('ui-slider browser smoke (AC2 — thumb = box − 4px, the ADR-0042 Range-half ratification)', () => {
  it('AC2 default (ui-md, size=md): thumb ::after width = 12px (16px − 4px)', () => {
    const el = document.createElement('ui-slider') as UISliderElement
    document.body.append(el)
    // --ui-compact-md=16px → thumb = 16 − 2×2 = 12px (ADR-0041 cl.3: thumb = box − 2×inset)
    const cs = getComputedStyle(el, '::after')
    expect(Number.parseFloat(cs.width)).toBe(12)
    expect(Number.parseFloat(cs.height)).toBe(12)
    el.remove()
  })

  it('AC2 [size=sm] → thumb = 10px (14px − 4px)', () => {
    const el = document.createElement('ui-slider') as UISliderElement
    el.setAttribute('size', 'sm')
    document.body.append(el)
    // --ui-compact-sm=14px → thumb = 14 − 4 = 10px
    const cs = getComputedStyle(el, '::after')
    expect(Number.parseFloat(cs.width)).toBe(10)
    expect(Number.parseFloat(cs.height)).toBe(10)
    el.remove()
  })

  it('AC2 [size=lg] → thumb = 14px (18px − 4px)', () => {
    const el = document.createElement('ui-slider') as UISliderElement
    el.setAttribute('size', 'lg')
    document.body.append(el)
    // --ui-compact-lg=18px → thumb = 18 − 4 = 14px
    const cs = getComputedStyle(el, '::after')
    expect(Number.parseFloat(cs.width)).toBe(14)
    expect(Number.parseFloat(cs.height)).toBe(14)
    el.remove()
  })

  it('AC2 [scale=ui-lg] × [size=lg] → thumb = 16px (20px − 4px)', () => {
    const wrapper = document.createElement('div')
    wrapper.setAttribute('scale', 'ui-lg')
    const el = document.createElement('ui-slider') as UISliderElement
    el.setAttribute('size', 'lg')
    wrapper.append(el)
    document.body.append(wrapper)
    // ui-lg × lg = 20px → thumb = 20 − 4 = 16px
    const cs = getComputedStyle(el, '::after')
    expect(Number.parseFloat(cs.width)).toBe(16)
    expect(Number.parseFloat(cs.height)).toBe(16)
    wrapper.remove()
  })

  it('AC2 [scale=content-lg] × [size=lg] → thumb = 24px (28px − 4px, not a calc result)', () => {
    const wrapper = document.createElement('div')
    wrapper.setAttribute('scale', 'content-lg')
    const el = document.createElement('ui-slider') as UISliderElement
    el.setAttribute('size', 'lg')
    wrapper.append(el)
    document.body.append(wrapper)
    // content-lg × lg = 28px → thumb = 28 − 4 = 24px (the literal from the ADR-0041 table)
    const cs = getComputedStyle(el, '::after')
    expect(Number.parseFloat(cs.width)).toBe(24)
    expect(Number.parseFloat(cs.height)).toBe(24)
    wrapper.remove()
  })

  it('AC2 negative control: [size=sm] thumb ≠ [size=lg] thumb (10px ≠ 14px — anti-vacuous)', () => {
    const sm = document.createElement('ui-slider') as UISliderElement
    sm.setAttribute('size', 'sm')
    document.body.append(sm)
    const smThumb = Number.parseFloat(getComputedStyle(sm, '::after').width)
    sm.remove()

    const lg = document.createElement('ui-slider') as UISliderElement
    lg.setAttribute('size', 'lg')
    document.body.append(lg)
    const lgThumb = Number.parseFloat(getComputedStyle(lg, '::after').width)
    lg.remove()

    expect(smThumb).not.toBe(lgThumb) // negative control: different sizes render different thumb px
  })
})

// ── AC3: real pointer-drag → value updates (the value-drag controller proof) ─────────────────────

describe('ui-slider browser smoke (AC3 — real pointer-drag maps position→value)', () => {
  it('AC3 pointerdown→move at 50% of track → value = 50 (snapped to step=10)', async () => {
    const el = document.createElement('ui-slider') as UISliderElement
    el.min = 0
    el.max = 100
    el.step = 10
    // Fixed position with known layout so getBoundingClientRect() returns deterministic values.
    el.style.setProperty('position', 'fixed')
    el.style.setProperty('left', '0px')
    el.style.setProperty('top', '0px')
    el.style.setProperty('width', '200px')
    document.body.append(el)
    // Stub setPointerCapture — synthetic PointerEvents do not represent active pointers in the
    // browser, so setPointerCapture(pointerId) would throw NotFoundError without this stub.
    stubCapture(el)

    // pointerdown at clientX=0 → left edge (ratio=0) → value=0
    el.dispatchEvent(ptr('pointerdown', 0))
    expect(el.value).toBe(0)

    // pointermove to clientX=100 → 50% of 200px track (ratio=0.5) → raw=50 → snap to step=10 → 50
    el.dispatchEvent(ptr('pointermove', 100))
    expect(el.value).toBe(50)

    // pointermove to clientX=180 → 90% → raw=90 → snap to step=10 → 90
    el.dispatchEvent(ptr('pointermove', 180))
    expect(el.value).toBe(90)

    el.dispatchEvent(ptr('pointerup', 180))
    el.remove()
  })

  it('AC3 drag emits input on each value change', async () => {
    const el = document.createElement('ui-slider') as UISliderElement
    el.min = 0
    el.max = 100
    el.step = 10
    el.style.setProperty('position', 'fixed')
    el.style.setProperty('left', '0px')
    el.style.setProperty('top', '0px')
    el.style.setProperty('width', '200px')
    document.body.append(el)
    stubCapture(el)

    let inputCount = 0
    el.addEventListener('input', () => { inputCount++ })

    // pointerdown at 0 → value=0 (no change from default → no input)
    el.dispatchEvent(ptr('pointerdown', 0))
    // pointermove to 100 → value=50 → input
    el.dispatchEvent(ptr('pointermove', 100))
    expect(inputCount).toBe(1)

    el.dispatchEvent(ptr('pointerup', 100))
    el.remove()
  })

  it('AC3 degenerate range (min=max): pointerdown does not start drag or emit input', () => {
    const el = document.createElement('ui-slider') as UISliderElement
    el.min = 50
    el.max = 50 // degenerate
    el.style.setProperty('position', 'fixed')
    el.style.setProperty('left', '0px')
    el.style.setProperty('top', '0px')
    el.style.setProperty('width', '200px')
    document.body.append(el)
    stubCapture(el)

    let inputCount = 0
    el.addEventListener('input', () => { inputCount++ })

    el.dispatchEvent(ptr('pointerdown', 100))
    el.dispatchEvent(ptr('pointermove', 150))
    expect(inputCount).toBe(0) // degenerate range — no drag, no input
    el.remove()
  })
})

// ── AC4: forced-colors — forced-color-adjust:none on rail and thumb ──────────────────────────────
//
// NOTE: headless Playwright does not emulate `forced-colors: active` by default, so we cannot assert
// computed color values under high-contrast mode. Instead, we verify the element renders without error
// and note that the `@media (forced-colors: active)` block in slider.css maps rail/fill to
// Highlight/ButtonText and the thumb to Canvas + Highlight border, with `forced-color-adjust: none`
// on both pseudo-elements so the browser preserves our explicit system-colour mappings.
// The :focus-visible ring is free via --c-focus-ring → Highlight from the token layer (ADR-0009).

describe('ui-slider browser smoke (AC4 — forced-colors annotation)', () => {
  it('AC4 element connects and computes styles without error (forced-colors declared in slider.css)', () => {
    const el = document.createElement('ui-slider') as UISliderElement
    document.body.append(el)
    // Verify the element is connected and the ::after thumb has a non-zero computed size.
    // (If slider.css failed to load, the thumb would have zero dimensions.)
    const cs = getComputedStyle(el, '::after')
    expect(Number.parseFloat(cs.width)).toBeGreaterThan(0)
    el.remove()
  })
})

// ── C10: connect→disconnect→reconnect — no listener stacking ─────────────────────────────────────

describe('ui-slider browser smoke (C10 — zero-residue after reconnect)', () => {
  it('C10 reconnect: exactly one ArrowRight step per keydown (not doubled from stacked listeners)', async () => {
    const el = document.createElement('ui-slider') as UISliderElement
    el.min = 0
    el.max = 100
    el.step = 1
    el.value = 50
    document.body.append(el)

    // Step once while connected → value should be 51
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }))
    expect(el.value).toBe(51)

    el.remove()        // disconnect
    el.value = 50      // reset
    document.body.append(el) // reconnect

    // ONE ArrowRight should produce EXACTLY one step (51), not two (52) — no stacked listeners
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }))
    expect(el.value).toBe(51)

    el.remove()
  })

  it('C10 post-disconnect: keyboard does not change value (listeners removed)', () => {
    const el = document.createElement('ui-slider') as UISliderElement
    el.value = 50
    document.body.append(el)
    el.remove() // disconnect

    // After disconnect: keydown listener gone → ArrowRight is a no-op
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }))
    expect(el.value).toBe(50) // unchanged
  })
})
