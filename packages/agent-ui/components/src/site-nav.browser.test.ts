import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { userEvent } from 'vitest/browser'

// site-nav.browser.test.ts — the CROSS-ENGINE smoke for the shared docs-site nav, now the mode-1 consumer of
// the shared `ui-nav-rail collapse="menu"` family (ADR-0130 / SPEC-R10). The rail is DERIVED from `sitemap.json`
// (site/pages/_page.ts `buildNav` → `SITE_NAV_ENTRIES`), grouped by the sitemap's `section`, each item a real
// `<a>` with a name and (for the tag-bearing Components) a trailing `data-role="tag"` (SPEC-R6's name|tag row).
// Below the shell's 40rem breakpoint the rail's OWN `collapse="menu"` disclosure collapses the list into a
// dropdown (a `<details>`/`<summary>` the component owns, no longer this page's markup). None of this is true in
// jsdom — no media/container query, no `<details>` open/closed content hiding, no computed `display`, no
// `::after` transform — so the collapse can only be proven in a real engine. Runs in BOTH Chromium and WebKit.
//
// VIEWPORT NOTE (why there is no resize leg): the @vitest/browser harness runs at a FIXED ~414px viewport — the
// NARROW side of the 40rem breakpoint — and CDP does NOT change the CSS viewport the cascade reads. So this suite
// proves the DROPDOWN side at its native viewport with REAL computed styles, and asserts the breakpoint under
// test IS the narrow one (`matchMedia` true) so the styles read are the collapsed branch — anti-vacuous. The
// container the rail's `collapse="menu"` measures is `.app-shell` (its own `container-type` is overridden to
// `normal` in _page.css so a ~15rem rail column does not always read as collapsed) — at 414px it is < 40rem, so
// the collapsed branch is live. The WIDE vertical rail branch is covered by the static CSS + the jsdom shape.
//
// `mountPage` performs the load-bearing foundation cascade (ADR-0003) on import, pulling the foundation roles +
// dimensional ramp, the self-defining controls, the ui-nav-rail family (+ nav-rail.css), and `_page.css`.
import { mountPage, SITE_NAV_ENTRIES } from '../../../../site/pages/_page.ts'

// The rail entry count is DERIVED from the SAME source the rail is built from — the deduped sitemap entries.
// buildNav renders ONE link-shaped `ui-nav-rail-item` (one `<a>`) per entry, so the rendered `<a>` count must
// equal this exactly — the bijection entry ↔ rendered-anchor, in a real engine, without a magic constant that
// re-drifts as the fleet grows. Anti-vacuous floor below guards an empty/failed import reading as 0.
const RAIL_ENTRIES = SITE_NAV_ENTRIES.length

// ── mount/cleanup ──────────────────────────────────────────────────────────────────────────────────────────
// Point the route at a known page so the active-item + trigger-label logic resolves deterministically, then
// stamp a fresh shell into a #app root. Torn down afterEach.
const ROUTE = '/a2ui-list.html' // a Guides entry → its own name is the selected item + trigger text ("A2UI Dynamic List")

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

const rail = (): HTMLElement => document.querySelector('ui-nav-rail[data-site-nav]') as HTMLElement
const disclosure = (): HTMLDetailsElement => rail().querySelector('[data-part="disclosure"]') as HTMLDetailsElement
const summary = (): HTMLElement => disclosure().querySelector('[data-part="trigger"]') as HTMLElement
const list = (): HTMLElement => disclosure().querySelector(':scope > [data-part="list"]') as HTMLElement
const anchors = (): HTMLAnchorElement[] => [...rail().querySelectorAll('a')]
const settle = (): Promise<void> => new Promise((r) => setTimeout(r, 250)) // outlast the chevron transition + flushes

// The rail builds its activators + disclosure through kernel effects (and a MutationObserver for role
// derivation), so the tree is not final synchronously after mount — poll until the expected anchors materialise.
async function ready(): Promise<void> {
  for (let i = 0; i < 50; i++) {
    if (rail() && anchors().length === RAIL_ENTRIES && disclosure()) return
    await new Promise((r) => requestAnimationFrame(() => r(undefined)))
  }
}

