import { describe, it, expect, vi } from 'vitest'
// Side-effect import: the demo page mounts the app shell + the live ui-description-list receipts into document.body
// (mountPage appends to `#app ?? document.body`; the modal-demo.browser.test.ts precedent).
import './description-list-demo.ts'

// GH #347 — REAL-TIMING HEADROOM (rAF + kernel microtask settles under host load): vitest.browser.config.ts.
vi.setConfig({ testTimeout: 30_000 })

// description-list-demo.browser.test.ts — the PAGE-LEVEL proof that the demo mounts the REAL receipt primitive
// (ADR-0201): three receipts render every valued row as label+value parts, the live omission specimen renders ONLY
// the two valued rows out of seven on first paint, grows to seven in place when the fields are answered, drops to
// zero on a malformed bind, and the write log records rows-in vs rows-rendered honestly.

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
const clickByText = (t: string): void => {
  const b = [...document.querySelectorAll('ui-button')].find((x) => x.textContent?.trim() === t)
  if (!b) throw new Error(`no ui-button "${t}"`)
  ;(b as HTMLElement).click()
}
const rowsOf = (list: Element): number => list.querySelectorAll('[data-part="row"]').length

describe('description-list-demo — real receipts + the omission law, live', () => {
  it('mounts ≥ 3 example sections and three receipts, each rendering every valued row as label + value', async () => {
    await raf()
    expect(document.querySelectorAll('[data-page-content] > section').length).toBeGreaterThanOrEqual(3)
    const receipts = [...document.querySelectorAll('.demo-grid ui-description-list')]
    expect(receipts.length).toBe(3)
    expect(rowsOf(receipts[0])).toBe(8)
    expect(rowsOf(receipts[1])).toBe(6)
    expect(rowsOf(receipts[2])).toBe(6)
    const first = receipts[0].querySelector('[data-part="row"]')
    expect(first?.querySelector('[data-part="label"]')?.textContent).toBe('Hotel')
    expect(first?.querySelector('[data-part="value"]')?.textContent).toBe('Hotel Aurora, Reykjavík')
  })

  it('the live specimen renders only the two valued rows of seven, grows in place, and empties on garbage', async () => {
    await raf()
    const live = [...document.querySelectorAll('ui-description-list')].find((l) => l.closest('section')?.textContent?.includes('omission law'))!
    expect(live).toBeTruthy()
    expect(rowsOf(live), 'valueless rows leaked on first render').toBe(2)
    const log = document.querySelector('ul.event-log[aria-live="polite"]') as HTMLUListElement
    expect(log.children.length).toBe(0)

    clickByText('All fields answered (7 entries)')
    await raf()
    expect(rowsOf(live)).toBe(7)
    expect([...live.querySelectorAll('[data-part="label"]')].map((l) => l.textContent)).toEqual([
      'Room', 'Nights', 'Late checkout', 'Promo code', 'Dietary note', 'Airport pickup', 'Breakfast',
    ])
    expect(log.children[0].textContent).toContain('rendered 7 rows')

    clickByText('Gathered so far (7 entries, 5 valueless)')
    await raf()
    expect(rowsOf(live)).toBe(2)
    expect(log.children[1].textContent).toContain('(7 entries)  →  rendered 2 rows')

    clickByText('Malformed bind (a string, not an array)')
    await raf()
    expect(rowsOf(live), 'a malformed bind should render zero rows, never throw').toBe(0)
    expect(log.children.length).toBe(3)
  })

  it('finite numbers print via Intl (grouping) — 128450 renders with a separator', async () => {
    await raf()
    const values = [...document.querySelectorAll('[data-part="value"]')].map((v) => v.textContent ?? '')
    expect(values.some((v) => /128[,.\s  ]450/.test(v)), `no grouped 128450 among ${values.join(' | ')}`).toBe(true)
  })
})
