import { describe, it, expect, vi } from 'vitest'
import { fromFetchStream } from './from-fetch-stream.ts'

function bodyFromChunks(chunks: string[], onCancel?: () => void): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  let i = 0
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(encoder.encode(chunks[i++]))
      } else {
        controller.close()
      }
    },
    cancel() {
      onCancel?.()
    },
  })
}

async function collect<T>(iter: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = []
  for await (const v of iter) out.push(v)
  return out
}

describe('fromFetchStream — SPEC-R13 (a)', () => {
  it('AC1 (ndjson): the hoisted readNdjsonLines chunk-boundary behavior is reused verbatim', async () => {
    const body = bodyFromChunks(['{"a":1}\n{"b"', ':2}\n'])
    const fetchStub = vi.fn(async () => new Response(body))
    const stream = fromFetchStream('https://example.com/x', { frame: 'ndjson', fetch: fetchStub })
    const lines = await collect(stream)
    expect(lines).toEqual(['{"a":1}', '{"b":2}'])
  })

  it("AC2: SSE — multi-line data joined, event/id surfaced, comments ignored", async () => {
    const body = bodyFromChunks(['data: a\ndata: b\nid: 7\n\n:comment\n\ndata: c\n\n'])
    const fetchStub = vi.fn(async () => new Response(body))
    const stream = fromFetchStream('https://example.com/x', { frame: 'sse', fetch: fetchStub })
    const events = await collect(stream)
    expect(events).toEqual([
      { data: 'a\nb', id: '7' },
      { data: 'c' },
    ])
  })

  it('lines mode yields raw lines, unfiltered', async () => {
    const body = bodyFromChunks(['a\n\nb\n'])
    const fetchStub = vi.fn(async () => new Response(body))
    const stream = fromFetchStream('https://example.com/x', { frame: 'lines', fetch: fetchStub })
    const lines = await collect(stream)
    expect(lines).toEqual(['a', '', 'b'])
  })

  it('AC3: abort mid-stream cancels the underlying stream exactly once', async () => {
    const controller = new AbortController()
    const onCancel = vi.fn()
    let resolvePull!: () => void
    const encoder = new TextEncoder()
    const body = new ReadableStream<Uint8Array>({
      async pull(c) {
        c.enqueue(encoder.encode('a\n'))
        await new Promise<void>((r) => {
          resolvePull = r
        })
      },
      cancel: onCancel,
    })
    const fetchStub = vi.fn(async () => new Response(body))
    const stream = fromFetchStream('https://example.com/x', { frame: 'lines', fetch: fetchStub, signal: controller.signal })
    const iterator = stream[Symbol.asyncIterator]()
    await iterator.next() // yields 'a', pull() is now awaiting resolvePull
    controller.abort()
    await Promise.resolve()
    await Promise.resolve()
    expect(onCancel).toHaveBeenCalledTimes(1)
    resolvePull()
  })

  it('AC3 (ndjson): abort mid-stream cancels the underlying source too, and the stream ends cleanly (no rejection)', async () => {
    const controller = new AbortController()
    const onCancel = vi.fn()
    let resolvePull!: () => void
    const encoder = new TextEncoder()
    const body = new ReadableStream<Uint8Array>({
      async pull(c) {
        c.enqueue(encoder.encode('{"a":1}\n'))
        await new Promise<void>((r) => {
          resolvePull = r
        })
      },
      cancel: onCancel,
    })
    const stream = fromFetchStream('https://example.com/x', { frame: 'ndjson', fetch: async () => new Response(body), signal: controller.signal })
    const iterator = stream[Symbol.asyncIterator]()
    expect((await iterator.next()).value).toBe('{"a":1}')
    const pending = iterator.next()
    controller.abort()
    const result = await pending
    expect(result.done).toBe(true)
    expect(onCancel).toHaveBeenCalledTimes(1)
    resolvePull()
  })

  it('a consumer that breaks out early releases the connection — the source’s cancel runs (lines + ndjson)', async () => {
    for (const frame of ['lines', 'ndjson'] as const) {
      const onCancel = vi.fn()
      const body = bodyFromChunks(['a\nb\nc\n', 'd\n'], onCancel)
      const stream = fromFetchStream('https://example.com/x', { frame, fetch: async () => new Response(body) })
      for await (const line of stream) {
        if (line === 'b') break
      }
      expect(onCancel, frame).toHaveBeenCalledTimes(1)
    }
  })

  it('a non-2xx response is an ERROR (DataError http/status), never parsed as frames', async () => {
    const body = bodyFromChunks(['<html>Bad Gateway</html>\n'])
    const stream = fromFetchStream('https://example.com/x', {
      frame: 'ndjson',
      fetch: async () => new Response(body, { status: 502, headers: { 'content-type': 'text/html' } }),
    })
    await expect(collect(stream)).rejects.toMatchObject({ kind: 'http', status: 502, retryable: true })
  })
})
