import { describe, it, expect, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
// Side-effect import: the demo page mounts the app shell + the live ui-command-modal specimen into document.body
// (mountPage appends to `#app ?? document.body`; the adr-index.browser.test.ts precedent).
import './command-modal-demo.ts'

// GH #347 — REAL-TIMING HEADROOM. This file awaits real elapsed time (rAF frame settles),
// so its duration is set by the browser's scheduling, which stretches under concurrent host load.
// Class definition + why this is not a global raise: vitest.browser.config.ts, REAL-TIMING HEADROOM.
vi.setConfig({ testTimeout: 30_000 })

// command-modal-demo.browser.test.ts — the PAGE-LEVEL regression guard for GH #1555: the "opened palette"
// example (formerly `openedPalette`, a ui-command-modal built with the `open` attribute pre-set) used to mount a
// genuinely live `<dialog>` promoted via showModal() — correct `:modal` semantics, but a real top-layer modal
// correctly intercepts pointer events across the ENTIRE page, not just its own card. Reproduced directly with a
// real (hit-tested) `userEvent.click` on the page's OWN "Or click here to open it" trigger further down the
// SAME page: it used to time out because the first dialog's `::backdrop` was intercepting the click site-wide.
// Fixed by replacing the always-open live instance with a static, inert `.demo-modal-mock` (never a real
// `<dialog>`) — this file proves every other example section stays reachable/clickable without dismissing
// anything first, using a REAL hit-tested click (a DOM `.click()` call bypasses hit-testing entirely and would
// not have caught the original bug). Runs in BOTH Chromium and WebKit (the `site` browser project).

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

describe('command-modal-demo — GH #1555: the "opened palette" illustration must not block the rest of the page', () => {
  it('the opened-palette illustration is a static, inert mock — no real top-layer <dialog> renders pre-opened', async () => {
    await raf()
    const mocks = document.querySelectorAll('.demo-modal-mock')
    expect(mocks.length, 'expected the static opened-palette mock on the page').toBe(1)
    expect(mocks[0]?.getAttribute('aria-hidden'), 'the mock is decorative, not a real listbox').toBe('true')

    // Exactly ONE real ui-modal dialog part should exist on the whole page — the hotkey instance's own nested
    // modal — and it must start CLOSED (display:none, per the platform + container-box.css re-assertion), never
    // pre-opened, proving the always-open live instance is gone.
    const dialogs = [...document.querySelectorAll('ui-modal [data-part="dialog"]')] as HTMLDialogElement[]
    expect(dialogs.length, 'expected exactly one real ui-modal dialog part (the hotkey instance)').toBe(1)
    expect(dialogs[0]!.open, 'the one real dialog must start CLOSED, not always-open').toBe(false)
    expect(getComputedStyle(dialogs[0]!).display, 'a closed dialog should not compute as rendered').toBe('none')
  })

  it('a real hit-tested click reaches the hotkey trigger in a LATER section — nothing upstream blocks it', async () => {
    await raf()
    const trigger = [...document.querySelectorAll('ui-button')].find((b) => b.textContent?.trim() === 'Or click here to open it')
    if (!trigger) throw new Error('expected the hotkey trigger button on the page')

    await userEvent.click(trigger as HTMLElement) // real, hit-tested — would time out if any backdrop intercepted it

    await raf()
    const dialogs = [...document.querySelectorAll('ui-modal [data-part="dialog"]')] as HTMLDialogElement[]
    expect(dialogs.length).toBe(1)
    expect(dialogs[0]!.open, 'the hotkey palette should now be open — the real click reached it').toBe(true)
  })
})
