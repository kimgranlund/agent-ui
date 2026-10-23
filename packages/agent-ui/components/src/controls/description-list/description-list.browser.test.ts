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

    // the shared term column ends at the longest label (T-0417: one grid, not a flex row per row)
    const termColumnRight = Math.max(...rows.map((r) => r.querySelector('[data-part="label"]')!.getBoundingClientRect().right))
    for (const row of rows) {
      const label = row.querySelector('[data-part="label"]') as HTMLElement
      const value = row.querySelector('[data-part="value"]') as HTMLElement
      const lb = label.getBoundingClientRect()
      const vb = value.getBoundingClientRect()
      expect(lb.width, 'label painted zero width').toBeGreaterThan(0)
      expect(vb.width, 'value painted zero width').toBeGreaterThan(0)

      // ADJACENCY (the load-bearing law): the value starts at the term column's end + the pair gap, NOT
      // flushed to the row's far edge (the rejected justify:"between" wash). The row is 480px wide;
      // an opposite-edge value would start hundreds of px away.
      const pairGap = px(getComputedStyle(row).columnGap || getComputedStyle(row).gap)
      expect(pairGap, 'anti-vacuous: the pair gap resolves to a real px value').toBeGreaterThan(0)
      expect(lb.right).toBeLessThanOrEqual(termColumnRight)
      expect(Math.abs(vb.left - (termColumnRight + pairGap)), 'the value is not ADJACENT to the term column').toBeLessThanOrEqual(1)
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

// T-0417: the rows share ONE grid (the term column is as wide as the longest term, every value starts at
// the same x) and under a narrow query boundary the term stacks above its value. The boundary is an
// EXTERNALLY-sized ancestor (`container-type: inline-size`), the ui-row precedent (ADR-0100: an
// intrinsically-sized control never establishes its own query container).
const WEEK = [
  { label: 'Monday', value: "Mung dal kitchari with steamed zucchini. Kid twist: serve it in a bowl with a ghee 'sun' in the middle." },
  { label: 'Wednesday', value: 'Coconut rice with sauteed peas and sweet corn. Kid twist: build a rice-and-veggie face.' },
  { label: 'Fri', value: 'Paneer and spinach with basmati rice.' },
]
const mountIn = (width: number): UIDescriptionListElement => {
  const el = mount(width)
  el.parentElement!.style.containerType = 'inline-size'
  return el
}
const parts = (el: HTMLElement, part: string): DOMRect[] =>
  ([...el.querySelectorAll(`[data-part="${part}"]`)] as HTMLElement[]).map((p) => p.getBoundingClientRect())

describe('ui-description-list: one shared term column (T-0417)', () => {
  it('terms of different lengths share one value x in a wide container, one pair gap past the longest term', async () => {
    const el = mountIn(640)
    el.rows = WEEK
    await whenFlushed()

    const labels = parts(el, 'label')
    const values = parts(el, 'value')
    expect(values.length).toBe(3)
    const longestLabelRight = Math.max(...labels.map((b) => b.right))
    const gap = px(getComputedStyle(el.querySelector('[data-part="row"]')!).columnGap)
    expect(gap, 'anti-vacuous: the pair gap resolves').toBeGreaterThan(0)
    // anti-vacuous: the labels really differ in width (Fri vs Wednesday), else a shared x proves nothing
    expect(Math.max(...labels.map((b) => b.width)) - Math.min(...labels.map((b) => b.width))).toBeGreaterThan(20)
    for (const [i, v] of values.entries()) {
      expect(Math.abs(v.left - values[0]!.left), `value ${i} starts at a different x`).toBeLessThanOrEqual(1)
      expect(Math.abs(v.left - (longestLabelRight + gap)), `value ${i} is not one pair gap past the longest term`).toBeLessThanOrEqual(1)
      expect(Math.abs(labels[i]!.left - labels[0]!.left), `term ${i} starts at a different x`).toBeLessThanOrEqual(1)
      expect(v.top, `value ${i} stacked under its term in a wide container`).toBeLessThan(labels[i]!.bottom)
    }
  })

  it('a wrapped value keeps every line on the value edge, never under the term', async () => {
    const el = mountIn(480)
    el.rows = WEEK
    await whenFlushed()

    const values = [...el.querySelectorAll('[data-part="value"]')] as HTMLElement[]
    const valueEdge = values[0]!.getBoundingClientRect().left
    const longestLabelRight = Math.max(...parts(el, 'label').map((b) => b.right))
    const value = values[1]! // Wednesday, the longest term and a long value
    const range = document.createRange()
    range.selectNodeContents(value)
    const lines = [...range.getClientRects()].filter((r) => r.width > 0)
    const lineTops = new Set(lines.map((r) => Math.round(r.top)))
    expect(lineTops.size, 'anti-vacuous: the value wraps to more than one line').toBeGreaterThan(1)
    for (const line of lines) {
      expect(Math.abs(line.left - valueEdge), 'a wrapped line left the shared value edge').toBeLessThanOrEqual(1)
      expect(line.left, 'a wrapped line hangs under the term').toBeGreaterThan(longestLabelRight)
    }
  })

  it('under the narrow threshold (20rem) the term stacks above its value on one start edge', async () => {
    const el = mountIn(300)
    el.rows = WEEK
    await whenFlushed()

    const labels = parts(el, 'label')
    const values = parts(el, 'value')
    for (const [i, v] of values.entries()) {
      expect(v.top, `value ${i} is not below its term`).toBeGreaterThanOrEqual(labels[i]!.bottom - 1)
      expect(Math.abs(v.left - labels[i]!.left), `value ${i} does not share its term's start edge`).toBeLessThanOrEqual(1)
      expect(v.right, `value ${i} overflows the host`).toBeLessThanOrEqual(el.getBoundingClientRect().right + 1)
    }
  })

  it('stacked pairs separate: each row sits one pair gap below the last, wider than the side-by-side row gap', async () => {
    const el = mountIn(300)
    el.rows = WEEK
    await whenFlushed()

    const rows = [...el.querySelectorAll('[data-part="row"]')] as HTMLElement[]
    const pairGap = px(getComputedStyle(rows[0]!).columnGap)
    const wideRowGap = px(getComputedStyle(mount(), null).rowGap) // no query boundary: the side-by-side row gap
    expect(pairGap, 'anti-vacuous: the pair gap resolves').toBeGreaterThan(0)
    expect(pairGap, 'the stacked gap must be wider than the side-by-side row gap').toBeGreaterThan(wideRowGap)
    for (let i = 1; i < rows.length; i++) {
      const gap = rows[i]!.getBoundingClientRect().top - rows[i - 1]!.getBoundingClientRect().bottom
      expect(Math.abs(gap - pairGap), `stacked pair ${i} is not one pair gap below its predecessor`).toBeLessThanOrEqual(1)
    }
  })

  it('the same list at the 400px column (a 368px boundary) does NOT stack (the narrow rule is threshold-gated)', async () => {
    const el = mountIn(368)
    el.rows = WEEK
    await whenFlushed()
    const labels = parts(el, 'label')
    const values = parts(el, 'value')
    for (const [i, v] of values.entries()) expect(v.left, `value ${i} stacked at 368px`).toBeGreaterThan(labels[i]!.right)
  })
})
