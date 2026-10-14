import { describe, it, expect, afterEach } from 'vitest'

// The fleet disabled recipe (T-0139): a disabled switch keeps its track (an outline-variant edge over the
// low-emphasis container), its thumb drops to the low-emphasis ink, and locked on still differs from
// locked off. Measured as painted (button/disabled-recipe.fixture.ts), in both schemes.
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/all.css'
import '@agent-ui/components/all'
import { SCHEMES, composite, contrast, inkContrast, schemeWrap } from '../button/disabled-recipe.fixture.ts'

const mounted: HTMLElement[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

const thumbContrast = (page: string, sw: HTMLElement): number =>
  inkContrast(page, [getComputedStyle(sw, '::before').backgroundColor], getComputedStyle(sw, '::after').backgroundColor)

describe('ui-switch: the fleet disabled recipe (T-0139)', () => {
  for (const scheme of SCHEMES) {
    it(`${scheme}: the disabled thumb reads below the same state enabled, off and on`, () => {
      const { wrap, page } = schemeWrap(scheme, '<ui-switch></ui-switch><ui-switch disabled></ui-switch><ui-switch checked></ui-switch><ui-switch checked disabled></ui-switch>')
      mounted.push(wrap)
      const [off, offLocked, on, onLocked] = [...wrap.querySelectorAll('ui-switch')] as HTMLElement[]
      for (const [label, en, dis] of [['off', off, offLocked], ['on', on, onLocked]] as const) {
        const a = thumbContrast(page, en)
        const b = thumbContrast(page, dis)
        expect(b, `${label}: disabled thumb ${b.toFixed(2)}:1 vs enabled ${a.toFixed(2)}:1`).toBeLessThan(a)
      }
    })

    it(`${scheme}: the disabled track stays visible (edge at least 1.3:1 against the surface) and locked on differs from locked off`, () => {
      const { wrap, page } = schemeWrap(scheme, '<ui-switch disabled></ui-switch><ui-switch checked disabled></ui-switch>')
      mounted.push(wrap)
      const [offLocked, onLocked] = [...wrap.querySelectorAll('ui-switch')] as HTMLElement[]
      for (const sw of [offLocked, onLocked]) {
        const track = getComputedStyle(sw, '::before')
        // A zero-width border still computes a colour (currentColor), so only a painted border counts.
        const border = Number.parseFloat(track.borderTopWidth) > 0 ? [track.borderTopColor] : []
        const edge = contrast(composite(page, track.backgroundColor, ...border), composite(page))
        expect(edge, `disabled track edge ${edge.toFixed(2)}:1`).toBeGreaterThanOrEqual(1.3)
      }
      expect(getComputedStyle(onLocked, '::before').backgroundColor, 'locked on must not paint the locked-off track').not.toBe(getComputedStyle(offLocked, '::before').backgroundColor)
    })
  }
})
