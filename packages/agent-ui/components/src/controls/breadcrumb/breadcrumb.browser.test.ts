import { describe, it, expect, afterEach } from 'vitest'
import { server, cdp } from 'vitest/browser'

// breadcrumb.browser.test.ts — the cross-engine browser-truth proof for `ui-breadcrumb` S1 core anatomy
// (GH #1515, the frozen design intake `.claude/docs/spec/breadcrumb.intake.md` §4/§7). Runs in BOTH
// Chromium and WebKit (vitest.browser.config.ts). Covers what jsdom cannot: real painted geometry (the
// whole-shape law — test-the-whole-shape), real keyboard tab order across independent crumb links, the
// computed AX role (a labelled `navigation` landmark, CDP frame-scoped — the pagination.browser.test.ts
// precedent), the ADR-0223 fill/[inline] two-posture proof, and — the intake's own named forced-colors
// law — the separator's REAL-TEXT-NODE survival under CDP forced-colors emulation.
import '@agent-ui/components/foundation-styles.css'
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
