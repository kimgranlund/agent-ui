// gen-ui-live.live-failure.test.ts — GH #408. What a LIVE turn says when it fails or produces nothing.
//
// The harness is `gen-ui-live.live-picker-wiring.test.ts`'s, verbatim in shape (its own banner explains the
// stubbed `fetch` + deferred import): `/status` resolves "available" in jsdom, so `wireLiveOverlay()`'s real
// probe → `createLiveProxyTransport` swap runs for real and the page genuinely runs on the LIVE backbone —
// never a hand-set flag. The POST stub then answers with REAL ndjson bytes, so the terminal error line
// travels the whole path a dev-proxy failure takes: `formatErrorLine` shape → `readNdjsonLines` →
// `readMetaLine` → this page's consume loop. `gen-ui-live.test.ts`'s own recorded-backbone suite keeps the
// other half honest (its "no further turns" test runs the REAL recorded transport, unchanged by this fix).
//
// Why a separate file rather than a describe block in either sibling: the fetch stub + the deferred page
// import are module-scope, once-per-file setup, and the page module is a singleton per test file — the
// recorded suite's harness (`gen-ui-live.test.ts`, no stub at all) and this one are mutually exclusive by
// construction. Same per-concern file split a2ui-live already carries (ask-lifecycle / effort-wiring / …).
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

// jsdom reality (the agent-admin.test.ts precedent, GH #316/ADR-0162 — this page composes a real `ui-switch`
// FACE form control unconditionally at module load, the dogfood options-strip toggle): jsdom's
// `ElementInternals` carries no real `setFormValue`/`setValidity`. Stubbed for this file's duration so the
// switch can connect without an uncaught teardown exception, despite every assertion passing.
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

/** The lines the NEXT live POST answers with — set per test, streamed as real ndjson bytes. */
let nextTurnLines: string[] = []

function ndjsonResponse(lines: string[]): Response {
  const bytes = new TextEncoder().encode(lines.map((l) => `${l}\n`).join(''))
  return new Response(
    new ReadableStream<Uint8Array>({
      start: (c) => {
        if (bytes.length > 0) c.enqueue(bytes)
        c.close()
      },
    }),
    { status: 200, headers: { 'content-type': 'application/x-ndjson' } },
  )
}

function stubFetch(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/status')) {
        return new Response(JSON.stringify({ available: true, providers: 1 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }
      return ndjsonResponse(nextTurnLines)
    }),
  )
}

async function waitUntil(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
  const start = Date.now()
  for (;;) {
    if (predicate()) return
    if (Date.now() - start > timeoutMs) throw new Error('waitUntil: condition never became true within the timeout')
    await new Promise((r) => setTimeout(r, 0))
  }
}

function chatMessages(role: 'user' | 'agent' | 'system'): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('.chat-log .msg')].filter((m) => m.dataset.role === role)
}

function lastNarrationStrip(): HTMLElement | null {
  const strips = document.querySelectorAll<HTMLElement>('.chat-log .narration-strip')
  return strips.length > 0 ? strips[strips.length - 1]! : null
}

function sendMessage(text: string): void {
  const editor = document.querySelector('.chat-composer [data-part="editor"]') as HTMLElement
  editor.textContent = text
  editor.dispatchEvent(new Event('input', { bubbles: true }))
  const sendBtn = document.querySelector('.chat-composer [data-part="send"]') as HTMLElement
  sendBtn.click()
}

function clickReset(): void {
  const resetBtn = [...document.querySelectorAll<HTMLElement>('ui-button')].find((b) => b.textContent?.trim() === 'Reset')
  resetBtn?.click()
}

/** The live swap has landed once the render pane's "Recorded demo" badge is GONE — `wireLiveOverlay()`'s own
 *  `setDemoBadge(undefined)`, on the same branch that adopts the live transport. Reset restores the badge and
 *  re-probes, so every test waits this out before sending (the gen-ui-live.test.ts precedent, inverted). */
async function waitForLiveBackbone(): Promise<void> {
  await waitUntil(() => document.querySelector('.render-pane .demo-badge') === null)
}

