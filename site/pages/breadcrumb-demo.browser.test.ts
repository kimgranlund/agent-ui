import { describe, it, expect, vi } from 'vitest'
// Side-effect import: the demo page mounts the app shell + all four live ui-breadcrumb specimens into
// document.body (mountPage appends to `#app ?? document.body` — the modal-demo.browser.test.ts precedent).
import './breadcrumb-demo.ts'
import type { UIBreadcrumbElement } from '@agent-ui/components/components'

// GH #347 — REAL-TIMING HEADROOM. See vitest.browser.config.ts's own comment; a raf-settling test's duration
// is set by the browser's own scheduling, which stretches under concurrent host load.
vi.setConfig({ testTimeout: 30_000 })

// breadcrumb-demo.browser.test.ts — the PAGE-LEVEL proof that the demo's OWN collapse="menu" habitat + its
// delegated click-interceptor really drive GH #1515 S2's commit-relay on a REAL rendered element (the
// control's own pixel-truth audit — every state combination, forced-colors, keyboard — lives in
// breadcrumb.browser.test.ts; this file proves the DEMO page's wiring): a real click on the overflow
// trigger opens the composed menu, a real click on a folded proxy row relays activation to the REAL hidden
// crumb (never the trigger's own row), and the demo's event log — never a ui-breadcrumb event, the control
// emits none of its own — records the intercepted navigation instead of leaving the page (the service-
// card-demo.browser.test.ts toggle-scenario precedent, applied to the fold-and-relay mechanism instead).

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id)
  if (!el) throw new Error(`no element found with id "${id}"`)
  return el as T
}

function logLines(): string[] {
  return [...document.querySelectorAll('.event-log li')].map((li) => li.textContent ?? '')
}

/** Parse the `detail={...}` JSON suffix off one recorded log line (the breadcrumb-demo.ts `record()` shape). */
function detailOf(line: string): { href: string; label: string } {
  const json = line.slice(line.indexOf('detail=') + 'detail='.length)
  return JSON.parse(json) as { href: string; label: string }
}

describe('breadcrumb-demo — the collapse="menu" habitat folds a real deep trail on load', () => {
  it('pins Home + the last two crumbs; folds the three in between behind a real overflow trigger', async () => {
    const crumb = byId<UIBreadcrumbElement>('breadcrumb-collapse-demo')
    await crumb.updateComplete

    // `[data-collapsed]` also lands on the separator BETWEEN two folded crumbs (breadcrumb.ts's own
    // #applyCollapse) — exclude control furniture (`[data-part]`) so only real crumbs are counted.
    const folded = [...crumb.querySelectorAll('[data-collapsed]')].filter((n) => !n.hasAttribute('data-part'))
    expect(folded.map((n) => n.textContent)).toEqual(['Section A', 'Subsection B', 'Subsection C'])

    const trigger = crumb.querySelector('[data-part="overflow"] [data-part="trigger"]') as HTMLElement
    expect(trigger, 'the composed overflow trigger must exist on this demo specimen').not.toBeNull()
    expect(trigger.getBoundingClientRect().width, 'the trigger must paint a real, non-zero box').toBeGreaterThan(0)
  })
})

describe('breadcrumb-demo — a real click sequence relays activation through the composed overflow menu', () => {
  it('clicking the trigger opens the menu with exactly the three folded crumbs as proxy rows', async () => {
    const crumb = byId<UIBreadcrumbElement>('breadcrumb-collapse-demo')
    await crumb.updateComplete
    const trigger = crumb.querySelector('[data-part="overflow"] [data-part="trigger"]') as HTMLElement

    trigger.click()
    await crumb.updateComplete

    expect(trigger.getAttribute('aria-expanded'), 'a real click on the trigger should open the menu').toBe('true')
    const proxies = [...crumb.querySelectorAll('[data-part="overflow"] [role="menuitem"]')] as HTMLElement[]
    expect(proxies.map((p) => p.textContent)).toEqual(['Section A', 'Subsection B', 'Subsection C'])
  })

  it('clicking the SECOND proxy row relays a real click to the REAL "Subsection B" crumb, logged by the demo', async () => {
    const crumb = byId<UIBreadcrumbElement>('breadcrumb-collapse-demo')
    await crumb.updateComplete
    const before = logLines().length

    const proxies = [...crumb.querySelectorAll('[data-part="overflow"] [role="menuitem"]')] as HTMLElement[]
    expect(proxies.map((p) => p.textContent)).toEqual(['Section A', 'Subsection B', 'Subsection C'])

    proxies[1].click() // "Subsection B" — the second folded crumb, never the first
    await crumb.updateComplete

    // The relay dispatched a real click on the hidden `<a href="/a/b">` anchor, which bubbled to the page-level
    // interceptor (breadcrumb-demo.ts) and was logged instead of navigating this test document away.
    expect(logLines().length, 'the relay must produce exactly one new log line').toBe(before + 1)
    const last = logLines().at(-1) ?? ''
    expect(last).toContain('navigate')
    const detail = detailOf(last)
    expect(detail.href, 'the relay must target the SECOND folded crumb, not the first or a pinned one').toBe('/a/b')
    expect(detail.label).toBe('Subsection B')

    // The menu closed on commit — the control's own contract, proven at the control level; the demo just
    // rides it.
    const trigger = crumb.querySelector('[data-part="overflow"] [data-part="trigger"]') as HTMLElement
    expect(trigger.getAttribute('aria-expanded'), 'commit should close the menu').toBe('false')
  })
})

describe('breadcrumb-demo — a direct click on a pinned, visible crumb is also intercepted and logged', () => {
  it('clicking the real "Home" anchor never navigates the test document, and logs the click', async () => {
    const crumb = byId<UIBreadcrumbElement>('breadcrumb-collapse-demo')
    await crumb.updateComplete
    const before = logLines().length

    const home = crumb.querySelector('a[href="/"]') as HTMLAnchorElement
    expect(home.hasAttribute('data-collapsed'), 'Home must stay pinned, never folded').toBe(false)

    home.click()
    await crumb.updateComplete

    expect(logLines().length, 'a direct click on a visible crumb must also log exactly one line').toBe(before + 1)
    expect(detailOf(logLines().at(-1) ?? '').href).toBe('/')
    // The negative control: if the interceptor were broken, this real anchor click would have navigated
    // the test document away from the demo page — the DOM subtree above would no longer exist to query.
    expect(document.getElementById('breadcrumb-collapse-demo'), 'the demo page must still be mounted').not.toBeNull()
  })
})

describe('breadcrumb-demo — the inline/fill states pair renders both sizing postures', () => {
  it('the fill specimen is block-level and the inline specimen is not', async () => {
    const crumbs = [...document.querySelectorAll('ui-breadcrumb')] as UIBreadcrumbElement[]
    const fill = crumbs.find((c) => c.textContent?.includes('Fill (default)'))
    const inline = crumbs.find((c) => c.textContent?.includes('Inline (hug)'))
    expect(fill, 'expected a fill-posture specimen on the demo page').toBeDefined()
    expect(inline, 'expected an inline-posture specimen on the demo page').toBeDefined()
    expect(inline?.hasAttribute('inline')).toBe(true)
    expect(fill?.hasAttribute('inline')).toBe(false)
  })
})
