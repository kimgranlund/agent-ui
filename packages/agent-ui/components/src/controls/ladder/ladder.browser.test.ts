import { describe, it, expect, afterEach } from 'vitest'
import { server, cdp } from 'vitest/browser'

// ladder.browser.test.ts — the cross-engine browser-truth proof (SPEC-N2; jsdom is blind to painted
// geometry AND forced-colors). Runs in BOTH Chromium and WebKit. Covers what jsdom cannot: whole-shape
// (SPEC-R13 AC1), the LITERAL-length bar rendering + track cap (SPEC-R10 AC1/AC2), the undefined-var
// zero-bar fallback genuinely firing (SPEC-R11), RTL mirroring (SPEC-R15), and forced-colors (SPEC-R14 AC1).
import '@agent-ui/components/foundation-styles.css'
import './ladder.css'
import './ladder.ts'

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

describe('ui-ladder — whole-shape (SPEC-R13 AC1, test-the-whole-shape)', () => {
  it('a bare, unstyled, populated ladder in an unstyled flex row paints a visible, non-collapsed list >= the floor', () => {
    const row = mount(
      '<div style="display:flex"><ui-ladder tiers=\'[{"label":"sm","value":"24px"}]\'></ui-ladder></div>',
    )
    const ladder = row.querySelector('ui-ladder') as HTMLElement
    const floor = tokenPx(ladder, '--ui-ladder-min-inline-size')
    expect(floor, 'anti-vacuous: the floor token must resolve to a real px value').toBeGreaterThan(0)
    const box = ladder.getBoundingClientRect()
    expect(box.width).toBeGreaterThanOrEqual(floor - 1)
    const track = ladder.querySelector('[data-part="track"]') as HTMLElement
    expect(track.getBoundingClientRect().width, 'the track itself painted zero width').toBeGreaterThan(0)
  })
})

describe('ui-ladder — the literal-length leg (SPEC-R10 AC1)', () => {
  it('bar inline-sizes for 24px/28px/36px measure the LITERAL px within epsilon, NOT a normalized proportion', () => {
    const ladder = mount(
      '<ui-ladder style="inline-size: 400px" tiers=\'[{"label":"sm","value":"24px"},{"label":"md","value":"28px"},{"label":"lg","value":"36px"}]\'></ui-ladder>',
    ) as HTMLElement
    const bars = [...ladder.querySelectorAll('[data-part="bar"]')] as HTMLElement[]
    expect(bars).toHaveLength(3)
    const widths = bars.map((b) => b.getBoundingClientRect().width)
    expect(widths[0]).toBeCloseTo(24, 0)
    expect(widths[1]).toBeCloseTo(28, 0)
    expect(widths[2]).toBeCloseTo(36, 0)
  })

  it('a tier value wider than the track caps at the track width (SPEC-R10 AC2) — no host overflow', () => {
    const ladder = mount(
      '<ui-ladder style="inline-size: 200px" tiers=\'[{"label":"huge","value":"400px"}]\'></ui-ladder>',
    ) as HTMLElement
    const bar = ladder.querySelector('[data-part="bar"]') as HTMLElement
    const track = ladder.querySelector('[data-part="track"]') as HTMLElement
    const barWidth = bar.getBoundingClientRect().width
    const trackWidth = track.getBoundingClientRect().width
    expect(barWidth).toBeLessThanOrEqual(trackWidth + 0.5)
    expect(ladder.scrollWidth).toBeLessThanOrEqual(ladder.getBoundingClientRect().width + 1)
  })

  it('an undefined --var tier zero-bars via the min(100%, var(--_mag, 0px)) fallback genuinely firing (SPEC-R11)', () => {
    const ladder = mount(
      '<ui-ladder tiers=\'[{"label":"ghost","value":"--ui-zz-never-defined"}]\'></ui-ladder>',
    ) as HTMLElement
    const bar = ladder.querySelector('[data-part="bar"]') as HTMLElement
    expect(bar.style.getPropertyValue('--_mag')).toBe('var(--ui-zz-never-defined)')
    // The CSS var() substitution is guaranteed-invalid (undefined custom property) → var(--_mag, 0px) falls
    // back to 0px → the bar renders ZERO width, while the row + printed value still exist in the DOM.
    expect(bar.getBoundingClientRect().width).toBeCloseTo(0, 0)
    expect(ladder.querySelector('[data-part="value"]')?.textContent).toBe('--ui-zz-never-defined')
  })

  it('a non-length tier ("red") zero-bars (0px) while the row + printed value survive (SPEC-R11)', () => {
    const ladder = mount(
      '<ui-ladder tiers=\'[{"label":"bad","value":"red"},{"label":"ok","value":"20px"}]\'></ui-ladder>',
    ) as HTMLElement
    const bars = [...ladder.querySelectorAll('[data-part="bar"]')] as HTMLElement[]
    expect(bars).toHaveLength(2)
    expect(bars[0].getBoundingClientRect().width).toBeCloseTo(0, 0)
    expect(bars[1].getBoundingClientRect().width).toBeCloseTo(20, 0)
  })
})

describe('ui-ladder — RTL mirroring (SPEC-R15)', () => {
  it('under dir="rtl", the row mirrors — the bar grows from the physical right edge of the track', () => {
    const ladder = mount(
      '<ui-ladder dir="rtl" style="inline-size: 400px" tiers=\'[{"label":"a","value":"40px"}]\'></ui-ladder>',
    ) as HTMLElement
    const track = ladder.querySelector('[data-part="track"]') as HTMLElement
    const bar = ladder.querySelector('[data-part="bar"]') as HTMLElement
    const trackRight = Math.round(track.getBoundingClientRect().right)
    const barRight = Math.round(bar.getBoundingClientRect().right)
    expect(barRight).toBeCloseTo(trackRight, -1)
  })
})

describe('ui-ladder — forced colors (SPEC-R14 AC1)', () => {
  it('the bar paints CanvasText (a system ink, never forced away); Chromium emulates (CDP), WebKit asserts the baseline', async () => {
    const ladder = mount('<ui-ladder tiers=\'[{"label":"a","value":"10px"}]\'></ui-ladder>') as HTMLElement
    const bar = ladder.querySelector('[data-part="bar"]') as HTMLElement

    expect(alphaOf(getComputedStyle(bar).backgroundColor), 'baseline bar is invisible').toBeGreaterThan(0)

    if (server.browser !== 'chromium') {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(false)
      return
    }

    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] })
    try {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(true)
      expect(alphaOf(getComputedStyle(bar).backgroundColor), 'the bar vanished under forced-colors').toBeGreaterThan(0)
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] })
    }
  })
})
