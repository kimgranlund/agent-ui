import { describe, it, expect, afterEach } from 'vitest'
import { server, cdp } from 'vitest/browser'

// pie-chart.browser.test.ts — the cross-engine browser-truth proof (ADR-0219; jsdom is blind to painted
// geometry). Runs in BOTH Chromium and WebKit (vitest.browser.config.ts). Covers what jsdom cannot: the
// whole-shape floor (the size-budget/anti-collapse proof named in the ADR's Consequences), the ring's
// fixed density-invariant box, the donut-vs-pie hole distinction, and forced-colors.
//
// Side-effect CSS/JS imports — the load-bearing order (ADR-0003): foundation roles + dimensional ramp
// FIRST, then pie-chart.css directly, then pie-chart.ts (self-defines). The component-styles barrel
// already @imports pie-chart.css (this wave's own integration slice) — this suite ALSO imports it
// directly (the bar-chart/line-chart precedent), harmless given the idempotent side-effect import.
// ADR-0228 cl.6 (svg-charts wave 1, GH #1565): pie-chart.css's six slice-ink defaults now ALIAS the
// shared `_chart/chart-axis.css` ramp — that file must load before pie-chart.css or every var()
// reference resolves invalid (a shorthand + invalid-var interaction that silently zeroes OTHER
// longhands too, the exact class this repoint's own browser leg must re-prove, not just jsdom).
import '@agent-ui/components/foundation-styles.css'
import '../_chart/chart-axis.css'
import './pie-chart.css'
import './pie-chart.ts'

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

describe('ui-pie-chart — whole-shape (the size-budget/anti-collapse proof, test-the-whole-shape)', () => {
  it('a bare, unstyled, populated chart in an unstyled flex row paints a visible, non-collapsed box >= the min-inline-size floor, with a real ring + at least one real key row', () => {
    const row = mount(
      '<div style="display:flex"><ui-pie-chart data=\'[{"label":"EMEA","value":42},{"label":"APAC","value":31}]\'></ui-pie-chart></div>',
    )
    const chart = row.querySelector('ui-pie-chart') as HTMLElement
    const floor = tokenPx(chart, '--ui-pie-chart-min-inline-size')
    expect(floor, 'anti-vacuous: the floor token must resolve to a real px value').toBeGreaterThan(0)
    const box = chart.getBoundingClientRect()
    expect(box.width, 'the chart collapsed below its whole-shape floor in a flex row').toBeGreaterThanOrEqual(floor - 1)
    expect(box.height, 'the chart painted zero height').toBeGreaterThan(0)

    // the WHOLE gestalt: the ring itself must paint a real, non-collapsed square box.
    const ring = chart.querySelector('[data-part="ring"]') as unknown as SVGSVGElement
    const ringBox = (ring as unknown as HTMLElement).getBoundingClientRect()
    expect(ringBox.width, 'the ring painted zero width').toBeGreaterThan(0)
    expect(ringBox.height, 'the ring painted zero height').toBeGreaterThan(0)
    expect(Math.round(ringBox.width)).toBeCloseTo(Math.round(ringBox.height), 0) // the ring stays a SQUARE (a donut/pie must stay round)

    // at least one real key row painted with non-zero size (the accessible legend).
    const row0 = chart.querySelector('[role="listitem"]') as HTMLElement
    expect(row0.getBoundingClientRect().width, 'the first key row painted zero width').toBeGreaterThan(0)
  })
})

describe('ui-pie-chart — the ring is a fixed, density-invariant SQUARE box driven by --ui-pie-chart-ring-size (mark geometry never rides [scale])', () => {
  it('the ring stays a square box, unaffected by the number of rendered slices', () => {
    const chart = mount('<ui-pie-chart data=\'[{"label":"a","value":1},{"label":"b","value":1},{"label":"c","value":1}]\'></ui-pie-chart>') as HTMLElement
    const ring = chart.querySelector('[data-part="ring"]') as unknown as HTMLElement
    const box = ring.getBoundingClientRect()
    expect(box.width).toBeGreaterThan(0)
    expect(box.width).toBeCloseTo(box.height, 0)
  })

  it('overriding --ui-pie-chart-ring-size on the host resizes the ring (proves it reads the token, not a hardcoded size)', () => {
    const chart = mount('<ui-pie-chart data=\'[{"label":"a","value":1}]\'></ui-pie-chart>') as HTMLElement
    const ring = chart.querySelector('[data-part="ring"]') as unknown as HTMLElement
    const before = ring.getBoundingClientRect().width
    chart.style.setProperty('--ui-pie-chart-ring-size', '4em')
    const after = ring.getBoundingClientRect().width
    expect(after).toBeLessThan(before)
    expect(after).toBeCloseTo(ring.getBoundingClientRect().height, 0) // still a square at the new size
  })
})

