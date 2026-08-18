import { describe, it, expect, afterEach } from 'vitest'

// description-list.browser.test.ts — the real-engine proof for the receipt rhythm (ADR-0201 cl.4 —
// the #1174 LOOK as CSS): jsdom is blind to painted geometry and computed style, so ADJACENCY (the
// value sits next to its label, never opposite-edge flushed), the baseline share, the two gap tokens,
// the secondary-plane label ink, and the long-value wrap are proven here against real layout — the
// test-the-whole-shape law: assert the gestalt, not just per-part existence.
//
// Side-effect CSS/JS imports — the load-bearing order (ADR-0003): foundation roles + dimensional ramp
// FIRST, then this control's own sheet, then the self-defining module.
import '@agent-ui/components/foundation-styles.css'
import './description-list.css'
import './description-list.ts'
import type { UIDescriptionListElement } from './description-list.ts'
import { whenFlushed } from '../../reactive/index.ts'

const mounted: HTMLElement[] = []
const mount = (width = 480): UIDescriptionListElement => {
  const wrap = document.createElement('div')
  wrap.style.width = `${width}px`
  const el = document.createElement('ui-description-list') as UIDescriptionListElement
  wrap.append(el)
  document.body.append(wrap)
  mounted.push(wrap)
  return el
}
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

const px = (v: string): number => Number.parseFloat(v)

const RECEIPT = [
  { label: 'Room', value: 'Deluxe King' },
  { label: 'Nights', value: 3 },
  { label: 'Breakfast', value: 'Included' },
]

