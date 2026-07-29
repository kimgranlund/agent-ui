// dogfood-lazy-failure.test.ts — GH #354: the failure half of the lazy dogfood seam. A static import cannot
// fail; a dynamic one can (an evicted/unreachable chunk, an offline reload). Two claims made in
// `loadDogfoodAssets()`'s own comment are proven here rather than asserted:
//
//   1. a failed load FAILS THE TURN VISIBLY through the existing `handle.fail` path — never a silently
//      assets-less mount (which would look like the dogfood toggle quietly doing nothing) and never a turn
//      that hangs with a live bubble;
//   2. the failure is NOT memoized — the next turn retries. A memoized rejected promise would leave dogfood
//      permanently broken for the rest of the page's life after one transient chunk error.
//
// Own file because the mock must reject on the FIRST load, which is the load every other lazy-dogfood test
// needs to succeed (the memo is module-scoped, one per page).
import { describe, it, expect, vi, afterEach, beforeAll, afterAll } from 'vitest'
import { whenFlushed } from '@agent-ui/components'

const dogfood = vi.hoisted(() => ({ loads: 0, failNext: true, css: '/* stub css */', js: '/* stub js */' }))

vi.mock('@agent-ui/components/dogfood-frame', async () => {
  dogfood.loads += 1
  if (dogfood.failNext) throw new Error('simulated dogfood chunk load failure')
  return { DOGFOOD_CSS: dogfood.css, DOGFOOD_JS: dogfood.js, DOGFOOD_TAGS: [] as string[] }
})

import { UIAgentAdminElement } from './agent-admin.ts'
import { createMemoryStore } from '../settings/memory-store.ts'

// jsdom reality (the agent-admin.test.ts precedent, verbatim).
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

describe('lazy dogfood assets — load failure (GH #354)', () => {
  it('a failed chunk load fails the turn VISIBLY, and the next turn retries (no poisoned memo)', async () => {
    const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
    el.store = createMemoryStore({})
    el.store.set('surfaceGenui', true)
    el.store.set('surfaceGenuiDogfood', true)
    const seen: unknown[] = []
    el.agentSurfaceTurn = async function* (req) {
      seen.push(req)
      yield { kind: 'genui' as const, surfaceId: 'fail-1', html: '<ui-button>Save</ui-button>' }
      yield { kind: 'note' as const, note: 'ok' }
    }
    document.body.append(el)
    mounted.push(el)
    await whenFlushed()

    // Turn 1 — the load rejects. The visible shape is `handle.fail`'s own: a "Turn failed — …" narration
    // entry plus a "⚠ …" system bubble (conversation.ts). Asserted on that SHAPE rather than on the thrown
    // message, because vitest replaces a mock-factory error's text with its own module-mocking advice — the
    // reason string is the runtime's, the visibility is the contract.
    const logText = (): string => el.querySelector('[data-part="log"]')?.textContent ?? ''
    composerSubmit(el, 'make a form')
    await waitFor('the failed turn surfaced', () => logText().includes('Turn failed'))
    expect(dogfood.loads, 'the ON path attempted the load').toBe(1)
    expect(seen.length, 'the stream never started — the turn failed before its first event').toBe(0)
    expect(el.querySelector('ui-sandbox-frame'), 'no half-built, silently assets-less frame').toBeNull()
    expect(logText(), 'the failure reaches the user as a system bubble too, not only the narration strip').toContain('⚠')

    // Turn 2 — a transient failure must not be sticky: the loader retries and this time succeeds.
    dogfood.failNext = false
    composerSubmit(el, 'try again')
    await waitFor('the retried turn mounted its frame', () => el.querySelector('ui-sandbox-frame') !== null)
    expect(dogfood.loads, 'the rejected promise was dropped from the memo — turn 2 really re-imported').toBe(2)
    const frame = el.querySelector('ui-sandbox-frame') as HTMLElement & { assets: { css?: string; js?: string } }
    expect(frame.assets.css).toBe(dogfood.css)
    expect(frame.assets.js).toBe(dogfood.js)
  })
})
