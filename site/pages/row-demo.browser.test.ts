import { describe, it, expect } from 'vitest'
// Side-effect import: the demo page mounts the app shell + the live ui-row scenarios into document.body
// (mountPage appends to `#app ?? document.body`; the modal-demo.browser.test.ts precedent).
import './row-demo.ts'

// row-demo.browser.test.ts — the PAGE-LEVEL proof for the ui-row demo: the REAL primitive is mounted (not mocked),
// the knob rig writes the real attribute and the aria-live knob log records the flip, and the page carries the
// ≥2 exampleSections the demo tier requires. Runs in the `site` browser project (Chromium + WebKit).

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

const knobByText = (text: string): HTMLElement => {
  const btn = [...document.querySelectorAll('ui-button')].find((b) => b.textContent?.trim() === text)
  if (!btn) throw new Error(`no ui-button knob with text "${text}"`)
  return btn as HTMLElement
}

describe('row-demo — the real ui-row is mounted with realistic content and live knobs', () => {
  it('mounts real ui-row instances (defined + upgraded), the settings row carrying a real ui-text-field', async () => {
    await raf()
    expect(customElements.get('ui-row'), 'ui-row must self-define via the _page.ts import chain').toBeDefined()
    const rows = [...document.querySelectorAll('ui-row')]
    expect(rows.length).toBeGreaterThanOrEqual(2)
    const settingsRow = rows.find((r) => r.querySelector('ui-text-field'))
    expect(settingsRow, 'the settings form row lays out a real ui-text-field').toBeDefined()
    expect(getComputedStyle(settingsRow as HTMLElement).display, 'a mounted ui-row lays out as flex').toBe('flex')
  })

  it('a gap knob writes the attribute on the scenario rows and the aria-live log records the flip', async () => {
    await raf()
    const log = document.querySelector('ul.event-log')
    expect(log, 'the knob log is an aria-live .event-log').not.toBeNull()
    expect(log?.getAttribute('aria-live')).toBe('polite')
    expect(log?.children.length).toBe(0)
    knobByText('xl').click()
    await raf()
    const rows = [...document.querySelectorAll('ui-row[gap="xl"]')]
    expect(rows.length, 'both scenario rows take the flipped gap').toBeGreaterThanOrEqual(2)
    expect(log?.children.length).toBe(1)
    expect(log?.textContent).toContain('gap = "xl"')
  })

  it('the wrap knob toggles the boolean-presence attribute and logs true/false', async () => {
    await raf()
    const before = document.querySelectorAll('ui-row[wrap]').length
    knobByText('wrap: off').click()
    await raf()
    expect(document.querySelectorAll('ui-row[wrap]').length).toBeGreaterThan(before)
    const log = document.querySelector('ul.event-log')
    expect(log?.textContent).toContain('wrap = true')
  })

  it('carries at least two exampleSections with headings', () => {
    const sections = [...document.querySelectorAll('[data-page-content] > section')]
    expect(sections.length).toBeGreaterThanOrEqual(2)
    for (const s of sections) expect(s.querySelector('h2')).not.toBeNull()
  })
})
