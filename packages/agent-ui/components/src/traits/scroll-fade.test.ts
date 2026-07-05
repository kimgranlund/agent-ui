import { describe, it, expect } from 'vitest'
import { UIElement, prop, type PropsSchema, type ReactiveProps } from '../dom/index.ts'
import { scrollFade } from './scroll-fade.ts'

// The container box-model edge-aware scroll-fade trait. jsdom never lays out real boxes — scrollHeight /
// clientHeight / scrollTop are stubbed per-instance (configurable own properties shadow the inert getters) so
// the DECISION logic (three comparisons → two attribute flags) is provable without a real engine. The
// rendered PAINT (does a `[data-fade-top]` element actually mask its top edge, both engines) is the
// card/modal/select/menu/combo-box `.browser.test.ts` legs this trait feeds.

/** Stub scroll geometry on `el` (jsdom's real getters are always 0/inert). */
function stubScroll(el: HTMLElement, geo: { scrollHeight: number; clientHeight: number; scrollTop: number }): void {
  Object.defineProperty(el, 'scrollHeight', { value: geo.scrollHeight, configurable: true })
  Object.defineProperty(el, 'clientHeight', { value: geo.clientHeight, configurable: true })
  Object.defineProperty(el, 'scrollTop', { value: geo.scrollTop, configurable: true, writable: true })
}

const scroll = (el: HTMLElement): void => {
  el.dispatchEvent(new Event('scroll'))
}

class ScrollFadeHost extends UIElement {
  releaseFn: (() => void) | null = null
  protected connected(): void {
    this.releaseFn = scrollFade(this)
  }
}
customElements.define('ui-scroll-fade-probe', ScrollFadeHost)

