import { describe, it, expect, vi } from 'vitest'
// Side-effect import: the demo page mounts the app shell + the live ui-ramp specimens into document.body
// (mountPage appends to `#app ?? document.body`; the modal-demo.browser.test.ts precedent).
import './ramp-demo.ts'

vi.setConfig({ testTimeout: 30_000 }) // REAL-TIMING HEADROOM (GH #347): rAF settles stretch under host load

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

const clickByText = (text: string): void => {
  const btn = [...document.querySelectorAll('ui-button')].find((b) => b.textContent?.trim() === text)
  if (!btn) throw new Error(`no ui-button found with text "${text}"`)
  ;(btn as HTMLElement).click()
}

describe('ramp-demo — the brand-ramp review mounts the REAL control and the family switcher round-trips', () => {
  it('mounts the live ui-ramp strips, each rendering one cell per step, across ≥2 example sections', async () => {
    await raf()
    const ramps = [...document.querySelectorAll('ui-ramp')]
    expect(ramps.length).toBeGreaterThanOrEqual(8)
    for (const r of ramps) {
      const steps = JSON.parse(r.getAttribute('steps') ?? '[]') as unknown[]
      expect(r.querySelectorAll('[data-part="cell"]').length, `ramp "${r.getAttribute('label')}" cell count`).toBe(steps.length)
    }
    expect(document.querySelectorAll('section > h2').length).toBeGreaterThanOrEqual(2)
    expect(document.querySelector('ul.event-log[aria-live="polite"]')).not.toBeNull()
  })

  it('the model-driven family buttons rewrite steps on the live strip and the review log records it', async () => {
    await raf()
    const log = document.querySelector('ul.event-log') as HTMLUListElement
    const before = log.querySelectorAll('li').length
    clickByText('neutral')
    await raf()
    const live = [...document.querySelectorAll('ui-ramp')].find((r) => r.getAttribute('label') === 'neutral tonal ramp')
    expect(live, 'the live strip should now be labelled as the neutral family').toBeDefined()
    const steps = JSON.parse(live!.getAttribute('steps') ?? '[]') as { value: string }[]
    expect(steps.every((s) => s.value.startsWith('--md-sys-color-neutral-'))).toBe(true)
    expect(live!.querySelectorAll('[data-part="cell"]').length).toBe(steps.length)
    expect(log.querySelectorAll('li').length).toBe(before + 1)
    expect(log.lastElementChild?.textContent).toContain('neutral')
  })
})
