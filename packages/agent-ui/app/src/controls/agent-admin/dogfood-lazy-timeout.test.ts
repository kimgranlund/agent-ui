// dogfood-lazy-timeout.test.ts — GH #354: the LOAD CEILING (`DOGFOOD_LOAD_TIMEOUT_MS`, the ADR-0139 cl.5
// value reused). A chunk request that never settles — a captive-portal Wi-Fi, a hung proxy — must not park
// a genui turn forever behind a live bubble; at the ceiling the turn proceeds assets-less, exactly as a
// rejected load does (Kim's 2026-07-29 degrade ruling).
//
// Why real timers cannot test this, and why the leg is worth its own file:
//   • a MOCKED `import()` always wins the microtask race against a 10s `setTimeout`, so with real timers the
//     ceiling is unreachable — dropping the constant to 0 changes no outcome. `setTimeout`/`clearTimeout`
//     are therefore faked (the narrowest `toFake` set that reaches it) and advanced past the REAL constant.
//   • a factory that never settles leaves the module PENDING in vitest's own registry, and a later
//     `import()` of the same specifier reuses that pending promise rather than re-invoking the factory — so
//     no later leg in the same file could ever load the module again. One file, one hung load.
import { describe, it, expect, vi, afterEach, beforeAll, afterAll } from 'vitest'
import { whenFlushed } from '@agent-ui/components'

const dogfood = vi.hoisted(() => ({ loads: 0 }))

vi.mock('@agent-ui/components/dogfood-frame', async () => {
  dogfood.loads += 1
  await new Promise<never>(() => {}) // never settles
  return { DOGFOOD_CSS: '', DOGFOOD_JS: '', DOGFOOD_TAGS: [] as string[] }
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

interface Frame extends HTMLElement {
  assets: { css?: string; js?: string }
}

describe('lazy dogfood assets — the load ceiling (GH #354)', () => {
  it('a load that never settles is bounded: at the ceiling the turn PROCEEDS assets-less and says why', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
      el.store = createMemoryStore({})
      el.store.set('surfaceGenui', true)
      el.store.set('surfaceGenuiDogfood', true)
      const seen: unknown[] = []
      el.agentSurfaceTurn = async function* (req) {
        // Deep snapshot — the request is mutated (degraded) before it is issued; see the sibling
        // dogfood-lazy-failure.test.ts for why a live reference would make the assertion aliasable.
        seen.push(JSON.parse(JSON.stringify(req)) as unknown)
        yield { kind: 'genui' as const, surfaceId: 'ceiling-1', html: '<ui-button>Save</ui-button>' }
        yield { kind: 'note' as const, note: 'here is your form' }
      }
      document.body.append(el)
      mounted.push(el)
      await whenFlushed()

      const composer = el.querySelector('ui-conversation-composer') as HTMLElement & { value: string }
      composer.value = 'make a form'
      const editor = composer.querySelector('[data-part="editor"]') as HTMLElement
      editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))

      // Reaching the (mocked) import takes an unspecified number of module-runner ticks; advance ZERO fake
      // time repeatedly so microtasks drain without moving the clock toward the ceiling.
      for (let i = 0; i < 50 && dogfood.loads === 0; i += 1) await vi.advanceTimersByTimeAsync(0)
      expect(dogfood.loads, 'the ON path reached the import').toBe(1)
      expect(seen.length, 'parked on the load — the agent request has not been issued yet').toBe(0)

      // Just under the ceiling: still parked, so the wait below is genuinely the ceiling's doing.
      await vi.advanceTimersByTimeAsync(9_000)
      expect(seen.length, 'below the ceiling the turn is still waiting').toBe(0)
      expect(el.querySelector('ui-sandbox-frame')).toBeNull()

      // Past it: the load is abandoned and the turn runs.
      await vi.advanceTimersByTimeAsync(1_500)
      expect(seen.length, 'at the ceiling the turn PROCEEDS — not failed, not hung').toBe(1)
      // …and it proceeds as a REAL dogfood-OFF turn: the prompt degrades with the assets, so the model is
      // never taught `<ui-*>` markup for a frame that has no component definitions to render it.
      expect((seen[0] as { genui?: { dogfood?: boolean } }).genui?.dogfood, 'the timed-out turn requests dogfood:false').toBe(false)
      const frame = el.querySelector('ui-sandbox-frame') as Frame
      expect(frame, 'the frame still mounted').not.toBeNull()
      expect(frame.assets.css, 'assets-less, exactly like a dogfood-OFF mount').toBeUndefined()
      expect(frame.assets.js).toBeUndefined()
      const log = el.querySelector('[data-part="log"]')?.textContent ?? ''
      expect(log, "the agent's own note is NOT lost to the warning").toContain('here is your form')
      expect(log, 'the user is told why the frame is bare').toContain('timed out')
      expect(log).toContain('⚠')
    } finally {
      vi.useRealTimers()
    }
  })
})
