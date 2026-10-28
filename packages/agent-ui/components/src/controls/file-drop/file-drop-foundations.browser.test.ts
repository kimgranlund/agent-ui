import { describe, it, expect, afterEach } from 'vitest'
import { resolve } from '../../../../../../scripts/lib/foundations-model.mjs' // the model the sheet mirrors (T-0506)
import '@agent-ui/components/foundation-styles.css'
import '../icon/icon.css'
import './file-drop.css'
import './file-drop.ts'

// ui-file-drop geometry under ADR-0245 (the dark launch): inside an opt-in [data-tier] region the control reads the
// derived tokens and measures against foundations-model.mjs resolve(); outside one it still measures today's values.

const mounted: HTMLElement[] = []
afterEach(() => mounted.splice(0).forEach((el) => el.remove()))

function mount(html: string, region = true): HTMLElement {
  const wrap = document.createElement('div')
  if (region) {
    wrap.setAttribute('data-tier', 'product')
    wrap.setAttribute('data-scale', 'sm')
  } else {
    wrap.setAttribute('data-foundations', 'legacy') // ADR-0245 cl.10e: the opt-out renders today's geometry
  }
  wrap.innerHTML = html
  document.body.append(wrap)
  mounted.push(wrap)
  return wrap
}

const px = (v: string): number => Number.parseFloat(v)
const root = resolve('product', 'sm', 'md')

describe('ui-file-drop geometry (ADR-0245 cl.4, cl.6 and cl.3)', () => {
  it('inside a region: the card radius A x 3m (T-0374 step 6), the 2n icon and control type', () => {
    const el = mount('<ui-file-drop></ui-file-drop>').querySelector('ui-file-drop') as HTMLElement
    expect(px(getComputedStyle(el).borderTopLeftRadius)).toBeCloseTo(resolve('product', 'sm', 'md').card.radius, 1)
    expect(px(getComputedStyle(el).fontSize)).toBeCloseTo(root.type.control, 1)
    const icon = el.querySelector('[data-part="icon"]') as HTMLElement
    expect(icon.getBoundingClientRect().width).toBeCloseTo(root.iconBox, 1)
  })

  it('under data-foundations=legacy: the 12px corner base, the 14px font and the 18px icon', () => {
    const el = mount('<ui-file-drop></ui-file-drop>', false).querySelector('ui-file-drop') as HTMLElement
    expect(px(getComputedStyle(el).borderTopLeftRadius)).toBe(12)
    expect(px(getComputedStyle(el).fontSize)).toBe(14)
    expect((el.querySelector('[data-part="icon"]') as HTMLElement).getBoundingClientRect().width).toBe(18)
  })
})
