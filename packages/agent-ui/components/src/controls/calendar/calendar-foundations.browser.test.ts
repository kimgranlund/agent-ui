import { describe, it, expect, afterEach } from 'vitest'
import { resolve } from '../../../../shared/src/tokens/scale.mjs'
import '@agent-ui/components/foundation-styles.css'
import './calendar.css'
import './calendar.ts'

// ui-calendar geometry (ADR-0245 clause 3, dark launch): the day cell is 4n tall. Outside an opt-in region the derived tokens are
// undefined and the token resolves to today's ramp read (28), so default pages do not move.

const mounted: HTMLElement[] = []
afterEach(() => mounted.splice(0).forEach((el) => el.remove()))

/** The length a --ui-calendar-* token resolves to at the control (a probe child reads it as a block-size). */
function token(html: string): number {
  const wrap = document.createElement('div')
  wrap.innerHTML = html
  document.body.append(wrap)
  mounted.push(wrap)
  const probe = document.createElement('div')
  probe.style.blockSize = 'var(--ui-calendar-cell-size)'
  wrap.querySelector('ui-calendar')!.append(probe)
  return probe.getBoundingClientRect().height
}

describe('ui-calendar geometry inside an opt-in region', () => {
  for (const scale of ['sm', 'md'] as const) {
    it(`product / ${scale}: --ui-calendar-cell-size is the 4n cell`, () => {
      const r = resolve('product', scale, 'md')
      expect(token(`<div data-tier="product" data-scale="${scale}"><ui-calendar></ui-calendar></div>`)).toBe(r.h)
    })
  }
})

describe('ui-calendar geometry under data-foundations=legacy (the clause 10e rollback)', () => {
  it('--ui-calendar-cell-size is 28', () => {
    expect(token('<div data-foundations="legacy"><ui-calendar></ui-calendar></div>')).toBe(28)
  })
})