describe('scrollFade — the edge-aware decision (jsdom, stubbed geometry)', () => {
  it('a NON-scrolling viewport (scrollHeight == clientHeight) gets NEITHER flag', () => {
    const el = new ScrollFadeHost()
    stubScroll(el, { scrollHeight: 100, clientHeight: 100, scrollTop: 0 })
    document.body.append(el)
    expect(el.hasAttribute('data-fade-top'), 'a short viewport should never fade its top').toBe(false)
    expect(el.hasAttribute('data-fade-bottom'), 'a short viewport should never fade its bottom').toBe(false)
    el.remove()
  })

  it('at the TOP of a scrollable viewport: bottom fades (more below), top does not (nothing above)', () => {
    const el = new ScrollFadeHost()
    stubScroll(el, { scrollHeight: 500, clientHeight: 100, scrollTop: 0 })
    document.body.append(el)
    expect(el.hasAttribute('data-fade-top'), 'at scrollTop 0 there is nothing hidden above').toBe(false)
    expect(el.hasAttribute('data-fade-bottom'), 'at scrollTop 0 there IS more content below').toBe(true)
    el.remove()
  })

  it('scrolled to the MIDDLE: both edges fade (content hidden both ways)', () => {
    const el = new ScrollFadeHost()
    stubScroll(el, { scrollHeight: 500, clientHeight: 100, scrollTop: 200 })
    document.body.append(el)
    scroll(el)
    expect(el.hasAttribute('data-fade-top')).toBe(true)
    expect(el.hasAttribute('data-fade-bottom')).toBe(true)
    el.remove()
  })

  it('scrolled to the BOTTOM: top fades (content hidden above), bottom does not (nothing left below)', () => {
    const el = new ScrollFadeHost()
    stubScroll(el, { scrollHeight: 500, clientHeight: 100, scrollTop: 400 })
    document.body.append(el)
    scroll(el)
    expect(el.hasAttribute('data-fade-top'), 'scrolled to the end — content IS hidden above').toBe(true)
    expect(el.hasAttribute('data-fade-bottom'), 'scrolled to the end — nothing left below').toBe(false)
    el.remove()
  })

  it('re-measures on scroll (a live listener, not a one-shot mount read)', () => {
    const el = new ScrollFadeHost()
    stubScroll(el, { scrollHeight: 500, clientHeight: 100, scrollTop: 0 })
    document.body.append(el)
    expect(el.hasAttribute('data-fade-top')).toBe(false)

    Object.defineProperty(el, 'scrollTop', { value: 400, configurable: true })
    scroll(el)
    expect(el.hasAttribute('data-fade-top'), 'the scroll listener did not re-run the decision').toBe(true)
    el.remove()
  })

  it('an explicit viewport (a control-owned part, distinct from the host) is the one observed + flagged', () => {
    class PartHost extends UIElement {
      // NOT named `part` — that collides with the native Element.part (a DOMTokenList; CSS Shadow Parts),
      // the same class of collision `scrollable` (not `scroll`) dodges elsewhere in this fleet.
      viewportPart = document.createElement('div')
      protected connected(): void {
        scrollFade(this, { viewport: this.viewportPart })
      }
    }
    customElements.define('ui-scroll-fade-part-probe', PartHost)

    const el = new PartHost()
    stubScroll(el.viewportPart, { scrollHeight: 500, clientHeight: 100, scrollTop: 0 })
    document.body.append(el)
    expect(el.hasAttribute('data-fade-bottom'), 'the flag landed on the host, not the viewport part').toBe(false)
    expect(el.viewportPart.hasAttribute('data-fade-bottom'), 'the viewport part did not get the fade flag').toBe(true)
    el.remove()
  })

  it('a `paintTarget` distinct from `viewport` (ui-card: measure the card, paint ui-card-content) receives the flags + bracket offsets, not the viewport', () => {
    // The ui-card use case: the CARD is the actual overflow:auto element (scrollTop/Height/clientHeight all
    // live there, and its direct children are the sticky brackets the bracket query targets), but the mask must
    // paint on a SIBLING region (ui-card-content), which the CARD's own scroll state does not otherwise touch.
    class SplitHost extends UIElement {
      viewport = document.createElement('div') // stands in for the card (measured, never painted)
      paint = document.createElement('div') // stands in for ui-card-content (painted, never measured)
      protected connected(): void {
        this.viewport.append(this.paint) // paint is a descendant of viewport, same as content inside the card
        scrollFade(this, { viewport: this.viewport, paintTarget: this.paint })
      }
    }
    customElements.define('ui-scroll-fade-split-probe', SplitHost)

    const el = new SplitHost()
    stubScroll(el.viewport, { scrollHeight: 500, clientHeight: 100, scrollTop: 200 }) // mid-scroll: both edges
    document.body.append(el)

    expect(el.viewport.hasAttribute('data-fade-top'), 'a flag leaked onto the measured viewport').toBe(false)
    expect(el.viewport.hasAttribute('data-fade-bottom'), 'a flag leaked onto the measured viewport').toBe(false)
    expect(el.paint.hasAttribute('data-fade-top'), 'the paint target did not get the top flag').toBe(true)
    expect(el.paint.hasAttribute('data-fade-bottom'), 'the paint target did not get the bottom flag').toBe(true)
    // the bracket offsets (--ui-box-head/-foot) land on the paint target too, not the measured viewport.
    expect(el.viewport.style.getPropertyValue('--ui-box-head')).toBe('')
    expect(el.paint.style.getPropertyValue('--ui-box-head')).toBe('0px') // no bracket in this probe

    // re-measuring off a SCROLL event on the viewport (not the paint target) still updates the paint target —
    // proof the listener is genuinely wired to `viewport`, not `paint`.
    Object.defineProperty(el.viewport, 'scrollTop', { value: 0, configurable: true })
    el.viewport.dispatchEvent(new Event('scroll'))
    expect(el.paint.hasAttribute('data-fade-top'), 'a scroll event on the viewport did not re-run the decision').toBe(false)
    expect(el.paint.hasAttribute('data-fade-bottom'), 'at scrollTop 0 there IS still more content below').toBe(true)
    el.remove()
  })

  it('a `brackets` root distinct from BOTH `viewport` and `paintTarget` (ui-card wrapper model, 2026-07-06) queries the bracket band off a THIRD element', () => {
    // The ui-card wrapper model: `viewport` is the author's [scroll-wrapper] (measured — its scrollTop/Height/
    // clientHeight are real), `paintTarget` is ui-card-content (painted), and `brackets` is the CARD — the
    // header/footer's actual direct parent, two levels above the wrapper and a sibling's child relative to
    // content. All three are DIFFERENT elements; none of the flags/offsets should leak onto the wrong one.
    class WrapperHost extends UIElement {
      card = document.createElement('div') // stands in for ui-card (the header lives here, brackets root)
      content = document.createElement('div') // stands in for ui-card-content (paintTarget)
      wrapper = document.createElement('div') // stands in for [scroll-wrapper] (viewport)
      header = document.createElement('header')
      protected connected(): void {
        Object.defineProperty(this.header, 'offsetHeight', { value: 40, configurable: true })
        this.card.append(this.header, this.content)
        this.content.append(this.wrapper)
        scrollFade(this, { viewport: this.wrapper, paintTarget: this.content, brackets: this.card })
      }
    }
    customElements.define('ui-scroll-fade-wrapper-probe', WrapperHost)

    const el = new WrapperHost()
    stubScroll(el.wrapper, { scrollHeight: 500, clientHeight: 100, scrollTop: 200 }) // mid-scroll: both edges
    document.body.append(el)

    // the flags land on content (paintTarget) alone — neither the wrapper (viewport) nor the card (brackets).
    expect(el.wrapper.hasAttribute('data-fade-top'), 'a flag leaked onto the measured wrapper').toBe(false)
    expect(el.card.hasAttribute('data-fade-top'), 'a flag leaked onto the brackets root (the card)').toBe(false)
    expect(el.content.hasAttribute('data-fade-top'), 'the paint target did not get the top flag').toBe(true)
    expect(el.content.hasAttribute('data-fade-bottom'), 'the paint target did not get the bottom flag').toBe(true)
    // the header — a direct child of the CARD, neither the wrapper nor content — was still found + published,
    // and landed on content alone.
    expect(el.content.style.getPropertyValue('--ui-box-head')).toBe('40px')
    expect(el.wrapper.style.getPropertyValue('--ui-box-head')).toBe('')
    expect(el.card.style.getPropertyValue('--ui-box-head')).toBe('')
    el.remove()
  })

  it('release() tears down early — the scroll listener + ResizeObserver stop, the flags clear', () => {
    const el = new ScrollFadeHost()
    stubScroll(el, { scrollHeight: 500, clientHeight: 100, scrollTop: 400 })
    document.body.append(el)
    expect(el.hasAttribute('data-fade-top')).toBe(true)

    el.releaseFn?.()
    expect(el.hasAttribute('data-fade-top'), 'release() did not clear the flag').toBe(false)
    expect(el.hasAttribute('data-fade-bottom'), 'release() did not clear the flag').toBe(false)

    // Post-release, further scroll events must be no-ops (the listener is gone).
    Object.defineProperty(el, 'scrollTop', { value: 0, configurable: true })
    scroll(el)
    expect(el.hasAttribute('data-fade-top'), 'a scroll event fired after release() re-armed the flag').toBe(false)
    el.remove()
  })

  it('auto-cleanup: disconnect removes the listener + clears the flags (rides the host connection)', () => {
    const el = new ScrollFadeHost()
    stubScroll(el, { scrollHeight: 500, clientHeight: 100, scrollTop: 400 })
    document.body.append(el)
    expect(el.hasAttribute('data-fade-top')).toBe(true)

    el.remove() // disconnect → the effect's cleanup runs → flags clear + listener/observer torn down
    expect(el.hasAttribute('data-fade-top'), 'disconnect did not clear the flag').toBe(false)
  })
})

