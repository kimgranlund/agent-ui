import { describe, it, expect, afterEach } from 'vitest'
import '@agent-ui/components/foundation-styles.css'
import '@agent-ui/components/component-styles.css'
import './audio.ts'
import type { UIAudioElement } from './audio.ts'
import { whenFlushed } from '../../reactive/index.ts'

// audio.browser.test.ts — real-engine (GH #1209): the UA bar renders at its intrinsic height filling the
// host's inline size; no aspect box exists (audio.md's geometry note — contrast ui-video).

const mounted: HTMLElement[] = []
const mount = (): UIAudioElement => {
  const el = document.createElement('ui-audio') as UIAudioElement
  el.style.inlineSize = '320px'
  document.body.append(el)
  mounted.push(el)
  return el
}
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

describe('ui-audio — real-engine geometry', () => {
  it('an empty src renders nothing — zero block-size (no dead bar reserving space)', async () => {
    const el = mount()
    await whenFlushed()
    expect(el.getBoundingClientRect().height).toBe(0)
  })

  it('a non-empty src renders the native bar at the UA intrinsic height, full inline size', async () => {
    const el = mount()
    el.src = 'data:audio/mp3;base64,AAAA'
    el.label = 'Specimen'
    await whenFlushed()
    const audio = el.querySelector('audio')!
    expect(audio.hasAttribute('controls')).toBe(true)
    const r = audio.getBoundingClientRect()
    expect(r.width).toBeCloseTo(320, 0)
    expect(r.height).toBeGreaterThan(20) // a real UA bar, engine-specific height — present, not zero
  })
})
