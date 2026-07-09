import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { whenFlushed } from '@agent-ui/components'
import { createRouter } from './core/router.ts'
import { connectUrl } from './url.ts'
import type { RouteRecord } from './core/types.ts'

const el = () => document.createElement('div')
const routes: RouteRecord[] = [
  { path: '/', component: el },
  { path: '/a', component: el },
  { path: '/b', component: el },
  { path: '/items/:id', component: el },
]

function popstate(state: unknown): void {
  window.dispatchEvent(new PopStateEvent('popstate', { state }))
}

beforeEach(() => {
  window.history.replaceState(null, '', '/')
})
afterEach(() => {
  window.history.replaceState(null, '', '/')
})

describe('connectUrl — history mode (opt-in; SPEC-R4)', () => {
  it('outbound: navigate pushState-writes the path, stamped with the memory index', async () => {
    const router = createRouter(routes, { initial: '/a' })
    const cleanup = connectUrl(router, { mode: 'history' })
    await whenFlushed()
    router.navigate('/items/7')
    await whenFlushed()
    expect(location.pathname).toBe('/items/7')
    expect((window.history.state as { uiRouter: { index: number } }).uiRouter.index).toBe(router.historyIndex)
    cleanup()
  })

  it('outbound: replace navigation writes via replaceState (no browser entry growth)', async () => {
    const router = createRouter(routes, { initial: '/a' })
    const cleanup = connectUrl(router, { mode: 'history' })
    await whenFlushed()
    const lengthBefore = window.history.length
    router.navigate('/b', { replace: true })
    await whenFlushed()
    expect(location.pathname).toBe('/b')
    expect(window.history.length).toBe(lengthBefore)
    cleanup()
  })

  it('deep-link-wins: the router adopts whatever the browser is currently on at connect', () => {
    window.history.replaceState(null, '', '/items/9')
    const router = createRouter(routes, { initial: '/a' })
    const cleanup = connectUrl(router, { mode: 'history' })
    expect(router.route.value?.path).toBe('/items/9')
    expect(router.route.value?.params.id).toBe('9')
    cleanup()
  })

  it('regression (component-review HIGH): the FIRST real navigation after adoption pushes, not replaces — history.length grows by 1, and browser Back after it returns to the loaded entry', async () => {
    // Adoption's own navigate() makes the outbound effect's first run a same-value no-op (the adopted
    // route already equals lastReflected) — `first` must be consumed AT ADOPTION, or it leaks into this
    // navigation and wrongly forces replace, silently overwriting the loaded entry instead of pushing.
    window.history.replaceState(null, '', '/a') // simulate a real page load already sitting on '/a'
    const router = createRouter(routes, { initial: '/x-ignored' }) // adoption wins over `initial` in history mode
    const cleanup = connectUrl(router, { mode: 'history' })
    await whenFlushed() // adoption's explicit stamp write lands here — must consume `first`
    expect(router.route.value?.path).toBe('/a') // adopted, not '/x-ignored'

    const lengthBeforeFirstNav = window.history.length
    router.navigate('/b') // the FIRST real (non-adoption) navigation
    await whenFlushed()
    expect(location.pathname).toBe('/b')
    expect(window.history.length, 'first real navigation after adoption must PUSH a new entry').toBe(lengthBeforeFirstNav + 1)

    // Browser Back must land back on the ADOPTED entry ('/a'), not exit past it — proves the entry was
    // genuinely pushed (a wrongly-replaced entry would make Back skip straight past '/a').
    popstate({ uiRouter: { index: 0 } })
    expect(router.route.value?.path).toBe('/a')
    cleanup()
  })

  it('AC4: a real navigate → navigate → stamped popstate BACK stays index-aligned (the load-bearing leg)', async () => {
    const router = createRouter(routes, { initial: '/a' })
    const cleanup = connectUrl(router, { mode: 'history' })
    await whenFlushed() // the FIRST connectUrl write stamps index 0 on '/a'
    router.navigate('/items/1')
    await whenFlushed()
    router.navigate('/b')
    await whenFlushed()
    expect(router.route.value?.path).toBe('/b')
    expect(router.historyIndex).toBe(2) // '/a' (0) -> '/items/1' (1) -> '/b' (2)

    // The BROWSER fires popstate with the stamped state of the entry it landed on (index 1 — '/items/1').
    popstate({ uiRouter: { index: 1 } })
    expect(router.route.value?.path).toBe('/items/1')
    expect(router.historyIndex).toBe(1)
    router.forward()
    expect(router.route.value?.path).toBe('/b')
    cleanup()
  })

  it('an un-stamped popstate falls back to path adoption (push semantics)', () => {
    const router = createRouter(routes, { initial: '/a' })
    const cleanup = connectUrl(router, { mode: 'history' })
    window.history.replaceState(null, '', '/items/3') // simulate the browser having navigated, un-stamped
    popstate(null)
    expect(router.route.value?.path).toBe('/items/3')
    expect(router.route.value?.params.id).toBe('3')
    cleanup()
  })

  it('AC6: a stamped index exceeding this session\'s stack adopts the current URL as a new push (never throws)', () => {
    const router = createRouter(routes, { initial: '/a' })
    const cleanup = connectUrl(router, { mode: 'history' })
    window.history.replaceState(null, '', '/items/5')
    expect(() => popstate({ uiRouter: { index: 99 } })).not.toThrow()
    expect(router.route.value?.path).toBe('/items/5')
    expect(router.route.value?.params.id).toBe('5')
    cleanup()
  })

  it('echo-lock: the adapter\'s own pushState-driven navigation does not double-navigate on its own popstate echo', async () => {
    const router = createRouter(routes, { initial: '/a' })
    const cleanup = connectUrl(router, { mode: 'history' })
    await whenFlushed()

    let navigations = 0
    const originalNavigate = router.navigate.bind(router)
    router.navigate = (...args: Parameters<typeof router.navigate>) => {
      navigations++
      return originalNavigate(...args)
    }

    router.navigate('/b')
    await whenFlushed()
    // Echo the STAMPED state our own write just produced (what a same-tab synthetic echo would carry).
    popstate({ uiRouter: { index: router.historyIndex } })
    expect(navigations).toBe(1) // the stamped echo re-points the index via adoptAtIndex, never re-navigates
    cleanup()
  })

  it('AC5: cleanup() removes listeners and restores pure memory operation', async () => {
    const router = createRouter(routes, { initial: '/a' })
    const cleanup = connectUrl(router, { mode: 'history' })
    await whenFlushed()
    cleanup()

    const pathBefore = location.pathname
    router.navigate('/b')
    await whenFlushed()
    expect(location.pathname).toBe(pathBefore)

    window.history.replaceState(null, '', '/items/2')
    popstate(null)
    expect(router.route.value?.path).toBe('/b') // no listener — external popstate ignored
  })

  it('AC5: a second connectUrl on the same router without cleanup throws', () => {
    const router = createRouter(routes, { initial: '/a' })
    const cleanup = connectUrl(router, { mode: 'history' })
    expect(() => connectUrl(router, { mode: 'history' })).toThrow()
    cleanup()
  })
})
