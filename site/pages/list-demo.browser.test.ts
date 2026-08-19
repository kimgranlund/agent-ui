import { describe, it, expect } from 'vitest'
// Side-effect import: the demo page mounts the app shell + the live ui-list scenarios into document.body
// (mountPage appends to `#app ?? document.body`; the modal-demo.browser.test.ts precedent).
import './list-demo.ts'

// list-demo.browser.test.ts — the PAGE-LEVEL proof for the ui-list demo: the REAL semantic stack is mounted (not
// mocked) — role="list" through ElementInternals, so NO host `role` attribute — around listitem rows carrying real
// ui-avatar / ui-badge content; the knob rig writes the real attribute and the aria-live knob log records the flip;
// the page carries ≥2 exampleSections. `site` browser project.

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

const knobByText = (text: string): HTMLElement => {
  const btn = [...document.querySelectorAll('ui-button')].find((b) => b.textContent?.trim() === text)
  if (!btn) throw new Error(`no ui-button knob with text "${text}"`)
  return btn as HTMLElement
}

describe('list-demo — the real ui-list is mounted as a contact list with live knobs', () => {
  it('mounts a real ui-list of four listitem rows, each with a real ui-avatar and ui-badge; the host carries no role attribute', async () => {
    await raf()
    expect(customElements.get('ui-list')).toBeDefined()
    const contactList = [...document.querySelectorAll('ui-list')].find((l) => l.querySelector('ui-avatar'))
    expect(contactList, 'the contact list holds real ui-avatar rows').toBeDefined()
    const items = [...(contactList as HTMLElement).querySelectorAll(':scope > [role="listitem"]')]
    expect(items.length).toBe(4)
    for (const item of items) {
      expect(item.querySelector('ui-avatar')).not.toBeNull()
      expect(item.querySelector('ui-badge')).not.toBeNull()
    }
    expect(contactList?.hasAttribute('role'), 'role=list lives in ElementInternals, never a host attribute').toBe(false)
    expect(getComputedStyle(contactList as HTMLElement).flexDirection).toBe('column')
  })

  it('a gap knob writes the attribute on the scenario lists and the aria-live log records the flip', async () => {
    await raf()
    const log = document.querySelector('ul.event-log')
    expect(log?.getAttribute('aria-live')).toBe('polite')
    expect(log?.children.length).toBe(0)
    knobByText('lg').click()
    await raf()
    expect(document.querySelectorAll('ui-list[gap="lg"]').length).toBeGreaterThanOrEqual(2)
    expect(log?.children.length).toBe(1)
    expect(log?.textContent).toContain('gap = "lg"')
  })

  it('an align knob re-marks the active value solid and writes the attribute', async () => {
    await raf()
    const end = knobByText('end')
    end.click()
    await raf()
    expect(end.getAttribute('variant')).toBe('solid')
    expect(document.querySelectorAll('ui-list[align="end"]').length).toBeGreaterThanOrEqual(2)
    expect(document.querySelector('ul.event-log')?.textContent).toContain('align = "end"')
  })

  it('carries at least two exampleSections with headings', () => {
    const sections = [...document.querySelectorAll('[data-page-content] > section')]
    expect(sections.length).toBeGreaterThanOrEqual(2)
    for (const s of sections) expect(s.querySelector('h2')).not.toBeNull()
  })
})
