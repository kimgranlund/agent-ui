// feed-live-transport.test.ts — LLD-C10: the live feed transport's progressive-paint + fail-closed legs.
// `fetch` is stubbed (no real network, no key) — the module under test is the ONLY thing exercised; the
// frame protocol itself is proven separately (`frames.test.ts`).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { probeFeedLive, sendTurn } from './feed-live-transport.ts'
import { framesOf } from '../../packages/agent-ui/a2a/tools/feed/frames.ts'
import type { A2aMessage } from '@agent-ui/a2a'

function streamOfLines(lines: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  let i = 0
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < lines.length) {
        controller.enqueue(encoder.encode(lines[i] + '\n'))
        i += 1
      } else {
        controller.close()
      }
    },
  })
}

const AGENT_TURN: A2aMessage = {
  kind: 'message',
  role: 'agent',
  messageId: 'live-a1',
  contextId: 'live-ctx',
  parts: [
    { kind: 'text', text: 'Here you go.' },
    { kind: 'data', data: { version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'agent-ui' } }, metadata: { mimeType: 'application/a2ui+json' } },
  ],
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('probeFeedLive', () => {
  it('reports availability from the proxy status endpoint', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ available: true, providers: 1 }), { status: 200 })))
    const status = await probeFeedLive()
    expect(status).toEqual({ available: true, providers: 1 })
  })

  it('reports unavailable on any fetch failure (no proxy mounted — the static build)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('network error'))))
    const status = await probeFeedLive()
    expect(status).toEqual({ available: false, providers: 0 })
  })

  it('reports unavailable on a non-2xx response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })))
    const status = await probeFeedLive()
    expect(status).toEqual({ available: false, providers: 0 })
  })
})

describe('sendTurn — progressive paint + reassembly', () => {
  it('yields each part as it arrives, then returns the fully reassembled message', async () => {
    const lines = framesOf(AGENT_TURN)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(streamOfLines(lines), { status: 200, headers: { 'content-type': 'application/x-ndjson' } })),
    )
    const gen = sendTurn(['header', 'u1'], { provider: 'anthropic', model: 'claude-sonnet-5' })
    const parts: unknown[] = []
    let result = await gen.next()
    while (!result.done) {
      parts.push(result.value.part)
      result = await gen.next()
    }
    expect(parts).toEqual(AGENT_TURN.parts)
    expect(result.value).toEqual(AGENT_TURN)
  })

  it('a non-2xx response throws (never yields a partial)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'no-key' }), { status: 503 })))
    const gen = sendTurn(['header', 'u1'], { provider: 'anthropic', model: 'claude-sonnet-5' })
    await expect(gen.next()).rejects.toThrow(/no-key/)
  })

  it('a truncated frame stream (fewer parts than declared) throws at completion — fail-closed', async () => {
    const lines = framesOf(AGENT_TURN).slice(0, -1) // drop the last part frame — a clean-looking truncation
    vi.stubGlobal('fetch', vi.fn(async () => new Response(streamOfLines(lines), { status: 200 })))
    const gen = sendTurn(['header', 'u1'], { provider: 'anthropic', model: 'claude-sonnet-5' })
    const collected: unknown[] = []
    await expect(
      (async () => {
        for await (const { part } of gen) collected.push(part)
      })(),
    ).rejects.toThrow(/expected 2 part\(s\), received 1/)
    expect(collected).toHaveLength(1) // the ONE part that did arrive was still yielded progressively
  })
})
