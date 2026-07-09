import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { whenFlushed } from '@agent-ui/components'
import { createRouter } from './core/router.ts'
import { connectUrl } from './url.ts'
import type { RouteRecord } from './core/types.ts'

const el = () => document.createElement('div')
const routes: RouteRecord[] = [
  { path: '/', component: el },
  { path: '/a', component: el },
  { path: '/items/:id', component: el },
]

// Reset the shared jsdom `location` between tests — vitest's jsdom `window` persists across tests in one
// file, so a prior test's hash write would otherwise leak into the next.
beforeEach(() => {
  window.history.replaceState(null, '', '/')
})
afterEach(() => {
  window.history.replaceState(null, '', '/')
})

describe('connectUrl — hash mode (default; SPEC-R4)', () => {
  it('AC1: a router with NO adapter never touches the URL', async () => {
    const router = createRouter(routes, { initial: '/a' })
    const before = location.href
    router.navigate('/items/7')
    await whenFlushed()
    expect(location.href).toBe(before)
  })

  it('AC2: deep-link-wins — an existing #/route at connect wins over the router current route', async () => {
    location.hash = '/items/7'
    const router = createRouter(routes, { initial: '/a' })
    const cleanup = connectUrl(router)
    expect(router.route.value?.path).toBe('/items/7')
    expect(router.route.value?.params.id).toBe('7')
    cleanup()
  })

  it('regression (component-review HIGH): the FIRST real navigation after a deep-link adoption pushes, not replaces — history.length grows by 1', async () => {
    // Narrower than the history-mode leak (only triggers after a real #/ deep link at connect, since an
    // empty hash correctly leaves `existing === null` and the effect's own first run legitimately
    // consumes `first`) — but the same root cause: adoption's navigate() makes the effect's first run a
    // same-value no-op, so `first` must be consumed AT ADOPTION or it leaks into this navigation.
    location.hash = '/items/7'
    const router = createRouter(routes, { initial: '/a' })
    const cleanup = connectUrl(router)
    expect(router.route.value?.path).toBe('/items/7') // adopted

    const lengthBeforeFirstNav = window.history.length
    router.navigate('/a') // the FIRST real (non-adoption) navigation
    await whenFlushed()
    expect(location.hash).toBe('#/a')
    expect(window.history.length, 'first real navigation after adoption must PUSH a new entry').toBe(lengthBeforeFirstNav + 1)
    cleanup()
  })

  it('AC2: an empty hash gets the current route reflected out via REPLACE (no new browser entry)', async () => {
    const router = createRouter(routes, { initial: '/a' })
    const lengthBefore = window.history.length
    const cleanup = connectUrl(router)
    await whenFlushed()
    expect(location.hash).toBe('#/a')
    expect(window.history.length).toBe(lengthBefore) // replace, not push — no growth
    cleanup()
  })

  it('outbound: navigate writes location.hash (push form — a real entry)', async () => {
    const router = createRouter(routes, { initial: '/a' })
    const cleanup = connectUrl(router)
    await whenFlushed()
    router.navigate('/items/42')
    await whenFlushed()
    expect(location.hash).toBe('#/items/42')
    cleanup()
  })

  it('outbound: query is written onto the hash', async () => {
    const router = createRouter(routes, { initial: '/a' })
    const cleanup = connectUrl(router)
    await whenFlushed()
    router.navigate('/items/7?x=1&y=2')
    await whenFlushed()
    expect(location.hash).toBe('#/items/7?x=1&y=2')
    cleanup()
  })

  it('AC3: an external hash edit navigates the router (push)', async () => {
    const router = createRouter(routes, { initial: '/a' })
    const cleanup = connectUrl(router)
    await whenFlushed()
    location.hash = '/items/9'
    window.dispatchEvent(new Event('hashchange'))
    expect(router.route.value?.path).toBe('/items/9')
    expect(router.route.value?.params.id).toBe('9')
    cleanup()
  })

  it('AC3: echo-lock — the adapter\'s own outbound write does not re-enter navigate (navigate count stays 1)', async () => {
    const router = createRouter(routes, { initial: '/a' })
    const cleanup = connectUrl(router)
    await whenFlushed()

    let navigations = 0
    const originalNavigate = router.navigate.bind(router)
    router.navigate = (...args: Parameters<typeof router.navigate>) => {
      navigations++
      return originalNavigate(...args)
    }

    router.navigate('/items/5') // OUR OWN app-driven navigate — the one real navigation
    await whenFlushed()
    window.dispatchEvent(new Event('hashchange')) // the platform's own echo of the write above
    expect(navigations).toBe(1) // the echo did NOT re-enter navigate
    expect(location.hash).toBe('#/items/5')
    cleanup()
  })

  it('a non-route hash (#anchor) is not ours — ignored on read and by the inbound handler', async () => {
    location.hash = 'section-2'
    const router = createRouter(routes, { initial: '/a' })
    const cleanup = connectUrl(router)
    expect(router.route.value?.path).toBe('/a') // deep-link-wins did NOT adopt the non-route hash
    location.hash = 'other-anchor'
    window.dispatchEvent(new Event('hashchange'))
    expect(router.route.value?.path).toBe('/a') // still untouched
    cleanup()
  })

  it('AC5: cleanup() removes listeners and restores pure memory operation', async () => {
    const router = createRouter(routes, { initial: '/a' })
    const cleanup = connectUrl(router)
    await whenFlushed()
    cleanup()

    const hashBefore = location.hash
    router.navigate('/items/1')
    await whenFlushed()
    expect(location.hash).toBe(hashBefore) // no write after cleanup

    location.hash = '/items/2'
    window.dispatchEvent(new Event('hashchange'))
    expect(router.route.value?.path).toBe('/items/1') // no listener — external edit ignored
  })

  it('AC5: a second connectUrl on the same router without cleanup throws', () => {
    const router = createRouter(routes, { initial: '/a' })
    const cleanup = connectUrl(router)
    expect(() => connectUrl(router)).toThrow()
    cleanup()
  })

  it('a second connectUrl after cleanup() is legal', () => {
    const router = createRouter(routes, { initial: '/a' })
    const cleanup1 = connectUrl(router)
    cleanup1()
    const cleanup2 = connectUrl(router)
    cleanup2()
  })

  it('SSR/no-location edge: connectUrl throws immediately when `location` is absent', () => {
    const g = globalThis as Record<string, unknown>
    const saved = g.location
    delete g.location
    try {
      const router = createRouter(routes, { initial: '/a' })
      expect(() => connectUrl(router)).toThrow()
    } finally {
      g.location = saved
    }
  })
})
