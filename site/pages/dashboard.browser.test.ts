// dashboard.browser.test.ts — the cross-engine (Chromium + WebKit, vitest.browser.config.ts) proofs for
// the Support Dashboard (GH #499, M-F). Side-effect imports the REAL page module (the workbench.browser.
// test.ts / agent-admin-app.browser.test.ts precedent) and drives it exactly as a user would: real clicks,
// real focus.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { userEvent } from 'vitest/browser'
import './dashboard.ts'
import type { UITableElement, UIBarChartElement, UISegmentedControlElement } from '@agent-ui/components/components'
import { FIXTURE_RECORDS, computeDashboardStats, computeCategoryBreakdown } from './dashboard-data.ts'

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

function table(): UITableElement {
  return document.querySelector('ui-table') as UITableElement
}
function barChart(): UIBarChartElement {
  return document.querySelector('ui-bar-chart') as UIBarChartElement
}
function priorityFilter(): UISegmentedControlElement {
  return document.querySelector('ui-segmented-control') as UISegmentedControlElement
}
function segmentByValue(value: string): HTMLElement {
  return priorityFilter().querySelector(`ui-segment[value="${value}"]`) as HTMLElement
}
// Scoped to `.dc-stats-row` deliberately, never a bare `document.querySelectorAll('ui-stat')`: the recorded
// agent-summary card ALSO renders a real `ui-stat` catalog row (dashboard-summary.ts's `Stat` component,
// materialized inside `.dc-summary-host`) — an unscoped query would pick up 5 elements, not 4, once that
// card renders (a real collision, caught here rather than left as a race-dependent flake).
function statValues(): string[] {
  return [...document.querySelectorAll('.dc-stats-row ui-stat')].map((s) => (s.querySelector('[data-part="value"]')?.textContent ?? '').trim())
}
function summaryText(): string {
  return (document.querySelector('.dc-summary-host') as HTMLElement).textContent ?? ''
}

// ════════════════ zero network requests (spy installed for the WHOLE file; asserted last, over the
// complete interaction sequence every other describe below drives) ════════════════════════════════════
let fetchCalls = 0
let xhrOpens = 0
let originalFetch: typeof fetch
let originalXhrOpen: typeof XMLHttpRequest.prototype.open
beforeAll(() => {
  originalFetch = window.fetch
  window.fetch = ((...args: Parameters<typeof fetch>) => {
    fetchCalls += 1
    return originalFetch(...args)
  }) as typeof fetch
  originalXhrOpen = XMLHttpRequest.prototype.open
  XMLHttpRequest.prototype.open = function (this: XMLHttpRequest, ...args: Parameters<typeof XMLHttpRequest.prototype.open>) {
    xhrOpens += 1
    return originalXhrOpen.apply(this, args)
  } as typeof XMLHttpRequest.prototype.open
})
afterAll(() => {
  window.fetch = originalFetch
  XMLHttpRequest.prototype.open = originalXhrOpen
})

describe('dashboard — the four stat tiles are COMPUTED from the fixture, not hand-typed twice', () => {
  it('renders the exact values computeDashboardStats derives from FIXTURE_RECORDS', async () => {
    await raf()
    const stats = computeDashboardStats(FIXTURE_RECORDS)
    const values = statValues()
    expect(values).toHaveLength(4)
    expect(values[0]).toBe(String(stats.openCount))
    expect(values[1]).toBe(`${stats.avgFirstResponseMinutes}m`)
    expect(values[2]).toBe(String(stats.avgCsat))
    expect(values[3]).toBe(String(stats.activeAgentCount))
  })
})

describe('dashboard — the bar chart renders the fixture-derived category breakdown', () => {
  it('one role=listitem row per category, label + printed value matching computeCategoryBreakdown', async () => {
    const chart = barChart()
    const expected = computeCategoryBreakdown(FIXTURE_RECORDS)
    const rows = [...chart.querySelectorAll('[role="listitem"]')]
    expect(rows).toHaveLength(expected.length)
    for (const [index, row] of rows.entries()) {
      const label = row.querySelector('[data-part="label"]')?.textContent ?? ''
      const value = row.querySelector('[data-part="value"]')?.textContent ?? ''
      expect(label).toBe(expected[index]!.label)
      expect(value).toBe(String(expected[index]!.value))
    }
  })
})

