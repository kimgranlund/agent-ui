import { describe, it, expect, afterEach } from 'vitest'
import { server, cdp } from 'vitest/browser'

// line-chart.browser.test.ts — cross-engine (Chromium + WebKit) browser-truth probes for ui-line-chart
// (ADR-0205; jsdom is blind to painted SVG geometry — the sparkline/bar-chart SPEC-N2 precedent). Covers:
// whole-shape (the box + both label rows + the svg all paint), the COMPUTED viewBox/points/baseline/label
// text (re-asserted here because jsdom cannot confirm the real box actually PAINTS them), non-scaling stroke
// under resize, RTL physical series direction, and forced-colors currentColor tracking (both the line and
// the reduced-opacity baseline).
//
// Direct (pre-barrel) imports — mirrors the sparkline/bar-chart pre-integration-wave precedent: foundation
// CSS first (roles + ramp), then this control's own sheet, then the self-defining module (ADR-0003
// load-bearing order).
import '@agent-ui/components/foundation-styles.css'
import '../_chart/chart-axis.css' // the shared ADR-0228 token chain — line-chart.css ALIASES from it (`[axes]` only), the ui-column-chart load-bearing order
import './line-chart.css'
import './line-chart.ts'

const mounted: HTMLElement[] = []
const mount = (markup: string, dir?: 'ltr' | 'rtl'): HTMLElement => {
  const wrap = document.createElement('div')
  if (dir) wrap.dir = dir
  wrap.style.display = 'flex'
  wrap.innerHTML = markup
  document.body.append(wrap)
  mounted.push(wrap)
  return wrap.querySelector('ui-line-chart') as HTMLElement
}
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

/** Minimal CDP surface — `cdp()`'s public type is empty; the playwright provider gives `.send` at runtime. */
interface CdpSession {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>
}

/** Alpha of a computed colour — 0 ⇒ vanished/transparent, > 0 ⇒ painted (a bare system-colour keyword is opaque). */
const alphaOf = (color: string): number => {
  if (color === 'transparent' || color === 'none') return 0
  const m = color.match(/rgba?\(([^)]+)\)/i)
  if (!m) return 1
  const parts = m[1].split(/[\s,/]+/).filter(Boolean)
  return parts.length >= 4 ? Number(parts[3]) : 1
}

describe('ui-line-chart whole-shape (test-the-whole-shape)', () => {
  it('a bare <ui-line-chart values="…"> in an unstyled flex row paints a non-collapsed box >= the token floor, with both label rows + the svg all painted', () => {
    const el = mount('<ui-line-chart values="[3,5,4,8,7]" label="Latency"></ui-line-chart>')
    const cs = getComputedStyle(el)
    const fontPx = Number.parseFloat(cs.fontSize)
    const expectedWidth = 16 * fontPx // --ui-line-chart-min-inline-size: 16em
    const rect = el.getBoundingClientRect()

    expect(rect.width, 'the host collapsed instead of painting the 16em token floor').toBeGreaterThanOrEqual(expectedWidth - 1)
    expect(rect.height, 'the host painted a zero-height box').toBeGreaterThan(0)

    const maxLabel = el.querySelector('[data-part="label-max"]') as HTMLElement
    const minLabel = el.querySelector('[data-part="label-min"]') as HTMLElement
    const svg = el.querySelector('svg') as SVGSVGElement
    expect(maxLabel, 'no max label was injected').not.toBeNull()
    expect(minLabel, 'no min label was injected').not.toBeNull()
    expect(svg, 'no svg was injected for a non-empty series').not.toBeNull()

    expect(maxLabel.textContent).toBe('8')
    expect(minLabel.textContent).toBe('3')
    expect(maxLabel.getBoundingClientRect().height, 'the max label painted zero height').toBeGreaterThan(0)
    expect(minLabel.getBoundingClientRect().height, 'the min label painted zero height').toBeGreaterThan(0)

    // the whole gestalt, top-to-bottom: label-max sits ABOVE the svg, which sits ABOVE label-min.
    const maxTop = maxLabel.getBoundingClientRect().top
    const svgTop = svg.getBoundingClientRect().top
    const minTop = minLabel.getBoundingClientRect().top
    expect(maxTop).toBeLessThanOrEqual(svgTop)
    expect(svgTop).toBeLessThanOrEqual(minTop)

    const svgRect = svg.getBoundingClientRect()
    expect(svgRect.width, 'the svg painted zero width').toBeGreaterThan(0)
    expect(svgRect.height, 'the svg painted zero height').toBeGreaterThan(0)
  })

  it('an empty rendered set still paints the host box via the CSS floors (host clears its children, not its size)', () => {
    const el = mount('<ui-line-chart></ui-line-chart>')
    expect(el.querySelector('svg'), 'anti-vacuous: an empty series must not render a mark').toBeNull()
    expect(el.childElementCount).toBe(0)
    const rect = el.getBoundingClientRect()
    expect(rect.width, 'the empty-series host collapsed to zero width').toBeGreaterThan(0)
    expect(rect.height, 'the empty-series host collapsed to zero height').toBeGreaterThan(0)
  })
})

