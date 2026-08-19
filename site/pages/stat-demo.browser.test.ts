import { describe, it, expect, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
// Side-effect import: the demo page mounts the app shell + every live ui-stat specimen into
// document.body (mountPage appends to `#app ?? document.body`; the modal-demo.browser.test.ts precedent).
import './stat-demo.ts'

// GH #347 — REAL-TIMING HEADROOM (rAF settles under concurrent host load).
vi.setConfig({ testTimeout: 30_000 })

// stat-demo.browser.test.ts — proves the demo page mounts the REAL control (label/value/delta parts as real
// text, the ring variant's decorative donut), renders the demo sections, and that the period switcher's
// `change` commit performs real delta/caption prop writes logged in the event log.

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

describe('stat-demo — the real ui-stat mounted, sections rendered, switcher + log wired', () => {
  it('mounts real ui-stat tiles — Intl-formatted numeric figure, delta as real text, ring variant present', async () => {
    await raf()
    const stats = [...document.querySelectorAll('ui-stat')]
    expect(stats.length, 'expected many live stat specimens').toBeGreaterThanOrEqual(10)
    const accounts = stats.find((s) => s.getAttribute('label') === 'Active accounts')!
    expect(accounts, 'the Active accounts tile exists').toBeTruthy()
    expect(accounts.querySelector('[data-part="value"]')?.textContent, 'a finite numeric figure Intl-formats').toContain('1,284')
    expect(accounts.querySelector('[data-part="delta"]')?.textContent, 'the delta prints the signed number').toContain('+46')
    const ring = stats.find((s) => s.getAttribute('variant') === 'ring')!
    expect(ring, 'a ring-variant tile exists').toBeTruthy()
    expect(ring.querySelector('[data-part="ring"]')?.getAttribute('aria-hidden'), 'the donut is decorative').toBe('true')
  })

  it('renders the demo sections (>= 2 exampleSections with headings)', async () => {
    await raf()
    const headings = [...document.querySelectorAll('section > h2')].map((h) => h.textContent ?? '')
    expect(headings.length).toBeGreaterThanOrEqual(2)
    expect(headings.some((t) => t.includes('KPI header'))).toBe(true)
    expect(headings.some((t) => t.includes('Ring variant'))).toBe(true)
  })

  it('picking a period commits change, rewrites delta/caption on the mounted tiles, and logs the event', async () => {
    await raf()
    const log = document.querySelector('ul.event-log')
    expect(log, 'the event log is on the page').not.toBeNull()
    expect(log!.children.length, 'the log starts empty (no synthetic entries)').toBe(0)
    const twelveMonths = [...document.querySelectorAll('ui-segment')].find((s) => s.getAttribute('value') === '12m')
    expect(twelveMonths, 'the 12-months segment exists').toBeTruthy()
    await userEvent.click(twelveMonths as HTMLElement)
    await raf()
    expect(log!.children.length, 'the change commit is logged').toBeGreaterThanOrEqual(1)
    expect(log!.textContent).toContain('period="12m"')
    const liveTiles = [...document.querySelectorAll('ui-stat')].filter((s) =>
      s.querySelector('[data-part="caption"]')?.textContent === 'vs 12 months ago')
    expect(liveTiles.length, 'both live tiles re-rendered with the new caption').toBe(2)
    expect(liveTiles.some((t) => t.querySelector('[data-part="delta"]')?.textContent?.includes('+517')), 'the accounts delta rewrote to +517').toBe(true)
  })
})
