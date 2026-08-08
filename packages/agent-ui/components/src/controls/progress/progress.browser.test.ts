import { describe, it, expect, afterEach } from 'vitest'
import { server, cdp } from 'vitest/browser'

// progress.browser.test.ts — the cross-engine browser-truth proof for ui-progress (SPEC-N2: jsdom is
// blind to painted geometry, running animations, and WHCM). Covers what jsdom cannot: the whole-shape
// floor (SPEC-R18 AC1), the fill proportion ε-check + RTL fill direction (SPEC-R2 AC1/AC3), the
// indeterminate sweep vs. its reduced-motion replacement (SPEC-R2 AC2), and forced-colors (SPEC-R19 AC1).
//
// Side-effect CSS/JS imports — the load-bearing order (ADR-0003): foundation roles + dimensional ramp
// FIRST, then this control's own sheet, then the self-defining module. controls/progress/ is not yet
// exported from controls/index.ts (that barrel edit is the LLD-C11 shared-file integration slice, a
// separate wave from this folder) — direct (pre-barrel) imports, the stat/sparkline/bar-chart precedent.
import '@agent-ui/components/foundation-styles.css'
import './progress.css'
import './progress.ts'

const mounted: HTMLElement[] = []
const mount = (markup: string): HTMLElement => {
  const wrap = document.createElement('div')
  wrap.style.display = 'flex'
  wrap.innerHTML = markup
  document.body.append(wrap)
  mounted.push(wrap)
  return wrap.querySelector('ui-progress') as HTMLElement
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

describe('ui-progress — whole-shape floor (SPEC-R18 AC1, test-the-whole-shape)', () => {
  it('a bare, unstyled progress in an unstyled flex row paints a visible, non-collapsed box >= the min-inline-size floor', () => {
    const el = mount('<ui-progress></ui-progress>')
    const floor = tokenPx(el, '--ui-progress-min-inline-size')
    expect(floor, 'anti-vacuous: the floor token must resolve to a real px value').toBeGreaterThan(0)
    const box = el.getBoundingClientRect()
    expect(box.width, 'the bar collapsed below its whole-shape floor in a flex row').toBeGreaterThanOrEqual(floor - 1)
    expect(box.height, 'the bar painted zero height').toBeGreaterThan(0)

    const track = el.querySelector('[data-part="track"]') as HTMLElement
    const fill = el.querySelector('[data-part="fill"]') as HTMLElement
    expect(track.getBoundingClientRect().width, 'the track painted zero width').toBeGreaterThan(0)
    expect(fill.getBoundingClientRect().width, 'the indeterminate sweep painted zero width').toBeGreaterThan(0)
  })

  it('a determinate, populated progress also paints non-collapsed', () => {
    const el = mount('<ui-progress current="42" label="Indexing"></ui-progress>')
    const box = el.getBoundingClientRect()
    expect(box.width).toBeGreaterThan(0)
    expect(box.height).toBeGreaterThan(0)
  })
})

describe('ui-progress — determinate fill proportion (SPEC-R2 AC1)', () => {
  it('value=25 max=100 ⇒ the fill measures within ε of 25% of the track', () => {
    const el = mount('<ui-progress current="25" style="inline-size: 400px"></ui-progress>')
    const track = el.querySelector('[data-part="track"]') as HTMLElement
    const fill = el.querySelector('[data-part="fill"]') as HTMLElement
    const trackWidth = track.getBoundingClientRect().width
    const fillWidth = fill.getBoundingClientRect().width
    expect(fillWidth / trackWidth).toBeCloseTo(0.25, 1)
  })

  it('value=0 ⇒ the fill measures ~0; value=max ⇒ the fill measures the full track', () => {
    const zero = mount('<ui-progress current="0" style="inline-size: 400px"></ui-progress>')
    const zeroFill = zero.querySelector('[data-part="fill"]') as HTMLElement
    expect(zeroFill.getBoundingClientRect().width).toBeLessThan(1)

    const full = mount('<ui-progress current="100" style="inline-size: 400px"></ui-progress>')
    const fullTrack = full.querySelector('[data-part="track"]') as HTMLElement
    const fullFill = full.querySelector('[data-part="fill"]') as HTMLElement
    expect(fullFill.getBoundingClientRect().width).toBeCloseTo(fullTrack.getBoundingClientRect().width, 0)
  })
})

describe('ui-progress — RTL mirroring (SPEC-R2 AC3)', () => {
  it('under dir="rtl", the determinate fill grows from the inline-start — the PHYSICAL right edge', () => {
    const wrap = document.createElement('div')
    wrap.setAttribute('dir', 'rtl')
    wrap.style.display = 'flex'
    wrap.innerHTML = '<ui-progress current="25" style="inline-size: 400px"></ui-progress>'
    document.body.append(wrap)
    mounted.push(wrap)

    const el = wrap.querySelector('ui-progress') as HTMLElement
    const track = el.querySelector('[data-part="track"]') as HTMLElement
    const fill = el.querySelector('[data-part="fill"]') as HTMLElement
    const trackRect = track.getBoundingClientRect()
    const fillRect = fill.getBoundingClientRect()
    // inline-start in RTL is the PHYSICAL right edge — the fill's right edge should sit at the track's
    // right edge, and the fill should be narrower than the full track (25%, not 100%).
    expect(fillRect.right, 'the fill did not anchor to the physical right edge under RTL').toBeCloseTo(trackRect.right, 0)
    expect(fillRect.width).toBeLessThan(trackRect.width)
  })
})

describe('ui-progress — motion: indeterminate sweep, suppressed under reduced-motion (SPEC-R2 AC2)', () => {
  it('indeterminate renders a translating sweep animation', () => {
    const el = mount('<ui-progress></ui-progress>')
    const fill = el.querySelector('[data-part="fill"]') as HTMLElement
    expect(getComputedStyle(fill).animationName).toBe('ui-progress-sweep')
  })

  it('a determinate bar carries no animation at all — distinguishable from indeterminate', () => {
    const el = mount('<ui-progress current="50"></ui-progress>')
    const fill = el.querySelector('[data-part="fill"]') as HTMLElement
    expect(getComputedStyle(fill).animationName).toBe('none')
  })

  it('reduced-motion REPLACES the sweep with a stationary opacity pulse — Chromium emulates (CDP); WebKit asserts baseline', async () => {
    const el = mount('<ui-progress></ui-progress>')
    const fill = el.querySelector('[data-part="fill"]') as HTMLElement
    expect(getComputedStyle(fill).animationName).toBe('ui-progress-sweep')

    if (server.browser !== 'chromium') {
      expect(window.matchMedia('(prefers-reduced-motion: reduce)').matches).toBe(false)
      return
    }
    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
    try {
      expect(window.matchMedia('(prefers-reduced-motion: reduce)').matches).toBe(true)
      const cs = getComputedStyle(fill)
      expect(cs.animationName, 'reduced-motion did not swap to the pulse keyframes').toBe('ui-progress-pulse')
      // no translation: the fill's painted LEFT offset is fixed by the static inset-inline-start:30% rule,
      // not an animated one — sampled twice, it must not move (only opacity pulses).
      const left1 = fill.getBoundingClientRect().left
      await new Promise((r) => setTimeout(r, 50))
      const left2 = fill.getBoundingClientRect().left
      expect(left2, 'the reduced-motion fallback still translated — must be stationary').toBeCloseTo(left1, 0)
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] })
    }
  })
})

