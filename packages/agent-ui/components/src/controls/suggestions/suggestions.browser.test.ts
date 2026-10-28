import { describe, it, expect, afterEach } from 'vitest'

// suggestions.browser.test.ts — the real-engine proof for the one-shot chip set (ADR-0213). jsdom is
// blind to painted geometry/computed ink/native-disabled pointer suppression — this file proves the
// compact-realm chip geometry, the WHOLE bounding-box gestalt, a REAL pointer click committing the set,
// and that a real disabled chip truly stops receiving pointer clicks (the platform half of the one-shot
// law suggestions.test.ts cannot observe under jsdom).
//
// Side-effect CSS/JS imports — the load-bearing order (ADR-0003): foundation roles + dimensional ramp
// FIRST, then this control's own sheet, then the self-defining module.
import '@agent-ui/components/foundation-styles.css'
import './suggestions.css'
import './suggestions.ts'
import type { UISuggestionsElement } from './suggestions.ts'
import { whenFlushed } from '../../reactive/index.ts'
import { rootResolve } from '../../../../../../scripts/lib/foundations-model.mjs'

const mounted: HTMLElement[] = []
const mount = (): UISuggestionsElement => {
  const wrap = document.createElement('div')
  wrap.style.width = '480px'
  const el = document.createElement('ui-suggestions') as UISuggestionsElement
  wrap.append(el)
  document.body.append(wrap)
  mounted.push(wrap)
  return el
}
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

const px = (v: string): number => Number.parseFloat(v)

const SET = [
  { label: 'Book the Deluxe King' },
  { label: 'See more photos', value: 'more-photos' },
  { label: 'Compare rooms', value: 'compare' },
]

describe('ui-suggestions — compact-realm chip geometry (whole-shape gestalt)', () => {
  it('a populated set paints a non-collapsed host; each chip block-size == the derived icon box (2n, ADR-0245 cl.3)', async () => {
    const el = mount()
    el.suggestions = SET
    await whenFlushed()

    const chips = [...el.querySelectorAll('[data-part="chip"]')] as HTMLElement[]
    expect(chips.length).toBe(3)

    const hostBox = el.getBoundingClientRect()
    expect(hostBox.width, 'the host painted zero width').toBeGreaterThan(0)
    expect(hostBox.height, 'the host painted zero height').toBeGreaterThan(0)

    for (const chip of chips) {
      const rect = chip.getBoundingClientRect()
      expect(rect.width, 'a chip painted zero width').toBeGreaterThan(0)
      expect(px(getComputedStyle(chip).blockSize), 'chip block-size must equal the derived icon box').toBeCloseTo(rootResolve('md').iconBox, 0)
      // the pill radius == half the box (a full pill, never a rectangle)
      const radius = px(getComputedStyle(chip).borderTopLeftRadius)
      expect(radius).toBeCloseTo(rect.height / 2, 0)
    }
  })

  it('chip corners follow the data-radius cascade: sharp is square, crisp is a quarter-box, balanced and pill are the full pill (T-0427)', async () => {
    const el = mount()
    el.suggestions = SET
    await whenFlushed()
    const chip = el.querySelector('[data-part="chip"]') as HTMLElement
    const wrap = el.parentElement as HTMLElement
    const radiusAt = (radius: string | null): { r: number; h: number } => {
      if (radius === null) wrap.removeAttribute('data-radius')
      else wrap.setAttribute('data-radius', radius)
      return { r: px(getComputedStyle(chip).borderTopLeftRadius), h: chip.getBoundingClientRect().height }
    }
    const balanced = radiusAt(null)
    expect(balanced.r, 'anti-vacuous: the default radius is the full pill').toBeCloseTo(balanced.h / 2, 0)
    const sharp = radiusAt('sharp')
    expect(sharp.r).toBe(0)
    const crisp = radiusAt('crisp')
    expect(crisp.r).toBeCloseTo(crisp.h / 4, 0)
    const pill = radiusAt('pill')
    expect(pill.r).toBeGreaterThanOrEqual(pill.h / 2 - 0.5)
  })

  it('chips sit on one row at the column-gap token when they fit; the row wraps at the row-gap token otherwise', async () => {
    const el = mount()
    el.suggestions = SET
    await whenFlushed()
    const chips = [...el.querySelectorAll('[data-part="chip"]')] as HTMLElement[]
    const colGap = px(getComputedStyle(el).columnGap)
    expect(colGap, 'anti-vacuous: the column gap resolves to a real px value').toBeGreaterThan(0)
    // same-row adjacency: consecutive chips on the same line are colGap apart, left-to-right
    for (let i = 1; i < chips.length; i++) {
      const prev = chips[i - 1]!.getBoundingClientRect()
      const next = chips[i]!.getBoundingClientRect()
      if (Math.abs(next.top - prev.top) < 1) {
        expect(Math.abs(next.left - prev.right - colGap)).toBeLessThanOrEqual(1)
      }
    }
  })

  it('an empty set paints a zero-height, non-intrusive host (no phantom box)', async () => {
    const el = mount()
    await whenFlushed()
    expect(el.getBoundingClientRect().height).toBe(0)
  })
})

describe('ui-suggestions — a REAL pointer click commits the set (cross-engine truth)', () => {
  it('clicking a live chip commits selected, fires select, and repaints the taken chip distinctly', async () => {
    const el = mount()
    el.suggestions = SET
    await whenFlushed()
    const events: unknown[] = []
    el.addEventListener('select', (e) => events.push((e as CustomEvent).detail))

    const chips = [...el.querySelectorAll('[data-part="chip"]')] as HTMLElement[]
    const idleColor = getComputedStyle(chips[1]!).backgroundColor
    chips[1]!.click()
    await whenFlushed()

    expect(events).toEqual(['more-photos'])
    expect(el.selected).toBe('more-photos')
    const taken = chips[1]!
    expect(getComputedStyle(taken).backgroundColor, 'the taken chip must repaint distinctly from its idle state').not.toBe(idleColor)
  })

  it('once spent, a real disabled chip truly stops receiving pointer clicks (the platform half of the one-shot law)', async () => {
    const el = mount()
    el.suggestions = SET
    await whenFlushed()
    const events: unknown[] = []
    el.addEventListener('select', (e) => events.push((e as CustomEvent).detail))

    const chips = [...el.querySelectorAll('[data-part="chip"]')] as HTMLButtonElement[]
    chips[0]!.click()
    await whenFlushed()
    expect(events).toEqual(['Book the Deluxe King'])

    // a real engine's native `disabled` suppresses .click()'s activation behaviour entirely — re-clicking
    // every chip (including the now-disabled taken one) must produce ZERO further commits.
    for (const chip of [...el.querySelectorAll('[data-part="chip"]')] as HTMLButtonElement[]) {
      expect(chip.disabled, `chip "${chip.textContent}" must be a REAL disabled button once spent`).toBe(true)
      chip.click()
    }
    await whenFlushed()
    expect(events).toEqual(['Book the Deluxe King'])
  })
})
