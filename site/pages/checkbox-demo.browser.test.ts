import { describe, it, expect, vi } from 'vitest'
// Side-effect import: the demo page mounts the app shell + the live ui-checkbox scenario into document.body
// (mountPage appends to `#app ?? document.body`; the modal-demo.browser.test.ts precedent).
import './checkbox-demo.ts'

// REAL-TIMING HEADROOM (GH #347): awaits rAF settles, so duration follows the browser's scheduling under load.
vi.setConfig({ testTimeout: 30_000 })

// checkbox-demo.browser.test.ts — page-level proof for the ui-checkbox demo (checkbox-demo.html): the REAL
// control mounts (not a mock), the tri-state parent derives `indeterminate` from its children, and the event
// log is wired to the control's input/change contract. Runs in both Chromium and WebKit (the `site` project).

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
type Tri = HTMLElement & { indeterminate: boolean }

const byLabel = (label: string): HTMLElement => {
  const box = [...document.querySelectorAll('ui-checkbox')].find((c) => c.textContent?.trim() === label)
  if (!box) throw new Error(`no ui-checkbox labelled "${label}"`)
  return box as HTMLElement
}

describe('checkbox-demo — the real ui-checkbox scenario mounts and its event log is wired', () => {
  it('mounts the real control, ≥2 example sections, and an aria-live event log', async () => {
    await raf()
    expect(customElements.get('ui-checkbox'), 'ui-checkbox must be a defined custom element').toBeDefined()
    expect(document.querySelectorAll('ui-checkbox').length).toBeGreaterThanOrEqual(6)
    expect(document.querySelectorAll('section').length).toBeGreaterThanOrEqual(2)
    const log = document.querySelector('ul.event-log')
    expect(log?.getAttribute('aria-live')).toBe('polite')
  })

  it('the parent starts indeterminate (some children checked) and a child toggle logs input + change', async () => {
    await raf()
    const parent = byLabel('All permissions') as Tri
    expect(parent.indeterminate, 'two of five children start checked ⇒ parent mixed').toBe(true)
    expect(parent.hasAttribute('checked')).toBe(false)

    const log = document.querySelector('ul.event-log') as HTMLUListElement
    const before = log.children.length
    byLabel('Edit documents').click()
    await raf()
    expect(log.children.length - before, 'a click logs input AND change').toBe(2)
    expect(log.lastElementChild?.textContent).toContain('edit  change  →  checked=true')
  })

  it('checking the parent fans out to every enabled child and clears indeterminate', async () => {
    await raf()
    const parent = byLabel('All permissions') as Tri
    parent.click()
    await raf()
    expect(parent.indeterminate).toBe(false)
    expect(parent.hasAttribute('checked')).toBe(true)
    for (const label of ['Comment on documents', 'Edit documents', 'Share outside the workspace', 'Manage billing']) {
      expect(byLabel(label).hasAttribute('checked'), `${label} should follow the parent`).toBe(true)
    }
  })
})
