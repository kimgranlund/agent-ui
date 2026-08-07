// client.test.ts — LLD-C2's gate (SPEC-R24 AC1/AC2, LLD §6): a scripted `fetchImpl` fake, never a
// listening server — deterministic, no external network, no real timer waits. `scriptedFetch` records
// every {url, headers, body} and answers with canned `Response` objects in call order; `jsonResponse`/
// `sseResponse` make the framing duality first-class per the LLD's own builder names.
import { describe, it, expect } from 'vitest'
import { createMcpClient, MCP_PROTOCOL_VERSION, ACCEPTED_PROTOCOL_VERSIONS, McpClientError, type McpToolInfo } from './client.ts'

const ENDPOINT = 'https://fake.example/mcp'
const INIT_RESULT = { protocolVersion: MCP_PROTOCOL_VERSION, serverInfo: { name: 'fake-server', version: '0.0.0' } }

interface RecordedCall {
  url: string
  headers: Headers
  body: { jsonrpc: string; id?: number; method: string; params?: unknown }
}

/** A scripted fetch: each element answers the Nth outbound POST, in order. A function element can read
 *  the just-recorded call (e.g. to echo its request `id` back into an SSE response's matching frame). */
function scriptedFetch(steps: Array<Response | ((call: RecordedCall) => Response)>): { fetchImpl: typeof fetch; calls: RecordedCall[] } {
  const calls: RecordedCall[] = []
  let index = 0
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const text = typeof init?.body === 'string' ? init.body : '{}'
    const body = JSON.parse(text) as RecordedCall['body']
    const headers = init?.headers instanceof Headers ? init.headers : new Headers(init?.headers as HeadersInit | undefined)
    const call: RecordedCall = { url: String(input), headers, body }
    calls.push(call)
    const step = steps[index++]
    if (step === undefined) throw new Error(`scriptedFetch: no step scripted for call #${index} (${body.method})`)
    return typeof step === 'function' ? step(call) : step
  }) as typeof fetch
  return { fetchImpl, calls }
}

function jsonResponse(result: unknown, opts: { headers?: Record<string, string>; status?: number } = {}): Response {
  return new Response(JSON.stringify({ jsonrpc: '2.0', id: 0, result }), {
    status: opts.status ?? 200,
    headers: { 'content-type': 'application/json', ...opts.headers },
  })
}

function sseResponse(messages: unknown[], opts: { headers?: Record<string, string>; status?: number } = {}): Response {
  const body = messages.map((m) => `data: ${JSON.stringify(m)}\n\n`).join('')
  return new Response(body, {
    status: opts.status ?? 200,
    headers: { 'content-type': 'text/event-stream', ...opts.headers },
  })
}

/** initialize() + the notifications/initialized notification, no session id assigned. A FRESH pair
 *  every call — a `Response` body stream can only be read once, and this factory is spread into many
 *  independent tests. */
function handshakeSteps(): Response[] {
  return [jsonResponse(INIT_RESULT), new Response(null, { status: 202 })]
}

async function reject(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => {
      throw new Error('expected the promise to reject')
    },
    (error: unknown) => error,
  )
}

describe('constants — the F2/F4 freeze (SPEC-R24)', () => {
  it('pins the handshake version and the F4-widened three-member acceptance set', () => {
    expect(MCP_PROTOCOL_VERSION).toBe('2025-06-18')
    expect(ACCEPTED_PROTOCOL_VERSIONS).toEqual(['2025-06-18', '2025-03-26', '2025-11-25'])
  })
})

