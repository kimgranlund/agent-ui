// turn-deadline.test.ts: T-0023 (GH #1797 gap). Pins the whole-turn deadline `produce()` arms over every
// provider round and tool round, the distinct stall class, and the plain-words host message for each. The
// first-byte deadline and the per-read stall timer are pinned by `anthropic-timeouts.test.ts`; what this file
// adds is the bound a stream that keeps emitting events (so never stalls) still cannot outlive. Fake timers
// drive every clock; fetch is stubbed per test and unstubbed in afterEach. The stub providers honour the
// request signal the way the real adapter does, except the one that deliberately ignores it.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { produce, ProduceHalt } from '../agent/produce.ts'
import type { ProduceDeps, ProduceOptions } from '../agent/produce.ts'
import type { AgentProvider, ToolDef, TurnInput } from '../agent/agent-transport.ts'
import { anthropicProvider, ANTHROPIC_STALL_TIMEOUT_MS, StreamStallError } from '../agent/providers/anthropic.ts'
import { TURN_DEADLINE_MS, TurnDeadlineError, withTurnDeadline } from '../agent/deadlines.ts'
import { failureMessageFor, GENERIC_FAILURE_MESSAGE } from '../../tools/agent/chat-validation.ts'
import { defaultCatalog } from '../catalog/default/index.ts'

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const NOTE = '{"a2uiMeta":{"note":"here you go"}}\n'
const INVALID =
  NOTE +
  '{"version":"v1.0","createSurface":{"surfaceId":"main","catalogId":"agent-ui"}}\n' +
  '{"version":"v1.0","updateComponents":{"surfaceId":"main","components":[{"id":"root","component":"NotARealComponent"}]}}'
const VALID =
  NOTE +
  '{"version":"v1.0","createSurface":{"surfaceId":"main","catalogId":"agent-ui"}}\n' +
  '{"version":"v1.0","updateComponents":{"surfaceId":"main","components":[{"id":"root","component":"Button","label":"Hi","action":{"action":"submit"}}]}}'

/** A delay long enough to never fire in a test, yet under the 2^31 - 1 ms ceiling a timer clamps to 1 ms past. */
const NEVER_MS = 2_000_000_000

const intent: TurnInput = { kind: 'intent', text: 'a submit button', session: { turns: [] } }

/** Resolves after `ms`; rejects with the signal's reason the moment it aborts (clearing its timer). */
function sleepOrAbort(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason)
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(signal.reason)
      },
      { once: true },
    )
  })
}

/** One stream call per entry of `outs`: it works for `roundMs` (honouring the signal), then yields its output. */
function slowProvider(roundMs: number, outs: string[]) {
  const signals: Array<AbortSignal | undefined> = []
  const provider: AgentProvider = {
    async *stream(req) {
      const at = signals.length
      signals.push(req.signal)
      await sleepOrAbort(roundMs, req.signal)
      yield outs[Math.min(at, outs.length - 1)]!
    },
  }
  return { provider, signals }
}

async function drain(provider: AgentProvider, opts: Partial<ProduceOptions> = {}): Promise<string[]> {
  const deps: ProduceDeps = { provider, retrieve: () => [], catalog: defaultCatalog }
  const lines: string[] = []
  for await (const line of produce(intent, deps, { maxRounds: 3, ...opts })) lines.push(line)
  return lines
}

/** Starts `drain` and returns its settle state plus a catcher for the rejection. */
function start(provider: AgentProvider, opts: Partial<ProduceOptions> = {}) {
  const state = { settled: false, error: undefined as unknown, lines: undefined as string[] | undefined }
  const done = drain(provider, opts).then(
    (lines) => {
      state.settled = true
      state.lines = lines
    },
    (error: unknown) => {
      state.settled = true
      state.error = error
    },
  )
  return { state, done }
}

