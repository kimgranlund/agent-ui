// anthropic-retry.test.ts: GH #1797 gap (d), the bounded upstream retry. A 429 or 5xx at connection time
// (or a fetch network TypeError) is retried up to ANTHROPIC_MAX_RETRIES times; a 4xx, a caller abort, and
// a body that errors mid-stream are never retried. Fetch is stubbed PER-TEST with an afterEach unstub (a
// module-level stub bleeds), and backoff waits run under fake timers so no real time passes.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { anthropicProvider } from '../agent/providers/anthropic.ts'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

const TEXT_FRAMES = [
  'event: content_block_start',
  'data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}',
  '',
  'event: content_block_delta',
  'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"hello after retry"}}',
  '',
  'event: message_stop',
  'data: {"type":"message_stop"}',
  '',
  '',
]

function sseResponse(lines: string[]): Response {
  const body = lines.join('\n')
  // jsdom's Blob has no .stream(); construct the ReadableStream directly (one whole-body chunk).
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(body))
      controller.close()
    },
  })
  return new Response(stream, { status: 200 })
}

function errorResponse(status: number, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify({ type: 'error', error: { type: 'transient', message: `status ${status}` } }), {
    status,
    headers,
  })
}

/** Stub fetch with a fixed sequence of outcomes (a Response, or an Error to throw). */
function stubFetchSequence(outcomes: Array<Response | Error>) {
  const fetchMock = vi.fn(async () => {
    const next = outcomes[Math.min(fetchMock.mock.calls.length - 1, outcomes.length - 1)]
    if (next instanceof Error) throw next
    return next as Response
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

type Settled = { ok: true; text: string } | { ok: false; error: unknown }

/** Drive one text-only stream to completion; the result never rejects (no unhandled rejection while
 *  fake timers are advanced). */
function runStream(signal?: AbortSignal): Promise<Settled> {
  const provider = anthropicProvider({ apiKey: 'test-key' })
  return (async () => {
    let text = ''
    for await (const frag of provider.stream({
      model: 'claude-sonnet-5',
      system: 'sys',
      messages: [{ role: 'user', content: 'hi' }],
      ...(signal ? { signal } : {}),
    })) {
      text += frag
    }
    return text
  })().then(
    (text): Settled => ({ ok: true, text }),
    (error: unknown): Settled => ({ ok: false, error }),
  )
}

describe('anthropicProvider: bounded upstream retry (GH #1797)', () => {
  it('retry 1: a 503 then a 200 succeeds on attempt 2 and yields the text', async () => {
    vi.useFakeTimers()
    const fetchMock = stubFetchSequence([errorResponse(503), sseResponse(TEXT_FRAMES)])
    const done = runStream()
    await vi.runAllTimersAsync()
    const result = await done
    expect(result).toEqual({ ok: true, text: 'hello after retry' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('retry 2: a 429 with Retry-After 2 waits 2000 ms before attempt 2', async () => {
    vi.useFakeTimers()
    const fetchMock = stubFetchSequence([errorResponse(429, { 'retry-after': '2' }), sseResponse(TEXT_FRAMES)])
    const done = runStream()
    await vi.advanceTimersByTimeAsync(1999)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const result = await done
    expect(result).toEqual({ ok: true, text: 'hello after retry' })
  })

  it('retry 3: three 503s throw upstream error 503 after exactly 3 calls', async () => {
    vi.useFakeTimers()
    const fetchMock = stubFetchSequence([errorResponse(503), errorResponse(503), errorResponse(503)])
    const done = runStream()
    await vi.runAllTimersAsync()
    const result = await done
    expect(result.ok).toBe(false)
    expect(String((result as { error: unknown }).error)).toMatch(/upstream error 503/)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('retry 4: a 400 and a 401 are not retried', async () => {
    vi.useFakeTimers()
    for (const status of [400, 401]) {
      const fetchMock = stubFetchSequence([errorResponse(status), sseResponse(TEXT_FRAMES)])
      const done = runStream()
      await vi.runAllTimersAsync()
      const result = await done
      expect(result.ok).toBe(false)
      expect(String((result as { error: unknown }).error)).toMatch(new RegExp(`upstream error ${status}`))
      expect(fetchMock).toHaveBeenCalledTimes(1)
      vi.unstubAllGlobals()
    }
  })

  it('retry 5: a fetch TypeError then a 200 retries and succeeds', async () => {
    vi.useFakeTimers()
    const fetchMock = stubFetchSequence([new TypeError('fetch failed'), sseResponse(TEXT_FRAMES)])
    const done = runStream()
    await vi.runAllTimersAsync()
    const result = await done
    expect(result).toEqual({ ok: true, text: 'hello after retry' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('retry 6: a caller abort during backoff rejects at once with no pending timer', async () => {
    vi.useFakeTimers()
    const fetchMock = stubFetchSequence([errorResponse(503), sseResponse(TEXT_FRAMES)])
    const controller = new AbortController()
    const done = runStream(controller.signal)
    // Let attempt 1 resolve and the backoff sleep start (the base delay is at least 500 ms).
    await vi.advanceTimersByTimeAsync(10)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(1)
    const reason = new Error('caller aborted')
    controller.abort(reason)
    const result = await done
    expect(result).toEqual({ ok: false, error: reason })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('retry 7: a healthy first attempt makes one call and sets no timer', async () => {
    vi.useFakeTimers()
    const fetchMock = stubFetchSequence([sseResponse(TEXT_FRAMES)])
    const result = await runStream()
    expect(result).toEqual({ ok: true, text: 'hello after retry' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('retry 8: a 200 whose body errors mid-stream is surfaced and not retried', async () => {
    vi.useFakeTimers()
    const midStream = new Error('connection reset mid-stream')
    let pulls = 0
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls++
        if (pulls === 1) {
          controller.enqueue(new TextEncoder().encode(TEXT_FRAMES.slice(0, 6).join('\n')))
        } else {
          controller.error(midStream)
        }
      },
    })
    const fetchMock = stubFetchSequence([new Response(body, { status: 200 }), sseResponse(TEXT_FRAMES)])
    const done = runStream()
    await vi.runAllTimersAsync()
    const result = await done
    expect(result).toEqual({ ok: false, error: midStream })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
