import { describe, it, expect, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
// Side-effect import: the demo page mounts the app shell + every live ui-bar-chart specimen into
// document.body (mountPage appends to `#app ?? document.body`; the modal-demo.browser.test.ts precedent).
import './bar-chart-demo.ts'

// GH #347 — REAL-TIMING HEADROOM (rAF settles under concurrent host load).
vi.setConfig({ testTimeout: 30_000 })

// bar-chart-demo.browser.test.ts — proves the demo page mounts the REAL control (component-built listitem
// rows with label/track/fill/value parts), renders the demo sections, and that the quarter switcher's
// `change` commit performs a real `data` write logged in the event log.

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

describe('bar-chart-demo — the real ui-bar-chart mounted, sections rendered, switcher + log wired', () => {
  it('mounts real ui-bar-chart controls with component-built rows (label · track/fill · printed value)', async () => {
    await raf()
    const charts = [...document.querySelectorAll('ui-bar-chart')]
    expect(charts.length, 'expected many live bar-chart specimens').toBeGreaterThanOrEqual(6)
    const revenue = charts[0]!
    const rows = revenue.querySelectorAll('[role="listitem"]')
    expect(rows.length, 'the Q1 revenue chart renders its five regions').toBe(5)
    expect(revenue.querySelector('[data-part="label"]')).not.toBeNull()
    expect(revenue.querySelector('[data-part="track"] [data-part="fill"]')).not.toBeNull()
    expect(revenue.querySelector('[data-part="value"]')).not.toBeNull()
  })

  it('renders the demo sections (>= 2 exampleSections with headings)', async () => {
    await raf()
    const headings = [...document.querySelectorAll('section > h2')].map((h) => h.textContent ?? '')
    expect(headings.length).toBeGreaterThanOrEqual(2)
    expect(headings.some((t) => t.includes('Revenue by region'))).toBe(true)
    expect(headings.some((t) => t.includes('Degenerate data'))).toBe(true)
  })

  it('picking a quarter commits change, rewrites the chart data, and logs the event', async () => {
    await raf()
    const log = document.querySelector('ul.event-log')
    expect(log, 'the event log is on the page').not.toBeNull()
    expect(log!.children.length, 'the log starts empty (no synthetic entries)').toBe(0)
    const q2 = [...document.querySelectorAll('ui-segment')].find((s) => s.getAttribute('value') === 'q2')
    expect(q2, 'the Q2 segment exists').toBeTruthy()
    const chart = document.querySelector('ui-bar-chart') as HTMLElement & { label: string }
    await userEvent.click(q2 as HTMLElement)
    await raf()
    expect(log!.children.length, 'the change commit is logged').toBeGreaterThanOrEqual(1)
    expect(log!.textContent).toContain('quarter="q2"')
    expect(chart.label, 'the real label prop write landed').toContain('Q2')
  })
})
