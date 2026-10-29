import { describe, it, expect } from 'vitest'

// rating.browser.test.ts — ui-rating browser smoke (ADR-0216; GH #1395).
//
// Probes: the star box = --md-sys-compact-{size} per [size] (the widget-box ramp, ADR-0041); the WHOLE
// rendered bounding box in a realistic container is non-trivial (the whole-shape law — per-part px can
// all pass while the control collapses to a dot); a REAL pointer-drag on `.stars` updates `value`
// (the valueDrag proof, the slider.browser.test.ts AC3 precedent); readonly/disabled both render
// `pointer-events: none` on `.stars`; forced-colors (manual — the Playwright browser does not emulate
// `forced-colors: active` in headless runs, so that branch is verified by reading only, the checkbox/
// slider browser-test precedent).
//
// These imports are direct (not through the barrel) because the retired component-styles CSS barrel (ADR-0233) is the host's
// integration slice — it gains the rating @import at barrel-wiring time. The foundation CSS (tokens +
// dimensions) is loaded via the shared package barrel so --md-sys-color-* / --md-sys-compact-* tokens
// are present.

import '@agent-ui/components/foundation-styles.css' // tokens (--md-sys-color-*) + dimensions (--md-sys-compact-*)
import './rating.css' // the control stylesheet (direct — pre-barrel)
import './rating.ts' // self-define (registers ui-rating)
import type { UIRatingElement } from './rating.ts'
import { rootResolve } from '../../../../../../scripts/lib/foundations-model.mjs'

function stars(el: Element): HTMLElement {
  return el.querySelector('.stars') as HTMLElement
}

function stubCapture(el: UIRatingElement): void {
  stars(el).setPointerCapture = (_id: number): void => {}
}

const ptr = (el: UIRatingElement, type: string, x: number, id = 1): PointerEvent => {
  const event = new PointerEvent(type, { clientX: x, pointerId: id, bubbles: true, cancelable: true })
  stars(el).dispatchEvent(event)
  return event
}

describe('ui-rating browser smoke — widget-box geometry (ADR-0041)', () => {
  it('default: each star svg = the md icon box 2n (ADR-0245 cl.3, root register product / md)', () => {
    const el = document.createElement('ui-rating') as UIRatingElement
    document.body.append(el)
    const svg = el.querySelector('.stars-base svg') as SVGSVGElement
    const cs = getComputedStyle(svg)
    expect(Number.parseFloat(cs.width)).toBe(rootResolve('md').iconBox)
    expect(Number.parseFloat(cs.height)).toBe(rootResolve('md').iconBox)
    el.remove()
  })

  it('[size=sm] and [size=lg] star = the derived icon box at that size', () => {
    const sm = document.createElement('ui-rating')
    sm.setAttribute('size', 'sm')
    document.body.append(sm)
    expect(Number.parseFloat(getComputedStyle(sm.querySelector('.stars-base svg') as SVGSVGElement).width)).toBe(rootResolve('sm').iconBox)
    sm.remove()

    const lg = document.createElement('ui-rating')
    lg.setAttribute('size', 'lg')
    document.body.append(lg)
    expect(Number.parseFloat(getComputedStyle(lg.querySelector('.stars-base svg') as SVGSVGElement).width)).toBe(rootResolve('lg').iconBox)
    lg.remove()
  })
})

describe('ui-rating browser smoke — whole-shape law', () => {
  it('the WHOLE rendered box (5 stars, default size) is non-trivial in a realistic container', () => {
    const container = document.createElement('div')
    container.style.inlineSize = '300px'
    const el = document.createElement('ui-rating') as UIRatingElement
    container.append(el)
    document.body.append(container)

    const rect = el.getBoundingClientRect()
    // 5 stars × 16px + 4 gaps × 4px (--md-sys-space-xs) = 80 + 16 = 96px floor for the stars row alone;
    // assert comfortably below that so the probe is not brittle to a gap-token repoint, but well above
    // the "collapsed to a dot" failure class (test-the-whole-shape).
    expect(rect.width).toBeGreaterThan(60)
    expect(rect.height).toBeGreaterThan(0)

    container.remove()
  })

  it('changing max to 10 widens the rendered stars track', async () => {
    const el = document.createElement('ui-rating') as UIRatingElement
    el.max = 5
    document.body.append(el)
    await el.updateComplete
    const narrow = stars(el).getBoundingClientRect().width

    el.max = 10
    await el.updateComplete // the star-count effect rebuilds the rows reactively — await the settle
    const wide = stars(el).getBoundingClientRect().width
    expect(wide).toBeGreaterThan(narrow)

    el.remove()
  })
})