describe('ui-line-chart the computed viewBox + baseline (ADR-0205)', () => {
  it('the real chart-tile viewBox is 0 0 300 150 (not the sparkline 100x100 square)', () => {
    const el = mount('<ui-line-chart values="[3,5,4,8,7]"></ui-line-chart>')
    const svg = el.querySelector('svg') as SVGSVGElement
    expect(svg.getAttribute('viewBox')).toBe('0 0 300 150')
  })

  it('an all-positive series floors its baseline at the plot bottom (y=125); a spanning-zero series floors it MID-plot (y=75)', () => {
    const positive = mount('<ui-line-chart values="[10,20,15]"></ui-line-chart>')
    const spanning = mount('<ui-line-chart values="[-10,0,10]"></ui-line-chart>')
    const baselineY = (el: HTMLElement): string | null => el.querySelector('[data-part="baseline"]')?.getAttribute('y1') ?? null
    expect(baselineY(positive)).toBe('125')
    expect(baselineY(spanning)).toBe('75')
  })
})

describe('ui-line-chart non-scaling stroke (resize)', () => {
  it('the computed stroke-width is unchanged across a host resize (constant --ui-line-chart-line-stroke-width)', () => {
    const el = mount('<ui-line-chart values="[1,5,2,8,3]"></ui-line-chart>') as HTMLElement
    const line = (): SVGPolylineElement => el.querySelector('[data-part="line"]') as SVGPolylineElement

    el.style.inlineSize = '200px'
    el.style.blockSize = '100px'
    const narrow = Number.parseFloat(getComputedStyle(line()).strokeWidth)

    el.style.inlineSize = '800px'
    el.style.blockSize = '400px'
    const wide = Number.parseFloat(getComputedStyle(line()).strokeWidth)

    expect(narrow, 'anti-vacuous: the stroke must resolve to a real px value').toBeGreaterThan(0)
    expect(wide).toBe(narrow) // the box grew 4x — the computed stroke-width did not move at all
  })
})

describe('ui-line-chart RTL — physical series direction, never mirrored', () => {
  /** The client-space x of a viewBox point, via the svg's screen CTM (the real paint transform). */
  const clientXOf = (svg: SVGSVGElement, viewBoxX: number, viewBoxY: number): number => {
    const ctm = svg.getScreenCTM()
    if (!ctm) throw new Error('no screen CTM — svg is not laid out')
    const pt = svg.createSVGPoint()
    pt.x = viewBoxX
    pt.y = viewBoxY
    return pt.matrixTransform(ctm).x
  }

  it('under dir="rtl", the FIRST data point (x=0) still lands at the physical LEFT edge of the svg', () => {
    const el = mount('<ui-line-chart values="[1,5,2,8,3]"></ui-line-chart>', 'rtl') as HTMLElement
    const svg = el.querySelector('svg') as SVGSVGElement
    const svgLeft = svg.getBoundingClientRect().left
    const firstPointX = clientXOf(svg, 0, 75)
    expect(firstPointX).toBeCloseTo(svgLeft, 0)
  })

  it('under dir="ltr" too (control leg)', () => {
    const el = mount('<ui-line-chart values="[1,5,2,8,3]"></ui-line-chart>', 'ltr') as HTMLElement
    const svg = el.querySelector('svg') as SVGSVGElement
    const svgLeft = svg.getBoundingClientRect().left
    const firstPointX = clientXOf(svg, 0, 75)
    expect(firstPointX).toBeCloseTo(svgLeft, 0)
  })
})

