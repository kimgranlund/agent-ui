import { describe, it, expect, afterEach } from 'vitest'
import { UIGaugeElement } from './gauge.ts'

// gauge.test.ts — jsdom behaviour probes (ADR-0229 cl.4). jsdom is blind to painted geometry — the
// whole-shape/inset-geometry proofs live in gauge.browser.test.ts. This file covers: prop typing/
// defaults, ARIA via internals (role=list, generated/absent label), DOM shape (rings svg + legend +
// one listitem per ring, aria-hidden rings, printed label/percent text, outer→inner ring identity),
// degenerate-data handling (empty/dropped entries/clamped out-of-range values), and zero residue across
// connect/disconnect.

// A throwaway subclass re-exposing the protected `internals` (the pie-chart/column-chart precedent).
class ProbeGauge extends UIGaugeElement {
  get probeInternals(): ElementInternals {
    return this.internals
  }
}
customElements.define('ui-gauge-probe', ProbeGauge)

const mounted: HTMLElement[] = []
function mount(el: HTMLElement): HTMLElement {
  document.body.append(el)
  mounted.push(el)
  return el
}
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

const SYSTEM_LOAD = [
  { label: 'CPU', value: 72 },
  { label: 'Memory', value: 54 },
  { label: 'Disk', value: 31 },
]

describe('UIGaugeElement — upgrade + typed props', () => {
  it('upgrades to the class; data defaults to [], label defaults to ""', () => {
    const el = document.createElement('ui-gauge') as UIGaugeElement
    expect(el).toBeInstanceOf(UIGaugeElement)
    expect(el.data).toEqual([])
    expect(el.label).toBe('')
  })

  it('self-defines as ui-gauge, guarded against double-define', () => {
    expect(customElements.get('ui-gauge')).toBe(UIGaugeElement)
    expect(() => {
      if (!customElements.get('ui-gauge')) customElements.define('ui-gauge', UIGaugeElement)
    }).not.toThrow()
  })

  it('a JSON `data` attribute parses to the typed array on connect', () => {
    const el = document.createElement('ui-gauge') as UIGaugeElement
    el.setAttribute('data', JSON.stringify(SYSTEM_LOAD))
    mount(el)
    expect(el.data).toEqual(SYSTEM_LOAD)
  })

  it('malformed `data` attribute JSON never throws — falls back to []', () => {
    const el = document.createElement('ui-gauge') as UIGaugeElement
    expect(() => el.setAttribute('data', '{not json')).not.toThrow()
    mount(el)
    expect(el.data).toEqual([])
  })
})

describe('UIGaugeElement — list semantics via internals', () => {
  it('role=list is set via ElementInternals on connect — NEVER a host role attribute', () => {
    const el = mount(new ProbeGauge()) as ProbeGauge
    expect(el.probeInternals.role).toBe('list')
    expect(el.getAttribute('role')).toBeNull()
  })

  it('an empty `label` leaves the list unlabeled (legal), still role=list, never aria-hidden', () => {
    const el = mount(new ProbeGauge()) as ProbeGauge
    expect(el.probeInternals.ariaLabel).toBeNull()
    expect(el.probeInternals.role).toBe('list')
    expect(el.hasAttribute('aria-hidden')).toBe(false)
  })

  it('a non-empty `label` names the list via internals.ariaLabel — never a host aria-label attribute', () => {
    const el = new ProbeGauge()
    el.label = 'System load'
    mount(el)
    expect(el.probeInternals.ariaLabel).toBe('System load')
    expect(el.hasAttribute('aria-label')).toBe(false)
  })

  it('label is reactive: set → clear → set again', async () => {
    const el = mount(new ProbeGauge()) as ProbeGauge
    el.label = 'System load'
    await el.updateComplete
    expect(el.probeInternals.ariaLabel).toBe('System load')
    el.label = ''
    await el.updateComplete
    expect(el.probeInternals.ariaLabel).toBeNull()
  })
})