describe('ui-rating browser smoke — pointer pick (valueDrag proof)', () => {
  it('a REAL pointerdown+move on .stars updates value, snapped to step, and emits input', () => {
    const el = document.createElement('ui-rating') as UIRatingElement
    el.max = 5
    el.step = 1
    document.body.append(el)
    stubCapture(el)

    let inputCount = 0
    el.addEventListener('input', () => { inputCount++ })

    const rect = stars(el).getBoundingClientRect()
    const midX = rect.left + rect.width / 2
    ptr(el, 'pointerdown', midX)

    expect(el.value).toBeGreaterThan(0)
    expect(el.value).toBeLessThanOrEqual(5)
    expect(Number.isInteger(el.value)).toBe(true) // step=1 snap
    expect(inputCount).toBeGreaterThan(0)

    ptr(el, 'pointerup', midX)
    el.remove()
  })

  it('degenerate range (min===max) — pointerdown does not throw, emits no input', () => {
    const el = document.createElement('ui-rating') as UIRatingElement
    el.min = 5
    el.max = 5
    document.body.append(el)
    stubCapture(el)
    let inputCount = 0
    el.addEventListener('input', () => { inputCount++ })
    const rect = stars(el).getBoundingClientRect()
    expect(() => ptr(el, 'pointerdown', rect.left + rect.width / 2)).not.toThrow()
    expect(inputCount).toBe(0)
    el.remove()
  })
})

describe('ui-rating browser smoke — pointer commit (ADR-0216 Amendment 1, GH #1438)', () => {
  it('a REAL pointer tap on an UNFOCUSED host fires `change` on pointerup (S1 fix, GH #1438) — real order: pointerdown → focus (the mousedown default action) → pointerup', () => {
    const el = document.createElement('ui-rating') as UIRatingElement
    el.max = 5
    el.step = 1
    document.body.append(el)
    stubCapture(el)

    let changeCount = 0
    let inputCount = 0
    let valueAtChange: number | null | undefined
    el.addEventListener('input', () => { inputCount++ })
    el.addEventListener('change', () => {
      changeCount++
      valueAtChange = el.value // Fork order — value already committed by the time `change` fires
    })

    const rect = stars(el).getBoundingClientRect()
    const midX = rect.left + rect.width / 2

    // The host is deliberately NOT focused before this — the real gesture order on a not-yet-focused
    // control is pointerdown → (mousedown default action) focus → pointerup, NOT focus-then-pointerdown.
    ptr(el, 'pointerdown', midX)
    expect(inputCount).toBeGreaterThan(0) // valueDrag's onValue already wrote `value` synchronously

    el.focus() // the mousedown default action, landing AFTER the pointerdown write — mid-gesture
    expect(changeCount).toBe(0) // the NOTIFICATION has not fired yet — pointerup hasn't happened

    ptr(el, 'pointerup', midX)
    expect(changeCount).toBe(1) // the first tap on an unfocused host DOES report (the S1 regression)
    expect(valueAtChange).toBe(el.value)

    el.remove()
  })

  it('keyboard commit is unaffected — `change` still waits for blur, not the arrow-step itself', () => {
    const el = document.createElement('ui-rating') as UIRatingElement
    el.value = 2
    document.body.append(el)
    el.focus()

    let changeCount = 0
    el.addEventListener('change', () => { changeCount++ })

    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }))
    expect(el.value).toBe(3)
    expect(changeCount).toBe(0) // base range law — no change yet, this control still has focus

    el.dispatchEvent(new FocusEvent('blur'))
    expect(changeCount).toBe(1) // commits on blur, exactly as before this amendment

    el.remove()
  })
})

describe('ui-rating browser smoke — readonly/disabled inert the star track (ADR-0216 cl.4)', () => {
  it('readonly renders pointer-events:none on .stars (CSS-level write-path inert)', () => {
    const el = document.createElement('ui-rating') as UIRatingElement
    el.readonly = true
    document.body.append(el)
    expect(getComputedStyle(stars(el)).pointerEvents).toBe('none')
    el.remove()
  })

  it('disabled renders pointer-events:none on .stars', () => {
    const el = document.createElement('ui-rating') as UIRatingElement
    el.disabled = true
    document.body.append(el)
    expect(getComputedStyle(stars(el)).pointerEvents).toBe('none')
    el.remove()
  })

  it('the default (neither readonly nor disabled) leaves .stars pointer-interactive', () => {
    const el = document.createElement('ui-rating') as UIRatingElement
    document.body.append(el)
    expect(getComputedStyle(stars(el)).pointerEvents).not.toBe('none')
    el.remove()
  })
})