describe('ui-line-chart forced-colors — currentColor tracks the forced ink (line + baseline)', () => {
  it('stroke + area fill + baseline follow forced-colors via currentColor — Chromium emulates (CDP); WebKit asserts baseline', async () => {
    const el = mount('<ui-line-chart values="[1,5,2]" variant="area"></ui-line-chart>') as HTMLElement
    const line = (): SVGPolylineElement => el.querySelector('[data-part="line"]') as SVGPolylineElement
    const area = (): SVGPolygonElement => el.querySelector('[data-part="area"]') as SVGPolygonElement
    const baseline = (): SVGLineElement => el.querySelector('[data-part="baseline"]') as SVGLineElement

    // Baseline check (BOTH engines): all three mark parts are painted, currentColor resolves to the ambient ink.
    expect(alphaOf(getComputedStyle(line()).stroke), 'baseline stroke is invisible').toBeGreaterThan(0)
    expect(alphaOf(getComputedStyle(area()).fill), 'baseline area fill is invisible').toBeGreaterThan(0)
    expect(alphaOf(getComputedStyle(baseline()).stroke), 'the reference baseline line is invisible').toBeGreaterThan(0)
    expect(getComputedStyle(line()).stroke).toBe(getComputedStyle(el).color) // currentColor really tracks the host

    if (server.browser !== 'chromium') {
      // WebKit exposes no CDP / forced-colors emulation (the fleet's documented cross-engine split).
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(false)
      return
    }

    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] })
    try {
      expect(window.matchMedia('(forced-colors: active)').matches, 'CDP did not enter forced-colors').toBe(true)
      expect(alphaOf(getComputedStyle(line()).stroke), 'stroke vanished under forced-colors').toBeGreaterThan(0)
      expect(alphaOf(getComputedStyle(area()).fill), 'area fill vanished under forced-colors').toBeGreaterThan(0)
      expect(alphaOf(getComputedStyle(baseline()).stroke), 'the baseline vanished under forced-colors').toBeGreaterThan(0)
      // the stroke still equals the host's forced computed color — no dedicated WHCM block needed (line-chart.css)
      expect(getComputedStyle(line()).stroke).toBe(getComputedStyle(el).color)
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] })
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// the `axes` state (ADR-0229 cl.3) — browser-truth probes for what jsdom cannot see: the two-layer
// full-bleed model (the PLOT never shrinks to make room for chrome; every chrome chip gets its
// clearance from the ONE `--ui-line-chart-chrome-inset` knob, never a smaller plot box — Kim's
// zero-padding-container contract, ADR-0228 cl.1-3, the `ui-column-chart` reference shape), the
// now-marker's short (never full-height) tick, and the gradient area fill's resolved paint.

const px = (v: string): number => Number.parseFloat(v)

describe('ui-line-chart [axes] — whole-shape (test-the-whole-shape)', () => {
  it('a bare, unstyled, populated axes chart in a flex row paints a non-collapsed box >= its floor, with the plot + chrome both painted', () => {
    const el = mount('<ui-line-chart axes values="[18,21,19,24,27,23]" labels=\'["Mar","Apr","May","Jun","Jul","Aug"]\'></ui-line-chart>') as HTMLElement
    const fontPx = Number.parseFloat(getComputedStyle(el).fontSize)
    const expectedWidth = 16 * fontPx
    const rect = el.getBoundingClientRect()
    expect(rect.width, 'the axes chart collapsed below its whole-shape width floor').toBeGreaterThanOrEqual(expectedWidth - 1)
    expect(rect.height, 'the axes chart painted a zero-height box').toBeGreaterThan(0)

    const plot = el.querySelector('[data-part="plot"]') as unknown as SVGSVGElement
    const chrome = el.querySelector('[data-part="chrome"]') as HTMLElement
    expect(plot, 'no plot layer was injected').not.toBeNull()
    expect(chrome, 'no chrome layer was injected').not.toBeNull()
    expect((plot as unknown as HTMLElement).getBoundingClientRect().width).toBeGreaterThan(0)
    expect(chrome.getBoundingClientRect().width).toBeGreaterThan(0)
  })
})

