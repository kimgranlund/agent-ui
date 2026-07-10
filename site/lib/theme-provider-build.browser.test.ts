import { describe, it, expect, afterEach } from 'vitest'

// theme-provider-build.browser.test.ts — the BROWSER-side half of the LLD-C11 built-output `light-dark()`
// regression guard (SPEC-R11, ADR-0117 Consequences; the TKT-0002 regression class). A REAL
// `.browser.test.ts` (the test:browser project, Chromium at minimum) — it executes IN the browser and
// imports the fixture as a plain asset via Vite's `?raw` (the app-shell.ts `ISOLATION_GRID_CSS` precedent,
// proven live by app-shell-isolation.browser.test.ts; jsdom's empty resolution of the same query is a
// documented, unrelated caveat that does not apply here). NO node: module import anywhere in this file —
// the build step lives entirely in theme-provider-build-fixture.test.ts (the node-context freshness gate);
// this file only PROVES resolution against the REAL production bytes that OTHER test independently keeps fresh.
import builtCss from './__fixtures__/theme-provider-built.css?raw'
import '@agent-ui/components/controls/theme-provider' // self-defining <ui-theme-provider> (ADR-0117) — behaviour only, no CSS side effect
import '@agent-ui/components/controls/button' // self-defining <ui-button> — behaviour only, no CSS side effect

// Inject the PRODUCTION CSS bytes into this page's own document ONCE at module load — every mount below
// resolves against these real, minified, `vite build`-emitted rules (not dev-mode source).
const styleEl = document.createElement('style')
styleEl.textContent = builtCss
document.head.append(styleEl)

const mounted: HTMLElement[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

/** A bare probe reading `--md-sys-color-primary-high` directly, with its OWN EXPLICIT (non-provider-mediated)
 *  `color-scheme` — an INDEPENDENT resolution path for "what should this token resolve to under this
 *  scheme", so the real control's reading below is checked against a genuinely separate computation, not a
 *  hardcoded/duplicated colour literal that could silently drift from the palette. */
function independentExpected(scheme: 'light' | 'dark'): string {
  const probe = document.createElement('div')
  probe.style.colorScheme = scheme
  probe.style.color = 'var(--md-sys-color-primary-high)'
  document.body.append(probe)
  mounted.push(probe)
  return getComputedStyle(probe).color
}

describe('ui-theme-provider built-output — a REAL ui-button under a built ui-theme-provider resolves the correct per-scheme token (LLD-C11 browser-side proof)', () => {
  it('scheme="dark" and scheme="light" providers give a real ui-button[variant=soft] GENUINELY DIFFERENT, and CORRECT, ink', () => {
    // variant=soft/ghost is the vehicle (not solid): --ui-button-ink resolves --md-sys-color-primary-high,
    // whose light/dark branches map to DIFFERENT palette steps (primary-650 vs primary-400) — a genuine,
    // real per-scheme divergence. (--md-sys-color-primary itself — the SOLID variant's bg/ink — is a
    // DELIBERATELY scheme-invariant brand accent in this token set, so it cannot prove per-scheme
    // resolution; this is a named, deliberate LLD-C11 vehicle correction, not the LLD's literal
    // solid/background-color wording — see the build report for the full rationale.)
    const dark = document.createElement('ui-theme-provider')
    dark.setAttribute('scheme', 'dark')
    const darkButton = document.createElement('ui-button')
    darkButton.setAttribute('variant', 'soft')
    darkButton.textContent = 'Dark'
    dark.append(darkButton)

    const light = document.createElement('ui-theme-provider')
    light.setAttribute('scheme', 'light')
    const lightButton = document.createElement('ui-button')
    lightButton.setAttribute('variant', 'soft')
    lightButton.textContent = 'Light'
    light.append(lightButton)

    const wrap = document.createElement('div')
    wrap.append(dark, light)
    document.body.append(wrap)
    mounted.push(wrap)

    const darkInk = getComputedStyle(darkButton).color
    const lightInk = getComputedStyle(lightButton).color
    expect(darkInk, 'dark and light providers resolved the SAME ink — light-dark() did not engage against the production bytes').not.toBe(lightInk)

    // Not just "differs from the other" (a degenerate both-unstyled false-pass) — each matches its
    // INDEPENDENTLY computed expected value for that scheme.
    expect(darkInk, 'the dark-scheme button ink did not match the independently-resolved dark expectation').toBe(independentExpected('dark'))
    expect(lightInk, 'the light-scheme button ink did not match the independently-resolved light expectation').toBe(independentExpected('light'))
  })
})
