// anthropic-timeouts.test.ts - GH #1797 (c): the Anthropic adapter's bounded network wait. Pins the
// first-byte deadline (fetch never answers -> named rejection at the limit), the per-read stall guard
// (body goes silent -> named rejection, reader cancelled), the negative control (gaps under the limit
// complete with every fragment), the caller-abort arm (never relabelled as a timeout), and no leaked
// timer after a healthy turn. Fake timers drive every clock; fetch is stubbed per test and unstubbed in
// afterEach (a module-level stub bleeds).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  anthropicProvider,
  ANTHROPIC_FIRST_BYTE_TIMEOUT_MS,
  ANTHROPIC_STALL_TIMEOUT_MS,
} from '../agent/providers/anthropic.ts'

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const enc = new TextEncoder()
const textFrame = (text: string): Uint8Array =>
  enc.encode(
    'event: content_block_delta\n' +
      `data: ${JSON.stringify({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } })}\n\n`,
  )
const STOP_FRAME = enc.encode('event: message_stop\ndata: {"type":"message_stop"}\n\n')

const REQ = { model: 'claude-sonnet-5', system: 'sys', messages: [{ role: 'user' as const, content: 'hi' }] }

/** A fetch that never answers on its own; it rejects with an AbortError once `init.signal` aborts. */
function hangingFetch() {
  return vi.fn(
    (_url: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_, reject) => {
        const signal = init?.signal
        signal?.addEventListener('abort', () =>
          reject(signal.reason ?? new DOMException('The operation was aborted.', 'AbortError')),
        )
      }),
  )
}

describe('anthropicProvider: first-byte deadline and stall guard (GH #1797 c)', () => {
  it('exports the 60000 ms defaults', () => {
    expect(ANTHROPIC_FIRST_BYTE_TIMEOUT_MS).toBe(60_000)
    expect(ANTHROPIC_STALL_TIMEOUT_MS).toBe(60_000)
  })

  it('(1) a fetch that never answers rejects at the first-byte limit with the named message', async () => {
    vi.stubGlobal('fetch', hangingFetch())
    const it = anthropicProvider({ apiKey: 'k' }).stream(REQ)[Symbol.asyncIterator]()
    let settled = false
    const next = it.next().finally(() => {
      settled = true
    })
    const assertion = expect(next).rejects.toThrow(/anthropicProvider: no response within 60000 ms/)

    await vi.advanceTimersByTimeAsync(ANTHROPIC_FIRST_BYTE_TIMEOUT_MS - 1)
    expect(settled).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    await assertion
    expect(vi.getTimerCount()).toBe(0)
  })

  it('(2) a body that sends one frame then goes silent rejects at the stall limit and cancels the reader', async () => {
    const cancel = vi.fn()
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(textFrame('first'))
      },
      cancel,
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(body, { status: 200 })),
    )
    const it = anthropicProvider({ apiKey: 'k' }).stream(REQ)[Symbol.asyncIterator]()

    const first = await it.next()
    expect(first).toEqual({ done: false, value: 'first' })

    let settled = false
    const next = it.next().finally(() => {
      settled = true
    })
    const assertion = expect(next).rejects.toThrow(/anthropicProvider: stream stalled for 60000 ms/)

    await vi.advanceTimersByTimeAsync(ANTHROPIC_STALL_TIMEOUT_MS - 1)
    expect(settled).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    await assertion
    expect(cancel).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('(3) negative control: 30000 ms gaps under the limit complete and yield every fragment in order', async () => {
    const parts = ['a', 'b', 'c', 'd']
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        parts.forEach((p, i) => setTimeout(() => controller.enqueue(textFrame(p)), (i + 1) * 30_000))
        setTimeout(
          () => {
            controller.enqueue(STOP_FRAME)
            controller.close()
          },
          (parts.length + 1) * 30_000,
        )
      },
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(body, { status: 200 })),
    )

    const fragments: string[] = []
    let finished = false
    const run = (async () => {
      for await (const f of anthropicProvider({ apiKey: 'k' }).stream(REQ)) fragments.push(f)
      finished = true
    })()
    const assertion = expect(run).resolves.toBeUndefined()

    for (let step = 0; step <= parts.length; step++) await vi.advanceTimersByTimeAsync(30_000)
    await assertion
    expect(finished).toBe(true)
    expect(fragments).toEqual(parts)
  })

  it('(4) a caller abort before the limit is not relabelled as a timeout', async () => {
    vi.stubGlobal('fetch', hangingFetch())
    const ac = new AbortController()
    setTimeout(() => ac.abort(), 1_000)
    const it = anthropicProvider({ apiKey: 'k' }).stream({ ...REQ, signal: ac.signal })[Symbol.asyncIterator]()
    let caught: unknown
    const next = it.next().catch((e: unknown) => {
      caught = e
    })

    await vi.advanceTimersByTimeAsync(1_000)
    await next
    expect(caught).toBeDefined()
    expect((caught as Error).name).toBe('AbortError')
    expect(String((caught as Error).message)).not.toMatch(/no response within/)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('(5) no timer remains pending after a healthy completion', async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(textFrame('ok'))
        controller.enqueue(STOP_FRAME)
        controller.close()
      },
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(body, { status: 200 })),
    )

    const fragments: string[] = []
    for await (const f of anthropicProvider({ apiKey: 'k' }).stream(REQ)) fragments.push(f)
    expect(fragments).toEqual(['ok'])
    expect(vi.getTimerCount()).toBe(0)
  })
})
