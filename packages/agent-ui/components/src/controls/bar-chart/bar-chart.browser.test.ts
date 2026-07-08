import { describe, it, expect, afterEach } from 'vitest'
import { server, cdp } from 'vitest/browser'

// bar-chart.browser.test.ts — the cross-engine browser-truth proof (SPEC-N2; jsdom is blind to painted
// geometry). Runs in BOTH Chromium and WebKit (vitest.browser.config.ts). Covers what jsdom cannot:
// whole-shape (SPEC-R9 AC1), the 4:2:1 proportion + shared-zero divergence legs (SPEC-R6 AC1/AC2), the
// ALL-NEGATIVE degenerate row (SPEC-R7), RTL mirroring (SPEC-R11 AC1), and forced-colors (SPEC-R10 AC1).
//
// Side-effect CSS/JS imports — the load-bearing order (ADR-0003): foundation roles + dimensional ramp
// FIRST (tokens.css / dimensions.css — the --md-sys-color-*/--md-sys-typescale-*/--ui-space-* this sheet's
// :where() token block reads), then bar-chart.css directly, then bar-chart.ts (self-defines). The
// component-styles barrel does NOT yet @import bar-chart.css (that is wave M1-b's LLD-C8 integration
// slice) — this suite imports it directly, the card.browser.test.ts / sparkline precedent for a
// pre-integration folder.
import '@agent-ui/components/foundation-styles.css'
import './bar-chart.css'
import './bar-chart.ts'

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

/** Alpha of a computed colour — 0 ⇒ vanished, > 0 ⇒ painted (a bare system-colour keyword is opaque). */
const alphaOf = (color: string): number => {
  if (color === 'transparent') return 0
  const m = color.match(/rgba?\(([^)]+)\)/i)
  if (!m) return 1
  const parts = m[1].split(/[\s,/]+/).filter(Boolean)
  return parts.length >= 4 ? Number(parts[3]) : 1
}

/** Minimal CDP surface — `cdp()`'s public type is empty; the playwright provider gives `.send` at runtime. */
interface CdpSession {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>
}

describe('ui-bar-chart — whole-shape (SPEC-R9 AC1, test-the-whole-shape)', () => {
  it('a bare, unstyled, populated chart in an unstyled flex row paints a visible, non-collapsed box >= the min-inline-size floor', () => {
    const row = mount(
      '<div style="display:flex"><ui-bar-chart data=\'[{"label":"EMEA","value":42},{"label":"APAC","value":31}]\'></ui-bar-chart></div>',
    )
    const chart = row.querySelector('ui-bar-chart') as HTMLElement
    const floor = tokenPx(chart, '--ui-bar-chart-min-inline-size')
    expect(floor, 'anti-vacuous: the floor token must resolve to a real px value').toBeGreaterThan(0)
    const box = chart.getBoundingClientRect()
    expect(box.width, 'the chart collapsed below its whole-shape floor in a flex row').toBeGreaterThanOrEqual(floor - 1)
    expect(box.height, 'the chart painted zero height').toBeGreaterThan(0)
    // the WHOLE gestalt, not just the host box: at least one row + a non-zero track must have painted.
    const track = chart.querySelector('[data-part="track"]') as HTMLElement
    expect(track.getBoundingClientRect().width, 'the track itself painted zero width').toBeGreaterThan(0)
  })
})

describe('ui-bar-chart — the 4:2:1 proportion leg (SPEC-R6 AC1)', () => {
  it('rendered bar inline-sizes for [40, 20, 10] are within epsilon of the 4:2:1 proportion', () => {
    const chart = mount(
      '<ui-bar-chart style="inline-size: 400px" data=\'[{"label":"a","value":40},{"label":"b","value":20},{"label":"c","value":10}]\'></ui-bar-chart>',
    ) as HTMLElement
    const fills = [...chart.querySelectorAll('[data-part="fill"]')] as HTMLElement[]
    expect(fills).toHaveLength(3)
    const widths = fills.map((f) => f.getBoundingClientRect().width)
    for (const w of widths) expect(w, 'anti-vacuous: a rendered fill must have real width').toBeGreaterThan(0)
    // all-positive: every bar starts at the same inline-start edge.
    const lefts = fills.map((f) => Math.round(f.getBoundingClientRect().left))
    expect(lefts[0]).toBe(lefts[1])
    expect(lefts[1]).toBe(lefts[2])
    // the ratio, measured in real px.
    expect(widths[0] / widths[2]).toBeCloseTo(4, 0)
    expect(widths[1] / widths[2]).toBeCloseTo(2, 0)
  })
})

