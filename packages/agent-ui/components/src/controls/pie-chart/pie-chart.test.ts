import { describe, it, expect, afterEach } from 'vitest'
import { UIPieChartElement } from './pie-chart.ts'

// pie-chart.test.ts — jsdom behaviour probes (ADR-0219). jsdom is blind to painted geometry — the
// whole-shape/donut-hole proofs live in pie-chart.browser.test.ts. This file covers: prop typing/
// defaults, ARIA via internals (role=list, generated/absent label), DOM shape (ring svg + one listitem
// per slice, aria-hidden ring, printed label/percent text, key-list identity), degenerate-data handling
// (empty/all-zero/single-slice), and zero residue across connect/disconnect.

// A throwaway subclass re-exposing the protected `internals` (the bar-chart/line-chart precedent).
class ProbePieChart extends UIPieChartElement {
  get probeInternals(): ElementInternals {
    return this.internals
  }
}
customElements.define('ui-pie-chart-probe', ProbePieChart)

const mounted: HTMLElement[] = []
function mount(el: HTMLElement): HTMLElement {
  document.body.append(el)
  mounted.push(el)
  return el
}
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

describe('UIPieChartElement — upgrade + typed props', () => {
  it('upgrades to the class; data defaults to [], label defaults to "", variant defaults to "donut"', () => {
    const el = document.createElement('ui-pie-chart') as UIPieChartElement
    expect(el).toBeInstanceOf(UIPieChartElement)
    expect(el.data).toEqual([])
    expect(el.label).toBe('')
    expect(el.variant).toBe('donut')
  })

  it('self-defines as ui-pie-chart, guarded against double-define', () => {
    expect(customElements.get('ui-pie-chart')).toBe(UIPieChartElement)
    expect(() => {
      if (!customElements.get('ui-pie-chart')) customElements.define('ui-pie-chart', UIPieChartElement)
    }).not.toThrow()
  })

  it('a JSON `data` attribute parses to the typed array on connect', () => {
    const el = document.createElement('ui-pie-chart') as UIPieChartElement
    el.setAttribute('data', '[{"label":"EMEA","value":42},{"label":"APAC","value":31}]')
    mount(el)
    expect(el.data).toEqual([
      { label: 'EMEA', value: 42 },
      { label: 'APAC', value: 31 },
    ])
  })

  it('malformed `data` attribute JSON never throws — falls back to []', () => {
    const el = document.createElement('ui-pie-chart') as UIPieChartElement
    expect(() => el.setAttribute('data', '{not json')).not.toThrow()
    mount(el)
    expect(el.data).toEqual([])
  })

  it('variant snaps an unknown attribute value back to "donut" (enumType fallback)', () => {
    const el = document.createElement('ui-pie-chart') as UIPieChartElement
    el.setAttribute('variant', 'bogus')
    mount(el)
    expect(el.variant).toBe('donut')
  })

  it('variant="pie" is a legal, distinct value', () => {
    const el = document.createElement('ui-pie-chart') as UIPieChartElement
    el.setAttribute('variant', 'pie')
    mount(el)
    expect(el.variant).toBe('pie')
  })
})

describe('UIPieChartElement — list semantics via internals', () => {
  it('role=list is set via ElementInternals on connect — NEVER a host role attribute', () => {
    const el = mount(new ProbePieChart()) as ProbePieChart
    expect(el.probeInternals.role).toBe('list')
    expect(el.getAttribute('role')).toBeNull()
  })

  it('an empty `label` leaves the list unlabeled (legal), still role=list, never aria-hidden', () => {
    const el = mount(new ProbePieChart()) as ProbePieChart
    expect(el.probeInternals.ariaLabel).toBeNull()
    expect(el.probeInternals.role).toBe('list')
    expect(el.hasAttribute('aria-hidden')).toBe(false)
  })

  it('a non-empty `label` names the list via internals.ariaLabel — never a host aria-label attribute', () => {
    const el = new ProbePieChart()
    el.label = 'Revenue by region'
    mount(el)
    expect(el.probeInternals.ariaLabel).toBe('Revenue by region')
    expect(el.hasAttribute('aria-label')).toBe(false)
  })

  it('label is reactive: set → clear → set again', async () => {
    const el = mount(new ProbePieChart()) as ProbePieChart
    el.label = 'Sales'
    await el.updateComplete
    expect(el.probeInternals.ariaLabel).toBe('Sales')
    el.label = ''
    await el.updateComplete
    expect(el.probeInternals.ariaLabel).toBeNull()
  })
})

