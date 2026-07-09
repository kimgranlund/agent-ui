// router.browser.test.ts — LLD-C9: real-engine proof for what jsdom cannot fully validate. Runs in BOTH
// Chromium and WebKit (vitest.browser.config.ts's `packages` project, `packages/agent-ui/*/src/**/*.browser.test.ts`).
// jsdom-green ≠ done (the fleet's Wave-4 18-bug lesson) — three things live ONLY here:
//   1. ui-router-outlet's factory-seam swap in a REAL DOM, incl. a whole-shape non-zero rendered box.
//   2. ui-router-link's click-interception with REAL synthetic MouseEvents carrying real modifier keys —
//      jsdom can dispatch these, but this is the cross-engine truth pass (both engines must agree).
//   3. History-mode REAL back/forward: url-history.test.ts (jsdom) already proves the stamped-index
//      mechanism against SYNTHETIC `dispatchEvent(new PopStateEvent(...))`; jsdom does not reliably fire
//      popstate on a REAL `history.back()` call (LLD-C6's documented jsdom fidelity gap) — this file is
//      the instrument-bridge's other half: real engine, real async popstate timing, same assertion.
//
// Direct imports (not a family barrel — router has none, LLD-C10a): foundation CSS for the
// --md-sys-color-*/--ui-focus-ring-* tokens router-link.css consumes, then the two control modules
// (self-defining on import) + router-link's own stylesheet (never barrel-injected, plan §2).
import { describe, it, expect, afterEach } from 'vitest'
import { server, cdp } from 'vitest/browser'
import '@agent-ui/components/foundation-styles.css'
import { whenFlushed } from '@agent-ui/components'
import { createRouter } from './core/router.ts'
import { connectUrl } from './url.ts'
import './controls/router-outlet/router-outlet.ts'
import type { UIRouterOutletElement } from './controls/router-outlet/router-outlet.ts'
import './controls/router-link/router-link.ts'
import './controls/router-link/router-link.css'
import type { UIRouterLinkElement } from './controls/router-link/router-link.ts'
import type { RouteRecord } from './core/types.ts'

/** Minimal CDP surface — `cdp()`'s public type is empty; the playwright provider gives `.send` at runtime
 *  (the disclosure.browser.test.ts precedent). */
interface CdpSession {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>
}

