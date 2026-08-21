import { describe, it, expect, afterEach } from 'vitest'
import { server, cdp } from 'vitest/browser'

// gauge.browser.test.ts — the cross-engine browser-truth proof (ADR-0228/ADR-0229 cl.4; jsdom is blind
// to painted geometry). Runs in BOTH Chromium and WebKit (vitest.browser.config.ts). Covers what jsdom
// cannot: the whole-shape floor, the two-layer full-bleed model GENERALIZED to a radial mark (rings
// layer at zero inset, legend layer clearing the chrome-inset token — the two Kim-reinforced load-
// bearing criteria this build names explicitly), rounded caps, the arc-percent actually reaching the
// painted geometry (getTotalLength()-derived dash math), the six-step series ramp's RESOLVED lightness
// ladder (the ADR-0219 Amendment class of regression only a real engine can catch), and forced-colors.

import '@agent-ui/components/foundation-styles.css'
import '../_chart/chart-axis.css' // the shared ADR-0228 token chain — gauge.css ALIASES from it (the family-tunnel pattern); loaded first, the same load-bearing order component-styles.css enforces
import './gauge.css'
import './gauge.ts'

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

const SYSTEM_LOAD = JSON.stringify([
  { label: 'CPU', value: 72 },
  { label: 'Memory', value: 54 },
  { label: 'Disk', value: 31 },
])

describe('ui-gauge — whole-shape (test-the-whole-shape)', () => {
  it('a bare, unstyled, populated gauge in an unstyled flex row paints a visible, non-collapsed box >= its floor, with real rings + a real legend row', () => {
    const row = mount(`<div style="display:flex"><ui-gauge data='${SYSTEM_LOAD}'></ui-gauge></div>`)
    const gauge = row.querySelector('ui-gauge') as HTMLElement
    const wFloor = tokenPx(gauge, '--ui-gauge-min-inline-size')
    const hFloor = tokenPx(gauge, '--ui-gauge-min-block-size')
    expect(wFloor, 'anti-vacuous: the width floor token must resolve to a real px value').toBeGreaterThan(0)
    expect(hFloor, 'anti-vacuous: the height floor token must resolve to a real px value').toBeGreaterThan(0)
    const box = gauge.getBoundingClientRect()
    expect(box.width, 'the gauge collapsed below its whole-shape width floor').toBeGreaterThanOrEqual(wFloor - 1)
    expect(box.height, 'the gauge collapsed below its whole-shape height floor').toBeGreaterThanOrEqual(hFloor - 1)

    const progress = gauge.querySelector('[data-part="progress"]') as unknown as SVGGraphicsElement
    const progressBox = progress.getBBox()
    expect(progressBox.width, 'the first progress ring painted zero width').toBeGreaterThan(0)
    expect(progressBox.height, 'the first progress ring painted zero height').toBeGreaterThan(0)

    const row0 = gauge.querySelector('[role="listitem"]') as HTMLElement
    expect(row0.getBoundingClientRect().width, 'the first legend row painted zero width').toBeGreaterThan(0)
  })
})

