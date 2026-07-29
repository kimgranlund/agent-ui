// gen-ui-live-narrow.browser.test.ts — GH #260 regression, at Kim's ACTUAL reported geometry
// (414×700 — a real iPhone Safari's visible content viewport, once its own toolbar chrome is
// subtracted from the 414×896 nominal screen size; the fleet's OWN 414×896 default does NOT
// reproduce the bug at all — see the "vacuous at 896" note below). The standing
// gen-ui-live.browser.test.ts pins a WIDE 1200×900 viewport DELIBERATELY (to prove the two-pane
// chrome renders side-by-side) — that pin means it never exercises `narrow-start='stack'` at all,
// the exact mode this page's shell uses below the 40rem line, and the exact mode GH #260's real
// device hit.
//
// ROOT CAUSE + THE TWO-PART FIX (found and closed by measurement, not guesswork — see the GH #260
// investigation): `ui-sandbox-frame` itself was never at fault — its srcdoc/bootstrap/token-
// bridge/CSP chain is engine-agnostic and never differs by browser. At narrow, `ui-super-shell`'s
// `[data-part='middle']` turns into a `flex-direction: column`, so the stacked chat pane's own
// `flex: 0 0 auto` sizes it to its UNBOUNDED content height (deliberate shell design), and canvas's
// base `min-block-size: 0` let it absorb the entire deficit once that content grew tall enough.
// Part 1 (a floor alone, first shipped): giving canvas a dedicated `min-block-size` floor
// (`--ui-super-shell-canvas-min-block-size`, SPEC-R15b) stopped the SQUEEZE — canvas's own DOM box
// stayed at a real, non-zero height. But a floor alone is NOT sufficient: an independent review
// measured that canvas's floor held 162px in the DOM while its VISIBLE portion (intersected with
// this very page's own `[data-page-content] { overflow: hidden }`, gen-ui-live.css:19) was still
// only ~44px — the floor existed, but nothing between that outer clip and canvas could ever SCROLL
// to reach the rest of it. Part 2 (the real fix, SPEC-R15a): `[data-part='middle']` itself becomes
// a real scroll container (`overflow-y: auto`) at narrow-stack, so once the stacked side's content
// forces genuine overflow, that overflow is a real, reachable scroll — not a silent, permanent cut.
// This file proves BOTH parts hold through the REAL page a real user hit (the isolated-component
// proof lives in super-shell-responsive.browser.test.ts's own two GH #260 cases: one for the floor,
// one for the floor's reachability through an explicit outer clip).
//
// VACUOUS-AT-896 NOTE (why this file does NOT reuse the fleet's documented 414×896 default): at
// that height the pre-fix bug does not reproduce at all — canvas's natural flex share already
// exceeds any floor value, so a test at 414×896 would pass identically whether or not GH #260 was
// ever fixed (measured, both engines: canvas ≈240px pre-fix at 896 tall vs ≈44px at 700 tall, same
// turn content). 414×700 is the geometry that actually reproduces Kim's report.
import { describe, it, expect, beforeAll, vi } from 'vitest'
import { page } from 'vitest/browser'

// GH #347 — REAL-TIMING HEADROOM. This file awaits real elapsed time (rAF frame settles, real-timer
// waits, the `waitFor` retry poll below, a `page.viewport()` driver round trip, and a mid-test
// page-module `import()`), so its duration is set by the browser's scheduling, which stretches under
// concurrent host load.
// Class definition + why this is not a global raise: vitest.browser.config.ts, REAL-TIMING HEADROOM.
// Covers the TESTS only. The `beforeAll` below waits on the scheduler too, but no hook headroom would
// help it: its `waitFor` THROWS at its own 10s budget (see the helper's `throw` on the next lines), well
// inside browser mode's 30000ms default hook bound, so the hook's own budget is the lever there, not the
// bound. That early-give-up-under-load mode is #359's subject, not this file's to fix.
vi.setConfig({ testTimeout: 30_000 })

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
const waitFor = async (predicate: () => boolean, timeoutMs = 4000): Promise<void> => {
  const start = Date.now()
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error('waitFor timed out')
    await new Promise((r) => setTimeout(r, 20))
  }
}

