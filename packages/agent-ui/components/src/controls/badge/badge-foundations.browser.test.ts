import { describe, it, expect, afterEach } from 'vitest'
import { resolve } from '../../../../shared/src/tokens/scale.mjs'
import '@agent-ui/components/foundation-styles.css'
import './badge.css'
import './badge.ts'

// ui-badge geometry under ADR-0245 (the dark launch): inside an opt-in [data-tier] region the control reads the
// derived tokens and measures against scale.mjs resolve(); outside one it still measures today's values.

const mounted: HTMLElement[] = []
afterEach(() => mounted.splice(0).forEach((el) => el.remove()))

function mount(html: string, region = true): HTMLElement {
  const wrap = document.createElement('div')
  if (region) {
    wrap.setAttribute('data-tier', 'product')
    wrap.setAttribute('data-scale', 'sm')
  }
  wrap.innerHTML = html
  document.body.append(wrap)
  mounted.push(wrap)
  return wrap
}

const px = (v: string): number => Number.parseFloat(v)
const root = resolve('product', 'sm', 'md')

describe('ui-badge geometry (ADR-0245 cl.3)', () => {
  it('inside a region: height 2n, padding 2c, radius n/2, field-label type, glyph box 2n - 2c', () => {
    const badge = mount('<ui-badge intent="success">New</ui-badge>').querySelector('ui-badge') as HTMLElement
    const cs = getComputedStyle(badge)
    expect(badge.getBoundingClientRect().height).toBeCloseTo(root.icon, 1)
    expect(px(cs.paddingLeft)).toBeCloseTo(2 * root.c, 1)
    expect(px(cs.borderTopLeftRadius)).toBeCloseTo(root.radius / 2, 1)
    expect(px(cs.fontSize)).toBeCloseTo(root.type.fieldLabel, 1)
    const glyph = badge.querySelector('[data-part="glyph"]') as HTMLElement
    expect(glyph.getBoundingClientRect().width).toBeCloseTo(root.glyph, 1)
  })

  it("outside any region: today's 18px compact box, pill radius and 8.75px pad", () => {
    const badge = mount('<ui-badge intent="success">New</ui-badge>', false).querySelector('ui-badge') as HTMLElement
    const cs = getComputedStyle(badge)
    expect(badge.getBoundingClientRect().height).toBe(18)
    expect(px(cs.paddingLeft)).toBeCloseTo(8.75, 2)
    expect(px(cs.borderTopLeftRadius)).toBe(9)
    expect(px(cs.fontSize)).toBe(13)
    expect((badge.querySelector('[data-part="glyph"]') as HTMLElement).getBoundingClientRect().width).toBe(9)
  })
})
