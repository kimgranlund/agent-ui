import { describe, it, expect, afterEach } from 'vitest'
import { resolve } from '../../../../shared/src/tokens/scale.mjs'
import '@agent-ui/components/foundation-styles.css'
import '../icon/icon.css'
import './file-drop.css'
import './file-drop.ts'

// ui-file-drop geometry under ADR-0245 (the dark launch): inside an opt-in [data-tier] region the control reads the
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

describe('ui-file-drop geometry (ADR-0245 cl.4, cl.6 and cl.3)', () => {
  it('inside a region: the card radius 3n, the 2n icon and control type', () => {
    const el = mount('<ui-file-drop></ui-file-drop>').querySelector('ui-file-drop') as HTMLElement
    expect(px(getComputedStyle(el).borderTopLeftRadius)).toBeCloseTo(root.card.radius, 1)
    expect(px(getComputedStyle(el).fontSize)).toBeCloseTo(root.type.control, 1)
    const icon = el.querySelector('[data-part="icon"]') as HTMLElement
    expect(icon.getBoundingClientRect().width).toBeCloseTo(root.icon, 1)
  })

  it('outside any region: the 12px corner base, the 14px font and the 18px icon', () => {
    const el = mount('<ui-file-drop></ui-file-drop>', false).querySelector('ui-file-drop') as HTMLElement
    expect(px(getComputedStyle(el).borderTopLeftRadius)).toBe(12)
    expect(px(getComputedStyle(el).fontSize)).toBe(14)
    expect((el.querySelector('[data-part="icon"]') as HTMLElement).getBoundingClientRect().width).toBe(18)
  })
})
