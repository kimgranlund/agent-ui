import { describe, it, expect } from 'vitest'
import type { AgentTransport, TurnInput } from '@agent-ui/a2ui/agent/agent-transport'
import { proxyTransport } from './proxy.ts'
import type { ProxyFetch, ProxyResponseLike, ProxyTurnBody } from './proxy.ts'

// n2b's accept row (SPEC-R4): the request body carries the caller's TurnInput verbatim (AC1); a 3-line
// NDJSON body split across ARBITRARY chunk boundaries yields exactly 3 lines (AC1); a non-2xx response
// throws carrying the proxy's {error} text (AC2). The no-key/no-adapter/no-produce grep gate is
// layering.test.ts's (AC3).

const input: TurnInput = {
  kind: 'intent',
  text: 'make me a form',
  session: { turns: [{ role: 'user', content: 'earlier' }] },
  provider: 'anthropic',
  model: 'claude-x',
}

function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c))
      controller.close()
    },
  })
}

function okResponse(chunks: string[]): ProxyResponseLike {
  return { ok: true, status: 200, body: streamOf(chunks), text: () => Promise.resolve(chunks.join('')) }
}

async function collect(transport: AgentTransport): Promise<string[]> {
  const out: string[] = []
  for await (const line of transport.turn(input)) out.push(line)
  return out
}

describe('proxyTransport (SPEC-R4)', () => {
  // SPEC-R2 AC1's type-level half: the factory's return type IS AgentTransport.
  const _seam: AgentTransport = proxyTransport({ url: '/__a2ui/agent' })
  void _seam

  it('POSTs the pinned body to the mount — the TurnInput verbatim plus the top-level pair (AC1)', async () => {
    let seenUrl = ''
    let seenInit: { method: string; headers: Record<string, string>; body: string } | undefined
    const fetchStub: ProxyFetch = (url, init) => {
      seenUrl = url
      seenInit = init
      return Promise.resolve(okResponse(['{"a":1}\n']))
    }
    await collect(proxyTransport({ url: '/__a2ui/agent', fetch: fetchStub }))
    expect(seenUrl).toBe('/__a2ui/agent')
    expect(seenInit?.method).toBe('POST')
    expect(seenInit?.headers['content-type']).toBe('application/json')
    const body = JSON.parse(seenInit?.body ?? '{}') as ProxyTurnBody
    expect(body.input).toEqual(input) // verbatim — the whole session rides along
    expect(body.provider).toBe('anthropic') // falls back to the input's own selection
    expect(body.model).toBe('claude-x')
  })

  it('explicit opts.provider/opts.model override the input selection in the pinned body', async () => {
    let raw = ''
    const fetchStub: ProxyFetch = (_url, init) => {
      raw = init.body
      return Promise.resolve(okResponse([]))
    }
    await collect(proxyTransport({ url: '/x', fetch: fetchStub, provider: 'openai', model: 'gpt-y' }))
    const body = JSON.parse(raw) as ProxyTurnBody
    expect(body.provider).toBe('openai')
    expect(body.model).toBe('gpt-y')
  })

  it('a 3-line NDJSON body split at arbitrary byte boundaries yields exactly 3 lines (AC1)', async () => {
    const lines = ['{"version":"v0.9","one":1}', '{"version":"v0.9","two":2}', '{"version":"v0.9","three":3}']
    const wire = lines.join('\n') + '\n'
    // Boundary torture: mid-line, mid-delimiter, single-byte tail — plus the whole-body single chunk.
    const splits: string[][] = [
      [wire],
      [wire.slice(0, 7), wire.slice(7, 8), wire.slice(8, 40), wire.slice(40)],
      [...wire].map((ch) => ch), // one chunk per character
      [wire.slice(0, 27), wire.slice(27, 28), wire.slice(28)], // split exactly AT the first newline
    ]
    for (const chunks of splits) {
      const fetchStub: ProxyFetch = () => Promise.resolve(okResponse(chunks))
      const got = await collect(proxyTransport({ url: '/x', fetch: fetchStub }))
      expect(got).toEqual(lines)
    }
  })

  it('a body WITHOUT a trailing newline still yields its final line', async () => {
    const fetchStub: ProxyFetch = () => Promise.resolve(okResponse(['{"a":1}\n{"b"', ':2}']))
    const got = await collect(proxyTransport({ url: '/x', fetch: fetchStub }))
    expect(got).toEqual(['{"a":1}', '{"b":2}'])
  })

  it('a non-2xx response throws carrying the proxy\'s {error} text (AC2)', async () => {
    const fetchStub: ProxyFetch = () =>
      Promise.resolve({ ok: false, status: 400, body: null, text: () => Promise.resolve('{"error":"unknown-pair"}') })
    await expect(collect(proxyTransport({ url: '/x', fetch: fetchStub }))).rejects.toThrow('unknown-pair')
  })

  it('a non-2xx response with a non-JSON body throws the status fallback — never a JSON crash', async () => {
    const fetchStub: ProxyFetch = () =>
      Promise.resolve({ ok: false, status: 503, body: null, text: () => Promise.resolve('Service Unavailable') })
    await expect(collect(proxyTransport({ url: '/x', fetch: fetchStub }))).rejects.toThrow('proxy error (status 503)')
  })

  it('a body-less ok response falls back to text() line-splitting', async () => {
    const fetchStub: ProxyFetch = () =>
      Promise.resolve({ ok: true, status: 200, body: null, text: () => Promise.resolve('{"a":1}\n{"b":2}\n') })
    const got = await collect(proxyTransport({ url: '/x', fetch: fetchStub }))
    expect(got).toEqual(['{"a":1}', '{"b":2}'])
  })
})