beforeAll(async () => {
  localStorage.clear()
  stubFetch()
  // A DEFERRED (dynamic) import — the live-picker-wiring precedent: `wireLiveOverlay()` fires as a
  // module-scope side effect of import, so the fetch stub above must land BEFORE this import runs.
  await import('./gen-ui-live.ts')
  await waitForLiveBackbone()
})

beforeEach(async () => {
  nextTurnLines = []
  clickReset()
  await waitForLiveBackbone() // Reset restarts recorded first, then re-probes — assert only once live is back
})

// GH #408 — a dev proxy whose stream headers already committed 200 reports a `ProduceHalt`/upstream fault as
// ONE terminal `{"a2uiMeta":{"error":…}}` line (`formatErrorLine`, meta-line.ts). It PARSES cleanly, so this
// page's `if (meta) … continue` used to drop it with zero telemetry: the stream then ended normally (nothing
// throws client-side, so the catch block never ran), the turn held zero genui lines, and the page printed the
// RECORDED transcript's exhaustion message over a live failure — with a green-reading narration strip.
describe('gen-ui-live — a terminal transport error on the LIVE backbone is visible (GH #408)', () => {
  const HALT = 'Live agent failed: exhausted 3 self-correct rounds without a valid surface.'

  it("shows the transport's own reason as a ⚠ system message and fails the narration — never the recorded-transcript message", async () => {
    nextTurnLines = [JSON.stringify({ a2uiMeta: { error: HALT } })] // `formatErrorLine`'s exact wire shape

    sendMessage('build me a blackjack table')
    await waitUntil(() => chatMessages('system').some((m) => m.textContent?.includes('⚠')))

    expect(chatMessages('system').some((m) => m.textContent?.includes(HALT)), "the transport's own reason, shown verbatim").toBe(true)
    await waitUntil(() => (lastNarrationStrip()?.querySelector('[data-part="header"]')?.getAttribute('data-status') ?? '') === 'error')
    expect(
      lastNarrationStrip()!.querySelector('[data-key="progress-error"] [data-role="label"]')?.textContent,
      'the same visible error entry a client-thrown turn gets — never a green-reading strip over a failed turn',
    ).toContain('Turn failed')
    expect(chatMessages('system').some((m) => /no further turns|recorded transcript/i.test(m.textContent ?? '')), 'the misdiagnosis this issue is about').toBe(false)
  })

  it('a turn that streamed real progress before halting still fails — the error line ends it, whatever came first', async () => {
    nextTurnLines = [
      JSON.stringify({ a2uiMeta: { progress: { stage: 'sent' } } }),
      JSON.stringify({ a2uiMeta: { progress: { stage: 'retry', round: 3 } } }),
      JSON.stringify({ a2uiMeta: { error: HALT } }),
    ]

    sendMessage('blackjack, again')
    await waitUntil(() => (lastNarrationStrip()?.querySelector('[data-part="header"]')?.getAttribute('data-status') ?? '') === 'error')

    expect(chatMessages('system').some((m) => m.textContent?.includes(HALT))).toBe(true)
    expect(chatMessages('system').some((m) => /no further turns|recorded transcript/i.test(m.textContent ?? ''))).toBe(false)
    expect(document.querySelectorAll('.surface-card')).toHaveLength(0) // a halted turn rendered nothing — the empty pane was always real
  })
})

// The OTHER half of GH #408: the exhaustion message is transport-blind no more. The recorded half stays
// proven by `gen-ui-live.test.ts`'s own "no further turns" test, which drives the REAL recorded transcript.
describe('gen-ui-live — an empty LIVE turn never blames a recorded transcript (GH #408)', () => {
  it('a live turn that emitted nothing at all says exactly that', async () => {
    nextTurnLines = [] // a 200 stream that just closes: no content, no note, no error line

    sendMessage('anything')
    await waitUntil(() => chatMessages('system').some((m) => /produced no renderable output/i.test(m.textContent ?? '')))

    expect(chatMessages('system').some((m) => /recorded transcript/i.test(m.textContent ?? '')), 'a live transport has no transcript to exhaust').toBe(false)
  })
})
