// dogfood-lazy-failure.test.ts — GH #354: the DEGRADE half of the lazy dogfood seam. A static import cannot
// fail; a dynamic one can (a stale hashed chunk after a deploy, an offline reload, a dead network).
//
// Kim ruled 2026-07-29 — and ADR-0139 cl.5 already rules the same for the lazy CodeMirror precedent this
// seam copies ("load failure … leaves a fully functional plain editor, only the highlighting is lost") —
// that such a failure DEGRADES: the frame mounts assets-less, the turn runs, and the user is told. Failing
// the turn instead would be far worse here than for CM, because the load sits AHEAD of the agent request:
// one bad chunk would stop every genui turn from being ISSUED for anyone with dogfood on.
//
// Two claims, neither assertable by reading the code:
//   1. REJECTION — a load that throws degrades: the frame mounts assets-less, the turn completes, and the
//      reason reaches the user.
//   2. RETRY — the failure is not memoized, so a later turn loads for real and gets the pair. A memoized
//      rejection would leave dogfood dead for the rest of the page's life after one transient chunk error.
//
// Both run in ONE file, in this order, on purpose: the memo is module-scoped (one per page) and is cleared
// only by a FAILED load, so leg 1 hands leg 2 a fresh slate and leg 2 proves it. The third failure mode —
// a load that never settles at all — needs its own file (dogfood-lazy-timeout.test.ts) because a pending
// factory parks the module in vitest's registry where no later leg can reload it.
import { describe, it, expect, vi, afterEach, beforeAll, afterAll } from 'vitest'
import { whenFlushed } from '@agent-ui/components'

const dogfood = vi.hoisted(() => ({
  loads: 0,
  mode: 'throw' as 'throw' | 'resolve',
  css: '/* stub css */',
  js: '/* stub js */',
}))

vi.mock('@agent-ui/components/dogfood-frame', async () => {
  dogfood.loads += 1
  if (dogfood.mode === 'throw') throw new Error('simulated dogfood chunk load failure')
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

interface Frame extends HTMLElement {
  assets: { css?: string; js?: string }
}

const seenByEl = new WeakMap<UIAgentAdminElement, unknown[]>()

const mountDogfoodAdmin = async (): Promise<UIAgentAdminElement> => {
  const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
  el.store = createMemoryStore({})
  el.store.set('surfaceGenui', true)
  el.store.set('surfaceGenuiDogfood', true)
  const seen: unknown[] = []
  seenByEl.set(el, seen)
  el.agentSurfaceTurn = async function* (req) {
    // A DEEP SNAPSHOT, not the live object: the request is mutated before it is issued (the degrade clears
    // `genui.dogfood`), so asserting on the live reference could be satisfied by aliasing after the fact.
    // This pins what the runner — and therefore the system prompt — actually SAW.
    seen.push(JSON.parse(JSON.stringify(req)) as unknown)
    yield { kind: 'genui' as const, surfaceId: 'degrade-1', html: '<ui-button>Save</ui-button>' }
    yield { kind: 'note' as const, note: 'here is your form' }
  }
  document.body.append(el)
  mounted.push(el)
  await whenFlushed()
  return el
}

const logText = (el: Element): string => el.querySelector('[data-part="log"]')?.textContent ?? ''

describe('lazy dogfood assets — a failed load DEGRADES (GH #354)', () => {
  it('a load that REJECTS degrades — the frame mounts assets-less, the turn completes, the reason surfaces', async () => {
    const el = await mountDogfoodAdmin()
    const seen = seenByEl.get(el)!
    composerSubmit(el, 'make a form')
    await waitFor('the degraded turn mounted its frame', () => el.querySelector('ui-sandbox-frame') !== null)
    expect(dogfood.loads, 'the ON path reached the import').toBe(1)
    expect(seen.length, 'the turn ran').toBe(1)
    // The PROMPT degrades with the assets — the whole point of the degrade. Left true, the runner would
    // compose the dogfood teaching + inventory and the model would author `<ui-*>` into a frame that has no
    // component definitions: JS-built controls (calendar/slider/select) would render NOTHING, strictly
    // worse than the plain-HTML turn a dogfood-OFF request asks for.
    expect((seen[0] as { genui?: { dogfood?: boolean } }).genui?.dogfood, 'the request the runner SAW carries dogfood:false').toBe(false)
    const frame = el.querySelector('ui-sandbox-frame') as Frame
    expect(frame.assets.css, 'no half-applied assets').toBeUndefined()
    expect(frame.assets.js).toBeUndefined()
    expect(logText(el)).toContain('here is your form')
    expect(logText(el), 'the failure is user-visible, not swallowed').toContain('⚠')
    expect(logText(el)).toContain('could not be loaded')
  })

  it('a later turn RETRIES and gets the real pair (no poisoned memo)', async () => {
    dogfood.mode = 'resolve'
    const el = await mountDogfoodAdmin()
    composerSubmit(el, 'make a form')
    await waitFor('the retried turn mounted its frame', () => el.querySelector('ui-sandbox-frame') !== null)
    expect(dogfood.loads, 'the rejected promise was dropped from the memo — this turn re-imported').toBe(2)
    const frame = el.querySelector('ui-sandbox-frame') as Frame
    expect(frame.assets.css).toBe(dogfood.css)
    expect(frame.assets.js).toBe(dogfood.js)
    expect(
      (seenByEl.get(el)![0] as { genui?: { dogfood?: boolean } }).genui?.dogfood,
      'a HEALTHY turn keeps dogfood:true — the degrade clears it only on the failing turn, never permanently',
    ).toBe(true)
    expect(logText(el), 'a healthy turn carries no warning').not.toContain('⚠')
  })
})
