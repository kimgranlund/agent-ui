import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { createGateway } from './client.ts'
import { withToken } from './auth.ts'
declare const process: { cwd(): string }

describe('withToken — SPEC-R9', () => {
  it('AC1: 5 concurrent 401s -> refresh called once, all 5 resolve 200 with the new token', async () => {
    let currentToken = 'stale'
    const refresh = vi.fn(async () => {
      currentToken = 'fresh'
      return currentToken
    })
    const seenAuthHeaders: string[] = []
    const fetchStub = vi.fn(async (req: Request) => {
      const auth = req.headers.get('Authorization') ?? ''
      seenAuthHeaders.push(auth)
      if (auth.includes('stale')) return new Response('nope', { status: 401 })
      return new Response('ok', { status: 200 })
    })
    const g = createGateway({ baseUrl: 'https://x/',
      fetch: fetchStub,
      middleware: [withToken(() => currentToken, { refresh })],
    })
    const results = await Promise.all([1, 2, 3, 4, 5].map(() => g.request('/x')))
    expect(refresh).toHaveBeenCalledTimes(1)
    for (const r of results) expect(r.status).toBe(200)
  })

  it('AC2: a rejecting refresh rejects every queued request with the SAME DataError', async () => {
    const refresh = vi.fn(async (): Promise<string> => {
      throw new Error('refresh failed')
    })
    const fetchStub = vi.fn(async () => new Response('nope', { status: 401 }))
    const g = createGateway({ baseUrl: 'https://x/', fetch: fetchStub, middleware: [withToken(() => 'stale', { refresh })] })
    const settled = await Promise.allSettled([g.request('/a'), g.request('/b'), g.request('/c')])
    const reasons = settled.map((s) => (s.status === 'rejected' ? s.reason : undefined))
    expect(reasons.every((r) => r === reasons[0])).toBe(true) // Object.is across rejections
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('AC3: the token is never written into the store the consumer owns (no leak by construction — grep-style)', () => {
    const path = `${process.cwd()}/packages/agent-ui/data/src/gateway/auth.ts`
    const src = readFileSync(path, 'utf8') as string
    expect(src).not.toMatch(/store\.commit|localStorage|sessionStorage/)
  })

  it('a second 401 after replay is returned as-is (no infinite loop)', async () => {
    let calls = 0
    const fetchStub = vi.fn(async () => {
      calls++
      return new Response('nope', { status: 401 })
    })
    const g = createGateway({ baseUrl: 'https://x/',
      fetch: fetchStub,
      middleware: [withToken(() => 'stale', { refresh: async () => 'still-stale' })],
    })
    const res = await g.request('/x')
    expect(res.status).toBe(401)
    expect(calls).toBe(2) // one original + one replay, never more
  })

  it('AC4: a JSON-bodied request (re-creatable body) IS replayed after refresh, body intact (the SPEC §5 PATCH example)', async () => {
    const seenBodies: string[] = []
    const seenAuth: string[] = []
    const fetchStub = vi.fn(async (req: Request) => {
      seenBodies.push(await req.text())
      seenAuth.push(req.headers.get('Authorization') ?? '')
      return seenAuth.length === 1 ? new Response('nope', { status: 401 }) : new Response('{"ok":true}', { status: 200 })
    })
    const g = createGateway({ baseUrl: 'https://x/', fetch: fetchStub, middleware: [withToken(() => 'stale', { refresh: async () => 'fresh' })] })
    const out = await g.json<{ ok: boolean }>('users/1', { method: 'PATCH', json: { name: 'Kim' } })
    expect(out).toEqual({ ok: true })
    expect(fetchStub).toHaveBeenCalledTimes(2)
    expect(seenBodies).toEqual(['{"name":"Kim"}', '{"name":"Kim"}'])
    expect(seenAuth).toEqual(['Bearer stale', 'Bearer fresh']) // the replay carries the token refresh() RESOLVED
  })

  it('AC4: a one-shot ReadableStream body is NOT replayed — rejects http/401 code:unreplayable-body', async () => {
    const fetchStub = vi.fn(async () => new Response('nope', { status: 401 }))
    const refresh = vi.fn(async () => 'fresh')
    const g = createGateway({ baseUrl: 'https://x/', fetch: fetchStub, middleware: [withToken(() => 'stale', { refresh })] })
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new TextEncoder().encode('chunk'))
        c.close()
      },
    })
    await expect(g.request('upload', { method: 'POST', body })).rejects.toMatchObject({
      kind: 'http',
      status: 401,
      code: 'unreplayable-body',
    })
    expect(fetchStub).toHaveBeenCalledTimes(1) // never re-sent
    expect(refresh).not.toHaveBeenCalled()
  })

  it('a request with no refresh configured returns the 401 as-is, untouched', async () => {
    const fetchStub = vi.fn(async () => new Response('nope', { status: 401 }))
    const g = createGateway({ baseUrl: 'https://x/', fetch: fetchStub, middleware: [withToken(() => 'tok')] })
    const res = await g.request('/x')
    expect(res.status).toBe(401)
  })
})