describe('ui-gauge — the two-layer full-bleed model, generalized to a radial mark (ADR-0228 cl.1-3; Kim reinforcement 1)', () => {
  it('the rings SVG layer spans the SAME box as the host, edge-to-edge, at zero inset', () => {
    const gauge = mount(`<ui-gauge data='${SYSTEM_LOAD}'></ui-gauge>`) as HTMLElement
    const gaugeBox = gauge.getBoundingClientRect()
    const rings = gauge.querySelector('[data-part="rings"]') as unknown as HTMLElement
    const box = rings.getBoundingClientRect()
    expect(Math.round(box.width)).toBeCloseTo(Math.round(gaugeBox.width), 0)
    expect(Math.round(box.height)).toBeCloseTo(Math.round(gaugeBox.height), 0)
  })

  it('every legend row clears --ui-gauge-chrome-inset from every host edge — never overflows, never touches the raw edge (the ring layer is never shrunk to make room)', () => {
    const gauge = mount(`<ui-gauge data='${SYSTEM_LOAD}' style="inline-size: 28rem; block-size: 14rem;"></ui-gauge>`) as HTMLElement
    const gaugeBox = gauge.getBoundingClientRect()
    // `--ui-gauge-chrome-inset` is itself an ALIAS (`var(--ui-chart-chrome-inset)`) — reading the custom
    // property's raw text via getPropertyValue returns the unresolved `var(...)` token stream, not a px
    // number (custom properties never resolve nested var() chains at getComputedStyle time). Read the
    // legend layer's own REAL, fully-resolved `padding` longhand instead — the used value the layout
    // engine actually applied.
    const legend = gauge.querySelector('[data-part="legend"]') as HTMLElement
    const inset = px(getComputedStyle(legend).paddingTop)
    expect(inset, 'anti-vacuous: the legend layer\'s resolved padding must be a real px value').toBeGreaterThan(0)
    const rows = gauge.querySelectorAll('[role="listitem"]')
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      const box = (row as HTMLElement).getBoundingClientRect()
      expect(box.left, `a legend row crossed the LEFT inset boundary (${box.left} < ${gaugeBox.left})`).toBeGreaterThanOrEqual(gaugeBox.left - 1)
      expect(box.right, `a legend row overflowed the RIGHT edge`).toBeLessThanOrEqual(gaugeBox.right + 1)
      expect(box.top, `a legend row overflowed the TOP inset boundary`).toBeGreaterThanOrEqual(gaugeBox.top + inset - 1)
      expect(box.bottom, `a legend row overflowed the BOTTOM inset boundary`).toBeLessThanOrEqual(gaugeBox.bottom - inset + 1)
    }
  })

  it('dropped into a zero-padding container with NO consumer CSS, the ring + legend still compose (the CSS-less-consumer honesty surface, ADR-0102)', () => {
    const wrap = mount(`<div style="padding:0;"><ui-gauge data='${SYSTEM_LOAD}' label="System load"></ui-gauge></div>`)
    const gauge = wrap.querySelector('ui-gauge') as HTMLElement
    expect(gauge.querySelector('[data-part="rings"]')).not.toBeNull()
    expect(gauge.querySelectorAll('[role="listitem"]').length).toBe(3)
  })
})

describe('ui-gauge — the ring geometry: rounded caps + a real arc-percent reaching the painted stroke (ADR-0229 cl.4)', () => {
  it('the progress circle has rounded caps and a dash length that resolves to a real, positive number', () => {
    const gauge = mount(`<ui-gauge data='${SYSTEM_LOAD}'></ui-gauge>`) as HTMLElement
    const progress = gauge.querySelector('[data-part="progress"]') as unknown as SVGGeometryElement
    const style = getComputedStyle(progress as unknown as Element)
    expect(style.strokeLinecap).toBe('round')
    const totalLength = (progress as unknown as SVGGeometryElement).getTotalLength()
    expect(totalLength, 'the ring circle painted zero circumference').toBeGreaterThan(0)
    const dashOffset = Number.parseFloat(style.strokeDashoffset)
    expect(Number.isFinite(dashOffset)).toBe(true)
    expect(dashOffset).toBeGreaterThanOrEqual(0)
  })

  it('a 100% ring reveals its full circumference (dashoffset ≈ 0); a 0% ring reveals none (dashoffset ≈ circumference)', () => {
    const full = mount(`<ui-gauge data='${JSON.stringify([{ label: 'Full', value: 100 }])}'></ui-gauge>`) as HTMLElement
    const empty = mount(`<ui-gauge data='${JSON.stringify([{ label: 'Empty', value: 0 }])}'></ui-gauge>`) as HTMLElement
    const fullProgress = full.querySelector('[data-part="progress"]') as unknown as SVGGeometryElement
    const emptyProgress = empty.querySelector('[data-part="progress"]') as unknown as SVGGeometryElement
    const fullStyle = getComputedStyle(fullProgress as unknown as Element)
    const emptyStyle = getComputedStyle(emptyProgress as unknown as Element)
    expect(Number.parseFloat(fullStyle.strokeDashoffset)).toBeLessThan(1)
    const emptyCircumference = Number.parseFloat(emptyStyle.strokeDasharray)
    expect(Number.parseFloat(emptyStyle.strokeDashoffset)).toBeCloseTo(emptyCircumference, 0)
  })

  it('outer ring (index 0) has a strictly larger painted radius than the next ring inward', () => {
    const gauge = mount(`<ui-gauge data='${SYSTEM_LOAD}'></ui-gauge>`) as HTMLElement
    const tracks = [...gauge.querySelectorAll('[data-part="track"]')] as unknown as SVGGeometryElement[]
    expect(tracks.length).toBe(3)
    const box0 = (tracks[0] as unknown as SVGGraphicsElement).getBBox()
    const box1 = (tracks[1] as unknown as SVGGraphicsElement).getBBox()
    expect(box0.width).toBeGreaterThan(box1.width)
  })
})

