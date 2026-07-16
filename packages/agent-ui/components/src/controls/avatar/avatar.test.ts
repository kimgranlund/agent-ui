import { describe, it, expect } from 'vitest'
import { UIAvatarElement } from './avatar.ts'
import { UIIconElement } from '../icon/icon.ts'

// avatar.test.ts — LLD-C3 jsdom behaviour probes (props/attributes, the fallback chain, ARIA). jsdom is
// blind to painted geometry and computed-style ink (SPEC-N2) — the whole-shape floor, the compact-ramp
// geometry probe, and forced-colors legs live in avatar.browser.test.ts; this file covers everything
// jsdom CAN see: prop typing, the fallback-chain DOM shape and transitions, and internals ARIA.

// A throwaway subclass re-exposing the protected `internals` (the icon-descriptor precedent), so a probe
// can read role/ariaLabel/ariaHidden set via ElementInternals — never a host attribute (the FACE pattern).
class ProbeAvatar extends UIAvatarElement {
  get probeInternals(): ElementInternals {
    return this.internals
  }
}
customElements.define('ui-avatar-probe', ProbeAvatar)

describe('UIAvatarElement — upgrade + typed props', () => {
  it('defaults: src="", name="", label="", size="md"', () => {
    const el = document.createElement('ui-avatar') as UIAvatarElement
    expect(el).toBeInstanceOf(UIAvatarElement)
    expect(el.src).toBe('')
    expect(el.identity).toBe('')
    expect(el.label).toBe('')
    expect(el.size).toBe('md')
  })

  it('self-defines as ui-avatar, guarded against double-define', () => {
    expect(customElements.get('ui-avatar')).toBe(UIAvatarElement)
    expect(() => {
      if (!customElements.get('ui-avatar')) customElements.define('ui-avatar', UIAvatarElement)
    }).not.toThrow()
  })

  it('size reflects to the [size] host attribute when explicitly set (the CSS hook)', async () => {
    const el = document.createElement('ui-avatar') as UIAvatarElement
    el.size = 'lg'
    expect(el.getAttribute('size')).toBe('lg')
  })

  it('an out-of-enum size attribute snaps to the first member ("sm") via the enum codec', () => {
    const el = document.createElement('ui-avatar') as UIAvatarElement
    el.setAttribute('size', 'bogus')
    expect(el.size).toBe('sm')
  })
})

