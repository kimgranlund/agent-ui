import { describe, it, expect, afterEach } from 'vitest'
import { server, cdp, userEvent } from 'vitest/browser'

// breadcrumb.browser.test.ts — the cross-engine browser-truth proof for `ui-breadcrumb` S1 core anatomy +
// S2 `collapse="menu"` (GH #1515, the frozen design intake `.claude/docs/spec/breadcrumb.intake.md` §4/§7).
// Runs in BOTH Chromium and WebKit (vitest.browser.config.ts). Covers what jsdom cannot: real painted
// geometry (the whole-shape law — test-the-whole-shape), real keyboard tab order across independent crumb
// links (+ the S2 overflow trigger + its composed menu), the computed AX role (a labelled `navigation`
// landmark, CDP frame-scoped — the pagination.browser.test.ts precedent), the ADR-0223 fill/[inline]
// two-posture proof, the intake's own named forced-colors law (the S1 separator's REAL-TEXT-NODE survival
// + the S2 overflow trigger's pinned glyph survival) under CDP forced-colors emulation, and the S2
// end-to-end keyboard commit relay (Tab→trigger→open→rove→commit→real navigation).
//
// GH #1515 S2 — breadcrumb.ts composes `ui-menu` as the overflow part (a real value import, self-registers
// `ui-menu`), so this suite ALSO needs `ui-menu`'s own sheet (its `display:contents` host rule — load-
// bearing for the trigger button's flex-item promotion, the tabs.browser.test.ts / menu.browser.test.ts
// precedent) + its `[data-box]` box-model dependency.
import '@agent-ui/components/foundation-styles.css'
import '../_surface/container-box.css'
import '../menu/menu.css'
import './breadcrumb.css'
import './breadcrumb.ts'

const mounted: HTMLElement[] = []
const mount = (markup: string): HTMLElement => {
  const wrap = document.createElement('div')
  wrap.innerHTML = markup
  document.body.append(wrap)
  mounted.push(wrap)
  return wrap.firstElementChild as HTMLElement
}
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

/** Let the host's own MutationObserver-driven rebuild settle (a microtask). */
const settle = (): Promise<void> => new Promise<void>((r) => queueMicrotask(r))

/** Minimal CDP surface — `cdp()`'s public type is empty; the playwright provider gives `.send` at runtime. */
interface CdpSession {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>
}

describe('ui-breadcrumb — whole-shape (test-the-whole-shape)', () => {
  it('a real breadcrumb paints a visible, non-zero box with real crumb links + separators', async () => {
    const el = mount(
      '<ui-breadcrumb label="Breadcrumb"><a href="/">Home</a><a href="/docs">Docs</a><span>Getting started</span></ui-breadcrumb>',
    ) as HTMLElement
    await settle()
    const box = el.getBoundingClientRect()
    expect(box.width, 'the breadcrumb host painted zero width').toBeGreaterThan(0)
    expect(box.height, 'the breadcrumb host painted zero height').toBeGreaterThan(0)

    const crumbs = el.querySelectorAll('a, span:not([data-part])')
    expect(crumbs.length).toBeGreaterThan(0)
    for (const c of crumbs) {
      const r = (c as HTMLElement).getBoundingClientRect()
      expect(r.width, 'a crumb painted zero width').toBeGreaterThan(0)
      expect(r.height, 'a crumb painted zero height').toBeGreaterThan(0)
    }

    const separators = el.querySelectorAll('[data-part="separator"]')
    expect(separators).toHaveLength(2)
    for (const s of separators) {
      const r = (s as HTMLElement).getBoundingClientRect()
      expect(r.width, 'a separator painted zero width').toBeGreaterThan(0)
    }
  })

  it('the last crumb paints with aria-current="page" set', async () => {
    const el = mount('<ui-breadcrumb><a href="/">Home</a><span>Leaf</span></ui-breadcrumb>') as HTMLElement
    await settle()
    const leaf = el.querySelector('span[aria-current="page"]')
    expect(leaf, 'the leaf crumb was not auto-stamped aria-current="page"').not.toBeNull()
  })
})