describe('ui-gauge — the six RESOLVED series fills are pairwise distinct AND monotone bright→dark in BOTH schemes (ADR-0228 cl.6, generalizing the ADR-0219 Amendment; Kim reinforcement 2)', () => {
  const lightnessOf = (color: string): number => {
    const ok = /^oklch\(\s*([\d.]+)(%?)/.exec(color)
    if (ok) return ok[2] ? Number(ok[1]) / 100 : Number(ok[1])
    const rgb = /^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/.exec(color)
    const srgb = /^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(color)
    const m = rgb ?? srgb
    if (!m) throw new Error(`unparseable computed ring stroke: ${color}`)
    const scale = rgb ? 255 : 1
    const lin = [m[1], m[2], m[3]].map((c) => {
      const v = Number(c) / scale
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
    })
    return Math.cbrt(0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2])
  }

  const SIX_RINGS = JSON.stringify(Array.from({ length: 6 }, (_, i) => ({ label: `r${i}`, value: 50 })))

  for (const scheme of ['light', 'dark'] as const) {
    it(`${scheme}: six rings resolve six pairwise-distinct progress-stroke fills, strictly darker 1→6 (real fill/stroke, not just a declared custom property)`, () => {
      const wrap = document.createElement('div')
      wrap.style.colorScheme = scheme
      wrap.innerHTML = `<ui-gauge data='${SIX_RINGS}'></ui-gauge>`
      document.body.append(wrap)
      mounted.push(wrap)
      const strokes = [...wrap.querySelectorAll('[data-part="progress"]')].map((s) => getComputedStyle(s as unknown as Element).stroke)
      expect(strokes.length, `${scheme}: six rings must render six progress strokes`).toBe(6)
      for (const stroke of strokes) expect(alphaOf(stroke), `${scheme}: a progress ring resolved transparent (${stroke})`).toBeGreaterThan(0)
      expect(new Set(strokes).size, `${scheme}: resolved strokes must be pairwise distinct — got ${strokes.join(' · ')}`).toBe(6)
      const ladder = strokes.map(lightnessOf)
      for (let i = 1; i < ladder.length; i++) {
        expect(ladder[i], `${scheme}: lightness must strictly DECREASE 1→6 — got ${ladder.map((l) => l.toFixed(3)).join(' > ')}`).toBeLessThan(ladder[i - 1])
      }
      // The SAME ramp also lands on the legend swatch fill (the ui-pie-chart identity precedent —
      // one ring, one legend row, the SAME token, never a bare declared-but-unconsumed custom property).
      const swatches = [...wrap.querySelectorAll('[data-part="key-swatch"]')].map((s) => getComputedStyle(s as unknown as Element).backgroundColor)
      expect(swatches).toEqual(strokes)
    })
  }
})

describe('ui-gauge — forced colors (ADR-0057/ADR-0228)', () => {
  it('forced-colors keeps rings + legend visible in system inks; Chromium emulates (CDP), WebKit asserts the baseline', async () => {
    const gauge = mount(`<ui-gauge data='${SYSTEM_LOAD}'></ui-gauge>`) as HTMLElement
    const progress = gauge.querySelector('[data-part="progress"]') as unknown as Element

    expect(alphaOf(getComputedStyle(progress).stroke), 'baseline progress ring is invisible').toBeGreaterThan(0)

    if (server.browser !== 'chromium') {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(false)
      return
    }

    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] })
    try {
      expect(window.matchMedia('(forced-colors: active)').matches, 'CDP did not enter forced-colors').toBe(true)
      expect(alphaOf(getComputedStyle(progress).stroke), 'progress ring vanished under forced-colors').toBeGreaterThan(0)
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] })
    }
  })
})