describe('ui-bar-chart — the shared-zero divergence leg (SPEC-R6 AC2, mixed sign)', () => {
  it('[-20, 10, 30]: all three bars measure from ONE shared zero offset; the -20 bar extends to the inline-start side of it', () => {
    const chart = mount(
      '<ui-bar-chart style="inline-size: 400px" data=\'[{"label":"neg","value":-20},{"label":"small","value":10},{"label":"big","value":30}]\'></ui-bar-chart>',
    ) as HTMLElement
    const fills = [...chart.querySelectorAll('[data-part="fill"]')] as HTMLElement[]
    const rects = fills.map((f) => f.getBoundingClientRect())
    // the shared zero point: neg's right edge (its start+length) lands at the SAME physical x as small's/big's left edge.
    const negRight = Math.round(rects[0].left + rects[0].width)
    const smallLeft = Math.round(rects[1].left)
    const bigLeft = Math.round(rects[2].left)
    expect(negRight).toBeCloseTo(smallLeft, -1)
    expect(smallLeft).toBe(bigLeft)
    // the negative bar sits to the inline-start (physically left, LTR) of the shared zero point.
    expect(rects[0].left).toBeLessThan(smallLeft)
    // proportion: |−20| : 10 : 30 == 40:20:60 lengths relative to the 50-wide span.
    expect(rects[0].width / rects[1].width).toBeCloseTo(2, 0) // 20/10
    expect(rects[2].width / rects[1].width).toBeCloseTo(3, 0) // 30/10
  })
})

describe('ui-bar-chart — the ALL-NEGATIVE degenerate row (SPEC-R7, LLD §7 row 5)', () => {
  it('the shared zero point sits at the track inline-end; every bar extends toward inline-start of it; longest = most negative', () => {
    const chart = mount(
      '<ui-bar-chart style="inline-size: 400px" data=\'[{"label":"a","value":-10},{"label":"b","value":-30},{"label":"c","value":-5}]\'></ui-bar-chart>',
    ) as HTMLElement
    const tracks = [...chart.querySelectorAll('[data-part="track"]')] as HTMLElement[]
    const fills = [...chart.querySelectorAll('[data-part="fill"]')] as HTMLElement[]
    const trackRight = Math.round(tracks[0].getBoundingClientRect().right)
    for (const fill of fills) {
      // every bar's far (physically right, LTR) edge sits at the track's inline-end.
      const right = Math.round(fill.getBoundingClientRect().right)
      expect(right).toBeCloseTo(trackRight, -1)
    }
    const widths = fills.map((f) => f.getBoundingClientRect().width)
    expect(widths[1]).toBeGreaterThan(widths[0]) // -30 (b) longer than -10 (a)
    expect(widths[0]).toBeGreaterThan(widths[2]) // -10 (a) longer than -5 (c)
    expect(widths[1]).toBeCloseTo(tracks[1].getBoundingClientRect().width, 0) // the most-negative value spans the FULL track
  })
})

describe('ui-bar-chart — RTL mirroring (SPEC-R11 AC1)', () => {
  it('under dir="rtl", bar rows mirror: the all-positive bars now start from the PHYSICAL right edge', () => {
    const chart = mount(
      '<ui-bar-chart dir="rtl" style="inline-size: 400px" data=\'[{"label":"a","value":40},{"label":"b","value":10}]\'></ui-bar-chart>',
    ) as HTMLElement
    const tracks = [...chart.querySelectorAll('[data-part="track"]')] as HTMLElement[]
    const fills = [...chart.querySelectorAll('[data-part="fill"]')] as HTMLElement[]
    // logical inset-inline-start under rtl resolves to the PHYSICAL right — the fill's right edge should
    // touch the track's right edge (mirrored from the LTR left-aligned case).
    const trackRight = Math.round(tracks[0].getBoundingClientRect().right)
    const fillRight = Math.round(fills[0].getBoundingClientRect().right)
    expect(fillRight).toBeCloseTo(trackRight, -1)
  })
})

describe('ui-bar-chart — forced colors (SPEC-R10 AC1)', () => {
  it('forced-colors keeps the fill + track visible in system inks; fill != track — Chromium emulates (CDP); WebKit asserts the baseline', async () => {
    const chart = mount(
      '<ui-bar-chart data=\'[{"label":"a","value":10}]\'></ui-bar-chart>',
    ) as HTMLElement
    const fill = chart.querySelector('[data-part="fill"]') as HTMLElement
    const track = chart.querySelector('[data-part="track"]') as HTMLElement

    // Baseline (BOTH engines): the fill is a painted, non-transparent background (the token-default primary ink).
    expect(alphaOf(getComputedStyle(fill).backgroundColor), 'baseline fill is invisible').toBeGreaterThan(0)

    if (server.browser !== 'chromium') {
      // WebKit exposes no CDP / forced-colors emulation (the button/card s13 harness convention). Assert
      // the engine is genuinely NOT in forced-colors (so we are not faking the Chromium proof) and stop;
      // the forced-colors leg is proven in Chromium.
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(false)
      return
    }

    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] })
    try {
      expect(window.matchMedia('(forced-colors: active)').matches, 'CDP did not enter forced-colors').toBe(true)
      const fillColor = getComputedStyle(fill).backgroundColor
      const trackColor = getComputedStyle(track).backgroundColor
      expect(alphaOf(fillColor), 'fill vanished under forced-colors (background forced to Canvas)').toBeGreaterThan(0)
      expect(fillColor, 'fill != track under forced-colors (a non-color signifier requirement, SPEC-R8/ADR-0057)').not.toBe(trackColor)
      expect(alphaOf(getComputedStyle(track).borderTopColor), 'track lost its distinguishing border under forced-colors').toBeGreaterThan(0)
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] }) // reset for the next test
    }
  })
})