// ── forced-colors — annotation only (headless Playwright does not emulate forced-colors: active) ────
//
// The `@media (forced-colors: active)` block in rating.css re-points `.stars-base`/`.stars-fill`'s
// `color` to GrayText/CanvasText with `forced-color-adjust: none`; both svgs keep `fill: currentColor`
// unconditionally, so a real high-contrast pass repaints the mark via that single re-point. Verified
// here by rendering without error (the checkbox/slider browser-test precedent).

describe('ui-rating browser smoke (forced-colors annotation)', () => {
  it('element connects and computes styles without error (forced-colors declared in rating.css)', () => {
    const el = document.createElement('ui-rating') as UIRatingElement
    document.body.append(el)
    const svg = el.querySelector('.stars-fill svg') as SVGSVGElement
    const cs = getComputedStyle(svg)
    expect(Number.parseFloat(cs.width)).toBeGreaterThan(0)
    el.remove()
  })
})

// ── dir=rtl (T-0540): the filled stars, the pointer and the arrow keys all follow the reading direction ──
//
// Under rtl the star row starts at the physical right. The fill row's clip must keep the SAME stars the
// pointer (valueDrag, T-0538) and the value mean: value 2 of 5 fills the two rightmost stars, and
// ArrowLeft steps toward max. Each leg runs the ltr twin as its regression control.

describe('ui-rating under dir=rtl (T-0540: fill clip and arrow keys mirror)', () => {
  function mount(dir: 'ltr' | 'rtl', value: number): { wrap: HTMLDivElement; el: UIRatingElement } {
    const wrap = document.createElement('div')
    wrap.dir = dir
    wrap.style.cssText = 'position: fixed; left: 0; top: 0; width: 400px'
    const el = document.createElement('ui-rating') as UIRatingElement
    el.max = 5
    el.step = 1
    el.value = value
    wrap.append(el)
    document.body.append(wrap)
    stubCapture(el)
    return { wrap, el }
  }

  /** Which of the five stars (by physical left-to-right position) the fill row paints, by hit-testing each centre. */
  function filledPositions(el: UIRatingElement): boolean[] {
    const svgs = [...el.querySelectorAll<SVGSVGElement>('.stars-base svg')]
    return svgs
      .map((svg) => svg.getBoundingClientRect())
      .sort((a, b) => a.left - b.left)
      .map((r) => {
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
        return hit?.closest('.stars-fill') != null
      })
  }

  it('value 2 fills the two stars at the reading start: the left two under ltr, the right two under rtl', () => {
    const ltr = mount('ltr', 2)
    expect(filledPositions(ltr.el), 'ltr').toEqual([true, true, false, false, false])
    ltr.wrap.remove()
    const rtl = mount('rtl', 2)
    expect(filledPositions(rtl.el), 'rtl').toEqual([false, false, false, true, true])
    rtl.wrap.remove()
  })

  it('a press at the physical right end picks 5 under ltr; under rtl the rightmost star picks 1', () => {
    for (const dir of ['ltr', 'rtl'] as const) {
      const { wrap, el } = mount(dir, 0)
      const r = stars(el).getBoundingClientRect()
      const x = dir === 'ltr' ? r.right - 1 : r.right - 0.2 * r.width // rtl: the first star spans the right fifth
      ptr(el, 'pointerdown', x)
      ptr(el, 'pointerup', x)
      expect(el.value, dir).toBe(dir === 'ltr' ? 5 : 1)
      wrap.remove()
    }
  })

  it('ArrowLeft increments and ArrowRight decrements under rtl; ltr keeps the opposite; ArrowUp stays an increment', () => {
    const key = (el: UIRatingElement, k: string): void => {
      el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }))
    }
    const ltr = mount('ltr', 2)
    key(ltr.el, 'ArrowRight')
    expect(ltr.el.value, 'ltr ArrowRight').toBe(3)
    key(ltr.el, 'ArrowLeft')
    key(ltr.el, 'ArrowLeft')
    expect(ltr.el.value, 'ltr ArrowLeft').toBe(1)
    ltr.wrap.remove()

    const rtl = mount('rtl', 2)
    key(rtl.el, 'ArrowLeft')
    expect(rtl.el.value, 'rtl ArrowLeft steps toward max').toBe(3)
    key(rtl.el, 'ArrowRight')
    key(rtl.el, 'ArrowRight')
    expect(rtl.el.value, 'rtl ArrowRight steps toward min').toBe(1)
    key(rtl.el, 'ArrowUp')
    expect(rtl.el.value, 'ArrowUp stays an increment under rtl').toBe(2)
    rtl.wrap.remove()
  })
})
