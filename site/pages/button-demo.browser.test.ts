import { describe, it, expect, vi } from 'vitest'
// Side-effect import: the demo page mounts the app shell + the live ui-button specimens into document.body
// (mountPage appends to `#app ?? document.body`; the modal-demo.browser.test.ts precedent).
import './button-demo.ts'

// GH #347 — REAL-TIMING HEADROOM (rAF frame settles stretch under concurrent host load; vitest.browser.config.ts).
vi.setConfig({ testTimeout: 30_000 })

// button-demo.browser.test.ts — the PAGE-LEVEL proof for the ui-button demo (the control-tier `demo`): the REAL
// control mounts (upgraded, incl. icon-only + disabled specimens), the click event log is wired (a click on an
// enabled button lands one line, a click on the disabled Publish lands none), and the page carries its sections.

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
const byText = (text: string): HTMLElement => {
  const b = [...document.querySelectorAll('ui-button')].find((n) => n.textContent?.trim() === text)
  if (!b) throw new Error(`no ui-button "${text}"`)
  return b as HTMLElement
}

describe('button-demo — the real control mounts, the click log is wired, the sections exist', () => {
  it('mounts upgraded ui-button specimens incl. icon-only + disabled ones', async () => {
    await raf()
    expect(customElements.get('ui-button')).toBeDefined()
    expect(document.querySelectorAll('ui-button').length).toBeGreaterThanOrEqual(12)
    expect(document.querySelectorAll('ui-button[icon-only][aria-label]').length).toBeGreaterThanOrEqual(3)
    expect(document.querySelectorAll('ui-button[disabled]').length).toBeGreaterThanOrEqual(1)
  })

  it('logs a click on an enabled button; the disabled Publish stays silent', async () => {
    await raf()
    const log = document.querySelector('ul.event-log')
    expect(log, 'the click event log').not.toBeNull()
    expect(log?.getAttribute('aria-live')).toBe('polite')
    const before = log!.children.length
    byText('Save draft').click()
    expect(log!.children.length).toBe(before + 1)
    expect(log!.lastElementChild?.textContent).toContain('Save draft')
    // The disabled Publish is inert for a USER: pointer-inert (no real click can reach it) and out of the tab order.
    const publish = byText('Publish')
    expect(publish.hasAttribute('disabled')).toBe(true)
    expect(getComputedStyle(publish).pointerEvents).toBe('none')
    expect(publish.hasAttribute('tabindex')).toBe(false)
  })

  it('the readiness switch unlocks Publish (removes disabled)', async () => {
    await raf()
    const sw = document.querySelector('ui-switch') as HTMLElement
    expect(sw).not.toBeNull()
    sw.click()
    await raf()
    expect(sw.hasAttribute('checked')).toBe(true)
    expect(byText('Publish').hasAttribute('disabled')).toBe(false)
  })

  it('carries at least two example sections', () => {
    expect(document.querySelectorAll('[data-page-content] > section').length).toBeGreaterThanOrEqual(2)
  })
})
