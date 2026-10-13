import { describe, it, expect, afterEach } from 'vitest'
import { resolve } from '../../../../shared/src/tokens/scale.mjs'
import '@agent-ui/components/foundation-styles.css'
import './sparkline.css'
import './sparkline.ts'

// ui-sparkline geometry under ADR-0245 (the dark launch): inside an opt-in [data-tier] region the control reads the
// derived tokens and measures against scale.mjs resolve(); outside one it still measures today's values.

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

describe('ui-sparkline stroke (ADR-0245 cl.5: the mark stroke max(1.5px, c/2))', () => {
  it('inside a region the line stroke is the glyph stroke (c = 4 at content / lg / lg, so 2px)', () => {
    const wrap = document.createElement('div')
    wrap.setAttribute('data-tier', 'content')
    wrap.setAttribute('data-scale', 'lg')
    wrap.setAttribute('data-size', 'lg') // c is 3 at content / lg / md (stroke floors at 1.5px); the lg step is the first with c = 4
    wrap.innerHTML = '<ui-sparkline values="[1,3,2,4]"></ui-sparkline>'
    document.body.append(wrap)
    mounted.push(wrap)
    const r = resolve('content', 'lg', 'lg')
    const line = wrap.querySelector('[data-part="line"]') as SVGElement
    expect(px(getComputedStyle(line).strokeWidth)).toBe(Math.max(1.5, r.c / 2))
    expect(Math.max(1.5, r.c / 2)).toBe(2)
  })

  it('under data-foundations=legacy the stroke stays 1.5px', () => {
    const line = mount('<ui-sparkline values="[1,3,2,4]"></ui-sparkline>', false).querySelector(
      '[data-part="line"]',
    ) as SVGElement
    expect(px(getComputedStyle(line).strokeWidth)).toBe(1.5)
  })
})
