import { describe, it, expect, vi } from 'vitest'
// Side-effect import: the demo page mounts the app shell + the live ui-textarea form into document.body
// (the modal-demo.browser.test.ts precedent).
import './textarea-demo.ts'
import type { UITextareaElement } from '@agent-ui/components/components'

// GH #347 — REAL-TIMING HEADROOM (vitest.browser.config.ts).
vi.setConfig({ testTimeout: 30_000 })

// textarea-demo.browser.test.ts — the PAGE-LEVEL proof for the ui-textarea demo: the REAL multi-line control
// mounts (required + rows + readonly + disabled specimens), Submit on the empty required description is BLOCKED
// (reportValidity() → valueMissing), the template button seeds via selectToEnd() WITHOUT logging input/change,
// and a user-shaped edit lands an `input` line + moves the character budget.

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
const area = (label: string): UITextareaElement => {
  const a = document.querySelector(`ui-textarea[label="${label}"]`)
  if (!a) throw new Error(`no ui-textarea "${label}"`)
  return a as UITextareaElement
}
const button = (text: string): HTMLElement => {
  const b = [...document.querySelectorAll('ui-button')].find((n) => n.textContent?.trim() === text)
  if (!b) throw new Error(`no ui-button "${text}"`)
  return b as HTMLElement
}

describe('textarea-demo — the real control mounts, Submit validates, the log is wired', () => {
  it('mounts upgraded ui-textarea specimens (required · rows · readonly · disabled)', async () => {
    await raf()
    expect(customElements.get('ui-textarea')).toBeDefined()
    expect(document.querySelectorAll('ui-textarea').length).toBeGreaterThanOrEqual(7)
    expect(document.querySelector('ui-textarea[required][rows="4"]')).not.toBeNull()
    expect(document.querySelector('ui-textarea[readonly]')).not.toBeNull()
    expect(document.querySelector('ui-textarea[disabled]')).not.toBeNull()
  })

  it('Submit with the empty required description is blocked; the template seeds without logging input/change', async () => {
    await raf()
    const log = document.querySelector('ul.event-log')!
    expect(log.getAttribute('aria-live')).toBe('polite')
    button('Submit ticket').click()
    expect(area('What happened?').validity.valueMissing).toBe(true)
    expect(document.body.textContent).toContain('Blocked — the description is required.')
    const before = log.children.length
    button('Insert numbered template').click()
    expect(area('Steps to reproduce').value.startsWith('1. Open the vendor record\n')).toBe(true)
    expect(log.children.length).toBe(before + 1) // ONE page-authored "model" line, no input/change lines
    expect(log.lastElementChild?.textContent).toContain('selectToEnd()')
  })

  it('a user-shaped edit on the editor part lands an input line and the character budget reads', async () => {
    await raf()
    const log = document.querySelector('ul.event-log')!
    const before = log.children.length
    const editor = area('What happened?').querySelector('[data-part="editor"]') as HTMLElement
    editor.focus()
    editor.textContent = 'Save fails silently'
    editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: 'y' }))
    await raf()
    expect(log.children.length).toBeGreaterThan(before)
    expect([...log.children].some((li) => li.textContent?.includes('input') && li.textContent.includes('What happened?'))).toBe(true)
    expect(document.body.textContent).toContain('characters left')
  })

  it('carries at least two example sections', () => {
    expect(document.querySelectorAll('[data-page-content] > section').length).toBeGreaterThanOrEqual(2)
  })
})