describe('ui-line-chart [axes] — the two-layer full-bleed model (ADR-0228 cl.1-3): the plot NEVER shrinks for chrome', () => {
  it('the plot layer spans the SAME box as the host, edge-to-edge, at zero inset — regardless of chrome being active', () => {
    const el = mount('<ui-line-chart axes values="[18,21,19,24,27,23]" labels=\'["Mar","Apr","May","Jun","Jul","Aug"]\'></ui-line-chart>') as HTMLElement
    const chartBox = el.getBoundingClientRect()
    const plot = el.querySelector('[data-part="plot"]') as unknown as HTMLElement
    const plotBox = plot.getBoundingClientRect()
    expect(Math.round(plotBox.width)).toBeCloseTo(Math.round(chartBox.width), 0)
    expect(Math.round(plotBox.height)).toBeCloseTo(Math.round(chartBox.height), 0)
    expect(Math.abs(plotBox.left - chartBox.left)).toBeLessThanOrEqual(1)
    expect(Math.abs(plotBox.top - chartBox.top)).toBeLessThanOrEqual(1)
  })

  it('every chrome chip clears the chrome-inset distance from the box edges — never closer, and the plot never shrank to make room', () => {
    const el = mount('<ui-line-chart axes values="[18,21,19,24,27,23]" labels=\'["Mar","Apr","May","Jun","Jul","Aug"]\'></ui-line-chart>') as HTMLElement
    const chartBox = el.getBoundingClientRect()
    const chrome = el.querySelector('[data-part="chrome"]') as HTMLElement
    // The chrome-inset custom property is a `calc()` expression — not parseable via getComputedStyle
    // directly (custom properties don't resolve nested calc() to a bare number); read the REAL, USED
    // `padding` the token drives instead (a real layout property DOES resolve to a px number).
    const insetPx = px(getComputedStyle(chrome).paddingLeft)
    expect(insetPx, 'anti-vacuous: the chrome layer\'s resolved padding must be a real px value').toBeGreaterThan(0)

    const chips = el.querySelectorAll('[data-part="tick-label"], [data-part="category-label"]')
    expect(chips.length).toBeGreaterThan(0)
    const EPS = 1 // sub-pixel layout slack
    for (const chip of chips) {
      const box = (chip as HTMLElement).getBoundingClientRect()
      expect(box.left, 'a chip crossed the LEFT edge (never closer than the chrome-inset)').toBeGreaterThanOrEqual(chartBox.left - EPS)
      expect(box.right, 'a chip crossed the RIGHT edge').toBeLessThanOrEqual(chartBox.right + EPS)
      expect(box.top, 'a chip crossed the TOP edge').toBeGreaterThanOrEqual(chartBox.top - EPS)
      expect(box.bottom, 'a chip crossed the BOTTOM edge').toBeLessThanOrEqual(chartBox.bottom + EPS)
    }

    // the plot's own box is UNCHANGED by the chrome's presence — the inset is the chrome's clearance,
    // never a plot-shrinking mechanism (ADR-0228 cl.3's own composition law).
    const plot = el.querySelector('[data-part="plot"]') as unknown as HTMLElement
    const plotBox = plot.getBoundingClientRect()
    expect(Math.round(plotBox.width)).toBeCloseTo(Math.round(chartBox.width), 0)
    expect(Math.round(plotBox.height)).toBeCloseTo(Math.round(chartBox.height), 0)
  })

  it('every category-label chip stays INSIDE the plot box under dir="rtl" AND paints at the EXACT SAME physical position it does under dir="ltr" (the plot is physical/never-mirrored, so the chrome layer must be pixel-identical across both directions, not merely mirror-corrected — #1581 build-review finding: an `inset-inline-start` anchor mirrors under RTL even after `translate`\'s own physical x-component is left alone, so the anchor itself has to be a physical `left`, and once it is, NEITHER property needs a `:dir(rtl)` override any more)', () => {
    const markup = '<ui-line-chart axes values="[18,21,19,24,27,23]" labels=\'["Mar","Apr","May","Jun","Jul","Aug"]\'></ui-line-chart>'
    const ltr = mount(markup, 'ltr') as HTMLElement
    const rtl = mount(markup, 'rtl') as HTMLElement
    const ltrBox = ltr.getBoundingClientRect()
    const rtlBox = rtl.getBoundingClientRect()
    const ltrChips = [...ltr.querySelectorAll('[data-part="category-label"]')] as HTMLElement[]
    const rtlChips = [...rtl.querySelectorAll('[data-part="category-label"]')] as HTMLElement[]
    expect(ltrChips.length).toBeGreaterThan(0)
    expect(rtlChips.length).toBe(ltrChips.length)
    const EPS = 1

    for (const [i, rtlChip] of rtlChips.entries()) {
      const box = rtlChip.getBoundingClientRect()
      expect(box.left, `RTL: a chip overflowed the LEFT edge (${box.left} < ${rtlBox.left})`).toBeGreaterThanOrEqual(rtlBox.left - EPS)
      expect(box.right, `RTL: a chip overflowed the RIGHT edge (${box.right} > ${rtlBox.right})`).toBeLessThanOrEqual(rtlBox.right + EPS)

      // Both charts mount at the same host offset (siblings, same wrap width), so their box-relative
      // positions are directly comparable — the ground truth is "identical to LTR", not a derived
      // formula that has to independently reconstruct the ADR-0228 cl.2 edge-clamp interpolation.
      const ltrRelLeft = ltrChips[i].getBoundingClientRect().left - ltrBox.left
      const rtlRelLeft = box.left - rtlBox.left
      expect(rtlRelLeft, `RTL: "${rtlChip.textContent}" chip drifted from its LTR position (rel-left ${rtlRelLeft} vs ${ltrRelLeft})`).toBeCloseTo(ltrRelLeft, 0)
    }
  })
})

