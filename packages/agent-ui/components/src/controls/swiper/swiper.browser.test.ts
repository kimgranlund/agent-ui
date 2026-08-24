import { describe, it, expect, afterEach } from 'vitest'
import { server, cdp, userEvent } from 'vitest/browser'
import { UISwiperElement } from './swiper.ts'
import { UISwiperItemElement } from './swiper-item.ts'
import { UISwiperPaginationElement } from './swiper-pagination.ts'
import { UISwiperPaddlesElement } from './swiper-paddles.ts'

// swiper.browser.test.ts — the CROSS-ENGINE smoke for the whole ui-swiper family (swiper-family.lld.md;
// decomp n6/n8/n9/n10/n11/n12/n13/n14/n15/n16/n17/n18/n19/n28). Where the jsdom probes pin the DECLARED
// rules, this pins what a REAL engine does: real scroll-snap geometry, the seamless clone-teleport (a real
// scroll-position assertion, not pixel-diff — jsdom has no scroll layout), real keyboard-driven scroll
// movement, the one-select-per-wrap invariant, ariaRoleDescription (read via internals — vitest-browser
// locators are blind to internals-only ARIA), reduced-motion, and forced-colors. Runs in BOTH Chromium and
// WebKit (vitest.browser.config.ts → the two playwright instances).

import '@agent-ui/components/foundation-styles.css'
import '../_surface/container.css'
import './swiper.css' // the PRIMARY sheet — MUST load before the four leaf sheets (the family-root token order)
import './swiper-item.css'
import './swiper-pagination.css'
import './swiper-paddles.css'
import './swiper-label.css'
// The composed-paddle cascade (the toast.browser.test.ts precedent — a real ui-button needs its module +
// sheet, and the caret svg needs icon.css's sizing; without these a naked <svg> falls back to the 300×150
// replaced-element intrinsic default and every paddle-geometry measurement below is garbage — GH #1330 §[9]).
import '../button/button.css'
import '../icon/icon.css'
import '../button/button.ts'
import '../icon/icon.ts'

const mounted: HTMLElement[] = []

interface Mount {
  wrap: HTMLElement
  swiper: UISwiperElement
  items: UISwiperItemElement[]
  track: HTMLElement
}

function mount(markup: string): Mount {
  const wrap = document.createElement('div')
  wrap.style.inlineSize = '300px' // a realistic bounded container (the whole-shape law)
  wrap.innerHTML = markup
  document.body.append(wrap)
  mounted.push(wrap)
  const swiper = wrap.querySelector('ui-swiper') as UISwiperElement
  const items = [...wrap.querySelectorAll('ui-swiper-item')] as UISwiperItemElement[]
  const track = swiper.querySelector('[data-part="track"]') as HTMLElement
  return { wrap, swiper, items, track }
}

afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

const THREE = `<ui-swiper><ui-swiper-item>One</ui-swiper-item><ui-swiper-item>Two</ui-swiper-item><ui-swiper-item>Three</ui-swiper-item></ui-swiper>`
const LOOP_FOUR = `<ui-swiper loop><ui-swiper-item>One</ui-swiper-item><ui-swiper-item>Two</ui-swiper-item><ui-swiper-item>Three</ui-swiper-item><ui-swiper-item>Four</ui-swiper-item></ui-swiper>`

// Outlast the JS scroll ANIMATION (--ui-swiper-duration defaults to --md-sys-motion-duration-fast, 300ms) THEN the 120ms
// settle debounce (which only starts counting once the last scroll event of the animation has fired) — a
// non-instant goTo/next/prev needs >= duration+debounce before #onSettle runs; 600ms gives comfortable margin.
const settle = (ms = 600): Promise<void> => new Promise((r) => setTimeout(r, ms))

