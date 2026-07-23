import { describe, it, expect } from 'vitest'
// Side-effect import: the page module mounts the ui-super-shell composition guide into document.body
// (mountPage appends to `#app ?? document.body`; the adr-index.browser.test.ts/modal-demo.browser.test.ts
// precedent), self-importing the foundation cascade + ui-* controls + this page's own super-shell.css.
import './super-shell.ts'

// super-shell.browser.test.ts — min-size-floors census (GH #185 follow-up) → GH #205 auto-collapse.
// ui-super-shell's canvas gained a live-layout floor (SPEC-R13a), which meant a dual-sided demo on this
// page could genuinely overflow its own row when squeezed into the 640-846px window (rails/panes' fixed
// geometry + the canvas floor exceed the frame's width) — the INTERIM outcome AC20 used to pin. GH #205
// closed that gap with a measurement-based auto-collapse (SPEC-R13b): a `collapse`-mode side whose
// geometry no longer fits at the row's LIVE width now hides itself (an internal, non-reflected
// `data-auto-collapsed-*` attribute — never the public `collapsed-*` props) instead of letting the row
// overflow. Measured live, both engines: the section-1 full-grammar demo (both sides + rails, the widest
// natural-fit requirement of any demo here) squeezed to 700px now auto-collapses its END side — zero
// overflow, the end rail genuinely absent from layout, nothing left to scroll to. (This page's
// `.ss-demo`/`.ss-resize` frame CSS still carries `overflow-x: auto` as a defense-in-depth belt for any
// future demo/config this auto-collapse mechanism doesn't cover — e.g. a `stack`/`tabs` side, R13b's own
// carve-out — not because THIS demo needs to scroll anymore.)
const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

describe('ui-super-shell demo page — GH #205 auto-collapse retires the squeeze-window overflow (no scroll needed)', () => {
  it('forcing the section-1 full-grammar demo to a squeeze width auto-collapses its END side — no overflow, nothing to scroll to', async () => {
    await raf()
    const demos = [...document.querySelectorAll<HTMLElement>('ui-super-shell.ss-demo')]
    expect(demos.length, 'expected at least the section-1 full-grammar demo').toBeGreaterThan(0)
    const demo = demos[0]! // section 1: header/global-nav/nav-pane/content/options-pane/global-options/footer
    expect(demo.querySelector('[data-slot-name="global-options"]'), 'sanity: this is the dual-rail demo').not.toBeNull()

    demo.style.inlineSize = '700px' // inside the flagged 640-846px window for a rails+panes dual-sided shell
    await raf()
    await new Promise((r) => setTimeout(r, 50)) // let the band-hygiene ResizeObserver's #syncFitCollapse settle
    await raf()

    expect(demo.hasAttribute('data-auto-collapsed-end'), 'GH #205: the END side auto-collapses at this squeeze width').toBe(true)
    expect(demo.hasAttribute('collapsed-end'), 'the PUBLIC collapsed-end prop is never written by the ambient mechanism (R2d)').toBe(false)
    expect(demo.scrollWidth, 'the row no longer overflows once the offending side auto-collapses').toBeLessThanOrEqual(demo.clientWidth + 1)

    const endRail = demo.querySelector('[data-slot-name="global-options"]') as HTMLElement
    expect(getComputedStyle(endRail).display, 'the auto-collapsed end rail is genuinely absent from layout, not just scrolled off').toBe('none')
  })
})
