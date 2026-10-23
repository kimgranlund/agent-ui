// arena-route.test.ts (T-0430): the Worker's `/__a2a/arena` route (`arena-route.ts`), driven keylessly
// through its injected deps: a stub limiter, a stub key validator, and scripted seat models injected at the
// `providerFor` seam, so the real core, model seats, recording tap, budget and runner all run. Covers the
// POST gate order, the fail-closed limiter, a full streamed match that validates and checks isolation
// clean, cancel reaching the in-flight provider call, and the gate still biting on a leaky provider.
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { arenaLimiterFrom, handleArenaRequest } from './arena-route.ts'
import type { ArenaLimiter, ArenaRouteDeps } from './arena-route.ts'
import type { ProvidersConfig } from '../providers-config.ts'
import type { AgentProvider } from '../../../src/agent/agent-transport.ts'
import { checkIsolation } from '../../../../a2a/src/arena/isolation.ts'
import { parseTranscriptLines, validateTranscript } from '../../../../a2a/src/arena/transcript.ts'
import { PROTOCOL_VERSION } from '../../../../a2a/src/protocol/types.ts'

const ORIGIN = 'https://ui.nonoun.io'
const config = JSON.parse(readFileSync(new URL('../providers.json', import.meta.url), 'utf8')) as ProvidersConfig
// The page's exact pair (site/pages/a2a-tic-tac-toe.ts), so a drift from the arena allowlist reds here.
const PAGE_PAIR = { X: { provider: 'anthropic', model: 'claude-sonnet-5-5' }, O: { provider: 'anthropic', model: 'claude-haiku-5-5' } }

/** Stateless scripted seat model: X plays 0,1,2 and O plays 3,4,5, first legal cell in order. */
function scriptedProvider(onCall?: (req: Parameters<AgentProvider['stream']>[0]) => void | Promise<void>): AgentProvider {
  return {
    async *stream(req) {
      await onCall?.(req)
      const mark = req.system.includes('as "X"') ? 'X' : 'O'
      const board = JSON.parse(req.messages.at(-1)!.content) as { legalMoves: number[] }
      const prefs = mark === 'X' ? [0, 1, 2, 6, 7, 8, 3, 4, 5] : [3, 4, 5, 6, 7, 8, 0, 1, 2]
      yield JSON.stringify({ move: prefs.find((c) => board.legalMoves.includes(c)) })
    },
  }
}

function allowAll(): ArenaLimiter & { limit: ReturnType<typeof vi.fn> } {
  return { limit: vi.fn(async () => ({ success: true })) }
}

function deps(over: Partial<ArenaRouteDeps> = {}, provider: AgentProvider = scriptedProvider()): ArenaRouteDeps {
  return {
    config,
    env: { ANTHROPIC_API_KEY: 'sk-test' },
    limiter: allowAll(),
    allowedOrigin: ORIGIN,
    providerFor: () => ({ ok: true, provider }),
    validateKey: vi.fn(async () => true),
    ...over,
  }
}

function post(body: unknown = { seats: PAGE_PAIR }, headers: Record<string, string> = { origin: ORIGIN }, signal?: AbortSignal): Request {
  return new Request(`${ORIGIN}/__a2a/arena`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.7', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
    ...(signal !== undefined ? { signal } : {}),
  })
}

function lines(text: string): string[] {
  return text.split('\n').filter((l) => l.length > 0)
}

describe('arenaLimiterFrom', () => {
  it('finds a bound limiter and answers undefined for none or a non-binding value', () => {
    const limiter = allowAll()
    expect(arenaLimiterFrom({ ARENA_RATE_LIMITER: limiter })).toBe(limiter)
    expect(arenaLimiterFrom({})).toBeUndefined()
    expect(arenaLimiterFrom({ ARENA_RATE_LIMITER: 'not-a-binding' })).toBeUndefined()
  })
})

describe('GET /status (fail closed on the limiter, checked first)', () => {
  it('no limiter bound: available false, and the key is never validated upstream', async () => {
    const d = deps({ limiter: undefined })
    const res = await handleArenaRequest(new Request(`${ORIGIN}/__a2a/arena/status`), '/status', d)
    expect(await res.json()).toEqual({ available: false, providers: 0 })
    expect(d.validateKey).not.toHaveBeenCalled()
  })

  it('limiter bound and the arena provider key validates: available true', async () => {
    const res = await handleArenaRequest(new Request(`${ORIGIN}/__a2a/arena/status`), '/status', deps())
    expect(await res.json()).toEqual({ available: true, providers: 1 })
  })

  it('limiter bound but the key fails validation: available false', async () => {
    const res = await handleArenaRequest(new Request(`${ORIGIN}/__a2a/arena/status`), '/status', deps({ validateKey: vi.fn(async () => false) }))
    expect(await res.json()).toEqual({ available: false, providers: 0 })
  })
})