describe('ui-description-list — the receipt rhythm paints (whole-shape gestalt)', () => {
  it('a populated receipt paints every row: label then value ADJACENT on the same line, sharing a baseline', async () => {
    const el = mount()
    el.rows = RECEIPT
    await whenFlushed()

    const rows = [...el.querySelectorAll('[data-part="row"]')] as HTMLElement[]
    expect(rows.length).toBe(3)

    const hostBox = el.getBoundingClientRect()
    expect(hostBox.width, 'the host painted zero width').toBeGreaterThan(0)
    expect(hostBox.height, 'the host painted zero height').toBeGreaterThan(0)

    for (const row of rows) {
      const label = row.querySelector('[data-part="label"]') as HTMLElement
      const value = row.querySelector('[data-part="value"]') as HTMLElement
      const lb = label.getBoundingClientRect()
      const vb = value.getBoundingClientRect()
      expect(lb.width, 'label painted zero width').toBeGreaterThan(0)
      expect(vb.width, 'value painted zero width').toBeGreaterThan(0)

      // ADJACENCY (the load-bearing law): the value starts at the label's end + the pair gap — NOT
      // flushed to the row's far edge (the rejected justify:"between" wash). The row is 480px wide;
      // an opposite-edge value would start hundreds of px away.
      const pairGap = px(getComputedStyle(row).columnGap || getComputedStyle(row).gap)
      expect(pairGap, 'anti-vacuous: the pair gap resolves to a real px value').toBeGreaterThan(0)
      expect(Math.abs(vb.left - (lb.right + pairGap)), 'the value is not ADJACENT to its label').toBeLessThanOrEqual(1)
      expect(vb.right, 'the value was flushed to the opposite edge').toBeLessThan(row.getBoundingClientRect().right - 40)

      // same line: the boxes vertically overlap (baseline share, no stacking)
      expect(vb.top).toBeLessThan(lb.bottom)
      expect(vb.bottom).toBeGreaterThan(lb.top)
    }
  })

  it('rows stack vertically at the row-gap token; the WHOLE bounding box is the sum of its rows + gaps', async () => {
    const el = mount()
    el.rows = RECEIPT
    await whenFlushed()

    const rows = [...el.querySelectorAll('[data-part="row"]')] as HTMLElement[]
    const rowGap = px(getComputedStyle(el).rowGap || getComputedStyle(el).gap)
    expect(rowGap, 'anti-vacuous: the row gap resolves to a real px value').toBeGreaterThan(0)

    for (let i = 1; i < rows.length; i++) {
      const prev = rows[i - 1]!.getBoundingClientRect()
      const next = rows[i]!.getBoundingClientRect()
      expect(Math.abs(next.top - prev.bottom - rowGap), `row ${i} does not sit one row-gap below its predecessor`).toBeLessThanOrEqual(1)
    }

    // the gestalt: host height ≈ Σ row heights + (n−1) gaps
    const total = rows.reduce((s, r) => s + r.getBoundingClientRect().height, 0) + rowGap * (rows.length - 1)
    expect(Math.abs(el.getBoundingClientRect().height - total)).toBeLessThanOrEqual(1)
  })

  it('the label sits on the SECONDARY plane (its computed ink differs from the value ink) and the label register is smaller than the value register', async () => {
    const el = mount()
    el.rows = [{ label: 'Total', value: '$412.00' }]
    await whenFlushed()

    const label = el.querySelector('[data-part="label"]') as HTMLElement
    const value = el.querySelector('[data-part="value"]') as HTMLElement
    const labelStyle = getComputedStyle(label)
    const valueStyle = getComputedStyle(value)
    expect(labelStyle.color, 'label ink must be the secondary plane, not the value ink').not.toBe(valueStyle.color)
    expect(px(labelStyle.fontSize), 'label register must be smaller than the value register').toBeLessThan(px(valueStyle.fontSize))
  })

  it('a long value WRAPS under itself (never overflows the host); the label never crushes', async () => {
    const el = mount(240)
    el.rows = [{ label: 'Reference', value: 'CONF-2026-08-17-DELUXE-KING-BRK-INCLUDED-4415-XJQ' }]
    await whenFlushed()

    const row = el.querySelector('[data-part="row"]') as HTMLElement
    const label = el.querySelector('[data-part="label"]') as HTMLElement
    const value = el.querySelector('[data-part="value"]') as HTMLElement
    // no horizontal overflow — the unbroken token wraps (overflow-wrap:anywhere + min-inline-size:0)
    expect(value.getBoundingClientRect().right).toBeLessThanOrEqual(el.getBoundingClientRect().right + 1)
    expect(row.scrollWidth, 'the row overflows horizontally').toBeLessThanOrEqual(row.clientWidth + 1)
    // the value wrapped to multiple lines, and the label kept its intrinsic width (flex-shrink:0)
    expect(value.getBoundingClientRect().height).toBeGreaterThan(px(getComputedStyle(value).lineHeight) * 1.5)
    const probe = document.createElement('span')
    probe.textContent = 'Reference'
    probe.style.font = getComputedStyle(label).font
    probe.style.position = 'absolute'
    probe.style.visibility = 'hidden'
    probe.style.whiteSpace = 'nowrap'
    document.body.append(probe)
    expect(label.getBoundingClientRect().width, 'the label was crushed below its intrinsic width').toBeGreaterThanOrEqual(probe.getBoundingClientRect().width - 1)
    probe.remove()
  })

  it('the empty-value omission law holds in the painted result: a valueless field paints NOTHING', async () => {
    const el = mount()
    el.setAttribute(
      'rows',
      JSON.stringify([
        { label: 'Room', value: 'Deluxe King' },
        { label: 'Late checkout', value: '' }, // must never paint
        { label: 'Parking', value: null },
      ]),
    )
    await whenFlushed()
    const rows = [...el.querySelectorAll('[data-part="row"]')]
    expect(rows.length).toBe(1)
    expect(el.textContent).not.toContain('Late checkout')
    expect(el.textContent).not.toContain('Parking')
  })

  it('an empty receipt paints a zero-height, non-intrusive host (no phantom box)', async () => {
    const el = mount()
    await whenFlushed()
    expect(el.getBoundingClientRect().height).toBe(0)
  })
})
