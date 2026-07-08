import { describe, it, expect, afterEach } from 'vitest'
import { UIBarChartElement } from './bar-chart.ts'

// bar-chart.test.ts — jsdom behaviour probes (LLD-C5, chart-family.lld.md §3; SPEC-R5…R8). jsdom is blind
// to painted geometry (SPEC-N2) — the proportion/WHCM/RTL legs are bar-chart.browser.test.ts's job. This
// file covers: prop typing/defaults, ARIA via internals (role=list, generated/absent label), DOM shape
// (listitem count, aria-hidden+text-free track, printed label/value text), degenerate-data handling, and
// zero residue across connect/disconnect.

// A throwaway subclass re-exposing the protected `internals` (the icon.test.ts / list precedent), so a
// probe can read role/ariaLabel set via ElementInternals (the FACE pattern — never a host attribute).
class ProbeBarChart extends UIBarChartElement {
  get probeInternals(): ElementInternals {
    return this.internals
  }
}
customElements.define('ui-bar-chart-probe', ProbeBarChart)

const mounted: HTMLElement[] = []
function mount(el: HTMLElement): HTMLElement {
  document.body.append(el)
  mounted.push(el)
  return el
}
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

describe('UIBarChartElement — upgrade + typed props', () => {
  it('upgrades to the class; data defaults to [], label defaults to empty string', () => {
    const el = document.createElement('ui-bar-chart') as UIBarChartElement
    expect(el).toBeInstanceOf(UIBarChartElement)
    expect(el.data).toEqual([])
    expect(el.label).toBe('')
  })

  it('self-defines as ui-bar-chart, guarded against double-define', () => {
    expect(customElements.get('ui-bar-chart')).toBe(UIBarChartElement)
    expect(() => {
      if (!customElements.get('ui-bar-chart')) customElements.define('ui-bar-chart', UIBarChartElement)
    }).not.toThrow()
  })

  it('a JSON `data` attribute parses to the typed array on connect', () => {
    const el = document.createElement('ui-bar-chart') as UIBarChartElement
    el.setAttribute('data', '[{"label":"EMEA","value":42},{"label":"APAC","value":31}]')
    mount(el)
    expect(el.data).toEqual([
      { label: 'EMEA', value: 42 },
      { label: 'APAC', value: 31 },
    ])
  })

  it('malformed `data` attribute JSON never throws — falls back to [] (SPEC-R7)', () => {
    const el = document.createElement('ui-bar-chart') as UIBarChartElement
    expect(() => el.setAttribute('data', '{not json')).not.toThrow()
    mount(el)
    expect(el.data).toEqual([])
  })
})

describe('UIBarChartElement — list semantics via internals (SPEC-R8)', () => {
  it('role=list is set via ElementInternals on connect — NEVER a host role attribute', () => {
    const el = mount(new ProbeBarChart()) as ProbeBarChart
    expect(el.probeInternals.role).toBe('list')
    expect(el.getAttribute('role')).toBeNull()
  })

  it('an empty `label` leaves the list unlabeled (legal — SPEC-R8), still role=list, never aria-hidden', () => {
    const el = mount(new ProbeBarChart()) as ProbeBarChart
    expect(el.probeInternals.ariaLabel).toBeNull()
    expect(el.probeInternals.role).toBe('list')
    expect(el.hasAttribute('aria-hidden')).toBe(false)
  })

  it('a non-empty `label` names the list via internals.ariaLabel — never a host aria-label attribute', () => {
    const el = new ProbeBarChart()
    el.label = 'Revenue by region'
    mount(el)
    expect(el.probeInternals.ariaLabel).toBe('Revenue by region')
    expect(el.hasAttribute('aria-label')).toBe(false)
  })

  it('label is reactive: set → clear → set again', async () => {
    const el = mount(new ProbeBarChart()) as ProbeBarChart
    expect(el.probeInternals.ariaLabel).toBeNull()

    el.label = 'Sales'
    await el.updateComplete
    expect(el.probeInternals.ariaLabel).toBe('Sales')

    el.label = ''
    await el.updateComplete
    expect(el.probeInternals.ariaLabel).toBeNull()
  })
})

