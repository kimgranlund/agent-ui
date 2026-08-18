import { describe, it, expect, vi } from 'vitest'
// Side-effect import: the demo page mounts the app shell + the live ui-audio bars into document.body.
import './audio-demo.ts'

// GH #347 — REAL-TIMING HEADROOM (rAF settles under host load; see vitest.browser.config.ts).
vi.setConfig({ testTimeout: 30_000 })

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
const tick = (): Promise<void> => new Promise((r) => queueMicrotask(() => queueMicrotask(r)))
const clickByText = (text: string): void => {
  const btn = [...document.querySelectorAll('ui-button')].find((b) => b.textContent?.trim() === text)
  if (!btn) throw new Error(`no ui-button found with text "${text}"`)
  ;(btn as HTMLElement).click()
}

describe('audio-demo — the REAL native bars mount over a runtime-synthesized WAV; the empty-src rule is model-driven', () => {
  it('mounts ≥ 2 example sections and 5 ui-audio hosts, 4 with a live <audio data-part="media" controls>', async () => {
    await raf()
    expect(document.querySelectorAll('section').length).toBeGreaterThanOrEqual(2)
    const hosts = [...document.querySelectorAll('ui-audio')]
    expect(hosts.length, 'memo + 3 episodes + 1 empty').toBe(5)
    const built = hosts.filter((h) => h.querySelector('audio[data-part="media"][controls]'))
    expect(built.length).toBe(4)
  })

  it('the memo source is a real data:audio/wav URI (RIFF header) and label lands as the native aria-label', async () => {
    await raf()
    const memo = document.querySelector('ui-audio[label^="Voice memo from Priya"]')!
    const media = memo.querySelector('audio[data-part="media"]') as HTMLAudioElement
    expect(media.src.startsWith('data:audio/wav;base64,')).toBe(true)
    expect(atob(media.src.slice('data:audio/wav;base64,'.length)).slice(0, 4), 'a well-formed WAV starts with RIFF').toBe('RIFF')
    expect(media.getAttribute('aria-label')).toContain('Priya')
    for (const policy of ['none', 'metadata', 'auto']) {
      expect(document.querySelector(`ui-audio[preload="${policy}"] audio`)?.getAttribute('preload')).toBe(policy)
    }
  })

  it('the empty-src bar has NO <audio> until "Attach memo" writes src; "Detach" removes it again', async () => {
    await raf()
    const empty = [...document.querySelectorAll('ui-audio')].find((h) => !h.hasAttribute('src'))!
    expect(empty.querySelector('audio'), 'no dead bar before src').toBeNull()
    clickByText('Attach memo (write src)')
    await tick()
    expect(empty.querySelector('audio[data-part="media"][controls]')).not.toBeNull()
    clickByText('Detach (src = "")')
    await tick()
    expect(empty.querySelector('audio')).toBeNull()
  })
})
