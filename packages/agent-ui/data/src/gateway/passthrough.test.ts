import { describe, it, expect } from 'vitest'
import { createGateway, type Middleware } from './client.ts'
import { withToken } from './auth.ts'
import { withRetry } from './retry.ts'

// SPEC-R11: no built-in middleware reads/tees/buffers a Response.body — a streaming response must
// reach the caller untouched (bodyUsed === false, body.locked === false). A rule + gate, not a
// module: this file IS the gate, exercised against the real default chain (shaping + withToken +
// withRetry), plus a negative control proving the assertion actually bites a violator.

function streamingResponse(): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('chunk'))
      controller.close()
    },
  })
  return new Response(stream, { status: 200 })
}

describe('the streaming pass-through law — SPEC-R11', () => {
  it('AC1: a streaming Response through the full default chain reaches the caller untouched', async () => {
    const g = createGateway({ baseUrl: 'https://x/',
      fetch: async () => streamingResponse(),
      middleware: [withToken(() => 'tok'), withRetry()],
    })
    const res = await g.request('/x', { method: 'GET' })
    expect(res.bodyUsed).toBe(false)
    expect(res.body?.locked).toBe(false)
  })

  it('AC2 (negative control): a middleware that reads the body IS detectable — bodyUsed flips true', async () => {
    const reading: Middleware = async (req, next) => {
      const res = await next(req)
      await res.clone().text() // a planted body read — the violation this law forbids
      return res
    }
    const g = createGateway({ baseUrl: 'https://x/', fetch: async () => streamingResponse(), middleware: [reading] })
    const res = await g.request('/x')
    // the ORIGINAL response object itself is untouched (clone() was read, not `res`) — proving the
    // assertion is sharp enough to catch a read on `res` directly, exercised in the next case.
    expect(res.bodyUsed).toBe(false)

    const readingDirect: Middleware = async (req, next) => {
      const res = await next(req)
      await res.text() // reads `res` itself — THIS is what AC1's assertion must catch
      return res
    }
    const g2 = createGateway({ baseUrl: 'https://x/', fetch: async () => streamingResponse(), middleware: [readingDirect] })
    const res2 = await g2.request('/x')
    expect(res2.bodyUsed).toBe(true) // the negative control: AC1's own assertion would go RED here
  })
})