describe('initialize() — handshake, session capture, header echo (SPEC-R24 AC1)', () => {
  it('sends the pinned protocolVersion and echoes a captured Mcp-Session-Id on every later request', async () => {
    const { fetchImpl, calls } = scriptedFetch([
      jsonResponse(INIT_RESULT, { headers: { 'Mcp-Session-Id': 'sess-123' } }),
      new Response(null, { status: 202 }),
      jsonResponse({ tools: [] }),
    ])
    const client = createMcpClient({ endpoint: ENDPOINT, fetchImpl })

    const outcome = await client.initialize()
    expect(outcome).toEqual({ ok: true, protocolVersion: MCP_PROTOCOL_VERSION, sessionId: 'sess-123' })
    await client.listTools()

    expect(calls[0]!.body).toMatchObject({ method: 'initialize', params: { protocolVersion: MCP_PROTOCOL_VERSION } })
    expect(calls[0]!.headers.get('Mcp-Session-Id')).toBeNull() // never sent on the handshake call itself
    expect(calls[2]!.headers.get('MCP-Protocol-Version')).toBe(MCP_PROTOCOL_VERSION)
    expect(calls[2]!.headers.get('Mcp-Session-Id')).toBe('sess-123')
  })

  it('omits Mcp-Session-Id on later requests when the server assigns none', async () => {
    const { fetchImpl, calls } = scriptedFetch([...handshakeSteps(), jsonResponse({ tools: [] })])
    const client = createMcpClient({ endpoint: ENDPOINT, fetchImpl })

    const outcome = await client.initialize()
    expect(outcome).toEqual({ ok: true, protocolVersion: MCP_PROTOCOL_VERSION })
    await client.listTools()

    expect(calls[2]!.headers.has('Mcp-Session-Id')).toBe(false)
    expect(calls[2]!.headers.get('MCP-Protocol-Version')).toBe(MCP_PROTOCOL_VERSION)
  })

  it('a server negotiating an unaccepted version is a discriminated skip, never a throw — tools/list is never dialed', async () => {
    const { fetchImpl, calls } = scriptedFetch([jsonResponse({ protocolVersion: '2024-11-05' })])
    const client = createMcpClient({ endpoint: ENDPOINT, fetchImpl })

    const outcome = await client.initialize()
    expect(outcome).toEqual({ ok: false, reason: 'unsupported-version', negotiated: '2024-11-05' })
    expect(calls).toHaveLength(1) // no notifications/initialized fired
  })

  it('every request carries Content-Type application/json and the dual Accept header', async () => {
    const { fetchImpl, calls } = scriptedFetch([...handshakeSteps()])
    const client = createMcpClient({ endpoint: ENDPOINT, fetchImpl })
    await client.initialize()
    for (const call of calls) {
      expect(call.headers.get('Content-Type')).toBe('application/json')
      expect(call.headers.get('Accept')).toBe('application/json, text/event-stream')
    }
  })
})

describe('response framing duality — one shared reader, both sanctioned shapes (SPEC-R24 AC1)', () => {
  it('the SAME tools/list result parses deep-equal whether served JSON-framed or SSE-framed', async () => {
    const TOOLS: McpToolInfo[] = [{ name: 'echo', description: 'Echo input', inputSchema: { type: 'object', properties: {} } }]

    const jsonClientFetch = scriptedFetch([...handshakeSteps(), jsonResponse({ tools: TOOLS })])
    const jsonClient = createMcpClient({ endpoint: ENDPOINT, fetchImpl: jsonClientFetch.fetchImpl })
    await jsonClient.initialize()
    const jsonResult = await jsonClient.listTools()

    const sseClientFetch = scriptedFetch([
      ...handshakeSteps(),
      (call) =>
        sseResponse([
          { jsonrpc: '2.0', method: 'notifications/progress', params: {} }, // interleaved notification (no id) — skipped
          { jsonrpc: '2.0', id: 999, result: { tools: [] } }, // another request's id — skipped too
          { jsonrpc: '2.0', id: call.body.id, result: { tools: TOOLS } }, // the actual match
        ]),
    ])
    const sseClient = createMcpClient({ endpoint: ENDPOINT, fetchImpl: sseClientFetch.fetchImpl })
    await sseClient.initialize()
    const sseResult = await sseClient.listTools()

    expect(sseResult).toEqual(jsonResult)
    expect(sseResult).toEqual(TOOLS)
  })

  it('an unrecognized response content-type throws `parse`', async () => {
    const { fetchImpl } = scriptedFetch([new Response('<xml/>', { status: 200, headers: { 'content-type': 'text/xml' } })])
    const client = createMcpClient({ endpoint: ENDPOINT, fetchImpl })
    const error = (await reject(client.initialize())) as McpClientError
    expect(error).toBeInstanceOf(McpClientError)
    expect(error.code).toBe('parse')
  })

  it('a malformed JSON body throws `parse`', async () => {
    const { fetchImpl } = scriptedFetch([new Response('not json{{', { status: 200, headers: { 'content-type': 'application/json' } })])
    const client = createMcpClient({ endpoint: ENDPOINT, fetchImpl })
    const error = (await reject(client.initialize())) as McpClientError
    expect(error.code).toBe('parse')
  })

  it('an SSE stream with no frame matching the request id throws `parse`', async () => {
    const { fetchImpl } = scriptedFetch([
      ...handshakeSteps(),
      sseResponse([{ jsonrpc: '2.0', id: 999, result: { tools: [] } }]),
    ])
    const client = createMcpClient({ endpoint: ENDPOINT, fetchImpl })
    await client.initialize()
    const error = (await reject(client.listTools())) as McpClientError
    expect(error.code).toBe('parse')
  })
})

