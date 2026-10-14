import { describe, it, expect, afterEach } from 'vitest'

// The fleet disabled recipe (T-0139): a disabled toggle keeps its state's silhouette (unpressed stays an
// unfilled outline, now at outline-variant; pressed keeps a low-emphasis container) and its ink drops to the
// low-emphasis role, so it never reads pressed when it is not and is always quieter than enabled. Measured as
// painted (button/disabled-recipe.fixture.ts), in both schemes.
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/all.css'
import '@agent-ui/components/all'
import { SCHEMES, alphaOf, inkContrast, schemeWrap } from '../button/disabled-recipe.fixture.ts'

const mounted: HTMLElement[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

const labelContrast = (page: string, el: HTMLElement): number => {
  const cs = getComputedStyle(el)
  return inkContrast(page, [cs.backgroundColor], cs.color)
}

const MARKUP = '<ui-toggle>A</ui-toggle><ui-toggle disabled>A</ui-toggle><ui-toggle pressed>A</ui-toggle><ui-toggle pressed disabled>A</ui-toggle>'

describe('ui-toggle: the fleet disabled recipe (T-0139)', () => {
  for (const scheme of SCHEMES) {
    it(`${scheme}: disabled ink reads below the same state enabled, unpressed and pressed`, () => {
      const { wrap, page } = schemeWrap(scheme, MARKUP)
      mounted.push(wrap)
      const [idle, idleLocked, pressed, pressedLocked] = [...wrap.querySelectorAll('ui-toggle')] as HTMLElement[]
      for (const [label, en, dis] of [['unpressed', idle, idleLocked], ['pressed', pressed, pressedLocked]] as const) {
        const a = labelContrast(page, en)
        const b = labelContrast(page, dis)
        expect(b, `${label}: disabled ${b.toFixed(2)}:1 vs enabled ${a.toFixed(2)}:1`).toBeLessThan(a)
      }
    })
  }

  it('a disabled unpressed toggle paints the enabled unpressed background (no fill) and keeps a border; locked pressed still differs', () => {
    const { wrap } = schemeWrap('light', MARKUP)
    mounted.push(wrap)
    const [idle, idleLocked, , pressedLocked] = [...wrap.querySelectorAll('ui-toggle')] as HTMLElement[]
    expect(getComputedStyle(idleLocked).backgroundColor).toBe(getComputedStyle(idle).backgroundColor)
    expect(alphaOf(getComputedStyle(idleLocked).borderTopColor), 'the disabled outline must stay painted').toBeGreaterThan(0.1)
    expect(getComputedStyle(pressedLocked).backgroundColor, 'locked pressed must not paint the locked unpressed fill').not.toBe(getComputedStyle(idleLocked).backgroundColor)
  })
})
