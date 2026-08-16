import { describe, it, expect, vi, afterEach } from 'vitest'
import { UIElement } from '../dom/index.ts'
import { scrollSpy } from './scroll-spy.ts'

// jsdom implements no IntersectionObserver at all (unlike ResizeObserver, which scroll-fade.ts's own test
// stubs with real geometry — this API has no jsdom equivalent whatsoever), so the DECISION logic (which
// heading is "active" given a set of reported intersection states) is proven here against a CONTROLLABLE
// fake that captures every real constructor call + `observe()` target and lets a test fire callbacks by
// hand. The real IntersectionObserver wiring (does a heading crossing the actual viewport band fire it) is
// the docs-site TOC recipe's own `.browser.test.ts` leg (site/pages/toc-content.browser.test.ts).

interface FakeEntry {
  target: Element
  isIntersecting: boolean
}
type FakeCallback = (entries: FakeEntry[]) => void

class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = []
  readonly targets = new Set<Element>()
  disconnected = false
  readonly callback: FakeCallback
  readonly init: { root: Element | null; rootMargin: string; threshold: number }
  constructor(callback: FakeCallback, init: { root: Element | null; rootMargin: string; threshold: number }) {
    this.callback = callback
    this.init = init
    FakeIntersectionObserver.instances.push(this)
  }
  observe(target: Element): void {
    this.targets.add(target)
  }
  disconnect(): void {
    this.disconnected = true
  }
  /** Test helper — simulate the browser reporting a crossing for `target`. */
  fire(target: Element, isIntersecting: boolean): void {
    this.callback([{ target, isIntersecting }])
  }
}

function heading(id: string, top: number): HTMLElement {
  const el = document.createElement('h2')
  el.id = id
  el.getBoundingClientRect = () =>
    ({ top, bottom: top + 20, left: 0, right: 0, width: 0, height: 20, x: 0, y: top, toJSON: () => '' }) as DOMRect
  return el
}

class ScrollSpyHost extends UIElement {
  releaseFn: (() => void) | null = null
  opts: Parameters<typeof scrollSpy>[1] | null = null
  protected connected(): void {
    if (this.opts) this.releaseFn = scrollSpy(this, this.opts)
  }
}
customElements.define('ui-scroll-spy-probe', ScrollSpyHost)

