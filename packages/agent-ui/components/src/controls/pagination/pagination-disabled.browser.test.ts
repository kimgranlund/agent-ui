import { describe, it, expect, afterEach } from 'vitest'

// The fleet disabled recipe (T-0139) as pagination shows it: an out-of-range Previous stop is a disabled
// ghost ui-button, which must stay unfilled (never a grey pill beside the current page) and read quieter
// than the enabled Next stop. Measured as painted (button/disabled-recipe.fixture.ts), in both schemes.
import '@agent-ui/components/foundation-styles.css'
import '../button/button.css'
import './pagination.css'
import '../button/button.ts'
import './pagination.ts'
import { SCHEMES, alphaOf, inkContrast, schemeWrap } from '../button/disabled-recipe.fixture.ts'

const mounted: HTMLElement[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

const labelContrast = (page: string, el: HTMLElement): number => {
  const cs = getComputedStyle(el)
  return inkContrast(page, [cs.backgroundColor], cs.color)
}

describe('ui-pagination: the fleet disabled recipe (T-0139)', () => {
  for (const scheme of SCHEMES) {
    it(`${scheme}: the disabled Previous stop is unfilled and reads below the enabled Next stop`, () => {
      const { wrap, page } = schemeWrap(scheme, '<ui-pagination label="Results" page="1" pages="3"></ui-pagination>')
      mounted.push(wrap)
      const prev = wrap.querySelector("ui-button[data-part='prev']") as HTMLElement
      const next = wrap.querySelector("ui-button[data-part='next']") as HTMLElement
      expect(prev.hasAttribute('disabled')).toBe(true)
      expect(next.hasAttribute('disabled')).toBe(false)
      expect(alphaOf(getComputedStyle(prev).backgroundColor), 'a disabled ghost stop must not paint a fill').toBeLessThan(0.01)
      const a = labelContrast(page, next)
      const b = labelContrast(page, prev)
      expect(b, `disabled Previous ${b.toFixed(2)}:1 vs enabled Next ${a.toFixed(2)}:1`).toBeLessThan(a)
    })
  }
})