describe('UIGaugeElement — rings + legend rendering (ADR-0229 cl.4)', () => {
  it('one role=listitem per valid datum, in order; one aria-hidden rings svg', () => {
    const el = new UIGaugeElement()
    el.data = SYSTEM_LOAD
    mount(el)
    const rings = el.querySelector('[data-part="rings"]') as SVGSVGElement
    expect(rings).not.toBeNull()
    expect(rings.getAttribute('aria-hidden')).toBe('true')
    const items = el.querySelectorAll('[role="listitem"]')
    expect(items).toHaveLength(3)
    expect(items[0].querySelector('[data-part="key-label"]')?.textContent).toBe('CPU')
    expect(items[1].querySelector('[data-part="key-label"]')?.textContent).toBe('Memory')
    expect(items[2].querySelector('[data-part="key-label"]')?.textContent).toBe('Disk')
  })

  it('exactly one track + one progress circle per ring, outer→inner in data order (DOM order = data order)', () => {
    const el = new UIGaugeElement()
    el.data = SYSTEM_LOAD
    mount(el)
    const tracks = [...el.querySelectorAll('[data-part="track"]')]
    const progress = [...el.querySelectorAll('[data-part="progress"]')]
    expect(tracks).toHaveLength(3)
    expect(progress).toHaveLength(3)
    expect(tracks.map((t) => t.getAttribute('data-index'))).toEqual(['0', '1', '2'])
    expect(progress.map((p) => p.getAttribute('data-index'))).toEqual(['0', '1', '2'])
    // outer→inner: the first ring's radius is strictly larger than the second's.
    const r0 = Number(tracks[0].getAttribute('r'))
    const r1 = Number(tracks[1].getAttribute('r'))
    expect(r0).toBeGreaterThan(r1)
  })

  it('the legend row order matches the ring order (same index, DOM order = data order)', () => {
    const el = new UIGaugeElement()
    el.data = [
      { label: 'a', value: 10 },
      { label: 'b', value: 20 },
      { label: 'c', value: 30 },
    ]
    mount(el)
    const progress = [...el.querySelectorAll('[data-part="progress"]')]
    const rows = [...el.querySelectorAll('[role="listitem"]')]
    expect(progress.map((p) => p.getAttribute('data-index'))).toEqual(['0', '1', '2'])
    expect(rows.map((r) => r.getAttribute('data-index'))).toEqual(['0', '1', '2'])
  })

  it("the legend row's combined text content is exactly `{label} · {value%}`", () => {
    const el = new UIGaugeElement()
    el.data = [{ label: 'CPU', value: 72 }]
    mount(el)
    const item = el.querySelector('[role="listitem"]') as HTMLElement
    expect(item.textContent).toBe('CPU · 72%')
  })

  it('the key-swatch is aria-hidden and text-free (the fill is a shared, non-sole identity carrier)', () => {
    const el = new UIGaugeElement()
    el.data = [{ label: 'a', value: 10 }]
    mount(el)
    const swatch = el.querySelector('[data-part="key-swatch"]') as HTMLElement
    expect(swatch.getAttribute('aria-hidden')).toBe('true')
    expect(swatch.textContent).toBe('')
  })

  it('each ring + its matching key-swatch reads the SAME --_ring-ink token, cycling past 6', () => {
    const el = new UIGaugeElement()
    el.data = Array.from({ length: 7 }, (_, i) => ({ label: `r${i}`, value: 50 }))
    mount(el)
    const progress = [...el.querySelectorAll('[data-part="progress"]')] as SVGElement[]
    const swatches = [...el.querySelectorAll('[data-part="key-swatch"]')] as HTMLElement[]
    expect(progress[0].style.getPropertyValue('--_ring-ink')).toBe('var(--ui-gauge-series-1-ink)')
    expect(swatches[0].style.getPropertyValue('--_ring-ink')).toBe('var(--ui-gauge-series-1-ink)')
    expect(progress[5].style.getPropertyValue('--_ring-ink')).toBe('var(--ui-gauge-series-6-ink)')
    expect(progress[6].style.getPropertyValue('--_ring-ink')).toBe('var(--ui-gauge-series-1-ink)') // cycles past 6
  })

  it('the progress circle carries the dasharray/dashoffset geometry hooks', () => {
    const el = new UIGaugeElement()
    el.data = [{ label: 'half', value: 50 }]
    mount(el)
    const progress = el.querySelector('[data-part="progress"]') as SVGElement
    expect(progress.style.getPropertyValue('--_ring-circumference')).not.toBe('')
    expect(progress.style.getPropertyValue('--_ring-dashoffset')).not.toBe('')
  })

  it('changing `data` re-renders reactively (whole-array swap, no incremental patch)', async () => {
    const el = new UIGaugeElement()
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

describe('UIGaugeElement — axis/today/provisional chrome is N/A (ADR-0228 N/A grammar)', () => {
  it('never renders a grid-line, tick-label, category-label, now-dot, now-tick, or callout part', () => {
    const el = new UIGaugeElement()
    el.data = SYSTEM_LOAD
    mount(el)
    for (const part of ['grid-line', 'tick-label', 'category-label', 'now-dot', 'now-tick', 'callout']) {
      expect(el.querySelector(`[data-part="${part}"]`), `unexpected [data-part="${part}"]`).toBeNull()
    }
  })
})

describe('UIGaugeElement — degenerate data (ADR-0229 cl.4)', () => {
  it('empty data → zero rings, zero legend rows; host remains role=list', () => {
    const el = mount(new ProbeGauge()) as ProbeGauge
    expect(el.querySelectorAll('[role="listitem"]')).toHaveLength(0)
    expect(el.querySelector('[data-part="track"]')).toBeNull()
    expect(el.querySelector('[data-part="progress"]')).toBeNull()
    expect(el.probeInternals.role).toBe('list')
  })

  it('exactly one valid datum → one legend row reading "{label} · {value%}"', () => {
    const el = new UIGaugeElement()
    el.data = [{ label: 'solo', value: 42 }]
    mount(el)
    const items = el.querySelectorAll('[role="listitem"]')
    expect(items).toHaveLength(1)
    expect(items[0].textContent).toBe('solo · 42%')
  })

  it('a negative value is KEPT and clamped to 0% (never dropped — the documented divergence from ui-pie-chart)', () => {
    const el = new UIGaugeElement()
    el.data = [
      { label: 'ok', value: 10 },
      { label: 'neg', value: -20 },
    ]
    mount(el)
    const labels = [...el.querySelectorAll('[data-part="key-label"]')].map((n) => n.textContent)
    expect(labels).toEqual(['ok', 'neg'])
    const percents = [...el.querySelectorAll('[data-part="key-percent"]')].map((n) => n.textContent)
    expect(percents).toEqual(['10%', '0%'])
  })

  it('a value over 100 is KEPT and clamped to 100%', () => {
    const el = new UIGaugeElement()
    el.data = [{ label: 'over', value: 140 }]
    mount(el)
    expect(el.querySelector('[data-part="key-percent"]')?.textContent).toBe('100%')
  })

  it('an empty-string label is dropped', () => {
    const el = new UIGaugeElement()
    el.data = [
      { label: '', value: 10 },
      { label: 'ok', value: 5 },
    ]
    mount(el)
    const labels = [...el.querySelectorAll('[data-part="key-label"]')].map((n) => n.textContent)
    expect(labels).toEqual(['ok'])
  })

  it('a property write of mixed garbage never reaches the render path', () => {
    const el = new UIGaugeElement()
    // @ts-expect-error — deliberately garbage at the property boundary, exactly what cleanData must guard
    el.data = [{ label: 'ok', value: 1 }, { label: 'bad' }, null, { label: 'x', value: 'nope' }, { label: 'ok2', value: 2 }]
    mount(el)
    const labels = [...el.querySelectorAll('[data-part="key-label"]')].map((n) => n.textContent)
    expect(labels).toEqual(['ok', 'ok2'])
  })

  it('a non-array property write (e.g. null) never throws and renders zero rows', () => {
    const el = new UIGaugeElement()
    // @ts-expect-error — a non-array write, the codec's inbound counterpart (property path, not attribute)
    expect(() => (el.data = null)).not.toThrow()
    mount(el)
    expect(el.querySelectorAll('[role="listitem"]')).toHaveLength(0)
  })
})

describe('UIGaugeElement — zero residue across connect/disconnect', () => {
  it('effects die on disconnect; reconnect re-installs exactly once (not stacked)', async () => {
    const el = mount(new ProbeGauge()) as ProbeGauge
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
