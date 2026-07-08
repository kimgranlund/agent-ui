import { describe, it, expect, afterEach } from 'vitest'
import { server, cdp } from 'vitest/browser'

// sparkline.browser.test.ts — cross-engine (Chromium + WebKit) browser-truth probes for ui-sparkline
// (SPEC-N2: jsdom is blind to painted SVG geometry). Covers: whole-shape (SPEC-R9 AC1), non-scaling
// stroke under resize (SPEC-R2 AC1), RTL physical series direction (SPEC-R11 AC1), and forced-colors
// currentColor tracking (SPEC-R10 AC1, ADR-0102 computed-style proof — no pixel-diff harness).
//
// Direct (pre-barrel) imports — controls/sparkline/ is not yet exported from controls/index.ts (that
// barrel edit is wave M1-b's ONE serial-integration slice); foundation CSS first (roles + ramp), then this
// control's own sheet, then the self-defining module (ADR-0003 load-bearing order).
import '@agent-ui/components/foundation-styles.css'
import './sparkline.css'
import './sparkline.ts'

const mounted: HTMLElement[] = []
const mount = (markup: string, dir?: 'ltr' | 'rtl'): HTMLElement => {
  const wrap = document.createElement('div')
  if (dir) wrap.dir = dir
  wrap.style.display = 'flex'
  wrap.innerHTML = markup
  document.body.append(wrap)
  mounted.push(wrap)
  return wrap.querySelector('ui-sparkline') as HTMLElement
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

describe('ui-sparkline whole-shape (SPEC-R9 AC1, test-the-whole-shape)', () => {
  it('a bare <ui-sparkline values="…"> in an unstyled flex row paints a non-collapsed box == the token floor', () => {
    const el = mount('<ui-sparkline values="[1,5,2,8,3]"></ui-sparkline>')
    const cs = getComputedStyle(el)
    const fontPx = Number.parseFloat(cs.fontSize)
    const expectedWidth = 8 * fontPx // --ui-sparkline-inline-size: 8em
    const rect = el.getBoundingClientRect()

    expect(rect.width, 'the host collapsed instead of painting the 8em token floor').toBeCloseTo(expectedWidth, 0)
    expect(rect.height, 'the host painted a zero-height box').toBeGreaterThan(0)

    const svg = el.querySelector('svg') as SVGSVGElement
    expect(svg, 'no svg was injected for a non-empty series').not.toBeNull()
    const svgRect = svg.getBoundingClientRect()
    // the svg fills the host box exactly (inline-size/block-size: 100%) — whole-shape, not a per-part sliver
    expect(svgRect.width).toBeCloseTo(rect.width, 0)
    expect(svgRect.height).toBeCloseTo(rect.height, 0)
  })

  it('an empty rendered set still paints the host box via the CSS floors (host clears its children, not its size)', () => {
    const el = mount('<ui-sparkline></ui-sparkline>')
    expect(el.querySelector('svg'), 'anti-vacuous: an empty series must not render a mark').toBeNull()
    const rect = el.getBoundingClientRect()
    expect(rect.width, 'the empty-series host collapsed to zero width').toBeGreaterThan(0)
    expect(rect.height, 'the empty-series host collapsed to zero height').toBeGreaterThan(0)
  })
})

describe('ui-sparkline non-scaling stroke (SPEC-R2 AC1)', () => {
  it('the computed stroke-width is unchanged across a host resize (constant --ui-sparkline-stroke-width)', () => {
    const el = mount('<ui-sparkline values="[1,5,2,8,3]"></ui-sparkline>') as HTMLElement
    const line = (): SVGPolylineElement => el.querySelector('[data-part="line"]') as SVGPolylineElement

    el.style.inlineSize = '60px'
    el.style.blockSize = '24px'
    const narrow = Number.parseFloat(getComputedStyle(line()).strokeWidth)

    el.style.inlineSize = '480px'
    el.style.blockSize = '192px'
    const wide = Number.parseFloat(getComputedStyle(line()).strokeWidth)

    expect(narrow, 'anti-vacuous: the stroke must resolve to a real px value').toBeGreaterThan(0)
    expect(wide).toBe(narrow) // the box grew 8x — the computed stroke-width did not move at all
  })
})

describe('ui-sparkline RTL (SPEC-R11 AC1) — physical series direction, never mirrored', () => {
  /** The client-space x of a viewBox point, via the svg's screen CTM (the real paint transform). */
  const clientXOf = (svg: SVGSVGElement, viewBoxX: number, viewBoxY: number): number => {
    const ctm = svg.getScreenCTM()
    if (!ctm) throw new Error('no screen CTM — svg is not laid out')
    const pt = svg.createSVGPoint()
    pt.x = viewBoxX
    pt.y = viewBoxY
    return pt.matrixTransform(ctm).x
  }

  it('under dir="rtl", the FIRST data point (x=0) still lands at the physical LEFT edge of the host', () => {
    const el = mount('<ui-sparkline values="[1,5,2,8,3]"></ui-sparkline>', 'rtl') as HTMLElement
    const svg = el.querySelector('svg') as SVGSVGElement
    const hostLeft = el.getBoundingClientRect().left
    const firstPointX = clientXOf(svg, 0, 50)
    expect(firstPointX).toBeCloseTo(hostLeft, 0)
  })

  it('under dir="ltr" too (control leg) — the first point is at the physical left in both directions', () => {
    const el = mount('<ui-sparkline values="[1,5,2,8,3]"></ui-sparkline>', 'ltr') as HTMLElement
    const svg = el.querySelector('svg') as SVGSVGElement
    const hostLeft = el.getBoundingClientRect().left
    const firstPointX = clientXOf(svg, 0, 50)
    expect(firstPointX).toBeCloseTo(hostLeft, 0)
  })
})

describe('ui-sparkline forced-colors (SPEC-R10 AC1) — currentColor tracks the forced ink', () => {
  it('stroke + area fill follow forced-colors via currentColor — Chromium emulates (CDP); WebKit asserts baseline', async () => {
    const el = mount('<ui-sparkline values="[1,5,2]" variant="area"></ui-sparkline>') as HTMLElement
    const line = (): SVGPolylineElement => el.querySelector('[data-part="line"]') as SVGPolylineElement
    const area = (): SVGPolygonElement => el.querySelector('[data-part="area"]') as SVGPolygonElement

    // Baseline (BOTH engines): the mark is painted, currentColor resolves to the ambient ink.
    expect(alphaOf(getComputedStyle(line()).stroke), 'baseline stroke is invisible').toBeGreaterThan(0)
    expect(alphaOf(getComputedStyle(area()).fill), 'baseline area fill is invisible').toBeGreaterThan(0)
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
      // the stroke still equals the host's forced computed color — no dedicated WHCM block needed (sparkline.css)
      expect(getComputedStyle(line()).stroke).toBe(getComputedStyle(el).color)
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] })
    }
  })
})
