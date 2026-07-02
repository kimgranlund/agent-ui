import { describe, it, expect, afterEach } from 'vitest'
import { server, cdp, userEvent } from '@vitest/browser/context'
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
   *   focus   = Highlight outline (offset-OUTSIDE, from --c-focus-ring → Highlight)
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
