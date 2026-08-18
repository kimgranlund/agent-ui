import { describe, it, expect, afterEach } from 'vitest'
import './audio.ts'
import type { UIAudioElement } from './audio.ts'
import { whenFlushed } from '../../reactive/index.ts'

// audio.test.ts — jsdom behaviour (GH #1209): the ui-video suite's shape minus the aspect box (audio
// reserves no visual canvas — audio.md's geometry note).

const mounted: HTMLElement[] = []
const mount = (): UIAudioElement => {
  const el = document.createElement('ui-audio') as UIAudioElement
  document.body.append(el)
  mounted.push(el)
  return el
}
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

describe('ui-audio — props + defaults', () => {
  it('defaults: src/label empty, preload=metadata', () => {
    const el = mount()
    expect(el.src).toBe('')
    expect(el.label).toBe('')
    expect(el.preload).toBe('metadata')
  })

  it('no prop reflects to a host attribute (all property-only render inputs — audio.md)', () => {
    const el = mount()
    el.src = '/a.mp3'
    el.label = 'A message'
    el.preload = 'none'
    expect(el.hasAttribute('src')).toBe(false)
    expect(el.hasAttribute('label')).toBe(false)
    expect(el.hasAttribute('preload')).toBe(false)
  })
})

describe('ui-audio — the media element (no dead bar; never rebuilt; native attrs)', () => {
  it('an empty src renders NO <audio> at all', async () => {
    const el = mount()
    await whenFlushed()
    expect(el.querySelector('audio')).toBeNull()
  })

  it('a non-empty src builds ONE <audio data-part="media" controls> with the native attrs', async () => {
    const el = mount()
    el.src = '/clips/welcome.mp3'
    el.label = 'Welcome message'
    await whenFlushed()
    const audio = el.querySelector('audio[data-part="media"]') as HTMLAudioElement
    expect(audio).not.toBeNull()
    expect(audio.hasAttribute('controls')).toBe(true) // native chrome always on — the no-custom-chrome fence
    expect(audio.getAttribute('preload')).toBe('metadata')
    expect(audio.getAttribute('aria-label')).toBe('Welcome message')
  })

  it('the media element is PERSISTENT — prop changes mutate, never rebuild (the ui-image law)', async () => {
    const el = mount()
    el.src = '/a.mp3'
    await whenFlushed()
    const first = el.querySelector('audio')
    el.preload = 'auto'
    el.label = 'renamed'
    await whenFlushed()
    expect(el.querySelector('audio')).toBe(first)
    expect(el.querySelectorAll('audio').length).toBe(1)
  })

  it('src back to empty removes the media element entirely', async () => {
    const el = mount()
    el.src = '/a.mp3'
    await whenFlushed()
    el.src = ''
    await whenFlushed()
    expect(el.querySelector('audio')).toBeNull()
  })

  it('deliberate v1 absences: autoplay/loop are never set on the native element', async () => {
    const el = mount()
    el.src = '/a.mp3'
    await whenFlushed()
    const audio = el.querySelector('audio')!
    expect(audio.hasAttribute('autoplay')).toBe(false)
    expect(audio.hasAttribute('loop')).toBe(false)
  })
})
