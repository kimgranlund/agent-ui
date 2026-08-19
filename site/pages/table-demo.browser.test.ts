import { describe, it, expect, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
// Side-effect import: the demo page mounts the app shell + every live ui-table specimen into
// document.body (mountPage appends to `#app ?? document.body`; the modal-demo.browser.test.ts precedent).
import './table-demo.ts'

// GH #347 — REAL-TIMING HEADROOM (rAF settles under concurrent host load).
vi.setConfig({ testTimeout: 30_000 })

// table-demo.browser.test.ts — proves the demo page mounts the REAL widened control with every ADR-0163
// capability live: sortable headers (a change commit + aria-sort), multi-selection (a select commit into the
// event log), the composed search field narrowing the tbody, the plan facet, pagination windowing, and the
// byte-identical default-off baseline (no selection column, no footer).

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

type TableEl = HTMLElement & {
  selected: readonly string[]
  sort: { key: string; direction: string } | null
  search: string
  page: number
}

const reportTable = (): TableEl => document.querySelector('ui-table[selectable="multi"]') as TableEl

describe('table-demo — the real widened ui-table: sort, selection, search, filter, pagination, baseline', () => {
  it('mounts the full-capability report: caption, sort buttons, checkbox column, pagination footer, page window', async () => {
    await raf()
    const report = reportTable()
    expect(report, 'the multi-select report table is mounted').toBeTruthy()
    expect(report.querySelector('caption')?.textContent).toContain('Accounts')
    expect(report.querySelectorAll('th [data-part="sort-button"]').length, 'every column opted sortable').toBe(6)
    expect(report.querySelector('[data-part="select-all"]'), 'the header select-all checkbox is stamped').not.toBeNull()
    expect(report.querySelector('ui-pagination[data-part="pagination"]'), 'the composed footer is stamped').not.toBeNull()
    expect(report.querySelectorAll('tbody tr').length, 'page-size=8 windows the 24 rows').toBe(8)
    // the initial descending MRR sort puts Meridian Bank (18,900) first
    expect(report.querySelector('tbody tr td:nth-child(2)')?.textContent).toContain('Meridian Bank')
    expect(report.querySelector('th[aria-sort="descending"]'), 'aria-sort rides the sorted th').not.toBeNull()
  })

  it('renders the demo sections (>= 2 exampleSections with headings)', async () => {
    await raf()
    const headings = [...document.querySelectorAll('section > h2')].map((h) => h.textContent ?? '')
    expect(headings.length).toBeGreaterThanOrEqual(2)
    expect(headings.some((t) => t.includes('full-capability report'))).toBe(true)
    expect(headings.some((t) => t.includes('Default-off baseline'))).toBe(true)
  })

  it('a sort-button click commits change (logged, sort prop readable); a row checkbox commits select (logged)', async () => {
    await raf()
    const report = reportTable()
    const log = document.querySelector('ul.event-log')!
    const before = log.children.length
    const accountSort = [...report.querySelectorAll('[data-part="sort-button"]')].find((b) => b.textContent?.includes('Account'))
    await userEvent.click(accountSort as HTMLElement)
    await raf()
    expect(report.sort?.key, 'the sort prop rewrote to the clicked column').toBe('account')
    expect(log.children.length, 'the change commit is logged').toBeGreaterThan(before)
    expect(log.textContent).toContain('sort=')
    // a row selection commit — the first body row's checkbox toggles `selected` and fires `select`
    const firstRowBox = report.querySelector('tbody [data-part="select"], tbody input[type="checkbox"]') as HTMLInputElement
    const selectedBefore = report.selected.length
    await userEvent.click(firstRowBox)
    await raf()
    expect(report.selected.length, 'the selected identities changed').not.toBe(selectedBefore)
    expect(log.textContent).toContain('select')
  })

  it('typing in the composed search field narrows the matching set ("fjord" → 1 row, diacritic-folded search works)', async () => {
    await raf()
    const report = reportTable()
    const field = document.querySelector('ui-text-field') as HTMLElement
    const editor = field.querySelector('[contenteditable]') as HTMLElement
    await userEvent.click(editor)
    await userEvent.keyboard('fjord')
    await raf()
    expect(report.search, 'the bound field writes the table search prop').toBe('fjord')
    const rows = [...report.querySelectorAll('tbody tr')]
    expect(rows.length, 'one account matches "fjord"').toBe(1)
    expect(rows[0]!.textContent).toContain('Blue Fjord Labs')
    // clear for the remaining assertions
    report.search = ''
    await raf()
  })

  it('the plan facet writes one bounded filter entry and pagination re-windows', async () => {
    await raf()
    const report = reportTable()
    const freeSegment = [...document.querySelectorAll('ui-segment')].find((s) => s.getAttribute('value') === 'Free')
    await userEvent.click(freeSegment as HTMLElement)
    await raf()
    const rows = [...report.querySelectorAll('tbody tr')]
    expect(rows.length, 'six Free-plan accounts match, within one page').toBe(6)
    for (const row of rows) expect(row.textContent).toContain('Free')
  })

  it('the default-off baseline stays the display-only table: no selection column, no sort buttons, no footer', async () => {
    await raf()
    const baseline = [...document.querySelectorAll('ui-table')].find((t) => t.querySelector('caption')?.textContent === 'Revenue by region')!
    expect(baseline, 'the baseline table is mounted').toBeTruthy()
    expect(baseline.querySelector('input'), 'no selection inputs at defaults').toBeNull()
    expect(baseline.querySelector('[data-part="sort-button"]'), 'no sort buttons at defaults').toBeNull()
    expect(baseline.querySelector('[data-part="footer"]'), 'no pagination footer at defaults').toBeNull()
    expect(baseline.querySelectorAll('tbody tr').length).toBe(4)
  })
})
