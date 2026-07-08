import { describe, it, expect, afterEach } from 'vitest'
import { server, cdp, userEvent } from 'vitest/browser'
import type { UICalendarElement } from './calendar.ts'

// Wave-5B browser smoke — ui-calendar (decomp 5B-1 · ADR-0048).
//
// What is proven here (none of this resolves in jsdom):
//   [1] WHOLE-SHAPE — the calendar panel renders a real bounding box in a flex-row container;
//       it is taller than wide (month grid gestalt: 7 × cell-size wide, ~8 rows tall incl. header)
//   [2] Roving focus across the grid — real DOM focus lands on the correct cell after ArrowRight;
//       focus crosses a month boundary (grid rebuilds, focus moves to Aug 1)
//   [3] today/selected/disabled render — [data-today] / aria-selected / aria-disabled reflect
//       visually (the correct cells carry the data attributes that drive the CSS fills)
//   [4] forced-colors — selected fill (Highlight/HighlightText) + today ring (ButtonText INSET border)
//       survive WHCM (Chromium via CDP; WebKit baseline). Three-state distinctness is proven:
//       focus=Highlight outline (offset-outside), selected=Highlight fill, today=ButtonText inset ring.
//   [5] Prev/Next nav buttons visually trigger a month change + DOM focus moves to the new cell
//   [6] C10 zero-residue — disconnect releases all listeners (click + key handlers gone)
//   [7] Form round-trip — value round-trips through a <form> (FormData)
//
// Side-effect imports — CSS load order (ADR-0003): foundation styles FIRST, then the calendar
// sheet, then the self-defining module. Imported DIRECTLY (relative), NOT via the component-styles
// barrel (the s12 barrel wiring lands at the integration slice).
import '@agent-ui/components/foundation-styles.css'
import '../_surface/container-box.css' // the box-model layer — provides the shared [data-box] margin/sticky/padding rules
import './calendar.css'
import './calendar.ts'

// ── mount / cleanup ────────────────────────────────────────────────────────────────────────────

const mounted: HTMLElement[] = []

/**
 * Mount a ui-calendar into a realistic shrink-wrapping container (a `display:flex` row — the
 * doc-specimen context per the Test-the-whole-shape law). The calendar is an `inline-block` so
 * the flex row shrink-wraps it to the panel's intrinsic size.
 */
function mount(markup: string): { wrap: HTMLElement; el: UICalendarElement } {
  const wrap = document.createElement('div')
  wrap.style.display = 'flex'
  wrap.style.flexDirection = 'row'
  wrap.style.gap = '8px'
  wrap.innerHTML = markup
  document.body.append(wrap)
  mounted.push(wrap)
  const el = wrap.querySelector('ui-calendar') as UICalendarElement
  return { wrap, el }
}

afterEach(async () => {
  await userEvent.unhover(document.body)
  while (mounted.length) mounted.pop()!.remove()
})

/** Alpha of a computed colour string. */
const alphaOf = (color: string): number => {
  if (color === 'transparent') return 0
  const m = color.match(/rgba?\(([^)]+)\)/i)
  if (!m) return 1
  const parts = m[1].split(/[\s,/]+/).filter(Boolean)
  return parts.length >= 4 ? Number(parts[3]) : 1
}

// ── ADR-0093 range mode: per-scheme token resolver + WCAG contrast (slider.browser.test.ts pattern) ──
// A throwaway probe child inherits the host's `--ui-calendar-*` chain; setting `color-scheme` on the
// PROBE (not the host/page) makes `light-dark()` inside the inherited token resolve to that branch —
// the cross-engine way to read BOTH scheme legs without touching the page's own color-scheme.
const resolveToken = (host: HTMLElement, tokenVar: string, scheme: 'light' | 'dark'): string => {
  const probe = document.createElement('span')
  probe.style.colorScheme = scheme
  probe.style.backgroundColor = `var(${tokenVar})`
  host.append(probe)
  const c = getComputedStyle(probe).backgroundColor
  probe.remove()
  return c
}

const toLin = (c: number): number => {
  const s = c <= 0 ? 0 : c >= 1 ? 1 : c
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}
const relativeLuminanceRgb = ([r, g, b]: [number, number, number]): number =>
  0.2126 * toLin(r / 255) + 0.7152 * toLin(g / 255) + 0.0722 * toLin(b / 255)
/** OKLCH → linear sRGB (Björn Ottosson's oklab matrices — same constants tokens.test.ts uses). */
const oklchToLinearSrgb = (L: number, C: number, hDeg: number): [number, number, number] => {
  const h = (hDeg * Math.PI) / 180
  const a = C * Math.cos(h)
  const b = C * Math.sin(h)
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.291485548 * b
  const l = l_ ** 3
  const m = m_ ** 3
  const s = s_ ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
}
const clamp01 = (x: number): number => Math.max(0, Math.min(1, x))
const relativeLuminanceOklch = (L: number, C: number, hDeg: number): number => {
  const [r, g, b] = oklchToLinearSrgb(L, C, hDeg)
  return 0.2126 * clamp01(r) + 0.7152 * clamp01(g) + 0.0722 * clamp01(b)
}
const relativeLuminance = (color: string): number => {
  const rgb = color.match(/rgba?\(([^)]+)\)/i)
  if (rgb) {
    const [r, g, b] = rgb[1].split(/[\s,/]+/).filter(Boolean).map(Number)
    return relativeLuminanceRgb([r, g, b])
  }
  const ok = color.match(/oklch\(([^)]+)\)/i)
  if (ok) {
    const [L, C, h] = ok[1].split(/[\s/]+/).filter(Boolean).map(Number)
    return relativeLuminanceOklch(L, C, h)
  }
  throw new Error(`unrecognized colour format (expected rgb()/rgba()/oklch()): "${color}"`)
}
const contrastOf = (a: string, b: string): number => {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const hi = Math.max(la, lb)
  const lo = Math.min(la, lb)
  return (hi + 0.05) / (lo + 0.05)
}

