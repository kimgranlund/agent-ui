// gen-ui-live-narrow.browser.test.ts — GH #260 regression, at the fleet's own documented mobile
// viewport (414×896, ADR-0150's contract — the same default a real iPhone Safari session hit). The
// standing gen-ui-live.browser.test.ts pins a WIDE 1200×900 viewport DELIBERATELY (to prove the two-pane
// chrome renders side-by-side) — that pin means it never exercises `narrow-start='stack'` at all, the
// exact mode this page's shell uses below the 40rem line, and the exact mode GH #260's real device hit.
//
// ROOT CAUSE (found by measurement, not guesswork — see the GH #260 investigation): `ui-sandbox-frame`
// itself was never at fault. At narrow, `ui-super-shell`'s `[data-part='middle']` turns into a
// `flex-direction: column`, so the stacked chat pane's `flex: 0 0 auto` sizes it to its own UNBOUNDED
// content height (deliberate shell design — the stacked side's content "owns its narrow anatomy"), and
// canvas's base `min-block-size: 0` let it absorb the entire deficit once that content grew tall enough
// (a real multi-message chat turn easily does) — squeezing the render pane's `.surface-stack` toward a
// sliver or nothing, with `ui-sandbox-frame` itself mounted, contained, and painting correctly the whole
// time (verified: its own srcdoc/bootstrap/token-bridge/CSP chain never differs by engine — this was a
// shell LAYOUT defect, not a sandboxed-iframe rendering defect). Fixed at the shell level
// (super-shell.css's narrow-stack canvas floor, reusing --ui-super-shell-canvas-min-size) — this file
// proves the fix holds through the REAL page a real user hit, not just the isolated shell unit test
// (super-shell-responsive.browser.test.ts's own GH #260 case covers the component in isolation).
import { describe, it, expect, beforeAll } from 'vitest'
import { page } from 'vitest/browser'

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
const waitFor = async (predicate: () => boolean, timeoutMs = 4000): Promise<void> => {
  const start = Date.now()
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error('waitFor timed out')
    await new Promise((r) => setTimeout(r, 20))
  }
}

beforeAll(async () => {
  await page.viewport(414, 896) // ADR-0150's documented fleet default mobile viewport
  await import('./gen-ui-live.ts')
  await raf()
})

describe('gen-ui-live — GH #260 narrow-mobile regression: the render pane keeps a real, visible floor', () => {
  it('after a real turn renders a surface, canvas (the render pane\'s own shell wrapper) never collapses to a sliver', async () => {
    const editor = document.querySelector('.chat-composer [data-part="editor"]') as HTMLElement
    editor.textContent = 'Card game' // the recorded transport ignores the text — turn 1 always renders q3-revenue
    editor.dispatchEvent(new Event('input', { bubbles: true }))
    const sendBtn = document.querySelector('.chat-composer [data-part="send"]') as HTMLElement
    sendBtn.click()

    await waitFor(() => document.querySelectorAll('.surface-card').length >= 1)
    await raf()

    const renderPane = document.querySelector('.render-pane') as HTMLElement
    const shell = renderPane.closest('ui-super-shell') as HTMLElement
    expect(shell.getAttribute('narrow-start'), 'the shell really is in narrow-stack mode at this viewport').toBe('stack')

    const canvas = shell.querySelector('[data-part="canvas"]') as HTMLElement
    // --ui-super-shell-canvas-min-size = 9 modules × 1.125rem = 10.125rem = 162px at the default 16px root
    // font (super-shell.css) — the floor GH #260's fix guarantees canvas regardless of how tall the
    // stacked chat pane's own real turn content grows.
    expect(canvas.getBoundingClientRect().height, 'canvas keeps its 162px floor even with a real rendered chat turn above it').toBeGreaterThanOrEqual(161)

    // The concrete, user-visible proof: the mounted surface's own title text is a real, non-clipped-to-
    // zero box — not necessarily the WHOLE chart (a short viewport can still legitimately scroll), but
    // never literally nothing, which is what GH #260 actually reported.
    const cardTitle = document.querySelector('.surface-card-title') as HTMLElement
    expect(cardTitle.getBoundingClientRect().height, 'the surface card\'s own title renders with real height').toBeGreaterThan(0)
  })
})
