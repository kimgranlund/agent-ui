import { describe, it, expect } from 'vitest'
import { UILineChartElement } from './line-chart.ts'
import { lineChartSummary, lineChartGeometry, cleanSeries } from './line-chart-math.ts'

// NOTE — the `variant="area"` fill attribute changed THIS wave (ADR-0229 cl.3's gradient-fill paint
// upgrade, booked not silent — the ADR-0228 pie-ramp-repoint precedent for an intentional byte change
// outside cl.1/cl.3's byte-untouched scope): `fill="currentColor"` → `fill="url(#<instance-id>)"`, plus a
// `<defs><linearGradient>` sibling. Every OTHER default-state assertion below (baseline, min/max rows,
// viewBox, line points, DOM child count for `variant="line"`) is UNCHANGED from before this wave.

// line-chart.test.ts — ADR-0205 jsdom behaviour probes (props/attributes, ElementInternals ARIA, DOM shape).
// jsdom is blind to painted SVG geometry — the whole-shape/resize/RTL/WHCM proofs live in
// line-chart.browser.test.ts; this file covers everything jsdom CAN see: prop typing, attribute reflection,
// internals.role/ariaLabel, and the COMPUTED svg + label DOM structure the mark effect builds (viewBox,
// polyline/polygon point data, the baseline line's position, and the min/max label text content).

// A throwaway subclass re-exposing the protected `internals` — the sparkline/bar-chart precedent.
class ProbeLineChart extends UILineChartElement {
  get probeInternals(): ElementInternals {
    return this.internals
  }
}
customElements.define('ui-line-chart-probe', ProbeLineChart)

describe('UILineChartElement — upgrade + typed props', () => {
  it('defaults: values=[], label="", variant="line", axes=false, labels=[], projected=0', () => {
    const el = document.createElement('ui-line-chart') as UILineChartElement
    expect(el).toBeInstanceOf(UILineChartElement)
    expect(el.values).toEqual([])
    expect(el.label).toBe('')
    expect(el.variant).toBe('line')
    expect(el.axes).toBe(false)
    expect(el.labels).toEqual([])
    expect(el.projected).toBe(0)
  })

  it('self-defines as ui-line-chart, guarded against double-define', () => {
    expect(customElements.get('ui-line-chart')).toBe(UILineChartElement)
    expect(() => {
      if (!customElements.get('ui-line-chart')) customElements.define('ui-line-chart', UILineChartElement)
    }).not.toThrow()
  })

  it('AC1 — a values="[…]" attribute upgrades to the typed array', () => {
    const el = document.createElement('ui-line-chart') as UILineChartElement
    el.setAttribute('values', '[3,5,4,8,7]')
    document.body.append(el)
    expect(el.values).toEqual([3, 5, 4, 8, 7])
    el.remove()
  })

  it('variant snaps an unknown attribute value back to "line" (enumType fallback)', () => {
    const el = document.createElement('ui-line-chart') as UILineChartElement
    el.setAttribute('variant', 'pie') // not a member of ['line','area']
    document.body.append(el)
    expect(el.variant).toBe('line')
    el.remove()
  })
})

describe('UILineChartElement — role=img is constant; ariaLabel is the generated summary (ADR-0205 cl.6)', () => {
  it('role=img via internals — set even with no values and no label (no silent state)', () => {
    const el = new ProbeLineChart()
    document.body.append(el)
    expect(el.probeInternals.role).toBe('img')
    expect(el.probeInternals.ariaLabel).toBe('no data')
    el.remove()
  })

  it('ariaLabel matches lineChartSummary(label, geometry) exactly for a populated series', () => {
    const el = new ProbeLineChart()
    el.label = 'Latency, p50'
    el.values = [3, 5, 4, 8, 7]
    document.body.append(el)
    const expected = lineChartSummary('Latency, p50', lineChartGeometry(cleanSeries([3, 5, 4, 8, 7])))
    expect(el.probeInternals.ariaLabel).toBe(expected)
    expect(el.probeInternals.ariaLabel).toBe('Latency, p50: 5 points, low 3, high 8')
    el.remove()
  })

  it('ariaLabel recomputes when values changes post-connect', async () => {
    const el = new ProbeLineChart()
    document.body.append(el)
    expect(el.probeInternals.ariaLabel).toBe('no data')
    el.values = [42]
    await el.updateComplete
    expect(el.probeInternals.ariaLabel).toBe('1 point, value 42')
    el.remove()
  })

  it('ariaLabel recomputes when label changes post-connect (values unchanged)', async () => {
    const el = new ProbeLineChart()
    el.values = [1, 2]
    document.body.append(el)
    el.label = 'Trend'
    await el.updateComplete
    expect(el.probeInternals.ariaLabel).toBe('Trend: 2 points, low 1, high 2')
    el.remove()
  })

  it('role never flips to aria-hidden and ariaLabel is never null, even for an empty series', () => {
    const el = new ProbeLineChart()
    el.values = []
    document.body.append(el)
    expect(el.probeInternals.role).toBe('img')
    expect(el.probeInternals.ariaHidden).not.toBe('true')
    expect(el.probeInternals.ariaLabel).not.toBeNull()
    el.remove()
  })
})

