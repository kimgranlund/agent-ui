import { describe, it, expect, afterEach } from 'vitest'
import { server, cdp } from 'vitest/browser'

// image.browser.test.ts — the real-engine proof for ui-image (GH #1189 R1/R2: jsdom is blind to painted
// geometry, computed style, and WHCM). Covers: the ZERO-CLS aspect-ratio reservation (BEFORE any <img> has
// loaded, or even exists — the box is a host-level CSS rule, not conditional on the media child), object-fit
// under [fit], the media filling the whole box (test-the-whole-shape law), the caption sitting bottom-pinned
// over a REAL, non-transparent painted scrim (scheme-invariant across light/dark), and forced-colors.
//
// Direct (pre-barrel) imports — the LLD-C11-style shared-file integration slice for this control.
import '@agent-ui/components/foundation-styles.css'
import './image.css'
import './image.ts'
import type { UIImageElement } from './image.ts'
import { whenFlushed } from '../../reactive/index.ts'

interface CdpSession {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>
}

// A 1×1 opaque GIF — the avatar.browser.test.ts data-URI precedent (no network dependency).
const DATA_GIF = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBTAA7'

const mounted: HTMLElement[] = []
const mount = (markup: string, width = 400): HTMLElement => {
  const wrap = document.createElement('div')
  wrap.style.width = `${width}px`
  wrap.innerHTML = markup
  document.body.append(wrap)
  mounted.push(wrap)
  return wrap.querySelector('ui-image') as HTMLElement
}
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

describe('ui-image — zero CLS: the aspect-ratio box is reserved BEFORE any image exists/loads (R1)', () => {
  it('a bare <ui-image> (no src, no aspect override) reserves a 16:9 box at its container width', async () => {
    const el = mount('<ui-image></ui-image>', 400)
    await whenFlushed()
    expect(el.querySelector('img'), 'no src ⇒ no media element at all').toBeNull()
    const box = el.getBoundingClientRect()
    expect(box.width).toBeCloseTo(400, 0)
    expect(box.height).toBeCloseTo(400 * (9 / 16), 0) // reserved even with zero content painted
  })

  it('an explicit aspect="1/1" reserves a SQUARE box', async () => {
    const el = mount('<ui-image aspect="1/1"></ui-image>', 300)
    await whenFlushed()
    const box = el.getBoundingClientRect()
    expect(box.width).toBeCloseTo(300, 0)
    expect(box.height).toBeCloseTo(300, 0)
  })

  it('a MALFORMED aspect falls back to 16:9 — never collapses to zero height (the auto-fallback trap)', async () => {
    const el = mount('<ui-image aspect="not-a-ratio"></ui-image>', 320)
    await whenFlushed()
    const box = el.getBoundingClientRect()
    expect(box.height).toBeCloseTo(320 * (9 / 16), 0)
  })

  it('the reserved height holds identically whether or not a real src is later set (loading never shifts it)', async () => {
    const el = mount('<ui-image aspect="4/3"></ui-image>', 200) as UIImageElement
    await whenFlushed()
    const before = el.getBoundingClientRect().height
    el.src = DATA_GIF
    await whenFlushed()
    const after = el.getBoundingClientRect().height
    expect(after).toBeCloseTo(before, 0)
    expect(after).toBeCloseTo(200 * (3 / 4), 0)
  })
})

describe('ui-image — the media element (whole-shape: fills the box under both fit values)', () => {
  it('fit=cover (default): the <img> fills the WHOLE box, object-fit:cover', async () => {
    const el = mount(`<ui-image src="${DATA_GIF}" alt="x"></ui-image>`, 240)
    await whenFlushed()
    const img = el.querySelector('img') as HTMLElement
    expect(getComputedStyle(img).objectFit).toBe('cover')
    const boxRect = el.getBoundingClientRect()
    const imgRect = img.getBoundingClientRect()
    expect(imgRect.width).toBeCloseTo(boxRect.width, 0)
    expect(imgRect.height).toBeCloseTo(boxRect.height, 0)
  })

  it("fit=contain: object-fit:contain (still fills the box's frame, letterboxing the image itself)", async () => {
    const el = mount(`<ui-image src="${DATA_GIF}" alt="x" fit="contain"></ui-image>`, 240)
    await whenFlushed()
    const img = el.querySelector('img') as HTMLElement
    expect(getComputedStyle(img).objectFit).toBe('contain')
  })
})