describe('auth header — instance key vs per-call override (SPEC-R25 AC1 seam)', () => {
  it('a per-call apiKey overrides the instance key', async () => {
    const { fetchImpl, calls } = scriptedFetch([...handshakeSteps(), jsonResponse({ content: [] })])
    const client = createMcpClient({ endpoint: ENDPOINT, apiKey: 'instance-key', fetchImpl })
    await client.initialize()
    await client.callTool('echo', {}, { apiKey: 'per-call-key' })
    expect(calls[2]!.headers.get('Authorization')).toBe('Bearer per-call-key')
  })

  it('falls back to the instance apiKey when no per-call override is given', async () => {
    const { fetchImpl, calls } = scriptedFetch([...handshakeSteps(), jsonResponse({ content: [] })])
    const client = createMcpClient({ endpoint: ENDPOINT, apiKey: 'instance-key', fetchImpl })
    await client.initialize()
    await client.callTool('echo', {})
    expect(calls[2]!.headers.get('Authorization')).toBe('Bearer instance-key')
  })

  it('sends no Authorization header when no key is configured anywhere', async () => {
    const { fetchImpl, calls } = scriptedFetch([...handshakeSteps()])
    const client = createMcpClient({ endpoint: ENDPOINT, fetchImpl })
    await client.initialize()
    expect(calls[0]!.headers.has('Authorization')).toBe(false)
  })
})

describe('listTools() — cursor pagination, bounded (LLD §3.2)', () => {
  it('follows nextCursor pagination to completion', async () => {
    const { fetchImpl } = scriptedFetch([
      ...handshakeSteps(),
      jsonResponse({ tools: [{ name: 'a', inputSchema: {} }], nextCursor: 'page2' }),
      (call) => {
        expect(call.body.params).toEqual({ cursor: 'page2' })
        return jsonResponse({ tools: [{ name: 'b', inputSchema: {} }] })
      },
    ])
    const client = createMcpClient({ endpoint: ENDPOINT, fetchImpl })
    await client.initialize()
    const tools = await client.listTools()
    expect(tools.map((t) => t.name)).toEqual(['a', 'b'])
  })

  it('a looping cursor is bounded at 16 pages, then throws `too-many-pages`', async () => {
    const pages = Array.from({ length: 20 }, () => jsonResponse({ tools: [], nextCursor: 'again' }))
    const { fetchImpl } = scriptedFetch([...handshakeSteps(), ...pages])
    const client = createMcpClient({ endpoint: ENDPOINT, fetchImpl })
    await client.initialize()
    const error = (await reject(client.listTools())) as McpClientError
    expect(error.code).toBe('too-many-pages')
  })

  it('a result missing the `tools` array throws `parse`', async () => {
    const { fetchImpl } = scriptedFetch([...handshakeSteps(), jsonResponse({})])
    const client = createMcpClient({ endpoint: ENDPOINT, fetchImpl })
    await client.initialize()
    const error = (await reject(client.listTools())) as McpClientError
    expect(error.code).toBe('parse')
  })
})