describe('ui-progress — segments: discrete-mode whole-shape + rendering (Amendment v1 AC1)', () => {
  it('a discrete progress paints non-collapsed with segments equal cells, first N filled', () => {
    const el = mount('<ui-progress current="2" segments="4" style="inline-size: 400px"></ui-progress>')
    const box = el.getBoundingClientRect()
    expect(box.width).toBeGreaterThan(0)
    expect(box.height).toBeGreaterThan(0)
    const cells = el.querySelectorAll('[data-part="cell"]')
    expect(cells.length).toBe(4)
    for (const cell of cells) expect((cell as HTMLElement).getBoundingClientRect().width).toBeGreaterThan(0)
    expect(Array.from(cells).filter((c) => c.hasAttribute('data-filled')).length).toBe(2)
  })
})

describe('ui-progress — segments: default-color inter-cell separation, incl. unfilled<->unfilled (component-checker F1, 2026-08-08)', () => {
  it('the gap ink is painted and distinguishable from unfilled-cell ink — every cell boundary reads, not just filled<->unfilled', () => {
    // current=2 segments=4 ⇒ cells [filled, filled, unfilled, unfilled] — the trailing pair is the EXACT
    // adjacent-unfilled boundary F1 named as invisible (a shared track/gap ink made it read as one run).
    const el = mount('<ui-progress current="2" segments="4" style="inline-size: 400px"></ui-progress>')
    const cellsEl = el.querySelector('[data-part="cells"]') as HTMLElement
    const cells = Array.from(el.querySelectorAll('[data-part="cell"]')) as HTMLElement[]
    const unfilled = cells.filter((c) => !c.hasAttribute('data-filled'))
    expect(unfilled.length, 'need >= 2 adjacent unfilled cells to probe the unfilled<->unfilled boundary').toBeGreaterThanOrEqual(2)

    const gapColor = getComputedStyle(cellsEl).backgroundColor
    const unfilledColor = getComputedStyle(unfilled[0]!).backgroundColor
    expect(alphaOf(gapColor), 'the gap ink vanished — the cells container painted nothing behind the gap').toBeGreaterThan(0)
    expect(gapColor, 'the gap must differ from unfilled-cell ink, else an unfilled<->unfilled boundary is invisible').not.toBe(unfilledColor)

    // a real, non-zero pixel gap exists between the two adjacent unfilled cells (spatial half of the proof;
    // the color assertions above are the visual-distinguishability half).
    const left = unfilled[unfilled.length - 2]!.getBoundingClientRect()
    const right = unfilled[unfilled.length - 1]!.getBoundingClientRect()
    expect(right.left - left.right, 'no real pixel gap between two adjacent unfilled cells').toBeGreaterThan(0)
  })
})

