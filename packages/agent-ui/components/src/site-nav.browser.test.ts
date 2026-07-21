import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { userEvent } from 'vitest/browser'

// site-nav.browser.test.ts — the CROSS-ENGINE smoke for the shared docs-site nav, a `ui-nav-rail` DERIVED
// from `sitemap.json` (site/pages/_page.ts `buildNav` → `SITE_NAV_ENTRIES`), grouped by the sitemap's
// `section`, each item a real `<a>` with a name and (for the tag-bearing Components) a trailing
// `data-role="tag"` (SPEC-R6's name|tag row). This file owns the rail's VERTICAL anatomy + the
// entry↔anchor bijection in a real engine.
//
// GH #170 / ADR-0155 — the narrow story RETIRED from the rail and moved to the SHELL: `ui-super-shell`
// (`collapse-band="compact"` + `narrow-start="collapse"`, _page.ts) hides the nav pane below the 52.5rem
// compact line and toggle-restores it as an overlay, so the rail's own `collapse="menu"` dropdown +
// `collapse-container="ancestor"` seam are GONE for this consumer. The narrow behavior (hidden pane,
// overlay open, X glyph, scrim/Escape dismiss, no-overflow) is proven by site/pages/_page-responsive.browser.test.ts
// (AC17); the rail's own `collapse="menu"` capability, unused here, keeps its coverage in nav-rail.browser.test.ts.
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
const ROUTE = '/a2ui-list.html' // a Guides entry → its own name is the selected item + aria-current ("A2UI Dynamic List")

let appRoot: HTMLElement
beforeEach(() => {
  history.replaceState(null, '', ROUTE)
  appRoot = document.createElement('div')
  appRoot.id = 'app'
  document.body.append(appRoot)
  mountPage({ title: 'nav smoke', intro: 'vertical rail probe' })
})
afterEach(async () => {
  await userEvent.unhover(document.body)
  appRoot.remove()
})

const rail = (): HTMLElement => document.querySelector('ui-nav-rail[data-site-nav]') as HTMLElement
const anchors = (): HTMLAnchorElement[] => [...rail().querySelectorAll('a')]

// The rail builds its activators through kernel effects (and a MutationObserver for role derivation), so the
// tree is not final synchronously after mount — poll until the expected anchors materialise.
async function ready(): Promise<void> {
  for (let i = 0; i < 50; i++) {
    if (rail() && anchors().length === RAIL_ENTRIES) return
    await new Promise((r) => requestAnimationFrame(() => r(undefined)))
  }
}

// ── structure (both engines) ───────────────────────────────────────────────────────────────────────────────

describe('site nav — ui-nav-rail structure (both engines)', () => {
  it('composes a ui-nav-rail fed from the sitemap; one <a> per entry; the active page carries aria-current', async () => {
    await ready()
    expect(rail().tagName.toLowerCase()).toBe('ui-nav-rail')
    // GH #170/ADR-0155 — collapse="none": the rail renders its plain vertical anatomy at every band; the
    // SHELL owns the narrow hide/overlay (AC17). The old `collapse="menu"` dropdown + `collapse-container`
    // ancestor seam retired for this consumer.
    expect(rail().getAttribute('collapse'), 'the site rail opts into the never-collapse mode').toBe('none')
    expect(rail().hasAttribute('collapse-container'), 'the ancestor-container seam retired with the dropdown').toBe(false)
    expect(rail().querySelector('[data-part="disclosure"]'), 'no <details> dropdown here anymore').toBeNull()
    expect(RAIL_ENTRIES, 'SITE_NAV_ENTRIES looks empty — the count below would be vacuous').toBeGreaterThanOrEqual(50)
    expect(anchors().length).toBe(RAIL_ENTRIES) // every sitemap entry survives as one rail <a> (no drop/dup)
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
