// live-match.test.ts (T-0430): the shared live-match core (`tools/arena/live-match.ts`) both hosts run.
// Keyless: real model seats, the real recording tap and the real runner, over scripted providers injected
// at the `providerFor` seam, so the seat allowlist, the per-seat budget, the token cap and the abort paths
// are all exercised inside the tested path. Lives under `src/` for the vitest-glob reason `match.test.ts`
// names (a test under `tools/arena/` is not collected).
import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  ARENA_CAPS,
  ARENA_LIVE_MODELS,
  ArenaBudgetExceeded,
  parseArenaRequest,
  resolveArenaSeat,
  startLiveMatch,
  withSeatBudget,
} from '../../tools/arena/live-match.ts'
import type { ArenaCaps } from '../../tools/arena/live-match.ts'
import { MatchAborted } from '../../tools/arena/match.ts'
import { checkIsolation } from '../arena/isolation.ts'
import { parseTranscriptLines, validateTranscript } from '../arena/transcript.ts'
import { PROTOCOL_VERSION } from '../protocol/types.ts'
import type { AgentProvider } from '../../../a2ui/src/agent/agent-transport.ts'
import type { ProvidersConfig } from '../../../a2ui/tools/agent/providers-config.ts'
import type { Mark } from '../arena/board.ts'

declare const process: { cwd(): string }

const config = JSON.parse(readFileSync(`${process.cwd()}/packages/agent-ui/a2ui/tools/agent/providers.json`, 'utf8') as string) as ProvidersConfig
const PAGE_PAIR = { X: { provider: 'anthropic', model: 'claude-sonnet-5-5' }, O: { provider: 'anthropic', model: 'claude-haiku-5-5' } }

/** A stateless scripted seat model: reads its mark from the system prompt and the legal moves from the
 * current board message, and plays the first legal cell in its preference order. X: 0,1,2 (a top-row win);
 * O: 3,4,5. Nothing is remembered across calls, so it shares no state between seats. */
function scriptedProvider(seen?: Record<string, unknown>[]): AgentProvider {
  return {
    async *stream(req) {
      seen?.push(req as unknown as Record<string, unknown>)
      const mark = req.system.includes('as "X"') ? 'X' : 'O'
      const board = JSON.parse(req.messages.at(-1)!.content) as { legalMoves: number[] }
      const prefs = mark === 'X' ? [0, 1, 2, 6, 7, 8, 3, 4, 5] : [3, 4, 5, 6, 7, 8, 0, 1, 2]
      yield JSON.stringify({ move: prefs.find((c) => board.legalMoves.includes(c)) })
    },
  }
}

function linesOf(written: string[]): string[] {
  return written.map((l) => l.replace(/\n$/, ''))
}

async function runScripted(providers: Record<Mark, AgentProvider>, caps?: ArenaCaps): Promise<{ written: string[]; header: unknown }> {
  const written: string[] = []
  const result = await startLiveMatch({
    seats: { X: { provider: providers.X, selection: PAGE_PAIR.X }, O: { provider: providers.O, selection: PAGE_PAIR.O } },
    write: (line) => written.push(line),
    signal: new AbortController().signal,
    ...(caps !== undefined ? { caps } : {}),
  })
  return { written, header: result.header }
}

