import { describe, it, expect, vi } from 'vitest'
// Side-effect import: the demo page mounts the app shell + the live ui-image gallery into document.body
// (mountPage appends to `#app ?? document.body`; the modal-demo.browser.test.ts precedent).
import './image-demo.ts'

// GH #347 — REAL-TIMING HEADROOM (rAF settles under host load; see vitest.browser.config.ts).
vi.setConfig({ testTimeout: 30_000 })

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
const tick = (): Promise<void> => new Promise((r) => queueMicrotask(() => queueMicrotask(r)))

describe('image-demo — the REAL ui-image gallery mounts (hero + thumbs + fit pair)', () => {
  it('mounts ≥ 2 example sections and 7 live ui-image specimens, each with a real <img data-part="media">', async () => {
    await raf()
    const sections = document.querySelectorAll('section')
    expect(sections.length, 'expected at least two exampleSections').toBeGreaterThanOrEqual(2)
    const images = [...document.querySelectorAll('ui-image')]
    expect(images.length, 'hero + 4 thumbs + cover + contain').toBe(7)
    for (const img of images) {
      const media = img.querySelector('img[data-part="media"]')
      expect(media, 'every non-empty-src ui-image builds its <img data-part="media">').not.toBeNull()
      expect((media as HTMLImageElement).alt.length, 'alt is real content text, never empty').toBeGreaterThan(0)
    }
  })

  it('the hero carries the caption as light DOM beside the persistent <img>, and the fit pair reflects [fit]', async () => {
    await raf()
    const hero = document.querySelector('ui-image[usage-hint="hero"]')!
    expect(hero.textContent).toContain('Harborview loft')
    expect(hero.querySelector('img[data-part="media"]')).not.toBeNull()
    expect(document.querySelectorAll('ui-image[fit="cover"]').length).toBeGreaterThanOrEqual(1)
    expect(document.querySelectorAll('ui-image[fit="contain"]').length).toBe(1)
  })

  it('the model-driven aspect switch rewrites the hero aspect and keeps the SAME <img> node (persistent-media law)', async () => {
    await raf()
    const hero = document.querySelector('ui-image[usage-hint="hero"]')!
    const before = hero.querySelector('img[data-part="media"]')
    const square = [...document.querySelectorAll('ui-button')].find((b) => b.textContent?.trim() === 'aspect="1/1"') as HTMLElement
    expect(square, 'the aspect="1/1" switch button exists').toBeTruthy()
    square.click()
    await tick()
    expect(hero.getAttribute('aspect')).toBe('1/1')
    expect(hero.querySelector('img[data-part="media"]'), 'the media node is mutated, never replaced').toBe(before)
    expect(hero.textContent, 'the caption survives the attribute write').toContain('Harborview loft')
  })
})