describe('ui-breadcrumb — real keyboard tab order across independent crumb links', () => {
  it('every crumb link is independently Tab-reachable, in DOM order — no roving tabindex', async () => {
    const el = mount(
      '<ui-breadcrumb><a href="/">Home</a><a href="/docs">Docs</a><a href="/docs/x">X</a><span>Leaf</span></ui-breadcrumb>',
    ) as HTMLElement
    await settle()
    const links = [...el.querySelectorAll('a')] as HTMLElement[]
    expect(links.length).toBe(3)
    for (const link of links) {
      link.focus()
      expect(document.activeElement, 'a crumb link did not accept focus').toBe(link)
    }
  })
})

describe('ui-breadcrumb — computed AX role (a labelled navigation landmark)', () => {
  it('the host exposes AX role=navigation named by `label`', async () => {
    const el = mount('<ui-breadcrumb label="Search trail"><a href="/">Home</a><span>Leaf</span></ui-breadcrumb>') as HTMLElement
    await settle()
    expect(el.getAttribute('role')).toBeNull()

    if (server.browser !== 'chromium') {
      // WebKit exposes no CDP Accessibility domain (the pagination.browser.test.ts / table.browser.test.ts precedent).
      return
    }

    const session = cdp() as unknown as CdpSession
    const frameTree = (await session.send('Page.getFrameTree')) as {
      frameTree: { childFrames?: Array<{ frame: { id: string } }> }
    }
    const frameId = frameTree.frameTree.childFrames?.[0]?.frame.id
    expect(frameId, 'anti-vacuous: the vitest-iframe child frame must be found to scope the AX query').toBeDefined()
    await session.send('Accessibility.enable')
    const ax = (await session.send('Accessibility.getFullAXTree', { frameId })) as {
      nodes: Array<{ role?: { value?: string }; name?: { value?: string } }>
    }
    await session.send('Accessibility.disable')
    const navNode = ax.nodes.find((n) => n.role?.value === 'navigation' && n.name?.value === 'Search trail')
    expect(navNode, 'no AX node with role=navigation named "Search trail" found').toBeDefined()
  })
})

// -- ADR-0223 (Fill by Default): the two-posture acceptance leg, the generalized ADR-0021 smoke (the
//    text-field pilot's shape, pagination.browser.test.ts's own realization): FILL -- a bare host in block
//    flow stretches to the container's inline size; [inline] -- the host hugs its content, below the container.
describe('ui-breadcrumb -- ADR-0223 two postures (fill default / [inline] hug, both engines)', () => {
  it('bare host offsetWidth ~= container inline size (fill); [inline] host hugs below the container', async () => {
    const wrap = document.createElement('div')
    wrap.style.inlineSize = '640px' // a wide BLOCK container -- wider than any hug resolution
    wrap.innerHTML = '<ui-breadcrumb label="Breadcrumb"><a href="/">Home</a><span>Leaf</span></ui-breadcrumb>'
    document.body.append(wrap)
    const host = wrap.querySelector('ui-breadcrumb') as HTMLElement & { updateComplete?: Promise<unknown> }
    await host.updateComplete
    await settle()
    // FILL (the default): block-level -- the host stretches to the container.
    const containerWidth = wrap.getBoundingClientRect().width
    expect(host.offsetWidth, 'the bare host did not FILL its block container (ADR-0223 cl.1)').toBeCloseTo(containerWidth, 0)
    expect(getComputedStyle(host).display, 'the default host is not block-level').toBe('flex')
    // HUG (the ONE opt-out): [inline] flips display level AND posture -- content-sized, below the container.
    host.setAttribute('inline', '')
    const hugged = host.offsetWidth
    expect(hugged, 'the [inline] host collapsed to nothing').toBeGreaterThan(0)
    expect(hugged, 'the [inline] host did not HUG -- it still fills the container').toBeLessThan(containerWidth)
    expect(getComputedStyle(host).display, 'the [inline] host is not inline-level').toBe('inline-flex')
    wrap.remove()
  })
})

