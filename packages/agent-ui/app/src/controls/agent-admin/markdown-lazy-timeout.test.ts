// markdown-lazy-timeout.test.ts — GH #468: the LOAD CEILING (`MARKDOWN_LOAD_TIMEOUT_MS`, the ADR-0139
// cl.5 / dogfood value reused verbatim), the SAME leg dogfood-lazy-timeout.test.ts proves for GH #354. A
// chunk request that never settles (a captive-portal Wi-Fi, a hung proxy) must not leave anything waiting
// forever or leak an unhandled rejection when the ceiling finally fires. Unlike dogfood's ceiling — which
// bounds a DELAY ahead of an AWAITED async turn, so crossing it has an observable effect (the turn
// proceeds) — markdown's render path never awaits the load at all: every render along the way already
// degrades to the SAME plain-text fallback, timed-out or merely slow, so crossing the ceiling has no
// externally observable effect from THIS test's vantage point beyond "nothing broke, nothing hung, nothing
// unhandled". That narrower claim is exactly what this file proves.
//
// What this file deliberately does NOT attempt: proving a LATER preload re-imports after the ceiling fires
// (markdown-lazy-failure.test.ts already proves that leg for a REJECTED load). A factory that never
// settles leaves the module PENDING in vitest's own module registry for the rest of the file — a later
// `import()` of the same specifier reuses that pending promise rather than re-invoking the factory, so no
// later leg here could ever observe a second load (the dogfood-lazy-timeout.test.ts precedent's own
// documented limitation, verbatim — "one file, one hung load").
import { describe, it, expect, vi, afterEach, beforeAll, afterAll } from 'vitest'
import { whenFlushed } from '@agent-ui/components'

const markdown = vi.hoisted(() => ({ loads: 0 }))

vi.mock('@agent-ui/code/markdown', async () => {
  markdown.loads += 1
  await new Promise<never>(() => {}) // never settles
  return {}
})

import { UIAgentAdminElement } from './agent-admin.ts'
import { createMemoryStore } from '../settings/memory-store.ts'

// jsdom reality (the agent-admin.test.ts / dogfood-lazy*.test.ts precedent, verbatim).
let realAttachInternals: typeof HTMLElement.prototype.attachInternals
beforeAll(() => {
  realAttachInternals = HTMLElement.prototype.attachInternals
  HTMLElement.prototype.attachInternals = function (this: HTMLElement): ElementInternals {
    const internals = realAttachInternals.call(this) as unknown as Record<string, unknown>
    if (typeof internals.setFormValue !== 'function') internals.setFormValue = () => {}
    if (typeof internals.setValidity !== 'function') internals.setValidity = () => {}
    return internals as unknown as ElementInternals
  }
})
afterAll(() => {
  HTMLElement.prototype.attachInternals = realAttachInternals
})

const mounted: Element[] = []
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
  localStorage.clear()
})

const composerSubmit = (el: UIAgentAdminElement, text: string): void => {
  const composer = el.querySelector('ui-conversation-composer') as HTMLElement & { value: string }
  composer.value = text
  const editor = composer.querySelector('[data-part="editor"]') as HTMLElement
  editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
}

const lastAgentBody = (el: UIAgentAdminElement): HTMLElement => {
  const bodies = el.querySelectorAll('[data-part="bubble"][data-role="agent"] [data-part="body"]')
  return bodies[bodies.length - 1] as HTMLElement
}

describe('lazy markdown renderer — the load ceiling (GH #468)', () => {
  it('a preload that never settles is bounded and leaks no unhandled rejection: renders keep degrading to plain text, past the ceiling and beyond', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
      el.store = createMemoryStore({}) // markdown ON by default — connect fires the (hung) preload immediately
      document.body.append(el)
      mounted.push(el)
      await whenFlushed()

      // Reaching the (mocked) import takes an unspecified number of module-runner ticks; advance ZERO fake
      // time repeatedly so microtasks drain without moving the clock toward the ceiling (the
      // dogfood-lazy-timeout.test.ts precedent, verbatim).
      for (let i = 0; i < 50 && markdown.loads === 0; i += 1) await vi.advanceTimersByTimeAsync(0)
      expect(markdown.loads, 'connect-time preload reached the import').toBe(1)
      expect(customElements.get('ui-markdown'), 'still unresolved').toBeUndefined()

      composerSubmit(el, 'below the ceiling')
      await vi.advanceTimersByTimeAsync(0)
      expect(lastAgentBody(el).querySelector('ui-markdown'), 'no ui-markdown while the load is outstanding').toBeNull()
      expect(lastAgentBody(el).textContent!.length, 'plain text is the degrade').toBeGreaterThan(0)

      // Just under the ceiling: still hung, so crossing it below is genuinely the ceiling's doing.
      await vi.advanceTimersByTimeAsync(9_000)
      expect(customElements.get('ui-markdown'), 'still unresolved below the ceiling').toBeUndefined()

      // Past it: `loadMarkdownRenderer`'s own internal timeout promise rejects and its `.catch` drops the
      // memo — swallowed by `preloadMarkdownRenderer`'s own `.catch(() => {})`, so crossing this boundary
      // must not throw, hang the test runner, or leave an unhandled rejection (vitest would fail this test
      // if one leaked — nothing further to assert beyond the `await` itself completing).
      await vi.advanceTimersByTimeAsync(1_500)

      // A render well past the ceiling still degrades cleanly — nothing wedged, nothing crashed.
      composerSubmit(el, 'well past the ceiling')
      await vi.advanceTimersByTimeAsync(0)
      const body = lastAgentBody(el)
      expect(body.querySelector('ui-markdown'), 'still no ui-markdown — the load never actually resolved').toBeNull()
      expect(body.textContent!.length, 'plain text, still — the degrade holds indefinitely, not just up to the ceiling').toBeGreaterThan(0)
    } finally {
      vi.useRealTimers()
    }
  })
})
