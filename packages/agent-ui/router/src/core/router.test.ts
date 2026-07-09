import { describe, it, expect } from 'vitest'
import { effect, createScope, whenFlushed } from '@agent-ui/components'
import { createRouter } from './router.ts'
import type { RouteRecord } from './types.ts'

const el = () => document.createElement('div')
const routes: RouteRecord[] = [
  { path: '/a', component: el },
  { path: '/b', component: el },
  { path: '/items/:id', component: el },
]

describe('createRouter — the instance (SPEC-R2, LLD-C5)', () => {
  it('seeds the initial route (default "/")', () => {
    const router = createRouter([{ path: '/', component: el }])
    expect(router.route.value?.path).toBe('/')
  })

  it('options.initial seeds the first entry', () => {
    const router = createRouter(routes, { initial: '/a' })
    expect(router.route.value?.path).toBe('/a')
  })

  it('route is a ReadonlySignal reflecting the matched record + params', () => {
    const router = createRouter(routes, { initial: '/items/7' })
    expect(router.route.value?.params.id).toBe('7')
  })

  it('a no-match path yields a null route', () => {
    const router = createRouter(routes, { initial: '/nope' })
    expect(router.route.value).toBeNull()
  })

  it('AC3: navigate(/a) → navigate(/b) → back() lands on /a; forward() reaches /b', () => {
    const router = createRouter(routes, { initial: '/a' })
    router.navigate('/b')
    router.back()
    expect(router.route.value?.path).toBe('/a')
    router.forward()
    expect(router.route.value?.path).toBe('/b')
  })

  it('AC3: back() at index 0 changes nothing and never throws', () => {
    const router = createRouter(routes, { initial: '/a' })
    expect(() => router.back()).not.toThrow()
    expect(router.route.value?.path).toBe('/a')
  })

  it('AC3: back-then-push truncates the forward tail (forward() is then a no-op)', () => {
    const router = createRouter(routes, { initial: '/a' })
    router.navigate('/b')
    router.back()
    router.navigate('/items/1')
    router.forward() // no forward tail — the old /b entry is gone
    expect(router.route.value?.path).toBe('/items/1')
  })

  it('AC4: two independent routers — one navigating leaves the other untouched', () => {
    const r1 = createRouter(routes, { initial: '/a' })
    const r2 = createRouter(routes, { initial: '/a' })
    r1.navigate('/b')
    expect(r1.route.value?.path).toBe('/b')
    expect(r2.route.value?.path).toBe('/a')
  })

  it('re-navigating to the identical resolved path is a no-op for subscribers (the kernel Object.is cutoff, via deliberate match reuse)', async () => {
    const router = createRouter(routes, { initial: '/a' })
    const scope = createScope()
    let runs = 0
    scope.run(() =>
      effect(() => {
        void router.route.value
        runs++
      }),
    )
    expect(runs).toBe(1)
    router.navigate('/a') // same resolved path — a fresh history entry is still pushed, signal stays quiet
    await whenFlushed()
    expect(runs).toBe(1)
    router.back()
    await whenFlushed()
    expect(runs).toBe(1) // back() landed on the SAME resolved path too — still a no-op
    router.navigate('/b')
    await whenFlushed()
    expect(runs).toBe(2)
    scope.dispose()
  })

  it('replace swaps the current entry instead of pushing', () => {
    const router = createRouter(routes, { initial: '/a' })
    router.navigate('/b')
    router.navigate('/items/1', { replace: true })
    router.back()
    expect(router.route.value?.path).toBe('/a') // the replaced /b entry is gone from the stack
  })

  it('dispose() marks the instance dead — navigate/back/forward all throw, one behavior (fail loud)', () => {
    const router = createRouter(routes, { initial: '/a' })
    router.dispose()
    expect(() => router.navigate('/b')).toThrow()
    expect(() => router.back()).toThrow()
    expect(() => router.forward()).toThrow()
  })

  it('routes array mutation after construction is inert (compile snapshots the table)', () => {
    const mutable = [{ path: '/a', component: el }]
    const router = createRouter(mutable, { initial: '/a' })
    mutable.push({ path: '/b', component: el })
    router.navigate('/b')
    expect(router.route.value).toBeNull()
  })
})

describe('RouterInternal — the URL-adapter seam (package-private, LLD-C6 consumer)', () => {
  it('historyIndex tracks the memory stack index', () => {
    const router = createRouter(routes, { initial: '/a' })
    expect(router.historyIndex).toBe(0)
    router.navigate('/b')
    expect(router.historyIndex).toBe(1)
    router.back()
    expect(router.historyIndex).toBe(0)
  })

  it('adoptAtIndex jumps the stack and commits the landed route', () => {
    const router = createRouter(routes, { initial: '/a' })
    router.navigate('/b')
    const landed = router.adoptAtIndex(0)
    expect(landed).toBe('/a')
    expect(router.route.value?.path).toBe('/a')
  })

  it('adoptAtIndex on a stale/foreign index returns null and never throws or commits', () => {
    const router = createRouter(routes, { initial: '/a' })
    expect(() => router.adoptAtIndex(99)).not.toThrow()
    expect(router.adoptAtIndex(99)).toBeNull()
    expect(router.route.value?.path).toBe('/a') // unchanged
  })
})