describe('produce(): the whole-turn deadline over provider rounds (T-0023)', () => {
  it('exports a generous default (300000 ms)', () => {
    expect(TURN_DEADLINE_MS).toBe(300_000)
  })

  it('(1) three 40000 ms rounds against a 100000 ms deadline: aborts mid round 3 with TurnDeadlineError', async () => {
    const { provider, signals } = slowProvider(40_000, [INVALID])
    const { state, done } = start(provider, { turnDeadlineMs: 100_000 })

    await vi.advanceTimersByTimeAsync(99_999)
    expect(state.settled).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    await done

    expect(state.error).toBeInstanceOf(TurnDeadlineError)
    expect(state.error).not.toBeInstanceOf(ProduceHalt)
    expect(signals).toHaveLength(3) // round 3 was in flight when the deadline fired
    expect(signals[2]?.aborted).toBe(true) // the same abort reaches the provider call
    expect(vi.getTimerCount()).toBe(0)
  })

  it('(2) negative control: the same rounds finish inside a 150000 ms deadline and ship the valid payload', async () => {
    const { provider } = slowProvider(40_000, [INVALID, INVALID, VALID])
    const { state, done } = start(provider, { turnDeadlineMs: 150_000 })

    await vi.advanceTimersByTimeAsync(120_000)
    await done

    expect(state.error).toBeUndefined()
    expect(state.lines?.length).toBeGreaterThan(0)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('(3) no option: a provider that never answers is cut at the default deadline', async () => {
    const { provider } = slowProvider(NEVER_MS, [VALID])
    const { state, done } = start(provider)

    await vi.advanceTimersByTimeAsync(TURN_DEADLINE_MS - 1)
    expect(state.settled).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    await done

    expect(state.error).toBeInstanceOf(TurnDeadlineError)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('(4) a provider that ignores the signal is still cut at the deadline', async () => {
    const stuck: AgentProvider = {
      // eslint-disable-next-line require-yield
      async *stream() {
        await new Promise<never>(() => {})
      },
    }
    const { state, done } = start(stuck, { turnDeadlineMs: 5_000 })

    await vi.advanceTimersByTimeAsync(5_000)
    await done

    expect(state.error).toBeInstanceOf(TurnDeadlineError)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('(5) a caller abort before the deadline keeps its own error and is not relabelled', async () => {
    const { provider } = slowProvider(NEVER_MS, [VALID])
    const caller = new AbortController()
    const { state, done } = start(provider, { turnDeadlineMs: 100_000, signal: caller.signal })

    await vi.advanceTimersByTimeAsync(1_000)
    caller.abort()
    await vi.advanceTimersByTimeAsync(0)
    await done

    expect(state.error).not.toBeInstanceOf(TurnDeadlineError)
    expect((state.error as Error).name).toBe('AbortError')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('(6) the deadline message is plain words and names the limit', () => {
    const msg = new TurnDeadlineError(180_000).userMessage
    expect(msg).toMatch(/180 seconds/)
    expect(msg).not.toMatch(/anthropicProvider|\d ms\b/)
  })
})

describe('withTurnDeadline (T-0023): the wrapper the prose routes and produce() share', () => {
  it('a limit of 0 disables the bound: the source gets the caller signal itself and no timer is armed', async () => {
    const seen: Array<AbortSignal | undefined> = []
    const caller = new AbortController()
    const out: number[] = []
    for await (const n of withTurnDeadline(
      async function* (signal) {
        seen.push(signal)
        expect(vi.getTimerCount()).toBe(0)
        yield 1
      },
      caller.signal,
      0,
    )) {
      out.push(n)
    }
    expect(out).toEqual([1])
    expect(seen[0]).toBe(caller.signal)
  })

  it('a consumer break closes the source and leaves no timer behind', async () => {
    let closed = false
    const it = withTurnDeadline(
      async function* () {
        try {
          yield 1
          yield 2
        } finally {
          closed = true
        }
      },
      undefined,
      10_000,
    )
    for await (const n of it) {
      expect(n).toBe(1)
      break
    }
    expect(closed).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('anthropicProvider under produce(): the deadline covers streams and tool rounds (T-0023)', () => {
  const enc = new TextEncoder()
  const sse = (event: string, data: unknown): string => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  const textFrame = (text: string): Uint8Array =>
    enc.encode(sse('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } }))
  const PING = enc.encode(sse('ping', { type: 'ping' }))
  const STOP = enc.encode(sse('message_stop', { type: 'message_stop' }))
  const TOOL_ROUND = enc.encode(
    sse('message_start', { type: 'message_start', message: { usage: { input_tokens: 1, output_tokens: 1 } } }) +
      sse('content_block_start', {
        type: 'content_block_start',
        index: 0,
        content_block: { type: 'tool_use', id: 'tu_1', name: 'lookup', input: {} },
      }) +
      sse('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: '{}' } }) +
      sse('content_block_stop', { type: 'content_block_stop', index: 0 }) +
      sse('message_delta', { type: 'message_delta', delta: { stop_reason: 'tool_use' }, usage: { output_tokens: 2 } }) +
      sse('message_stop', { type: 'message_stop' }),
  )
  const TOOLS: ToolDef[] = [{ name: 'lookup', description: 'look a thing up', input_schema: { type: 'object' } }]

  /** A response whose body emits `steps` on the fake clock and errors with the signal's reason the moment the
   *  request aborts, as a real fetch body does; its timers are cleared on abort and on cancel. */
  function timedResponse(signal: AbortSignal | null | undefined, steps: Array<{ at: number; chunk?: Uint8Array; close?: boolean }>): Response {
    const timers: Array<ReturnType<typeof setTimeout>> = []
    const clear = (): void => timers.forEach(clearTimeout)
    return new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          for (const step of steps) {
            timers.push(
              setTimeout(() => {
                if (step.chunk) controller.enqueue(step.chunk)
                if (step.close) controller.close()
              }, step.at),
            )
          }
          signal?.addEventListener(
            'abort',
            () => {
              clear()
              controller.error(signal.reason)
            },
            { once: true },
          )
        },
        cancel: clear,
      }),
      { status: 200 },
    )
  }
  /** What a real `fetch` does with a signal that is already aborted. */
  const rejectIfAborted = (init: RequestInit | undefined): void => {
    if (init?.signal?.aborted) throw init.signal.reason
  }

  it('(7) tool rounds that each take 40000 ms: the deadline aborts the in-flight tool call and the loop', async () => {
    const calls = { fetch: 0, tool: 0 }
    const toolSignals: Array<AbortSignal | undefined> = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
        rejectIfAborted(init)
        calls.fetch += 1
        return timedResponse(init?.signal, [{ at: 0, chunk: TOOL_ROUND, close: true }])
      }),
    )
    const executeTool = async (_name: string, _input: Record<string, unknown>, signal?: AbortSignal): Promise<string> => {
      calls.tool += 1
      toolSignals.push(signal)
      await sleepOrAbort(40_000, signal)
      return 'result'
    }
    const { state, done } = start(anthropicProvider({ apiKey: 'k' }), {
      maxRounds: 1,
      turnDeadlineMs: 100_000,
      tools: TOOLS,
      executeTool,
    })

    await vi.advanceTimersByTimeAsync(99_999)
    expect(state.settled).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    await done

    expect(state.error).toBeInstanceOf(TurnDeadlineError)
    expect(calls.tool).toBe(3) // tool rounds at 0, 40000 and 80000 ms; the third was running at 100000
    expect(calls.fetch).toBe(3) // and the aborted signal stopped a fourth request
    expect(toolSignals[2]?.aborted).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('(8) a stream that emits an event every 30000 ms for 150000 ms completes: the stall timer resets per event', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) =>
        timedResponse(init?.signal, [
          { at: 30_000, chunk: PING },
          { at: 60_000, chunk: PING },
          { at: 90_000, chunk: PING },
          { at: 120_000, chunk: PING },
          { at: 150_000, chunk: textFrame(VALID) },
          { at: 150_000, chunk: STOP, close: true },
        ]),
      ),
    )
    const { state, done } = start(anthropicProvider({ apiKey: 'k' }))

    await vi.advanceTimersByTimeAsync(150_000)
    await done

    expect(state.error).toBeUndefined()
    expect(state.lines?.length).toBeGreaterThan(0)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('(9) a stream that only pings never stalls, so the turn deadline is what ends it', async () => {
    // A ping every 30000 ms: well inside the 60000 ms stall window, so the stall guard never fires.
    const pings = Array.from({ length: 10 }, (_, i) => ({ at: (i + 1) * 30_000, chunk: PING }))
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => timedResponse(init?.signal, pings)),
    )
    expect(30_000).toBeLessThan(ANTHROPIC_STALL_TIMEOUT_MS)
    const { state, done } = start(anthropicProvider({ apiKey: 'k' }), { turnDeadlineMs: 100_000 })

    await vi.advanceTimersByTimeAsync(100_000)
    await done

    expect(state.error).toBeInstanceOf(TurnDeadlineError)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('(10) a body that goes silent after its first frame throws StreamStallError and is fetched once', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(textFrame('first'))
            },
          }),
          { status: 200 },
        ),
    )
    vi.stubGlobal('fetch', fetchMock)
    const it = anthropicProvider({ apiKey: 'k' })
      .stream({ model: 'claude-sonnet-5', system: 's', messages: [{ role: 'user', content: 'hi' }] })
      [Symbol.asyncIterator]()
    expect(await it.next()).toEqual({ done: false, value: 'first' })
    const next = it.next()
    const assertion = expect(next).rejects.toBeInstanceOf(StreamStallError)

    await vi.advanceTimersByTimeAsync(ANTHROPIC_STALL_TIMEOUT_MS)
    await assertion
    expect(fetchMock).toHaveBeenCalledTimes(1) // never retried
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('failureMessageFor: what the host writes on the error line (T-0023)', () => {
  it('passes a stall and a deadline through in plain words, never the generic rephrase message', () => {
    for (const err of [new StreamStallError(60_000), new TurnDeadlineError(300_000)]) {
      const msg = failureMessageFor(err)
      expect(msg).not.toBe(GENERIC_FAILURE_MESSAGE)
      expect(msg).toBe(err.userMessage)
      expect(msg).not.toMatch(/anthropicProvider/)
    }
  })

  it('keeps the existing mapping: a ProduceHalt crosses verbatim, anything else is the generic message', () => {
    const halt = new ProduceHalt([{ code: 'SCHEMA', path: 'main:root' }])
    expect(failureMessageFor(halt)).toBe(halt.message)
    expect(failureMessageFor(new Error('anthropicProvider: upstream error 500: {"secret":"x"}'))).toBe(GENERIC_FAILURE_MESSAGE)
    expect(failureMessageFor('not an error')).toBe(GENERIC_FAILURE_MESSAGE)
  })
})