describe('parseArenaRequest + resolveArenaSeat: the seat allowlist and key resolution (T-0430)', () => {
  const env = { ANTHROPIC_API_KEY: 'sk-test' }

  it('a body without both {provider, model} seats is a 400', () => {
    expect(parseArenaRequest({ seats: { X: PAGE_PAIR.X } })).toEqual({ ok: false, status: 400, error: 'seat O: missing {provider, model}' })
    expect(parseArenaRequest(null).ok).toBe(false)
  })

  it('the page pair is accepted and the key, endpoint and workspaceId reach providerFor', () => {
    const providerFor = vi.fn(() => ({ ok: true as const, provider: scriptedProvider() }))
    const parsed = parseArenaRequest({ seats: PAGE_PAIR })
    expect(parsed.ok).toBe(true)
    for (const mark of ['X', 'O'] as const) {
      const seat = resolveArenaSeat(config, env, PAGE_PAIR[mark], mark, { providerFor, workspaceId: 'ws-1' })
      expect(seat.ok).toBe(true)
    }
    expect(providerFor).toHaveBeenCalledWith('anthropic', { apiKey: 'sk-test', endpoint: config.providers['anthropic']!.endpoint, workspaceId: 'ws-1' })
  })

  it('a providers.json model outside the arena pair (claude-opus-5-5) is a 400 and no provider is built', () => {
    expect(config.providers['anthropic']!.models.some((m) => m.id === 'claude-opus-5-5')).toBe(true) // registered, so only the arena allowlist stops it
    expect(ARENA_LIVE_MODELS).not.toContain('claude-opus-5-5')
    const providerFor = vi.fn(() => ({ ok: true as const, provider: scriptedProvider() }))
    const seat = resolveArenaSeat(config, env, { provider: 'anthropic', model: 'claude-opus-5-5' }, 'X', { providerFor })
    expect(seat).toMatchObject({ ok: false, status: 400 })
    expect(providerFor).not.toHaveBeenCalled()
  })

  it('an unregistered pair is a 400; a missing key is a 503', () => {
    const providerFor = vi.fn(() => ({ ok: true as const, provider: scriptedProvider() }))
    expect(resolveArenaSeat(config, env, { provider: 'anthropic', model: 'no-such-model' }, 'X', { providerFor })).toMatchObject({ ok: false, status: 400 })
    expect(resolveArenaSeat(config, {}, PAGE_PAIR.X, 'X', { providerFor })).toEqual({ ok: false, status: 503, error: 'seat X: no-key' })
    expect(providerFor).not.toHaveBeenCalled()
  })
})

describe('withSeatBudget: the per-seat call and reply caps (T-0430)', () => {
  const req = () => ({ model: 'stub', system: 's', messages: [{ role: 'user' as const, content: '{}' }] })
  async function drain(p: AgentProvider): Promise<string> {
    let out = ''
    for await (const f of p.stream(req())) out += f
    return out
  }

  it('the 11th call with maxCallsPerSeat 10 throws before reaching the inner provider', async () => {
    let innerCalls = 0
    const inner: AgentProvider = {
      async *stream() {
        innerCalls += 1
        yield '{"move": 0}'
      },
    }
    const budgeted = withSeatBudget(inner, { maxCallsPerSeat: 10, maxReplyChars: 2048 })
    for (let i = 0; i < 10; i++) await drain(budgeted)
    await expect(drain(budgeted)).rejects.toBeInstanceOf(ArenaBudgetExceeded)
    expect(innerCalls).toBe(10)
  })

  it('a reply over maxReplyChars aborts the inner stream and throws', async () => {
    let innerSignal: AbortSignal | undefined
    const inner: AgentProvider = {
      async *stream(r) {
        innerSignal = r.signal
        for (let i = 0; i < 100; i++) yield 'x'.repeat(100)
      },
    }
    const err = await drain(withSeatBudget(inner, { maxCallsPerSeat: 9, maxReplyChars: 2048 })).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ArenaBudgetExceeded)
    expect((err as ArenaBudgetExceeded).limit).toBe('reply-chars')
    expect(innerSignal?.aborted).toBe(true)
  })

  it('a call cap the seat exceeds ends the match with a game end forfeit (provider-error), the referee unchanged', async () => {
    const provider = scriptedProvider()
    const { written } = await runScripted({ X: provider, O: provider }, { ...ARENA_CAPS, maxCallsPerSeat: 2 })
    const last = JSON.parse(linesOf(written).at(-1)!) as { game?: { kind: string; reason: { kind: string; loser: Mark; cause: string } } }
    expect(last.game?.kind).toBe('end')
    expect(last.game?.reason).toEqual({ kind: 'forfeit', loser: 'X', cause: 'provider-error' })
  })

  it('a reply over the char cap ends the match with a game end forfeit (provider-error)', async () => {
    const chatty: AgentProvider = {
      async *stream() {
        yield JSON.stringify({ move: 4, note: 'n'.repeat(3000) })
      },
    }
    const { written } = await runScripted({ X: chatty, O: scriptedProvider() })
    const last = JSON.parse(linesOf(written).at(-1)!) as { game?: { kind: string; reason: { kind: string; loser: Mark; cause: string } } }
    expect(last.game?.reason).toEqual({ kind: 'forfeit', loser: 'X', cause: 'provider-error' })
  })
})