describe('ui-image — the caption sits bottom-pinned over a REAL, non-transparent painted scrim (R2)', () => {
  it('a caption-less image paints NO caption/scrim box at all (no phantom overlay)', async () => {
    const el = mount(`<ui-image src="${DATA_GIF}" alt="x"></ui-image>`, 300)
    await whenFlushed()
    // every child that is not the media element would be the caption — there is none
    const nonMedia = [...el.children].filter((c) => c.tagName !== 'IMG')
    expect(nonMedia.length).toBe(0)
  })

  it('a caption-less image paints NO ::before gradient at all (GH #1189 A4 — the descriptor\'s own promise: ' +
    '"Absent ⇒ no scrim box is painted at all")', async () => {
    const el = mount(`<ui-image src="${DATA_GIF}" alt="x"></ui-image>`, 300)
    await whenFlushed()
    const before = getComputedStyle(el, '::before')
    // A gated-out ::before computes content:none (or the UA never generates the box at all — either way
    // no gradient paint reaches the page); a non-vacuous probe on the ACTUAL pseudo-element paint, not
    // merely a light-DOM child count.
    expect(before.content).toBe('none')
    expect(before.backgroundImage).toBe('none')
  })

  it('a captioned image DOES paint the ::before gradient (the scrim is real, not just declared)', async () => {
    const el = mount(`<ui-image src="${DATA_GIF}" alt="x"><span>A caption</span></ui-image>`, 300)
    await whenFlushed()
    const before = getComputedStyle(el, '::before')
    expect(before.content).not.toBe('none')
    expect(before.backgroundImage).toContain('gradient')
  })

  it("caption content paints with non-zero area, flush against the box's bottom edge", async () => {
    const el = mount(`<ui-image src="${DATA_GIF}" alt="x"><span>A caption</span></ui-image>`, 300)
    await whenFlushed()
    const caption = el.querySelector('span') as HTMLElement
    const capRect = caption.getBoundingClientRect()
    const boxRect = el.getBoundingClientRect()
    expect(capRect.width).toBeGreaterThan(0)
    expect(capRect.height).toBeGreaterThan(0)
    expect(Math.abs(capRect.bottom - boxRect.bottom)).toBeLessThanOrEqual(1)
  })

  /** Read the caption's own rendered background + ink at ONE colour-scheme (set on the wrapper — the
   *  badge.browser.test.ts `measure()` precedent: `color-scheme` inherits, so every light-dark() in the
   *  chain resolves against the SAME branch). */
  function measure(scheme: 'light' | 'dark'): { bg: string; ink: string } {
    const wrap = document.createElement('div')
    wrap.style.colorScheme = scheme
    wrap.innerHTML = `<ui-image src="${DATA_GIF}" alt="x"><span>Caption</span></ui-image>`
    document.body.append(wrap)
    mounted.push(wrap)
    const caption = wrap.querySelector('span') as HTMLElement
    const cs = getComputedStyle(caption)
    return { bg: cs.backgroundColor, ink: cs.color }
  }

  it('the caption background is REAL and non-transparent (the scrim actually paints, not just declared)', () => {
    const { bg } = measure('light')
    expect(bg).not.toBe('rgba(0, 0, 0, 0)')
    expect(bg).not.toBe('transparent')
  })

  it('BOTH themes compute the IDENTICAL caption background + ink — the design is deliberately scheme-invariant', () => {
    const light = measure('light')
    const dark = measure('dark')
    expect(light.bg).toBe(dark.bg)
    expect(light.ink).toBe(dark.ink)
  })
})

describe('ui-image — forced colors', () => {
  it('the media box boundary survives under forced-colors — Chromium emulates (CDP); WebKit asserts baseline', async () => {
    const el = mount(`<ui-image src="${DATA_GIF}" alt="x"></ui-image>`, 200)
    await whenFlushed()

    if (server.browser !== 'chromium') {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(false)
      return
    }

    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] })
    try {
      expect(window.matchMedia('(forced-colors: active)').matches, 'CDP did not enter forced-colors').toBe(true)
      const border = getComputedStyle(el).borderTopWidth
      expect(Number.parseFloat(border), 'the media box did not gain a system-ink border under WHCM').toBeGreaterThan(0)
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] })
    }
  })
})
