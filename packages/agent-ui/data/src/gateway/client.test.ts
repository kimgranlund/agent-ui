import { describe, it, expect, vi } from 'vitest'
import { createGateway, type Middleware } from './client.ts'

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
    const g = createGateway({ fetch: fetchStub, middleware: [a, b] })
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
    const g = createGateway({ fetch: vi.fn(), middleware: [failing] })
    await expect(g.request('/x')).rejects.toMatchObject({ kind: 'unknown', cause: boom })
  })

  it('json() serializes GatewayInit.json and parses a successful response', async () => {
    let seenBody: string | undefined
    const fetchStub = vi.fn(async (req: Request) => {
      seenBody = await req.text()
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } })
    })
    const g = createGateway({ fetch: fetchStub })
    const result = await g.json<{ ok: boolean }>('/x', { json: { a: 1 }, method: 'POST' })
    expect(JSON.parse(seenBody!)).toEqual({ a: 1 })
    expect(result).toEqual({ ok: true })
  })

  it('json() throws a DataError on a non-ok response', async () => {
    const fetchStub = vi.fn(async () => new Response(JSON.stringify({ error: { code: 'E_X' } }), { status: 400 }))
    const g = createGateway({ fetch: fetchStub })
    await expect(g.json('/x')).rejects.toMatchObject({ kind: 'http', status: 400 })
  })
})
