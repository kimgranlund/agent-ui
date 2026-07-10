import { describe, it, expect, afterEach } from 'vitest'

// timeline-family.lld.md §3 · SPEC-R14 — ui-timeline whole-shape cross-engine smoke: a populated durable
// timeline renders as a REAL rail (markers aligned to one axis, real width/height, no phantom trailing
// connector) — the ui-slider whole-shape lesson applied to the durable host.
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css'
import '@agent-ui/components/components'

const mounted: HTMLElement[] = []
const mount = (markup: string): { wrap: HTMLElement; timeline: HTMLElement } => {
  const wrap = document.createElement('div')
  wrap.innerHTML = markup
  document.body.append(wrap)
  mounted.push(wrap)
  return { wrap, timeline: wrap.querySelector('ui-timeline') as HTMLElement }
}
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

const ORDER_TRACKING = `
  <ui-timeline label="Order status" size="md">
    <ui-timeline-item status="done" label="Order placed" timestamp="Apr 15, 2:30 PM"></ui-timeline-item>
    <ui-timeline-item status="done" label="Processing" timestamp="Apr 16, 9:00 AM"></ui-timeline-item>
    <ui-timeline-item status="active" label="Shipped" timestamp="Apr 17, 11:45 AM"></ui-timeline-item>
    <ui-timeline-item status="pending" label="Delivered" timestamp="Expected Apr 20"></ui-timeline-item>
  </ui-timeline>
`

describe('ui-timeline whole-shape smoke — a real populated rail, not a collapsed sliver', () => {
  it('renders a real bounding box (non-zero width/height) with FOUR aligned-marker items', () => {
    const { timeline } = mount(ORDER_TRACKING)
    const rect = timeline.getBoundingClientRect()
    expect(rect.width).toBeGreaterThan(0)
    expect(rect.height).toBeGreaterThan(0)

    const markers = Array.from(timeline.querySelectorAll('[data-part="marker"]')) as HTMLElement[]
    expect(markers.length).toBe(4)
    const lefts = markers.map((m) => m.getBoundingClientRect().left)
    expect(new Set(lefts.map((l) => Math.round(l))).size, `markers did not align: ${lefts.join()}`).toBe(1)

    // the rows stack top-to-bottom in authored order (no reordering) — each marker strictly below the last.
    const tops = markers.map((m) => m.getBoundingClientRect().top)
    for (let i = 1; i < tops.length; i++) expect(tops[i]!).toBeGreaterThan(tops[i - 1]!)
  })

  it('only the LAST item has its connector suppressed — the first three still bridge into the next row', () => {
    const { timeline } = mount(ORDER_TRACKING)
    const items = Array.from(timeline.querySelectorAll('ui-timeline-item'))
    expect(items).toHaveLength(4)
    for (let i = 0; i < items.length - 1; i++) {
      const after = getComputedStyle(items[i]!.querySelector('[data-part="marker"]')!, '::after')
      expect(after.display, `item ${i} (not last) should still show its connector`).not.toBe('none')
    }
    const lastAfter = getComputedStyle(items.at(-1)!.querySelector('[data-part="marker"]')!, '::after')
    expect(lastAfter.display).toBe('none')
  })

  it('a bare, unsized ui-timeline (no children) still renders a real min-inline-size floor, never 0-width', () => {
    const { timeline } = mount('<ui-timeline></ui-timeline>')
    expect(timeline.getBoundingClientRect().width).toBeGreaterThan(0)
  })
})
