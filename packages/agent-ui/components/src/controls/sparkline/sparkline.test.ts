import { describe, it, expect } from 'vitest'
import { UISparklineElement } from './sparkline.ts'
import { sparklineSummary, sparklineGeometry, cleanSeries } from './sparkline-math.ts'

// sparkline.test.ts — LLD-C2 jsdom behaviour probes (props/attributes, ElementInternals ARIA, DOM shape).
// jsdom is blind to painted SVG geometry (SPEC-N2) — the whole-shape/resize/RTL/WHCM proofs live in
// sparkline.browser.test.ts; this file covers everything jsdom CAN see: prop typing, attribute reflection,
// internals.role/ariaLabel, and the DOM structure the mark effect builds.

// A throwaway subclass re-exposing the protected `internals` — the icon.ts precedent (icon.test.ts).
class ProbeSparkline extends UISparklineElement {
  get probeInternals(): ElementInternals {
    return this.internals
  }
}
customElements.define('ui-sparkline-probe', ProbeSparkline)

describe('UISparklineElement — upgrade + typed props', () => {
  it('defaults: values=[], label="", variant="line"', () => {
    const el = document.createElement('ui-sparkline') as UISparklineElement
    expect(el).toBeInstanceOf(UISparklineElement)
    expect(el.values).toEqual([])
    expect(el.label).toBe('')
    expect(el.variant).toBe('line')
  })

  it('self-defines as ui-sparkline, guarded against double-define', () => {
    expect(customElements.get('ui-sparkline')).toBe(UISparklineElement)
    expect(() => {
      if (!customElements.get('ui-sparkline')) customElements.define('ui-sparkline', UISparklineElement)
    }).not.toThrow()
  })

  it('AC1 — a values="[…]" attribute upgrades to the typed array', () => {
    const el = document.createElement('ui-sparkline') as UISparklineElement
    el.setAttribute('values', '[3,5,4,8,7]')
    document.body.append(el)
    expect(el.values).toEqual([3, 5, 4, 8, 7])
    el.remove()
  })

  it('variant snaps an unknown attribute value back to "line" (enumType fallback)', () => {
    const el = document.createElement('ui-sparkline') as UISparklineElement
    el.setAttribute('variant', 'pie') // not a member of ['line','area']
    document.body.append(el)
    expect(el.variant).toBe('line')
    el.remove()
  })
})

describe('UISparklineElement — role=img is constant; ariaLabel is the generated summary (SPEC-R4)', () => {
  it('role=img via internals — set even with no values and no label (no silent state)', () => {
    const el = new ProbeSparkline()
    document.body.append(el)
    expect(el.probeInternals.role).toBe('img')
    expect(el.probeInternals.ariaLabel).toBe('no data')
    el.remove()
  })

  it('ariaLabel matches sparklineSummary(label, geometry) exactly for a populated series', () => {
    const el = new ProbeSparkline()
    el.label = 'Revenue trend'
    el.values = [3, 5, 4, 8, 7]
    document.body.append(el)
    const expected = sparklineSummary('Revenue trend', sparklineGeometry(cleanSeries([3, 5, 4, 8, 7])))
    expect(el.probeInternals.ariaLabel).toBe(expected)
    expect(el.probeInternals.ariaLabel).toBe('Revenue trend: 5 points, starts 3, ends 7, low 3, high 8')
    el.remove()
  })

  it('ariaLabel recomputes when values changes post-connect', async () => {
    const el = new ProbeSparkline()
    document.body.append(el)
    expect(el.probeInternals.ariaLabel).toBe('no data')
    el.values = [42]
    await el.updateComplete // effects are microtask-batched
    expect(el.probeInternals.ariaLabel).toBe('1 point, value 42')
    el.remove()
  })

  it('ariaLabel recomputes when label changes post-connect (values unchanged)', async () => {
    const el = new ProbeSparkline()
    el.values = [1, 2]
    document.body.append(el)
    el.label = 'Trend'
    await el.updateComplete
    expect(el.probeInternals.ariaLabel).toBe('Trend: 2 points, starts 1, ends 2, low 1, high 2')
    el.remove()
  })

  it('role never flips to aria-hidden and ariaLabel is never null, even for an empty series', () => {
    const el = new ProbeSparkline()
    el.values = []
    document.body.append(el)
    expect(el.probeInternals.role).toBe('img')
    expect(el.probeInternals.ariaHidden).not.toBe('true')
    expect(el.probeInternals.ariaLabel).not.toBeNull()
    el.remove()
  })
})