describe('POST gate order: origin, then limiter, then body, then seats', () => {
  it('a cross-origin POST is a 403 and the limiter is never called', async () => {
    const d = deps()
    const res = await handleArenaRequest(post(undefined, { origin: 'https://evil.example' }), '/', d)
    expect(res.status).toBe(403)
    expect((d.limiter as ReturnType<typeof allowAll>).limit).not.toHaveBeenCalled()
  })

  it('a refused limiter is a 429 with retry-after 60, keyed by cf-connecting-ip, and the body is never read', async () => {
    const limiter = { limit: vi.fn(async () => ({ success: false })) }
    const request = post()
    const res = await handleArenaRequest(request, '/', deps({ limiter }))
    expect(res.status).toBe(429)
    expect(res.headers.get('retry-after')).toBe('60')
    expect(limiter.limit).toHaveBeenCalledWith({ key: '203.0.113.7' })
    expect(request.bodyUsed).toBe(false)
  })

  it('no limiter bound: POST is a 503 and no match runs', async () => {
    const providerFor = vi.fn()
    const res = await handleArenaRequest(post(), '/', deps({ limiter: undefined, providerFor }))
    expect(res.status).toBe(503)
    expect(providerFor).not.toHaveBeenCalled()
  })

  it('a body over 64 KiB is a 413', async () => {
    const res = await handleArenaRequest(post('x'.repeat((1 << 16) + 1)), '/', deps())
    expect(res.status).toBe(413)
  })

  it('a seat model outside the arena pair (claude-opus-5-5) is a 400 before any provider is built', async () => {
    const providerFor = vi.fn()
    const res = await handleArenaRequest(post({ seats: { X: { provider: 'anthropic', model: 'claude-opus-5-5' }, O: PAGE_PAIR.O } }), '/', deps({ providerFor }))
    expect(res.status).toBe(400)
    expect(providerFor).not.toHaveBeenCalled()
  })

  it('no key is a 503', async () => {
    const res = await handleArenaRequest(post(), '/', deps({ env: {} }))
    expect(res.status).toBe(503)
  })
})

describe('POST streams a full match (the same wire the dev proxy writes)', () => {
  it('answers 200 application/x-ndjson whose lines validate, check isolation clean and end with game end', async () => {
    const res = await handleArenaRequest(post(), '/', deps())
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/x-ndjson')
    const ls = lines(await res.text())
    expect(validateTranscript(ls, { protocolVersion: PROTOCOL_VERSION })).toEqual([])
    expect(checkIsolation(parseTranscriptLines(ls)!)).toEqual([])
    expect(JSON.parse(ls.at(-1)!)).toMatchObject({ game: { kind: 'end' } })
  })

  it('negative control: a shared leaky provider yields isolation failures (the gate still bites on the live path)', async () => {
    let first: string | undefined
    const leaky: AgentProvider = {
      async *stream(req) {
        if (first === undefined) first = req.system
        else req.system = `${req.system}\n[co-mingled]: ${first}`
        yield* scriptedProvider().stream(req)
      },
    }
    const res = await handleArenaRequest(post(), '/', deps({}, leaky))
    const ls = lines(await res.text())
    expect(validateTranscript(ls, { protocolVersion: PROTOCOL_VERSION })).toEqual([])
    expect(checkIsolation(parseTranscriptLines(ls)!).length).toBeGreaterThan(0)
  })
})

describe('cancel reaches the in-flight provider call', () => {
  /** A provider whose O seat hangs until its signal aborts, recording what it saw. */
  function hangingOnO(): { provider: AgentProvider; calls: () => number; sawAbort: Promise<void> } {
    let calls = 0
    let markAbort!: () => void
    const sawAbort = new Promise<void>((r) => (markAbort = r))
    const provider = scriptedProvider(async (req) => {
      calls += 1
      if (!req.system.includes('as "O"')) return
      await new Promise<void>((resolve) =>
        req.signal?.addEventListener('abort', () => {
          markAbort()
          resolve()
        }),
      )
      throw new Error('aborted upstream')
    })
    return { provider, calls: () => calls, sawAbort }
  }

  it('the request signal aborting mid-match aborts the provider signal, starts no further call, and writes no game end', async () => {
    const h = hangingOnO()
    const client = new AbortController()
    const res = await handleArenaRequest(post(undefined, undefined, client.signal), '/', deps({}, h.provider))
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let text = ''
    while (h.calls() < 2) {
      const { value, done } = await reader.read()
      if (done) break
      text += decoder.decode(value)
    }
    client.abort()
    await h.sawAbort
    const callsAtAbort = h.calls()
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      text += decoder.decode(value)
    }
    expect(h.calls()).toBe(callsAtAbort)
    expect(text).not.toContain('"kind":"end"')
  })

  it('the visitor cancelling the body reader aborts the in-flight provider call at once', async () => {
    const h = hangingOnO()
    const res = await handleArenaRequest(post(), '/', deps({}, h.provider))
    const reader = res.body!.getReader()
    while (h.calls() < 2) {
      const { done } = await reader.read()
      if (done) break
    }
    await reader.cancel()
    await h.sawAbort
    expect(h.calls()).toBe(2)
  })
})