describe('scrollSpy — heading-activation decision (jsdom, a controllable fake IntersectionObserver)', () => {
  afterEach(() => {
    FakeIntersectionObserver.instances.length = 0
    // @ts-expect-error - test-only global cleanup, restoring the ambient (undefined-in-jsdom) binding.
    delete globalThis.IntersectionObserver
  })

  it('observes every heading and reports the LAST intersecting one (document order = topmost crossed)', () => {
    // @ts-expect-error - installing the fake for this test only.
    globalThis.IntersectionObserver = FakeIntersectionObserver
    const h1 = heading('one', 0)
    const h2 = heading('two', 0)
    const h3 = heading('three', 0)
    const onActiveChange = vi.fn()
    const el = new ScrollSpyHost()
    el.opts = { headings: [h1, h2, h3], onActiveChange }
    document.body.append(el)

    const observer = FakeIntersectionObserver.instances[0]!
    expect([...observer.targets]).toEqual([h1, h2, h3])

    observer.fire(h1, true)
    expect(onActiveChange).toHaveBeenLastCalledWith('one')

    // h2 also crosses while h1 is still intersecting — h2 (later in document order) wins.
    observer.fire(h2, true)
    expect(onActiveChange).toHaveBeenLastCalledWith('two')

    el.remove()
  })

  it('never re-reports the SAME active id twice (no redundant onActiveChange calls)', () => {
    // @ts-expect-error - installing the fake for this test only.
    globalThis.IntersectionObserver = FakeIntersectionObserver
    const h1 = heading('one', 0)
    const onActiveChange = vi.fn()
    const el = new ScrollSpyHost()
    el.opts = { headings: [h1], onActiveChange }
    document.body.append(el)

    const observer = FakeIntersectionObserver.instances[0]!
    observer.fire(h1, true)
    observer.fire(h1, true) // same state reported again — should not re-fire
    expect(onActiveChange).toHaveBeenCalledTimes(1)
    el.remove()
  })

  it('falls back to the nearest already-passed heading when nothing currently intersects', () => {
    // @ts-expect-error - installing the fake for this test only.
    globalThis.IntersectionObserver = FakeIntersectionObserver
    const h1 = heading('one', -300) // scrolled well past
    const h2 = heading('two', -50) // scrolled past, closer to the band
    const h3 = heading('three', 400) // still below the fold
    const onActiveChange = vi.fn()
    const el = new ScrollSpyHost()
    el.opts = { headings: [h1, h2, h3], onActiveChange }
    document.body.append(el)

    const observer = FakeIntersectionObserver.instances[0]!
    // None of them are reported intersecting (a real band gap between crossings) — the fallback picks h2
    // (top -50, the closest already-passed heading).
    observer.fire(h1, false)
    observer.fire(h2, false)
    observer.fire(h3, false)
    expect(onActiveChange).toHaveBeenLastCalledWith('two')
    el.remove()
  })

  it('reports null when NOTHING has been passed yet (above the first heading)', () => {
    // @ts-expect-error - installing the fake for this test only.
    globalThis.IntersectionObserver = FakeIntersectionObserver
    const h1 = heading('one', 300) // still below the fold
    const onActiveChange = vi.fn()
    const el = new ScrollSpyHost()
    el.opts = { headings: [h1], onActiveChange }
    document.body.append(el)

    const observer = FakeIntersectionObserver.instances[0]!
    observer.fire(h1, false)
    expect(onActiveChange).toHaveBeenLastCalledWith(null)
    el.remove()
  })

  it('disconnects the observer on host disconnect (no leaked observation)', () => {
    // @ts-expect-error - installing the fake for this test only.
    globalThis.IntersectionObserver = FakeIntersectionObserver
    const h1 = heading('one', 0)
    const el = new ScrollSpyHost()
    el.opts = { headings: [h1], onActiveChange: vi.fn() }
    document.body.append(el)
    const observer = FakeIntersectionObserver.instances[0]!
    expect(observer.disconnected).toBe(false)
    el.remove()
    expect(observer.disconnected).toBe(true)
  })

  it('the `enabled` gate: false suppresses observation and reports null once', () => {
    // @ts-expect-error - installing the fake for this test only.
    globalThis.IntersectionObserver = FakeIntersectionObserver
    const h1 = heading('one', 0)
    const onActiveChange = vi.fn()
    const el = new ScrollSpyHost()
    el.opts = { headings: [h1], onActiveChange, enabled: () => false }
    document.body.append(el)
    expect(FakeIntersectionObserver.instances.length, 'disabled — no observer should ever be created').toBe(0)
    expect(onActiveChange).toHaveBeenCalledWith(null)
    el.remove()
  })

  it('feature-detection: no IntersectionObserver global (jsdom default) never throws', () => {
    expect(typeof IntersectionObserver, 'jsdom implements no IntersectionObserver of its own').toBe('undefined')
    const h1 = heading('one', 0)
    const el = new ScrollSpyHost()
    el.opts = { headings: [h1], onActiveChange: vi.fn() }
    expect(() => document.body.append(el)).not.toThrow()
    el.remove()
  })

  it('early release() is idempotent and disconnects the observer', () => {
    // @ts-expect-error - installing the fake for this test only.
    globalThis.IntersectionObserver = FakeIntersectionObserver
    const h1 = heading('one', 0)
    const el = new ScrollSpyHost()
    el.opts = { headings: [h1], onActiveChange: vi.fn() }
    document.body.append(el)
    const observer = FakeIntersectionObserver.instances[0]!
    el.releaseFn?.()
    el.releaseFn?.() // idempotent — second call is a no-op, never throws
    expect(observer.disconnected).toBe(true)
    el.remove()
  })
})
