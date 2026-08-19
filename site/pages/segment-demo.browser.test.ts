import { describe, it, expect, vi } from 'vitest'
// Side-effect import: the demo page mounts the app shell + the live ui-segment specimens into document.body
// (mountPage appends to `#app ?? document.body`; the modal-demo.browser.test.ts precedent).
import './segment-demo.ts'

// GH #347 — REAL-TIMING HEADROOM (rAF settles under concurrent host load).
vi.setConfig({ testTimeout: 30_000 })

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

describe('segment-demo — the ui-segment leaf mounts inside a real ui-segmented-control with a live event log', () => {
  it('mounts the view switcher: a real host holding three ui-segment leaves, one checked', async () => {
    await raf()
    const host = document.querySelector('ui-segmented-control[name="view"]')
    expect(host, 'the view-switcher ui-segmented-control should be on the page').not.toBeNull()
    expect(customElements.get('ui-segment'), 'ui-segment must be a defined custom element').toBeDefined()
    const leaves = [...host!.querySelectorAll('ui-segment')]
    expect(leaves.length).toBe(3)
    expect(leaves.filter((l) => l.hasAttribute('checked')).length, 'exactly one leaf starts checked').toBe(1)
  })

  it('renders the event log + at least two example sections', () => {
    const log = document.querySelector('ul.event-log')
    expect(log, 'the change event log should be on the page').not.toBeNull()
    expect(log!.getAttribute('aria-live')).toBe('polite')
    expect(document.querySelectorAll('section > h2').length).toBeGreaterThanOrEqual(2)
  })

  it('a USER click on a leaf commits: the host re-emits change, the log records it, and the view swaps', async () => {
    await raf()
    const host = document.querySelector('ui-segmented-control[name="view"]') as HTMLElement
    const board = host.querySelector('ui-segment[value="board"]') as HTMLElement
    const log = document.querySelector('ul.event-log') as HTMLElement
    const before = log.children.length
    board.click()
    await raf()
    expect(board.hasAttribute('checked'), 'the clicked leaf becomes the checked one').toBe(true)
    expect(log.children.length, 'the click should append at least one log line').toBeGreaterThan(before)
    expect(log.textContent).toContain('"board"')
    const pane = document.querySelector('.demo-box[aria-live]') as HTMLElement
    expect(pane.textContent).toContain('Board view')
  })
})
