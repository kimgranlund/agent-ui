import { describe, it, expect, vi } from 'vitest'
import { createGateway, resolveUrl, type Middleware } from './client.ts'

describe('createGateway — SPEC-R8', () => {
  it('AC1: middleware order is onion — first-listed is outermost', async () => {
    const log: string[] = []
    const a: Middleware = async (req, next) => {
      log.push('a-in')
      const res = await next(req)
      log.push('a-out')
      return res
    }
    const b: Middleware = async (req, next) => {
      log.push('b-in')
      const res = await next(req)
      log.push('b-out')
      return res
    }
    const fetchStub = vi.fn(async () => new Response('ok'))
    const g = createGateway({ baseUrl: 'https://x/', fetch: fetchStub, middleware: [a, b] })
    await g.request('/x')
    expect(log).toEqual(['a-in', 'b-in', 'b-out', 'a-out'])
  })

  it('AC2: baseUrl + default headers merged, per-request headers win', async () => {
    let seenReq: Request | undefined
    const fetchStub = vi.fn(async (req: Request) => {
      seenReq = req
      return new Response('ok')
    })
    const g = createGateway({ baseUrl: 'https://x/', headers: { 'x-app': 'a', 'x-shared': 'base' }, fetch: fetchStub })
    await g.request('users', { headers: { 'x-shared': 'override' } })
    expect(seenReq?.url).toBe('https://x/users')
    expect(seenReq?.headers.get('x-app')).toBe('a')
    expect(seenReq?.headers.get('x-shared')).toBe('override')
  })

  it('AC3: a throwing middleware surfaces as a DataError with cause = the thrown error', async () => {
    const boom = new Error('x')
    const failing: Middleware = async () => {
      throw boom
    }
    const g = createGateway({ baseUrl: 'https://x/', fetch: vi.fn(), middleware: [failing] })
    await expect(g.request('/x')).rejects.toMatchObject({ kind: 'unknown', cause: boom })
  })

  it('json() serializes GatewayInit.json and parses a successful response', async () => {
    let seenBody: string | undefined
    const fetchStub = vi.fn(async (req: Request) => {
      seenBody = await req.text()
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } })
    })
    const g = createGateway({ baseUrl: 'https://x/', fetch: fetchStub })
    const result = await g.json<{ ok: boolean }>('/x', { json: { a: 1 }, method: 'POST' })
    expect(JSON.parse(seenBody!)).toEqual({ a: 1 })
    expect(result).toEqual({ ok: true })
  })

  it('json() throws a DataError on a non-ok response', async () => {
    const fetchStub = vi.fn(async () => new Response(JSON.stringify({ error: { code: 'E_X' } }), { status: 400 }))
    const g = createGateway({ baseUrl: 'https://x/', fetch: fetchStub })
    await expect(g.json('/x')).rejects.toMatchObject({ kind: 'http', status: 400 })
  })

  it('json() classifies by HTTP status FIRST — a 502 with a text/html body is kind:http/502, never parse', async () => {
    const fetchStub = vi.fn(
      async () => new Response('<html><body>Bad Gateway</body></html>', { status: 502, headers: { 'content-type': 'text/html' } }),
    )
    const g = createGateway({ baseUrl: 'https://x/', fetch: fetchStub })
    const err = await g.json('/x').catch((e: unknown) => e)
    expect(err).toMatchObject({ kind: 'http', status: 502, retryable: true })
    expect((err as { cause: { body: unknown } }).cause.body).toBe('<html><body>Bad Gateway</body></html>') // best-effort payload

    // an OK body that is malformed JSON is the ONLY parse-kind path
    const g2 = createGateway({ baseUrl: 'https://x/', fetch: async () => new Response('{not json', { status: 200 }) })
    await expect(g2.json('/x')).rejects.toMatchObject({ kind: 'parse' })
  })

  it('json() resolves undefined for a 204 (no body to parse) and is callable detached from the gateway object', async () => {
    const g = createGateway({ baseUrl: 'https://x/', fetch: async () => new Response(null, { status: 204 }) })
    const { json } = g // detached — must not depend on `this`
    await expect(json('/x')).resolves.toBeUndefined()
  })

  describe('URL resolution — no invented origin (SPEC §5 `baseUrl: "/api/"`)', () => {
    it('resolveUrl: absolute base URL-resolves; relative base string-joins and stays relative; no base passes input through', () => {
      expect(resolveUrl('https://x/', 'users')).toBe('https://x/users')
      expect(resolveUrl('https://x/v1/', 'users?cursor=')).toBe('https://x/v1/users?cursor=')
      expect(resolveUrl('https://x/v1/', '/users')).toBe('https://x/users')
      expect(resolveUrl('/api/', 'users')).toBe('/api/users')
      expect(resolveUrl('/api', 'users')).toBe('/api/users')
      expect(resolveUrl('/api/', '/absolute')).toBe('/absolute')
      expect(resolveUrl(undefined, '/x')).toBe('/x')
      expect(resolveUrl(undefined, 'https://y/z')).toBe('https://y/z')
      expect(resolveUrl('/api/', 'https://y/z')).toBe('https://y/z')
      expect(resolveUrl('/api/', 'users')).not.toMatch(/localhost/) // no synthetic origin, ever
    })

    it("baseUrl: '/api/' hands the platform a RELATIVE URL that resolves against the host's own ambient base", async () => {
      // Node's WHATWG `Request` has no document base — emulate a browser's by setting undici's global
      // origin for this test only (the same slot a browser fills with `document.baseURI`).
      const originSlot = Symbol.for('undici.globalOrigin.1')
      const g = globalThis as unknown as Record<symbol, unknown>
      const prev = g[originSlot]
      g[originSlot] = new URL('https://app.example/')
      try {
        let seenUrl: string | undefined
        const gw = createGateway({
          baseUrl: '/api/',
          fetch: async (req: Request) => {
            seenUrl = req.url
            return new Response('ok')
          },
        })
        await gw.request('users')
        expect(seenUrl).toBe('https://app.example/api/users')
      } finally {
        if (prev === undefined) delete g[originSlot]
        else g[originSlot] = prev
      }
    })
  })

  it('internal carrier headers (idempotent, one-shot-body) never reach the real fetch, with or without withRetry in the chain', async () => {
    let seen: Request | undefined
    const fetchStub = vi.fn(async (req: Request) => {
      seen = req
      return new Response('ok')
    })
    const g = createGateway({ baseUrl: 'https://x/', fetch: fetchStub })
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new TextEncoder().encode('x'))
        c.close()
      },
    })
    await g.request('/x', { method: 'POST', idempotent: true, body: stream })
    expect(seen).toBeDefined()
    expect([...seen!.headers.keys()].some((k) => k.startsWith('x-agent-ui-data-'))).toBe(false)
    expect(seen!.method).toBe('POST')
  })
})
