import { describe, it, expect, vi } from 'vitest'
// Side-effect import: the demo page mounts the app shell + the live ui-toggle specimens into document.body
// (the modal-demo.browser.test.ts precedent).
import './toggle-demo.ts'

// GH #347 — REAL-TIMING HEADROOM (vitest.browser.config.ts).
vi.setConfig({ testTimeout: 30_000 })

// toggle-demo.browser.test.ts — the PAGE-LEVEL proof for the ui-toggle demo: the REAL pill mounts, a press flips
// `pressed` and lands one line in the log, and the page's min-one rule REFUSES hiding the last shown pane
// (toggle's cancelable-before-commit contract) — pressed stays, the log says REFUSED.

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0))
const pane = (label: string): HTMLElement => {
  const t = [...document.querySelectorAll('ui-toggle')].find((n) => n.textContent?.trim() === label)
  if (!t) throw new Error(`no ui-toggle "${label}"`)
  return t as HTMLElement
}

describe('toggle-demo — the real pill mounts, presses log, the min-one rule refuses the last pane', () => {
  it('mounts upgraded ui-toggle specimens', async () => {
    await raf()
    expect(customElements.get('ui-toggle')).toBeDefined()
    expect(document.querySelectorAll('ui-toggle').length).toBeGreaterThanOrEqual(8)
    expect(document.querySelectorAll('ui-toggle [slot="state-icon"]').length).toBe(3)
  })

  it('a press flips pressed and lands one committed line; hiding the last pane is refused', async () => {
    await raf()
    const log = document.querySelector('ul.event-log')!
    expect(log.getAttribute('aria-live')).toBe('polite')
    const chat = pane('Chat')
    const settings = pane('Settings')
    expect(chat.hasAttribute('pressed')).toBe(true)
    const before = log.children.length
    settings.click() // Settings off — Chat still shown ⇒ commits
    await tick()
    expect(settings.hasAttribute('pressed')).toBe(false)
    expect(log.children.length).toBe(before + 1)
    expect(log.lastElementChild?.textContent).toContain('committed')
    chat.click() // Chat is now the LAST shown pane ⇒ refused
    await tick()
    expect(chat.hasAttribute('pressed'), 'min-one: the last shown pane must stay pressed').toBe(true)
    expect(log.lastElementChild?.textContent).toContain('REFUSED')
  })

  it('carries at least two example sections', () => {
    expect(document.querySelectorAll('[data-page-content] > section').length).toBeGreaterThanOrEqual(2)
  })
})
