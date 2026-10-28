import { describe, it, expect, afterEach } from 'vitest'
import { page } from 'vitest/browser'
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

afterEach(async () => {
  await page.viewport(414, 896) // restore the fleet default (ADR-0150 cl.5)
})

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

  // T-0496 (found by T-0488 F5): at 400px the trailing actions squeezed ("Mess...") and a badge's glyph + label
  // painted past its host. The name/email column is the row's one flexible item, so it yields, never the actions.
  it('at 400px every contact-row button label and badge content fits its host (no ellipsis, no paint past the edge)', async () => {
    await page.viewport(400, 900)
    await raf()
    const contactList = [...document.querySelectorAll('ui-list')].find((l) => l.querySelector('ui-avatar')) as HTMLElement
    const items = [...contactList.querySelectorAll(':scope > [role="listitem"]')]
    expect(items.length, 'anti-vacuous: the four contact rows').toBe(4)
    const label = (host: Element): HTMLElement => {
      const span = [...host.querySelectorAll('span')].find((e) => e.textContent?.trim()) as HTMLElement | undefined
      if (!span) throw new Error(`no text span in <${host.localName}>`)
      return span
    }
    for (const item of items) {
      const row = item.getBoundingClientRect()
      const button = item.querySelector('ui-button') as HTMLElement
      const text = label(button)
      expect(text.scrollWidth, `"${text.textContent}" is truncated (scrollWidth > clientWidth)`).toBeLessThanOrEqual(text.clientWidth)
      const badge = item.querySelector('ui-badge') as HTMLElement
      const host = badge.getBoundingClientRect()
      for (const part of badge.querySelectorAll('*')) {
        const box = part.getBoundingClientRect()
        if (box.width === 0) continue
        expect(box.right, `a <${part.localName}> in the "${label(badge).textContent}" badge paints past its host`).toBeLessThanOrEqual(host.right + 0.5)
      }
      expect(badge.scrollWidth, 'the badge host clips its own content').toBeLessThanOrEqual(badge.clientWidth)
      for (const child of item.children) {
        expect(child.getBoundingClientRect().right, `<${child.localName}> passes the row's end edge`).toBeLessThanOrEqual(row.right + 0.5)
      }
    }
  })
})
