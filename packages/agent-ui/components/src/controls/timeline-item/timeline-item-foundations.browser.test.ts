import { describe, it, expect, afterEach } from 'vitest'
import { resolve } from '../../../../shared/src/tokens/scale.mjs'
import { glyphBox } from '../../../../../../scripts/lib/foundations-rules.mjs' // the glyph box floor, local to agent-ui (ADR-0245 Amendment 7)
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/all.css'
import '@agent-ui/components/all'
import '@agent-ui/icons/phosphor'

// ui-timeline-item and ui-status-stream geometry (ADR-0245 clauses 3 and 4, dark launch): inside an opt-in region
// the marker box is the 2n icon slot and the dot the 2n - 2c glyph box at the item's own size, and the status
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
    it(`product / sm / ${size}: marker box 2n, dot 2n - 2c`, () => {
      const wrap = mount(`<div data-tier="product" data-scale="sm"><ui-timeline-item size="${size}"></ui-timeline-item></div>`)
      const item = wrap.querySelector('ui-timeline-item')!
      const r = resolve('product', 'sm', size)
      expect(markerBox(item)).toBe(r.icon)
      expect(dotSize(item)).toBe(glyphBox(r))
    })
  }

  it('the status stream header marker reads the same boxes as the item at the same size', () => {
    const wrap = mount(
      `<div data-tier="product" data-scale="sm"><ui-status-stream></ui-status-stream><ui-timeline-item size="md"></ui-timeline-item></div>`,
    )
    const r = resolve('product', 'sm', 'md')
    expect(streamTokens(wrap.querySelector('ui-status-stream') as HTMLElement)).toEqual({ box: r.icon, dot: glyphBox(r) })
    expect(markerBox(wrap.querySelector('ui-timeline-item')!)).toBe(r.icon)
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