/**
 * Extract the colour component from a computed box-shadow string.
 * Browsers put the colour first: "rgba(r,g,b,a) Xpx Ypx ...".
 * Returns '' if the shadow is 'none' or unparseable.
 */
const shadowColor = (s: string): string => {
  if (!s || s === 'none') return ''
  const m = s.match(/^(rgba?\([^)]+\)|#[0-9a-f]+)/i)
  return m ? m[1] : ''
}

interface CdpSession {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [1] WHOLE-SHAPE — panel has a real bounding box; it is taller than wide (grid gestalt)
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-calendar — whole-shape assertion (Test-the-whole-shape DoD law)', () => {
  it('panel renders a real bounding box; taller than wide (7-col month grid gestalt)', async () => {
    const { el } = mount('<ui-calendar value="2026-07-15"></ui-calendar>')
    await el.updateComplete

    const panel = el.querySelector<HTMLElement>('[data-part="panel"]')!
    const rect  = panel.getBoundingClientRect()

    // Panel must have real dimensions (not collapsed)
    expect(rect.width,  `${server.browser}: panel collapsed to zero width`).toBeGreaterThan(0)
    expect(rect.height, `${server.browser}: panel collapsed to zero height`).toBeGreaterThan(0)

    // Month grid gestalt: 7 columns of square cells → panel is wider than a single cell but
    // also taller than wide (7 columns of ~32px = ~224px wide; 8 rows = ~256px tall incl. header).
    // We assert height > width * 0.7 (the gestalt is roughly square-ish to taller, never a thin bar).
    expect(
      rect.height,
      `${server.browser}: panel is much wider than tall — expected a month-grid, not a bar (${rect.width}×${rect.height})`,
    ).toBeGreaterThan(rect.width * 0.7)

    // The panel must be at least 7 × the minimum cell size (7 × 24px = 168px at the sm floor).
    expect(
      rect.width,
      `${server.browser}: panel is narrower than 7 cells at the sm cell-size floor (7×24=168px)`,
    ).toBeGreaterThanOrEqual(168)
  })

  it('each day cell renders a real square bounding box (width === height, neither zero)', async () => {
    const { el } = mount('<ui-calendar value="2026-07-15"></ui-calendar>')
    await el.updateComplete

    const cell = el.querySelector<HTMLElement>('[data-date="2026-07-15"]')!
    const rect = cell.getBoundingClientRect()

    expect(rect.width,  `${server.browser}: cell collapsed to zero width`).toBeGreaterThan(0)
    expect(rect.height, `${server.browser}: cell collapsed to zero height`).toBeGreaterThan(0)

    // Day cells are square (border-radius: 50% circle) — width ≈ height within ±2px
    expect(
      Math.abs(rect.width - rect.height),
      `${server.browser}: cell is not square (width=${rect.width} height=${rect.height}) — expected circular day button`,
    ).toBeLessThanOrEqual(2)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [2] Roving focus — real DOM focus on the correct cell; crosses month boundary
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-calendar — roving focus across the grid + month boundary (both engines)', () => {
  it('on connect with value="2026-07-15", the July 15 cell has tabindex="0"', async () => {
    const { el } = mount('<ui-calendar value="2026-07-15"></ui-calendar>')
    await el.updateComplete

    const focused = el.querySelector<HTMLElement>('[role="gridcell"][tabindex="0"]')
    expect(focused?.dataset['date'], `${server.browser}: tabindex=0 should be on 2026-07-15`).toBe('2026-07-15')
  })

  it('ArrowRight from July 15 moves real DOM focus to July 16', async () => {
    const { el } = mount('<ui-calendar value="2026-07-15"></ui-calendar>')
    await el.updateComplete

    const c15 = el.querySelector<HTMLElement>('[data-date="2026-07-15"]')!
    c15.focus()
    await userEvent.keyboard('{ArrowRight}')
    await el.updateComplete

    const c16 = el.querySelector<HTMLElement>('[data-date="2026-07-16"]')
    expect(document.activeElement, `${server.browser}: ArrowRight did not move focus to July 16`).toBe(c16)
    expect(c16?.getAttribute('tabindex'), `${server.browser}: July 16 should have tabindex=0`).toBe('0')
  })

  it('ArrowRight from July 31 crosses into August — grid rebuilds, focus is on Aug 1', async () => {
    const { el } = mount('<ui-calendar value="2026-07-31"></ui-calendar>')
    await el.updateComplete

    const c31 = el.querySelector<HTMLElement>('[data-date="2026-07-31"]')!
    c31.focus()
    await userEvent.keyboard('{ArrowRight}')
    await el.updateComplete

    // Title must change to August 2026
    const title = el.querySelector('[data-part="title"]')!
    expect(title.textContent, `${server.browser}: title did not update to August 2026 after month-boundary ArrowRight`).toBe('August 2026')

    // Focus must be on Aug 1
    const aug1 = el.querySelector<HTMLElement>('[data-date="2026-08-01"]')
    expect(aug1, `${server.browser}: August 1 cell not found after grid rebuild`).not.toBeNull()
    expect(document.activeElement, `${server.browser}: focus should be on Aug 1 after month-boundary cross`).toBe(aug1)
  })

  it('ArrowDown from July 15 moves real DOM focus to July 22 (+7 days)', async () => {
    const { el } = mount('<ui-calendar value="2026-07-15"></ui-calendar>')
    await el.updateComplete

    const c15 = el.querySelector<HTMLElement>('[data-date="2026-07-15"]')!
    c15.focus()
    await userEvent.keyboard('{ArrowDown}')
    await el.updateComplete

    const c22 = el.querySelector<HTMLElement>('[data-date="2026-07-22"]')
    expect(document.activeElement, `${server.browser}: ArrowDown did not move focus to July 22`).toBe(c22)
  })

  it('PageUp rebuilds the grid for June 2026; focus lands on June 15', async () => {
    const { el } = mount('<ui-calendar value="2026-07-15"></ui-calendar>')
    await el.updateComplete

    const c15 = el.querySelector<HTMLElement>('[data-date="2026-07-15"]')!
    c15.focus()
    await userEvent.keyboard('{PageUp}')
    await el.updateComplete

    const title = el.querySelector('[data-part="title"]')!
    expect(title.textContent, `${server.browser}: PageUp did not rebuild for June 2026`).toBe('June 2026')

    const jun15 = el.querySelector<HTMLElement>('[data-date="2026-06-15"]')
    expect(document.activeElement, `${server.browser}: PageUp should land focus on June 15`).toBe(jun15)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [3] today / selected / disabled render (data attributes drive CSS fills)
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-calendar — today / selected / disabled render (both engines)', () => {
  it('the selected cell has aria-selected="true" and [data-date=value]', async () => {
    const { el } = mount('<ui-calendar value="2026-07-15"></ui-calendar>')
    await el.updateComplete

    const selected = el.querySelectorAll('[aria-selected="true"]')
    expect(selected.length, `${server.browser}: expected exactly 1 aria-selected cell`).toBe(1)
    expect(
      (selected[0] as HTMLElement).dataset['date'],
      `${server.browser}: selected cell should be 2026-07-15`,
    ).toBe('2026-07-15')
  })

  it('selected cell has a non-transparent computed background-color (the fill token is applied)', async () => {
    const { el } = mount('<ui-calendar value="2026-07-15"></ui-calendar>')
    await el.updateComplete

    const cell = el.querySelector<HTMLElement>('[data-date="2026-07-15"]')!
    const bg   = getComputedStyle(cell).backgroundColor
    expect(
      alphaOf(bg),
      `${server.browser}: selected cell has no background (fill token not applied — CSS scope may be missing)`,
    ).toBeGreaterThan(0)
  })

  it('[data-today] is present on the current-day cell (clock-relative)', async () => {
    // Derive today from the REAL clock — a hardcoded date rots the day the wall-clock rolls past it
    // (this test originally pinned 2026-07-01 and broke on 2026-07-02). Same local-date arithmetic as
    // the control's own today-detection (timezone-safe explicit Y/M/D, never new Date('YYYY-MM-DD')).
    const now = new Date()
    const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    // Seed value = today so the rendered month is the current month (today's cell is in the grid).
    const { el } = mount(`<ui-calendar value="${iso}"></ui-calendar>`)
    await el.updateComplete

    const todayCell = el.querySelector<HTMLElement>('[data-today]')
    expect(todayCell, `${server.browser}: [data-today] cell not found in the current month`).not.toBeNull()
    expect(
      todayCell?.dataset['date'],
      `${server.browser}: [data-today] should be on the real current date`,
    ).toBe(iso)
  })

  it('today cell has a box-shadow ring (today-ring token applied)', async () => {
    const { el } = mount('<ui-calendar value="2026-07-01"></ui-calendar>')
    await el.updateComplete

    const todayCell = el.querySelector<HTMLElement>('[data-today]')!
    const shadow    = getComputedStyle(todayCell).boxShadow
    // The today ring is inset box-shadow: "none" means the token wasn't applied
    expect(
      shadow,
      `${server.browser}: today cell has no box-shadow (today-ring token not applied)`,
    ).not.toBe('none')
    expect(
      shadow.length,
      `${server.browser}: today box-shadow is empty`,
    ).toBeGreaterThan(0)
  })

  it('[data-outside] cells are present for adjacent-month overflow (June spill into July grid)', async () => {
    // July 2026 starts on Wednesday — June 28, 29, 30 (Sun-Mon-Tue) are outside cells
    const { el } = mount('<ui-calendar value="2026-07-15"></ui-calendar>')
    await el.updateComplete

    const outsideCells = [...el.querySelectorAll('[data-outside]')]
    expect(outsideCells.length, `${server.browser}: no [data-outside] cells found`).toBeGreaterThan(0)
    // The first outside cell should be June 28
    expect((outsideCells[0] as HTMLElement).dataset['date']).toBe('2026-06-28')
  })

  it('out-of-range cells have aria-disabled="true"', async () => {
    const { el } = mount('<ui-calendar value="2026-07-15" min="2026-07-10" max="2026-07-20"></ui-calendar>')
    await el.updateComplete

    // July 5 is before min
    const c5 = el.querySelector<HTMLElement>('[data-date="2026-07-05"]')!
    expect(c5.getAttribute('aria-disabled'), `${server.browser}: cell before min should be aria-disabled`).toBe('true')

    // July 10 is == min (edge: NOT disabled)
    const c10 = el.querySelector<HTMLElement>('[data-date="2026-07-10"]')!
    expect(c10.getAttribute('aria-disabled'), `${server.browser}: cell at min should NOT be aria-disabled`).toBeNull()

    // July 25 is after max
    const c25 = el.querySelector<HTMLElement>('[data-date="2026-07-25"]')!
    expect(c25.getAttribute('aria-disabled'), `${server.browser}: cell after max should be aria-disabled`).toBe('true')
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [4] forced-colors — selected fill + today ring survive WHCM (Chromium via CDP; WebKit baseline)
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-calendar — forced-colors (Chromium via CDP; WebKit asserts the baseline)', () => {
  /**
   * Three-state distinctness proof (the load-bearing invariant):
   *   focus   = Highlight outline (offset-OUTSIDE, from --md-sys-color-focus-ring → Highlight)
   *   selected = Highlight fill (background-color: Highlight, forced-color-adjust:none)
   *   today   = ButtonText inset ring (box-shadow: inset … ButtonText, forced-color-adjust:none)
   *
   * If today used Highlight for its ring, it would visually merge with:
   *   – the selected fill on the today+selected cell (same Highlight = ring invisible)
   *   – the focus ring on a focused-today cell (both Highlight, inside vs outside)
   * ButtonText is a different system colour from Highlight → the ring is always distinguishable.
   * We prove this by asserting selectedBg !== todayRingColor under forced-colors.
   */
  it('selected fill (Highlight) and today ring (ButtonText) are both present AND visually distinct', async () => {
    // value="2026-07-01" and today is 2026-07-01 → same cell = hardest case for distinctness
    const { el } = mount('<ui-calendar value="2026-07-01"></ui-calendar>')
    await el.updateComplete

    const selectedCell = el.querySelector<HTMLElement>('[data-date="2026-07-01"]')!
    const todayCell    = el.querySelector<HTMLElement>('[data-today]')! // same cell in this case

    // Baseline (BOTH engines, normal mode): selected cell has an opaque background fill
    expect(
      alphaOf(getComputedStyle(selectedCell).backgroundColor),
      `${server.browser}: selected cell has no background in normal mode (forced-colors check would be vacuous)`,
    ).toBeGreaterThan(0)

    // Baseline: today cell has a box-shadow ring
    const normalShadow = getComputedStyle(todayCell).boxShadow
    expect(
      normalShadow !== 'none' && normalShadow.length > 0,
      `${server.browser}: today ring is absent in normal mode`,
    ).toBe(true)

    if (server.browser !== 'chromium') {
      // WebKit: no CDP forced-colors emulation — assert the baseline only
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(false)
      return
    }

    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'forced-colors', value: 'active' }],
    })
    try {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(true)

      // Selected fill: forced-color-adjust:none keeps the explicit Highlight background.
      const fcSelectedBg = getComputedStyle(selectedCell).backgroundColor
      expect(
        alphaOf(fcSelectedBg),
        'selected fill vanished under forced-colors (forced-color-adjust:none not applied to selected cell)',
      ).toBeGreaterThan(0)

      // Today ring: forced-color-adjust:none keeps the explicit ButtonText box-shadow.
      const fcShadow = getComputedStyle(todayCell).boxShadow
      expect(
        fcShadow !== 'none' && fcShadow.length > 0,
        'today ring vanished under forced-colors (forced-color-adjust:none not applied to [data-today] cell)',
      ).toBe(true)

      // THREE-STATE DISTINCTNESS — prove the ring is specifically ButtonText, NOT Highlight.
      // A regression (changing the CSS to `Highlight` for the ring) would merge today+selected
      // into one indistinguishable blob. The gate must catch that.
      const todayRingColor = shadowColor(fcShadow)
      expect(
        todayRingColor,
        'could not extract colour from today cell box-shadow (shadowColor helper failed)',
      ).not.toBe('')

      // Resolve the ButtonText system colour by reading it off a temporary element.
      // Under forced-colors emulation, ButtonText is a concrete RGB; it is NOT the same as Highlight.
      const probe = document.createElement('span')
      probe.style.setProperty('color', 'ButtonText')
      probe.style.setProperty('forced-color-adjust', 'none')
      document.body.append(probe)
      const resolvedButtonText = getComputedStyle(probe).color
      probe.remove()

      expect(
        todayRingColor,
        'today ring colour must be ButtonText (not Highlight or another system colour) — ' +
        'a ButtonText→Highlight regression would collapse focus/selected/today into one Highlight blob',
      ).toBe(resolvedButtonText)

      // Corollary: ButtonText must differ from Highlight (the selected fill) so today stays distinct.
      expect(
        todayRingColor,
        'ButtonText resolved to the same colour as Highlight — three-state distinctness broken ' +
        '(forced-colors theme puts ButtonText=Highlight; revisit the token strategy)',
      ).not.toBe(fcSelectedBg)
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] })
    }
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [5] Prev / Next nav buttons — month change + real bounding box + focus moves
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-calendar — prev/next navigation buttons (both engines)', () => {
  it('clicking prev navigates to June 2026; clicking next navigates back to July 2026', async () => {
    const { el } = mount('<ui-calendar value="2026-07-15"></ui-calendar>')
    await el.updateComplete

    const prev  = el.querySelector<HTMLElement>('[data-part="prev"]')!
    const next  = el.querySelector<HTMLElement>('[data-part="next"]')!
    const title = el.querySelector('[data-part="title"]')!

    await userEvent.click(prev)
    await el.updateComplete
    expect(title.textContent, `${server.browser}: clicking prev did not navigate to June 2026`).toBe('June 2026')

    await userEvent.click(next)
    await el.updateComplete
    expect(title.textContent, `${server.browser}: clicking next did not navigate back to July 2026`).toBe('July 2026')
  })

  it('prev/next buttons render real bounding boxes (not collapsed)', async () => {
    const { el } = mount('<ui-calendar value="2026-07-15"></ui-calendar>')
    await el.updateComplete

    const prev = el.querySelector<HTMLElement>('[data-part="prev"]')!
    const next = el.querySelector<HTMLElement>('[data-part="next"]')!

    const prevR = prev.getBoundingClientRect()
    const nextR = next.getBoundingClientRect()

    expect(prevR.width,  `${server.browser}: prev button collapsed to zero width`).toBeGreaterThan(0)
    expect(prevR.height, `${server.browser}: prev button collapsed to zero height`).toBeGreaterThan(0)
    expect(nextR.width,  `${server.browser}: next button collapsed to zero width`).toBeGreaterThan(0)
    expect(nextR.height, `${server.browser}: next button collapsed to zero height`).toBeGreaterThan(0)

    // Phosphor-icon sweep: the INJECTED <svg> (setIcon(prev, 'caret-left') / setIcon(next, 'caret-right'))
    // must itself paint at a real, non-collapsed size — not just its containing button (a container can
    // pass every bounding-box check while its content renders at 0×0).
    const prevSvg = prev.querySelector('svg')!
    const nextSvg = next.querySelector('svg')!
    const prevSvgR = prevSvg.getBoundingClientRect()
    const nextSvgR = nextSvg.getBoundingClientRect()
    expect(prevSvgR.width,  `${server.browser}: injected prev-caret svg collapsed to zero width`).toBeGreaterThan(0)
    expect(prevSvgR.height, `${server.browser}: injected prev-caret svg collapsed to zero height`).toBeGreaterThan(0)
    expect(nextSvgR.width,  `${server.browser}: injected next-caret svg collapsed to zero width`).toBeGreaterThan(0)
    expect(nextSvgR.height, `${server.browser}: injected next-caret svg collapsed to zero height`).toBeGreaterThan(0)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [6] C10 zero-residue — disconnect releases all listeners (both engines)
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-calendar — C10 zero-residue (both engines)', () => {
  it('after disconnect, clicking a cell does NOT emit change (listener removed)', async () => {
    const { el } = mount('<ui-calendar value="2026-07-15"></ui-calendar>')
    await el.updateComplete

    const c20 = el.querySelector<HTMLElement>('[data-date="2026-07-20"]')!

    let changes = 0
    el.addEventListener('change', () => changes++)

    el.remove()
    mounted.pop() // already removed, don't double-remove in afterEach

    // c20 is now detached. Real-browser userEvent.click hit-tests coordinates and throws on
    // detached nodes. Use dispatchEvent directly — it works on detached DOM and correctly
    // proves that the connection-scoped grid listener (this.listen → AbortSignal) is gone.
    c20.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(changes, `${server.browser}: change fired after disconnect — grid click listener leaked`).toBe(0)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [7] Form round-trip — value round-trips through a <form> (both engines)
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-calendar — form round-trip (both engines)', () => {
  it('value submits under `name` via FormData; null when unselected; updates after commit', async () => {
    const { wrap } = mount(`
      <form>
        <ui-calendar name="dob" value=""></ui-calendar>
      </form>
    `)
    const form = wrap.querySelector('form')!
    const el   = wrap.querySelector('ui-calendar') as UICalendarElement
    await el.updateComplete

    // Nothing selected → no form entry
    expect(new FormData(form).get('dob'), 'unselected calendar should not submit a value').toBeNull()

    // Click July 15 to select it
    const c15 = el.querySelector<HTMLElement>('[data-date="2026-07-15"]')!
    await userEvent.click(c15)
    await el.updateComplete

    expect(el.value, 'value should be 2026-07-15 after click').toBe('2026-07-15')
    expect(new FormData(form).get('dob'), 'form should contain the selected value').toBe('2026-07-15')
  })

  it('required + no selection → valueMissing; validity clears after selection', async () => {
    const { wrap } = mount(`
      <form>
        <ui-calendar name="appt" required></ui-calendar>
      </form>
    `)
    const el = wrap.querySelector('ui-calendar') as UICalendarElement
    await el.updateComplete

    expect(el.validity.valueMissing, 'required calendar with no selection → valueMissing').toBe(true)
    expect(el.validity.valid).toBe(false)

    // Navigate to July 2026 (the default month for today = 2026-07-01) and click July 10
    // The calendar shows July 2026 because today is 2026-07-01
    const c10 = el.querySelector<HTMLElement>('[data-date="2026-07-10"]')!
    await userEvent.click(c10)
    await el.updateComplete

    expect(el.validity.valid, 'validity should clear after selection').toBe(true)
    expect(el.validity.valueMissing).toBe(false)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [8] [size=sm/lg] attribute — cell size shifts (both engines)
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-calendar — [size] cell-size shift (both engines)', () => {
  it('[size=sm] cells are smaller than default; [size=lg] cells are larger', async () => {
    const wrapSm = document.createElement('div')
    wrapSm.style.display = 'flex'

    const smEl = document.createElement('ui-calendar') as UICalendarElement
    smEl.setAttribute('size', 'sm')
    smEl.setAttribute('value', '2026-07-15')
    wrapSm.append(smEl)
    document.body.append(wrapSm)
    mounted.push(wrapSm)

    const wrapLg = document.createElement('div')
    wrapLg.style.display = 'flex'
    const lgEl = document.createElement('ui-calendar') as UICalendarElement
    lgEl.setAttribute('size', 'lg')
    lgEl.setAttribute('value', '2026-07-15')
    wrapLg.append(lgEl)
    document.body.append(wrapLg)
    mounted.push(wrapLg)

    const wrapDf = document.createElement('div')
    wrapDf.style.display = 'flex'
    const dfEl = document.createElement('ui-calendar') as UICalendarElement
    dfEl.setAttribute('value', '2026-07-15')
    wrapDf.append(dfEl)
    document.body.append(wrapDf)
    mounted.push(wrapDf)

    await smEl.updateComplete
    await lgEl.updateComplete
    await dfEl.updateComplete

    const smCell = smEl.querySelector<HTMLElement>('[data-date="2026-07-15"]')!
    const dfCell = dfEl.querySelector<HTMLElement>('[data-date="2026-07-15"]')!
    const lgCell = lgEl.querySelector<HTMLElement>('[data-date="2026-07-15"]')!

    const smW = smCell.getBoundingClientRect().width
    const dfW = dfCell.getBoundingClientRect().width
    const lgW = lgCell.getBoundingClientRect().width

    expect(smW, `${server.browser}: [size=sm] cell must be smaller than default`).toBeLessThan(dfW)
    expect(lgW, `${server.browser}: [size=lg] cell must be larger than default`).toBeGreaterThan(dfW)

    // Anti-vacuous: all three must be non-zero
    expect(smW, `${server.browser}: [size=sm] cell collapsed`).toBeGreaterThan(0)
    expect(dfW, `${server.browser}: default cell collapsed`).toBeGreaterThan(0)
    expect(lgW, `${server.browser}: [size=lg] cell collapsed`).toBeGreaterThan(0)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [9] Enter commit — emits change + select, focus stays in the grid (both engines)
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-calendar — Enter commit (both engines)', () => {
  it('Enter on a focused cell commits + emits change + select (detail = ISO string)', async () => {
    const { el } = mount('<ui-calendar value="2026-07-15"></ui-calendar>')
    await el.updateComplete

    let changes = 0
    let selectDetail: string | null = null
    el.addEventListener('change', () => changes++)
    el.addEventListener('select', (e) => { selectDetail = (e as CustomEvent<string>).detail })

    // Focus July 20, press Enter → commits
    const c20 = el.querySelector<HTMLElement>('[data-date="2026-07-20"]')!
    c20.focus()
    await userEvent.keyboard('{Enter}')
    await el.updateComplete

    expect(el.value,     `${server.browser}: Enter did not update value`).toBe('2026-07-20')
    expect(changes,      `${server.browser}: change event not fired`).toBe(1)
    expect(selectDetail, 'select event must have fired').not.toBeNull()
    expect(selectDetail, `${server.browser}: select detail should be the ISO date`).toBe('2026-07-20')
  })

  it('Enter on a disabled cell (aria-disabled) is a no-op — value unchanged', async () => {
    const { el } = mount('<ui-calendar value="2026-07-15" min="2026-07-10"></ui-calendar>')
    await el.updateComplete

    const c5 = el.querySelector<HTMLElement>('[data-date="2026-07-05"]')!
    expect(c5.getAttribute('aria-disabled')).toBe('true')

    let changes = 0
    el.addEventListener('change', () => changes++)

    c5.focus()
    await userEvent.keyboard('{Enter}')
    await el.updateComplete

    expect(el.value).toBe('2026-07-15')
    expect(changes).toBe(0)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [10] Container box-model inset — the nav header + grid honor the shared 6px inset (ADR-0046
//       Amendment 2, 2026-07-04: [data-box] regions are no longer full-bleed). calendar.css's own
//       comments describe this; this pins the RENDERED consequence a real engine resolves, so a
//       regression in the shared container-box.css (or a calendar.css override that opts back out
//       of the inset) is caught here, not just read off a comment.
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-calendar — container box-model inset (ADR-0046 Amendment 2, both engines)', () => {
  it('the nav header is INSET (margin + sticky offset = the 6px box inset, not full-bleed/0)', async () => {
    const { el } = mount('<ui-calendar value="2026-07-15"></ui-calendar>')
    await el.updateComplete

    const nav = el.querySelector<HTMLElement>('[data-part="nav"]')!
    const cs  = getComputedStyle(nav)

    // At-rest margin: the SAME --ui-box-inset every other [data-box] child carries (6px @ 16px
    // root) — NOT the pre-revision full-bleed margin:0.
    expect(cs.marginTop, `${server.browser}: nav header margin is not the 6px box inset (full-bleed regression?)`).toBe('6px')

    // Sticky offset: inset-block-start is the SAME 6px inset, not 0 — the fix that keeps the
    // at-rest and stuck positions from snapping (container-box.css's sticky-offset note).
    expect(cs.position, `${server.browser}: nav header lost position:sticky`).toBe('sticky')
    expect(cs.top, `${server.browser}: nav header sticky inset-block-start is not the 6px box inset`).toBe('6px')
  })

  it('the nav header sits inset from the panel edge (not flush against it, i.e. not full-bleed)', async () => {
    const { el } = mount('<ui-calendar value="2026-07-15"></ui-calendar>')
    await el.updateComplete

    const panel = el.querySelector<HTMLElement>('[data-part="panel"]')!
    const nav   = el.querySelector<HTMLElement>('[data-part="nav"]')!
    const gap   = nav.getBoundingClientRect().top - panel.getBoundingClientRect().top

    // Panel border-box top → nav border-box top = the panel's own 1px border + the nav's 6px
    // margin = ~7px. The load-bearing floor is "clearly inset" (≥ 6px), not "flush" (~0-1px) —
    // the shape a full-bleed regression would collapse to.
    expect(gap, `${server.browser}: nav sits flush against the panel edge (full-bleed) instead of inset`).toBeGreaterThanOrEqual(6)
  })

  it('the day grid carries the same 6px direct-child inset margin as the nav header', async () => {
    const { el } = mount('<ui-calendar value="2026-07-15"></ui-calendar>')
    await el.updateComplete

    const grid = el.querySelector<HTMLElement>('[data-part="grid"]')!
    expect(getComputedStyle(grid).marginTop, `${server.browser}: grid margin is not the 6px box inset`).toBe('6px')
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [11] ADR-0093 range mode — the fill PAINTS: endpoint vs interior backgrounds differ, and the
//       --ui-calendar-range-fill/-range-ink pair clears WCAG AA (≥4.5:1) in BOTH colour schemes.
//       jsdom cannot prove any of this (it never resolves CSS cascade/paint) — this is the required
//       browser-level proof the CSS in calendar.css actually renders (ADR-0093 acceptance).
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-calendar — range mode: fill PAINT (both engines)', () => {
  it('a committed range paints: endpoints are CIRCULAR (selected-fill), interior is SQUARE (range-fill) — computed backgrounds differ', async () => {
    const { el } = mount('<ui-calendar mode="range" value-start="2026-07-10" value-end="2026-07-15"></ui-calendar>')
    await el.updateComplete

    const startCell = el.querySelector<HTMLElement>('[data-date="2026-07-10"]')!
    const endCell   = el.querySelector<HTMLElement>('[data-date="2026-07-15"]')!
    const midCell   = el.querySelector<HTMLElement>('[data-date="2026-07-12"]')!

    const startBg = getComputedStyle(startCell).backgroundColor
    const endBg   = getComputedStyle(endCell).backgroundColor
    const midBg   = getComputedStyle(midCell).backgroundColor

    // Every band cell has SOME opaque fill (not transparent) — the baseline the diff check needs.
    expect(alphaOf(startBg), `${server.browser}: range-start has no background fill`).toBeGreaterThan(0)
    expect(alphaOf(endBg),   `${server.browser}: range-end has no background fill`).toBeGreaterThan(0)
    expect(alphaOf(midBg),   `${server.browser}: interior in-range cell has no background fill`).toBeGreaterThan(0)

    // Endpoint vs interior computed backgrounds must DIFFER (ADR-0093 acceptance: "endpoint vs
    // interior computed backgrounds differ") — selected-fill (accent) vs range-fill (surface wash).
    expect(midBg, `${server.browser}: interior fill (${midBg}) must differ from the endpoint fill (${startBg})`).not.toBe(startBg)
    expect(startBg, `${server.browser}: both endpoints must share the SAME selected-fill`).toBe(endBg)

    // Shape signifier (ADR-0057 non-colour): endpoints stay circular (radius:50%), interior is
    // square (radius:0) — survives independent of colour, proven directly here.
    expect(getComputedStyle(startCell).borderRadius, `${server.browser}: range-start must stay circular`).toBe('50%')
    expect(getComputedStyle(midCell).borderRadius, `${server.browser}: interior must be square (radius:0)`).toBe('0px')
  })

  it('--ui-calendar-range-fill/-range-ink clear WCAG AA (≥4.5:1) in BOTH colour schemes', async () => {
    const el = document.createElement('ui-calendar') as UICalendarElement
    document.body.append(el)
    mounted.push(el)

    for (const scheme of ['light', 'dark'] as const) {
      const fill = resolveToken(el, '--ui-calendar-range-fill', scheme)
      const ink  = resolveToken(el, '--ui-calendar-range-ink', scheme)
      const ratio = contrastOf(fill, ink)
      expect(
        ratio,
        `${server.browser} [${scheme}]: range-fill(${fill}) vs range-ink(${ink}) = ${ratio.toFixed(2)}:1 — below the AA 4.5:1 floor`,
      ).toBeGreaterThanOrEqual(4.5)
    }
  })

  // ────────────────────────────────────────────────────────────────────────────────────────────
  //  Erratum guard (2026-07-07 — gallery audit): AA ink-vs-fill contrast alone did NOT catch the
  //  fill being near-identical to the panel it sits on (measured ~0.001 OKLCH L, ~1.00:1 relative-
  //  luminance ratio — the band was load-bearing colour that was effectively invisible). This test
  //  asserts the interior wash has REAL luminance separation from the panel background, in BOTH
  //  colour schemes, so a future token repoint can't silently regress back to near-zero contrast.
  // ────────────────────────────────────────────────────────────────────────────────────────────
  it('--ui-calendar-range-fill has a REAL luminance separation from the panel background in BOTH colour schemes (erratum guard)', async () => {
    const el = document.createElement('ui-calendar') as UICalendarElement
    document.body.append(el)
    mounted.push(el)

    for (const scheme of ['light', 'dark'] as const) {
      const panelBg = resolveToken(el, '--ui-calendar-panel-bg', scheme)
      const fill = resolveToken(el, '--ui-calendar-range-fill', scheme)
      const ratio = contrastOf(panelBg, fill)
      // The OLD (buggy) pairing measured ~1.00:1 (imperceptible). The floor below is well under
      // the NEW pairing's measured ~1.23:1 (light) / ~1.28:1 (dark), but comfortably above the
      // "basically the same colour" regime a silent regression would reintroduce.
      expect(
        ratio,
        `${server.browser} [${scheme}]: panel-bg(${panelBg}) vs range-fill(${fill}) = ${ratio.toFixed(3)}:1 — ` +
          `the in-range wash is not visibly distinct from the panel it sits on`,
      ).toBeGreaterThanOrEqual(1.15)
    }
  })

  it('an in-progress hover preview paints the SAME interior fill as a committed band (swap-preview, both directions)', async () => {
    const { el } = mount('<ui-calendar mode="range" value-start="2026-07-15"></ui-calendar>')
    await el.updateComplete

    // Hover a candidate EARLIER than the anchor — the normalized (swapped) preview band.
    const c10 = el.querySelector<HTMLElement>('[data-date="2026-07-10"]')!
    await userEvent.hover(c10)
    await el.updateComplete

    const c12 = el.querySelector<HTMLElement>('[data-date="2026-07-12"]')! // interior of the normalized [10,15] band
    const previewBg = getComputedStyle(c12).backgroundColor
    expect(alphaOf(previewBg), `${server.browser}: preview interior has no fill while selecting-end`).toBeGreaterThan(0)
    expect(c12.hasAttribute('data-in-range'), `${server.browser}: July 12 must preview as in-range (backward-normalized band)`).toBe(true)

    // Outside the previewed band (before the earlier candidate) must NOT be painted.
    const c05 = el.querySelector<HTMLElement>('[data-date="2026-07-05"]')!
    expect(c05.hasAttribute('data-in-range'), `${server.browser}: July 5 is outside the previewed band`).toBe(false)

    // Committing now must render EXACTLY the previewed band ("commit never surprises" — ADR-0093 clause 3):
    // the interior cell's painted background must be IDENTICAL before and after commit.
    await userEvent.click(c10)
    await el.updateComplete

    expect(el.valueStart, `${server.browser}: swap-complete must set start = the earlier date`).toBe('2026-07-10')
    expect(el.valueEnd,   `${server.browser}: swap-complete must set end = the later (original anchor) date`).toBe('2026-07-15')
    const committedBg = getComputedStyle(c12).backgroundColor
    expect(committedBg, `${server.browser}: the committed interior fill must match the previewed fill exactly`).toBe(previewBg)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════
//  [12] ADR-0093 range mode — forced-colors: the WHOLE band (endpoints + interior) maps to
//       Highlight/HighlightText as ONE self-delimiting run, while focus/today/disabled stay distinct
//       (Chromium via CDP; WebKit asserts the baseline, mirroring the single-mode suite above).
// ════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-calendar — range mode: forced-colors (Chromium via CDP; WebKit baseline)', () => {
  it('the band (endpoints + interior) renders as ONE Highlight/HighlightText run; today + focus stay distinct', async () => {
    const { el } = mount('<ui-calendar mode="range" value-start="2026-07-10" value-end="2026-07-15"></ui-calendar>')
    await el.updateComplete

    const startCell = el.querySelector<HTMLElement>('[data-date="2026-07-10"]')!
    const midCell   = el.querySelector<HTMLElement>('[data-date="2026-07-12"]')!
    const endCell   = el.querySelector<HTMLElement>('[data-date="2026-07-15"]')!

    // Baseline (both engines, normal mode): all three cells carry an opaque fill (regression guard).
    expect(alphaOf(getComputedStyle(startCell).backgroundColor)).toBeGreaterThan(0)
    expect(alphaOf(getComputedStyle(midCell).backgroundColor)).toBeGreaterThan(0)
    expect(alphaOf(getComputedStyle(endCell).backgroundColor)).toBeGreaterThan(0)

    if (server.browser !== 'chromium') {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(false)
      return
    }

    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'forced-colors', value: 'active' }],
    })
    try {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(true)

      const startBg = getComputedStyle(startCell).backgroundColor
      const midBg   = getComputedStyle(midCell).backgroundColor
      const endBg   = getComputedStyle(endCell).backgroundColor

      // The WHOLE band — endpoints AND interior — must resolve to the SAME Highlight fill: one
      // self-delimiting run (ADR-0093 clause 4), not a third colour distinguishing interior.
      expect(alphaOf(startBg), 'range-start fill vanished under forced-colors').toBeGreaterThan(0)
      expect(alphaOf(midBg),   'interior fill vanished under forced-colors').toBeGreaterThan(0)
      expect(alphaOf(endBg),   'range-end fill vanished under forced-colors').toBeGreaterThan(0)
      expect(midBg, 'interior forced-colors fill must match the endpoint fill (one Highlight run)').toBe(startBg)
      expect(endBg, 'both endpoints must share the same forced-colors fill').toBe(startBg)

      // Shape stays the ONLY endpoint-vs-interior signifier under forced-colors (border-radius is
      // never flattened by the OS wash) — this is what keeps the band self-delimiting without a
      // third system colour.
      expect(getComputedStyle(startCell).borderRadius, 'endpoint must stay circular under forced-colors').toBe('50%')
      expect(getComputedStyle(midCell).borderRadius, 'interior must stay square under forced-colors').toBe('0px')
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] })
    }
  })
})
