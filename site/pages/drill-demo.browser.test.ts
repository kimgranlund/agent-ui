import { describe, it, expect, vi, beforeAll } from 'vitest'
import { page } from 'vitest/browser'
// Side-effect import: the demo page mounts the app shell + all three live ui-drill specimens into
// document.body (mountPage appends to `#app ?? document.body` — the breadcrumb-demo.browser.test.ts /
// modal-demo.browser.test.ts precedent).
import './drill-demo.ts'

// GH #347 — REAL-TIMING HEADROOM. See vitest.browser.config.ts's own comment; a raf/ResizeObserver-settling
// test's duration is set by the browser's own scheduling, which stretches under concurrent host load.
vi.setConfig({ testTimeout: 30_000 })

// ADR-0150: the fleet's default test viewport (414×896) sits BELOW the 52.5rem/840px compact-body line, so
// the columns specimen would resolve to `stack` at load under the fleet default regardless of this page's own
// `.reflow-frame` — the text.browser.test.ts DESKTOP-pin precedent, applied here so the columns habitat's
// wide-by-default claim is real, not incidental. 1280px comfortably clears 840px even after the app shell's
// own nav-rail chrome eats into `[data-page-content]`'s share of the viewport.
beforeAll(async () => {
  await page.viewport(1280, 900)
})

// drill-demo.browser.test.ts — the PAGE-LEVEL proof that the demo's OWN three habitats (ADR-0195 Amendment,
// GH #1510, S1-S3) really drive the real, shipped presentations on a REAL rendered element (the control's own
// pixel-truth audit — every state combination, forced-colors, keyboard — lives in drill.browser.test.ts; this
// file proves the DEMO page's wiring): the crumbs specimen loads already 2 levels deep with a clickable
// trail, the columns specimen loads 2 columns wide and fully interactive, and dragging the page's own
// `.reflow-frame` narrow really flips the live specimen's resolved layout back to stack via the REAL
// `@container` query (never a mocked/synthetic resize) — the demo's whole point, not merely decoration.

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id)
  if (!el) throw new Error(`no element found with id "${id}"`)
  return el as T
}

async function settle(): Promise<void> {
  await new Promise((r) => requestAnimationFrame(() => r(undefined)))
  await new Promise((r) => setTimeout(r, 50))
  await new Promise((r) => requestAnimationFrame(() => r(undefined)))
}

function logLines(): string[] {
  return [...document.querySelectorAll('.event-log li')].map((li) => li.textContent ?? '')
}

describe('drill-demo — the crumbs specimen loads already 2 levels deep, trail clickable', () => {
  it('the trail holds two real ancestor crumb buttons + the non-interactive heading as the last entry', async () => {
    const drill = byId('drill-crumbs-demo')
    const nav = drill.querySelector('[data-part="crumbs"]') as HTMLElement
    expect(nav.hidden, 'the crumbs nav must be visible under chrome="crumbs"').toBe(false)
    const crumbs = [...nav.querySelectorAll('[data-part="crumb"]')] as HTMLButtonElement[]
    expect(crumbs.map((c) => c.textContent)).toEqual(['Library', 'Fiction'])
    const heading = nav.querySelector('[data-part="heading"]') as HTMLElement
    expect(heading.textContent).toBe('Mystery')
    expect(heading.getAttribute('aria-current')).toBe('location')
  })

  it('clicking the "Library" crumb truncates the path back to the root, logged by the demo', async () => {
    const drill = byId('drill-crumbs-demo')
    const before = logLines().length
    const libraryCrumb = [...drill.querySelectorAll('[data-part="crumb"]')]
      .find((c) => c.textContent === 'Library') as HTMLButtonElement
    libraryCrumb.click()
    await settle()

    const active = drill.querySelector('[data-drill-pane="active"]') as HTMLElement
    expect(active.getAttribute('key')).toBe('library')
    expect(logLines().length, 'the crumb click must produce exactly one new log line').toBe(before + 1)
    expect(logLines().at(-1)).toContain('crumbs')
  })
})

describe('drill-demo — the columns specimen loads 2 columns wide, fully interactive', () => {
  it('both the "Categories" and "Electronics" columns are painted, side by side, neither dimmed nor inert', () => {
    const drill = byId('drill-columns-demo')
    expect(drill.getAttribute('data-drill-layout'), 'the frame must be wide enough for columns at load').toBe('columns')
    const categories = drill.querySelector('[key="categories"]') as HTMLElement & { inert: boolean }
    const electronics = drill.querySelector('[key="electronics"]') as HTMLElement
    expect(getComputedStyle(categories).display).not.toBe('none')
    expect(getComputedStyle(electronics).display).not.toBe('none')
    expect(categories.inert, 'columns never marks a painted ancestor inert').toBe(false)
    const categoriesRect = categories.getBoundingClientRect()
    const electronicsRect = electronics.getBoundingClientRect()
    expect(electronicsRect.left).toBeGreaterThanOrEqual(categoriesRect.right) // side by side, not overlapping
  })

  it('clicking "Laptops" inside the Electronics column drills a 3rd column in, logged by the demo', async () => {
    const drill = byId('drill-columns-demo')
    const before = logLines().length
    const laptopsTrigger = drill.querySelector('[key="electronics"] [data-drill-key="laptops"]') as HTMLElement
    laptopsTrigger.click()
    await settle()

    const laptops = drill.querySelector('[key="laptops"]') as HTMLElement
    expect(laptops.getAttribute('data-drill-pane')).toBe('active')
    expect(logLines().length).toBe(before + 1)
    expect(logLines().at(-1)).toContain('columns')
  })
})

describe('drill-demo — the columns specimen\'s own resizable frame really auto-degrades to stack (ADR-0195 Amendment cl.A8)', () => {
  it('shrinking the .reflow-frame below the 52.5rem/840px line flips data-drill-layout to "stack" live, no mock', async () => {
    const drill = byId('drill-columns-demo')
    const frame = drill.closest('.reflow-frame') as HTMLElement
    expect(drill.getAttribute('data-drill-layout')).toBe('columns') // the wide starting point

    frame.style.inlineSize = '600px' // a REAL resize of the drill's own ancestor box, below the compact-body line
    await settle()

    expect(drill.getAttribute('data-drill-layout'), 'a real narrow resize must degrade columns to stack').toBe('stack')

    frame.style.inlineSize = '' // restore — other tests in this file assume the wide default
    await settle()
    expect(drill.getAttribute('data-drill-layout')).toBe('columns')
  })
})

describe('drill-demo — the stack specimen (default) still drills forward, logged by the demo', () => {
  it('a real click on "Appearance" paints the active pane and logs the change', async () => {
    const drill = document.querySelector('[aria-label="Settings (stack, controlled demo)"]') as HTMLElement
    const before = logLines().length
    // `[data-drill-key]` alone uniquely identifies the trigger here (only drill-trigger elements carry it) —
    // the site-canon dead-name guard scans literal `data-role="X"` substrings fleet-wide against the CSS-styled
    // ROLE vocab; `drill-trigger` is an AUTHOR-side convention drill.css never styles (arbitrary author
    // content, not a component-owned part), so it is intentionally absent from that vocab and would false-flag.
    const appearanceTrigger = drill.querySelector('[data-drill-key="appearance"]') as HTMLElement
    appearanceTrigger.click()
    await settle()

    const active = drill.querySelector('[data-drill-pane="active"]') as HTMLElement
    expect(active.getAttribute('key')).toBe('appearance')
    expect(logLines().length).toBe(before + 1)
    expect(logLines().at(-1)).toContain('stack')
  })
})