// ── the reactive `enabled` gate — a REAL signal-backed prop, mirroring tabbable.test.ts's rigor ──────────

const gatedProps = {
  fadeOn: prop.boolean(false),
} satisfies PropsSchema

interface GatedHost extends ReactiveProps<typeof gatedProps> {}
class GatedHost extends UIElement {
  static props = gatedProps
  protected connected(): void {
    scrollFade(this, { enabled: () => this.fadeOn })
  }
}
customElements.define('ui-scroll-fade-gated-probe', GatedHost)

describe('scrollFade — the reactive `enabled` gate (a real signal, ADR precedent: tabbable.ts)', () => {
  it('enabled() false at connect: the mechanism never runs, even on a genuinely scrollable viewport', () => {
    const el = new GatedHost()
    stubScroll(el, { scrollHeight: 500, clientHeight: 100, scrollTop: 0 })
    document.body.append(el)
    expect(el.hasAttribute('data-fade-bottom'), 'the gate is off — no flag should ever be set').toBe(false)
    el.remove()
  })

  it('flipping the signal true LIVE arms the mechanism (the opt-in prop toggling on mid-session)', async () => {
    const el = new GatedHost()
    stubScroll(el, { scrollHeight: 500, clientHeight: 100, scrollTop: 0 })
    document.body.append(el)
    expect(el.hasAttribute('data-fade-bottom')).toBe(false)

    el.fadeOn = true
    await el.updateComplete // effect re-runs are microtask-batched — wait for the flush
    expect(el.hasAttribute('data-fade-bottom'), 'turning the gate on did not arm the fade').toBe(true)
    el.remove()
  })

  it('flipping the signal back to false tears the mechanism down + clears both flags', async () => {
    const el = new GatedHost()
    el.fadeOn = true
    stubScroll(el, { scrollHeight: 500, clientHeight: 100, scrollTop: 400 })
    document.body.append(el)
    expect(el.hasAttribute('data-fade-top')).toBe(true)

    el.fadeOn = false
    await el.updateComplete
    expect(el.hasAttribute('data-fade-top'), 'turning the gate off left a stale flag').toBe(false)
    expect(el.hasAttribute('data-fade-bottom')).toBe(false)

    // and a scroll event after the gate is off must not re-arm it (the listener was torn down)
    scroll(el)
    expect(el.hasAttribute('data-fade-top'), 'a scroll event after the gate closed re-armed a torn-down listener').toBe(false)
    el.remove()
  })
})

