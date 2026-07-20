// agent-admin-app-scroll.browser.test.ts — GH #130: the standalone `#app` shell (agent-admin-app.html,
// a full-viewport 100dvh flex column) must stay pinned to the viewport when an inner region's content
// grows past its own bounds — only that inner region should scroll, never the document itself. GH #52/
// ADR-0154: the scrollable region is now the ACTIVE SEGMENT inside ui-super-shell's segmented
// options-pane (`[data-segment][data-active]`, `overflow-y: auto`) — the outer pane box itself is
// `overflow-y: hidden` by design (a segmented pane's strip stays fixed; only the active segment scrolls).
//
// Its own FILE (not folded into agent-admin-app.browser.test.ts): that file's module-level
// `import './agent-admin-app.ts'` runs before any test body executes, so `root` (agent-admin-app.ts:33,
// `document.querySelector('#app') ?? document.body`) falls back to `document.body` — the real page's
// static HTML always provides `<div id="app">` before the script runs, so that fallback never fires in
// production, but it means that file's own tests never exercise the `#app`-scoped CSS this issue lives
// in. This file creates a real `#app` element FIRST, then dynamically imports the page module, so the
// selector this bug is actually about is genuinely in play.
//
// Asserts on COMPUTED STYLE (`overflow: hidden`/`clip` on html/body/#app), not on a behavioral scroll
// simulation: two different simulation techniques were tried while building this test — a dispatched
// `WheelEvent` (synthetic events don't trigger a headless engine's default scroll action, only TRUSTED
// real-input events do — a no-op in BOTH the broken and fixed states) and a raw `document.documentElement
// .scrollTop` assignment (the root scroller accepts a programmatic scrollTop write in this harness
// REGARDLESS of the CSS overflow value — a browser/engine quirk, not something this fix controls) — both
// were false negatives/positives that would have shipped a regression test proving nothing. Whether
// `overflow: hidden` genuinely blocks a real user's wheel/touch/keyboard scroll is bedrock, universally-
// implemented CSS behavior; asserting the computed value IS the reliable, deterministic proof that this
// fix's own rule is actually in effect.
import { describe, it, expect } from 'vitest'
import { page } from 'vitest/browser'

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

describe('agent-admin-app — the #app shell stays pinned when inner content overflows (GH #130)', () => {
  it('html/body/#app all compute overflow:hidden, and the inner panel stays reachable via its own scroll', async () => {
    await page.viewport(1024, 700) // above ui-super-shell's 40rem/640px narrow container-query threshold — the WIDE options-pane layout
    const app = document.createElement('div')
    app.id = 'app'
    document.body.append(app)
    await import('./agent-admin-app.ts')
    await raf()
    await raf()

    const appEl = document.getElementById('app') as HTMLElement
    const adminEl = document.querySelector('ui-agent-admin') as HTMLElement
    // The active segment (default: Settings) is the real scroll container now — the outer options-pane
    // box is overflow-y:hidden by design (SPEC-R7a).
    const tabsEl = document.querySelector('[data-slot-name="options-pane"] [data-segment][data-active]') as HTMLElement | null
    expect(appEl, "the real #app element must exist for this bug's own CSS selector to apply").not.toBeNull()

    // GH #130's own fix: the document must never be allowed to grow past the viewport regardless of what
    // an inner descendant does — asserted on every level of the chain that could otherwise leak overflow.
    const overflowContains = (v: string): boolean => v === 'hidden' || v === 'clip'
    expect(overflowContains(getComputedStyle(document.documentElement).overflow), 'html must contain overflow').toBe(true)
    expect(overflowContains(getComputedStyle(document.body).overflow), 'body must contain overflow').toBe(true)
    expect(overflowContains(getComputedStyle(appEl).overflow), '#app must contain overflow (belt-and-braces)').toBe(true)

    // The shell's OWN box must still exactly fill the viewport (100dvh, unaffected either way) — the bug
    // was never that #app's box grows, it's that its CONTENT visually spills past it uncontained.
    expect(appEl.getBoundingClientRect().height).toBe(700)

    // Simulate "enough content to exceed the viewport" (the issue's own repro) by growing the real
    // scrollable region directly, rather than driving the tab-switch interaction.
    const bigBlock = document.createElement('div')
    bigBlock.style.blockSize = '3000px'
    ;(tabsEl ?? adminEl).appendChild(bigBlock)
    await raf()

    // The overflowing content must still be REACHABLE — the fix must not just clip it into oblivion; the
    // active segment's own overflow-y:auto (super-shell.css) does the real containing+scrolling job.
    if (tabsEl) {
      expect(getComputedStyle(tabsEl).overflowY, 'the inner panel must own its own scroll region').toBe('auto')
      tabsEl.scrollTop = 99999
      expect(tabsEl.scrollTop, 'the panel must genuinely scroll to reach the overflowing content').toBeGreaterThan(0)
    }
  })
})