describe('UILineChartElement — mark DOM shape (ADR-0205)', () => {
  it('an empty rendered set clears the host (no svg, no label rows)', () => {
    const el = document.createElement('ui-line-chart') as UILineChartElement
    document.body.append(el)
    expect(el.querySelector('svg')).toBeNull()
    expect(el.childElementCount).toBe(0)
    el.remove()
  })

  it('a populated series renders label-max / svg / label-min, in that order, with the computed viewBox + points', () => {
    const el = document.createElement('ui-line-chart') as UILineChartElement
    el.values = [3, 5, 4, 8, 7]
    document.body.append(el)

    expect(el.childElementCount).toBe(3)
    const [maxEl, svgEl, minEl] = [...el.children]
    expect(maxEl.getAttribute('data-part')).toBe('label-max')
    expect(maxEl.textContent).toBe('8') // the series maximum, real DOM text
    expect(minEl.getAttribute('data-part')).toBe('label-min')
    expect(minEl.textContent).toBe('3') // the series minimum, real DOM text

    const svg = svgEl as SVGSVGElement
    expect(svg.tagName.toLowerCase()).toBe('svg')
    expect(svg.getAttribute('viewBox')).toBe('0 0 300 150') // the real chart-tile viewBox (not sparkline's 100x100)
    expect(svg.getAttribute('preserveAspectRatio')).toBe('none')
    expect(svg.getAttribute('aria-hidden')).toBe('true') // the svg never double-announces; the HOST carries role=img
    expect(svg.getAttribute('focusable')).toBe('false')

    const line = el.querySelector('[data-part="line"]')
    expect(line).not.toBeNull()
    expect(line?.tagName.toLowerCase()).toBe('polyline')
    expect(line?.getAttribute('points')).toBe('0,125 75,85 150,105 225,25 300,45')
    expect(line?.getAttribute('fill')).toBe('none')
    expect(line?.getAttribute('stroke')).toBe('currentColor')
    expect(line?.getAttribute('vector-effect')).toBe('non-scaling-stroke')

    // the baseline: min=3, doesn't span zero (3 > 0) — value FLOOR, so y = the plot bottom (125).
    const baseline = el.querySelector('[data-part="baseline"]')
    expect(baseline).not.toBeNull()
    expect(baseline?.tagName.toLowerCase()).toBe('line')
    expect(baseline?.getAttribute('x1')).toBe('0')
    expect(baseline?.getAttribute('y1')).toBe('125')
    expect(baseline?.getAttribute('x2')).toBe('300')
    expect(baseline?.getAttribute('y2')).toBe('125')
    expect(baseline?.getAttribute('stroke')).toBe('currentColor')

    expect(el.querySelector('[data-part="area"]')).toBeNull() // variant="line" (default) → no area
    el.remove()
  })

  it('a spanning-zero series places the baseline MID-chart, not at the plot bottom', () => {
    const el = document.createElement('ui-line-chart') as UILineChartElement
    el.values = [-10, 0, 10]
    document.body.append(el)
    const baseline = el.querySelector('[data-part="baseline"]')
    expect(baseline?.getAttribute('y1')).toBe('75') // the zero-line, mid-plot (PLOT_TOP=25 + PLOT_HEIGHT/2=50)
    expect(baseline?.getAttribute('y2')).toBe('75')
    el.remove()
  })

  it('variant="area" adds a fill polygon closing to the BASELINE, under the stroke (only when count >= 2), painted via an instance-unique gradient (ADR-0229 cl.3)', () => {
    const el = document.createElement('ui-line-chart') as UILineChartElement
    el.variant = 'area'
    el.values = [3, 5, 4]
    document.body.append(el)
    const svg = el.querySelector('svg') as SVGSVGElement
    const area = el.querySelector('[data-part="area"]')
    expect(area).not.toBeNull()
    expect(area?.tagName.toLowerCase()).toBe('polygon')
    expect(area?.getAttribute('points')).toBe('0,125 150,25 300,75 300,125 0,125')
    expect(area?.getAttribute('stroke')).toBe('none')

    // the gradient fill (ADR-0229 cl.3): fill references a <defs><linearGradient> sibling, never a bare
    // 'currentColor' attribute any more — the two <stop>s read the fill-stop tokens via CSS, not attrs.
    const fill = area?.getAttribute('fill') ?? ''
    expect(fill).toMatch(/^url\(#.+\)$/)
    const gradientId = fill.slice(5, -1)
    const gradient = svg.querySelector(`defs linearGradient#${gradientId}`)
    expect(gradient).not.toBeNull()
    expect(gradient?.getAttribute('data-part')).toBe('area-gradient')
    const stops = gradient?.querySelectorAll('stop') ?? []
    expect(stops.length).toBe(2)
    expect(stops[0].getAttribute('data-part')).toBe('area-gradient-stop-start')
    expect(stops[0].getAttribute('offset')).toBe('0%')
    expect(stops[0].getAttribute('stop-color')).toBe('currentColor')
    expect(stops[1].getAttribute('data-part')).toBe('area-gradient-stop-end')
    expect(stops[1].getAttribute('offset')).toBe('100%')

    // paint order: area, then baseline, then line (area painted first/under) — defs may sit anywhere,
    // this only asserts the RELATIVE order of the three tracked marks.
    const children = [...svg.children]
    const areaIdx = children.indexOf(area as Element)
    const baselineIdx = children.findIndex((c) => c.getAttribute('data-part') === 'baseline')
    const lineIdx = children.findIndex((c) => c.getAttribute('data-part') === 'line')
    expect(areaIdx).toBeLessThan(baselineIdx)
    expect(baselineIdx).toBeLessThan(lineIdx)
    el.remove()
  })

  it('two chart instances never collide on the SAME gradient id (document-wide SVG id namespace)', () => {
    const a = document.createElement('ui-line-chart') as UILineChartElement
    const b = document.createElement('ui-line-chart') as UILineChartElement
    a.variant = 'area'
    a.values = [1, 2]
    b.variant = 'area'
    b.values = [3, 4]
    document.body.append(a, b)
    const idOf = (el: UILineChartElement): string | null => el.querySelector('[data-part="area"]')?.getAttribute('fill') ?? null
    expect(idOf(a)).not.toBeNull()
    expect(idOf(a)).not.toBe(idOf(b))
    a.remove()
    b.remove()
  })

  it('variant="area" with n=1 (no area — a dot has no shape to close)', () => {
    const el = document.createElement('ui-line-chart') as UILineChartElement
    el.variant = 'area'
    el.values = [7]
    document.body.append(el)
    expect(el.querySelector('[data-part="area"]')).toBeNull()
    expect(el.querySelector('[data-part="line"]')).not.toBeNull()
    expect(el.querySelector('[data-part="label-max"]')?.textContent).toBe('7')
    expect(el.querySelector('[data-part="label-min"]')?.textContent).toBe('7')
    el.remove()
  })

  it('a property write of garbage never reaches the render path (property, not just attribute)', async () => {
    const el = document.createElement('ui-line-chart') as UILineChartElement
    document.body.append(el)
    // @ts-expect-error — deliberately garbage input to prove the render-boundary cleanSeries call
    el.values = [1, null, 2, 'x', Number.NaN]
    await el.updateComplete
    const line = el.querySelector('[data-part="line"]')
    expect(line?.getAttribute('points')).toBe('0,125 300,25') // rendered set = [1,2] → 2 points
    el.remove()
  })

  it('whole-array swap: a change to values rebuilds the mark via one replaceChildren (no leftover nodes)', async () => {
    const el = document.createElement('ui-line-chart') as UILineChartElement
    el.variant = 'area'
    el.values = [1, 2, 3]
    document.body.append(el)
    await el.updateComplete
    expect(el.childElementCount).toBe(3) // label-max, svg, label-min
    expect(el.querySelector('svg')?.childElementCount).toBe(4) // defs + area + baseline + line
    el.values = [4]
    await el.updateComplete
    expect(el.childElementCount).toBe(3)
    expect(el.querySelector('svg')?.childElementCount).toBe(2) // n=1 → baseline + line only, no area/defs
    el.remove()
  })
})

describe('UILineChartElement — the `axes` state (ADR-0229 cl.3)', () => {
  it('axes reflects as a presence attribute', () => {
    const el = document.createElement('ui-line-chart') as UILineChartElement
    document.body.append(el)
    expect(el.hasAttribute('axes')).toBe(false)
    el.axes = true
    expect(el.hasAttribute('axes')).toBe(true)
    el.remove()
  })

  it('renders a two-layer DOM (plot svg + chrome), never the default 3-row label rows', () => {
    const el = document.createElement('ui-line-chart') as UILineChartElement
    el.axes = true
    el.values = [3, 5, 4, 8, 7]
    document.body.append(el)
    expect(el.childElementCount).toBe(2)
    const [plot, chrome] = [...el.children]
    expect(plot.tagName.toLowerCase()).toBe('svg')
    expect(plot.getAttribute('data-part')).toBe('plot')
    expect(plot.getAttribute('viewBox')).toBe('0 0 100 100')
    expect(plot.getAttribute('aria-hidden')).toBe('true')
    expect(chrome.getAttribute('data-part')).toBe('chrome')
    expect(el.querySelector('[data-part="label-max"]')).toBeNull()
    expect(el.querySelector('[data-part="label-min"]')).toBeNull()
    el.remove()
  })

  it('an empty rendered set clears the host, even with axes set', () => {
    const el = document.createElement('ui-line-chart') as UILineChartElement
    el.axes = true
    document.body.append(el)
    expect(el.childElementCount).toBe(0)
    el.remove()
  })

  it('gridlines + the baseline render inside the plot (cl.1 baseline law inherited unchanged)', () => {
    const el = document.createElement('ui-line-chart') as UILineChartElement
    el.axes = true
    el.values = [10, 20, 15]
    document.body.append(el)
    const gridLines = el.querySelectorAll('[data-part="grid-line"]')
    expect(gridLines.length).toBeGreaterThan(0)
    const baseline = el.querySelector('[data-part="baseline"]')
    expect(baseline).not.toBeNull()
    // all-positive series: baseline (the value floor) sits at the plot BOTTOM (y=100, never mid-plot).
    expect(baseline?.getAttribute('y1')).toBe('100')
    el.remove()
  })

  it('a spanning-zero series floors the baseline MID-plot, not at the bottom', () => {
    const el = document.createElement('ui-line-chart') as UILineChartElement
    el.axes = true
    el.values = [-10, 0, 10]
    document.body.append(el)
    const baseline = el.querySelector('[data-part="baseline"]')
    const y = Number(baseline?.getAttribute('y1'))
    expect(y).toBeGreaterThan(0)
    expect(y).toBeLessThan(100)
    el.remove()
  })

  it('no `labels` ⇒ tick-label chips only, no category-label chips (cl.3: "value ticks only")', () => {
    const el = document.createElement('ui-line-chart') as UILineChartElement
    el.axes = true
    el.values = [3, 5, 4]
    document.body.append(el)
    expect(el.querySelectorAll('[data-part="tick-label"]').length).toBeGreaterThan(0)
    expect(el.querySelectorAll('[data-part="category-label"]').length).toBe(0)
    el.remove()
  })

  it('`labels` supplied ⇒ one category-label chip per index, real DOM text', () => {
    const el = document.createElement('ui-line-chart') as UILineChartElement
    el.axes = true
    el.values = [3, 5, 4]
    el.labels = ['Mar', 'Apr', 'May']
    document.body.append(el)
    const chips = [...el.querySelectorAll('[data-part="category-label"]')]
    expect(chips.length).toBe(3)
    expect(chips.map((c) => c.textContent)).toEqual(['Mar', 'Apr', 'May'])
    el.remove()
  })

  it('`projected` splits the polyline into a solid actual segment + a dashed projected segment, plus a now-marker', () => {
    const el = document.createElement('ui-line-chart') as UILineChartElement
    el.axes = true
    el.values = [3, 5, 4, 8, 7]
    el.projected = 2
    document.body.append(el)
    expect(el.querySelector('[data-part="line"]')).not.toBeNull()
    expect(el.querySelector('[data-part="line-projected"]')).not.toBeNull()
    expect(el.querySelector('[data-part="now-dot"]')).not.toBeNull()
    expect(el.querySelector('[data-part="now-tick"]')).not.toBeNull()
    el.remove()
  })

  it('`projected=0` renders no now-marker and no projected line segment', () => {
    const el = document.createElement('ui-line-chart') as UILineChartElement
    el.axes = true
    el.values = [3, 5, 4, 8, 7]
    document.body.append(el)
    expect(el.querySelector('[data-part="line-projected"]')).toBeNull()
    expect(el.querySelector('[data-part="now-dot"]')).toBeNull()
    expect(el.querySelector('[data-part="now-tick"]')).toBeNull()
    el.remove()
  })

  it('variant="area" in axes mode paints via the SAME gradient mechanism, suppressed over the projected span', () => {
    const el = document.createElement('ui-line-chart') as UILineChartElement
    el.axes = true
    el.variant = 'area'
    el.values = [3, 5, 4, 8, 7]
    el.projected = 2
    document.body.append(el)
    const area = el.querySelector('[data-part="area"]')
    expect(area).not.toBeNull()
    expect(area?.getAttribute('fill')).toMatch(/^url\(#.+\)$/)
    expect(el.querySelector('[data-part="area-gradient"]')).not.toBeNull()
    // the area polygon's points must NOT extend past the actual/projected boundary (fill suppressed there).
    const points = area?.getAttribute('points') ?? ''
    expect(points).not.toContain('100,') // x=100 (the last, PROJECTED point) never appears in the area path
    el.remove()
  })

  it('the ariaLabel summary is UNCHANGED by axes — same cl.6 pattern, computed from values alone', () => {
    const el = new ProbeLineChart()
    el.axes = true
    el.values = [3, 5, 4, 8, 7]
    el.label = 'Latency, p50'
    document.body.append(el)
    expect(el.probeInternals.ariaLabel).toBe(lineChartSummary('Latency, p50', lineChartGeometry(cleanSeries([3, 5, 4, 8, 7]))))
    el.remove()
  })

  it('a property write of garbage values never reaches the axes render path either', async () => {
    const el = document.createElement('ui-line-chart') as UILineChartElement
    el.axes = true
    document.body.append(el)
    // @ts-expect-error — deliberately garbage input to prove the render-boundary cleanSeries call
    el.values = [1, null, 2, 'x', Number.NaN]
    await el.updateComplete
    const line = el.querySelector('[data-part="line"]')
    expect(line).not.toBeNull()
    expect(el.querySelectorAll('[data-part="grid-line"]').length).toBeGreaterThan(0)
    el.remove()
  })
})

describe('UILineChartElement — reactivity + zero residue across connect/disconnect (the ui-column-chart pattern)', () => {
  it('changing `values` re-renders reactively (whole-array swap, no incremental patch)', async () => {
    const el = document.createElement('ui-line-chart') as UILineChartElement
    el.values = [1]
    document.body.append(el)
    const line = () => el.querySelector('[data-part="line"]')?.getAttribute('points')
    const first = line()

    el.values = [1, 2, 3]
    await el.updateComplete
    expect(line()).not.toBe(first)
    el.remove()
  })

  it('effects die on disconnect; reconnect re-installs exactly once (not stacked) — BOTH effects (mark + ARIA), this wave doubled the surface', async () => {
    const el = new ProbeLineChart()
    document.body.append(el)
    el.values = [1]
    await el.updateComplete
    expect(el.querySelector('[data-part="line"]')).not.toBeNull()

    el.remove() // disconnect → the connection scope is disposed → both effects (mark + ARIA) die with it
    el.values = [1, 2] // mutate WHILE disconnected
    el.label = 'Later'
    await el.updateComplete // give any leaked effect a chance to flush

    document.body.append(el) // reconnect → connected() re-runs → exactly one fresh pair of effects installs
    expect(el.querySelector('[data-part="line"]')?.getAttribute('points')).toBe('0,125 300,25')
    expect(el.probeInternals.role).toBe('img')
    expect(el.probeInternals.ariaLabel).toContain('Later:')
    el.remove()
  })

  it('the SAME residue proof holds in the `axes` state (mark effect + ARIA effect, doubled surface)', async () => {
    const el = new ProbeLineChart()
    el.axes = true
    document.body.append(el)
    el.values = [1, 2, 3]
    await el.updateComplete
    expect(el.querySelectorAll('[data-part="grid-line"]').length).toBeGreaterThan(0)

    el.remove() // disconnect
    el.values = [1, 2, 3, 4, 5] // mutate WHILE disconnected
    el.label = 'Later axes'
    await el.updateComplete

    document.body.append(el) // reconnect — exactly one fresh pair of effects, never stacked/leaked
    expect(el.querySelector('[data-part="plot"]')).not.toBeNull()
    expect(el.querySelectorAll('[data-part="grid-line"]').length).toBeGreaterThan(0)
    expect(el.probeInternals.ariaLabel).toContain('Later axes:')
    el.remove()
  })
})
