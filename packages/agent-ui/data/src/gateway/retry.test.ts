import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createGateway } from './client.ts'
import { withRetry } from './retry.ts'

describe('withRetry — SPEC-R10', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('AC1/AC1b: a GET answered 503,503,200 retries by default (method-idempotent, no opt-in) and lands 200', async () => {
    let n = 0
    const fetchStub = vi.fn(async () => (n++ < 2 ? new Response('x', { status: 503 }) : new Response('ok', { status: 200 })))
    const g = createGateway({ baseUrl: 'https://x/', fetch: fetchStub, middleware: [withRetry({ maxAttempts: 5 })] })
    const p = g.request('/x', { method: 'GET' })
    await vi.runAllTimersAsync()
    const res = await p
    expect(res.status).toBe(200)
    expect(fetchStub).toHaveBeenCalledTimes(3)
  })

  it('AC2: a POST without idempotent:true retries ZERO times on a retryable 503', async () => {
    const fetchStub = vi.fn(async () => new Response('x', { status: 503 }))
    const g = createGateway({ baseUrl: 'https://x/', fetch: fetchStub, middleware: [withRetry()] })
    const res = await g.request('/x', { method: 'POST' })
    expect(res.status).toBe(503)
    expect(fetchStub).toHaveBeenCalledTimes(1)
  })

  it('a POST with idempotent:true DOES retry a retryable 503', async () => {
    let n = 0
    const fetchStub = vi.fn(async () => (n++ < 1 ? new Response('x', { status: 503 }) : new Response('ok', { status: 200 })))
    const g = createGateway({ baseUrl: 'https://x/', fetch: fetchStub, middleware: [withRetry({ maxAttempts: 3 })] })
    const p = g.request('/x', { method: 'POST', idempotent: true })
    await vi.runAllTimersAsync()
    const res = await p
    expect(res.status).toBe(200)
    expect(fetchStub).toHaveBeenCalledTimes(2)
  })

  it('AC3: Retry-After: 2 makes the second attempt wait at least 2000ms', async () => {
    let n = 0
    const fetchStub = vi.fn(async () =>
      n++ === 0 ? new Response('x', { status: 503, headers: { 'retry-after': '2' } }) : new Response('ok', { status: 200 }),
    )
    const g = createGateway({ baseUrl: 'https://x/', fetch: fetchStub, middleware: [withRetry({ baseMs: 1, capMs: 10 })] })
    const p = g.request('/x', { method: 'GET' })
    await vi.advanceTimersByTimeAsync(1999)
    expect(fetchStub).toHaveBeenCalledTimes(1) // still waiting
    await vi.advanceTimersByTimeAsync(50)
    const res = await p
    expect(res.status).toBe(200)
  })

  it('AC4: an abort mid-backoff rejects with kind:abort before the timer would fire', async () => {
    const controller = new AbortController()
    const fetchStub = vi.fn(async () => new Response('x', { status: 503 }))
    const g = createGateway({ baseUrl: 'https://x/', fetch: fetchStub, middleware: [withRetry({ baseMs: 1000, capMs: 5000 })] })
    const p = g.request('/x', { method: 'GET', signal: controller.signal })
    const assertion = expect(p).rejects.toMatchObject({ kind: 'abort' })
    controller.abort()
    await assertion
  })

  it('AC5: 503x5 with maxAttempts:3 makes exactly 3 fetch calls', async () => {
    const fetchStub = vi.fn(async () => new Response('x', { status: 503 }))
    const g = createGateway({ baseUrl: 'https://x/', fetch: fetchStub, middleware: [withRetry({ maxAttempts: 3, baseMs: 1, capMs: 5 })] })
    const p = g.request('/x', { method: 'GET' })
    await vi.runAllTimersAsync()
    const res = await p
    expect(res.status).toBe(503)
    expect(fetchStub).toHaveBeenCalledTimes(3)
  })
})
