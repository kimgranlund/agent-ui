// markdown-lazy-failure.test.ts — GH #468: the DEGRADE half of the lazy markdown seam, the SAME shape
// dogfood-lazy-failure.test.ts proves for GH #354/ADR-0139 cl.5. A static import cannot fail; a dynamic one
// can (a stale hashed chunk after a deploy, an offline reload, a dead network). The renderer's own law is
// DEGRADE, never fail: a failed load leaves the SAME plain-text fallback the OFF state already returns —
// never a thrown render, never a stuck bubble.
//
// Two claims, neither assertable by reading the code:
//   1. REJECTION — a load that throws degrades: the render falls back to plain text and the turn completes
//      normally (nothing upstream of `#renderBody` ever sees an error).
//   2. RETRY — the failure is not memoized (`loadMarkdownRenderer`'s own `.catch` clears it), so the NEXT
//      preload call (a later rewire, a later toggle) loads for real and subsequent renders use it. A
//      memoized rejection would leave Markdown mode permanently degraded after one transient chunk error.
//
// Both run in ONE file, in this order, on purpose: the memo is module-scoped (one per page) and is cleared
// only by a FAILED load, so leg 1 hands leg 2 a fresh slate and leg 2 proves it (the dogfood-lazy-failure.
// test.ts precedent, verbatim rationale). The third failure mode — a load that never settles — needs its
// own file (markdown-lazy-timeout.test.ts) for the SAME reason dogfood's does: a pending factory parks the
// module in vitest's own registry where no later leg could ever reload it.
import { describe, it, expect, vi, afterEach, beforeAll, afterAll } from 'vitest'
import { whenFlushed } from '@agent-ui/components'

const markdown = vi.hoisted(() => ({ loads: 0, mode: 'throw' as 'throw' | 'resolve' }))

class FakeMarkdownElement extends HTMLElement {
  markdown = ''
}

vi.mock('@agent-ui/code/markdown', async () => {
  markdown.loads += 1
  if (markdown.mode === 'throw') throw new Error('simulated markdown chunk load failure')
  if (!customElements.get('ui-markdown')) customElements.define('ui-markdown', FakeMarkdownElement)
  return { UIMarkdownElement: FakeMarkdownElement }
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

const waitFor = async (label: string, predicate: () => boolean): Promise<void> => {
  for (let i = 0; i < 200; i += 1) {
    if (predicate()) return
    await new Promise((r) => setTimeout(r, 5))
    await whenFlushed()
  }
  throw new Error(`waitFor timed out: ${label}`)
}

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

const mountAdmin = async (): Promise<UIAgentAdminElement> => {
  const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
  el.store = createMemoryStore({}) // markdown ON by default — connect fires the preload immediately
  document.body.append(el)
  mounted.push(el)
  await whenFlushed()
  return el
}

describe('lazy markdown renderer — a failed load DEGRADES (GH #468)', () => {
  it('a load that REJECTS degrades — the render falls back to plain text, the turn completes normally', async () => {
    const el = await mountAdmin()
    await waitFor('the (throwing) preload was reached', () => markdown.loads === 1)
    // Give the rejected preload's own microtask chain a turn to settle (it is swallowed by
    // `preloadMarkdownRenderer`'s `.catch(() => {})` — nothing here awaits it directly).
    await whenFlushed()
    await new Promise((r) => setTimeout(r, 0))

    composerSubmit(el, 'hello')
    await whenFlushed()
    const body = lastAgentBody(el)
    expect(body.querySelector('ui-markdown'), 'a rejected load must never half-render').toBeNull()
    expect(body.textContent!.length, 'plain text is the degrade, never an empty bubble').toBeGreaterThan(0)
    expect(customElements.get('ui-markdown'), 'the tag never became defined').toBeUndefined()
  })

  it('a LATER preload RETRIES and succeeds — no poisoned memo (a store rewire re-arms it)', async () => {
    const el = await mountAdmin()
    await waitFor('at least one (throwing) attempt was reached', () => markdown.loads >= 1)
    // The connect-time preload rejects almost immediately (no artificial delay in this mock), and — since
    // a rejected load is dropped from the memo by design — the FIRST turn's own render-path fallback (leg
    // 1, above) can legitimately trigger a second throwing attempt before this leg even starts; the exact
    // count is not the contract here (leg 1 already pins "never half-renders" precisely). What matters is
    // that it stays UNRESOLVED the whole time mode stays 'throw'.
    await whenFlushed()
    await new Promise((r) => setTimeout(r, 0))
    await whenFlushed()
    expect(customElements.get('ui-markdown'), 'still undefined — nothing has succeeded yet').toBeUndefined()
    const attemptsBeforeRetry = markdown.loads

    markdown.mode = 'resolve'
    // A real store reassignment re-runs `#applyMasterStates` (the connected() effect's rewire path) —
    // markdown is ON on the new store too, so this alone re-arms the preload; no turn needed to prove it.
    const next = createMemoryStore({})
    el.store = next
    await whenFlushed()
    await waitFor('the retried load resolved', () => customElements.get('ui-markdown') !== undefined)
    expect(markdown.loads, 'the rewire caused a FRESH attempt — the prior rejection(s) were dropped from the memo, not poisoning it').toBeGreaterThan(
      attemptsBeforeRetry,
    )

    composerSubmit(el, 'hello again')
    await whenFlushed()
    const rendered = lastAgentBody(el).querySelector('ui-markdown') as (HTMLElement & { markdown: string }) | null
    expect(rendered, 'a healthy retry renders through the real element').not.toBeNull()
    expect(rendered!.markdown.length).toBeGreaterThan(0)
  })
})