describe('ui-line-chart [axes] — the now-marker is a SHORT tick, never full-height (ADR-0228 cl.4)', () => {
  it('the now-tick spans only a small fraction of the plot height, anchored at the category band', () => {
    const el = mount('<ui-line-chart axes values="[18,21,19,24,27,23]" projected="1"></ui-line-chart>') as HTMLElement
    const tick = el.querySelector('[data-part="now-tick"]') as unknown as SVGLineElement
    const dot = el.querySelector('[data-part="now-dot"]') as unknown as SVGCircleElement
    expect(tick).not.toBeNull()
    expect(dot).not.toBeNull()
    const tickBox = (tick as unknown as SVGGraphicsElement).getBBox()
    expect(tickBox.height).toBeLessThan(50) // NOW_TICK_DEPTH_PCT=8 of a 100-unit viewBox — well under half
    expect(tickBox.height).toBeGreaterThan(0)
  })

  it('is absent entirely when there is no projected span', () => {
    const el = mount('<ui-line-chart axes values="[18,21,19,24,27,23]"></ui-line-chart>') as HTMLElement
    expect(el.querySelector('[data-part="now-tick"]')).toBeNull()
    expect(el.querySelector('[data-part="now-dot"]')).toBeNull()
  })
})

describe('ui-line-chart [axes] — the projected span is a DASHED line-style carrier (ADR-0228 cl.4)', () => {
  it('the projected polyline segment computes a dashed stroke', () => {
    const el = mount('<ui-line-chart axes values="[18,21,19,24,27,23]" projected="1"></ui-line-chart>') as HTMLElement
    const projected = el.querySelector('[data-part="line-projected"]') as unknown as SVGPolylineElement
    expect(projected).not.toBeNull()
    expect(getComputedStyle(projected).strokeDasharray).not.toBe('none')
  })
})

describe('ui-line-chart the gradient area fill (ADR-0229 cl.3, both states)', () => {
  it('DEFAULT state: the area resolves a real (non-transparent) paint via the gradient', () => {
    const el = mount('<ui-line-chart values="[3,5,4,8,7]" variant="area"></ui-line-chart>') as HTMLElement
    const area = el.querySelector('[data-part="area"]') as unknown as SVGPolygonElement
    expect(alphaOf(getComputedStyle(area).fill), 'the gradient-filled area painted invisible').toBeGreaterThan(0)
  })

  it('AXES state: the SAME gradient mechanism paints the area', () => {
    const el = mount('<ui-line-chart axes values="[18,21,19,24,27,23]" variant="area"></ui-line-chart>') as HTMLElement
    const area = el.querySelector('[data-part="area"]') as unknown as SVGPolygonElement
    expect(area).not.toBeNull()
    expect(alphaOf(getComputedStyle(area).fill), 'the axes-state gradient area painted invisible').toBeGreaterThan(0)
  })
})

describe('ui-line-chart [axes] — forced colors (ADR-0057/ADR-0228)', () => {
  it('forced-colors keeps gridlines + chips + the gradient area visible in system inks; Chromium emulates (CDP), WebKit asserts the baseline', async () => {
    const el = mount('<ui-line-chart axes values="[18,21,19,24,27,23]" labels=\'["Mar","Apr","May","Jun","Jul","Aug"]\' variant="area"></ui-line-chart>') as HTMLElement
    const gridLine = el.querySelector('[data-part="grid-line"]') as unknown as SVGLineElement
    const chip = el.querySelector('[data-part="tick-label"]') as HTMLElement
    const area = el.querySelector('[data-part="area"]') as unknown as SVGPolygonElement

    expect(alphaOf(getComputedStyle(gridLine).stroke), 'baseline gridline is invisible').toBeGreaterThan(0)
    expect(alphaOf(getComputedStyle(chip).backgroundColor), 'baseline chip is invisible').toBeGreaterThan(0)

    if (server.browser !== 'chromium') {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(false)
      return
    }

    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] })
    try {
      expect(window.matchMedia('(forced-colors: active)').matches, 'CDP did not enter forced-colors').toBe(true)
      expect(alphaOf(getComputedStyle(gridLine).stroke), 'gridline vanished under forced-colors').toBeGreaterThan(0)
      expect(alphaOf(getComputedStyle(chip).backgroundColor), 'chip vanished under forced-colors').toBeGreaterThan(0)
      expect(alphaOf(getComputedStyle(area).fill), 'the gradient area vanished under forced-colors').toBeGreaterThan(0)
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] })
    }
  })
})
