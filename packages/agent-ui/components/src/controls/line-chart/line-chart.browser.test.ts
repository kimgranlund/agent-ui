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
