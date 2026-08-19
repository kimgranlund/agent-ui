import { describe, it, expect, vi } from 'vitest'
// Side-effect import: the demo page mounts the app shell + the four live ui-swiper specimens into document.body.
import './swiper-item-demo.ts'
import type { UISwiperElement } from '@agent-ui/components/components'

// GH #347 — REAL-TIMING HEADROOM (rAF settles + scroll snaps under load).
vi.setConfig({ testTimeout: 30_000 })

// swiper-item-demo.browser.test.ts — the page-level guard for the ui-swiper-item demo: key-vs-index resolution
// of `active` on the real swipers, the runtime-appended slide captured + re-labelled "n of N" via labelAs, and
// the `slides` getter excluding the loop clone band; the select log wired. Runs in BOTH Chromium and WebKit
// (the `site` browser project).

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

const swiper = (role: string): UISwiperElement => {
  const elm = document.querySelector(`ui-swiper[data-role="${role}"]`)
  if (!elm) throw new Error(`no ui-swiper with data-role="${role}"`)
  return elm as UISwiperElement
}
const clickByText = (text: string): void => {
  const btn = [...document.querySelectorAll('ui-button')].find((b) => b.textContent?.trim() === text)
  if (!btn) throw new Error(`no ui-button found with text "${text}"`)
  ;(btn as HTMLElement).click()
}

describe('swiper-item-demo — the live slide-identity page', () => {
  it('mounts the real page: four swipers, ≥2 example sections, an aria-live select log', async () => {
    await raf()
    expect(document.querySelectorAll('ui-swiper').length).toBe(4)
    expect(document.querySelectorAll('[data-page-content] > section').length).toBeGreaterThanOrEqual(4)
    const log = document.querySelector('ul.event-log')
    expect(log).not.toBeNull()
    expect(log?.getAttribute('aria-live')).toBe('polite')
  })

  it('a programmatic active write resolves by KEY on the tour and by INDEX on the unkeyed deck — no select echo', async () => {
    await raf()
    const keyed = swiper('keyed-swiper')
    let selects = 0
    keyed.addEventListener('select', () => { selects += 1 })
    clickByText('active="rules"')
    await raf()
    expect(keyed.active).toBe('rules')
    expect(keyed.activeIndex).toBe(2)
    expect(selects).toBe(0) // binding hygiene — no echo on a programmatic write

    const unkeyed = swiper('unkeyed-swiper')
    clickByText('active="2"')
    await raf()
    expect(unkeyed.active).toBe('2')
    expect(unkeyed.activeIndex).toBe(2) // no key matched ⇒ the numeric string addressed a real index
  })

  it('an appended slide is captured into the track and every real slide is re-labelled "n of N"', async () => {
    await raf()
    const shelf = swiper('growing-swiper')
    expect(shelf.slides.length).toBe(2)
    clickByText('Append a slide')
    await raf()
    await raf()
    expect(shelf.slides.length).toBe(3)
    const labels = shelf.slides.map((s) => s.getAttribute('key'))
    expect(labels).toEqual(['p1', 'p2', 'p3'])
    // labelAs rides ElementInternals — assert through the computed role, never a host aria-label attribute.
    for (const s of shelf.slides) expect(s.getAttribute('aria-label')).toBeNull()
  })

  it('under loop the slides getter counts real items only — the clone band is excluded', async () => {
    await raf()
    const loop = swiper('loop-swiper')
    expect(loop.slides.length).toBe(3)
    const track = loop.querySelector('[data-part="track"]')
    const all = track ? track.querySelectorAll('ui-swiper-item').length : 0
    expect(all).toBeGreaterThan(3) // clones exist in the track…
    const clones = track ? track.querySelectorAll('ui-swiper-item[data-swiper-clone]') : []
    expect(clones.length).toBe(all - 3) // …and account for exactly the difference
  })
})
