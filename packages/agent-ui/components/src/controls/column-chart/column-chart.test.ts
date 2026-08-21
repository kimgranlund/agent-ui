import { describe, it, expect, afterEach } from 'vitest'
import { UIColumnChartElement } from './column-chart.ts'

// column-chart.test.ts — jsdom behaviour probes (ADR-0228/ADR-0229). jsdom is blind to painted geometry —
// the whole-shape/percent-math proofs live in column-chart.browser.test.ts. This file covers: prop
// typing/defaults, ARIA via internals (role=img, generated summary), DOM shape (plot/columns/chrome
// layers, one category+segment per row, the projected ghost, the now-marker, the highlight callout),
// degenerate-data handling, and zero residue across connect/disconnect.

class ProbeColumnChart extends UIColumnChartElement {
  get probeInternals(): ElementInternals {
    return this.internals
  }
}
customElements.define('ui-column-chart-probe', ProbeColumnChart)

const mounted: HTMLElement[] = []
function mount(el: HTMLElement): HTMLElement {
  document.body.append(el)
  mounted.push(el)
  return el
}
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

const REVENUE = [
  { label: 'Mar', values: [8, 4] },
  { label: 'Apr', values: [10, 5] },
  { label: 'May', values: [9, 6] },
]

describe('UIColumnChartElement — upgrade + typed props', () => {
  it('upgrades to the class; every prop defaults per the descriptor', () => {
    const el = document.createElement('ui-column-chart') as UIColumnChartElement
    expect(el).toBeInstanceOf(UIColumnChartElement)
    expect(el.data).toEqual([])
    expect(el.series).toEqual([])
    expect(el.label).toBe('')
    expect(el.projected).toBe(0)
    expect(el.highlight).toBeNull()
  })

  it('self-defines as ui-column-chart, guarded against double-define', () => {
    expect(customElements.get('ui-column-chart')).toBe(UIColumnChartElement)
    expect(() => {
      if (!customElements.get('ui-column-chart')) customElements.define('ui-column-chart', UIColumnChartElement)
    }).not.toThrow()
  })

  it('JSON `data`/`series` attributes parse to typed values on connect', () => {
    const el = document.createElement('ui-column-chart') as UIColumnChartElement
    el.setAttribute('data', JSON.stringify(REVENUE))
    el.setAttribute('series', JSON.stringify(['Product', 'Services']))
    mount(el)
    expect(el.data).toEqual(REVENUE)
    expect(el.series).toEqual(['Product', 'Services'])
  })

  it('malformed `data`/`series` attribute JSON never throws — falls back to []', () => {
    const el = document.createElement('ui-column-chart') as UIColumnChartElement
    expect(() => {
      el.setAttribute('data', '{not json')
      el.setAttribute('series', '[bad')
    }).not.toThrow()
    mount(el)
    expect(el.data).toEqual([])
    expect(el.series).toEqual([])
  })
})

describe('UIColumnChartElement — img semantics via internals', () => {
  it('role=img is set via ElementInternals on connect — NEVER a host role attribute', () => {
    const el = mount(new ProbeColumnChart()) as ProbeColumnChart
    expect(el.probeInternals.role).toBe('img')
    expect(el.getAttribute('role')).toBeNull()
  })

  it('the generated summary is never null, with or without data', () => {
    const el = mount(new ProbeColumnChart()) as ProbeColumnChart
    expect(el.probeInternals.ariaLabel).toBe('no data')
  })

  it('a non-empty `label` prefixes the generated summary via internals.ariaLabel', async () => {
    const el = new ProbeColumnChart()
    el.label = 'Revenue by month'
    el.data = REVENUE
    mount(el)
    await el.updateComplete
    expect(el.probeInternals.ariaLabel).toMatch(/^Revenue by month: 3 categories, 2 series/)
    expect(el.hasAttribute('aria-label')).toBe(false)
  })

  it('a valid `highlight` repeats that row\'s fact in the summary', async () => {
    const el = new ProbeColumnChart()
    el.data = REVENUE
    el.highlight = 1
    mount(el)
    await el.updateComplete
    expect(el.probeInternals.ariaLabel).toContain('highlighted Apr 15')
  })
})

