import { describe, it, expect, afterEach } from 'vitest'
import { resolve } from '../../../../shared/src/tokens/scale.mjs'
import '@agent-ui/components/foundation-styles.css'
import './glyph.css'
import './glyph.ts'
import type { UIGlyphElement } from './glyph.ts'

// ui-glyph geometry (ADR-0245 clause 4): inside an opt-in region the host is the 2n icon slot and the svg is
// the 2n - 2c mark box, both against scale.mjs resolve() at the library root (product / sm) for sm, md and lg
// and at the A2UI canvas register (data-scale md); outside a region the em fallbacks hold.

const mounted: HTMLElement[] = []
afterEach(() => mounted.splice(0).forEach((el) => el.remove()))

async function mount(html: string): Promise<UIGlyphElement> {
  const wrap = document.createElement('div')
  wrap.innerHTML = html
  document.body.append(wrap)
  mounted.push(wrap)
  const host = wrap.querySelector('ui-glyph') as UIGlyphElement
  await host.updateComplete
  return host
}

const boxOf = (el: Element): { w: number; h: number } => {
  const r = el.getBoundingClientRect()
  return { w: r.width, h: r.height }
}

describe('ui-glyph geometry inside an opt-in region', () => {
  for (const scale of ['sm', 'md'] as const) {
    for (const size of ['sm', 'md', 'lg'] as const) {
      it(`product / ${scale} / ${size}: slot 2n, mark 2n - 2c, stroke max(1.5px, c/2)`, async () => {
        const host = await mount(
          `<div data-tier="product" data-scale="${scale}"><span data-size="${size}"><ui-glyph symbol="check"></ui-glyph></span></div>`,
        )
        const r = resolve('product', scale, size)
        expect(boxOf(host)).toEqual({ w: r.icon, h: r.icon })
        expect(boxOf(host.querySelector('svg') as SVGSVGElement)).toEqual({ w: r.glyph, h: r.glyph })
        expect(parseFloat(getComputedStyle(host.querySelector('path') as SVGPathElement).strokeWidth)).toBe(
          Math.max(1.5, r.c / 2),
        )
      })
    }
  }
})

describe('ui-glyph geometry outside any region (the dark launch)', () => {
  it('under data-foundations=legacy the slot is 1em and the inset 0.125em, so the mark is 0.75em', async () => {
    const host = await mount(
      '<div data-foundations="legacy"><div style="font-size: 16px"><ui-glyph symbol="plus"></ui-glyph></div></div>',
    ) // ADR-0245 cl.10e: the opt-out keeps today's em geometry; a plain page is the derived root register since the cut
    expect(boxOf(host)).toEqual({ w: 16, h: 16 })
    expect(boxOf(host.querySelector('svg') as SVGSVGElement)).toEqual({ w: 12, h: 12 })
  })
})
