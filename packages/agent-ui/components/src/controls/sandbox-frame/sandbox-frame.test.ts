import { describe, it, expect } from 'vitest'
import { whenFlushed } from '../../reactive/index.ts'
import { UISandboxFrameElement, canEstablishPosture } from './sandbox-frame.ts'

// sandbox-frame.test.ts — genui-surface.spec.md jsdom leg: props/defaults, the SPEC-R3 AC2 literal
// sandbox-attribute assertion, the SPEC-R5 never-paint triggers this control's OWN test can drive in
// jsdom (oversize html, malformed CSP), the replace-reuses-the-same-node shape, and the droppedMessages
// counter's foreign-source leg. The REAL containment/out-of-vocabulary/theme-flip/lifecycle probes are
// cross-engine-only (sandbox-frame.browser.test.ts) — jsdom does not navigate a sandboxed srcdoc iframe.

const mount = (): UISandboxFrameElement => {
  const el = document.createElement('ui-sandbox-frame') as UISandboxFrameElement
  document.body.append(el)
  return el
}

const SMALL_DOC = '<!DOCTYPE html><html><body><p>hi</p></body></html>'

describe('ui-sandbox-frame — defaults', () => {
  it('defaults surfaceId/html to empty string and csp to {}', () => {
    const el = mount()
    expect(el.surfaceId).toBe('')
    expect(el.html).toBe('')
    expect(el.csp).toEqual({})
    el.remove()
  })

  it('droppedMessages starts at 0', () => {
    const el = mount()
    expect(el.droppedMessages).toBe(0)
    el.remove()
  })
})

describe('ui-sandbox-frame — bare construction renders the fail-closed fallback, never an iframe (SPEC-R5)', () => {
  it('an unconfigured instance shows [data-part="fallback"] and no [data-part="frame"]', async () => {
    const el = mount()
    await whenFlushed()
    expect(el.querySelector('[data-part="fallback"]')).toBeTruthy()
    expect(el.querySelector('[data-part="frame"]')).toBeNull()
    el.remove()
  })
})

describe('ui-sandbox-frame — a valid envelope renders the iframe with the exact sandbox token set (SPEC-R3 AC2)', () => {
  it('sandbox="allow-scripts" EXACTLY — a literal assertion; the fallback is gone', async () => {
    const el = mount()
    el.html = SMALL_DOC
    await whenFlushed()
    const iframe = el.querySelector('[data-part="frame"]') as HTMLIFrameElement
    expect(iframe).toBeTruthy()
    expect(iframe.getAttribute('sandbox')).toBe('allow-scripts')
    expect(el.querySelector('[data-part="fallback"]')).toBeNull()
    el.remove()
  })

  it('the composed srcdoc carries the CSP meta and the bootstrap script', async () => {
    const el = mount()
    el.html = SMALL_DOC
    await whenFlushed()
    const iframe = el.querySelector('[data-part="frame"]') as HTMLIFrameElement
    expect(iframe.srcdoc).toContain('Content-Security-Policy')
    expect(iframe.srcdoc).toContain('window.genui')
    el.remove()
  })
})

describe('ui-sandbox-frame — SPEC-R5 never-paint triggers (jsdom-testable legs)', () => {
  it('an oversize html (> 512 KiB) never renders an iframe — the fallback shows instead', async () => {
    const el = mount()
    el.html = `<!DOCTYPE html><html><body>${'x'.repeat(524_288 + 1)}</body></html>`
    await whenFlushed()
    expect(el.querySelector('[data-part="frame"]')).toBeNull()
    expect(el.querySelector('[data-part="fallback"]')).toBeTruthy()
    el.remove()
  })

  it('exactly the byte cap IS accepted (boundary)', async () => {
    const el = mount()
    const filler = 'x'.repeat(524_288 - '<!DOCTYPE html><html><body></body></html>'.length)
    el.html = `<!DOCTYPE html><html><body>${filler}</body></html>`
    await whenFlushed()
    expect(el.querySelector('[data-part="frame"]')).toBeTruthy()
    el.remove()
  })

  it('a malformed CSP config (an http: entry) never renders — the fallback shows instead (CSP build failure)', async () => {
    const el = mount()
    el.csp = { resourceDomains: ['http://insecure.example.com'] }
    el.html = SMALL_DOC
    await whenFlushed()
    expect(el.querySelector('[data-part="frame"]')).toBeNull()
    expect(el.querySelector('[data-part="fallback"]')).toBeTruthy()
    el.remove()
  })

  it('clearing html back to empty tears down a live frame and returns to the fallback', async () => {
    const el = mount()
    el.html = SMALL_DOC
    await whenFlushed()
    expect(el.querySelector('[data-part="frame"]')).toBeTruthy()
    el.html = ''
    await whenFlushed()
    expect(el.querySelector('[data-part="frame"]')).toBeNull()
    expect(el.querySelector('[data-part="fallback"]')).toBeTruthy()
    el.remove()
  })
})

describe('ui-sandbox-frame — replace reuses the SAME iframe node (SPEC-R5 "Replace")', () => {
  it('a second valid envelope for the same instance keeps the same DOM node, new srcdoc', async () => {
    const el = mount()
    el.html = SMALL_DOC
    await whenFlushed()
    const first = el.querySelector('[data-part="frame"]') as HTMLIFrameElement
    el.html = '<!DOCTYPE html><html><body><p>updated</p></body></html>'
    await whenFlushed()
    const second = el.querySelector('[data-part="frame"]') as HTMLIFrameElement
    expect(second).toBe(first) // node identity — the atomic REPLACE reuses the element
    expect(second.srcdoc).toContain('updated')
    el.remove()
  })
})

describe('ui-sandbox-frame — droppedMessages (the foreign-source leg; jsdom-safe)', () => {
  it('a message from a source other than this instance\'s own iframe is dropped + counted, never throws', async () => {
    const el = mount()
    el.html = SMALL_DOC
    await whenFlushed()
    const before = el.droppedMessages
    const fakeSource = {} as WindowProxy
    expect(() =>
      window.dispatchEvent(new MessageEvent('message', { data: { type: 'action', name: 'x' }, source: fakeSource })),
    ).not.toThrow()
    expect(el.droppedMessages).toBe(before + 1)
    el.remove()
  })

  it('a well-formed vocabulary member from a foreign source is STILL dropped (identity check precedes the vocabulary check)', async () => {
    const el = mount()
    el.html = SMALL_DOC
    await whenFlushed()
    const before = el.droppedMessages
    const fakeSource = {} as WindowProxy
    window.dispatchEvent(new MessageEvent('message', { data: { type: 'initialize' }, source: fakeSource }))
    expect(el.droppedMessages).toBe(before + 1)
    el.remove()
  })
})

describe('canEstablishPosture — the SPEC-R3/R5 posture predicate (a posture-unavailable stub)', () => {
  it('a real iframe element establishes posture (jsdom included — it implements srcdoc)', () => {
    expect(canEstablishPosture(document.createElement('iframe'))).toBe(true)
  })

  it('a stub missing "srcdoc" cannot establish posture (the never-paint trigger, SPEC-R5 AC2)', () => {
    expect(canEstablishPosture({})).toBe(false)
  })

  it('a stub carrying "srcdoc" CAN establish posture', () => {
    expect(canEstablishPosture({ srcdoc: '' })).toBe(true)
  })
})
