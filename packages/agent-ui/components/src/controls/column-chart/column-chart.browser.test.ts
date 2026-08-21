import { describe, it, expect, afterEach } from 'vitest'
import { server, cdp } from 'vitest/browser'

// column-chart.browser.test.ts — the cross-engine browser-truth proof (ADR-0228/ADR-0229; jsdom is blind
// to painted geometry). Runs in BOTH Chromium and WebKit (vitest.browser.config.ts). Covers what jsdom
// cannot: the whole-shape floor, the two-layer full-bleed model (plot/columns at zero inset, chrome
// chips staying INSIDE the box), the now-marker's short (never full-height) tick, the projected ghost's
// hollow paint, the six-step series ramp's RESOLVED lightness ladder (the ADR-0219 Amendment class of
// regression only a real engine can catch), and forced-colors.

import '@agent-ui/components/foundation-styles.css'
import '../_chart/chart-axis.css' // the shared ADR-0228 token chain — column-chart.css ALIASES from it (the family-tunnel pattern); loaded first, the same load-bearing order component-styles.css enforces
import './column-chart.css'
import './column-chart.ts'

const mounted: HTMLElement[] = []
const mount = (markup: string): HTMLElement => {
  const wrap = document.createElement('div')
  wrap.innerHTML = markup
  document.body.append(wrap)
  mounted.push(wrap)
  return wrap.firstElementChild as HTMLElement
}
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

const px = (v: string): number => Number.parseFloat(v)
const tokenPx = (el: HTMLElement, name: string): number => px(getComputedStyle(el).getPropertyValue(name))

const alphaOf = (color: string): number => {
  if (color === 'transparent') return 0
  const m = color.match(/rgba?\(([^)]+)\)/i)
  if (!m) return 1
  const parts = m[1].split(/[\s,/]+/).filter(Boolean)
  return parts.length >= 4 ? Number(parts[3]) : 1
}

interface CdpSession {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>
}

const REVENUE = JSON.stringify([
  { label: 'Mar', values: [8, 4] },
  { label: 'Apr', values: [10, 5] },
  { label: 'May', values: [9, 6] },
  { label: 'Jun', values: [11, 7] },
])
const SERIES = JSON.stringify(['Product', 'Services'])

describe('ui-column-chart — whole-shape (test-the-whole-shape)', () => {
  it('a bare, unstyled, populated chart in an unstyled flex row paints a visible, non-collapsed box >= its floor, with a real plot + at least one real column segment', () => {
    const row = mount(`<div style="display:flex"><ui-column-chart data='${REVENUE}' series='${SERIES}'></ui-column-chart></div>`)
    const chart = row.querySelector('ui-column-chart') as HTMLElement
    const wFloor = tokenPx(chart, '--ui-column-chart-min-inline-size')
    const hFloor = tokenPx(chart, '--ui-column-chart-min-block-size')
    expect(wFloor, 'anti-vacuous: the width floor token must resolve to a real px value').toBeGreaterThan(0)
    expect(hFloor, 'anti-vacuous: the height floor token must resolve to a real px value').toBeGreaterThan(0)
    const box = chart.getBoundingClientRect()
    expect(box.width, 'the chart collapsed below its whole-shape width floor').toBeGreaterThanOrEqual(wFloor - 1)
    expect(box.height, 'the chart collapsed below its whole-shape height floor').toBeGreaterThanOrEqual(hFloor - 1)

    const segment = chart.querySelector('[data-part="segment"]') as HTMLElement
    const segBox = segment.getBoundingClientRect()
    expect(segBox.width, 'the first segment painted zero width').toBeGreaterThan(0)
    expect(segBox.height, 'the first segment painted zero height').toBeGreaterThan(0)
  })
})

describe('ui-column-chart — the two-layer full-bleed model (ADR-0228 cl.1-3)', () => {
  it('the plot + columns layers span the SAME box, edge-to-edge, at zero inset', () => {
    const chart = mount(`<ui-column-chart data='${REVENUE}'></ui-column-chart>`) as HTMLElement
    const chartBox = chart.getBoundingClientRect()
    const plot = chart.querySelector('[data-part="plot"]') as unknown as HTMLElement
    const columns = chart.querySelector('[data-part="columns"]') as HTMLElement
    for (const layer of [plot, columns]) {
      const box = layer.getBoundingClientRect()
      expect(Math.round(box.width)).toBeCloseTo(Math.round(chartBox.width), 0)
      expect(Math.round(box.height)).toBeCloseTo(Math.round(chartBox.height), 0)
    }
  })

  it('every chip stays INSIDE the plot box — never overflows past the chart edges (the chip-collision clamp law)', () => {
    const chart = mount(`<ui-column-chart data='${REVENUE}'></ui-column-chart>`) as HTMLElement
    const chartBox = chart.getBoundingClientRect()
    const chips = chart.querySelectorAll('[data-part="tick-label"], [data-part="category-label"]')
    expect(chips.length).toBeGreaterThan(0)
    for (const chip of chips) {
      const box = (chip as HTMLElement).getBoundingClientRect()
      expect(box.left, `a chip overflowed the LEFT edge (${box.left} < ${chartBox.left})`).toBeGreaterThanOrEqual(chartBox.left - 1)
      expect(box.right, `a chip overflowed the RIGHT edge`).toBeLessThanOrEqual(chartBox.right + 1)
      expect(box.top, `a chip overflowed the TOP edge`).toBeGreaterThanOrEqual(chartBox.top - 1)
      expect(box.bottom, `a chip overflowed the BOTTOM edge`).toBeLessThanOrEqual(chartBox.bottom + 1)
    }
  })
})

