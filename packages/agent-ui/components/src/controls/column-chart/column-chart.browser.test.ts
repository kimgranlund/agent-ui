import { describe, it, expect, afterEach } from 'vitest'
import { server, cdp } from 'vitest/browser'

// column-chart.browser.test.ts — the cross-engine browser-truth proof (ADR-0228/ADR-0229/ADR-0230; jsdom
// is blind to painted geometry AND to container queries). Runs in BOTH Chromium and WebKit
// (vitest.browser.config.ts). Covers what jsdom cannot: the whole-shape floor, the two-layer full-bleed
// model (plot/columns at zero inset, chrome chips staying INSIDE the box) — now proven over the HTML
// plot layer (ADR-0230 cl.1, the SVG substrate retired), the now-marker's short (never full-height)
// tick, the projected ghost's hollow paint, the six-step series ramp's RESOLVED lightness ladder (the
// ADR-0219 Amendment class of regression only a real engine can catch), forced-colors, the
// container-query chrome-degradation ladder's three rungs (ADR-0230 cl.4), and the now-marker's
// RTL-mirrored position (ADR-0230 Consequences — a latent defect the HTML swap retires).

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

  it('every category-label chip AND the callout stay INSIDE the plot box under dir="rtl" too (the chrome-layer half of the RTL fix — translate\'s x-component is physical, so the clamp shift needs its own dir(rtl) sign-flip, ADR-0230 build-review finding)', () => {
    const wrap = document.createElement('div')
    wrap.dir = 'rtl'
    wrap.innerHTML = `<ui-column-chart data='${REVENUE}' highlight="0"></ui-column-chart>`
    document.body.append(wrap)
    mounted.push(wrap)
    const chart = wrap.querySelector('ui-column-chart') as HTMLElement
    const chartBox = chart.getBoundingClientRect()
    const chips = chart.querySelectorAll('[data-part="category-label"], [data-part="callout"]')
    expect(chips.length).toBeGreaterThan(0)
    for (const chip of chips) {
      const box = (chip as HTMLElement).getBoundingClientRect()
      expect(box.left, `RTL: a chip overflowed the LEFT edge (${box.left} < ${chartBox.left})`).toBeGreaterThanOrEqual(chartBox.left - 1)
      expect(box.right, `RTL: a chip overflowed the RIGHT edge (${box.right} > ${chartBox.right})`).toBeLessThanOrEqual(chartBox.right + 1)
    }
  })
})

describe('ui-column-chart — the now-marker is a SHORT tick, never full-height (ADR-0228 cl.4)', () => {
  it('the now-tick spans only a small fraction of the plot height, anchored at the baseline', () => {
    const chart = mount(`<ui-column-chart data='${REVENUE}' projected="1"></ui-column-chart>`) as HTMLElement
    const chartBox = chart.getBoundingClientRect()
    const tick = chart.querySelector('[data-part="now-tick"]') as HTMLElement
    const dot = chart.querySelector('[data-part="now-dot"]') as HTMLElement
    expect(tick).not.toBeNull()
    expect(dot).not.toBeNull()
    // ADR-0230 cl.1 — geometry facts, not SVG user-unit facts (the SVG plot layer retired): the now-tick
    // is a real, rendered CSS box whose height is NOW_TICK_DEPTH_PCT (8%) of the plot's block size — well
    // under half — anchored at the baseline (its bottom edge sits on the chart's own bottom edge).
    const tickBox = tick.getBoundingClientRect()
    expect(tickBox.height).toBeLessThan(chartBox.height * 0.5)
    expect(tickBox.height).toBeGreaterThan(0)
    expect(Math.round(tickBox.bottom)).toBeCloseTo(Math.round(chartBox.bottom), 0)
  })

  it('is absent entirely when there is no projected span', () => {
    const chart = mount(`<ui-column-chart data='${REVENUE}'></ui-column-chart>`) as HTMLElement
    expect(chart.querySelector('[data-part="now-tick"]')).toBeNull()
    expect(chart.querySelector('[data-part="now-dot"]')).toBeNull()
  })
})

describe('ui-column-chart — the now-marker mirrors under dir="rtl" (ADR-0230 Consequences — the RTL/columns disagreement latent defect retires)', () => {
  it('the now-marker sits at the SAME rendered column as the actual/projected boundary in both directions', () => {
    const ltr = mount(`<ui-column-chart data='${REVENUE}' projected="1"></ui-column-chart>`) as HTMLElement
    const rtlWrap = document.createElement('div')
    rtlWrap.dir = 'rtl'
    rtlWrap.innerHTML = `<ui-column-chart data='${REVENUE}' projected="1"></ui-column-chart>`
    document.body.append(rtlWrap)
    mounted.push(rtlWrap)
    const rtl = rtlWrap.querySelector('ui-column-chart') as HTMLElement

    for (const chart of [ltr, rtl]) {
      const isRtl = getComputedStyle(chart).direction === 'rtl'
      const dot = chart.querySelector('[data-part="now-dot"]') as HTMLElement
      const lastActualCategory = chart.querySelectorAll('[data-part="category"]')[2] as HTMLElement
      const projectedCategory = chart.querySelectorAll('[data-part="category"]')[3] as HTMLElement
      const dotBox = dot.getBoundingClientRect()
      const lastBox = lastActualCategory.getBoundingClientRect()
      const projectedBox = projectedCategory.getBoundingClientRect()
      const dotCenter = (dotBox.left + dotBox.right) / 2
      // The two categories are ADJACENT flex items separated only by `--ui-column-chart-column-gap` — the
      // now-marker's math (axis-math.ts) is gap-BLIND by design (a presentational CSS detail, not a data
      // fact), so the correct check is a RANGE (the facing edges of the two boxes, whatever the gap is),
      // never an exact-pixel target. The facing edge flips with direction (LTR: last-actual's physical
      // RIGHT faces projected's LEFT; RTL: mirrored — last-actual's physical LEFT faces projected's RIGHT)
      // — exactly the agreement ADR-0230's HTML swap buys: both the marker and the columns move together.
      const facingEdgeOfLast = isRtl ? lastBox.left : lastBox.right
      const facingEdgeOfProjected = isRtl ? projectedBox.right : projectedBox.left
      const boundaryLo = Math.min(facingEdgeOfLast, facingEdgeOfProjected)
      const boundaryHi = Math.max(facingEdgeOfLast, facingEdgeOfProjected)
      const slack = 1 // sub-pixel rounding only — the range itself already absorbs the real column-gap
      expect(dotCenter, `${isRtl ? 'RTL' : 'LTR'}: now-dot center (${dotCenter}) fell outside the last-actual/projected boundary gap [${boundaryLo}, ${boundaryHi}]`).toBeGreaterThanOrEqual(boundaryLo - slack)
      expect(dotCenter).toBeLessThanOrEqual(boundaryHi + slack)
    }
  })
})

