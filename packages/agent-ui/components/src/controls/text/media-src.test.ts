import { describe, it, expect, afterEach } from 'vitest'
import { safeMediaSrc, setMediaOrigins, MEDIA_SRC_SCHEMES } from './media-src.ts'
import '../image/image.ts'
import '../avatar/avatar.ts'
import '../video/video.ts'
import '../audio/audio.ts'
import '../product-card/product-card.ts'
import type { UIImageElement } from '../image/image.ts'
import type { UIAvatarElement } from '../avatar/avatar.ts'
import type { UIVideoElement } from '../video/video.ts'
import type { UIAudioElement } from '../audio/audio.ts'
import type { UIProductCardElement } from '../product-card/product-card.ts'

// media-src.test.ts: the media source gate (T-0553). Every denial is paired with an allowed twin through
// the same control, so a dead write path cannot pass as a denial.

const BASE = 'https://app.example/page'

afterEach(() => {
  setMediaOrigins(null)
  document.body.replaceChildren()
})

describe('safeMediaSrc: scheme gate', () => {
  it('allows https, http, data, blob and relative sources byte-identical', () => {
    for (const raw of ['https://cdn.example/a.jpg', 'http://cdn.example/a.jpg', 'data:image/gif;base64,R0lGOD', 'blob:https://app.example/1', '/a.jpg', 'a.jpg']) {
      expect(safeMediaSrc(raw, BASE)).toBe(raw)
    }
    expect(MEDIA_SRC_SCHEMES).toEqual(['https:', 'http:', 'data:', 'blob:'])
  })

  it('denies other schemes, unparseable and empty sources', () => {
    for (const raw of ['javascript:void 0', ' JAVASCRIPT:void 0', 'ftp://cdn.example/a.jpg', 'file:///a.jpg', 'mailto:a@b.example', 'http://[', '', '   ']) {
      expect(safeMediaSrc(raw, BASE)).toBeNull()
    }
  })
})

describe('safeMediaSrc: host origin allowlist', () => {
  it('with no allowlist set, any http(s) origin passes', () => {
    expect(safeMediaSrc('https://other.example/a.jpg', BASE)).toBe('https://other.example/a.jpg')
  })

  it('with an allowlist, only listed origins and the page origin pass', () => {
    setMediaOrigins(['https://cdn.example'])
    expect(safeMediaSrc('https://cdn.example/a.jpg', BASE)).toBe('https://cdn.example/a.jpg')
    expect(safeMediaSrc('/a.jpg', BASE)).toBe('/a.jpg')
    expect(safeMediaSrc('https://app.example/a.jpg', BASE)).toBe('https://app.example/a.jpg')
    expect(safeMediaSrc('https://other.example/a.jpg', BASE)).toBeNull()
    expect(safeMediaSrc('http://cdn.example/a.jpg', BASE)).toBeNull()
    expect(safeMediaSrc('data:image/gif;base64,R0lGOD', BASE)).toBe('data:image/gif;base64,R0lGOD')
  })

  it('an empty allowlist keeps only the page origin', () => {
    setMediaOrigins([])
    expect(safeMediaSrc('/a.jpg', BASE)).toBe('/a.jpg')
    expect(safeMediaSrc('https://cdn.example/a.jpg', BASE)).toBeNull()
  })
})

async function mount<T extends HTMLElement & { updateComplete: Promise<unknown> }>(tag: string, init: Record<string, string>): Promise<T> {
  const el = document.createElement(tag) as T
  Object.assign(el, init)
  document.body.append(el)
  await el.updateComplete
  return el
}

async function set<T extends HTMLElement & { updateComplete: Promise<unknown> }>(el: T, init: Record<string, string>): Promise<void> {
  Object.assign(el, init)
  await el.updateComplete
}

const media = (el: Element, sel: string): Element | null => el.querySelector(sel)

describe('the media controls route their sources through the gate', () => {
  it('ui-image renders an allowed src and no media element for a denied one', async () => {
    const el = await mount<UIImageElement>('ui-image', { src: 'https://cdn.example/a.jpg' })
    expect(media(el, 'img')?.getAttribute('src')).toBe('https://cdn.example/a.jpg')
    await set(el, { src: 'ftp://cdn.example/a.jpg' })
    expect(media(el, 'img')).toBeNull()
  })

  it('ui-avatar renders an allowed src and falls back for a denied one', async () => {
    const el = await mount<UIAvatarElement>('ui-avatar', { src: '/u/1.jpg', identity: 'Ada Lovelace' })
    expect(media(el, 'img')?.getAttribute('src')).toBe('/u/1.jpg')
    await set(el, { src: 'ftp://cdn.example/u.jpg' })
    expect(media(el, 'img')).toBeNull()
    expect(media(el, '[data-part="initials"]')?.textContent).toBe('AL')
  })

  it('ui-video gates both src and poster', async () => {
    const el = await mount<UIVideoElement>('ui-video', { src: '/v.mp4', poster: '/p.jpg' })
    expect(media(el, 'video')?.getAttribute('src')).toBe('/v.mp4')
    expect(media(el, 'video')?.getAttribute('poster')).toBe('/p.jpg')
    await set(el, { poster: 'ftp://cdn.example/p.jpg' })
    expect(media(el, 'video')?.hasAttribute('poster')).toBe(false)
    await set(el, { src: 'ftp://cdn.example/v.mp4' })
    expect(media(el, 'video')).toBeNull()
  })

  it('ui-audio renders an allowed src and no media element for a denied one', async () => {
    const el = await mount<UIAudioElement>('ui-audio', { src: '/a.mp3' })
    expect(media(el, 'audio')?.getAttribute('src')).toBe('/a.mp3')
    await set(el, { src: 'ftp://cdn.example/a.mp3' })
    expect(media(el, 'audio')).toBeNull()
  })

  it('ui-product-card renders an allowed image and drops a denied one', async () => {
    const el = await mount<UIProductCardElement>('ui-product-card', { title: 'Suite', image: 'https://cdn.example/a.jpg' })
    expect(media(el, 'img')?.getAttribute('src')).toBe('https://cdn.example/a.jpg')
    await set(el, { image: 'ftp://cdn.example/a.jpg' })
    expect(media(el, 'img')).toBeNull()
  })

  it('a host allowlist applies to the controls (other origins render no media)', async () => {
    setMediaOrigins(['https://cdn.example'])
    const ok = await mount<UIImageElement>('ui-image', { src: 'https://cdn.example/a.jpg' })
    expect(media(ok, 'img')).not.toBeNull()
    const denied = await mount<UIImageElement>('ui-image', { src: 'https://other.example/a.jpg' })
    expect(media(denied, 'img')).toBeNull()
  })
})