const mounted: Element[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

function tagged(text: string): Element {
  const el = document.createElement('div')
  el.textContent = text
  return el
}

function mount<T extends Element>(el: T): T {
  mounted.push(el)
  document.body.append(el)
  return el
}

// ═══════════════════════════ ui-router-outlet — real DOM factory-seam swap ═══════════════════════════

describe('ui-router-outlet — real DOM factory-seam swap (SPEC-R5, LLD-C9)', () => {
  it('a sync factory swap renders a whole, non-zero-box element (not just a truthy childElementCount)', async () => {
    const routes: RouteRecord[] = [
      { path: '/a', component: () => tagged('Route A content') },
      { path: '/b', component: () => tagged('Route B content') },
    ]
    const router = createRouter(routes, { initial: '/a' })
    const outlet = mount(document.createElement('ui-router-outlet')) as UIRouterOutletElement
    outlet.router = router
    await whenFlushed()

    const box = outlet.getBoundingClientRect()
    expect(box.width).toBeGreaterThan(0)
    expect(box.height).toBeGreaterThan(0)
    expect(outlet.textContent).toBe('Route A content')

    router.navigate('/b')
    await whenFlushed()
    expect(outlet.textContent).toBe('Route B content')
    const box2 = outlet.getBoundingClientRect()
    expect(box2.width).toBeGreaterThan(0)
    expect(box2.height).toBeGreaterThan(0)
  })

  it('a slow async factory is discarded when superseded before it resolves (real macrotask timing)', async () => {
    let resolveSlow: (el: Element) => void = () => {}
    const routes: RouteRecord[] = [
      {
        path: '/a',
        component: () =>
          new Promise<Element>((resolve) => {
            resolveSlow = resolve
          }),
      },
      { path: '/b', component: () => tagged('fast b') },
    ]
    const router = createRouter(routes, { initial: '/a' })
    const outlet = mount(document.createElement('ui-router-outlet')) as UIRouterOutletElement
    outlet.router = router
    await whenFlushed()
    expect(outlet.children.length).toBe(0) // /a still pending

    router.navigate('/b')
    await whenFlushed()
    expect(outlet.textContent).toBe('fast b')

    resolveSlow(tagged('stale a'))
    await new Promise((r) => setTimeout(r, 0)) // a real macrotask tick — the resolution genuinely lands
    expect(outlet.textContent).toBe('fast b') // never clobbered by the late /a resolution
  })

  it('a null match renders nothing and never throws', async () => {
    const routes: RouteRecord[] = [{ path: '/a', component: () => tagged('a') }]
    const router = createRouter(routes, { initial: '/nope' })
    const outlet = mount(document.createElement('ui-router-outlet')) as UIRouterOutletElement
    expect(() => (outlet.router = router)).not.toThrow()
    await whenFlushed()
    expect(outlet.children.length).toBe(0)
  })
})

// ═══════════════════════════ ui-router-link — real click interception ═══════════════════════════

describe('ui-router-link — real click interception (SPEC-R6 AC1/AC2, LLD-C9)', () => {
  // Attributes/textContent/`.router` are all set BEFORE the element is appended — the stamp doctrine moves
  // `this.childNodes` into the internal `<a>` exactly ONCE, at connect (LLD-C8); setting `textContent`
  // AFTER connect would replace the HOST's children (nuking the already-stamped anchor), not the stamp's.
  function makeLink(to: string, label: string, router: ReturnType<typeof createRouter>): UIRouterLinkElement {
    const link = document.createElement('ui-router-link') as UIRouterLinkElement
    link.setAttribute('to', to)
    link.textContent = label
    link.router = router
    return mount(link)
  }

  function wired(routes: RouteRecord[]): { router: ReturnType<typeof createRouter>; link: UIRouterLinkElement; outlet: UIRouterOutletElement } {
    const router = createRouter(routes, { initial: '/' })
    const outlet = mount(document.createElement('ui-router-outlet')) as UIRouterOutletElement
    outlet.router = router
    const link = makeLink('/about', 'About', router)
    return { router, link, outlet }
  }

  it('AC1: a plain click is intercepted — outlet swaps, NO document navigation, no beforeunload', async () => {
    const routes: RouteRecord[] = [
      { path: '/', component: () => tagged('Home') },
      { path: '/about', component: () => tagged('About') },
    ]
    const { router, link, outlet } = wired(routes)
    await whenFlushed()

    let unloaded = false
    const onBeforeUnload = () => {
      unloaded = true
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    const locationBefore = location.href

    try {
      const anchor = link.querySelector('a') as HTMLAnchorElement
      const evt = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
      anchor.dispatchEvent(evt)
      expect(evt.defaultPrevented).toBe(true) // OUR handler prevented the native anchor activation

      await whenFlushed()
      expect(router.route.value?.path).toBe('/about')
      expect(outlet.textContent).toBe('About')
      expect(location.href).toBe(locationBefore) // byte-unchanged — no document navigation occurred
      expect(unloaded).toBe(false)
    } finally {
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  })

  it.each([
    ['ctrl/cmd-click', { ctrlKey: true }],
    ['shift-click', { shiftKey: true }],
    ['alt-click', { altKey: true }],
    ['middle-click', { button: 1 }],
  ] as const)('AC2: %s is NOT intercepted — defaultPrevented stays false, router does not navigate', async (_label, mods) => {
    const routes: RouteRecord[] = [
      { path: '/', component: () => tagged('Home') },
      { path: '/about', component: () => tagged('About') },
    ]
    const { router, link } = wired(routes)
    await whenFlushed()

    const anchor = link.querySelector('a') as HTMLAnchorElement
    const evt = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...mods })
    anchor.dispatchEvent(evt)

    expect(evt.defaultPrevented).toBe(false) // the platform owns it — our handler returned before preventDefault
    await whenFlushed()
    expect(router.route.value?.path).toBe('/') // never navigated
  })

  it('AC4: aria-current="page" tracks the exact active link across navigation', async () => {
    const routes: RouteRecord[] = [
      { path: '/', component: () => tagged('Home') },
      { path: '/about', component: () => tagged('About') },
    ]
    const { router, link } = wired(routes)
    await whenFlushed()
    const anchor = link.querySelector('a') as HTMLAnchorElement
    expect(anchor.getAttribute('aria-current')).toBeNull()

    router.navigate('/about')
    await whenFlushed()
    expect(anchor.getAttribute('aria-current')).toBe('page')

    router.navigate('/')
    await whenFlushed()
    expect(anchor.getAttribute('aria-current')).toBeNull()
  })
})

// ═══════════════════════════ forced-colors legibility (SPEC-R7 AC2) ═══════════════════════════

describe('ui-router-link — forced-colors survival, non-color active cue (SPEC-R7 AC2, LLD-C9)', () => {
  it('the active link stays legible under forced-colors — Chromium emulates (CDP); WebKit asserts the baseline', async () => {
    const routes: RouteRecord[] = [{ path: '/about', component: () => tagged('About') }]
    const router = createRouter(routes, { initial: '/about' })
    const link = document.createElement('ui-router-link') as UIRouterLinkElement
    link.setAttribute('to', '/about') // set BEFORE connect — the stamp doctrine (see makeLink's comment above)
    link.textContent = 'About'
    link.router = router
    mount(link)
    await whenFlushed()
    const anchor = link.querySelector('a') as HTMLAnchorElement
    expect(anchor.getAttribute('aria-current')).toBe('page')

    // The non-color cue (font-weight) holds regardless of forced-colors emulation support — asserted first.
    expect(getComputedStyle(anchor).fontWeight).toBe('700')

    if (server.browser !== 'chromium') {
      // WebKit exposes no CDP / forced-colors emulation in headless runs (the disclosure.browser.test.ts /
      // button-geometry.browser.test.ts precedent) — assert we are genuinely NOT in forced-colors and stop.
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(false)
      return
    }

    const session = cdp() as unknown as CdpSession
    await session.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] })
    try {
      expect(window.matchMedia('(forced-colors: active)').matches).toBe(true)
      const color = getComputedStyle(anchor).color
      expect(color).not.toBe('') // an opaque system ink (LinkText) is painted, never vanished
      expect(getComputedStyle(anchor).fontWeight).toBe('700') // the non-color cue survives too
    } finally {
      await session.send('Emulation.setEmulatedMedia', { features: [] })
    }
  })
})

