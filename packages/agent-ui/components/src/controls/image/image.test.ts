import { describe, it, expect, afterEach } from 'vitest'
import './image.ts'
import type { UIImageElement } from './image.ts'
import { whenFlushed } from '../../reactive/index.ts'

// image.test.ts — jsdom behaviour: props/attributes, the persistent (never-rebuilt) media element, the
// empty-src "no broken-image box" discipline, usageHint-driven loading attributes, and the reflect/attribute
// wiring. Geometry/paint (the aspect-ratio box, the scrim, the caption's flat background) is jsdom-BLIND
// (computed style / painted geometry) — proven for real in image.browser.test.ts instead.

const mounted: HTMLElement[] = []
const mount = (): UIImageElement => {
  const el = document.createElement('ui-image') as UIImageElement
  document.body.append(el)
  mounted.push(el)
  return el
}
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

describe('ui-image — props + defaults', () => {
  it('defaults: src/alt empty, fit=cover, aspect=16/9, usageHint=inline', () => {
    const el = mount()
    expect(el.src).toBe('')
    expect(el.alt).toBe('')
    expect(el.fit).toBe('cover')
    expect(el.aspect).toBe('16/9')
    expect(el.usageHint).toBe('inline')
  })

  it('fit reflects to the host attribute (the CSS [fit] hook)', () => {
    const el = mount()
    el.fit = 'contain'
    expect(el.getAttribute('fit')).toBe('contain')
  })

  it('usageHint does NOT reflect (a behavioural-only lever, no CSS depends on the attribute)', () => {
    const el = mount()
    el.usageHint = 'hero'
    expect(el.hasAttribute('usage-hint')).toBe(false)
  })
})

describe('ui-image — the media element (no broken-image box; never rebuilt)', () => {
  it('an empty src renders NO <img> at all', async () => {
    const el = mount()
    await whenFlushed()
    expect(el.querySelector('img')).toBeNull()
  })

  it('a non-empty src creates exactly one <img data-part="media"> with src/alt applied', async () => {
    const el = mount()
    el.src = '/photos/harbor.jpg'
    el.alt = 'Boats in the harbor'
    await whenFlushed()
    const imgs = el.querySelectorAll('img')
    expect(imgs.length).toBe(1)
    const img = imgs[0] as HTMLImageElement
    expect(img.dataset.part).toBe('media')
    expect(img.src).toContain('/photos/harbor.jpg')
    expect(img.alt).toBe('Boats in the harbor')
  })

  it('clearing src back to empty removes the media element (never leaves a broken/blank <img>)', async () => {
    const el = mount()
    el.src = '/photos/harbor.jpg'
    await whenFlushed()
    expect(el.querySelector('img')).not.toBeNull()
    el.src = ''
    await whenFlushed()
    expect(el.querySelector('img')).toBeNull()
  })

  it('the media element is the SAME node instance across prop changes (never rebuilt/replaced)', async () => {
    const el = mount()
    el.src = '/a.jpg'
    await whenFlushed()
    const first = el.querySelector('img')
    el.src = '/b.jpg'
    el.fit = 'contain'
    await whenFlushed()
    const second = el.querySelector('img')
    expect(second).toBe(first) // identity-preserved, not a replaceChildren whole-swap
    expect((second as HTMLImageElement).src).toContain('/b.jpg')
  })

  it('a plain reparent (appendChild move, disconnect+reconnect) never duplicates the media element (GH #1189 B2)', async () => {
    const el = mount()
    el.src = '/a.jpg'
    await whenFlushed()
    expect(el.querySelectorAll('img').length).toBe(1)
    const before = el.querySelector('img')

    // A plain appendChild to a NEW parent — the platform disconnects `el` from `document.body` then
    // reconnects it under `other`, re-running connected(). This does NOT remove el's OWN children (the
    // <img> stays put) — only the host itself moves.
    const other = document.createElement('div')
    document.body.append(other)
    other.append(el) // triggers disconnectedCallback then connectedCallback on el

    expect(el.querySelectorAll('img').length, 'exactly one <img data-part="media"> survives the move').toBe(1)
    expect(el.querySelector('img')).toBe(before) // same node identity, not a fresh prepend

    // The src still reflects the current prop value (not stale) after the reconnect's effect re-run.
    el.src = '/b.jpg'
    await whenFlushed()
    expect(el.querySelectorAll('img').length).toBe(1)
    expect((el.querySelector('img') as HTMLImageElement).src).toContain('/b.jpg')

    other.remove()
  })

  it('caption content placed BEFORE the image in markup is left untouched by a later src/fit change (never clobbered)', async () => {
    const el = mount()
    const caption = document.createElement('span')
    caption.textContent = 'A caption'
    el.append(caption)
    el.src = '/a.jpg'
    await whenFlushed()
    el.fit = 'contain'
    el.src = '/b.jpg'
    await whenFlushed()
    expect(el.contains(caption)).toBe(true)
    expect(caption.textContent).toBe('A caption')
    // the media element is inserted BEFORE any existing children (paint-order: media behind caption)
    expect(el.firstElementChild?.tagName).toBe('IMG')
    expect(el.lastElementChild).toBe(caption)
  })
})

describe('ui-image — usageHint-driven loading attributes (R1)', () => {
  it('default (inline): loading=lazy, decoding=async, no fetchpriority', async () => {
    const el = mount()
    el.src = '/a.jpg'
    await whenFlushed()
    const img = el.querySelector('img') as HTMLImageElement
    expect(img.getAttribute('loading')).toBe('lazy')
    expect(img.getAttribute('decoding')).toBe('async')
    expect(img.hasAttribute('fetchpriority')).toBe(false)
  })

  it('usageHint="hero": loading=eager, fetchpriority=high', async () => {
    const el = mount()
    el.usageHint = 'hero'
    el.src = '/hero.jpg'
    await whenFlushed()
    const img = el.querySelector('img') as HTMLImageElement
    expect(img.getAttribute('loading')).toBe('eager')
    expect(img.getAttribute('decoding')).toBe('async')
    expect(img.getAttribute('fetchpriority')).toBe('high')
  })

  it('usageHint="thumb"/"avatar": lazy, no fetchpriority', async () => {
    for (const hint of ['thumb', 'avatar'] as const) {
      const el = mount()
      el.usageHint = hint
      el.src = '/x.jpg'
      await whenFlushed()
      const img = el.querySelector('img') as HTMLImageElement
      expect(img.getAttribute('loading'), hint).toBe('lazy')
      expect(img.hasAttribute('fetchpriority'), hint).toBe(false)
    }
  })

  it('switching FROM hero back to inline removes fetchpriority (no stale attribute)', async () => {
    const el = mount()
    el.usageHint = 'hero'
    el.src = '/hero.jpg'
    await whenFlushed()
    el.usageHint = 'inline'
    await whenFlushed()
    const img = el.querySelector('img') as HTMLImageElement
    expect(img.hasAttribute('fetchpriority')).toBe(false)
    expect(img.getAttribute('loading')).toBe('lazy')
  })
})

describe('ui-image — no ARIA minted on the host (the interior real <img alt> carries the accessible name)', () => {
  it('the host has no internals role/label — accessibility rides the real, native <img alt>', async () => {
    const el = mount()
    el.src = '/a.jpg'
    el.alt = 'A real photo'
    await whenFlushed()
    expect(el.getAttribute('role')).toBeNull()
    expect(el.getAttribute('aria-label')).toBeNull()
    const img = el.querySelector('img') as HTMLImageElement
    expect(img.alt).toBe('A real photo')
  })
})