describe('UIPieChartElement — ring + key-list rendering (ADR-0219 cl.3/cl.4/cl.5)', () => {
  it('one role=listitem per valid datum, in order; one aria-hidden ring svg', () => {
    const el = new UIPieChartElement()
    el.data = [
      { label: 'EMEA', value: 42 },
      { label: 'APAC', value: 31 },
    ]
    mount(el)
    const ring = el.querySelector('[data-part="ring"]') as SVGSVGElement
    expect(ring).not.toBeNull()
    expect(ring.getAttribute('aria-hidden')).toBe('true')
    const items = el.querySelectorAll('[role="listitem"]')
    expect(items).toHaveLength(2)
    expect(items[0].querySelector('[data-part="key-label"]')?.textContent).toBe('EMEA')
    expect(items[1].querySelector('[data-part="key-label"]')?.textContent).toBe('APAC')
  })

  it('the key row order matches the ring slice order (same index, DOM order = data order)', () => {
    const el = new UIPieChartElement()
    el.data = [
      { label: 'a', value: 1 },
      { label: 'b', value: 2 },
      { label: 'c', value: 3 },
    ]
    mount(el)
    const slices = [...el.querySelectorAll('[data-part="slice"]')]
    const rows = [...el.querySelectorAll('[role="listitem"]')]
    expect(slices.map((s) => s.getAttribute('data-index'))).toEqual(['0', '1', '2'])
    expect(rows.map((r) => r.getAttribute('data-index'))).toEqual(['0', '1', '2'])
  })

  it("the key row's combined text content is exactly `{label} · {percent}`", () => {
    const el = new UIPieChartElement()
    el.data = [
      { label: 'EMEA', value: 1 },
      { label: 'APAC', value: 1 },
    ]
    mount(el)
    const item = el.querySelector('[role="listitem"]') as HTMLElement
    expect(item.textContent).toBe('EMEA · 50%')
  })

  it('printed percents sum sensibly for an uneven 3-way split (Intl percent, 0 decimals)', () => {
    const el = new UIPieChartElement()
    el.data = [
      { label: 'a', value: 1 },
      { label: 'b', value: 1 },
      { label: 'c', value: 1 },
    ]
    mount(el)
    const percents = [...el.querySelectorAll('[data-part="key-percent"]')].map((n) => n.textContent)
    const third = new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 0 }).format(1 / 3)
    expect(percents).toEqual([third, third, third])
  })

  it('the key-swatch is aria-hidden and text-free (the fill is a shared, non-sole identity carrier)', () => {
    const el = new UIPieChartElement()
    el.data = [{ label: 'a', value: 10 }]
    mount(el)
    const swatch = el.querySelector('[data-part="key-swatch"]') as HTMLElement
    expect(swatch.getAttribute('aria-hidden')).toBe('true')
    expect(swatch.textContent).toBe('')
  })

  it('each slice + its matching key-swatch reads the SAME --_slice-ink token', () => {
    const el = new UIPieChartElement()
    el.data = [
      { label: 'a', value: 1 },
      { label: 'b', value: 1 },
    ]
    mount(el)
    const slices = [...el.querySelectorAll('[data-part="slice"]')] as SVGElement[]
    const swatches = [...el.querySelectorAll('[data-part="key-swatch"]')] as HTMLElement[]
    expect(slices[0].style.getPropertyValue('--_slice-ink')).toBe('var(--ui-pie-chart-slice-1-ink)')
    expect(swatches[0].style.getPropertyValue('--_slice-ink')).toBe('var(--ui-pie-chart-slice-1-ink)')
    expect(slices[1].style.getPropertyValue('--_slice-ink')).toBe('var(--ui-pie-chart-slice-2-ink)')
    expect(swatches[1].style.getPropertyValue('--_slice-ink')).toBe('var(--ui-pie-chart-slice-2-ink)')
  })

  it('changing `data` re-renders reactively (whole-array swap, no incremental patch)', async () => {
    const el = new UIPieChartElement()
    el.data = [{ label: 'a', value: 1 }]
    mount(el)
    expect(el.querySelectorAll('[role="listitem"]')).toHaveLength(1)

    el.data = [
      { label: 'x', value: 1 },
      { label: 'y', value: 2 },
      { label: 'z', value: 3 },
    ]
    await el.updateComplete
    expect(el.querySelectorAll('[role="listitem"]')).toHaveLength(3)
  })

  it('changing `variant` re-renders the ring (whole-mark rebuild)', async () => {
    const el = new UIPieChartElement()
    el.data = [{ label: 'a', value: 1 }]
    mount(el)
    const firstRing = el.querySelector('[data-part="ring"]')
    el.variant = 'pie'
    await el.updateComplete
    const secondRing = el.querySelector('[data-part="ring"]')
    expect(secondRing).not.toBeNull()
    expect(secondRing).not.toBe(firstRing) // replaceChildren rebuilt the whole mark, not patched in place
  })
})

