import { describe, it, expect, afterEach } from 'vitest'
import '@agent-ui/components/foundation-styles.css'
import './drill.css'
import './drill.ts'
import { resolve } from '../../../../../../scripts/lib/foundations-model.mjs'

// ui-drill geometry (ADR-0245 clause 3, dark launch): the header row is 4n tall. Outside an opt-in region the derived tokens are
// undefined and the token resolves to today's ramp read (28), so default pages do not move.

const mounted: HTMLElement[] = []
afterEach(() => mounted.splice(0).forEach((el) => el.remove()))

/** The length a --ui-drill-* token resolves to at the control (a probe child reads it as a block-size). */
function token(html: string): number {
  const wrap = document.createElement('div')
  wrap.innerHTML = html
  document.body.append(wrap)
  mounted.push(wrap)
  const probe = document.createElement('div')
  probe.style.blockSize = 'var(--ui-drill-header-height)'
  wrap.querySelector('ui-drill')!.append(probe)
  return probe.getBoundingClientRect().height
}

describe('ui-drill geometry inside an opt-in region', () => {
  for (const scale of ['sm', 'md'] as const) {
    it(`product / ${scale}: --ui-drill-header-height is the 4n header`, () => {
      const r = resolve('product', scale, 'md')
      expect(token(`<div data-tier="product" data-scale="${scale}"><ui-drill></ui-drill></div>`)).toBe(r.height)
    })
  }
})

describe('ui-drill geometry under data-foundations=legacy (the clause 10e rollback)', () => {
  it('--ui-drill-header-height is 28', () => {
    expect(token('<div data-foundations="legacy"><ui-drill></ui-drill></div>')).toBe(28)
  })
})
