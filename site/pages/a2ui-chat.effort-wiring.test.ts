// a2ui-chat.effort-wiring.test.ts — GH #273: proves a2ui-chat.ts's own Effort picker wiring reaches the
// REAL live-proxy POST body end to end, not just that `wireLiveOverlay()`'s prop/callback wiring type-checks
// — the SAME "trace the whole path" discipline `a2ui-live.effort-wiring.test.ts` already proves for
// a2ui-live.ts's standalone composer. a2ui-chat.ts hosts its composer INSIDE `<ui-conversation>` instead (its
// own `efforts`/`effort`/`onEffortChange` forward straight through to the composed child, conversation.ts's
// `this.effect()`), so this file drives the SAME real DOM commit path scoped through that primitive rather
// than a bare `.chat-composer` class.
//
// `fetch` is stubbed (the `a2ui-live.effort-wiring.test.ts`/`live-proxy-transport.test.ts` precedent) so
// `wireLiveOverlay()`'s real `/status` probe resolves "available" in jsdom, then its `onEffortChange`
// registration + `createLiveProxyTransport` construction run for real; the POST stub returns an
// immediately-closed ndjson stream (a2ui-chat.ts's own `runTurn` already handles a zero-line turn
// gracefully — the "no further turns" status notice — so this never needs a real produced surface).
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

let capturedPostBody: Record<string, unknown> | undefined

function emptyNdjsonResponse(): Response {
  return new Response(new ReadableStream<Uint8Array>({ start: (c) => c.close() }), {
    status: 200,
    headers: { 'content-type': 'application/x-ndjson' },
  })
}

function stubFetch(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/status')) {
        return new Response(JSON.stringify({ available: true, providers: 1 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }
      capturedPostBody = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
      return emptyNdjsonResponse()
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

// The composer lives INSIDE `<ui-conversation>` here (unlike a2ui-live.ts's standalone `.chat-composer`) —
// scoped through it, the `a2ui-chat.test.ts` `sendIntent` precedent.
function composerEl(): HTMLElement & { effort?: string } {
  return document.querySelector('ui-conversation ui-conversation-composer') as HTMLElement & { effort?: string }
}

beforeAll(async () => {
  localStorage.clear() // a fresh restore ⇒ DEFAULT_EFFORT ('medium'), not a leftover value from another file
  // jsdom reality (the `a2ui-chat.test.ts`/`a2ui-live.ask-lifecycle.test.ts` precedent): `ElementInternals`'s
  // `setFormValue`/`setValidity` are ABSENT in jsdom, and this page mounts real form-associated controls.
  if (typeof ElementInternals.prototype.setFormValue !== 'function') {
    ;(ElementInternals.prototype as unknown as Record<string, unknown>).setFormValue = function (): void {}
    ;(ElementInternals.prototype as unknown as Record<string, unknown>).setValidity = function (): void {}
  }
  stubFetch()
  // A DEFERRED (dynamic) import — the `a2ui-live.effort-wiring.test.ts` precedent: `wireLiveOverlay()` fires
  // as a module-scope side effect of import, so the fetch stub above must land BEFORE this import runs, not
  // after (a static top-of-file import would race it).
  await import('./a2ui-chat.ts')
  // `wireLiveOverlay()`'s own probe is a genuine async dynamic-import + fetch round trip — wait for its
  // "available" branch to land (composer.efforts only gets set, via ui-conversation's forwarding effect,
  // on that branch).
  await waitUntil(() => (composerEl() as unknown as { efforts?: unknown }).efforts !== undefined)
})

afterEach(() => {
  capturedPostBody = undefined
})

describe('a2ui-chat.ts — Effort picker reaches the real live-proxy POST body (not just types)', () => {
  it('wires the composer with the fleet EFFORT_LEVELS and the persisted default ("medium")', () => {
    expect(composerEl().effort).toBe('medium')
    const trigger = composerEl().querySelector('[data-picker="effort"]') as HTMLElement
    expect(trigger.textContent).toBe('Medium')
  })

  it('committing a picker choice through the REAL DOM path updates the live selection, and the NEXT turn\'s POST body carries it', async () => {
    const menu = composerEl().querySelector('[data-part="effort-menu"]') as HTMLElement
    const item = menu.querySelector('[data-value="high"]') as HTMLElement
    item.dispatchEvent(new Event('click', { bubbles: true }))
    // Unlike a2ui-live.ts's STANDALONE composer (`composer.effort = id`, a direct synchronous assignment),
    // a2ui-chat.ts's `conv.onEffortChange` sets `conv.effort` — a reactive prop `<ui-conversation>` only
    // forwards down to its composed child through its OWN `this.effect()` (conversation.ts), which flushes
    // asynchronously. Assert through `waitUntil`, not synchronously, or this reads the pre-flush value.
    await waitUntil(() => composerEl().effort === 'high') // conv.onEffortChange's own conv.effort = id, forwarded to the composer

    const editor = composerEl().querySelector('[data-part="editor"]') as HTMLElement
    editor.textContent = 'hello'
    editor.dispatchEvent(new Event('input', { bubbles: true }))
    const sendBtn = composerEl().querySelector('[data-part="send"]') as HTMLElement
    sendBtn.click()

    await waitUntil(() => capturedPostBody !== undefined)
    expect(capturedPostBody?.effort).toBe('high')
    expect(capturedPostBody?.provider).toBe('anthropic')
  })
})
