import { describe, it, expect, vi } from 'vitest'
// Side-effect import: the demo page mounts the app shell + the live ui-otp-field verification step into
// document.body (the modal-demo.browser.test.ts precedent).
import './otp-field-demo.ts'
import type { UIOtpFieldElement } from '@agent-ui/components/components'

// GH #347 — REAL-TIMING HEADROOM (vitest.browser.config.ts).
vi.setConfig({ testTimeout: 30_000 })

// otp-field-demo.browser.test.ts — the PAGE-LEVEL proof for the ui-otp-field demo: the REAL control mounts (the
// one-editor/N-cell anatomy), Verify on an incomplete code is blocked (required → valueMissing + the page
// status), a programmatic full-code write fires no events and is verified only when the page asks, and the
// event log + example sections are present.

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
const button = (text: string): HTMLElement => {
  const b = [...document.querySelectorAll('ui-button')].find((n) => n.textContent?.trim() === text)
  if (!b) throw new Error(`no ui-button "${text}"`)
  return b as HTMLElement
}

describe('otp-field-demo — the real control mounts, Verify validates, the log is wired', () => {
  it('mounts the upgraded ui-otp-field with six cells and one editor part', async () => {
    await raf()
    expect(customElements.get('ui-otp-field')).toBeDefined()
    const otp = document.querySelector('ui-otp-field[name="code"]') as UIOtpFieldElement
    expect(otp).not.toBeNull()
    expect(otp.querySelectorAll('[data-part="cell"]').length).toBe(6)
    expect(otp.querySelectorAll('[data-part="editor"]').length).toBe(1)
    expect(document.querySelectorAll('ui-otp-field').length).toBeGreaterThanOrEqual(5)
    expect(document.querySelector('ui-otp-field[length="8"]')).not.toBeNull()
  })

  it('Verify on an incomplete code is blocked (required → valueMissing) and logs a verify line only', async () => {
    await raf()
    const log = document.querySelector('ul.event-log')!
    expect(log.getAttribute('aria-live')).toBe('polite')
    const otp = document.querySelector('ui-otp-field[name="code"]') as UIOtpFieldElement
    const before = log.children.length
    button('Verify').click()
    expect(otp.validity.valueMissing).toBe(true)
    expect(document.body.textContent).toContain('Enter all 6 digits.')
    expect(log.children.length).toBe(before + 1)
    expect(log.lastElementChild?.textContent).toContain('verify  blocked')
  })

  it('a programmatic full-code write fires no events; Verify then adjudicates and clears a mismatch', async () => {
    await raf()
    const log = document.querySelector('ul.event-log')!
    const otp = document.querySelector('ui-otp-field[name="code"]') as UIOtpFieldElement
    const before = log.children.length
    otp.value = '000000' // programmatic — no input/change; completion-commit is a USER path only
    expect(log.children.length).toBe(before)
    button('Verify').click()
    expect(log.lastElementChild?.textContent).toMatch(/verify {2}(MISMATCH|OK)/)
    if (log.lastElementChild?.textContent?.includes('MISMATCH')) expect(otp.value).toBe('')
  })

  it('carries at least two example sections', () => {
    expect(document.querySelectorAll('[data-page-content] > section').length).toBeGreaterThanOrEqual(2)
  })
})