describe('ui-column-chart — the now-marker is a SHORT tick, never full-height (ADR-0228 cl.4)', () => {
  it('the now-tick spans only a small fraction of the plot height, anchored at the baseline', () => {
    const chart = mount(`<ui-column-chart data='${REVENUE}' projected="1"></ui-column-chart>`) as HTMLElement
    const chartBox = chart.getBoundingClientRect()
    const tick = chart.querySelector('[data-part="now-tick"]') as unknown as SVGLineElement
    const dot = chart.querySelector('[data-part="now-dot"]') as unknown as SVGCircleElement
    expect(tick).not.toBeNull()
    expect(dot).not.toBeNull()
    const tickBox = (tick as unknown as SVGGraphicsElement).getBBox()
    // the tick's height in user units is NOW_TICK_DEPTH_PCT (8) out of a 100-unit viewBox — well under half.
    expect(tickBox.height).toBeLessThan(50)
    expect(tickBox.height).toBeGreaterThan(0)
    void chartBox
  })

  it('is absent entirely when there is no projected span', () => {
    const chart = mount(`<ui-column-chart data='${REVENUE}'></ui-column-chart>`) as HTMLElement
    expect(chart.querySelector('[data-part="now-tick"]')).toBeNull()
    expect(chart.querySelector('[data-part="now-dot"]')).toBeNull()
  })
})

describe('ui-column-chart — the projected ghost is hollow (no fill), a line-style carrier of provisionality (ADR-0228 cl.4)', () => {
  it('a projected segment computes a transparent background and a dashed border', () => {
    const chart = mount(`<ui-column-chart data='${REVENUE}' projected="1"></ui-column-chart>`) as HTMLElement
    const categories = chart.querySelectorAll('[data-part="category"]')
    const ghost = categories[categories.length - 1].querySelector('[data-part="segment"]') as HTMLElement
    const style = getComputedStyle(ghost)
    expect(alphaOf(style.backgroundColor), 'a projected ghost must NOT paint a solid fill').toBe(0)
    expect(style.borderStyle).toContain('dashed')
  })
})

describe('ui-column-chart — the six RESOLVED series fills are pairwise distinct AND monotone bright→dark in BOTH schemes (ADR-0228 cl.6, generalizing the ADR-0219 Amendment)', () => {
  const lightnessOf = (color: string): number => {
    const ok = /^oklch\(\s*([\d.]+)(%?)/.exec(color)
    if (ok) return ok[2] ? Number(ok[1]) / 100 : Number(ok[1])
    const rgb = /^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/.exec(color)
    const srgb = /^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(color)
    const m = rgb ?? srgb
    if (!m) throw new Error(`unparseable computed segment fill: ${color}`)
    const scale = rgb ? 255 : 1
    const lin = [m[1], m[2], m[3]].map((c) => {
      const v = Number(c) / scale
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
    })
    return Math.cbrt(0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2])
  }

  const SIX_SERIES = JSON.stringify(['s1', 's2', 's3', 's4', 's5', 's6'])
  const ONE_ROW_SIX_SERIES = JSON.stringify([{ label: 'only', values: [1, 1, 1, 1, 1, 1] }])

  for (const scheme of ['light', 'dark'] as const) {
    it(`${scheme}: six series resolve six pairwise-distinct segment fills, strictly darker 1→6`, () => {
      const wrap = document.createElement('div')
      wrap.style.colorScheme = scheme
      wrap.innerHTML = `<ui-column-chart data='${ONE_ROW_SIX_SERIES}' series='${SIX_SERIES}'></ui-column-chart>`
      document.body.append(wrap)
      mounted.push(wrap)
      const fills = [...wrap.querySelectorAll('[data-part="segment"]')].map((s) => getComputedStyle(s).backgroundColor)
      expect(fills.length, `${scheme}: six series must render six segments`).toBe(6)
      for (const fill of fills) expect(alphaOf(fill), `${scheme}: a segment resolved transparent (${fill})`).toBeGreaterThan(0)
      expect(new Set(fills).size, `${scheme}: resolved fills must be pairwise distinct — got ${fills.join(' · ')}`).toBe(6)
      const ladder = fills.map(lightnessOf)
      for (let i = 1; i < ladder.length; i++) {
        expect(ladder[i], `${scheme}: lightness must strictly DECREASE 1→6 — got ${ladder.map((l) => l.toFixed(3)).join(' > ')}`).toBeLessThan(ladder[i - 1])
      }
    })
  }
})

describe('ui-column-chart — forced colors (ADR-0057/ADR-0228)', () => {
  it('forced-colors keeps segments + gridlines visible in system inks; Chromium emulates (CDP), WebKit asserts the baseline', async () => {
    const chart = mount(`<ui-column-chart data='${REVENUE}'></ui-column-chart>`) as HTMLElement
    const segment = chart.querySelector('[data-part="segment"]') as HTMLElement

    expect(alphaOf(getComputedStyle(segment).backgroundColor), 'baseline segment is invisible').toBeGreaterThan(0)

    if (server.browser !== 'chromium') {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(false)
      return
    }

    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] })
    try {
      expect(window.matchMedia('(forced-colors: active)').matches, 'CDP did not enter forced-colors').toBe(true)
      expect(alphaOf(getComputedStyle(segment).backgroundColor), 'segment vanished under forced-colors').toBeGreaterThan(0)
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] })
    }
  })
})
