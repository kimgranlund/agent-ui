import { describe, it, expect, afterEach } from 'vitest'
import { resolve } from '../../../../shared/src/tokens/scale.mjs'
import '@agent-ui/components/foundation-styles.css'
import './table.css'
import './table.ts'

// ui-table geometry (ADR-0245 clause 3, delta rows "table row" and "table text cell inline padding"): inside an
// opt-in region a row is at least 4n + 2c tall and a cell pads n + c inline; outside one the row is content-sized
// and the pad is space-sm (8px), so the dark launch leaves every default table where it was.

const mounted: HTMLElement[] = []
afterEach(() => mounted.splice(0).forEach((el) => el.remove()))

const COLUMNS = JSON.stringify([
  { key: 'region', label: 'Region' },
  { key: 'revenue', label: 'Revenue', type: 'number' },
])
const ROWS = JSON.stringify([{ region: 'EMEA', revenue: 42000 }])
const TABLE = `<ui-table columns='${COLUMNS}' rows='${ROWS}'></ui-table>`

function cell(html: string): HTMLElement {
  const wrap = document.createElement('div')
  wrap.innerHTML = html
  document.body.append(wrap)
  mounted.push(wrap)
  return wrap.querySelector('tbody td') as HTMLElement
}

describe('ui-table geometry inside an opt-in region', () => {
  for (const scale of ['sm', 'md'] as const) {
    it(`product / ${scale}: row at least 4n + 2c, cell padding n + c`, () => {
      const td = cell(`<div data-tier="product" data-scale="${scale}">${TABLE}</div>`)
      const r = resolve('product', scale, 'md')
      expect(td.getBoundingClientRect().height).toBe(r.h + 2 * r.c)
      expect(Number.parseFloat(getComputedStyle(td).paddingInlineStart)).toBe(r.control.margin + r.c)
    })
  }
})

describe('ui-table geometry under data-foundations=legacy (the clause 10e rollback)', () => {
  it('the cell is content-sized with 8px inline padding', () => {
    const td = cell(`<div data-foundations="legacy">${TABLE}</div>`)
    expect(Number.parseFloat(getComputedStyle(td).paddingInlineStart)).toBe(8)
    const before = td.getBoundingClientRect().height
    td.style.blockSize = 'auto'
    expect(td.getBoundingClientRect().height).toBe(before) // block-size already resolved to auto
  })
})