describe('UIColumnChartElement — three-layer DOM (ADR-0228 cl.1-3)', () => {
  it('renders exactly one plot layer, one columns div, one chrome div', () => {
    const el = new UIColumnChartElement()
    el.data = REVENUE
    mount(el)
    expect(el.querySelectorAll('[data-part="plot"]')).toHaveLength(1)
    expect(el.querySelectorAll('[data-part="columns"]')).toHaveLength(1)
    expect(el.querySelectorAll('[data-part="chrome"]')).toHaveLength(1)
  })

  it('the plot layer is aria-hidden; the columns layer is aria-hidden too (the summary carries the facts)', () => {
    const el = new UIColumnChartElement()
    el.data = REVENUE
    mount(el)
    expect(el.querySelector('[data-part="plot"]')?.getAttribute('aria-hidden')).toBe('true')
    expect(el.querySelector('[data-part="columns"]')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('one category track per row, stacked segments in series order', () => {
    const el = new UIColumnChartElement()
    el.data = REVENUE
    el.series = ['Product', 'Services']
    mount(el)
    const categories = el.querySelectorAll('[data-part="category"]')
    expect(categories).toHaveLength(3)
    const firstSegments = categories[0].querySelectorAll('[data-part="segment"]')
    expect(firstSegments).toHaveLength(2)
    expect(firstSegments[0].getAttribute('data-series')).toBe('0')
    expect(firstSegments[1].getAttribute('data-series')).toBe('1')
  })

  it('each segment carries a --_seg-ink hook cycling through the six ramp tokens', () => {
    const el = new UIColumnChartElement()
    el.data = [{ label: 'a', values: [1, 1, 1, 1, 1, 1, 1] }]
    el.series = ['s0', 's1', 's2', 's3', 's4', 's5', 's6']
    mount(el)
    const segments = [...el.querySelectorAll('[data-part="segment"]')] as HTMLElement[]
    expect(segments[0].style.getPropertyValue('--_seg-ink')).toBe('var(--ui-column-chart-series-1-ink)')
    expect(segments[5].style.getPropertyValue('--_seg-ink')).toBe('var(--ui-column-chart-series-6-ink)')
    expect(segments[6].style.getPropertyValue('--_seg-ink')).toBe('var(--ui-column-chart-series-1-ink)') // cycles past 6
  })

  it('renders one tick-label chip per gridline and one category-label chip per THINNED index', () => {
    const el = new UIColumnChartElement()
    el.data = REVENUE
    mount(el)
    expect(el.querySelectorAll('[data-part="tick-label"]').length).toBeGreaterThan(0)
    const catLabels = [...el.querySelectorAll('[data-part="category-label"]')].map((n) => n.textContent)
    expect(catLabels).toEqual(['Mar', 'Apr', 'May'])
  })

  it('a wide axis THINS category-label chips but always keeps the first and last', () => {
    const el = new UIColumnChartElement()
    el.data = Array.from({ length: 30 }, (_, i) => ({ label: `d${i}`, values: [1] }))
    mount(el)
    const catLabels = [...el.querySelectorAll('[data-part="category-label"]')].map((n) => n.textContent)
    expect(catLabels.length).toBeLessThan(30)
    expect(catLabels[0]).toBe('d0')
    expect(catLabels[catLabels.length - 1]).toBe('d29')
  })
})

describe('UIColumnChartElement — projected + now-marker (ADR-0228 cl.4)', () => {
  it('a trailing projected row collapses to ONE hollow ghost segment (never per-segment outlines)', () => {
    const el = new UIColumnChartElement()
    el.data = REVENUE
    el.series = ['Product', 'Services']
    el.projected = 1
    mount(el)
    const categories = el.querySelectorAll('[data-part="category"]')
    const lastSegments = categories[2].querySelectorAll('[data-part="segment"]')
    expect(lastSegments).toHaveLength(1)
    expect(lastSegments[0].hasAttribute('data-projected')).toBe(true)
    const firstSegments = categories[0].querySelectorAll('[data-part="segment"]')
    expect(firstSegments[0].hasAttribute('data-projected')).toBe(false)
  })

  it('the now-marker (dot + short tick) renders exactly when projected > 0, absent otherwise', async () => {
    const el = new UIColumnChartElement()
    el.data = REVENUE
    mount(el)
    expect(el.querySelector('[data-part="now-dot"]')).toBeNull()
    expect(el.querySelector('[data-part="now-tick"]')).toBeNull()

    el.projected = 1
    await el.updateComplete
    expect(el.querySelector('[data-part="now-dot"]')).not.toBeNull()
    expect(el.querySelector('[data-part="now-tick"]')).not.toBeNull()
  })

  it('the now-marker is a no-op (absent) when every row would be projected', () => {
    const el = new UIColumnChartElement()
    el.data = REVENUE
    el.projected = 99
    mount(el)
    expect(el.querySelector('[data-part="now-dot"]')).toBeNull()
    expect(el.querySelector('[data-part="now-tick"]')).toBeNull()
  })
})

describe('UIColumnChartElement — the highlight callout (ADR-0228 cl.5, zero-event)', () => {
  it('renders `{value} · {category}` real DOM text for a valid highlight index', () => {
    const el = new UIColumnChartElement()
    el.data = REVENUE
    el.highlight = 0
    mount(el)
    const callout = el.querySelector('[data-part="callout"]') as HTMLElement
    expect(callout).not.toBeNull()
    expect(callout.textContent).toBe('12 · Mar')
  })

  it('no callout renders when highlight is null/absent or out of range', async () => {
    const el = new UIColumnChartElement()
    el.data = REVENUE
    mount(el)
    expect(el.querySelector('[data-part="callout"]')).toBeNull()
    el.highlight = 99
    await el.updateComplete
    expect(el.querySelector('[data-part="callout"]')).toBeNull()
  })

  it('the callout carries no interactive affordance (display tier stays zero-event)', () => {
    const el = new UIColumnChartElement()
    el.data = REVENUE
    el.highlight = 0
    mount(el)
    const callout = el.querySelector('[data-part="callout"]') as HTMLElement
    expect(callout.hasAttribute('tabindex')).toBe(false)
    expect(callout.getAttribute('role')).toBeNull()
  })
})

describe('UIColumnChartElement — degenerate data (ADR-0229 cl.2)', () => {
  it('empty data → an empty host, host remains role=img with a "no data" summary', () => {
    const el = mount(new ProbeColumnChart()) as ProbeColumnChart
    expect(el.querySelector('[data-part="plot"]')).toBeNull()
    expect(el.probeInternals.role).toBe('img')
    expect(el.probeInternals.ariaLabel).toBe('no data')
  })

  it('a row with a negative value is DROPPED WHOLE (stack semantics)', () => {
    const el = new UIColumnChartElement()
    el.data = [{ label: 'ok', values: [10] }, { label: 'bad', values: [1, -2] }]
    mount(el)
    const labels = [...el.querySelectorAll('[data-part="category-label"]')].map((n) => n.textContent)
    expect(labels).toEqual(['ok'])
  })

  it('an all-zero rendered set still paints a real scale with zero-length segments', () => {
    const el = new UIColumnChartElement()
    el.data = [{ label: 'a', values: [0] }, { label: 'b', values: [0] }]
    mount(el)
    expect(el.querySelectorAll('[data-part="category"]')).toHaveLength(2)
    const segment = el.querySelector('[data-part="segment"]') as HTMLElement
    expect(segment.style.getPropertyValue('--_seg-length')).toBe('0')
  })

  it('a ragged row pads with trailing zeros to the resolved series count (never thrown)', () => {
    const el = new UIColumnChartElement()
    el.data = [{ label: 'a', values: [10, 5] }, { label: 'b', values: [3] }]
    el.series = ['A', 'B']
    mount(el)
    const categories = el.querySelectorAll('[data-part="category"]')
    expect(categories[1].querySelectorAll('[data-part="segment"]')).toHaveLength(2)
  })

  it('a property write of mixed garbage never reaches the render path', () => {
    const el = new UIColumnChartElement()
    // @ts-expect-error — deliberately garbage at the property boundary, exactly what cleanData must guard
    el.data = [{ label: 'ok', values: [1] }, { label: 'bad' }, null, { label: 'x', values: [-1] }, { label: 'ok2', values: [2] }]
    mount(el)
    const labels = [...el.querySelectorAll('[data-part="category-label"]')].map((n) => n.textContent)
    expect(labels).toEqual(['ok', 'ok2'])
  })

  it('a non-array property write (e.g. null) never throws and renders an empty host', () => {
    const el = new UIColumnChartElement()
    // @ts-expect-error — a non-array write, the codec's inbound counterpart (property path, not attribute)
    expect(() => (el.data = null)).not.toThrow()
    mount(el)
    expect(el.querySelector('[data-part="plot"]')).toBeNull()
  })
})

describe('UIColumnChartElement — reactivity + zero residue across connect/disconnect', () => {
  it('changing `data` re-renders reactively (whole-array swap, no incremental patch)', async () => {
    const el = new UIColumnChartElement()
    el.data = [{ label: 'a', values: [1] }]
    mount(el)
    expect(el.querySelectorAll('[data-part="category"]')).toHaveLength(1)

    el.data = [{ label: 'x', values: [1] }, { label: 'y', values: [2] }, { label: 'z', values: [3] }]
    await el.updateComplete
    expect(el.querySelectorAll('[data-part="category"]')).toHaveLength(3)
  })

  it('effects die on disconnect; reconnect re-installs exactly once (not stacked)', async () => {
    const el = mount(new ProbeColumnChart()) as ProbeColumnChart
    el.data = [{ label: 'a', values: [1] }]
    await el.updateComplete
    expect(el.querySelectorAll('[data-part="category"]')).toHaveLength(1)

    el.remove() // disconnect → the connection scope is disposed → both effects die with it
    el.data = [{ label: 'a', values: [1] }, { label: 'b', values: [2] }] // mutate WHILE disconnected
    el.label = 'Later'
    await el.updateComplete // give any leaked effect a chance to flush

    document.body.append(el) // reconnect → connected() re-runs → exactly one fresh pair of effects installs
    expect(el.querySelectorAll('[data-part="category"]')).toHaveLength(2)
    expect(el.probeInternals.role).toBe('img')
    expect(el.probeInternals.ariaLabel).toContain('Later:')
    el.remove()
  })
})
