// dogfood-lazy.test.ts — GH #354 (Kim's 2026-07-29 ruling), the RUNTIME half of the lazy-dogfood proof.
// The bundle half (dogfood-lazy.bundle.test.ts) proves the fixture is not in the app barrel's entry chunk;
// this file proves the three behavioural requirements of the ruling, mechanically:
//
//   1. dogfood-OFF NEVER triggers the import — not "the assets aren't applied", but the module is never
//      LOADED AT ALL. Proven by counting loads inside a `vi.mock` factory (the factory runs exactly once,
//      on the first real import of the module), so a zero count is direct evidence of a path not taken.
//   2. dogfood-ON still works end to end, on BOTH `routeGenui` arms — a fresh mount and a rebuild-in-place
//      of a known surfaceId (the pass-through M-C S4 leaf 12 established) — and pays the load ONCE per page.
//   3. the RACE: a thread reset (a persona switch) while the chunk is in flight abandons the turn instead of
//      mounting into the torn-down bubble.
//
// It lives in its OWN file rather than in agent-admin.test.ts because the module mock is per-file, and
// agent-admin.test.ts's own dogfood cases deliberately drive the REAL 450 KB fixture end to end (the
// integration leg) — mocking it there would weaken that.
//
// TEST ORDER IS LOAD-BEARING (vitest runs a file's tests in source order; `sequence.shuffle` is off): the
// loader memoizes its resolved promise at MODULE scope — one fetch per page, by design — so the OFF leg must
// run before anything has loaded the module, and the held-import race leg must be the FIRST load. The later
// ON legs then assert the memo (`loads` stays 1), which is itself part of the contract.
import { describe, it, expect, vi, afterEach, beforeAll, afterAll } from 'vitest'
import { whenFlushed } from '@agent-ui/components'

// The mocked dogfood module. `loads` counts real module loads; `hold`, when set, keeps the load in flight
// until released — the controlled in-flight window the race leg needs.
const dogfood = vi.hoisted(() => ({
  loads: 0,
  hold: false,
  release: undefined as undefined | (() => void),
  css: '/* stub dogfood css */',
  js: '/* stub dogfood js */',
}))

vi.mock('@agent-ui/components/dogfood-frame', async () => {
  dogfood.loads += 1
  if (dogfood.hold) {
    await new Promise<void>((resolve) => {
      dogfood.release = resolve
    })
  }
  return { DOGFOOD_CSS: dogfood.css, DOGFOOD_JS: dogfood.js, DOGFOOD_TAGS: [] as string[] }
})

import { UIAgentAdminElement } from './agent-admin.ts'
import { createMemoryStore } from '../settings/memory-store.ts'

// jsdom reality (the agent-admin.test.ts precedent, verbatim): jsdom's ElementInternals carries no real
// setFormValue/setValidity, so every composed FACE form control would throw on connect.
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

/** Drain microtasks AND macrotasks — the deferred-turn settling shape agent-admin.test.ts uses, plus the
 *  lazy import's own await (one extra macrotask hop). */
const settle = async (): Promise<void> => {
  await whenFlushed()
  await new Promise((r) => setTimeout(r, 0))
  await whenFlushed()
  await new Promise((r) => setTimeout(r, 0))
  await whenFlushed()
}

/** Poll a condition across real macrotasks. A dynamic `import()` resolves through vitest's own module
 *  runner, which takes an unspecified number of ticks the first time a module is loaded — so every ON-path
 *  wait here is a CONDITION, never a fixed tick count (an arbitrary count is exactly how a lazy-path test
 *  turns flaky). Times out loudly rather than sliding past a never-satisfied condition. */
const waitFor = async (label: string, predicate: () => boolean): Promise<void> => {
  for (let i = 0; i < 200; i += 1) {
    if (predicate()) return
    await new Promise((r) => setTimeout(r, 5))
    await whenFlushed()
  }
  throw new Error(`waitFor timed out: ${label}`)
}

/** The real composer submit path (agent-admin.test.ts's own helper). */
const composerSubmit = (el: UIAgentAdminElement, text: string): void => {
  const composer = el.querySelector('ui-conversation-composer') as HTMLElement & { value: string }
  composer.value = text
  const editor = composer.querySelector('[data-part="editor"]') as HTMLElement
  editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
}

const mountAdmin = async (values: Record<string, unknown>): Promise<UIAgentAdminElement> => {
  const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
  el.store = createMemoryStore({})
  for (const [k, v] of Object.entries(values)) el.store!.set(k, v)
  document.body.append(el)
  mounted.push(el)
  await whenFlushed()
  return el
}

const frameOf = (el: Element): (HTMLElement & { assets: { css?: string; js?: string }; html: string }) | null =>
  el.querySelector('ui-sandbox-frame') as (HTMLElement & { assets: { css?: string; js?: string }; html: string }) | null