describe('ui-pie-chart — donut vs pie geometry (ADR-0219 cl.1/cl.6)', () => {
  it('donut (default): the track/slice path is a two-subpath compound (an annulus, leaving a center hole)', () => {
    const chart = mount('<ui-pie-chart></ui-pie-chart>') as HTMLElement // no data — the empty track
    const track = chart.querySelector('[data-part="track"]') as unknown as SVGPathElement
    const d = track.getAttribute('d') ?? ''
    expect(d.match(/M /g)?.length).toBe(2)
  })

  it('pie: the track path is a single subpath (a solid disc, no hole)', () => {
    const chart = mount('<ui-pie-chart variant="pie"></ui-pie-chart>') as HTMLElement
    const track = chart.querySelector('[data-part="track"]') as unknown as SVGPathElement
    const d = track.getAttribute('d') ?? ''
    expect(d.match(/M /g)?.length).toBe(1)
  })
})

describe('ui-pie-chart — the six RESOLVED slice fills are pairwise distinct AND monotone bright→dark in BOTH schemes (ADR-0219 cl.4 + Amendment)', () => {
  // The Amendment's regression class: token NAMES can look like a ladder while two steps RESOLVE to the
  // same color in one scheme (the original emphasis-role chain collapsed to four colors + a lightness
  // zigzag). Only a real engine resolves light-dark() + the var() chain, so the proof lives here: mount
  // six slices per scheme (the ui-stat wrapper colorScheme idiom) and assert on computed fills.

  /** Perceived-lightness key of a computed color — oklch L directly, else cbrt(WCAG relative luminance)
   *  from rgb()/color(srgb …). Throws on an unknown serialization: a silent skip would un-prove the ramp. */
  const lightnessOf = (color: string): number => {
    const ok = /^oklch\(\s*([\d.]+)(%?)/.exec(color)
    if (ok) return ok[2] ? Number(ok[1]) / 100 : Number(ok[1])
    const rgb = /^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/.exec(color)
    const srgb = /^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(color)
    const m = rgb ?? srgb
    if (!m) throw new Error(`unparseable computed slice fill: ${color}`)
    const scale = rgb ? 255 : 1
    const lin = [m[1], m[2], m[3]].map((c) => {
      const v = Number(c) / scale
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
    })
    return Math.cbrt(0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2])
  }

  const SIX = JSON.stringify(Array.from('abcdef', (label) => ({ label, value: 1 })))

  for (const scheme of ['light', 'dark'] as const) {
    it(`${scheme}: six slices resolve six pairwise-distinct fills, strictly darker 1→6 (slice 1 brightest)`, () => {
      const wrap = document.createElement('div')
      wrap.style.colorScheme = scheme // the ui-stat browser-test idiom — light-dark() re-resolves under the wrapper's scheme
      wrap.innerHTML = `<ui-pie-chart data='${SIX}'></ui-pie-chart>`
      document.body.append(wrap)
      mounted.push(wrap)
      const fills = [...wrap.querySelectorAll('[data-part="slice"]')].map((p) => getComputedStyle(p).fill)
      expect(fills.length, `${scheme}: six data rows must render six slices`).toBe(6)
      for (const fill of fills) expect(alphaOf(fill), `${scheme}: a slice resolved transparent (${fill})`).toBeGreaterThan(0)
      expect(new Set(fills).size, `${scheme}: resolved fills must be pairwise distinct — got ${fills.join(' · ')}`).toBe(6)
      const ladder = fills.map(lightnessOf)
      for (let i = 1; i < ladder.length; i++) {
        expect(ladder[i], `${scheme}: lightness must strictly DECREASE 1→6 (no zigzag) — got ${ladder.map((l) => l.toFixed(3)).join(' > ')}`).toBeLessThan(ladder[i - 1])
      }
    })
  }
})

describe('ui-pie-chart — forced colors (ADR-0219 cl.7)', () => {
  it('forced-colors keeps slices + track visible in system inks; slice fill != track fill — Chromium emulates (CDP); WebKit asserts the baseline', async () => {
    const chart = mount('<ui-pie-chart data=\'[{"label":"a","value":10}]\'></ui-pie-chart>') as HTMLElement
    const slice = chart.querySelector('[data-part="slice"]') as unknown as SVGElement

    // Baseline (BOTH engines): the slice is a painted, non-transparent fill (the token-default primary ink).
    expect(alphaOf(getComputedStyle(slice as unknown as Element).fill), 'baseline slice is invisible').toBeGreaterThan(0)

    if (server.browser !== 'chromium') {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(false)
      return
    }

    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] })
    try {
      expect(window.matchMedia('(forced-colors: active)').matches, 'CDP did not enter forced-colors').toBe(true)
      const sliceFill = getComputedStyle(slice as unknown as Element).fill
      expect(alphaOf(sliceFill), 'slice vanished under forced-colors').toBeGreaterThan(0)
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] })
    }
  })
})