describe('UISparklineElement — mark DOM shape (LLD-C2)', () => {
  it('an empty rendered set clears the host (no svg child)', () => {
    const el = document.createElement('ui-sparkline') as UISparklineElement
    document.body.append(el)
    expect(el.querySelector('svg')).toBeNull()
    expect(el.childElementCount).toBe(0)
    el.remove()
  })

  it('a populated series injects a normalized, aria-hidden svg with a line polyline', () => {
    const el = document.createElement('ui-sparkline') as UISparklineElement
    el.values = [3, 5, 4, 8, 7]
    document.body.append(el)
    const svg = el.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg?.getAttribute('viewBox')).toBe('0 0 100 100')
    expect(svg?.getAttribute('preserveAspectRatio')).toBe('none')
    expect(svg?.getAttribute('aria-hidden')).toBe('true') // the svg never double-announces; the HOST carries role=img
    expect(svg?.getAttribute('focusable')).toBe('false')

    const line = el.querySelector('[data-part="line"]')
    expect(line).not.toBeNull()
    expect(line?.tagName.toLowerCase()).toBe('polyline')
    expect(line?.getAttribute('fill')).toBe('none')
    expect(line?.getAttribute('stroke')).toBe('currentColor')
    expect(line?.getAttribute('vector-effect')).toBe('non-scaling-stroke')

    expect(el.querySelector('[data-part="area"]')).toBeNull() // variant="line" (default) → no area
    el.remove()
  })

  it('variant="area" adds a fill polygon UNDER the stroke (only when count >= 2)', () => {
    const el = document.createElement('ui-sparkline') as UISparklineElement
    el.variant = 'area'
    el.values = [3, 5, 4]
    document.body.append(el)
    const svg = el.querySelector('svg') as SVGSVGElement
    const area = el.querySelector('[data-part="area"]')
    expect(area).not.toBeNull()
    expect(area?.tagName.toLowerCase()).toBe('polygon')
    expect(area?.getAttribute('fill')).toBe('currentColor')
    expect(area?.getAttribute('stroke')).toBe('none')
    // area comes before line in document order ("under the stroke" — painted first)
    const children = [...svg.children]
    expect(children.indexOf(area as Element)).toBeLessThan(children.findIndex((c) => c.getAttribute('data-part') === 'line'))
    el.remove()
  })

  it('variant="area" with n=1 (no area — SPEC-R3 row 3: a dot has no shape to close)', () => {
    const el = document.createElement('ui-sparkline') as UISparklineElement
    el.variant = 'area'
    el.values = [7]
    document.body.append(el)
    expect(el.querySelector('[data-part="area"]')).toBeNull()
    expect(el.querySelector('[data-part="line"]')).not.toBeNull()
    el.remove()
  })

  it('a property write of garbage never reaches the render path (SPEC-R3 AC2 — property, not just attribute)', async () => {
    const el = document.createElement('ui-sparkline') as UISparklineElement
    document.body.append(el)
    // @ts-expect-error — deliberately garbage input to prove the render-boundary cleanSeries call
    el.values = [1, null, 2, 'x', Number.NaN]
    await el.updateComplete
    const line = el.querySelector('[data-part="line"]')
    expect(line?.getAttribute('points')).toBe('0,100 100,0') // rendered set = [1,2] → 2 points
    el.remove()
  })

  it('whole-array swap: a change to values rebuilds the mark via one replaceChildren (no leftover nodes)', async () => {
    const el = document.createElement('ui-sparkline') as UISparklineElement
    el.variant = 'area'
    el.values = [1, 2, 3]
    document.body.append(el)
    await el.updateComplete
    expect(el.childElementCount).toBe(1) // just the svg
    expect(el.querySelector('svg')?.childElementCount).toBe(2) // area + line
    el.values = [4]
    await el.updateComplete
    expect(el.childElementCount).toBe(1)
    expect(el.querySelector('svg')?.childElementCount).toBe(1) // n=1 → line only, no area
    el.remove()
  })
})
