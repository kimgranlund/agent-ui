import { describe, it, expect, afterEach } from 'vitest'
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css'
import './video.ts'
import type { UIVideoElement } from './video.ts'
import { whenFlushed } from '../../reactive/index.ts'

// video.browser.test.ts — real-engine geometry (GH #1209): the reserved aspect box (jsdom-blind computed
// layout), the media element filling it, and the forced-colors-independent letterbox canvas painting.

const mounted: HTMLElement[] = []
const mount = (): UIVideoElement => {
  const el = document.createElement('ui-video') as UIVideoElement
  el.style.inlineSize = '320px'
  document.body.append(el)
  mounted.push(el)
  return el
}
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

describe('ui-video — real-engine geometry', () => {
  it('reserves the 16/9 aspect box BEFORE any media exists (zero CLS — the ui-image law)', async () => {
    const el = mount()
    await whenFlushed()
    const r = el.getBoundingClientRect()
    expect(r.width).toBeCloseTo(320, 0)
    expect(r.height).toBeCloseTo(320 * (9 / 16), 0) // concrete ratio with NO media mounted at all
  })

  it('a custom aspect drives the box; malformed falls back to 16/9', async () => {
    const el = mount()
    el.aspect = '1/1'
    await whenFlushed()
    expect(el.getBoundingClientRect().height).toBeCloseTo(320, 0)
    el.aspect = 'garbage'
    await whenFlushed()
    expect(el.getBoundingClientRect().height).toBeCloseTo(320 * (9 / 16), 0)
  })

  it('the native player fills the box (absolute inset-0) with native controls on', async () => {
    const el = mount()
    el.src = 'data:video/mp4;base64,AAAA'
    el.label = 'Specimen'
    await whenFlushed()
    const video = el.querySelector('video')!
    const host = el.getBoundingClientRect()
    const media = video.getBoundingClientRect()
    expect(media.width).toBeCloseTo(host.width, 0)
    expect(media.height).toBeCloseTo(host.height, 0)
    expect(video.hasAttribute('controls')).toBe(true)
    expect(getComputedStyle(video).objectFit).toBe('contain') // letterbox, never crop (video.css)
  })
})