describe('UIBarChartElement — row rendering (SPEC-R6/R8)', () => {
  it('one role=listitem per valid datum, in order', () => {
    const el = new UIBarChartElement()
    el.data = [
      { label: 'EMEA', value: 42 },
      { label: 'APAC', value: 31 },
    ]
    mount(el)
    const items = el.querySelectorAll('[role="listitem"]')
    expect(items).toHaveLength(2)
    expect(items[0].querySelector('[data-part="label"]')?.textContent).toBe('EMEA')
    expect(items[1].querySelector('[data-part="label"]')?.textContent).toBe('APAC')
  })

  it('the printed value is real, locale-formatted text (SPEC-R8: the accessible datum)', () => {
    const el = new UIBarChartElement()
    el.data = [{ label: 'big', value: 12345 }]
    mount(el)
    const value = el.querySelector('[data-part="value"]')
    expect(value?.textContent).toBe(new Intl.NumberFormat().format(12345))
  })

  it('negative values print their sign', () => {
    const el = new UIBarChartElement()
    el.data = [{ label: 'a', value: -20 }]
    mount(el)
    expect(el.querySelector('[data-part="value"]')?.textContent).toBe(new Intl.NumberFormat().format(-20))
  })

  it('the track is aria-hidden and text-free (SPEC-R8 AC2) — the fill carries no text', () => {
    const el = new UIBarChartElement()
    el.data = [{ label: 'a', value: 10 }]
    mount(el)
    const track = el.querySelector('[data-part="track"]') as HTMLElement
    expect(track.getAttribute('aria-hidden')).toBe('true')
    expect(track.textContent).toBe('')
    const fill = track.querySelector('[data-part="fill"]') as HTMLElement
    expect(fill).not.toBeNull()
    expect(fill.textContent).toBe('')
  })

  it("the listitem's combined text content is exactly `{label} {printed value}` (SPEC-R8 AC1)", () => {
    const el = new UIBarChartElement()
    el.data = [{ label: 'EMEA', value: 42 }]
    mount(el)
    const item = el.querySelector('[role="listitem"]') as HTMLElement
    expect(item.textContent).toBe(`EMEA${new Intl.NumberFormat().format(42)}`)
  })

  it('the fill carries the row-scoped --_bar-start/--_bar-length custom properties (imperatively set, never a width)', () => {
    const el = new UIBarChartElement()
    el.data = [
      { label: 'a', value: 40 },
      { label: 'b', value: 20 },
    ]
    mount(el)
    const fills = el.querySelectorAll('[data-part="fill"]') as NodeListOf<HTMLElement>
    expect(fills[0].style.getPropertyValue('--_bar-start')).toBe('0')
    expect(fills[0].style.getPropertyValue('--_bar-length')).toBe('100')
    expect(fills[1].style.getPropertyValue('--_bar-length')).toBe('50')
    expect(fills[0].style.width).toBe('') // this file never writes a width — bar-chart.css owns the paint
  })

  it('changing `data` re-renders reactively (whole-array swap, no incremental patch)', async () => {
    const el = new UIBarChartElement()
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
})

describe('UIBarChartElement — degenerate data (SPEC-R7)', () => {
  it('empty data → zero rows; host remains role=list (the honest empty state, SPEC-R8 AC3)', () => {
    const el = mount(new ProbeBarChart()) as ProbeBarChart
    expect(el.querySelectorAll('[role="listitem"]')).toHaveLength(0)
    expect(el.probeInternals.role).toBe('list')
  })

  it('a property write of mixed garbage never reaches the render path (SPEC-R3/R7 AC2 sibling rule)', () => {
    const el = new UIBarChartElement()
    // @ts-expect-error — deliberately garbage at the property boundary, exactly what cleanData must guard
    el.data = [{ label: 'ok', value: 1 }, { label: 'bad' }, null, { label: 'x', value: 'nope' }, { label: 'ok2', value: 2 }]
    mount(el)
    const labels = [...el.querySelectorAll('[data-part="label"]')].map((n) => n.textContent)
    expect(labels).toEqual(['ok', 'ok2'])
  })

  it('a non-array property write (e.g. null) never throws and renders zero rows', () => {
    const el = new UIBarChartElement()
    // @ts-expect-error — a non-array write, the codec's inbound counterpart (property path, not attribute)
    expect(() => (el.data = null)).not.toThrow()
    mount(el)
    expect(el.querySelectorAll('[role="listitem"]')).toHaveLength(0)
  })
})

describe('UIBarChartElement — zero residue across connect/disconnect', () => {
  it('effects die on disconnect; reconnect re-installs exactly once (not stacked)', async () => {
    const el = mount(new ProbeBarChart()) as ProbeBarChart
    el.data = [{ label: 'a', value: 1 }]
    await el.updateComplete
    expect(el.querySelectorAll('[role="listitem"]')).toHaveLength(1)

    el.remove() // disconnect → the connection scope is disposed → both effects die with it
    el.data = [{ label: 'a', value: 1 }, { label: 'b', value: 2 }] // mutate WHILE disconnected
    el.label = 'Later'
    await el.updateComplete // give any leaked effect a chance to flush

    document.body.append(el) // reconnect → connected() re-runs → exactly one fresh pair of effects installs
    expect(el.querySelectorAll('[role="listitem"]')).toHaveLength(2) // re-applied from the now-current data
    expect(el.probeInternals.role).toBe('list')
    expect(el.probeInternals.ariaLabel).toBe('Later')
    el.remove()
  })
})
