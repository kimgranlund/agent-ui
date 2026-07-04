import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { userEvent } from 'vitest/browser'

// site-nav.browser.test.ts — the CROSS-ENGINE smoke for the shared docs-site nav's RESPONSIVE DROPDOWN
// (site/pages/_page.ts + _page.css). Below the shell's 48rem collapse breakpoint the nav rail becomes a zero-JS
// `<details>` disclosure (a `<summary>` trigger over the link `<ul>`); above it the same list is the vertical
// rail. None of this is true in jsdom — it evaluates no media query, no `<details>` open/closed content hiding,
// no computed `display`, no `::after` transform geometry — so the collapse can only be proven in a real engine.
// Runs in BOTH Chromium and WebKit (vitest.browser.config.ts → two playwright instances).
//
// VIEWPORT NOTE (why there is no resize leg): the @vitest/browser harness runs at a FIXED ~414px viewport — the
// NARROW side of the 48rem breakpoint — and CDP `Emulation.setDeviceMetricsOverride` does NOT change the CSS
// viewport `matchMedia`/the cascade read here (verified: `innerWidth` stays 414 after a 1200px override). So this
// suite proves the DROPDOWN side at its native viewport with REAL computed styles (the half the engine actually
// renders), and asserts the breakpoint is genuinely the narrow one (`matchMedia` true) so the styles read are the
// collapsed branch — anti-vacuous. The WIDE rail branch (summary hidden, list shown) is covered by the static
// CSS + the jsdom DOM-shape check; a true wide-vs-narrow flip needs the page-level viewport API a future site
// test harness would own (flagged in the handoff), not CDP.
//
// `mountPage` performs the load-bearing foundation cascade (ADR-0003) on import, pulling the foundation roles +
// dimensional ramp, the self-defining controls, and `_page.css` (the nav styling under test). The browser config
// resolves the `@agent-ui/*` CSS subpaths via package exports.
import { mountPage, NAV } from '../../../../site/pages/_page.ts'

// The rail entry count is DERIVED from NAV — buildNav's rule, mirrored: a labelled per-component group renders ONE
// rail `<a>` (the component name, its sub-pages live in the tab strip); an ungrouped site-level group renders one
// `<a>` per link. Asserting the rendered count equals this proves the bijection NAV-entry ↔ rendered-anchor holds
// in a real engine (no entry dropped/duplicated) WITHOUT a magic constant that re-drifts each time a component
// group is appended to NAV. Anti-vacuous floor below guards against an empty/failed NAV import reading as 0.
const RAIL_ENTRIES = NAV.reduce((n, group) => n + (group.label ? 1 : group.links.length), 0)

// ── mount/cleanup ──────────────────────────────────────────────────────────────────────────────────────────
// Point the route at a known page so the active-link + trigger-label logic resolves deterministically, then
// stamp a fresh shell into a #app root. Torn down afterEach.
const ROUTE = '/a2ui-list.html' // a site-level link → its own label is the trigger text ("A2UI Dynamic List")

let appRoot: HTMLElement
beforeEach(() => {
  history.replaceState(null, '', ROUTE)
  appRoot = document.createElement('div')
  appRoot.id = 'app'
  document.body.append(appRoot)
  mountPage({ title: 'nav smoke', intro: 'responsive dropdown probe' })
})
afterEach(async () => {
  await userEvent.unhover(document.body)
  appRoot.remove()
})

const nav = (): HTMLElement => document.querySelector('nav[data-site-nav]') as HTMLElement
const disclosure = (): HTMLDetailsElement => nav().querySelector('[data-site-nav-disclosure]') as HTMLDetailsElement
const summary = (): HTMLElement => disclosure().querySelector('summary.site-nav-trigger') as HTMLElement
const list = (): HTMLElement => disclosure().querySelector(':scope > ul') as HTMLElement
const triggerLabel = (): string => (summary().querySelector('.site-nav-trigger-label')?.textContent ?? '')
const settle = (): Promise<void> => new Promise((r) => setTimeout(r, 250)) // outlast the 120ms chevron transition

// The harness viewport is the narrow side of the breakpoint; assert that so the computed styles below are read
// from the COLLAPSED branch (a wide-viewport run would make the dropdown assertions vacuously pass).
const isNarrow = (): boolean => window.matchMedia('(max-width: 48rem)').matches

// ── structure (both engines) ───────────────────────────────────────────────────────────────────────────────

describe('site nav disclosure — structure (both engines)', () => {
  it('wraps the link list in a <details> disclosure whose trigger names the active page', () => {
    expect(disclosure().tagName.toLowerCase()).toBe('details')
    expect(summary().tagName.toLowerCase()).toBe('summary')
    expect(list().tagName.toLowerCase()).toBe('ul')
    expect(triggerLabel()).toBe('A2UI Dynamic List') // the collapsed-state active indication
    expect(RAIL_ENTRIES, 'NAV import looks empty — the count below would be vacuous').toBeGreaterThanOrEqual(10)
    expect(list().querySelectorAll('a').length).toBe(RAIL_ENTRIES) // every NAV entry survives as one rail <a> (no drop/dup)
    expect(list().querySelector('a[aria-current]')?.textContent).toBe('A2UI Dynamic List')
  })
})

// ── the collapsed dropdown, at the harness's native narrow viewport (both engines) ─────────────────────────────

describe('site nav disclosure — dropdown behaviour below 48rem (both engines)', () => {
  it('the breakpoint under test is the NARROW one (the computed styles below are the collapsed branch)', () => {
    expect(isNarrow(), 'harness viewport is not below 48rem — dropdown assertions would be vacuous').toBe(true)
  })

  it('the trigger is shown and the closed list is collapsed; opening drops the panel', () => {
    const d = disclosure()
    d.open = false
    expect(getComputedStyle(summary()).display, 'trigger should be the dropdown button below the breakpoint').not.toBe('none')
    expect(getComputedStyle(list()).display, 'the closed list should be collapsed').toBe('none')
    d.open = true
    expect(getComputedStyle(list()).display, 'the open list should drop as the dropdown panel').not.toBe('none')
  })

  it('the chevron flips a half-turn when the disclosure opens (real ::after transform)', async () => {
    const d = disclosure()
    d.open = false
    await settle()
    const closed = getComputedStyle(summary(), '::after').transform
    d.open = true
    await settle()
    const open = getComputedStyle(summary(), '::after').transform
    expect(closed, 'closed chevron should carry a rotation transform').not.toBe('none')
    expect(open, 'chevron transform did not change on [open]').not.toBe(closed)
  })

  it('clicking the <summary> toggles the disclosure (native keyboard/pointer, zero JS)', async () => {
    const d = disclosure()
    d.open = false
    await userEvent.click(summary())
    expect(d.open, 'clicking the trigger did not open the disclosure').toBe(true)
    await userEvent.click(summary())
    expect(d.open, 'clicking the trigger again did not close it').toBe(false)
  })
})
