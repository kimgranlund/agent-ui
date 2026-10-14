import { describe, it, expect, afterEach } from 'vitest'

// The fleet disabled recipe (T-0139): a disabled button keeps its variant's silhouette and drops to the
// low-emphasis container and ink, so it is always quieter than every enabled sibling. Measured as painted
// (disabled-recipe.fixture.ts), in both schemes.
import '@agent-ui/components/foundation-styles.css'
import './button.css'
import './button.ts'
import { SCHEMES, alphaOf, inkContrast, schemeWrap } from './disabled-recipe.fixture.ts'

const mounted: HTMLElement[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

const VARIANTS = ['solid', 'soft', 'ghost'] as const
const markup = VARIANTS.map((v) => `<ui-button variant="${v}">Save</ui-button><ui-button variant="${v}" disabled>Save</ui-button>`).join('')

const labelContrast = (page: string, el: HTMLElement): number => {
  const cs = getComputedStyle(el)
  return inkContrast(page, [cs.backgroundColor], cs.color)
}

describe('ui-button: the fleet disabled recipe (T-0139)', () => {
  for (const scheme of SCHEMES) {
    it(`${scheme}: each disabled variant reads below the same variant enabled and below the quietest enabled button`, () => {
      const { wrap, page } = schemeWrap(scheme, markup)
      mounted.push(wrap)
      const buttons = [...wrap.querySelectorAll('ui-button')] as HTMLElement[]
      const enabled = buttons.filter((b) => !b.hasAttribute('disabled'))
      const quietest = Math.min(...enabled.map((b) => labelContrast(page, b)))
      for (const v of VARIANTS) {
        const on = labelContrast(page, wrap.querySelector(`ui-button[variant='${v}']:not([disabled])`) as HTMLElement)
        const off = labelContrast(page, wrap.querySelector(`ui-button[variant='${v}'][disabled]`) as HTMLElement)
        expect(off, `${v} disabled ${off.toFixed(2)}:1 vs enabled ${on.toFixed(2)}:1`).toBeLessThan(on)
        expect(off, `${v} disabled ${off.toFixed(2)}:1 vs quietest enabled ${quietest.toFixed(2)}:1`).toBeLessThan(quietest)
      }
    })
  }

  it('a disabled ghost keeps its transparent silhouette (no fill), so a disabled pager stop never reads as pressed', () => {
    const { wrap } = schemeWrap('light', '<ui-button variant="ghost" disabled>Previous</ui-button>')
    mounted.push(wrap)
    expect(alphaOf(getComputedStyle(wrap.firstElementChild as HTMLElement).backgroundColor)).toBeLessThan(0.01)
  })
})
