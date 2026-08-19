import { describe, it, expect, vi } from 'vitest'
// Side-effect import: the demo page mounts the app shell + the live ui-text-field form into document.body
// (the modal-demo.browser.test.ts precedent).
import './text-field-demo.ts'
import type { UITextFieldElement } from '@agent-ui/components/components'

// GH #347 — REAL-TIMING HEADROOM (vitest.browser.config.ts).
vi.setConfig({ testTimeout: 30_000 })

// text-field-demo.browser.test.ts — the PAGE-LEVEL proof for the ui-text-field demo: the REAL typed fields mount
// (every type variant the form uses), Save with the required fields empty is BLOCKED (reportValidity() paints
// valueMissing) while a programmatic write logs nothing, and a user-shaped edit lands an `input` line in the log.

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
const field = (label: string): UITextFieldElement => {
  const f = document.querySelector(`ui-text-field[label="${label}"]`)
  if (!f) throw new Error(`no ui-text-field "${label}"`)
  return f as UITextFieldElement
}
const button = (text: string): HTMLElement => {
  const b = [...document.querySelectorAll('ui-button')].find((n) => n.textContent?.trim() === text)
  if (!b) throw new Error(`no ui-button "${text}"`)
  return b as HTMLElement
}

describe('text-field-demo — the real typed fields mount, the log is wired, Save validates', () => {
  it('mounts upgraded ui-text-field specimens across the typed variants', async () => {
    await raf()
    expect(customElements.get('ui-text-field')).toBeDefined()
    expect(document.querySelectorAll('ui-text-field').length).toBeGreaterThanOrEqual(12)
    for (const type of ['email', 'tel', 'url', 'currency', 'number', 'percent', 'date', 'password', 'search']) {
      expect(document.querySelector(`ui-text-field[type="${type}"]`), `a type="${type}" field`).not.toBeNull()
    }
    expect(document.querySelector('ui-text-field[required]')).not.toBeNull()
  })

  it('Save with the required fields empty is blocked and paints valueMissing; a programmatic write logs nothing', async () => {
    await raf()
    const log = document.querySelector('ul.event-log')!
    expect(log.getAttribute('aria-live')).toBe('polite')
    const before = log.children.length
    button('Save vendor').click()
    expect(field('Vendor name').validity.valueMissing).toBe(true)
    expect(document.body.textContent).toContain('Blocked —')
    expect(log.lastElementChild?.textContent).toContain('blocked')
    const mid = log.children.length
    expect(mid).toBe(before + 1)
    field('Vendor name').value = 'Acme Fasteners Ltd' // programmatic — no input/change
    expect(log.children.length).toBe(mid)
  })

  it('a user-shaped edit on the editor part lands an input line', async () => {
    await raf()
    const log = document.querySelector('ul.event-log')!
    const before = log.children.length
    const editor = field('Phone').querySelector('[data-part="editor"]') as HTMLElement
    editor.focus()
    editor.textContent = '+1 555 0100'
    editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: '0' }))
    await raf()
    expect(log.children.length).toBeGreaterThan(before)
    expect([...log.children].some((li) => li.textContent?.includes('input') && li.textContent.includes('Phone'))).toBe(true)
  })

  it('carries at least two example sections', () => {
    expect(document.querySelectorAll('[data-page-content] > section').length).toBeGreaterThanOrEqual(2)
  })
})
