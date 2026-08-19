import { describe, it, expect } from 'vitest'
// Side-effect import: the demo page mounts the app shell + the live ui-column scenarios into document.body
// (mountPage appends to `#app ?? document.body`; the modal-demo.browser.test.ts precedent).
import './column-demo.ts'

// column-demo.browser.test.ts — the PAGE-LEVEL proof for the ui-column demo: the REAL primitive is mounted (not
// mocked) around real ui-cards, the knob rig writes the real attribute (incl. the column-local `stretch`) and the
// aria-live knob log records the flip, and the page carries ≥2 exampleSections. `site` browser project.

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

const knobByText = (text: string): HTMLElement => {
  const btn = [...document.querySelectorAll('ui-button')].find((b) => b.textContent?.trim() === text)
  if (!btn) throw new Error(`no ui-button knob with text "${text}"`)
  return btn as HTMLElement
}

describe('column-demo — the real ui-column is mounted as a card column with live knobs', () => {
  it('mounts a real ui-column stacking three real ui-cards (the release feed)', async () => {
    await raf()
    expect(customElements.get('ui-column')).toBeDefined()
    expect(customElements.get('ui-card')).toBeDefined()
    const feed = [...document.querySelectorAll('ui-column')].find((c) => c.querySelectorAll(':scope > ui-card').length === 3)
    expect(feed, 'the release feed is one ui-column with three direct ui-card children').toBeDefined()
    const style = getComputedStyle(feed as HTMLElement)
    expect(style.display).toBe('flex')
    expect(style.flexDirection).toBe('column')
  })

  it('a gap knob writes the attribute on the scenario columns and the aria-live log records the flip', async () => {
    await raf()
    const log = document.querySelector('ul.event-log')
    expect(log?.getAttribute('aria-live')).toBe('polite')
    expect(log?.children.length).toBe(0)
    knobByText('2xl').click()
    await raf()
    expect(document.querySelectorAll('ui-column[gap="2xl"]').length).toBeGreaterThanOrEqual(2)
    expect(log?.children.length).toBe(1)
    expect(log?.textContent).toContain('gap = "2xl"')
  })

  it('the column-local stretch knob toggles the boolean-presence attribute and logs it', async () => {
    await raf()
    expect(document.querySelectorAll('ui-column[stretch]').length).toBe(0)
    knobByText('stretch: off').click()
    await raf()
    expect(document.querySelectorAll('ui-column[stretch]').length).toBe(2)
    expect(document.querySelector('ul.event-log')?.textContent).toContain('stretch = true')
    knobByText('stretch: on').click()
    await raf()
    expect(document.querySelectorAll('ui-column[stretch]').length).toBe(0)
  })

  it('carries at least two exampleSections with headings', () => {
    const sections = [...document.querySelectorAll('[data-page-content] > section')]
    expect(sections.length).toBeGreaterThanOrEqual(2)
    for (const s of sections) expect(s.querySelector('h2')).not.toBeNull()
  })
})