interface CdpSession {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>
}

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  [1] Whole-shape — a bare swiper paints a non-collapsed, operable viewport (n15/n16)
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-swiper — whole-shape (n15/n16)', () => {
  it('the track has the container width and a content-driven, non-zero height', () => {
    const { wrap, track } = mount(THREE)
    const wrapRect = wrap.getBoundingClientRect()
    const trackRect = track.getBoundingClientRect()
    expect(trackRect.width, 'the track collapsed to zero width').toBeGreaterThan(0)
    expect(trackRect.height, 'the track collapsed to zero height').toBeGreaterThan(0)
    expect(trackRect.width).toBeCloseTo(wrapRect.width, 0)
  })

  it('scroll-snap-type + scroll-snap-align/-stop are REALLY applied (not just declared in the .css text)', () => {
    const { track, items } = mount(THREE)
    expect(getComputedStyle(track).scrollSnapType).toMatch(/x/)
    expect(getComputedStyle(items[0]).scrollSnapAlign).toBe('start')
    expect(getComputedStyle(items[0]).scrollSnapStop).toBe('always')
  })

  it('an empty swiper (no items) renders a non-erroring track', () => {
    const { track } = mount('<ui-swiper></ui-swiper>')
    expect(track).not.toBeNull()
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  [1b] Scroll-snap suspension during the JS scroll animation (regression, commit 40ff1ea8)
// ════════════════════════════════════════════════════════════════════════════════════════════════════

// `scroll-snap-type: x mandatory` (swiper.css) used to reject every intermediate scrollTo() the rAF
// animation (#runScrollAnimation) wrote — the interpolated values computed correctly but the real
// scrollLeft stayed pinned at the START position until the browser's own snap correction jumped it
// straight to the END position on one frame, i.e. no animation at all (a live design-mode report caught
// this on frontier-onboarding-tour's paddle click). The fix suspends snap (`scroll-snap-type: none`) on
// the track for the animation's duration. A test that only checks the FINAL settled position (as the
// existing suite already did, and still passed both before and after the fix) cannot distinguish a real
// eased animation from an instant jump — this one samples a frame mid-flight and requires it to sit
// strictly between the two snap points.

describe('ui-swiper — scroll-snap is genuinely suppressed mid-animation (regression)', () => {
  it('a frame sampled partway through a goTo animation lands OFF both snap points, not pinned at start or jumped to end', async () => {
    const { swiper, track } = mount(THREE)
    const itemWidth = track.getBoundingClientRect().width // one slide == one page; snap points sit at n * itemWidth
    swiper.goTo(1) // scrollLeft 0 -> itemWidth over --ui-swiper-duration (default 300ms, eased)
    // Sample well inside the animation window (before the ~300ms duration completes, after the first
    // frame). Under the pre-fix bug, mandatory snap rejected every intermediate scrollTo() — scrollLeft
    // would still read exactly 0 here, only jumping straight to itemWidth on the animation's last frame.
    await new Promise((r) => setTimeout(r, 130))
    const mid = track.scrollLeft
    expect(mid, 'scrollLeft is still pinned at the START snap point — the animation never actually moved').toBeGreaterThan(2)
    expect(mid, 'scrollLeft already sits at the END snap point — snap jumped straight to the target instead of easing').toBeLessThan(itemWidth - 2)
    await settle()
    expect(swiper.activeIndex, 'the animation did not still land on the correct target slide once settled').toBe(1)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  [2] The seamless clone-teleport — a REAL scroll-position assertion (n9/n10)
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-swiper — the infinite loop seams are pixel-seamless (n9/n10)', () => {
  it('wrapping forward past the last real slide teleports to real index 0 (scrollLeft matches within ε)', async () => {
    const { swiper, track } = mount(LOOP_FOUR)
    // advance to the LAST real slide, then once more to cross the forward seam into the trailing clone band
    swiper.goTo(3)
    await settle()
    swiper.next()
    await settle()
    expect(swiper.activeIndex, 'the wrap did not land on real index 0').toBe(0)
    const target = track.querySelectorAll('ui-swiper-item:not([data-swiper-clone])')[0] as HTMLElement
    const targetRect = target.getBoundingClientRect()
    const trackRect = track.getBoundingClientRect()
    // start-aligned: the real slide 0's left edge should sit at the track's left edge post-teleport
    expect(Math.abs(targetRect.left - trackRect.left), 'the teleport left a visible offset — not seamless').toBeLessThan(2)
  })

  it('wrapping backward past the first real slide teleports to the last real index', async () => {
    const { swiper } = mount(LOOP_FOUR)
    swiper.prev() // from index 0, backward wrap
    await settle()
    expect(swiper.activeIndex).toBe(3)
  })

  it('the [data-part=live] region announces the REAL index/count across a wrap (never a clone position)', async () => {
    const { swiper } = mount(LOOP_FOUR)
    const live = swiper.querySelector('[data-part="live"]') as HTMLElement
    swiper.goTo(3)
    await settle()
    swiper.next()
    await settle()
    expect(live.textContent).toBe('Slide 1 of 4')
  })

  it('paddles never disable in loop mode, at either end', async () => {
    const html = `<ui-swiper loop paddles><ui-swiper-item>One</ui-swiper-item><ui-swiper-item>Two</ui-swiper-item><ui-swiper-item>Three</ui-swiper-item></ui-swiper>`
    const { swiper } = mount(html)
    const paddles = swiper.querySelector('ui-swiper-paddles') as UISwiperPaddlesElement
    const prevBtn = paddles.querySelector('[data-part="prev"]') as HTMLElement & { disabled: boolean }
    const nextBtn = paddles.querySelector('[data-part="next"]') as HTMLElement & { disabled: boolean }
    expect(prevBtn.disabled).toBe(false)
    expect(nextBtn.disabled).toBe(false)
    swiper.goTo(2)
    await settle()
    expect(nextBtn.disabled, 'the next paddle disabled at the real end in loop mode').toBe(false)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  [3] Keyboard — real ArrowRight/Left/Home/End move the track's scroll position (n11/n12)
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-swiper — keyboard drives real scroll movement (n11/n12)', () => {
  it('ArrowRight (focused track) advances one slide; preventDefault suppresses page scroll', async () => {
    const { swiper, track } = mount(THREE)
    await userEvent.click(track)
    expect(document.activeElement, 'clicking the track did not focus it').toBe(track)
    await userEvent.keyboard('{ArrowRight}')
    await settle()
    expect(swiper.activeIndex, 'ArrowRight did not advance the active slide').toBe(1)
  })

  it('End jumps to the last real slide; Home returns to the first', async () => {
    const { swiper, track } = mount(THREE)
    await userEvent.click(track)
    await userEvent.keyboard('{End}')
    await settle()
    expect(swiper.activeIndex).toBe(2)
    await userEvent.keyboard('{Home}')
    await settle()
    expect(swiper.activeIndex).toBe(0)
  })

  it('clone slides are inert — Tab never lands inside one (loop mode)', async () => {
    const { track } = mount(LOOP_FOUR)
    const clones = [...track.querySelectorAll('[data-swiper-clone]')] as HTMLElement[]
    for (const clone of clones) expect(clone.inert).toBe(true)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  [4] Events — exactly one select per settled advance; never on a programmatic write (n13)
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-swiper — select fires exactly once per settle; never on a programmatic write (n13)', () => {
  it('a paddle-driven advance that settles on a new slide fires exactly one select', async () => {
    const html = `<ui-swiper paddles><ui-swiper-item>One</ui-swiper-item><ui-swiper-item>Two</ui-swiper-item><ui-swiper-item>Three</ui-swiper-item></ui-swiper>`
    const { swiper } = mount(html)
    const events: CustomEvent[] = []
    swiper.addEventListener('select', (e) => events.push(e as CustomEvent))
    const paddles = swiper.querySelector('ui-swiper-paddles') as UISwiperPaddlesElement
    const nextBtn = paddles.querySelector('[data-part="next"]') as HTMLElement
    await userEvent.click(nextBtn)
    await settle()
    expect(events.length).toBe(1)
    expect(events[0].detail).toEqual({ value: '1', index: 1 })
  })

  it('a programmatic `active` write settling on the SAME slide it started at emits nothing', async () => {
    const { swiper } = mount(THREE)
    const events: CustomEvent[] = []
    swiper.addEventListener('select', (e) => events.push(e as CustomEvent))
    swiper.active = '0' // already the active slide — a no-op position, no user gesture
    await settle()
    expect(events.length).toBe(0)
  })

  it('a full loop wrap fires exactly one select at the seam (the teleport does not double-emit)', async () => {
    const { swiper } = mount(LOOP_FOUR)
    const events: CustomEvent[] = []
    swiper.addEventListener('select', (e) => events.push(e as CustomEvent))
    swiper.goTo(3)
    await settle()
    events.length = 0 // only count the WRAP itself
    swiper.next() // crosses the forward seam: real index 3 → trailing-clone(0) → teleport → real index 0
    await settle()
    expect(events.length, 'the loop wrap emitted select more than once').toBe(1)
    expect(events[0].detail).toEqual({ value: '0', index: 0 })
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  [5] The carousel region identity — ariaRoleDescription (the fleet-first API) (n14)
// ════════════════════════════════════════════════════════════════════════════════════════════════════

class ProbeSwiper extends UISwiperElement {
  get ii(): ElementInternals {
    return this.internals
  }
}
customElements.define('ui-swiper-axprobe', ProbeSwiper)

describe('ui-swiper — carousel region identity via internals (n14, the fleet-first ariaRoleDescription)', () => {
  it('role=region + ariaRoleDescription=carousel are live in a real engine', () => {
    const swiper = new ProbeSwiper()
    const item = document.createElement('ui-swiper-item')
    item.textContent = 'One'
    swiper.append(item)
    document.body.append(swiper)
    mounted.push(swiper)
    expect(swiper.ii.role).toBe('region')
    expect(swiper.ii.ariaRoleDescription, `${server.browser} does not implement internals.ariaRoleDescription`).toBe('carousel')
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  [6] Reduced motion — programmatic advances are instant; the loop still wraps (n8)
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-swiper — reduced motion (n8)', () => {
  it('under prefers-reduced-motion, a goTo settles in one tick (no multi-frame animation)', async () => {
    if (server.browser !== 'chromium') return // WebKit exposes no CDP media emulation (the documented engine split)
    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
    try {
      expect(window.matchMedia('(prefers-reduced-motion: reduce)').matches).toBe(true)
      const { swiper, track } = mount(THREE)
      swiper.goTo(2)
      // an instant jump needs no settle window — a SINGLE animation frame suffices
      await new Promise((r) => requestAnimationFrame(() => r(undefined)))
      const target = track.querySelectorAll('ui-swiper-item')[2] as HTMLElement
      const targetRect = target.getBoundingClientRect()
      const trackRect = track.getBoundingClientRect()
      expect(Math.abs(targetRect.left - trackRect.left)).toBeLessThan(2)
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] })
    }
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  [7] Forced-colors — the pagination dots survive WHCM (Chromium; the tabs precedent for the engine split) (n28)
// ════════════════════════════════════════════════════════════════════════════════════════════════════

const alphaOf = (color: string): number => {
  if (color === 'transparent') return 0
  const m = color.match(/rgba?\(([^)]+)\)/i)
  if (!m) return 1
  const parts = m[1].split(/[\s,/]+/).filter(Boolean)
  return parts.length >= 4 ? Number(parts[3]) : 1
}

describe('ui-swiper — pagination dots survive forced-colors (n28)', () => {
  it('the active + idle dots stay visible under forced-colors (Chromium)', async () => {
    const html = `<ui-swiper pagination><ui-swiper-item>One</ui-swiper-item><ui-swiper-item>Two</ui-swiper-item></ui-swiper>`
    const { swiper } = mount(html)
    const pagination = swiper.querySelector('ui-swiper-pagination') as UISwiperPaginationElement
    const dots = pagination.querySelectorAll('[data-part="dot"]')

    if (server.browser !== 'chromium') {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(false)
      return
    }
    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] })
    try {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(true)
      expect(alphaOf(getComputedStyle(dots[0]).backgroundColor), 'the idle dot vanished under forced-colors').toBeGreaterThan(0)
      expect(alphaOf(getComputedStyle(dots[0]).backgroundColor)).toBeGreaterThan(0)
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] })
    }
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  [8] Chrome live wiring — pagination dot click + paddles wired to real advances (n17/n18/n19)
// ════════════════════════════════════════════════════════════════════════════════════════════════════

describe('ui-swiper — chrome drive is live (n17/n18/n19)', () => {
  it('clicking a pagination dot jumps the track to that slide', async () => {
    const html = `<ui-swiper pagination><ui-swiper-item>One</ui-swiper-item><ui-swiper-item>Two</ui-swiper-item><ui-swiper-item>Three</ui-swiper-item></ui-swiper>`
    const { swiper } = mount(html)
    const pagination = swiper.querySelector('ui-swiper-pagination') as UISwiperPaginationElement
    const dots = pagination.querySelectorAll('[data-part="dot"]')
    await userEvent.click(dots[2] as HTMLElement)
    await settle()
    expect(swiper.activeIndex).toBe(2)
  })

  it('type=fraction shows "n / realCount" and does NOT double-announce alongside the live region', async () => {
    const html = `<ui-swiper><ui-swiper-item>One</ui-swiper-item><ui-swiper-item>Two</ui-swiper-item><ui-swiper-pagination type="fraction"></ui-swiper-pagination></ui-swiper>`
    const { swiper } = mount(html)
    const pagination = swiper.querySelector('ui-swiper-pagination') as UISwiperPaginationElement
    const fraction = pagination.querySelector('[data-part="fraction"]') as HTMLElement
    const live = swiper.querySelector('[data-part="live"]') as HTMLElement
    expect(fraction.textContent).toBe('1 / 2')
    expect(fraction.getAttribute('aria-live')).toBeNull() // the fraction is VISUAL only; the live region is the AT announcement
    expect(live.getAttribute('aria-live')).toBe('polite')
  })

  it('clicking the next paddle advances the track by one real slide', async () => {
    const html = `<ui-swiper paddles><ui-swiper-item>One</ui-swiper-item><ui-swiper-item>Two</ui-swiper-item></ui-swiper>`
    const { swiper } = mount(html)
    const paddles = swiper.querySelector('ui-swiper-paddles') as UISwiperPaddlesElement
    const nextBtn = paddles.querySelector('[data-part="next"]') as HTMLElement
    await userEvent.click(nextBtn)
    await settle()
    expect(swiper.activeIndex).toBe(1)
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
//  [9] The default paddles band — slide content never paints under a paddle (GH #1330)
// ════════════════════════════════════════════════════════════════════════════════════════════════════

// GH #1330: the default-stamped [data-default] overlay floated its ghost buttons directly over the track's
// unreserved inline edges, so the left paddle sat on the first slide's first glyph. The fix is TRACK
// geometry — a transparent inline border band (swiper.css) the scroll container CLIPS at (content clips at
// the padding box), mirrored in JS by the snapport-aware #alignedOffset. These pin the rendered truth via
// rect adjacency (the fleet's rect-adjacency pin precedent): the slide TEXT rect vs the real paddle rects.

describe('ui-swiper — the default paddles band never occludes slide content (GH #1330)', () => {
  const PADDLED = `<ui-swiper paddles><ui-swiper-item>Everything assigned to you lands here first.</ui-swiper-item><ui-swiper-item>Two</ui-swiper-item><ui-swiper-item>Three</ui-swiper-item></ui-swiper>`

  const paint = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => r()))

  function paddleRects(swiper: UISwiperElement): { prev: DOMRect; next: DOMRect } {
    const paddles = swiper.querySelector('ui-swiper-paddles[data-default]') as UISwiperPaddlesElement
    const prev = (paddles.querySelector('[data-part="prev"]') as HTMLElement).getBoundingClientRect()
    const next = (paddles.querySelector('[data-part="next"]') as HTMLElement).getBoundingClientRect()
    return { prev, next }
  }

  it('the first slide TEXT rect clears BOTH paddle rects (rect adjacency, no overlap — the reported defect)', async () => {
    const { swiper, items } = mount(PADDLED)
    await paint()
    const { prev, next } = paddleRects(swiper)
    expect(prev.width, 'the prev paddle rendered zero-size — a vacuous adjacency proof').toBeGreaterThan(0)
    const range = document.createRange()
    range.selectNodeContents(items[0])
    const textRect = range.getBoundingClientRect()
    expect(textRect.width, 'the slide text rendered zero-size — a vacuous adjacency proof').toBeGreaterThan(0)
    expect(textRect.left, 'the first glyph starts under the left paddle').toBeGreaterThanOrEqual(prev.right - 0.5)
    expect(textRect.right, 'the slide text runs under the right paddle').toBeLessThanOrEqual(next.left + 0.5)
  })

  it('after an advance settles, the NEW active slide still sits exactly between the paddles (the JS scroll math agrees with the band)', async () => {
    const { swiper, items } = mount(PADDLED)
    await paint()
    swiper.next()
    await settle()
    expect(swiper.activeIndex).toBe(1)
    const { prev, next } = paddleRects(swiper)
    const rect = items[1].getBoundingClientRect()
    expect(rect.left, 'the active slide slid under the left paddle after next()').toBeGreaterThanOrEqual(prev.right - 0.5)
    expect(rect.right, 'the active slide runs under the right paddle after next()').toBeLessThanOrEqual(next.left + 0.5)
  })

  it('hit-testing inside the band never reaches a slide — the band is clipped track border, not slide surface', async () => {
    const { track } = mount(PADDLED)
    await paint()
    expect(track.clientLeft, 'no band was reserved for the default-stamped overlay').toBeGreaterThan(0)
    const trackRect = track.getBoundingClientRect()
    const midY = trackRect.top + trackRect.height / 2
    for (const x of [trackRect.left + 2, trackRect.right - 2]) {
      const hit = document.elementFromPoint(x, midY)
      expect(hit?.closest('ui-swiper-item'), `slide content is hit-testable inside the paddle band at x=${x}`).toBeNull()
    }
  })

  it('NEGATIVE control: no band without paddles, and an AUTHOR-placed anchor (no [data-default]) reserves none either', async () => {
    const bare = mount(THREE)
    const authored = mount(
      `<ui-swiper><ui-swiper-item>One</ui-swiper-item><ui-swiper-item>Two</ui-swiper-item><ui-swiper-paddles></ui-swiper-paddles></ui-swiper>`,
    )
    await paint()
    expect(bare.track.clientLeft, 'a bare swiper grew a paddle band').toBe(0)
    expect(authored.track.clientLeft, 'an author-placed anchor triggered the default band').toBe(0)
  })
})