describe('UIPieChartElement — variant geometry (donut vs pie)', () => {
  it('donut draws a two-subpath track/slice (annulus, a hole for the whole caption)', () => {
    const el = new UIPieChartElement()
    mount(el) // no data — the empty track path
    const track = el.querySelector('[data-part="track"]') as SVGPathElement
    expect(track).not.toBeNull()
    expect(track.getAttribute('d')?.match(/M /g)?.length).toBe(2)
  })

  it('pie draws a ONE-subpath track (a solid disc, no hole)', () => {
    const el = new UIPieChartElement()
    el.variant = 'pie'
    mount(el)
    const track = el.querySelector('[data-part="track"]') as SVGPathElement
    expect(track.getAttribute('d')?.match(/M /g)?.length).toBe(1)
  })
})

describe('UIPieChartElement — degenerate data (ADR-0219 cl.2)', () => {
  it('empty data → an empty track ring, zero key rows; host remains role=list', () => {
    const el = mount(new ProbePieChart()) as ProbePieChart
    expect(el.querySelectorAll('[role="listitem"]')).toHaveLength(0)
    expect(el.querySelector('[data-part="track"]')).not.toBeNull()
    expect(el.querySelector('[data-part="slice"]')).toBeNull()
    expect(el.probeInternals.role).toBe('list')
  })

  it('an all-zero rendered set → an empty track ring, zero key rows (not one row per zero-value datum)', () => {
    const el = new UIPieChartElement()
    el.data = [
      { label: 'a', value: 0 },
      { label: 'b', value: 0 },
    ]
    mount(el)
    expect(el.querySelectorAll('[role="listitem"]')).toHaveLength(0)
    expect(el.querySelector('[data-part="track"]')).not.toBeNull()
  })

  it('exactly one valid datum → one key row reading "{label} · 100%"', () => {
    const el = new UIPieChartElement()
    el.data = [{ label: 'solo', value: 7 }]
    mount(el)
    const items = el.querySelectorAll('[role="listitem"]')
    expect(items).toHaveLength(1)
    expect(items[0].textContent).toBe('solo · 100%')
  })

  it('a negative value is DROPPED, not clamped (a hardening difference from ui-bar-chart)', () => {
    const el = new UIPieChartElement()
    el.data = [
      { label: 'ok', value: 10 },
      { label: 'neg', value: -5 },
    ]
    mount(el)
    const labels = [...el.querySelectorAll('[data-part="key-label"]')].map((n) => n.textContent)
    expect(labels).toEqual(['ok'])
  })

  it('an empty-string label is dropped (unlike ui-bar-chart, which allows it)', () => {
    const el = new UIPieChartElement()
    el.data = [
      { label: '', value: 10 },
      { label: 'ok', value: 5 },
    ]
    mount(el)
    const labels = [...el.querySelectorAll('[data-part="key-label"]')].map((n) => n.textContent)
    expect(labels).toEqual(['ok'])
  })

  it('a property write of mixed garbage never reaches the render path', () => {
    const el = new UIPieChartElement()
    // @ts-expect-error — deliberately garbage at the property boundary, exactly what cleanData must guard
    el.data = [{ label: 'ok', value: 1 }, { label: 'bad' }, null, { label: 'x', value: 'nope' }, { label: 'ok2', value: 2 }]
    mount(el)
    const labels = [...el.querySelectorAll('[data-part="key-label"]')].map((n) => n.textContent)
    expect(labels).toEqual(['ok', 'ok2'])
  })

  it('a non-array property write (e.g. null) never throws and renders zero rows', () => {
    const el = new UIPieChartElement()
    // @ts-expect-error — a non-array write, the codec's inbound counterpart (property path, not attribute)
    expect(() => (el.data = null)).not.toThrow()
    mount(el)
    expect(el.querySelectorAll('[role="listitem"]')).toHaveLength(0)
  })
})

describe('UIPieChartElement — zero residue across connect/disconnect', () => {
  it('effects die on disconnect; reconnect re-installs exactly once (not stacked)', async () => {
    const el = mount(new ProbePieChart()) as ProbePieChart
    el.data = [{ label: 'a', value: 1 }]
    await el.updateComplete
    expect(el.querySelectorAll('[role="listitem"]')).toHaveLength(1)

    el.remove() // disconnect → the connection scope is disposed → both effects die with it
    el.data = [
      { label: 'a', value: 1 },
      { label: 'b', value: 2 },
    ] // mutate WHILE disconnected
    el.label = 'Later'
    await el.updateComplete // give any leaked effect a chance to flush

    document.body.append(el) // reconnect → connected() re-runs → exactly one fresh pair of effects installs
    expect(el.querySelectorAll('[role="listitem"]')).toHaveLength(2)
    expect(el.probeInternals.role).toBe('list')
    expect(el.probeInternals.ariaLabel).toBe('Later')
    el.remove()
  })
})