describe('lazy dogfood assets (GH #354)', () => {
  it('dogfood-OFF runs a whole genui turn WITHOUT ever loading the dogfood module', async () => {
    const el = await mountAdmin({ surfaceGenui: true }) // modality on, dogfood sub-toggle off (the default)
    const seen: unknown[] = []
    el.agentSurfaceTurn = async function* (req) {
      seen.push(req)
      yield { kind: 'genui' as const, surfaceId: 'off-1', html: '<p>plain</p>' }
      yield { kind: 'note' as const, note: 'ok' }
    }
    composerSubmit(el, 'draw a chart')
    await settle()

    const frame = frameOf(el)
    expect(frame, 'the OFF path still mounts a frame — only without assets').not.toBeNull()
    expect(frame!.assets.css).toBeUndefined()
    expect(frame!.assets.js).toBeUndefined()
    expect(seen.length, 'anti-vacuous: the turn really ran').toBe(1)
    expect(dogfood.loads, 'dogfood-OFF must never reach the dynamic import').toBe(0)
  })

  it('the RACE — a thread reset while the chunk is in flight abandons the turn (no mount into a torn-down bubble)', async () => {
    dogfood.hold = true // hold THIS load open; it is the first load, so it is the one the memo will keep
    const el = await mountAdmin({ surfaceGenui: true, surfaceGenuiDogfood: true })
    const seen: unknown[] = []
    el.agentSurfaceTurn = async function* (req) {
      seen.push(req)
      yield { kind: 'genui' as const, surfaceId: 'race-1', html: '<ui-button>Save</ui-button>' }
      yield { kind: 'note' as const, note: 'ok' }
    }
    composerSubmit(el, 'make a form')
    await waitFor('the ON path reached the (held) import', () => dogfood.loads === 1)
    expect(seen.length, 'the stream has NOT started — the turn is parked on the asset await').toBe(0)

    // A persona switch: a REAL store reassignment resets the thread (#resetConversationState) mid-flight.
    const next = createMemoryStore({})
    next.set('surfaceGenui', true)
    next.set('surfaceGenuiDogfood', true)
    el.store = next
    await whenFlushed()

    dogfood.hold = false
    dogfood.release?.()
    await settle()

    expect(seen.length, 'the abandoned turn must never start its stream (nothing to mount into)').toBe(0)
    expect(frameOf(el), 'no frame reaches the reset thread').toBeNull()
  })

  it('dogfood-ON mounts the frame with the pair from the LAZY module, reusing the one-per-page load', async () => {
    const el = await mountAdmin({ surfaceGenui: true, surfaceGenuiDogfood: true })
    const seen: unknown[] = []
    el.agentSurfaceTurn = async function* (req) {
      seen.push(req)
      yield { kind: 'genui' as const, surfaceId: 'on-1', html: '<ui-button>Save</ui-button>' }
      yield { kind: 'note' as const, note: 'ok' }
    }
    composerSubmit(el, 'make a form')
    await waitFor('the dogfood frame mounted', () => frameOf(el) !== null)

    const frame = frameOf(el)
    expect(frame).not.toBeNull()
    expect(frame!.assets.css, 'the CSS came from the lazily-imported module').toBe(dogfood.css)
    expect(frame!.assets.js, 'the JS came from the lazily-imported module').toBe(dogfood.js)
    expect((seen[0] as { genui?: { dogfood?: boolean } }).genui?.dogfood).toBe(true)
    expect(dogfood.loads, 'the resolved module is memoized — one load per page, not per turn').toBe(1)
  })

  it('a rebuild-in-place of a KNOWN surfaceId re-applies the pair (the leaf-12 pass-through, second turn)', async () => {
    const el = await mountAdmin({ surfaceGenui: true, surfaceGenuiDogfood: true })
    let html = '<ui-button>First</ui-button>'
    el.agentSurfaceTurn = async function* () {
      yield { kind: 'genui' as const, surfaceId: 'rebuild-1', html }
      yield { kind: 'note' as const, note: 'ok' }
    }
    composerSubmit(el, 'make a form')
    await waitFor('the first mount landed', () => frameOf(el) !== null)
    expect(frameOf(el)!.assets.css).toBe(dogfood.css)

    html = '<ui-button>Second</ui-button>'
    composerSubmit(el, 'change it')
    await waitFor('the rebuild landed', () => frameOf(el)!.html === '<ui-button>Second</ui-button>')
    const frames = el.querySelectorAll('ui-sandbox-frame')
    expect(frames.length, 'a KNOWN surfaceId rebuilds in place — never a second frame').toBe(1)
    const rebuilt = frames[0] as HTMLElement & { assets: { css?: string; js?: string }; html: string }
    expect(rebuilt.html).toBe('<ui-button>Second</ui-button>')
    expect(rebuilt.assets.css, 'the rebuild arm re-applies the pair, never a sticky/stale assets object').toBe(dogfood.css)
    expect(rebuilt.assets.js).toBe(dogfood.js)
    expect(dogfood.loads, 'still one load for the whole page across three turns').toBe(1)
  })
})
