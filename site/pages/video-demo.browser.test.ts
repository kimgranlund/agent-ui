import { describe, it, expect, vi } from 'vitest'
// Side-effect import: the demo page mounts the app shell + the live ui-video players into document.body.
import './video-demo.ts'

// GH #347 — REAL-TIMING HEADROOM (rAF settles under host load; see vitest.browser.config.ts).
vi.setConfig({ testTimeout: 30_000 })

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
const tick = (): Promise<void> => new Promise((r) => queueMicrotask(() => queueMicrotask(r)))
const clickByText = (text: string): void => {
  const btn = [...document.querySelectorAll('ui-button')].find((b) => b.textContent?.trim() === text)
  if (!btn) throw new Error(`no ui-button found with text "${text}"`)
  ;(btn as HTMLElement).click()
}

describe('video-demo — the REAL native players mount; the empty-src rule is model-driven', () => {
  it('mounts ≥ 2 example sections and 6 ui-video hosts, 5 with a live <video data-part="media" controls>', async () => {
    await raf()
    expect(document.querySelectorAll('section').length).toBeGreaterThanOrEqual(2)
    const hosts = [...document.querySelectorAll('ui-video')]
    expect(hosts.length, 'lesson + short + 3 preload + 1 empty').toBe(6)
    const built = hosts.filter((h) => h.querySelector('video[data-part="media"][controls]'))
    expect(built.length, 'every non-empty-src player builds its native <video controls>').toBe(5)
  })

  it('poster + preload + aria-label pass through verbatim to the native element', async () => {
    await raf()
    const lesson = document.querySelector('ui-video[label^="Lesson 3"]')!
    const media = lesson.querySelector('video[data-part="media"]') as HTMLVideoElement
    expect(media.getAttribute('poster')?.startsWith('data:image/svg+xml')).toBe(true)
    expect(media.getAttribute('aria-label')).toContain('Lesson 3')
    for (const policy of ['none', 'metadata', 'auto']) {
      const host = document.querySelector(`ui-video[preload="${policy}"]`)!
      expect(host.querySelector('video')?.getAttribute('preload')).toBe(policy)
    }
  })

  it('the empty-src player has NO <video> until "Load lesson" writes src; "Clear" removes it again', async () => {
    await raf()
    const empty = [...document.querySelectorAll('ui-video')].find((h) => !h.hasAttribute('src'))!
    expect(empty.querySelector('video'), 'no dead shell before src').toBeNull()
    clickByText('Load lesson (write src)')
    await tick()
    expect(empty.querySelector('video[data-part="media"][controls]'), 'src write builds the player').not.toBeNull()
    clickByText('Clear (src = "")')
    await tick()
    expect(empty.querySelector('video'), 'src = "" removes the player').toBeNull()
  })
})