describe('ui-progress — forced colors, discrete mode (Amendment v1 AC4)', () => {
  it('filled-cell ink differs from unfilled-cell paint, and cell boundaries remain perceivable — Chromium emulates (CDP); WebKit asserts baseline', async () => {
    const el = mount('<ui-progress current="2" segments="4"></ui-progress>')
    const cells = Array.from(el.querySelectorAll('[data-part="cell"]')) as HTMLElement[]
    const filled = cells.filter((c) => c.hasAttribute('data-filled'))
    const unfilled = cells.filter((c) => !c.hasAttribute('data-filled'))
    expect(filled.length).toBe(2)
    expect(unfilled.length).toBe(2)

    // Baseline (BOTH engines): every cell is a painted, non-transparent background.
    for (const cell of cells) expect(alphaOf(getComputedStyle(cell).backgroundColor)).toBeGreaterThan(0)

    if (server.browser !== 'chromium') {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(false)
      return
    }
    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] })
    try {
      expect(window.matchMedia('(forced-colors: active)').matches, 'CDP did not enter forced-colors').toBe(true)
      const filledColor = getComputedStyle(filled[0]!).backgroundColor
      const unfilledColor = getComputedStyle(unfilled[0]!).backgroundColor
      expect(alphaOf(filledColor), 'a filled cell vanished under forced-colors').toBeGreaterThan(0)
      expect(alphaOf(unfilledColor), 'an unfilled cell vanished under forced-colors').toBeGreaterThan(0)
      expect(filledColor, 'filled and unfilled cells must be distinguishable under WHCM').not.toBe(unfilledColor)
      // every non-last cell carries an explicit inter-cell boundary — the separation never rides an
      // unstyled background alone (the bar-chart lesson, applied to the cell strip).
      expect(getComputedStyle(filled[0]!).borderInlineEndWidth, 'a cell lost its WHCM inter-cell boundary').not.toBe('0px')
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] })
    }
  })
})

describe('ui-progress — forced colors (SPEC-R19 AC1)', () => {
  it('fill and track survive as distinguishable system inks — Chromium emulates (CDP); WebKit asserts baseline', async () => {
    const el = mount('<ui-progress current="50"></ui-progress>')
    const track = el.querySelector('[data-part="track"]') as HTMLElement
    const fill = el.querySelector('[data-part="fill"]') as HTMLElement

    // Baseline (BOTH engines): the fill is a painted, non-transparent background.
    expect(alphaOf(getComputedStyle(fill).backgroundColor)).toBeGreaterThan(0)

    if (server.browser !== 'chromium') {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(false)
      return
    }
    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] })
    try {
      expect(window.matchMedia('(forced-colors: active)').matches, 'CDP did not enter forced-colors').toBe(true)
      const fillColor = getComputedStyle(fill).backgroundColor
      const trackColor = getComputedStyle(track).backgroundColor
      expect(alphaOf(fillColor), 'the fill vanished under forced-colors').toBeGreaterThan(0)
      expect(fillColor, 'fill and track must be distinguishable under WHCM').not.toBe(trackColor)
      expect(getComputedStyle(track).borderTopWidth, 'the track lost its WHCM border').not.toBe('0px')
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] })
    }
  })
})