describe('callTool()', () => {
  it('returns the content array and isError verbatim', async () => {
    const { fetchImpl, calls } = scriptedFetch([
      ...handshakeSteps(),
      jsonResponse({
        content: [
          { type: 'text', text: 'hi' },
          { type: 'image', data: 'abc' },
        ],
        isError: true,
      }),
    ])
    const client = createMcpClient({ endpoint: ENDPOINT, fetchImpl })
    await client.initialize()
    const result = await client.callTool('echo', { q: 1 })
    expect(result).toEqual({
      content: [
        { type: 'text', text: 'hi' },
        { type: 'image', data: 'abc' },
      ],
      isError: true,
    })
    expect(calls[2]!.body).toMatchObject({ method: 'tools/call', params: { name: 'echo', arguments: { q: 1 } } })
  })

  it('a result missing `content` throws `parse`', async () => {
    const { fetchImpl } = scriptedFetch([...handshakeSteps(), jsonResponse({})])
    const client = createMcpClient({ endpoint: ENDPOINT, fetchImpl })
    await client.initialize()
    const error = (await reject(client.callTool('x', {}))) as McpClientError
    expect(error.code).toBe('parse')
  })
})

describe('byte cap + abort/timeout — the registry TRUST-NOTE parity (LLD §3.2)', () => {
  it('a response over the byte cap throws `too-large`', async () => {
    // The cap sits ABOVE the small handshake response (~120 B) and BELOW this oversize one — proves
    // the cap is a per-response ceiling, not a first-response fluke.
    const bigResult = { tools: [{ name: 'x', inputSchema: {}, description: 'y'.repeat(1000) }] }
    const { fetchImpl } = scriptedFetch([...handshakeSteps(), jsonResponse(bigResult)])
    const client = createMcpClient({ endpoint: ENDPOINT, fetchImpl, maxResponseBytes: 200 })
    await client.initialize()
    const error = (await reject(client.listTools())) as McpClientError
    expect(error.code).toBe('too-large')
  })

  it('an already-aborted per-call signal surfaces as `timeout` — no real timer wait', async () => {
    const fetchImpl = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.signal?.aborted) throw new DOMException('The operation was aborted.', 'AbortError')
      throw new Error('unexpected fetch call in abort test — the signal should already be aborted')
    }) as typeof fetch
    const client = createMcpClient({ endpoint: ENDPOINT, fetchImpl })
    const controller = new AbortController()
    controller.abort()
    const error = (await reject(client.callTool('x', {}, { signal: controller.signal }))) as McpClientError
    expect(error).toBeInstanceOf(McpClientError)
    expect(error.code).toBe('timeout')
  })

  it('a non-2xx HTTP status throws `http` without reading the body', async () => {
    const { fetchImpl } = scriptedFetch([new Response('internal error', { status: 500 })])
    const client = createMcpClient({ endpoint: ENDPOINT, fetchImpl })
    const error = (await reject(client.initialize())) as McpClientError
    expect(error.code).toBe('http')
    expect(error.message).toMatch(/500/)
  })

  it('a JSON-RPC error member throws `jsonrpc` carrying the server message', async () => {
    const { fetchImpl } = scriptedFetch([
      new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, error: { code: -32601, message: 'method not found' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ])
    const client = createMcpClient({ endpoint: ENDPOINT, fetchImpl })
    const error = (await reject(client.initialize())) as McpClientError
    expect(error.code).toBe('jsonrpc')
    expect(error.message).toMatch(/method not found/)
  })
})
