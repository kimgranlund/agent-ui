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
})
