import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { whenFlushed } from '@agent-ui/components'
import {
  splitFrontmatter,
  parseDescriptor,
  validateComponentDescriptor,
  compareDescriptorToProps,
  compareDescriptorToSource,
  collectUsedStates,
  collectStyledSlots,
  scalarSeq,
} from '@agent-ui/components/descriptor'
import { UIRouterOutletElement, assertElement } from './router-outlet.ts'
import { createRouter } from '../../core/router.ts'
import type { RouteRecord } from '../../core/types.ts'
declare const process: { cwd(): string }

function tagged(route: string): Element {
  const el = document.createElement('div')
  el.dataset.route = route
  return el
}

function makeOutlet(): UIRouterOutletElement {
  return document.createElement('ui-router-outlet') as UIRouterOutletElement
}

const mounted: Element[] = []
afterEach(() => {
  for (const el of mounted.splice(0)) el.remove()
})

/** Mount an outlet with its `.router` already assigned BEFORE connect — the effect's FIRST run then
 *  happens SYNCHRONOUSLY inside `connectedCallback` (the append call), the only case where a throw
 *  propagates synchronously out to the caller (used by the "loud dev throw" legs below). */
function mountWithRouter(router: import('../../core/types.ts').Router): UIRouterOutletElement {
  const outlet = makeOutlet()
  outlet.router = router
  mounted.push(outlet)
  document.body.append(outlet)
  return outlet
}

function mountThenAssign(router?: import('../../core/types.ts').Router): UIRouterOutletElement {
  const outlet = makeOutlet()
  mounted.push(outlet)
  document.body.append(outlet)
  if (router) outlet.router = router
  return outlet
}

