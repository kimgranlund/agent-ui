import { describe, it, expect, afterEach } from 'vitest'
import '@agent-ui/components/foundation-styles.css'
import './swiper.css'
import './swiper.ts'
import { resolve } from '../../../../../../scripts/lib/foundations-model.mjs'

// ui-swiper geometry (ADR-0245 clause 3, dark launch): the paddle band is 4n. Outside an opt-in region the derived tokens are
// undefined and the token resolves to today's ramp read (28), so default pages do not move.

const mounted: HTMLElement[] = []
afterEach(() => mounted.splice(0).forEach((el) => el.remove()))

/** The length a --ui-swiper-* token resolves to at the control (a probe child reads it as a block-size). */
function token(html: string): number {
  const wrap = document.createElement('div')
  wrap.innerHTML = html
  document.body.append(wrap)
  mounted.push(wrap)
  const probe = document.createElement('div')
  probe.style.blockSize = 'var(--ui-swiper-paddle-band)'
  wrap.querySelector('ui-swiper')!.append(probe)
  return probe.getBoundingClientRect().height
}

describe('ui-swiper geometry inside an opt-in region', () => {
  for (const scale of ['sm', 'md'] as const) {
    it(`product / ${scale}: --ui-swiper-paddle-band is the 4n paddle band`, () => {
      const r = resolve('product', scale, 'md')
      expect(token(`<div data-tier="product" data-scale="${scale}"><ui-swiper></ui-swiper></div>`)).toBe(r.height)
    })
  }
})

describe('ui-swiper geometry under data-foundations=legacy (the clause 10e rollback)', () => {
  it('--ui-swiper-paddle-band is 28', () => {
    expect(token('<div data-foundations="legacy"><ui-swiper></ui-swiper></div>')).toBe(28)
  })
})
