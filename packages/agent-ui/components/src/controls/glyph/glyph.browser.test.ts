import { describe, it, expect, afterEach } from 'vitest'
import { glyphBox } from '../../../../../../scripts/lib/foundations-rules.mjs' // the glyph box n + 6 (T-0374)
import '@agent-ui/components/foundation-styles.css'
import './glyph.css'
import './glyph.ts'
import '../disclosure/disclosure.css' // the rotated-caret consumer of the rtl mirror (T-0539)
import '../disclosure/disclosure.ts'
import type { UIGlyphElement } from './glyph.ts'
import { resolve } from '../../../../../../scripts/lib/foundations-model.mjs'

// ui-glyph geometry (ADR-0245 clause 4, T-0374): inside an opt-in region the host is the square 3n glyph slot and the
// svg is the glyph box n + 6 centred in it, both against foundations-model.mjs resolve() at the library root (product / sm) for sm, md and lg
// and at product / md, one data-scale up; outside a region the em fallbacks hold.

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
      it(`product / ${scale} / ${size}: slot 3n, mark n + 6, stroke max(1.5px, c/2)`, async () => {
        const host = await mount(
          `<div data-tier="product" data-scale="${scale}"><span data-size="${size}"><ui-glyph symbol="check"></ui-glyph></span></div>`,
        )
        const r = resolve('product', scale, size)
        expect(glyphBox(r), 'the glyph box (T-0374)').toBe(r.n + 6)
        expect(boxOf(host)).toEqual({ w: 3 * r.n, h: 3 * r.n })
        expect(boxOf(host.querySelector('svg') as SVGSVGElement)).toEqual({ w: glyphBox(r), h: glyphBox(r) })
        expect(parseFloat(getComputedStyle(host.querySelector('path') as SVGPathElement).strokeWidth)).toBe(
          Math.max(1.5, r.c / 2),
        )
      })
    }
  }
  // T-0374 merge-queue find: text-field's stepper put the glyph in a 2n inline-flex button, the slot shrank to 2n
  // while its inset stayed (3n - (n + 6)) / 2, and the mark rendered 6px wide. The slot never shrinks as a flex item.
  it('a flex cell narrower than the slot never squeezes the n + 6 mark', async () => {
    const host = await mount(
      `<div data-tier="product" data-scale="md"><span data-size="md" style="display:inline-flex;justify-content:center;inline-size:16px"><ui-glyph symbol="minus"></ui-glyph></span></div>`,
    )
    const r = resolve('product', 'md', 'md')
    expect(boxOf(host)).toEqual({ w: 3 * r.n, h: 3 * r.n })
    expect(boxOf(host.querySelector('svg')!)).toEqual({ w: glyphBox(r), h: glyphBox(r) })
  })
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

// T-0539: an inline-axis caret mirrors under dir=rtl, so a prev/next or collapsed caret points the way the
// reading direction runs. The pointing vector is composed from every computed transform between the svg and
// the host (CSS order: translate, rotate, scale, then transform), so a consumer's own rotation is included.
function pointing(svg: Element, host: Element, intrinsic: readonly [number, number]): [number, number] {
  let m = new DOMMatrix()
  for (let el: Element | null = svg; el; el = el.parentElement) {
    const cs = getComputedStyle(el)
    const local = new DOMMatrix()
    if (cs.rotate !== 'none') local.rotateSelf(parseFloat(cs.rotate.split(' ').pop()!))
    if (cs.scale !== 'none') {
      const [sx, sy] = cs.scale.split(' ').map(Number)
      local.scaleSelf(sx, sy ?? sx)
    }
    if (cs.transform !== 'none') local.multiplySelf(new DOMMatrix(cs.transform))
    m = local.multiply(m)
    if (el === host) break
  }
  const p = m.transformPoint(new DOMPoint(intrinsic[0], intrinsic[1]))
  const o = m.transformPoint(new DOMPoint(0, 0))
  return [Math.round(p.x - o.x), Math.round(p.y - o.y)]
}

describe('ui-glyph under dir=rtl: inline-axis carets mirror (T-0539)', () => {
  it('caret-left and caret-right point the other way under rtl and keep their own way under ltr', async () => {
    for (const dir of ['ltr', 'rtl'] as const) {
      const sign = dir === 'rtl' ? -1 : 1
      for (const [symbol, x] of [['caret-left', -1], ['caret-right', 1]] as const) {
        const host = await mount(`<div dir="${dir}"><ui-glyph symbol="${symbol}"></ui-glyph></div>`)
        expect(pointing(host.querySelector('svg')!, host, [x, 0]), `${dir} ${symbol}`).toEqual([x * sign, 0])
      }
    }
  })

  it('caret-up and caret-down never mirror (the block axis does not flip)', async () => {
    for (const symbol of ['caret-up', 'caret-down']) {
      const host = await mount(`<div dir="rtl"><ui-glyph symbol="${symbol}"></ui-glyph></div>`)
      expect(getComputedStyle(host.querySelector('svg')!).transform, symbol).toBe('none')
      expect(getComputedStyle(host.querySelector('svg')!).scale, symbol).toBe('none')
    }
  })

  it('a ui-disclosure chevron points toward the text when closed and down when open, in both directions', async () => {
    for (const dir of ['ltr', 'rtl'] as const) {
      const wrap = document.createElement('div')
      wrap.dir = dir
      wrap.innerHTML = '<ui-disclosure summary="Details"><p>Body</p></ui-disclosure>'
      document.body.append(wrap)
      mounted.push(wrap)
      const host = wrap.querySelector('ui-disclosure') as HTMLElement & { open: boolean; updateComplete: Promise<void> }
      await host.updateComplete
      const chevron = host.querySelector('[data-part="chevron"]')!
      const svg = chevron.querySelector('svg')!
      expect(pointing(svg, chevron, [1, 0]), `${dir} closed: toward the inline end`).toEqual([dir === 'rtl' ? -1 : 1, 0])
      host.open = true
      await host.updateComplete
      expect(pointing(svg, chevron, [1, 0]), `${dir} open: down`).toEqual([0, 1])
    }
  })
})
