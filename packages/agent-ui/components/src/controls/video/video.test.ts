import { describe, it, expect, afterEach } from 'vitest'
import './video.ts'
import type { UIVideoElement } from './video.ts'
import { whenFlushed } from '../../reactive/index.ts'

// video.test.ts — jsdom behaviour (GH #1209): props/defaults, the persistent (never-rebuilt) native media
// element, the empty-src "no dead player shell" discipline, native-attribute pass-through (controls/preload/
// poster/aria-label), and the deliberate v1 absences. Geometry (the aspect box) is jsdom-BLIND — proven for
// real in video.browser.test.ts.

const mounted: HTMLElement[] = []
const mount = (): UIVideoElement => {
  const el = document.createElement('ui-video') as UIVideoElement
  document.body.append(el)
  mounted.push(el)
  return el
}
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

describe('ui-video — props + defaults', () => {
  it('defaults: src/label/poster empty, aspect=16/9, preload=metadata', () => {
    const el = mount()
    expect(el.src).toBe('')
    expect(el.label).toBe('')
    expect(el.poster).toBe('')
    expect(el.aspect).toBe('16/9')
    expect(el.preload).toBe('metadata')
  })

  it('no prop reflects to a host attribute (all property-only render inputs — video.md)', () => {
    const el = mount()
    el.src = '/a.mp4'
    el.label = 'A clip'
    el.poster = '/a.jpg'
    el.preload = 'none'
    expect(el.hasAttribute('src')).toBe(false)
    expect(el.hasAttribute('label')).toBe(false)
    expect(el.hasAttribute('poster')).toBe(false)
    expect(el.hasAttribute('preload')).toBe(false)
  })
})

describe('ui-video — the media element (no dead shell; never rebuilt; native attrs)', () => {
  it('an empty src renders NO <video> at all', async () => {
    const el = mount()
    await whenFlushed()
    expect(el.querySelector('video')).toBeNull()
  })

  it('a non-empty src builds ONE <video data-part="media" controls> with the native attrs', async () => {
    const el = mount()
    el.src = '/clips/tour.mp4'
    el.label = 'Guided tour'
    el.poster = '/clips/tour.jpg'
    await whenFlushed()
    const video = el.querySelector('video[data-part="media"]') as HTMLVideoElement
    expect(video).not.toBeNull()
    expect(video.hasAttribute('controls')).toBe(true) // native chrome always on — the no-custom-chrome fence
    expect(video.getAttribute('preload')).toBe('metadata')
    expect(video.getAttribute('poster')).toBe('/clips/tour.jpg')
    expect(video.getAttribute('aria-label')).toBe('Guided tour') // the player's accessible name (video.md aria)
  })

  it('the media element is PERSISTENT — prop changes mutate, never rebuild (the ui-image law)', async () => {
    const el = mount()
    el.src = '/a.mp4'
    await whenFlushed()
    const first = el.querySelector('video')
    el.poster = '/p.jpg'
    el.preload = 'auto'
    el.label = 'renamed'
    await whenFlushed()
    const second = el.querySelector('video')
    expect(second).toBe(first) // same node — mutated in place
    expect(el.querySelectorAll('video').length).toBe(1)
    expect(second?.getAttribute('preload')).toBe('auto')
  })

  it('clearing poster/label removes their attributes (never a stale empty attr)', async () => {
    const el = mount()
    el.src = '/a.mp4'
    el.poster = '/p.jpg'
    el.label = 'x'
    await whenFlushed()
    el.poster = ''
    el.label = ''
    await whenFlushed()
    const video = el.querySelector('video')!
    expect(video.hasAttribute('poster')).toBe(false)
    expect(video.hasAttribute('aria-label')).toBe(false)
  })

  it('src back to empty removes the media element entirely', async () => {
    const el = mount()
    el.src = '/a.mp4'
    await whenFlushed()
    el.src = ''
    await whenFlushed()
    expect(el.querySelector('video')).toBeNull()
  })

  it('deliberate v1 absences: autoplay/loop/muted are never set on the native element', async () => {
    const el = mount()
    el.src = '/a.mp4'
    await whenFlushed()
    const video = el.querySelector('video')!
    expect(video.hasAttribute('autoplay')).toBe(false)
    expect(video.hasAttribute('loop')).toBe(false)
    expect(video.hasAttribute('muted')).toBe(false)
  })

  it('the aspect box property is written per-instance (sanitized; malformed falls back to 16/9)', async () => {
    const el = mount()
    el.aspect = '4/3'
    await whenFlushed()
    expect(el.style.getPropertyValue('--_aspect')).toBe('4 / 3')
    el.aspect = 'nonsense'
    await whenFlushed()
    expect(el.style.getPropertyValue('--_aspect')).toBe('16 / 9') // never "auto" — the zero-CLS law
  })
})
