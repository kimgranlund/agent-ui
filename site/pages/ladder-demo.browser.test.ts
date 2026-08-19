import { describe, it, expect, vi } from 'vitest'
// Side-effect import: the demo page mounts the app shell + the live ui-ladder specimens into document.body
// (mountPage appends to `#app ?? document.body`; the modal-demo.browser.test.ts precedent).
import './ladder-demo.ts'

vi.setConfig({ testTimeout: 30_000 }) // REAL-TIMING HEADROOM (GH #347): rAF settles stretch under host load

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

const clickByText = (text: string): void => {
  const btn = [...document.querySelectorAll('ui-button')].find((b) => b.textContent?.trim() === text)
  if (!btn) throw new Error(`no ui-button found with text "${text}"`)
  ;(btn as HTMLElement).click()
}

describe('ladder-demo — the dimensional-token review mounts the REAL control and the density switch round-trips', () => {
  it('mounts the live ui-ladder lists, each rendering one bar per tier, across ≥2 example sections', async () => {
    await raf()
    const ladders = [...document.querySelectorAll('ui-ladder')]
    expect(ladders.length).toBeGreaterThanOrEqual(6)
    for (const l of ladders) {
      const tiers = JSON.parse(l.getAttribute('tiers') ?? '[]') as unknown[]
      expect(l.querySelectorAll('[data-part="bar"]').length, `ladder "${l.getAttribute('label')}" bar count`).toBe(tiers.length)
    }
    expect(document.querySelectorAll('section > h2').length).toBeGreaterThanOrEqual(2)
    expect(document.querySelector('ul.event-log[aria-live="polite"]')).not.toBeNull()
  })

  it('a --var tier resolves to a real, non-zero bar length (the browser does the math, never the ladder)', async () => {
    await raf()
    const spacing = [...document.querySelectorAll('ui-ladder')].find((l) => l.getAttribute('label') === 'Spacing scale')
    expect(spacing).toBeDefined()
    const bars = [...spacing!.querySelectorAll('[data-part="bar"]')] as HTMLElement[]
    const widths = bars.map((b) => b.getBoundingClientRect().width)
    expect(widths.every((w) => w > 0), `bar widths ${widths.join(',')}`).toBe(true)
    // strictly ascending — the spacing scale is monotonic and no cross-tier normalization flattens it
    for (let i = 1; i < widths.length; i += 1) expect(widths[i]).toBeGreaterThan(widths[i - 1])
  })

  it('the model-driven density buttons rewrite tiers on the live ladder and the review log records it', async () => {
    await raf()
    const log = document.querySelector('ul.event-log') as HTMLUListElement
    const before = log.querySelectorAll('li').length
    clickByText('compact')
    await raf()
    const live = [...document.querySelectorAll('ui-ladder')].find((l) => l.getAttribute('label') === 'List density (compact)')
    expect(live, 'the live ladder should now be labelled compact').toBeDefined()
    const tiers = JSON.parse(live!.getAttribute('tiers') ?? '[]') as { label: string; value: string }[]
    expect(tiers.find((t) => t.label === 'row')?.value).toBe('32px')
    expect(live!.querySelectorAll('[data-part="bar"]').length).toBe(tiers.length)
    expect(log.querySelectorAll('li').length).toBe(before + 1)
    expect(log.lastElementChild?.textContent).toContain('compact')
  })
})
