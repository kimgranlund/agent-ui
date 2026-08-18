import { describe, it, expect, vi } from 'vitest'
// Side-effect import: the demo page mounts the app shell + three live ui-swipers into document.body.
import './swiper-label-demo.ts'

// GH #347 — REAL-TIMING HEADROOM (rAF settles under host load; see vitest.browser.config.ts).
vi.setConfig({ testTimeout: 30_000 })

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

describe('swiper-label-demo — REAL anchors inside REAL ui-swipers; the label id/labelledby wiring is live', () => {
  it('mounts ≥ 2 example sections, three swipers, two of them with a ui-swiper-label the coordinator gave an id', async () => {
    await raf()
    expect(document.querySelectorAll('section').length).toBeGreaterThanOrEqual(2)
    const swipers = [...document.querySelectorAll('ui-swiper')]
    expect(swipers.length).toBe(3)
    const labels = [...document.querySelectorAll('ui-swiper > ui-swiper-label')]
    expect(labels.length).toBe(2)
    for (const label of labels) {
      expect(label.id, 'the owning swiper assigns the anchor an id for aria-labelledby').not.toBe('')
      const track = label.parentElement!.querySelector('[data-part="track"]')!
      expect(track.getAttribute('aria-label')).toBe(label.textContent?.trim())
    }
    const unlabelled = swipers.find((s) => !s.querySelector(':scope > ui-swiper-label'))!
    expect(unlabelled.querySelector('[data-part="track"]')?.getAttribute('aria-label'), 'no anchor ⇒ the "Carousel" fallback').toBe('Carousel')
  })

  it('the model-driven rename edits the anchor text in place (same node, same id) and the probe reads it back', async () => {
    await raf()
    const first = document.querySelector('ui-swiper > ui-swiper-label')!
    const id = first.id
    const btn = [...document.querySelectorAll('ui-button')].find((b) => b.textContent?.trim() === 'Rename the first carousel') as HTMLElement
    btn.click()
    await raf()
    expect(first.textContent).toBe('New this week')
    expect(first.id, 'the anchor keeps its id — nothing re-rendered').toBe(id)
    expect(document.querySelector('ui-swiper > ui-swiper-label')).toBe(first)
    const probe = [...document.querySelectorAll('p[aria-live="polite"]')].find((p) => p.textContent?.includes('swiper #1'))
    expect(probe?.textContent).toContain('"New this week"')
    expect(document.querySelector('ul.event-log[aria-live="polite"]'), 'the select log is wired').not.toBeNull()
  })
})
