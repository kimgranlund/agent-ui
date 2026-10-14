import { describe, it, expect, afterEach } from 'vitest'

// The fleet disabled recipe (T-0139): a disabled checkbox keeps its box (an outline-variant border), the
// checked fill drops to the low-emphasis container and the mark to the low-emphasis ink, so the box never
// vanishes and the mark is quieter than the enabled one. Measured as painted (button/disabled-recipe.fixture.ts).
import '@agent-ui/components/foundation-styles.css'
import './checkbox.css'
import './checkbox.ts'
import { SCHEMES, composite, contrast, inkContrast, schemeWrap } from '../button/disabled-recipe.fixture.ts'

const mounted: HTMLElement[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

const markContrast = (page: string, el: HTMLElement): number =>
  inkContrast(page, [getComputedStyle(el, '::before').backgroundColor], getComputedStyle(el, '::after').backgroundColor)

describe('ui-checkbox: the fleet disabled recipe (T-0139)', () => {
  for (const scheme of SCHEMES) {
    it(`${scheme}: the disabled checked mark reads below the enabled checked mark`, () => {
      const { wrap, page } = schemeWrap(scheme, '<ui-checkbox checked>A</ui-checkbox><ui-checkbox checked disabled>A</ui-checkbox>')
      mounted.push(wrap)
      const [en, dis] = [...wrap.querySelectorAll('ui-checkbox')] as HTMLElement[]
      const a = markContrast(page, en)
      const b = markContrast(page, dis)
      expect(b, `disabled mark ${b.toFixed(2)}:1 vs enabled ${a.toFixed(2)}:1`).toBeLessThan(a)
    })

    it(`${scheme}: the disabled box keeps a visible border (at least 1.3:1 against the surface), checked or not`, () => {
      const { wrap, page } = schemeWrap(scheme, '<ui-checkbox disabled>A</ui-checkbox><ui-checkbox checked disabled>A</ui-checkbox>')
      mounted.push(wrap)
      for (const el of [...wrap.querySelectorAll('ui-checkbox')] as HTMLElement[]) {
        const box = getComputedStyle(el, '::before')
        const edge = contrast(composite(page, box.backgroundColor, box.borderTopColor), composite(page))
        expect(edge, `disabled box edge ${edge.toFixed(2)}:1`).toBeGreaterThanOrEqual(1.3)
      }
    })
  }
})