// ═══════════════════════════ history mode — REAL back/forward (LLD-C6 bridge) ═══════════════════════════

describe('connectUrl history mode — REAL browser back/forward stays index-aligned (SPEC-R4 AC4, LLD-C9)', () => {
  function waitForPopstate(): Promise<void> {
    return new Promise((resolve) => {
      window.addEventListener('popstate', () => resolve(), { once: true })
    })
  }

  afterEach(() => {
    window.history.replaceState(null, '', '/') // the url-history.test.ts hygiene, mirrored for the real engine
  })

  it('navigate → navigate → REAL browser back stays index-aligned; forward() reaches the same entry', async () => {
    window.history.replaceState(null, '', '/')
    const routes: RouteRecord[] = [
      { path: '/', component: () => tagged('root') },
      { path: '/a', component: () => tagged('a') },
      { path: '/b', component: () => tagged('b') },
    ]
    const router = createRouter(routes, { initial: '/' })
    const cleanup = connectUrl(router, { mode: 'history' })
    await whenFlushed() // the first connectUrl write stamps index 0 on '/'

    router.navigate('/a')
    await whenFlushed()
    router.navigate('/b')
    await whenFlushed()
    expect(router.route.value?.path).toBe('/b')
    expect(location.pathname).toBe('/b')

    // A REAL browser back() — asynchronous popstate, the exact gap jsdom cannot reliably reproduce.
    const popped = waitForPopstate()
    window.history.back()
    await popped
    await whenFlushed()

    expect(location.pathname).toBe('/a') // the browser's own stack really moved
    expect(router.route.value?.path).toBe('/a') // …and the router's memory stack stayed aligned with it

    router.forward()
    await whenFlushed()
    expect(router.route.value?.path).toBe('/b')

    cleanup()
  })
})
