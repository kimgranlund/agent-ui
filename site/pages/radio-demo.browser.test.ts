import { describe, it, expect, vi } from 'vitest'
// Side-effect import: the demo page mounts the app shell + the live ui-radio-group scenario into document.body
// (mountPage appends to `#app ?? document.body`; the modal-demo.browser.test.ts precedent).
import './radio-demo.ts'

// REAL-TIMING HEADROOM (GH #347): awaits rAF settles, so duration follows the browser's scheduling under load.
vi.setConfig({ testTimeout: 30_000 })

// radio-demo.browser.test.ts — page-level proof for the ui-radio demo (radio-demo.html): REAL radios mount inside
// a REAL ui-radio-group (not mocked), the group's exclusivity + change surface work from a click, and the event
// log records both the leaf's and the group's events. Runs in Chromium and WebKit (the `site` project).

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
type Group = HTMLElement & { value: string | null }

const group = (): Group => {
  const g = document.querySelector('ui-radio-group[name="shipping"]')
  if (!g) throw new Error('no ui-radio-group[name="shipping"]')
  return g as Group
}
const radio = (value: string): HTMLElement => {
  const r = group().querySelector(`ui-radio[value="${value}"]`)
  if (!r) throw new Error(`no ui-radio[value="${value}"] in the group`)
  return r as HTMLElement
}

describe('radio-demo — real radios inside a real ui-radio-group, event log wired', () => {
  it('mounts the real controls, ≥2 example sections, and an aria-live event log', async () => {
    await raf()
    expect(customElements.get('ui-radio')).toBeDefined()
    expect(customElements.get('ui-radio-group')).toBeDefined()
    expect(group().querySelectorAll('ui-radio').length).toBe(3)
    expect(document.querySelectorAll('section').length).toBeGreaterThanOrEqual(2)
    expect(document.querySelector('ul.event-log')?.getAttribute('aria-live')).toBe('polite')
    expect(group().value, 'Express is checked by default').toBe('express')
  })

  it('clicking another radio moves the selection exclusively and logs leaf + group events', async () => {
    await raf()
    const log = document.querySelector('ul.event-log') as HTMLUListElement
    const before = log.children.length
    radio('pickup').click()
    await raf()
    expect(group().value).toBe('pickup')
    expect(radio('pickup').hasAttribute('checked')).toBe(true)
    expect(radio('express').hasAttribute('checked'), 'exclusivity: the old selection unchecks').toBe(false)
    const lines = [...log.children].slice(before).map((li) => li.textContent ?? '')
    expect(lines.some((l) => l.includes('radio[pickup]  change'))).toBe(true)
    expect(lines.some((l) => l.includes('group  change  →  value="pickup"'))).toBe(true)
  })

  it('clicking the already-checked radio is guarded (no deselect, no group change)', async () => {
    await raf()
    const log = document.querySelector('ul.event-log') as HTMLUListElement
    const before = log.children.length
    radio('pickup').click()
    await raf()
    expect(group().value).toBe('pickup')
    expect(radio('pickup').hasAttribute('checked')).toBe(true)
    expect(log.children.length, 'a guarded click logs nothing').toBe(before)
  })
})
