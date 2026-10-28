import { describe, it, expect, afterEach } from 'vitest'
import { glyphBox } from '../../../../../../scripts/lib/foundations-rules.mjs' // the glyph box n + 6 (T-0374)
import { resolve } from '../../../../../../scripts/lib/foundations-model.mjs' // the model the sheet mirrors
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/all.css'
import '@agent-ui/components/all'
import '@agent-ui/icons/phosphor'

// ui-timeline-item and ui-status-stream geometry (ADR-0245 clauses 3 and 4, dark launch): inside an opt-in region
// the marker box is max(2n, n + 6) (the 2n icon slot grown to hold the dot at n 4 and 5, T-0374) and the dot the n + 6
// glyph box at the item's own size, and the status
// stream's header marker reads the same two tokens so the rail still aligns; outside one the [scale] rows (covered by
// timeline-item.browser.test.ts) and the stream's literal mirror (16 / 8) answer exactly as before.

const mounted: HTMLElement[] = []
afterEach(() => mounted.splice(0).forEach((el) => el.remove()))

function mount(html: string): HTMLElement {
  const wrap = document.createElement('div')
  wrap.innerHTML = html
  document.body.append(wrap)
  mounted.push(wrap)
  return wrap
}

const px = (v: string): number => Number.parseFloat(v)
const markerBox = (item: Element): number => px(getComputedStyle(item.querySelector('[data-part="marker"]')!).width)
const dotSize = (item: Element): number => px(getComputedStyle(item.querySelector('[data-part="marker"]')!, '::before').width)

/** What a stream's own header-marker tokens resolve to at the stream (a probe child reads them as lengths). */
function streamTokens(stream: HTMLElement): { box: number; dot: number } {
  const probe = document.createElement('div')
  probe.style.cssText = 'inline-size: var(--ui-status-stream-header-marker-box); block-size: var(--ui-status-stream-header-dot-size)'
  stream.append(probe)
  const out = { box: probe.getBoundingClientRect().width, dot: probe.getBoundingClientRect().height }
  probe.remove()
  return out
}

describe('ui-timeline-item geometry inside an opt-in region', () => {
  for (const size of ['sm', 'md', 'lg'] as const) {
    it(`product / sm / ${size}: marker box max(2n, n + 6), dot n + 6`, () => {
      const wrap = mount(`<div data-tier="product" data-scale="sm"><ui-timeline-item size="${size}"></ui-timeline-item></div>`)
      const item = wrap.querySelector('ui-timeline-item')!
      const r = resolve('product', 'sm', size)
      expect(markerBox(item)).toBe(Math.max(r.iconBox, glyphBox(r)))
      expect(dotSize(item)).toBe(glyphBox(r))
    })
  }

  it('the status stream header marker reads the same boxes as the item at the same size', () => {
    const wrap = mount(
      `<div data-tier="product" data-scale="sm"><ui-status-stream></ui-status-stream><ui-timeline-item size="md"></ui-timeline-item></div>`,
    )
    const r = resolve('product', 'sm', 'md')
    const box = Math.max(r.iconBox, glyphBox(r))
    expect(streamTokens(wrap.querySelector('ui-status-stream') as HTMLElement)).toEqual({ box, dot: glyphBox(r) })
    expect(markerBox(wrap.querySelector('ui-timeline-item')!)).toBe(box)
  })

  // T-0374: the dot stays n + 6 and the marker box grows to hold it (the skill's wrapper never shrinks the artwork), so
  // on every cell the plain dot sits inside the marker part, centred. Oracle: the model's resolve(), which mirrors the sheet.
  it('the n plus 6 mark stays inside its box on every cell', () => {
    let cells = 0
    for (const tier of ['widget', 'product', 'content', 'brand'] as const) for (const scale of ['sm', 'md', 'lg'] as const) for (const size of ['sm', 'md', 'lg'] as const) {
      const at = `${tier} / ${scale} / ${size}`
      const r = resolve(tier, scale, size)
      const wrap = mount(`<div data-tier="${tier}" data-scale="${scale}"><ui-timeline-item size="${size}" label="Step"></ui-timeline-item></div>`)
      const part = wrap.querySelector('[data-part="marker"]') as HTMLElement
      const mark = getComputedStyle(part, '::before')
      const side = part.getBoundingClientRect().width
      const start = px(mark.left)
      const end = start + px(mark.width)
      expect(px(mark.width), `${at}: the dot is n + 6`).toBeCloseTo(r.glyphBox, 1)
      expect(side, `${at}: the marker box is max(2n, n + 6)`).toBe(Math.max(r.iconBox, r.glyphBox))
      expect(start, `${at}: the dot starts inside the box`).toBeGreaterThanOrEqual(-0.05)
      expect(end, `${at}: the dot ends inside the box`).toBeLessThanOrEqual(side + 0.05)
      expect(Math.abs(start - (side - end)), `${at}: the dot is centred`).toBeLessThanOrEqual(0.5)
      expect(px(mark.height), `${at}: the dot's block size fits the box`).toBeLessThanOrEqual(side)
      wrap.remove()
      cells++
    }
    expect(cells).toBe(36)
  })
})

describe('ui-timeline-item geometry under data-foundations=legacy (the clause 10e rollback)', () => {
  it('the default register is 16 / 8 at md, and the stream mirrors it', () => {
    const wrap = mount(`<div data-foundations="legacy"><ui-status-stream></ui-status-stream><ui-timeline-item size="md"></ui-timeline-item></div>`)
    const item = wrap.querySelector('ui-timeline-item')!
    expect(markerBox(item)).toBe(16)
    expect(dotSize(item)).toBe(8)
    expect(streamTokens(wrap.querySelector('ui-status-stream') as HTMLElement)).toEqual({ box: 16, dot: 8 })
  })
})
