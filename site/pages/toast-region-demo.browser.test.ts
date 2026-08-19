import { describe, it, expect, vi } from 'vitest'
// Side-effect import: the demo page mounts the app shell + the live ui-toast-region specimens into document.body
// (mountPage appends to `#app ?? document.body`; the modal-demo.browser.test.ts precedent).
import './toast-region-demo.ts'

// GH #347 — REAL-TIMING HEADROOM. This file awaits real elapsed time (rAF frame settles), so its duration is
// set by the browser's scheduling, which stretches under concurrent host load.
vi.setConfig({ testTimeout: 30_000 })

// toast-region-demo.browser.test.ts — the page-level guard for the ui-toast-region demo: the REAL regions
// mounted, the queue actually stacking through show() (burst → N children, popover open), the dismiss-all
// sweep draining it, per-instance isolation (raising on one region never touches the other), and the stack
// log wired. Runs in BOTH Chromium and WebKit (the `site` browser project).

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

const clickByText = (text: string): void => {
  const btn = [...document.querySelectorAll('ui-button')].find((b) => b.textContent?.trim() === text)
  if (!btn) throw new Error(`no ui-button found with text "${text}"`)
  ;(btn as HTMLElement).click()
}

const regions = (): HTMLElement[] => [...document.querySelectorAll('ui-toast-region')] as HTMLElement[]

describe('toast-region-demo — the live queue page', () => {
  it('mounts the real page: two standing regions, ≥2 example sections, an aria-live event log', async () => {
    await raf()
    expect(regions().length).toBeGreaterThanOrEqual(2)
    expect(document.querySelectorAll('[data-page-content] > section').length).toBeGreaterThanOrEqual(2)
    const log = document.querySelector('ul.event-log')
    expect(log).not.toBeNull()
    expect(log?.getAttribute('aria-live')).toBe('polite')
  })

  it('a burst of five stacks oldest→newest in the primary region and opens its popover; the log records each show', async () => {
    await raf()
    const [primary] = regions()
    clickByText('Raise a burst of five')
    await raf()
    const toasts = primary.querySelectorAll('ui-toast')
    expect(toasts.length).toBe(5)
    expect(primary.matches(':popover-open')).toBe(true)
    expect(toasts[0].textContent).toContain('quarterly-report.pdf') // oldest first (top of the stack)
    const lines = document.querySelectorAll('ul.event-log > li')
    expect(lines.length).toBeGreaterThanOrEqual(5)
    expect([...lines].some((l) => l.textContent?.includes('show'))).toBe(true)
  })

  it('"Dismiss all" drains the stack via each toast\'s own close() and the popover closes', async () => {
    await raf()
    const [primary] = regions()
    clickByText('Dismiss all')
    await raf()
    await raf()
    expect(primary.querySelectorAll('ui-toast').length).toBe(0)
    expect(primary.matches(':popover-open')).toBe(false)
    expect([...document.querySelectorAll('ul.event-log > li')].some((l) => l.textContent?.includes('close'))).toBe(true)
  })

  it('per-instance isolation: raising on the SECOND region never touches the primary', async () => {
    await raf()
    const [primary, second] = regions()
    const before = primary.querySelectorAll('ui-toast').length
    clickByText('Raise on the SECOND region')
    await raf()
    expect(second.querySelectorAll('ui-toast').length).toBe(1)
    expect(primary.querySelectorAll('ui-toast').length).toBe(before)
  })
})