/** Intersect `el`'s own generated box with every ANCESTOR whose overflow actually clips (any
 *  overflow value other than 'visible'), up to and including the viewport — the geometry a real
 *  user would actually SEE at the CURRENT scroll position, as opposed to `getBoundingClientRect()`
 *  alone, which reports el's own box regardless of whether an ancestor clips it away entirely
 *  (exactly the gap GH #260's review caught: a DOM-present floor is not the same claim as a
 *  genuinely visible one). */
function visibleRect(el: HTMLElement): { top: number; bottom: number; height: number } {
  const rect = el.getBoundingClientRect()
  let top = rect.top
  let bottom = rect.bottom
  let cur: HTMLElement | null = el.parentElement
  while (cur) {
    const cs = getComputedStyle(cur)
    if (cs.overflowY !== 'visible' || cs.overflowX !== 'visible') {
      const cr = cur.getBoundingClientRect()
      top = Math.max(top, cr.top)
      bottom = Math.min(bottom, cr.bottom)
    }
    cur = cur.parentElement
  }
  top = Math.max(top, 0)
  bottom = Math.min(bottom, window.innerHeight)
  return { top, bottom, height: Math.max(0, bottom - top) }
}

beforeAll(async () => {
  await page.viewport(414, 700) // Kim's actual reported geometry (GH #260) — NOT the fleet's 414×896 default
  await import('./gen-ui-live.ts')
  await raf()
  // GH #266 — the page's own `wireLiveOverlay()` now probes `/status` asynchronously on mount (a real
  // fetch round trip against the dev server, not the synchronous `addMessage` call this replaced). The
  // "Recorded demo" BADGE is set synchronously at mount already (so waiting on it alone is a no-op) — the
  // real settle signal is the probe's OWN system message, only appended once the round trip resolves. Wait
  // for it BEFORE sending the turn below, so the chat pane's own content height — this test's own geometry
  // depends on it, being GH #260's actual reproduction — is deterministic rather than racing the probe.
  await waitFor(() => document.querySelectorAll('.chat-log .msg[data-role="system"]').length > 0, 10000) // a real network round trip, under host load — the default 4000ms budget isn't always enough
})

describe('gen-ui-live — GH #260 regression at Kim\'s actual reported geometry (414×700)', () => {
  it('after a real turn renders a surface, the render pane genuinely scrolls into view instead of vanishing behind an outer clip', async () => {
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

    const middle = shell.querySelector('[data-part="middle"]') as HTMLElement
    const canvas = shell.querySelector('[data-part="canvas"]') as HTMLElement
    const sandboxFrame = document.querySelector('ui-sandbox-frame') as HTMLElement

    // SPEC-R15a — middle is a real scroll container at narrow-stack, not the default 'visible'.
    expect(getComputedStyle(middle).overflowY, 'the scroll seam is live on the real page').toBe('auto')

    // Pre-scroll (the page's OWN default, un-interacted state): this is the exact state Kim's
    // screenshot captured — assert it honestly reproduces the reported symptom before proving the
    // fix, rather than only ever checking the post-scroll state.
    const preScroll = visibleRect(canvas)
    expect(preScroll.height, 'pre-scroll, canvas is still a mostly-invisible sliver — matches the ORIGINAL bug report; a deliberate scroll is required, same as any normal overflowing page').toBeLessThan(60)

    // What a real touch/wheel scroll gesture on the page accomplishes.
    middle.scrollTop = middle.scrollHeight
    await raf()
    expect(middle.scrollTop, 'middle genuinely scrolled — a no-op here would mean the pre-fix overflow:visible regressed').toBeGreaterThan(0)

    const postScroll = visibleRect(canvas)
    // --ui-super-shell-canvas-min-block-size = 9 modules × 1.125rem = 162px at the default 16px root
    // font (SPEC-R15b) — the floor SPEC-R15a's scroll seam makes genuinely reachable.
    expect(postScroll.height, 'canvas\'s floor is now genuinely VISIBLE (not just present in the DOM) once scrolled').toBeGreaterThanOrEqual(160)

    const frameVisible = visibleRect(sandboxFrame)
    expect(frameVisible.height, 'the real, rendered ui-sandbox-frame itself — not just its container — reaches the eye').toBeGreaterThan(0)
  })
})
