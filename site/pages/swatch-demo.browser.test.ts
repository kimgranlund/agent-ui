import { describe, it, expect, vi } from 'vitest'
// Side-effect import: the demo page mounts the app shell + the live ui-swatch specimens into document.body
// (mountPage appends to `#app ?? document.body`; the modal-demo.browser.test.ts precedent).
import './swatch-demo.ts'

vi.setConfig({ testTimeout: 30_000 }) // REAL-TIMING HEADROOM (GH #347): rAF settles stretch under host load

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

const clickByText = (text: string): void => {
  const btn = [...document.querySelectorAll('ui-button')].find((b) => b.textContent?.trim() === text)
  if (!btn) throw new Error(`no ui-button found with text "${text}"`)
  ;(btn as HTMLElement).click()
}

describe('swatch-demo — the palette review mounts the REAL control and the scheme pin round-trips', () => {
  it('mounts many live ui-swatch specimens, each with a rendered box part, across ≥2 example sections', async () => {
    await raf()
    const swatches = [...document.querySelectorAll('ui-swatch')]
    expect(swatches.length).toBeGreaterThanOrEqual(15)
    for (const s of swatches) {
      expect(s.querySelector('[data-part="box"]'), 'a swatch without its box part').not.toBeNull()
    }
    expect(document.querySelectorAll('section > h2').length).toBeGreaterThanOrEqual(2)
    expect(document.querySelector('ul.event-log[aria-live="polite"]')).not.toBeNull()
  })

  it('the model-driven scheme buttons re-pin the row and the review log records the write', async () => {
    await raf()
    const log = document.querySelector('ul.event-log') as HTMLUListElement
    const before = log.querySelectorAll('li').length
    clickByText('scheme=dark')
    await raf()
    const pinned = [...document.querySelectorAll('ui-swatch[scheme="dark"]')]
    expect(pinned.length).toBe(4)
    expect(log.querySelectorAll('li').length).toBe(before + 1)
    expect(log.lastElementChild?.textContent).toContain('scheme=dark')
    clickByText('scheme=auto')
    await raf()
    expect(document.querySelectorAll('ui-swatch[scheme="dark"]').length).toBe(0)
  })
})
