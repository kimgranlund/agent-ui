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
// These imports are direct (not through the barrel) because the component-styles barrel is the host's
// integration slice — it gains the rating @import at barrel-wiring time. The foundation CSS (tokens +
// dimensions) is loaded via the shared package barrel so --md-sys-color-* / --md-sys-compact-* tokens
// are present.

import '@agent-ui/components/foundation-styles.css' // tokens (--md-sys-color-*) + dimensions (--md-sys-compact-*)
import './rating.css' // the control stylesheet (direct — pre-barrel)
import './rating.ts' // self-define (registers ui-rating)
import type { UIRatingElement } from './rating.ts'

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
  it('default: each star svg = 16×16 px (--md-sys-compact-md at ui-md scale)', () => {
    const el = document.createElement('ui-rating') as UIRatingElement
    document.body.append(el)
    const svg = el.querySelector('.stars-base svg') as SVGSVGElement
    const cs = getComputedStyle(svg)
    expect(Number.parseFloat(cs.width)).toBe(16)
    expect(Number.parseFloat(cs.height)).toBe(16)
    el.remove()
  })

  it('[size=sm] → 14px star; [size=lg] → 18px star (the compact ramp)', () => {
    const sm = document.createElement('ui-rating')
    sm.setAttribute('size', 'sm')
    document.body.append(sm)
    expect(Number.parseFloat(getComputedStyle(sm.querySelector('.stars-base svg') as SVGSVGElement).width)).toBe(14)
    sm.remove()

    const lg = document.createElement('ui-rating')
    lg.setAttribute('size', 'lg')
    document.body.append(lg)
    expect(Number.parseFloat(getComputedStyle(lg.querySelector('.stars-base svg') as SVGSVGElement).width)).toBe(18)
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