// ── presence-aware bracket offsets (--ui-box-head / --ui-box-foot) ───────────────────────────────────────
// The trait publishes each edge's sticky-bracket band so container-box.css can extend the fade ramp PAST a
// present header/footer (0px ⇒ no bracket ⇒ the plain viewport-edge fade). jsdom lays out nothing, so the
// bracket's offsetHeight is stubbed (getComputedStyle margins resolve to '' ⇒ 0) — the DECISION (which edge
// has a bracket, at what depth) is provable here; the rendered mask offset is the .browser.test.ts leg.

/** A probe whose viewport (the host) optionally holds header/footer brackets with a stubbed block-size. */
function withBrackets(opts: { head?: number; foot?: number }): ScrollFadeHost {
  const el = new ScrollFadeHost()
  if (opts.head != null) {
    const h = document.createElement('header')
    Object.defineProperty(h, 'offsetHeight', { value: opts.head, configurable: true })
    el.append(h)
  }
  if (opts.foot != null) {
    const f = document.createElement('footer')
    Object.defineProperty(f, 'offsetHeight', { value: opts.foot, configurable: true })
    el.append(f)
  }
  stubScroll(el, { scrollHeight: 500, clientHeight: 100, scrollTop: 0 })
  document.body.append(el)
  return el
}

describe('scrollFade — presence-aware bracket offsets (--ui-box-head / --ui-box-foot)', () => {
  it('a header bracket publishes its band to --ui-box-head; no footer ⇒ --ui-box-foot is 0px', () => {
    const el = withBrackets({ head: 40 }) // 40px offsetHeight + jsdom margin 0
    expect(el.style.getPropertyValue('--ui-box-head')).toBe('40px')
    expect(el.style.getPropertyValue('--ui-box-foot'), 'a bracketless edge must publish 0px, not a fade band').toBe('0px')
    el.remove()
  })

  it('a header AND a footer publish both bands independently', () => {
    const el = withBrackets({ head: 24, foot: 32 })
    expect(el.style.getPropertyValue('--ui-box-head')).toBe('24px')
    expect(el.style.getPropertyValue('--ui-box-foot')).toBe('32px')
    el.remove()
  })

  it('NO brackets ⇒ both offsets are 0px (the fade collapses to the plain viewport-edge mask)', () => {
    const el = withBrackets({})
    expect(el.style.getPropertyValue('--ui-box-head')).toBe('0px')
    expect(el.style.getPropertyValue('--ui-box-foot')).toBe('0px')
    el.remove()
  })

  it('release() clears the published offsets, not only the flags', () => {
    const el = withBrackets({ head: 40, foot: 40 })
    expect(el.style.getPropertyValue('--ui-box-head')).toBe('40px')
    el.releaseFn?.()
    expect(el.style.getPropertyValue('--ui-box-head'), 'release() left a stale bracket offset').toBe('')
    expect(el.style.getPropertyValue('--ui-box-foot')).toBe('')
    el.remove()
  })

  it('the reactive gate OFF at connect publishes no offsets (the mechanism never arms — a header present)', () => {
    const el = new GatedHost() // fadeOn defaults false
    const h = document.createElement('header')
    Object.defineProperty(h, 'offsetHeight', { value: 40, configurable: true })
    el.append(h)
    stubScroll(el, { scrollHeight: 500, clientHeight: 100, scrollTop: 0 })
    document.body.append(el)
    expect(el.style.getPropertyValue('--ui-box-head'), 'a disabled fade still measured a bracket').toBe('')
    el.remove()
  })
})