describe('UIAvatarElement — the fallback chain (SPEC-R5)', () => {
  it('no src, no name ⇒ the person glyph renders — the host is never empty', async () => {
    const el = document.createElement('ui-avatar') as UIAvatarElement
    document.body.append(el)
    await el.updateComplete
    const icon = el.querySelector('ui-icon') as UIIconElement | null
    expect(icon).not.toBeNull()
    expect(icon?.glyph).toBe('user') // `glyph` is property-only (not reflected) on ui-icon
    expect(el.querySelector('img')).toBeNull()
    expect(el.querySelector('[data-part="initials"]')).toBeNull()
    el.remove()
  })

  it('no src, name="Ada Lovelace" ⇒ initials "AL" render, no glyph, no img', async () => {
    const el = document.createElement('ui-avatar') as UIAvatarElement
    el.identity = 'Ada Lovelace'
    document.body.append(el)
    await el.updateComplete
    const initials = el.querySelector('[data-part="initials"]')
    expect(initials?.textContent).toBe('AL')
    expect(el.querySelector('ui-icon')).toBeNull()
    expect(el.querySelector('img')).toBeNull()
    el.remove()
  })

  it('a non-empty src renders an <img alt=""> with that src, no initials, no glyph', async () => {
    const el = document.createElement('ui-avatar') as UIAvatarElement
    el.identity = 'Ada Lovelace'
    el.src = '/users/42/photo.jpg'
    document.body.append(el)
    await el.updateComplete
    const img = el.querySelector('img') as HTMLImageElement
    expect(img).not.toBeNull()
    expect(img.alt).toBe('')
    expect(img.getAttribute('src')).toBe('/users/42/photo.jpg')
    expect(el.querySelector('[data-part="initials"]')).toBeNull()
    expect(el.querySelector('ui-icon')).toBeNull()
    el.remove()
  })

  it('a src load error falls back to initials — no <img> remains in the final state (AC1)', async () => {
    const el = document.createElement('ui-avatar') as UIAvatarElement
    el.identity = 'Ada Lovelace'
    el.src = '/broken.jpg'
    document.body.append(el)
    await el.updateComplete
    el.querySelector('img')?.dispatchEvent(new Event('error'))
    await el.updateComplete
    expect(el.querySelector('img')).toBeNull()
    expect(el.querySelector('[data-part="initials"]')?.textContent).toBe('AL')
    el.remove()
  })

  it('a src load error with empty name falls back to the glyph (AC2 — never empty)', async () => {
    const el = document.createElement('ui-avatar') as UIAvatarElement
    el.src = '/broken.jpg'
    document.body.append(el)
    await el.updateComplete
    el.querySelector('img')?.dispatchEvent(new Event('error'))
    await el.updateComplete
    expect(el.querySelector('img')).toBeNull()
    expect((el.querySelector('ui-icon') as UIIconElement | null)?.glyph).toBe('user')
    el.remove()
  })

  it('setting a NEW src after a failure re-attempts the image (the equality re-attempt transition)', async () => {
    const el = document.createElement('ui-avatar') as UIAvatarElement
    el.src = '/broken.jpg'
    document.body.append(el)
    await el.updateComplete
    el.querySelector('img')?.dispatchEvent(new Event('error'))
    await el.updateComplete
    expect(el.querySelector('img')).toBeNull() // fell back

    el.src = '/second-try.jpg'
    await el.updateComplete
    const img = el.querySelector('img') as HTMLImageElement
    expect(img).not.toBeNull()
    expect(img.getAttribute('src')).toBe('/second-try.jpg')
    el.remove()
  })

  it('clearing src falls back immediately, without waiting for an error event', async () => {
    const el = document.createElement('ui-avatar') as UIAvatarElement
    el.identity = 'Ada Lovelace'
    el.src = '/users/42/photo.jpg'
    document.body.append(el)
    await el.updateComplete
    expect(el.querySelector('img')).not.toBeNull()

    el.src = ''
    await el.updateComplete
    expect(el.querySelector('img')).toBeNull()
    expect(el.querySelector('[data-part="initials"]')?.textContent).toBe('AL')
    el.remove()
  })

  it('re-setting the SAME failed src (via a clear round-trip) does not resurrect the <img>', async () => {
    const el = document.createElement('ui-avatar') as UIAvatarElement
    el.identity = 'Ada Lovelace'
    el.src = '/broken.jpg'
    document.body.append(el)
    await el.updateComplete
    el.querySelector('img')?.dispatchEvent(new Event('error'))
    await el.updateComplete
    expect(el.querySelector('img')).toBeNull()

    el.src = '' // falls to initials immediately (a real change, forces the effect to re-run)
    await el.updateComplete
    el.src = '/broken.jpg' // the SAME src that already failed — equals #failedSrc, must not re-attempt
    await el.updateComplete
    expect(el.querySelector('img')).toBeNull()
    expect(el.querySelector('[data-part="initials"]')?.textContent).toBe('AL')
    el.remove()
  })
})

describe('UIAvatarElement — ARIA (SPEC-R6, decorative by default)', () => {
  it('default props ⇒ internals.ariaHidden="true", no role', async () => {
    const el = document.createElement('ui-avatar-probe') as ProbeAvatar
    document.body.append(el)
    await el.updateComplete
    expect(el.probeInternals.ariaHidden).toBe('true')
    expect(el.probeInternals.role).toBeNull()
    expect(el.probeInternals.ariaLabel).toBeNull()
    el.remove()
  })

  it('label="Ada Lovelace" ⇒ role=img, ariaLabel set, ariaHidden cleared', async () => {
    const el = document.createElement('ui-avatar-probe') as ProbeAvatar
    el.label = 'Ada Lovelace'
    document.body.append(el)
    await el.updateComplete
    expect(el.probeInternals.role).toBe('img')
    expect(el.probeInternals.ariaLabel).toBe('Ada Lovelace')
    expect(el.probeInternals.ariaHidden).toBeNull()
    el.remove()
  })

  it('clearing label reverts to decorative', async () => {
    const el = document.createElement('ui-avatar-probe') as ProbeAvatar
    el.label = 'Ada Lovelace'
    document.body.append(el)
    await el.updateComplete
    el.label = ''
    await el.updateComplete
    expect(el.probeInternals.role).toBeNull()
    expect(el.probeInternals.ariaHidden).toBe('true')
    el.remove()
  })
})
