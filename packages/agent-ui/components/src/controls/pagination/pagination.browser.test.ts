import { describe, it, expect, afterEach } from 'vitest'
import { server, cdp } from 'vitest/browser'

// pagination.browser.test.ts — the cross-engine browser-truth proof (SPEC-R3). Runs in BOTH Chromium and
// WebKit (vitest.browser.config.ts). Covers what jsdom cannot: real painted geometry (the whole-shape law),
// real keyboard tab order across the composed ui-buttons, and the computed AX role (a labelled `navigation`
// landmark) — the table.browser.test.ts AX-probe pattern (CDP, frame-scoped).
import '@agent-ui/components/foundation-styles.css'
import '../button/button.css'
import './pagination.css'
import '../button/button.ts'
import './pagination.ts'

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

/** Minimal CDP surface — `cdp()`'s public type is empty; the playwright provider gives `.send` at runtime. */
interface CdpSession {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>
}

describe('ui-pagination — whole-shape (test-the-whole-shape)', () => {
  it('a real pagination control paints a visible, non-zero box with real button stops', () => {
    const el = mount('<ui-pagination label="Results" page="3" pages="10"></ui-pagination>') as HTMLElement
    const box = el.getBoundingClientRect()
    expect(box.width, 'the pagination host painted zero width').toBeGreaterThan(0)
    expect(box.height, 'the pagination host painted zero height').toBeGreaterThan(0)
    const buttons = el.querySelectorAll('ui-button')
    expect(buttons.length).toBeGreaterThan(0)
    for (const b of buttons) {
      const r = (b as HTMLElement).getBoundingClientRect()
      expect(r.width, 'a stamped stop painted zero width').toBeGreaterThan(0)
      expect(r.height, 'a stamped stop painted zero height').toBeGreaterThan(0)
    }
  })

  it('pages < 2 paints NOTHING — zero-height host, the honest empty state', () => {
    const el = mount('<ui-pagination label="Results" pages="1"></ui-pagination>') as HTMLElement
    expect(el.children).toHaveLength(0)
  })
})

describe('ui-pagination — real keyboard tab order across composed stops', () => {
  it('every ENABLED stop is independently Tab-reachable, in DOM order — no roving tabindex', async () => {
    // page=2 of 3 so BOTH prev and next are enabled (page=1 would leave "prev" correctly disabled — and
    // therefore correctly OUT of the tab order, the tabbable trait's own contract; asserting focus on a
    // disabled button would be asserting the wrong thing, not a real defect).
    const el = mount('<ui-pagination label="Results" page="2" pages="3"></ui-pagination>') as HTMLElement
    const buttons = [...el.querySelectorAll('ui-button')] as HTMLElement[]
    expect(buttons.length).toBeGreaterThanOrEqual(3) // prev + at least 3 pages + next, none collapsed at pages=3
    for (const b of buttons) {
      expect(b.hasAttribute('disabled'), `${b.getAttribute('data-part')} unexpectedly disabled at page 2 of 3`).toBe(false)
      b.focus()
      expect(document.activeElement, `${b.getAttribute('data-part')} did not accept focus`).toBe(b)
    }
  })

  it('a DISABLED stop (prev at page 1) is correctly OUT of the tab order — not a focus defect', () => {
    const el = mount('<ui-pagination label="Results" page="1" pages="3"></ui-pagination>') as HTMLElement
    const prev = el.querySelector('[data-part="prev"]') as HTMLElement
    expect(prev.hasAttribute('disabled')).toBe(true)
    prev.focus()
    expect(document.activeElement).not.toBe(prev)
  })
})

describe('ui-pagination — computed AX role (a labelled navigation landmark)', () => {
  it('the host exposes AX role=navigation named by `label`', async () => {
    const el = mount('<ui-pagination label="Search results" page="2" pages="5"></ui-pagination>') as HTMLElement
    expect(el.getAttribute('role')).toBeNull()

    if (server.browser !== 'chromium') {
      // WebKit exposes no CDP Accessibility domain (the table.browser.test.ts / button / card precedent).
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
    const navNode = ax.nodes.find((n) => n.role?.value === 'navigation' && n.name?.value === 'Search results')
    expect(navNode, 'no AX node with role=navigation named "Search results" found').toBeDefined()
  })
})


// -- ADR-0223 (Fill by Default, slice 2 -- action/selection): the two-posture acceptance leg, the
//    generalized ADR-0021 smoke (the text-field pilot's shape): FILL -- a bare host in block flow
//    stretches to the container's inline size (the container IS the floor); [inline] -- the host hugs
//    its content and sits BELOW the container. No clause 3(b) content floor exists on this control to relocate.
describe('ui-pagination -- ADR-0223 two postures (fill default / [inline] hug, both engines)', () => {
  it('bare host offsetWidth ~= container inline size (fill); [inline] host hugs below the container', async () => {
    const wrap = document.createElement('div')
    wrap.style.inlineSize = '640px' // a wide BLOCK container -- wider than any hug resolution
    wrap.innerHTML = `<ui-pagination pages="5" page="2" label="Results pages"></ui-pagination>`
    document.body.append(wrap)
    const host = wrap.querySelector('ui-pagination') as HTMLElement & { updateComplete?: Promise<unknown> }
    await host.updateComplete
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