// The harness viewport is the narrow side of the breakpoint; assert that so the computed styles below are read
// from the COLLAPSED branch (a wide-viewport run would make the dropdown assertions vacuously pass). 40rem is
// nav-rail's collapse threshold AND the shell's single-column reflow (they were aligned in the migration).
const isNarrow = (): boolean => window.matchMedia('(max-width: 40rem)').matches

// ── structure (both engines) ───────────────────────────────────────────────────────────────────────────────

describe('site nav — ui-nav-rail structure (both engines)', () => {
  it('composes ui-nav-rail collapse="menu" fed from the sitemap; one <a> per entry; the trigger names the active page', async () => {
    await ready()
    expect(rail().tagName.toLowerCase()).toBe('ui-nav-rail')
    expect(rail().getAttribute('collapse')).toBe('menu')
    expect(disclosure().tagName.toLowerCase()).toBe('details')
    expect(summary().tagName.toLowerCase()).toBe('summary')
    expect(RAIL_ENTRIES, 'SITE_NAV_ENTRIES looks empty — the count below would be vacuous').toBeGreaterThanOrEqual(50)
    expect(anchors().length).toBe(RAIL_ENTRIES) // every sitemap entry survives as one rail <a> (no drop/dup)
    // the active item drives BOTH the collapsed trigger label AND aria-current (nav-rail's own role derivation)
    expect(summary().textContent).toContain('A2UI Dynamic List')
    const current = rail().querySelector('a[aria-current="page"]') as HTMLAnchorElement
    expect(current?.textContent).toContain('A2UI Dynamic List')
  })

  it('renders section context-labels and the wide name|tag row (proper name + trailing data-role="tag")', async () => {
    await ready()
    const labels = [...rail().querySelectorAll('[data-part="context-label"]')].map((n) => n.textContent)
    expect(labels).toContain('Components') // the sitemap's own section axis is the group taxonomy
    // a tag-bearing Components entry renders its tag in the trailing tag cell (the name|tag row, SPEC-R6)
    const tag = rail().querySelector('[data-role="tag"]') as HTMLElement
    expect(tag, 'no name|tag trailing cell rendered').not.toBeNull()
    expect(tag.textContent).toMatch(/^ui-[a-z-]+$/)
  })
})

// ── the collapsed dropdown, at the harness's native narrow viewport (both engines) ─────────────────────────────

describe('site nav — collapse="menu" dropdown below 40rem (both engines)', () => {
  it('the breakpoint under test is the NARROW one (the computed styles below are the collapsed branch)', () => {
    expect(isNarrow(), 'harness viewport is not below 40rem — dropdown assertions would be vacuous').toBe(true)
  })

  it('the rail is NOT its own query container (_page.css re-points collapse to the .app-shell container)', async () => {
    // The load-bearing shell coupling: the rail column is ~15rem, always below nav-rail's 40rem collapse
    // threshold, so if the rail self-measured it would show the dropdown at EVERY width (no desktop vertical
    // rail). _page.css overrides the rail's `container-type` to `normal` so its `collapse="menu"` @container
    // reads the .app-shell container (viewport-tracking) instead — the desktop rail shows wide, the dropdown
    // shows narrow. Assert the override won (else the wide vertical rail silently regresses to a dropdown).
    await ready()
    expect(getComputedStyle(rail()).containerType).toBe('normal')
  })

  it('the trigger is shown and the closed list is collapsed; opening drops the panel', async () => {
    await ready()
    const d = disclosure()
    d.open = false
    expect(getComputedStyle(summary()).display, 'trigger should be the dropdown button below the breakpoint').not.toBe('none')
    expect(getComputedStyle(list()).display, 'the closed list should be collapsed').toBe('none')
    d.open = true
    expect(getComputedStyle(list()).display, 'the open list should drop as the dropdown panel').not.toBe('none')
  })

  it('the chevron flips a half-turn when the disclosure opens (real ::after transform)', async () => {
    await ready()
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
    await ready()
    const d = disclosure()
    d.open = false
    await userEvent.click(summary())
    expect(d.open, 'clicking the trigger did not open the disclosure').toBe(true)
    await userEvent.click(summary())
    expect(d.open, 'clicking the trigger again did not close it').toBe(false)
  })
})