describe('ui-column-chart — the container-query chrome-degradation ladder (ADR-0230 cl.3/cl.4)', () => {
  const WIDE_ROWS = JSON.stringify(
    Array.from({ length: 9 }, (_, i) => ({ label: `Cat${i}`, values: [i + 1] })),
  )

  // Container-query `em` resolves against the QUERIED CONTAINER's own font-size — the host's, which is
  // `--md-sys-typescale-label-medium-size` (12px at default scale/density), NOT the document root's
  // 16px (the ADR-0230 Context arithmetic's own basis: "1 host-em = 12px", 28em = 336px, 16em = 192px).
  // Fixed PX widths set directly on the CHART element (never the wrap) so the assertion is immune to any
  // ambient root font-size — comfortably clear of each boundary, never mounted exactly AT one.
  const WIDE_PX = 400 // > 28em (336px)
  const MEDIUM_PX = 260 // between 16em (192px) and 28em (336px)
  const NARROW_PX = 150 // < 16em (192px) — reachable only via a deliberate floor override (ADR-0230 cl.4)

  const mountAt = (widthPx: number): HTMLElement => {
    const wrap = document.createElement('div')
    wrap.innerHTML = `<ui-column-chart data='${WIDE_ROWS}'></ui-column-chart>`
    document.body.append(wrap)
    mounted.push(wrap)
    const chart = wrap.querySelector('ui-column-chart') as HTMLElement
    chart.style.inlineSize = `${widthPx}px`
    return chart
  }

  it('wide (>=28em): full chrome — no fine-density chip is hidden', () => {
    const chart = mountAt(WIDE_PX)
    const fine = [...chart.querySelectorAll('[data-density="fine"]')] as HTMLElement[]
    expect(fine.length).toBeGreaterThan(0) // anti-vacuous — the math DID stamp a fine tier
    for (const chip of fine) expect(getComputedStyle(chip).display).not.toBe('none')
  })

  it('medium (16em-28em): the fine density tier hides; first + last category chips survive with no intersecting chips (SPEC-R17 AC1/AC2)', () => {
    const chart = mountAt(MEDIUM_PX)
    const fine = [...chart.querySelectorAll('[data-density="fine"]')] as HTMLElement[]
    expect(fine.length).toBeGreaterThan(0)
    for (const chip of fine) expect(getComputedStyle(chip).display).toBe('none')

    const survivors = [...chart.querySelectorAll('[data-part="category-label"]')].filter(
      (chip) => getComputedStyle(chip).display !== 'none',
    ) as HTMLElement[]
    expect(survivors.length).toBeGreaterThan(0)
    expect(survivors[0].textContent).toBe('Cat0') // AC1 — first category survives
    expect(survivors[survivors.length - 1].textContent).toBe('Cat8') // AC1 — last category survives

    // AC2 — no two SURVIVING chip bounding boxes intersect.
    const boxes = survivors.map((el) => el.getBoundingClientRect())
    for (let i = 1; i < boxes.length; i++) {
      expect(boxes[i].left, `chip ${i} overlaps its predecessor`).toBeGreaterThanOrEqual(boxes[i - 1].right)
    }

    // the plot + chrome layers still render at the medium rung (only the fine tier hides).
    expect(getComputedStyle(chart.querySelector('[data-part="plot"]') as HTMLElement).display).not.toBe('none')
    expect(getComputedStyle(chart.querySelector('[data-part="chrome"]') as HTMLElement).display).not.toBe('none')
  })

  it('narrow (<16em): bare marks — all chrome and plot furniture hide, only the columns mark remains', () => {
    const chart = mountAt(NARROW_PX)
    chart.style.setProperty('min-inline-size', '0') // the deliberate sub-floor override the rung is FOR (ADR-0230 cl.4)
    const plot = chart.querySelector('[data-part="plot"]') as HTMLElement
    const chrome = chart.querySelector('[data-part="chrome"]') as HTMLElement
    const columns = chart.querySelector('[data-part="columns"]') as HTMLElement
    expect(getComputedStyle(plot).display).toBe('none')
    expect(getComputedStyle(chrome).display).toBe('none')
    expect(getComputedStyle(columns).display).not.toBe('none')
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