describe('startLiveMatch: header first, one line per event, caps and abort (T-0430)', () => {
  it('writes the header first, byte-equal to the MatchResult header, then lines that validate and check isolation clean', async () => {
    const { written, header } = await runScripted({ X: scriptedProvider(), O: scriptedProvider() })
    const lines = linesOf(written)
    expect(lines[0]).toBe(JSON.stringify(header))
    expect(written.every((l) => l.endsWith('\n'))).toBe(true)
    expect(validateTranscript(lines, { protocolVersion: PROTOCOL_VERSION })).toEqual([])
    const transcript = parseTranscriptLines(lines)!
    expect(checkIsolation(transcript)).toEqual([])
    expect(JSON.parse(lines.at(-1)!)).toEqual({ game: { kind: 'end', reason: { kind: 'win', winner: 'X' } } })
  })

  it('every provider call carries modelSettings.maxTokens = ARENA_CAPS.maxOutputTokens', async () => {
    const seen: Record<string, unknown>[] = []
    await runScripted({ X: scriptedProvider(seen), O: scriptedProvider(seen) })
    expect(seen.length).toBeGreaterThan(0)
    for (const req of seen) expect(req['modelSettings']).toEqual({ maxTokens: ARENA_CAPS.maxOutputTokens })
  })

  it('a shared leaky provider under the budget wrapper is still caught by the isolation gate (the wrapper keeps the request object)', async () => {
    let first: string | undefined
    const leaky: AgentProvider = {
      async *stream(req) {
        if (first === undefined) first = req.system
        else req.system = `${req.system}\n[co-mingled]: ${first}`
        yield* scriptedProvider().stream(req)
      },
    }
    const { written } = await runScripted({ X: leaky, O: leaky })
    const failures = checkIsolation(parseTranscriptLines(linesOf(written))!)
    expect(failures.some((f) => f.check === 'canary')).toBe(true)
  })

  it('an abort mid-match throws MatchAborted, reaches the in-flight provider call, and writes no game end', async () => {
    const controller = new AbortController()
    let sawAbort = false
    const hanging: AgentProvider = {
      async *stream(req) {
        await new Promise<void>((resolve) => {
          req.signal?.addEventListener('abort', () => {
            sawAbort = true
            resolve()
          })
          setTimeout(() => controller.abort(), 0)
        })
        throw new Error('aborted upstream')
      },
    }
    const written: string[] = []
    const run = startLiveMatch({
      seats: { X: { provider: scriptedProvider(), selection: PAGE_PAIR.X }, O: { provider: hanging, selection: PAGE_PAIR.O } },
      write: (line) => written.push(line),
      signal: controller.signal,
    })
    await expect(run).rejects.toBeInstanceOf(MatchAborted)
    expect(sawAbort).toBe(true)
    expect(written.length).toBeGreaterThan(1) // the header and X's first move went out before the abort
    expect(written.some((l) => l.includes('"kind":"end"'))).toBe(false)
  })

  it('the whole-match deadline aborts the same way: MatchAborted, no game end', async () => {
    const stalled: AgentProvider = {
      async *stream(req) {
        await new Promise<void>((resolve) => req.signal?.addEventListener('abort', () => resolve()))
        throw new Error('aborted upstream')
      },
    }
    const written: string[] = []
    const run = startLiveMatch({
      seats: { X: { provider: stalled, selection: PAGE_PAIR.X }, O: { provider: stalled, selection: PAGE_PAIR.O } },
      write: (line) => written.push(line),
      signal: new AbortController().signal,
      caps: { ...ARENA_CAPS, matchDeadlineMs: 20 },
    })
    await expect(run).rejects.toBeInstanceOf(MatchAborted)
    expect(written.some((l) => l.includes('"kind":"end"'))).toBe(false)
  })
})