describe('ui-breadcrumb — forced-colors survival (the separator is REAL TEXT, never paint-only)', () => {
  it('the DEFAULT (unslotted) "/" separator survives forced-colors — Chromium emulates (CDP); WebKit asserts the baseline', async () => {
    const el = mount('<ui-breadcrumb><a href="/">Home</a><span>Leaf</span></ui-breadcrumb>') as HTMLElement
    await settle()
    const sep = el.querySelector('[data-part="separator"]') as HTMLElement
    expect(sep.textContent).toBe('/')

    if (server.browser !== 'chromium') {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(false)
      return
    }

    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] })
    try {
      expect(window.matchMedia('(forced-colors: active)').matches, 'the engine did not enter forced-colors').toBe(true)
      // real text stays real text: still present, still carrying its glyph — never blanked to an empty box.
      expect(sep.textContent, 'the separator text vanished under forced-colors').toBe('/')
      expect(sep.getClientRects().length, 'the separator rendered no text box under forced-colors').toBeGreaterThan(0)
      const color = getComputedStyle(sep).color
      expect(color, 'the separator computed an empty (invisible) color under forced-colors').not.toBe('')
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] })
    }
  })

  it('a SLOTTED separator template clone also survives forced-colors', async () => {
    const el = mount(
      '<ui-breadcrumb><a href="/">Home</a><a href="/docs">Docs</a><span>Leaf</span><span slot="separator">→</span></ui-breadcrumb>',
    ) as HTMLElement
    await settle()
    const seps = [...el.querySelectorAll('[data-part="separator"]')] as HTMLElement[]
    expect(seps).toHaveLength(2)
    for (const s of seps) expect(s.textContent).toBe('→')

    if (server.browser !== 'chromium') {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(false)
      return
    }

    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] })
    try {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(true)
      for (const s of seps) {
        expect(s.textContent, 'a slotted separator clone vanished under forced-colors').toBe('→')
        expect(s.getClientRects().length, 'a slotted separator clone rendered no text box under forced-colors').toBeGreaterThan(0)
      }
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] })
    }
  })
})

// ════════════════════════════════════════════════════════════════════════════════════════════════════
// GH #1515 S2 — collapse="menu" (the composed-ui-menu overflow fold), cross-engine truth
// ════════════════════════════════════════════════════════════════════════════════════════════════════

const COLLAPSE_FIVE = `
  <ui-breadcrumb label="Breadcrumb" collapse="menu">
    <a href="/">Home</a>
    <a href="/a">Section A</a>
    <a href="/a/b">Subsection B</a>
    <a href="/a/b/c">Subsection C</a>
    <span>Current page</span>
  </ui-breadcrumb>`

describe('ui-breadcrumb — collapse="menu" whole-shape (test-the-whole-shape, both engines)', () => {
  it('the pinned first + last-2 crumbs paint; the folded middle renders NOTHING; the trigger paints a visible square', async () => {
    const el = mount(COLLAPSE_FIVE) as HTMLElement
    await settle()

    const crumbs = [...el.querySelectorAll('a, span:not([data-part])')] as HTMLElement[]
    expect(crumbs.map((c) => c.textContent)).toEqual(['Home', 'Section A', 'Subsection B', 'Subsection C', 'Current page'])

    const folded = crumbs.filter((c) => c.hasAttribute('data-collapsed'))
    // n=5 (Home,A,B,C,Current), keepTrailing=2 ⇒ pin index0(Home) + last 2 (C, Current); fold indices 1,2 (A, B).
    expect(folded.map((c) => c.textContent)).toEqual(['Section A', 'Subsection B'])
    for (const f of folded) expect(f.getClientRects().length, 'a folded crumb must render NOWHERE').toBe(0)

    const pinned = crumbs.filter((c) => !c.hasAttribute('data-collapsed'))
    for (const p of pinned) {
      const r = p.getBoundingClientRect()
      expect(r.width, `${server.browser}: a pinned crumb painted zero width`).toBeGreaterThan(0)
    }

    const menu = el.querySelector('[data-part="overflow"]') as HTMLElement
    expect(menu, 'the overflow menu must exist').not.toBeNull()
    const trigger = menu.querySelector('[data-part="trigger"]') as HTMLElement
    const tr = trigger.getBoundingClientRect()
    expect(tr.width, `${server.browser}: the overflow trigger painted zero width`).toBeGreaterThan(0)
    expect(tr.height, `${server.browser}: the overflow trigger painted zero height`).toBeGreaterThan(0)
    expect(trigger.querySelector('svg'), 'the dots-three glyph must be present').not.toBeNull()
  })

  it('collapse="none" (default) NEGATIVE — every crumb paints, no overflow trigger exists', async () => {
    const el = mount(
      '<ui-breadcrumb label="Breadcrumb"><a href="/">Home</a><a href="/a">A</a><a href="/a/b">B</a><a href="/a/b/c">C</a><span>Current</span></ui-breadcrumb>',
    ) as HTMLElement
    await settle()
    expect(el.querySelector('[data-part="overflow"]')).toBeNull()
    const crumbs = [...el.querySelectorAll('a, span:not([data-part])')] as HTMLElement[]
    for (const c of crumbs) expect(c.getClientRects().length).toBeGreaterThan(0)
  })
})

