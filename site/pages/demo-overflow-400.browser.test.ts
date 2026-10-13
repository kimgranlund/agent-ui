import { describe, it, expect, afterEach, vi } from 'vitest'
import { page } from 'vitest/browser'

// T-0130: REAL-TIMING HEADROOM (viewport round trips + rAF settles; vitest.browser.config.ts).
vi.setConfig({ testTimeout: 30_000 })

// demo-overflow-400.browser.test.ts: at a 400px viewport no docs demo specimen or API table pushes past the right
// edge of the page content column. The shell clips its pane (`overflow: hidden`), so `document.scrollWidth` stays
// at 400 even when a specimen is cut off; the honest probe is the content column's own right edge. A descendant
// may extend past it only inside an `overflow-x: auto | scroll` frame of its own: a genuinely wide table scrolls in
// a frame instead of squeezing its cells, while an `overflow: hidden` ancestor is what CLIPS a spilled specimen and
// never counts. The 4px slack is the padding of an inline code chip that wraps flush against the column edge.

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

/** Every element whose box ends beyond the content column, unless an overflow frame inside the column holds it. */
function escapees(column: HTMLElement): string[] {
  const limit = column.getBoundingClientRect().right + 4
  const out: string[] = []
  for (const node of column.querySelectorAll('*')) {
    const box = node.getBoundingClientRect()
    if (box.width === 0 || box.right <= limit) continue
    let framed = false
    for (let up = node.parentElement; up && up !== column; up = up.parentElement) {
      const overflowX = getComputedStyle(up).overflowX
      if (overflowX === 'auto' || overflowX === 'scroll') { framed = true; break }
    }
    if (!framed) out.push(`<${node.localName}${node.className ? '.' + String(node.className).trim().split(/\s+/)[0] : ''}> right=${Math.round(box.right)} limit=${Math.round(limit)}`)
  }
  return out
}

// Each page module mounts itself into `document.body` on import (the shared `_page.ts` and the ui-* definitions stay
// cached), so the body is emptied between pages and the next module is imported fresh.
const PAGES: Record<string, () => Promise<unknown>> = {
  'button-demo (form-actions row)': () => import('./button-demo.ts'),
  'text-field-demo (the vendor form fields)': () => import('./text-field-demo.ts'),
  'card-demo (the composed card)': () => import('./card-demo.ts'),
  'table-demo (the report and single-select tables)': () => import('./table-demo.ts'),
  'card-doc (the Attributes table)': () => import('./card-doc.ts'),
  'badge-demo (the count pills row)': () => import('./badge-demo.ts'),
  'icon-demo (the sizing ramp row)': () => import('./icon-demo.ts'),
}

/** table-demo's wide report table scrolls in its own frame at a readable width instead of squeezing its cells. */
function expectReportTableFramed(): void {
  const table = document.querySelector('ui-table[selectable="multi"]') as HTMLElement
  const frame = table.parentElement as HTMLElement
  expect(getComputedStyle(frame).overflowX, 'the frame scrolls horizontally').toBe('auto')
  expect(frame.scrollWidth, 'the table is wider than the 400px column, so it scrolls instead of squeezing').toBeGreaterThan(frame.clientWidth)
  const cell = table.querySelector('tbody tr td:nth-child(2)') as HTMLElement
  expect(cell.getBoundingClientRect().width, 'a cell keeps room for an account name on one line').toBeGreaterThan(100)
}

afterEach(async () => {
  document.body.innerHTML = ''
  await page.viewport(414, 896) // restore the fleet default (ADR-0150 cl.5)
})

describe('docs pages at 400px: nothing overflows the content column (T-0130)', () => {
  for (const [name, load] of Object.entries(PAGES)) {
    it(`${name} stays inside the column`, async () => {
      await page.viewport(400, 900)
      document.body.innerHTML = ''
      await load()
      await raf()
      const column = document.querySelector('[data-page-content]') as HTMLElement
      expect(column, 'anti-vacuous: the page mounted its content column').not.toBeNull()
      expect(column.querySelectorAll('*').length, 'anti-vacuous: the column carries specimens').toBeGreaterThan(10)
      expect(document.documentElement.clientWidth, 'the probe really runs at 400px').toBe(400)
      expect(escapees(column), 'no element past the content column outside an overflow frame').toEqual([])
      if (name.startsWith('table-demo')) expectReportTableFramed()
    })
  }
})