describe('dashboard — the priority filter drives table.filter AND the agent-summary key, never table.rows', () => {
  it('starts on "all": every fixture row renders, the summary reads "All tickets"', async () => {
    await raf()
    const t = table()
    expect(t.querySelectorAll('tbody tr')).toHaveLength(FIXTURE_RECORDS.length)
    expect(summaryText()).toContain('All tickets')
  })

  it('Urgent narrows the table to the Urgent rows only and swaps the summary; High does the same for High; All resets both', async () => {
    const t = table()
    const rowsRef = t.rows

    await userEvent.click(segmentByValue('urgent'))
    await raf()
    const urgentExpected = FIXTURE_RECORDS.filter((r) => r.priority === 'Urgent')
    expect(urgentExpected.length, 'fixture sanity — Urgent must be a genuine, non-empty sub-page').toBeGreaterThan(0)
    expect(t.querySelectorAll('tbody tr'), 'the rendered tbody must be exactly the Urgent matching set').toHaveLength(urgentExpected.length)
    expect(t.rows, 'the filter must never reassign table.rows').toBe(rowsRef)
    expect(summaryText(), 'the summary must swap to the Urgent key').toContain('Urgent tickets')
    expect(summaryText()).not.toContain('All tickets')

    await userEvent.click(segmentByValue('high'))
    await raf()
    const highExpected = FIXTURE_RECORDS.filter((r) => r.priority === 'High')
    expect(highExpected.length, 'fixture sanity — High must be a genuine, non-empty sub-page').toBeGreaterThan(0)
    expect(t.querySelectorAll('tbody tr')).toHaveLength(highExpected.length)
    expect(t.rows, 'the filter must never reassign table.rows').toBe(rowsRef)
    expect(summaryText()).toContain('High-priority tickets')
    expect(summaryText()).not.toContain('Urgent tickets')

    // reset
    await userEvent.click(segmentByValue('all'))
    await raf()
    expect(t.querySelectorAll('tbody tr')).toHaveLength(FIXTURE_RECORDS.length)
    expect(t.rows).toBe(rowsRef)
    expect(summaryText()).toContain('All tickets')
  })
})

describe('dashboard — the table is sortable (a simpler, unselectable/unpaginated ui-table configuration than the workbench)', () => {
  it('a sortable header cycles ascending and reorders rows; the native table role never changes', async () => {
    const t = table()
    const nativeTable = t.querySelector('table') as HTMLTableElement
    expect(nativeTable.getAttribute('role'), 'role=grid is REJECTED (ADR-0163 cl.3) — must stay absent').toBeNull()
    expect(t.querySelectorAll('[data-part="select"]'), 'this table is deliberately unselectable').toHaveLength(0)
    expect(t.querySelector('[data-part="footer"] ui-pagination'), 'this table is deliberately unpaginated (all rows fit on one page)').toBeNull()

    const subjectSortButton = t.querySelectorAll('[data-part="sort-button"]')[0] as HTMLElement // columns[0] = subject
    await userEvent.click(subjectSortButton)
    await raf()

    const sortedThs = [...t.querySelectorAll('th[aria-sort]')]
    expect(sortedThs).toHaveLength(1)
    expect(sortedThs[0]!.getAttribute('aria-sort')).toBe('ascending')

    const subjectsAsc = [...t.querySelectorAll('tbody tr')].map((tr) => (tr.querySelectorAll('td')[0]?.textContent ?? '').trim())
    const expectedAsc = [...FIXTURE_RECORDS].sort((a, b) => a.subject.localeCompare(b.subject)).map((r) => r.subject)
    expect(subjectsAsc).toEqual(expectedAsc)

    // reset — direct property write (fixture cleanup, not the probe itself)
    t.sort = null
    await raf()
  })
})

describe('dashboard — zero network requests', () => {
  it('fetch and XHR were never called across the full interaction sequence above', () => {
    expect(fetchCalls, 'window.fetch must never be called').toBe(0)
    expect(xhrOpens, 'XMLHttpRequest.open must never be called').toBe(0)
  })
})
