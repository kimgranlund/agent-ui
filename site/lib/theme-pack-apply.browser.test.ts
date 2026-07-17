import { describe, it, expect, afterEach } from 'vitest'

// theme-pack-apply.browser.test.ts — TKT-0088's acceptance criterion "Browser-verified in both schemes ×
// >=2 themes (the tokens actually repaint — computed-style spot checks on a role each pack overrides)".
// A REAL `.browser.test.ts` (Chromium at minimum, no jsdom) — the SAME `theme-provider-build.browser.
// test.ts` idiom: inject the real built production CSS, mount real elements, read REAL getComputedStyle.
// Both the base fixture AND a theme pack's raw bytes are injected as plain `<style>` text (`?raw`
// imports — never bundled/auto-applied by Vite's own CSS pipeline, so this test controls exactly what's
// live), proving the WHOLE ADR-0141 chain end to end: a pack genuinely repaints a themed subtree, a
// pack-exempt role genuinely falls through to the default via ordinary CSS cascade (TKT-0087's Findings
// claim, checked here rather than assumed), and scheme still resolves correctly INSIDE a themed subtree
// (scheme × theme are orthogonal, per ADR-0141 cl.1).

import builtCss from './__fixtures__/theme-provider-built.css?raw'
import oceanCss from '../../packages/agent-ui/shared/src/tokens/themes/ocean.css?raw'
import emberCss from '../../packages/agent-ui/shared/src/tokens/themes/ember.css?raw'
import '@agent-ui/components/controls/theme-provider' // self-defining <ui-theme-provider> — behaviour only, no CSS side effect

const styleEl = document.createElement('style')
styleEl.textContent = `${builtCss}\n${oceanCss}\n${emberCss}`
document.head.append(styleEl)

const mounted: HTMLElement[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

function mount(el: HTMLElement): HTMLElement {
  document.body.append(el)
  mounted.push(el)
  return el
}

/** A themed provider whose one child reads `var(role)` directly via inline style — the SAME
 *  direct-`var()`-probe idiom `theme-provider-build.browser.test.ts` uses, so this file's readings are
 *  independently comparable to that file's own established pattern, not a bespoke new measurement shape. */
function probeIn(role: string, opts: { theme?: string; scheme?: string } = {}): string {
  const provider = document.createElement('ui-theme-provider')
  if (opts.theme !== undefined) provider.setAttribute('theme', opts.theme)
  if (opts.scheme !== undefined) provider.setAttribute('scheme', opts.scheme)
  const probe = document.createElement('div')
  probe.style.color = `var(${role})`
  provider.append(probe)
  mount(provider)
  return getComputedStyle(probe).color
}

describe('theme packs actually repaint a themed subtree (TKT-0088 acceptance)', () => {
  it('ocean genuinely differs from the default for --md-sys-color-primary (a rotated identity palette)', () => {
    const defaultColor = probeIn('--md-sys-color-primary', { scheme: 'light' })
    const oceanColor = probeIn('--md-sys-color-primary', { theme: 'ocean', scheme: 'light' })
    expect(oceanColor, 'ocean did not repaint --md-sys-color-primary — the pack never engaged').not.toBe(defaultColor)
  })

  it('ember ALSO genuinely differs from the default AND from ocean (two independently distinct themes)', () => {
    const defaultColor = probeIn('--md-sys-color-primary', { scheme: 'light' })
    const emberColor = probeIn('--md-sys-color-primary', { theme: 'ember', scheme: 'light' })
    const oceanColor = probeIn('--md-sys-color-primary', { theme: 'ocean', scheme: 'light' })
    expect(emberColor).not.toBe(defaultColor)
    expect(emberColor, 'ember and ocean painted IDENTICALLY — the two proof packs are not actually distinct').not.toBe(oceanColor)
  })

  it('status colors (danger) are DELIBERATELY untouched by a theme — the rotation only touched identity palettes', () => {
    const defaultColor = probeIn('--md-sys-color-danger', { scheme: 'light' })
    const oceanColor = probeIn('--md-sys-color-danger', { theme: 'ocean', scheme: 'light' })
    expect(oceanColor).toBe(defaultColor)
  })

  it('a bespoke EXEMPT role (--md-sys-color-focus-ring, absent from every pack) falls through to the default via ordinary CSS cascade — TKT-0087\'s claim, verified live', () => {
    const defaultColor = probeIn('--md-sys-color-focus-ring', { scheme: 'light' })
    const oceanColor = probeIn('--md-sys-color-focus-ring', { theme: 'ocean', scheme: 'light' })
    expect(oceanColor, 'the exempt role did not inherit from :root inside the themed subtree').toBe(defaultColor)
  })

  it('scheme still resolves correctly INSIDE a themed subtree — scheme x theme are orthogonal (ADR-0141 cl.1)', () => {
    const oceanLight = probeIn('--md-sys-color-primary-high', { theme: 'ocean', scheme: 'light' })
    const oceanDark = probeIn('--md-sys-color-primary-high', { theme: 'ocean', scheme: 'dark' })
    expect(oceanDark, 'light-dark() did not engage inside a themed provider').not.toBe(oceanLight)
  })

  it('an UN-themed sibling next to a themed provider is unaffected (subtree independence, ADR-0117\'s own proven claim, re-checked with a real pack now in play)', () => {
    const untouched = document.createElement('div')
    untouched.style.color = 'var(--md-sys-color-primary)'
    const scheme = document.createElement('ui-theme-provider')
    scheme.setAttribute('scheme', 'light')
    scheme.append(untouched)
    mount(scheme)
    const untouchedColor = getComputedStyle(untouched).color

    const themedColor = probeIn('--md-sys-color-primary', { theme: 'ocean', scheme: 'light' })
    expect(themedColor).not.toBe(untouchedColor)
  })
})
