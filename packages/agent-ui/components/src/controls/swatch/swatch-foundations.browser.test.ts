import { describe, it, expect, afterEach } from 'vitest'
import { resolve } from '../../../../../../scripts/lib/foundations-model.mjs' // the radii at the balanced preset (T-0374 step 6)
import '@agent-ui/components/foundation-styles.css'
import './swatch.css'
import './swatch.ts'

// ui-swatch geometry under ADR-0245 (the dark launch): inside an opt-in [data-tier] region the control reads the
// derived tokens and measures against the model's resolve(); outside one it still measures today's values.

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

describe('ui-swatch geometry (ADR-0245 cl.3)', () => {
  const box = (wrap: HTMLElement): HTMLElement => wrap.querySelector('[data-part="box"]') as HTMLElement

  it('inside a region the chip radius is the surface radius A x n (T-0374 step 6)', () => {
    const wrap = mount('<ui-swatch color="#336699" label="Brand"></ui-swatch>')
    expect(px(getComputedStyle(box(wrap)).borderTopLeftRadius)).toBeCloseTo(root.radius, 1)
  })

  it('under data-foundations=legacy the chip radius is the 12px corner base', () => {
    const wrap = mount('<ui-swatch color="#336699" label="Brand"></ui-swatch>', false)
    expect(px(getComputedStyle(box(wrap)).borderTopLeftRadius)).toBe(12)
  })
})
