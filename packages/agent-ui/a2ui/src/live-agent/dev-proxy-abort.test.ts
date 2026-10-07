// dev-proxy-abort.test.ts (GH #1797, gap (a)): a client disconnect mid-turn aborts the dev proxy's
// per-request turn signal on BOTH POST arms (`/chat` and produce), the twin of the Worker's
// `request.signal`. Drives the REAL dev-proxy middleware with the provider dispatch module mocked (the
// chat-route.test.ts precedent) and a hand-rolled `res` whose `close` event the test fires. A live
// Vite/Node socket close stays manual acceptance (chat-route.test.ts header). T-0024 (GH #1797 follow-up)
// adds the `/chat` failure body: a stall, a deadline or an upstream fault thrown by the provider answers
// 500 with the host's plain-words line (`failureMessageFor`), never the raw `err.message`.

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { a2uiDevProxyPlugin } from '../../tools/agent/dev-proxy-plugin.ts'
import { GENERIC_FAILURE_MESSAGE } from '../../tools/agent/chat-validation.ts'
import { StreamStallError } from '../agent/providers/anthropic.ts'
import { TURN_DEADLINE_MS, TurnDeadlineError } from '../agent/deadlines.ts'

declare const process: { cwd(): string; env: Record<string, string | undefined> }

const state = vi.hoisted(() => ({
  requests: [] as Array<Record<string, unknown>>,
  mode: 'hang' as 'hang' | 'complete' | 'throw',
  settled: 0,
  error: undefined as unknown,
}))

// vitest hoists vi.mock above the imports; the factory may only close over `vi.hoisted` state.
vi.mock('../../tools/agent/providers/index.ts', () => ({
  providerFor: () => ({
    ok: true,
    provider: {
      // `hang` parks until the turn signal aborts, then throws the AbortError a real fetch would.
      // `complete` yields one note-only meta-line (mcp-enablement.test.ts precedent): a clean one-round
      // produce success, and plain buffered text on `/chat`.
      async *stream(req: Record<string, unknown>) {
        state.requests.push(req)
        try {
          if (state.mode === 'complete') {
            yield '{"a2uiMeta":{"note":"ok"}}'
            return
          }
          // `throw` fails the way the real adapter does: the whole stream call rejects with `state.error`.
          if (state.mode === 'throw') throw state.error
          const signal = req['signal'] as AbortSignal | undefined
          if (signal === undefined) return
          if (!signal.aborted) await new Promise<void>((r) => signal.addEventListener('abort', () => r(), { once: true }))
          throw new DOMException('The operation was aborted.', 'AbortError')
        } finally {
          state.settled += 1
        }
      },
    },
  }),
}))

type Middleware = (req: unknown, res: unknown) => void

let handler: Middleware
let previousKey: string | undefined

beforeAll(() => {
  // The plugin captures `process.env` by reference when built; its `config` hook (the `loadEnv` merge) is
  // deliberately NOT invoked, so the developer's real `.env` is never read.
  previousKey = process.env['ANTHROPIC_API_KEY']
  process.env['ANTHROPIC_API_KEY'] = 'sk-test-value'
  const plugin = a2uiDevProxyPlugin()
  const server = {
    middlewares: {
      use: (_mount: string, fn: Middleware) => {
        handler = fn
      },
    },
  }
  ;(plugin.configureServer as unknown as (s: unknown) => void)(server)
})

afterAll(() => {
  if (previousKey === undefined) delete process.env['ANTHROPIC_API_KEY']
  else process.env['ANTHROPIC_API_KEY'] = previousKey
})

beforeEach(() => {
  state.requests.length = 0
  state.mode = 'hang'
  state.settled = 0
  state.error = undefined
})

interface FakeRes {
  statusCode: number
  headersSent: boolean
  writableEnded: boolean
  destroyed: boolean
  writes: string[]
  ended: Array<string | undefined>
  setHeader: (k: string, v: string) => void
  on: (event: string, cb: () => void) => void
  write: (chunk: string) => boolean
  end: (payload?: string) => void
}

/** Start one POST turn; return the fake `res`, a promise for its first `end`, and a `close` emitter. */
function start(url: string, body: unknown): { res: FakeRes; done: Promise<void>; emitClose: () => void } {
  const reqListeners: Record<string, Array<(arg?: unknown) => void>> = {}
  const req = {
    method: 'POST',
    url,
    on(event: string, cb: (arg?: unknown) => void) {
      ;(reqListeners[event] ??= []).push(cb)
      if (event === 'end') {
        queueMicrotask(() => {
          for (const fn of reqListeners['data'] ?? []) fn(JSON.stringify(body))
          for (const fn of reqListeners['end'] ?? []) fn()
        })
      }
    },
  }
  const resListeners: Record<string, Array<() => void>> = {}
  let settle: () => void = () => {}
  const done = new Promise<void>((resolve) => {
    settle = resolve
  })
  const res: FakeRes = {
    statusCode: 0,
    headersSent: false,
    writableEnded: false,
    destroyed: false,
    writes: [],
    ended: [],
    setHeader: () => {},
    on: (event, cb) => {
      ;(resListeners[event] ??= []).push(cb)
    },
    write: (chunk) => {
      res.writes.push(chunk)
      return true
    },
    end: (payload) => {
      res.ended.push(payload)
      res.writableEnded = true
      settle()
    },
  }
  const emitClose = (): void => {
    for (const fn of resListeners['close'] ?? []) fn()
  }
  handler(req, res)
  return { res, done, emitClose }
}

