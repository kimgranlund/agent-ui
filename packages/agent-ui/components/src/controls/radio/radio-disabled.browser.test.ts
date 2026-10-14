import { describe, it, expect, afterEach } from 'vitest'

// The fleet disabled recipe (T-0139): a disabled radio keeps its ring at outline-variant, the checked fill
// drops to the low-emphasis container and the dot to the low-emphasis ink, so a locked checked radio is
// quieter than the enabled one, in light and in dark. Measured as painted (button/disabled-recipe.fixture.ts).
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/all.css'
import '@agent-ui/components/all'
import { SCHEMES, composite, contrast, inkContrast, schemeWrap } from '../button/disabled-recipe.fixture.ts'

const mounted: HTMLElement[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

const dotContrast = (page: string, el: HTMLElement): number =>
  inkContrast(page, [getComputedStyle(el, '::before').backgroundColor], getComputedStyle(el, '::after').backgroundColor)

describe('ui-radio: the fleet disabled recipe (T-0139)', () => {
  for (const scheme of SCHEMES) {
    it(`${scheme}: the disabled checked dot reads below the enabled checked dot, and the disc is no louder than enabled`, () => {
      const { wrap, page } = schemeWrap(scheme, '<ui-radio checked>A</ui-radio><ui-radio checked disabled>A</ui-radio>')
      mounted.push(wrap)
      const [en, dis] = [...wrap.querySelectorAll('ui-radio')] as HTMLElement[]
      const a = dotContrast(page, en)
      const b = dotContrast(page, dis)
      expect(b, `disabled dot ${b.toFixed(2)}:1 vs enabled ${a.toFixed(2)}:1`).toBeLessThan(a)
      const disc = (el: HTMLElement): number => contrast(composite(page, getComputedStyle(el, '::before').backgroundColor), composite(page))
      expect(disc(dis), `disabled disc ${disc(dis).toFixed(2)}:1 vs enabled ${disc(en).toFixed(2)}:1`).toBeLessThan(disc(en))
    })

    it(`${scheme}: the disabled ring stays visible (at least 1.3:1 against the surface), checked or not`, () => {
      const { wrap, page } = schemeWrap(scheme, '<ui-radio disabled>A</ui-radio><ui-radio checked disabled>A</ui-radio>')
      mounted.push(wrap)
      for (const el of [...wrap.querySelectorAll('ui-radio')] as HTMLElement[]) {
        const ring = getComputedStyle(el, '::before')
        const edge = contrast(composite(page, ring.backgroundColor, ring.borderTopColor), composite(page))
        expect(edge, `disabled ring edge ${edge.toFixed(2)}:1`).toBeGreaterThanOrEqual(1.3)
      }
    })
  }
})
