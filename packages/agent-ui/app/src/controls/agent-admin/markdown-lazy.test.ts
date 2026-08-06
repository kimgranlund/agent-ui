// markdown-lazy.test.ts — GH #468 (the app-diet hunt), the RUNTIME half of the lazy-markdown proof. The
// bundle half (markdown-lazy.bundle.test.ts) proves `@agent-ui/code/markdown` is not in the app barrel's
// entry chunk; this file proves the runtime shape, mechanically, mirroring the dogfood-lazy*.test.ts triad
// (GH #354) this seam copies — with the ONE necessary difference dogfood didn't have: the render path
// (`conversation.setContentRenderer`) is SYNCHRONOUS, so there is no `await` point to park a turn behind
// the way `loadDogfoodAssets()` parks a genui turn. Markdown mode is instead PRELOADED ahead of need
// (`#applyMasterStates`, fired on connect and on every toggle/rewire), and the render path itself falls
// back to the SAME plain-text node the OFF state already returns whenever the chunk hasn't resolved yet.
//
// Two claims, neither assertable by reading the code:
//   1. Markdown-OFF never triggers the import — the module is never LOADED AT ALL, not merely "unapplied".
//   2. Markdown-ON preloads at CONNECT (ahead of any turn — a render mid-flight degrades to plain text for
//      THAT render only), and once resolved every later render reuses the SAME one-per-page load.
//
// TEST ORDER IS LOAD-BEARING (the dogfood-lazy.test.ts precedent, verbatim reason): the loader memoizes its
// resolved promise at MODULE scope — one fetch per page, by design — so the OFF leg must run before
// anything has loaded the module, and the held-import leg must be the FIRST ON-path load (jsdom's
// `customElements` registry is also GLOBAL per test file and can never be "undefined" once a tag is
// defined, so once ANY leg lets the real load resolve, every later leg sees `ui-markdown` as already
// defined — there is no isolated-per-test registry to reset).
//
// It lives in its OWN file rather than in agent-admin.test.ts because the module mock is per-file, and
// agent-admin.test.ts's own "Markdown ON by default" case deliberately drives the REAL module end to end
// (the integration leg) — mocking it there would weaken that (the same split dogfood-lazy.test.ts's own
// banner names for the SAME reason).
import { describe, it, expect, vi, afterEach, beforeAll, afterAll } from 'vitest'
import { whenFlushed } from '@agent-ui/components'

// The mocked markdown module. `loads` counts real module loads; `hold`, when set, keeps the load in flight
// until released — the controlled in-flight window the "falls back while loading" leg needs. The factory's
// own `customElements.define` mirrors the real module's self-registering side effect (code/markdown's own
// barrel banner) — without it, `customElements.get('ui-markdown')` would never flip and every render would
// stay on the fallback arm forever, proving nothing.
const markdown = vi.hoisted(() => ({
  loads: 0,
  hold: false,
  release: undefined as undefined | (() => void),
}))

class FakeMarkdownElement extends HTMLElement {
  markdown = ''
}

vi.mock('@agent-ui/code/markdown', async () => {
  markdown.loads += 1
  if (markdown.hold) {
    await new Promise<void>((resolve) => {
      markdown.release = resolve
    })
  }
  if (!customElements.get('ui-markdown')) customElements.define('ui-markdown', FakeMarkdownElement)
  return { UIMarkdownElement: FakeMarkdownElement }
})

import { UIAgentAdminElement } from './agent-admin.ts'
import { createMemoryStore } from '../settings/memory-store.ts'
import { SURFACE_MARKDOWN_KEY } from './agent-admin-schema.ts'

// jsdom reality (the agent-admin.test.ts / dogfood-lazy.test.ts precedent, verbatim): jsdom's
// ElementInternals carries no real setFormValue/setValidity, so every composed FACE form control would
// throw on connect.
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

/** Poll a condition across real macrotasks — a dynamic `import()` resolves through vitest's own module
 *  runner, an unspecified number of ticks the first time (the dogfood-lazy.test.ts precedent, verbatim). */
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

const mountAdmin = async (values: Record<string, unknown> = {}): Promise<UIAgentAdminElement> => {
  const el = document.createElement('ui-agent-admin') as UIAgentAdminElement
  el.store = createMemoryStore({})
  for (const [k, v] of Object.entries(values)) el.store!.set(k, v)
  document.body.append(el)
  mounted.push(el)
  await whenFlushed()
  return el
}

describe('lazy markdown renderer (GH #468)', () => {
  it('Markdown-OFF never loads the module — a stub turn renders plain text with zero loads', async () => {
    const el = await mountAdmin({ [SURFACE_MARKDOWN_KEY]: false })
    composerSubmit(el, 'hello')
    await whenFlushed()
    const body = lastAgentBody(el)
    expect(body.querySelector('ui-markdown'), 'OFF never mounts ui-markdown').toBeNull()
    expect(body.textContent!.length, 'the stub reply still rendered, as plain text').toBeGreaterThan(0)
    expect(markdown.loads, 'markdown-OFF must never reach the dynamic import').toBe(0)
  })

  it('Markdown-ON preloads at CONNECT; a render before it resolves degrades to plain text, the next one (after release) is real, one load for the page', async () => {
    markdown.hold = true // hold THIS load open; it is the first ON-path load, so it is the one the memo will keep
    const el = await mountAdmin() // markdown ON by default — connect alone fires the (held) preload
    await waitFor('the held load was reached', () => markdown.loads === 1)
    expect(customElements.get('ui-markdown'), 'still unresolved — held open').toBeUndefined()

    composerSubmit(el, 'while loading')
    await whenFlushed()
    const duringLoad = lastAgentBody(el)
    expect(duringLoad.querySelector('ui-markdown'), 'no ui-markdown yet — the chunk has not resolved').toBeNull()
    expect(duringLoad.textContent!.length, 'plain text is the degrade, never an empty bubble').toBeGreaterThan(0)
    // The render path's own defensive preload call (customElements.get(...) === undefined ⇒
    // preloadMarkdownRenderer()) must NOT fire a SECOND import while one is already in flight — the memo is
    // only ever cleared on failure/timeout, never while merely pending.
    expect(markdown.loads, 'the in-flight promise was reused by the render path, not re-fired').toBe(1)

    markdown.hold = false
    markdown.release?.()
    await waitFor('the held load resolved', () => customElements.get('ui-markdown') !== undefined)

    composerSubmit(el, 'after loading')
    await whenFlushed()
    const afterLoad = lastAgentBody(el).querySelector('ui-markdown') as (HTMLElement & { markdown: string }) | null
    expect(afterLoad, 'the NEXT render, after resolution, uses the real element').not.toBeNull()
    expect(afterLoad!.markdown.length).toBeGreaterThan(0)

    composerSubmit(el, 'once more')
    await whenFlushed()
    expect(lastAgentBody(el).querySelector('ui-markdown'), 'a later render still reuses the resolved element').not.toBeNull()
    expect(markdown.loads, 'one load for the whole page across every render').toBe(1)
  })
})