const CHAT_BODY = { system: 'be helpful', model: 'claude-sonnet-5', messages: [] }
const PRODUCE_BODY = { input: { kind: 'intent', text: 'a submit button', session: { turns: [] } }, provider: 'anthropic', model: 'claude-sonnet-5' }

/** Drive one hanging turn to its provider call, disconnect, and return what the route did afterwards. */
async function disconnectMidTurn(url: string, body: unknown): Promise<{ res: FakeRes; writesBefore: number; endedBefore: number }> {
  state.mode = 'hang'
  const { res, emitClose } = start(url, body)
  await vi.waitFor(() => expect(state.requests.length).toBeGreaterThan(0), { timeout: 2000, interval: 5 })
  const signal = state.requests[0]?.['signal']
  expect(signal).toBeInstanceOf(AbortSignal)
  expect((signal as AbortSignal).aborted).toBe(false)
  const writesBefore = res.writes.length
  const endedBefore = res.ended.length
  res.destroyed = true
  emitClose()
  expect((signal as AbortSignal).aborted).toBe(true)
  await vi.waitFor(() => expect(state.settled).toBeGreaterThanOrEqual(1), { timeout: 2000, interval: 5 })
  await new Promise((r) => setTimeout(r, 0))
  return { res, writesBefore, endedBefore }
}

/** Drive one turn to a normal finish, then fire `close` the way Node does after a completed response. */
async function completeThenClose(url: string, body: unknown): Promise<void> {
  state.mode = 'complete'
  const { res, done, emitClose } = start(url, body)
  await done
  expect(res.statusCode).toBe(200)
  emitClose()
  const signal = state.requests[0]?.['signal']
  expect(signal).toBeInstanceOf(AbortSignal)
  expect((signal as AbortSignal).aborted).toBe(false)
}

describe('dev proxy turn abort on client disconnect (GH #1797)', () => {
  it('/chat: a client disconnect mid-turn aborts the turn signal', async () => {
    const { res, writesBefore, endedBefore } = await disconnectMidTurn('/chat', CHAT_BODY)
    expect(res.writes.length).toBe(writesBefore)
    expect(endedBefore).toBe(0)
    // No `{text}` and no outer-catch 500: an aborted turn writes nothing to the closed response.
    expect(res.ended).toEqual([])
  })

  it('produce: a client disconnect mid-turn aborts the turn signal', async () => {
    const { res, writesBefore } = await disconnectMidTurn('/produce', PRODUCE_BODY)
    // No terminal error meta-line after the disconnect; the response is only closed out, never written.
    expect(res.writes.length).toBe(writesBefore)
    for (const payload of res.ended) expect(payload).toBeUndefined()
  })

  it('/chat: a completed response never aborts the turn signal (negative control)', async () => {
    await completeThenClose('/chat', CHAT_BODY)
  })

  it('produce: a completed response never aborts the turn signal (negative control)', async () => {
    await completeThenClose('/produce', PRODUCE_BODY)
  })
})

/** Drive one `/chat` turn whose provider throws `error`; return the route's single JSON answer. */
async function chatFailure(error: unknown): Promise<{ status: number; payload: string; body: { error?: unknown } }> {
  state.mode = 'throw'
  state.error = error
  const { res, done } = start('/chat', CHAT_BODY)
  await done
  expect(res.ended).toHaveLength(1)
  const payload = res.ended[0] as string
  return { status: res.statusCode, payload, body: JSON.parse(payload) as { error?: unknown } }
}

describe('dev proxy /chat failure body: plain words, never the raw error (T-0024)', () => {
  it('a stalled stream answers 500 with the stall userMessage', async () => {
    const err = new StreamStallError(60_000)
    const out = await chatFailure(err)
    expect(out.status).toBe(500)
    expect(out.body.error).toBe(err.userMessage)
    expect(out.payload).not.toContain(err.message) // the log line (adapter name, milliseconds) stays server-side
    expect(out.body.error).not.toBe(GENERIC_FAILURE_MESSAGE)
  })

  it('the whole-turn deadline answers 500 with the deadline userMessage', async () => {
    const err = new TurnDeadlineError(TURN_DEADLINE_MS)
    const out = await chatFailure(err)
    expect(out.status).toBe(500)
    expect(out.body.error).toBe(err.userMessage)
    expect(out.payload).not.toContain(err.message)
    expect(out.body.error).not.toBe(GENERIC_FAILURE_MESSAGE)
  })

  it('negative control: an upstream fault keeps the 500 but its raw body never reaches the client', async () => {
    const out = await chatFailure(new Error('anthropicProvider: upstream error 500: {"secret":"x"}'))
    expect(out.status).toBe(500)
    expect(out.body.error).toBe(GENERIC_FAILURE_MESSAGE)
    expect(out.payload).not.toMatch(/anthropicProvider|secret/)
  })
})
