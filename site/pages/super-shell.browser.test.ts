import { describe, it, expect } from 'vitest'
// Side-effect import: the page module mounts the ui-super-shell composition guide into document.body
// (mountPage appends to `#app ?? document.body`; the adr-index.browser.test.ts/modal-demo.browser.test.ts
// precedent), self-importing the foundation cascade + ui-* controls + this page's own super-shell.css.
import './super-shell.ts'

// super-shell.browser.test.ts — min-size-floors census (GH #185 follow-up): the demo-frame clip→scroll
// fix. Once ui-super-shell's canvas gained a live-layout floor (the control-level fix), a dual-sided demo
// on this page can genuinely overflow its own row when squeezed into the 640-846px window (rails/panes'
// fixed geometry + the canvas floor exceed the frame's width) — the deliberate, honest outcome the
// control-level fix chose over silently crushing canvas. This page's own demo-frame CSS (`.ss-demo`,
// `.ss-resize`) used to clip that overflow outright (`overflow: hidden`/`overflow: hidden auto`), cutting
// the end pane off with no way to reach it; both now use `overflow-x: auto` so the teaching render
// scrolls instead. This proves the SCROLL affordance is real (not just the computed keyword), on a real
// demo shell pulled straight off the page — the section-1 full-grammar demo (both sides + rails, the
// widest natural-fit requirement of any demo here), forced to a squeeze width no reader-visible chrome
// change is needed to reach (dragging the browser window narrower reaches the same width on section 1/2
// even without the `.ss-resize` handle, which only wraps section 4).
const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

describe('ui-super-shell demo page — the frame scrolls (not clips) when a dual-sided demo overflows its squeeze window', () => {
  it('forcing the section-1 full-grammar demo to a squeeze width makes its frame scrollable, reaching the clipped end rail', async () => {
    await raf()
    const demos = [...document.querySelectorAll<HTMLElement>('ui-super-shell.ss-demo')]
    expect(demos.length, 'expected at least the section-1 full-grammar demo').toBeGreaterThan(0)
    const demo = demos[0]! // section 1: header/global-nav/nav-pane/content/options-pane/global-options/footer
    expect(demo.querySelector('[data-slot-name="global-options"]'), 'sanity: this is the dual-rail demo').not.toBeNull()

    demo.style.inlineSize = '700px' // inside the flagged 640-846px window for a rails+panes dual-sided shell
    await raf()

    expect(getComputedStyle(demo).overflowX, 'the frame must allow horizontal scroll, not clip').toBe('auto')
    expect(demo.scrollWidth, 'the row genuinely overflows the frame at this width (the honest outcome, not a crush)').toBeGreaterThan(demo.clientWidth)

    // Reachability, not just the computed keyword: the end rail (global-options) is currently scrolled
    // past the frame's right edge — scrolling to the frame's own scroll-end brings it into view.
    demo.scrollLeft = demo.scrollWidth
    await raf()
    const endRail = demo.querySelector('[data-slot-name="global-options"]') as HTMLElement
    const railRect = endRail.getBoundingClientRect()
    const frameRect = demo.getBoundingClientRect()
    expect(railRect.right, 'the end rail is reachable within the frame once scrolled, not permanently clipped').toBeLessThanOrEqual(frameRect.right + 1)
  })
})
