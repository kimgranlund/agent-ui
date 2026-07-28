import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mountPage } from './_page.ts'

// _page-scheme.browser.test.ts — the standing regression gate for GH #317: the header's scheme choice must
// reach the DOCUMENT ROOT, not just the in-body shell provider.
//
// The defect it pins (measured on main @88bdc51, both engines): `buildThemedShell` writes the scheme onto a
// `<ui-theme-provider>` inside `#app` inside `<body>`, so every `light-dark()` ABOVE that element — `body`'s
// own `background`/`color` (`_page.css`, `base.css`), the canvas background body propagates to, the UA
// scrollbars — kept resolving at `:root`'s `color-scheme: light dark`, i.e. at the OS preference. With the
// harness's OS-light default and the toggle on Dark, `body` painted `--md-sys-color-neutral-125` (0.9345 L —
// the LIGHT arm) while the subtree one element down resolved `--md-sys-color-neutral-875` (0.2606 L). Every
// ladder token was well-formed; only the effective scheme above the provider was wrong.
//
// A REAL browser file, never jsdom: `light-dark()` resolution against a used `color-scheme` is an engine
// behaviour jsdom does not model at all (a jsdom probe passes vacuously). The assertions compare RESOLVED
// colors — never a DevTools-style strikethrough or the declared text (GH #317's own note: Chrome strikes the
// inactive `light-dark()` arm as normal display, so the declaration tells you nothing about the used value).

beforeEach(() => {
  document.body.innerHTML = '<div id="app"></div>'
  localStorage.clear()
})

afterEach(() => {
  document.documentElement.style.colorScheme = ''
  document.body.innerHTML = ''
  localStorage.clear()
})

/** The color a role RESOLVES to for `el`'s subtree — the direct-`var()`-probe idiom
 *  `theme-pack-apply.browser.test.ts` established, so these readings are comparable to that file's. */
function resolved(el: Element, role: string): string {
  const probe = document.createElement('div')
  probe.style.color = `var(${role})`
  el.append(probe)
  const color = getComputedStyle(probe).color
  probe.remove()
  return color
}

describe('GH #317 — the shell scheme reaches the document root, so body and app resolve in step', () => {
  it('forced dark: <html> carries the scheme, and body paints the SAME surface the app subtree resolves', () => {
    localStorage.setItem('agent-ui.scheme', 'dark')
    mountPage({ title: 'Probe' })
    const shell = document.querySelector('.app-shell')!

    expect(getComputedStyle(document.documentElement).colorScheme, 'the document root did not take the forced scheme').toBe('dark')
    expect(getComputedStyle(shell).colorScheme).toBe('dark')
    expect(
      getComputedStyle(document.body).backgroundColor,
      'body painted a different arm than the app subtree — the #317 light-in-dark ground',
    ).toBe(resolved(shell, '--md-sys-color-neutral-surface'))
  })

  it('forced dark resolves the DARK arm specifically (not merely a matching pair) — neutral-875, never neutral-125', () => {
    localStorage.setItem('agent-ui.scheme', 'dark')
    mountPage({ title: 'Probe' })
    // The dark arm of --md-sys-color-neutral-surface is --md-sys-color-neutral-875 (tokens.css). Compared as
    // a resolved color, so the assertion survives any future re-authoring of the ladder's literal values.
    const darkArm = resolved(document.documentElement, '--md-sys-color-neutral-875')
    const lightArm = resolved(document.documentElement, '--md-sys-color-neutral-125')
    expect(darkArm).not.toBe(lightArm) // guard: the two rungs must be distinguishable for this to mean anything
    expect(getComputedStyle(document.body).backgroundColor).toBe(darkArm)
  })

  it('forced light resolves the LIGHT arm at the root — the fix is a mirror, not a hard-coded dark', () => {
    localStorage.setItem('agent-ui.scheme', 'light')
    mountPage({ title: 'Probe' })
    expect(getComputedStyle(document.documentElement).colorScheme).toBe('light')
    expect(getComputedStyle(document.body).backgroundColor).toBe(resolved(document.documentElement, '--md-sys-color-neutral-125'))
  })

  it("Auto ('') leaves the root inline value CLEARED, so tokens.css's `:root { color-scheme: light dark }` tracks the OS again (ADR-0117)", () => {
    mountPage({ title: 'Probe' })
    expect(document.documentElement.style.colorScheme, 'Auto must clear the override, never pin a scheme').toBe('')
    expect(getComputedStyle(document.documentElement).colorScheme).toBe('light dark')
  })
})
