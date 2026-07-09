import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
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
import { UIRouterLinkElement } from './router-link.ts'
import { createRouter } from '../../core/router.ts'
import { connectUrl } from '../../url.ts'
import type { RouteRecord } from '../../core/types.ts'
declare const process: { cwd(): string }

const routes: RouteRecord[] = [
  { path: '/', component: () => document.createElement('div') },
  { path: '/a', component: () => document.createElement('div') },
  { path: '/b', component: () => document.createElement('div') },
]

const mounted: Element[] = []
afterEach(() => {
  for (const el of mounted.splice(0)) el.remove()
  UIRouterLinkElement.defaultRouter = null
  window.history.replaceState(null, '', '/')
})
beforeEach(() => {
  window.history.replaceState(null, '', '/')
})

function mountLink(to: string, text = 'Link'): UIRouterLinkElement {
  const el = document.createElement('ui-router-link') as UIRouterLinkElement
  el.to = to
  el.textContent = text
  document.body.append(el)
  mounted.push(el)
  return el
}

function stampOf(el: UIRouterLinkElement): HTMLAnchorElement {
  return el.querySelector('a') as HTMLAnchorElement
}

function click(el: Element, opts: Partial<MouseEventInit> = {}): MouseEvent {
  const evt = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...opts })
  el.dispatchEvent(evt)
  return evt
}

describe('ui-router-link — the stamp (SPEC-R6, LLD-C8)', () => {
  it('stamps ONE real <a> and moves the authored light content into it', () => {
    const link = mountLink('/a', 'Go to A')
    const stamp = stampOf(link);
    expect(stamp).not.toBeNull()
    expect(stamp.tagName).toBe('A')
    expect(stamp.textContent).toBe('Go to A')
    expect(link.childNodes.length).toBe(1) // the host holds ONLY the stamp now
  })

  it('href defaults to hash form when no router is attached anywhere (memory-only degradation)', () => {
    const link = mountLink('/a')
    expect(stampOf(link).getAttribute('href')).toBe('#/a')
  })

  it('plain activation intercepts — preventDefault + router.navigate(to, {replace})', () => {
    const router = createRouter(routes, { initial: '/' })
    let navigated: [string, { replace?: boolean } | undefined] | null = null
    router.navigate = ((path: string, opts?: { replace?: boolean }) => {
      navigated = [path, opts]
    }) as typeof router.navigate

    const link = mountLink('/a')
    link.router = router
    link.replace = true

    const evt = click(stampOf(link))
    expect(evt.defaultPrevented).toBe(true)
    expect(navigated).toEqual(['/a', { replace: true }])
  })

  it('AC2: a ctrl/cmd/shift/alt-clicked link is NOT intercepted — no preventDefault, no navigate', () => {
    const router = createRouter(routes, { initial: '/' })
    let navigateCalls = 0
    router.navigate = (() => {
      navigateCalls++
    }) as typeof router.navigate

    const link = mountLink('/a')
    link.router = router

    for (const mod of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }]) {
      const evt = click(stampOf(link), mod)
      expect(evt.defaultPrevented, JSON.stringify(mod)).toBe(false)
    }
    expect(navigateCalls).toBe(0)
  })

  it('no router anywhere — a plain click is NOT intercepted (honest degradation) and warns once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const link = mountLink('/a') // no .router, no defaultRouter
    const evt = click(stampOf(link))
    expect(evt.defaultPrevented).toBe(false)
    expect(warn).toHaveBeenCalledTimes(1)

    click(stampOf(link)) // a second click — the warning fires only once
    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })

  it('AC3: href is hash form when a hash reflection is attached', async () => {
    const router = createRouter(routes, { initial: '/' })
    const cleanup = connectUrl(router) // hash mode default
    await whenFlushed()
    const link = mountLink('/a')
    link.router = router
    await whenFlushed()
    expect(stampOf(link).getAttribute('href')).toBe('#/a')
    cleanup()
  })

  it('AC3: href is a plain path when history reflection is attached', async () => {
    const router = createRouter(routes, { initial: '/' })
    const cleanup = connectUrl(router, { mode: 'history' })
    await whenFlushed()
    const link = mountLink('/a')
    link.router = router
    await whenFlushed()
    expect(stampOf(link).getAttribute('href')).toBe('/a')
    cleanup()
  })

  it('AC4: aria-current="page" is set exactly on the active link (exact match) and cleared on navigate-away', async () => {
    const router = createRouter(routes, { initial: '/a' })
    const linkA = mountLink('/a')
    const linkB = mountLink('/b')
    linkA.router = router
    linkB.router = router
    await whenFlushed()
    expect(stampOf(linkA).getAttribute('aria-current')).toBe('page')
    expect(stampOf(linkB).getAttribute('aria-current')).toBeNull()

    router.navigate('/b')
    await whenFlushed()
    expect(stampOf(linkA).getAttribute('aria-current')).toBeNull()
    expect(stampOf(linkB).getAttribute('aria-current')).toBe('page')
  })

  it('`to` changing while active re-evaluates aria-current', async () => {
    const router = createRouter(routes, { initial: '/a' })
    const link = mountLink('/a')
    link.router = router
    await whenFlushed()
    expect(stampOf(link).getAttribute('aria-current')).toBe('page')

    link.to = '/b'
    await whenFlushed()
    expect(stampOf(link).getAttribute('aria-current')).toBeNull()
  })

  it('a per-instance .router always wins over the class-level defaultRouter', () => {
    const defaultRouter = createRouter(routes, { initial: '/' })
    const instanceRouter = createRouter(routes, { initial: '/' })
    UIRouterLinkElement.defaultRouter = defaultRouter

    let usedInstance = false
    instanceRouter.navigate = (() => {
      usedInstance = true
    }) as typeof instanceRouter.navigate
    defaultRouter.navigate = (() => {
      throw new Error('the default router must not be used when an instance override is set')
    }) as typeof defaultRouter.navigate

    const link = mountLink('/a')
    link.router = instanceRouter
    click(stampOf(link))
    expect(usedInstance).toBe(true)
  })

  it('defaultRouter set AFTER a link connects still works for navigation (read per-activation)', () => {
    const link = mountLink('/a') // connects with NO router at all yet

    const router = createRouter(routes, { initial: '/' })
    let navigated = false
    router.navigate = (() => {
      navigated = true
    }) as typeof router.navigate
    UIRouterLinkElement.defaultRouter = router // wired AFTER connect

    const evt = click(stampOf(link))
    expect(evt.defaultPrevented).toBe(true)
    expect(navigated).toBe(true)
  })

  it('a click whose target is outside the stamp subtree is ignored (nested-interactive-content guard)', () => {
    const router = createRouter(routes, { initial: '/' })
    let navigated = false
    router.navigate = (() => {
      navigated = true
    }) as typeof router.navigate
    const link = mountLink('/a')
    link.router = router

    const stray = document.createElement('span') // not inside the stamp's subtree
    const evt = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
    Object.defineProperty(evt, 'target', { value: stray })
    stampOf(link).dispatchEvent(evt)
    expect(navigated).toBe(false)
    expect(evt.defaultPrevented).toBe(false)
  })
})

