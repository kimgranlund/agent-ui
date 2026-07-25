// gen-ui-live.live-picker-wiring.test.ts — proves gen-ui-live.ts's own `wireLiveOverlay()` picker wiring
// reaches the REAL live-proxy POST body end to end, not just that it type-checks. Two things this page
// added on top of a2ui-live.ts's own precedent (a2ui-live.effort-wiring.test.ts):
//
//  1. Effort — wired IDENTICALLY to a2ui-live.ts (GH #270/#271 closed the server-side gap that used to
//     block it here); this file's own Effort suite mirrors that one's assertions almost verbatim, proving
//     the SAME mechanism landed on this page too.
//  2. The Model-roster upgrade — a flat, provider-grouped Models picker (`groupedModelOptions()`,
//     provider-mode-selection.ts) REPLACING a2ui-live.ts's own two-step Provider→Model flow. This page
//     never sets `composer.providers`/`provider` at all; `providerIdForModel()` recovers the provider a
//     committed model belongs to. `provider-mode-selection.test.ts` already proves the derivation/grouping
//     DATA SHAPE in isolation; this file proves the DOM half — the grouped list actually renders in the
//     real composer, a disabled ("coming soon") provider's row can't be committed, and selecting a REAL,
//     enabled model reaches the live POST body with the CORRECT {provider, model} pair.
//
// `fetch` is stubbed (the a2ui-live.effort-wiring.test.ts precedent) so `wireLiveOverlay()`'s real
// `/status` probe resolves "available" in jsdom, then its picker registrations + `createLiveProxyTransport`
// construction run for real; the POST stub returns an immediately-closed ndjson stream (gen-ui-live.ts's
// own `runTurn` already handles a zero-line turn gracefully).
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

function composerEl(): HTMLElement & { effort?: string; model?: string } {
  return document.querySelector('.chat-composer') as HTMLElement & { effort?: string; model?: string }
}

function sendMessage(text: string): void {
  const editor = composerEl().querySelector('[data-part="editor"]') as HTMLElement
  editor.textContent = text
  editor.dispatchEvent(new Event('input', { bubbles: true }))
  const sendBtn = composerEl().querySelector('[data-part="send"]') as HTMLElement
  sendBtn.click()
}

beforeAll(async () => {
  localStorage.clear() // a fresh restore ⇒ the catalog defaults, not a leftover value from another test file
  stubFetch()
  // A DEFERRED (dynamic) import — the a2ui-live.effort-wiring.test.ts precedent: `wireLiveOverlay()` fires
  // as a module-scope side effect of import, so the fetch stub above must land BEFORE this import runs.
  await import('./gen-ui-live.ts')
  await waitUntil(() => (composerEl() as unknown as { efforts?: unknown }).efforts !== undefined)
})

afterEach(() => {
  capturedPostBody = undefined
})

describe('gen-ui-live.ts — Effort picker reaches the real live-proxy POST body (GH #270/#271 unblocked it here too)', () => {
  it('wires the composer with the fleet EFFORT_LEVELS and the persisted default ("medium")', () => {
    expect(composerEl().effort).toBe('medium')
    const trigger = composerEl().querySelector('[data-picker="effort"]') as HTMLElement
    expect(trigger.textContent).toBe('Medium')
  })

  it('committing a picker choice through the REAL DOM path updates the live selection, and the NEXT turn\'s POST body carries it', async () => {
    const menu = composerEl().querySelector('[data-part="effort-menu"]') as HTMLElement
    const item = menu.querySelector('[data-value="high"]') as HTMLElement
    item.dispatchEvent(new Event('click', { bubbles: true }))
    expect(composerEl().effort).toBe('high')

    sendMessage('hello')
    await waitUntil(() => capturedPostBody !== undefined)
    expect(capturedPostBody?.effort).toBe('high')
    expect(capturedPostBody?.genui).toEqual({ enabled: true, exclusive: true }) // this page's own always-on GenUI bit, untouched by the Effort wiring
    // Drain the turn fully (busy → false, TKT-0034's in-flight guard) before the next describe block's own
    // `sendMessage` call — otherwise a still-in-flight turn's `if (this.busy) return` would silently no-op it.
    await waitUntil(() => !composerEl().hasAttribute('busy'))
  })
})

describe('gen-ui-live.ts — the Model picker is a FLAT, provider-grouped list (the Model-roster upgrade), not a two-step Provider→Model flow', () => {
  it('never exposes a Provider picker at all — the grouped Models list IS the provider axis now', () => {
    const providersTrigger = composerEl().querySelector('[data-picker="providers"]')
    expect(providersTrigger).toBeNull()
  })

  it('the Models menu contains a disabled, non-committable header row per provider, each followed by its own model rows', () => {
    const panel = composerEl().querySelector('[data-part="models-menu"] [data-part="panel"]') as HTMLElement
    const rows = [...panel.children] as HTMLElement[]
    const anthropicHeader = rows.find((r) => r.dataset.value === '__group-anthropic')!
    expect(anthropicHeader.getAttribute('aria-disabled')).toBe('true')
    expect(anthropicHeader.textContent).toBe('Anthropic')
    const sonnetIndex = rows.findIndex((r) => r.dataset.value === 'claude-sonnet-5')
    expect(sonnetIndex).toBeGreaterThan(rows.indexOf(anthropicHeader)) // the model row sits BENEATH its provider's header
    expect(rows[sonnetIndex]!.hasAttribute('aria-disabled')).toBe(false) // anthropic IS implemented — its rows are genuinely selectable

    const openaiHeader = rows.find((r) => r.dataset.value === '__group-openai')!
    expect(openaiHeader.getAttribute('aria-disabled')).toBe('true')
    expect(openaiHeader.textContent).toBe('OpenAI — coming soon')
    const gpt = rows.find((r) => r.dataset.value === 'gpt-4.1')!
    expect(gpt.getAttribute('aria-disabled')).toBe('true') // "coming soon" — visible, never committable
  })

  it('a "coming soon" provider\'s model row cannot actually be committed — clicking it changes nothing (ui-menu\'s own aria-disabled skip)', () => {
    const before = composerEl().model
    const panel = composerEl().querySelector('[data-part="models-menu"] [data-part="panel"]') as HTMLElement
    const gptRow = [...panel.children].find((r) => (r as HTMLElement).dataset.value === 'gpt-4.1') as HTMLElement
    gptRow.dispatchEvent(new Event('click', { bubbles: true }))
    expect(composerEl().model).toBe(before) // unchanged — the disabled row never fired `select`
  })

  it('selecting a DIFFERENT, enabled model through the REAL DOM path updates the live selection, and the NEXT turn\'s POST body carries the correct {provider, model} pair', async () => {
    const panel = composerEl().querySelector('[data-part="models-menu"] [data-part="panel"]') as HTMLElement
    const haikuRow = [...panel.children].find((r) => (r as HTMLElement).dataset.value === 'claude-haiku-4-5-20251001') as HTMLElement
    haikuRow.dispatchEvent(new Event('click', { bubbles: true }))
    expect(composerEl().model).toBe('claude-haiku-4-5-20251001')

    sendMessage('hello again')
    await waitUntil(() => capturedPostBody !== undefined)
    expect(capturedPostBody?.model).toBe('claude-haiku-4-5-20251001')
    expect(capturedPostBody?.provider).toBe('anthropic') // providerIdForModel() recovered it — no Provider picker exists to supply it directly
  })
})
