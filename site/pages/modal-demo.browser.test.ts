import { describe, it, expect } from 'vitest'
// Side-effect import: the demo page mounts the app shell + BOTH live ui-modal specimens into document.body
// (mountPage appends to `#app ?? document.body`; the adr-index.browser.test.ts precedent).
import './modal-demo.ts'

// modal-demo.browser.test.ts — the PAGE-LEVEL regression guard for the real bug Kim filed by screenshot
// (2026-07-07): both the "Dismissable modal" and "Blocking modal" demos rendered visibly OPEN and STACKED on
// top of each other on initial load, before any click. Root cause: container-box.css's unconditional
// `display: flow-root` on `:where([data-box])` is author-origin CSS and defeats the UA's own
// `dialog:not([open]) { display: none }` rule (author always outranks UA, at any specificity) — the same class
// of bug already fixed for `[popover]` panels, never patched for the `<dialog data-box>` part ui-modal added
// 2026-07-04. Fixed by container-box.css's `dialog[data-box]:not([open])` re-assertion (see the sibling
// `container-box.browser.test.ts` + `modal.browser.test.ts` legs for the control-level proof); THIS file proves
// the exact page-level symptom is gone. Runs in BOTH Chromium and WebKit (the `site` browser project).

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

const clickByText = (text: string): void => {
  const btn = [...document.querySelectorAll('ui-button')].find((b) => b.textContent?.trim() === text)
  if (!btn) throw new Error(`no ui-button found with text "${text}"`)
  ;(btn as HTMLElement).click()
}

describe('modal-demo — both ui-modal specimens start closed on load (the reported "stacked open" bug)', () => {
  it('neither dialog computes as rendered before any user interaction', async () => {
    await raf()
    const dialogs = [...document.querySelectorAll('ui-modal [data-part="dialog"]')] as HTMLDialogElement[]
    expect(dialogs.length, 'expected two ui-modal dialog parts on the demo page').toBe(2)
    for (const dialog of dialogs) {
      expect(dialog.open, 'a fresh demo dialog should not be .open').toBe(false)
      expect(getComputedStyle(dialog).display, 'a fresh demo dialog rendered instead of display:none').toBe('none')
      expect(dialog.getBoundingClientRect().width, 'a fresh demo dialog contributed a non-empty rendered box').toBe(0)
    }
  })

  it('clicking "Open dismissable modal" opens ONLY that modal, not the blocking one', async () => {
    await raf()
    clickByText('Open dismissable modal')
    await raf()
    const dialogs = [...document.querySelectorAll('ui-modal [data-part="dialog"]')] as HTMLDialogElement[]
    const openDialogs = dialogs.filter((d) => d.open)
    expect(openDialogs.length, 'exactly one dialog should be open after clicking one trigger').toBe(1)
    expect(openDialogs[0].textContent).toContain('Dismissable modal')
    ;(openDialogs[0].querySelector('ui-button') as HTMLElement)?.click() // close via the in-dialog Close button
    await raf()
  })

  it('clicking "Open blocking modal" opens ONLY that modal, not the dismissable one', async () => {
    await raf()
    clickByText('Open blocking modal')
    await raf()
    const dialogs = [...document.querySelectorAll('ui-modal [data-part="dialog"]')] as HTMLDialogElement[]
    const openDialogs = dialogs.filter((d) => d.open)
    expect(openDialogs.length, 'exactly one dialog should be open after clicking the other trigger').toBe(1)
    expect(openDialogs[0].textContent).toContain('Blocking modal')
  })
})