describe('ui-router-link — descriptor (ADR-0004, LLD-C8)', () => {
  const DIR = `${process.cwd()}/packages/agent-ui/router/src/controls/router-link`
  const md = readFileSync(`${DIR}/router-link.md`, 'utf8') as string
  const ts = readFileSync(`${DIR}/router-link.ts`, 'utf8') as string
  const css = readFileSync(`${DIR}/router-link.css`, 'utf8') as string
  const { fence, body } = splitFrontmatter(md)
  const parsed = parseDescriptor(fence)
  const ATTR_NAMES = ['to', 'replace']

  it('has a leading frontmatter fence and a prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body).toContain('# ui-router-link')
  })

  it('carries the ADR-0004 descriptor field set as top-level keys, and is schema-valid', () => {
    const required = ['tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots', 'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors']
    for (const field of required) expect(parsed.topLevelKeys.has(field), field).toBe(true)
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES)
    expect(validateComponentDescriptor(parsed)).toEqual([])
  })

  it('tag=ui-router-link, extends=UIElement, tier=display, formAssociated=false', () => {
    expect(/^tag:\s*ui-router-link\s*$/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIElement\b/m.test(fence)).toBe(true)
    expect(/^tier:\s*display\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*false/.test(fence)).toBe(true)
  })

  it('contract↔props: attributes[] is a faithful bijection with UIRouterLinkElement.props — zero drift', () => {
    const drift = compareDescriptorToProps(parsed.attributes, UIRouterLinkElement.props)
    expect(drift).toEqual([])
  })

  it('to is string, default \'\', reflected; replace is boolean, default false, reflected', () => {
    const to = parsed.attributes.find((a) => a.name === 'to')
    expect(to?.type).toBe('string')
    expect(to?.default).toBe('')
    expect(to?.reflect).toBe(true)
    const replace = parsed.attributes.find((a) => a.name === 'replace')
    expect(replace?.type).toBe('boolean')
    expect(replace?.default).toBe('false')
    expect(replace?.reflect).toBe(true)
  })

  it('negative control: a genuinely drifted attribute fails the trip-wire', () => {
    const flipped = parsed.attributes.map((a) => (a.name === 'to' ? { ...a, reflect: false } : { ...a }))
    expect(compareDescriptorToProps(flipped, UIRouterLinkElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_REFLECT', path: 'attributes.to.reflect' }),
    )
  })

  it('contract↔source: no customStates and the one styled slot (the stamp anchor) — the descriptor tells the truth', () => {
    // router-link has no [slot='...'] CSS selector (the light content is MOVED wholesale into the stamp,
    // not slotted by name) and no `.states` usage (aria-current is a real attribute, not a custom state).
    expect(scalarSeq(parsed, 'customStates')).toEqual([])
    expect([...collectUsedStates(ts, css)]).toEqual([])
    expect([...collectStyledSlots(css)]).toEqual([])
    expect(compareDescriptorToSource(parsed, { ts, css })).toEqual([])
  })

  it('negative control: an undocumented used state fails the source-wire', () => {
    const syntheticTs = ts + "\nthis.internals.states?.add('active') // synthetic — not real source"
    expect(compareDescriptorToSource(parsed, { ts: syntheticTs, css })).toContainEqual(
      expect.objectContaining({ code: 'STATE_UNDOCUMENTED', path: 'customStates.active' }),
    )
  })
})