describe('ui-router-outlet — behavior (SPEC-R5, LLD-C7)', () => {
  it('AC3: an unassigned outlet renders nothing and does not throw', () => {
    const outlet = mountThenAssign()
    expect(outlet.children.length).toBe(0)
  })

  it('AC1: assigning .router renders the matched factory element as the child', async () => {
    const routes: RouteRecord[] = [{ path: '/a', component: () => tagged('a') }]
    const router = createRouter(routes, { initial: '/a' })
    const outlet = mountThenAssign(router)
    await whenFlushed()
    expect(outlet.children.length).toBe(1)
    expect((outlet.firstElementChild as HTMLElement).dataset.route).toBe('a')
  })

  it('router assigned BEFORE connect renders synchronously on mount (the first-run-is-sync case)', () => {
    const routes: RouteRecord[] = [{ path: '/a', component: () => tagged('a') }]
    const router = createRouter(routes, { initial: '/a' })
    const outlet = mountWithRouter(router)
    expect((outlet.firstElementChild as HTMLElement).dataset.route).toBe('a')
  })

  it('AC1: a route change swaps the child — the previous element is disconnected (zero-residue teardown)', async () => {
    let aConnects = 0
    class ProbeA extends HTMLElement {
      connectedCallback() {
        aConnects++
      }
    }
    if (!customElements.get('probe-outlet-a')) customElements.define('probe-outlet-a', ProbeA)

    const routes: RouteRecord[] = [
      { path: '/a', component: () => document.createElement('probe-outlet-a') },
      { path: '/b', component: () => tagged('b') },
    ]
    const router = createRouter(routes, { initial: '/a' })
    const outlet = mountThenAssign(router)
    await whenFlushed()
    const first = outlet.firstElementChild
    expect(first?.tagName.toLowerCase()).toBe('probe-outlet-a')
    expect(aConnects).toBe(1)

    router.navigate('/b')
    await whenFlushed()
    expect(outlet.firstElementChild).not.toBe(first)
    expect(outlet.firstElementChild?.tagName.toLowerCase()).toBe('div')
    expect(first?.isConnected).toBe(false) // removed — the platform ran disconnectedCallback on it
  })

  it('AC2: a stale async resolution is discarded — last-navigation-wins', async () => {
    let resolveSlow: (el: Element) => void = () => {}
    const routes: RouteRecord[] = [
      {
        path: '/a',
        component: () =>
          new Promise<Element>((resolve) => {
            resolveSlow = resolve
          }),
      },
      { path: '/b', component: () => tagged('b') },
    ]
    const router = createRouter(routes, { initial: '/a' })
    const outlet = mountThenAssign(router)
    await whenFlushed()
    expect(outlet.children.length).toBe(0) // /a is still pending

    router.navigate('/b') // /b resolves synchronously, before /a's slow promise ever settles
    await whenFlushed()
    expect((outlet.firstElementChild as HTMLElement).dataset.route).toBe('b')

    // /a's slow factory FINALLY resolves — must be discarded, not committed over /b.
    resolveSlow(tagged('a-late'))
    await Promise.resolve()
    await Promise.resolve()
    expect((outlet.firstElementChild as HTMLElement).dataset.route).toBe('b')
  })

  it('AC3: route.value === null renders nothing and does not throw', async () => {
    const routes: RouteRecord[] = [{ path: '/a', component: () => document.createElement('div') }]
    const router = createRouter(routes, { initial: '/nope' })
    const outlet = mountThenAssign()
    expect(() => (outlet.router = router)).not.toThrow()
    await whenFlushed()
    expect(outlet.children.length).toBe(0)
  })

  it('a synchronous factory throw clears the child and logs — no retry, no partial render', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const routes: RouteRecord[] = [
      {
        path: '/a',
        component: () => {
          throw new Error('boom')
        },
      },
    ]
    const router = createRouter(routes, { initial: '/a' })
    const outlet = mountThenAssign(router)
    await whenFlushed()
    expect(outlet.children.length).toBe(0)
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('an async factory rejection clears the child and logs (never an uncaught rejection)', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const routes: RouteRecord[] = [{ path: '/a', component: () => Promise.reject(new Error('nope')) }]
    const router = createRouter(routes, { initial: '/a' })
    const outlet = mountThenAssign(router)
    await whenFlushed()
    await Promise.resolve()
    await Promise.resolve()
    expect(outlet.children.length).toBe(0)
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('a non-Element factory result throws loudly — a developer error, uncaught (SPEC-R5, LLD-C7 edge)', () => {
    // A throw from inside a connectedCallback/effect REACTION is spec-mandated to be REPORTED, not
    // propagated to the caller (jsdom is correctly spec-compliant here) — assertElement is tested
    // directly (exported for exactly this reason; see its own doc comment) rather than fought through
    // the platform's reaction-reporting semantics.
    expect(() => assertElement('not an element', '/a')).toThrow(/must return an Element/)
    expect(() => assertElement(document.createElement('div'), '/a')).not.toThrow()
  })

  it('router re-assignment re-drives the effect — the old router stops driving, no residue', async () => {
    const routes1: RouteRecord[] = [{ path: '/a', component: () => tagged('1') }]
    const routes2: RouteRecord[] = [{ path: '/x', component: () => tagged('2') }]
    const router1 = createRouter(routes1, { initial: '/a' })
    const router2 = createRouter(routes2, { initial: '/x' })
    const outlet = mountThenAssign(router1)
    await whenFlushed()
    expect((outlet.firstElementChild as HTMLElement).dataset.route).toBe('1')

    outlet.router = router2
    await whenFlushed()
    expect((outlet.firstElementChild as HTMLElement).dataset.route).toBe('2')

    router1.navigate('/a') // the OLD router's changes no longer drive the outlet
    await whenFlushed()
    expect((outlet.firstElementChild as HTMLElement).dataset.route).toBe('2')
  })

  it('an outlet disconnected mid-async discards the late resolution (belt-and-suspenders token bump)', async () => {
    let resolveSlow: (el: Element) => void = () => {}
    const routes: RouteRecord[] = [
      {
        path: '/a',
        component: () =>
          new Promise<Element>((resolve) => {
            resolveSlow = resolve
          }),
      },
    ]
    const router = createRouter(routes, { initial: '/a' })
    const outlet = mountThenAssign(router)
    await whenFlushed()
    outlet.remove() // disconnect while the factory promise is still pending

    resolveSlow(document.createElement('div'))
    await Promise.resolve()
    await Promise.resolve()
    expect(outlet.children.length).toBe(0) // never swapped onto the dead host
  })
})

describe('ui-router-outlet — descriptor (ADR-0004, LLD-C7)', () => {
  const DIR = `${process.cwd()}/packages/agent-ui/router/src/controls/router-outlet`
  const md = readFileSync(`${DIR}/router-outlet.md`, 'utf8') as string
  const ts = readFileSync(`${DIR}/router-outlet.ts`, 'utf8') as string
  const { fence, body } = splitFrontmatter(md)
  const parsed = parseDescriptor(fence)

  it('has a leading frontmatter fence and a prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body).toContain('# ui-router-outlet')
  })

  it('carries the ADR-0004 descriptor field set as top-level keys, and is schema-valid', () => {
    const required = ['tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots', 'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors']
    for (const field of required) expect(parsed.topLevelKeys.has(field), field).toBe(true)
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })

  it('tag=ui-router-outlet, extends=UIElement, tier=layout, formAssociated=false', () => {
    expect(/^tag:\s*ui-router-outlet\s*$/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIElement\b/m.test(fence)).toBe(true)
    expect(/^tier:\s*layout\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*false/.test(fence)).toBe(true)
  })

  it('contract↔props: attributes[] is empty and matches the live (empty) props — zero drift', () => {
    expect(parsed.attributes).toEqual([])
    expect(compareDescriptorToProps(parsed.attributes, UIRouterOutletElement.props)).toEqual([])
  })

  it('contract↔source: no customStates/styled slots — the descriptor tells the truth', () => {
    expect(scalarSeq(parsed, 'customStates')).toEqual([])
    expect(compareDescriptorToSource(parsed, { ts, css: '' })).toEqual([])
    expect([...collectUsedStates(ts, '')]).toEqual([])
    expect([...collectStyledSlots('')]).toEqual([])
  })

  it('negative control: an undocumented used state fails the source-wire', () => {
    const syntheticTs = ts + "\nthis.internals.states?.add('ready') // synthetic — not real source"
    expect(compareDescriptorToSource(parsed, { ts: syntheticTs, css: '' })).toContainEqual(
      expect.objectContaining({ code: 'STATE_UNDOCUMENTED', path: 'customStates.ready' }),
    )
  })
})
