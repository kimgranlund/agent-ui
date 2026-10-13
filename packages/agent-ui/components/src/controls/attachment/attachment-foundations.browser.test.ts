import { describe, it, expect, afterEach } from 'vitest'
import { resolve } from '../../../../shared/src/tokens/scale.mjs'
import '@agent-ui/components/foundation-styles.css'
import '../icon/icon.css'
import './attachment.css'
import './attachment.ts'

// ui-attachment geometry under ADR-0245 (the dark launch): inside an opt-in [data-tier] region the control reads the
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

const CARD = '<ui-attachment filename="plan.pdf" mime-type="application/pdf" size-bytes="2048"></ui-attachment>'

describe('ui-attachment geometry (ADR-0245 cl.3, cl.4 and cl.7)', () => {
  it('inside a region: radius n, the icon is the 2n box and the name is the field-label role', () => {
    const el = mount(CARD).querySelector('ui-attachment') as HTMLElement
    expect(px(getComputedStyle(el).borderTopLeftRadius)).toBeCloseTo(root.radius, 1)
    const icon = el.querySelector('ui-icon') as HTMLElement
    expect(icon.getBoundingClientRect().width).toBeCloseTo(root.icon, 1)
    const name = el.querySelector('[data-part="name"]') as HTMLElement
    expect(px(getComputedStyle(name).fontSize)).toBeCloseTo(root.type.fieldLabel, 1)
  })

  it('outside any region: the 12px corner base, the 18px icon register and the 12px label', () => {
    const el = mount(CARD, false).querySelector('ui-attachment') as HTMLElement
    expect(px(getComputedStyle(el).borderTopLeftRadius)).toBe(12)
    expect((el.querySelector('ui-icon') as HTMLElement).getBoundingClientRect().width).toBe(18)
    expect(px(getComputedStyle(el.querySelector('[data-part="name"]') as HTMLElement).fontSize)).toBe(12)
  })
})