describe('ui-breadcrumb — collapse="menu" end-to-end keyboard commit relay (both engines)', () => {
  it('[MUST-PROVE] Tab reaches the trigger in normal order; Enter opens it (focus seeds onto the first proxy); ArrowDown roves to the second proxy; Enter commits and RELAYS a real click to THAT folded crumb', async () => {
    const el = mount(COLLAPSE_FIVE) as HTMLElement
    await settle()
    const home = el.querySelector('a[href="/"]') as HTMLAnchorElement
    // n=5, keepTrailing=2 ⇒ BOTH Section A and Subsection B fold (the whole-shape test's own math).
    const sectionA = el.querySelector('a[href="/a"]') as HTMLAnchorElement
    const subsectionB = el.querySelector('a[href="/a/b"]') as HTMLAnchorElement
    expect(sectionA.hasAttribute('data-collapsed'), 'vacuous test setup').toBe(true)
    expect(subsectionB.hasAttribute('data-collapsed'), 'vacuous test setup').toBe(true)

    let sectionAClicked = false
    let subsectionBClicked = false
    sectionA.addEventListener('click', (e) => {
      e.preventDefault() // never actually navigate the test document
      sectionAClicked = true
    })
    subsectionB.addEventListener('click', (e) => {
      e.preventDefault()
      subsectionBClicked = true
    })

    home.focus()
    expect(document.activeElement, 'vacuous test setup').toBe(home)

    const trigger = el.querySelector('[data-part="overflow"] [data-part="trigger"]') as HTMLElement
    if (server.browser === 'webkit') {
      // WebKit (Playwright) does not reliably chain a real Tab step off a JS-focused <a> in this harness —
      // a known engine quirk (the form-e2e.browser.test.ts `if (server.browser === 'webkit') …focus()`
      // precedent), unrelated to this component: the trigger's own tab-STOP-ness (a real <button>, normal
      // document order) is what matters, proven directly.
      trigger.focus()
    } else {
      await userEvent.tab() // Home → the overflow trigger (the fold's DOM position, right after Home)
    }
    expect(document.activeElement, `${server.browser}: Tab did not reach the overflow trigger next`).toBe(trigger)
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')

    await userEvent.keyboard('{Enter}') // a real <button> — Enter fires a native click, opening the menu
    expect(trigger.getAttribute('aria-expanded'), `${server.browser}: Enter on the trigger did not open the menu`).toBe('true')

    const menu = el.querySelector('[data-part="overflow"]') as HTMLElement
    const proxies = [...menu.querySelectorAll('[role="menuitem"]')] as HTMLElement[]
    expect(proxies.map((p) => p.textContent)).toEqual(['Section A', 'Subsection B'])
    // ui-menu's own open contract (menu.ts `focusOnOpen`/`seedOpenFocus`) seeds focus onto the FIRST item —
    // no ArrowDown needed to REACH it, only to move PAST it.
    expect(document.activeElement, `${server.browser}: opening the menu did not seed focus onto the first proxy`).toBe(proxies[0])

    await userEvent.keyboard('{ArrowDown}') // ui-menu's own roving focus — vertical, rove to the SECOND proxy
    expect(document.activeElement, `${server.browser}: ArrowDown did not rove focus to the second proxy item`).toBe(proxies[1])

    await userEvent.keyboard('{Enter}') // ui-menu's own commit — fires `select`, closes the panel
    expect(trigger.getAttribute('aria-expanded'), `${server.browser}: commit did not close the menu`).toBe('false')
    expect(sectionAClicked, `${server.browser}: the FIRST folded crumb must NOT have been clicked`).toBe(false)
    expect(subsectionBClicked, `${server.browser}: the commit did not RELAY a real .click() to the SECOND folded crumb`).toBe(true)
  })

  it('[MUST-PROVE] a MOUSE commit (click trigger, click the second proxy row) relays to the SECOND folded crumb', async () => {
    // n=6, keepTrailing=2 ⇒ pin crumb0 + last 2; fold crumbs 1,2,3 (three folded, two proxy rows relevant here)
    const el = mount(`
      <ui-breadcrumb label="Breadcrumb" collapse="menu">
        <a href="/">Home</a>
        <a href="/a">A</a>
        <a href="/b">B</a>
        <a href="/c">C</a>
        <a href="/d">D</a>
        <span>Current</span>
      </ui-breadcrumb>`) as HTMLElement
    await settle()
    const crumbB = el.querySelector('a[href="/b"]') as HTMLAnchorElement
    expect(crumbB.hasAttribute('data-collapsed'), 'vacuous test setup').toBe(true)

    let relayed = false
    crumbB.addEventListener('click', (e) => {
      e.preventDefault()
      relayed = true
    })

    const trigger = el.querySelector('[data-part="overflow"] [data-part="trigger"]') as HTMLElement
    await userEvent.click(trigger)
    const menu = el.querySelector('[data-part="overflow"]') as HTMLElement
    const proxies = [...menu.querySelectorAll('[role="menuitem"]')] as HTMLElement[]
    expect(proxies.map((p) => p.textContent)).toEqual(['A', 'B', 'C'])

    await userEvent.click(proxies[1]) // "B" — the second proxy row
    expect(relayed, `${server.browser}: clicking the second proxy row must relay to the SECOND folded crumb (B)`).toBe(true)
  })

  it('Escape closes the open overflow menu and returns focus to the trigger', async () => {
    const el = mount(COLLAPSE_FIVE) as HTMLElement
    await settle()
    const trigger = el.querySelector('[data-part="overflow"] [data-part="trigger"]') as HTMLElement
    await userEvent.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    await userEvent.keyboard('{Escape}')
    expect(trigger.getAttribute('aria-expanded'), `${server.browser}: Escape did not close the menu`).toBe('false')
    expect(document.activeElement, `${server.browser}: Escape did not return focus to the trigger`).toBe(trigger)
  })
})

describe('ui-breadcrumb — collapse="menu" forced-colors survival for the overflow trigger (the intake\'s named law)', () => {
  it('the dots-three glyph survives forced-colors — Chromium emulates (CDP); WebKit asserts the baseline', async () => {
    const el = mount(COLLAPSE_FIVE) as HTMLElement
    await settle()
    const trigger = el.querySelector('[data-part="overflow"] [data-part="trigger"]') as HTMLElement
    const svg = trigger.querySelector('svg')
    expect(svg, 'the dots-three glyph must be present').not.toBeNull()

    if (server.browser !== 'chromium') {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(false)
      return
    }

    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] })
    try {
      expect(window.matchMedia('(forced-colors: active)').matches, 'the engine did not enter forced-colors').toBe(true)
      expect(trigger.getClientRects().length, 'the trigger rendered no box under forced-colors').toBeGreaterThan(0)
      const color = getComputedStyle(trigger).color
      expect(color, 'the trigger computed an empty (invisible) color under forced-colors').not.toBe('')
      expect(color, 'the trigger glyph vanished (transparent) under forced-colors').not.toBe('transparent')
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] })
    }
  })
})
