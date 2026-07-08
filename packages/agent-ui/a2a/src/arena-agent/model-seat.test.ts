// model-seat.test.ts — LLD-C6 checkpoint (SPEC-R11 AC1 stubbed; SPEC-R10): stub-provider legal/malformed/
// abort replies, the byte-complete recording assertion (a capturing stub proving recorded context ≡ the
// actual request bytes, LLD §2), and the OUT-OF-TRANSCRIPT negative control (a deliberately leaky shared
// provider stub co-mingling context BELOW the seat seam — the second committed negative control, LLD-C9).
// Lives under `src/` (not `tools/`) for the same vitest-glob reason as `match.test.ts` (a2ui
// `src/live-agent/*.test.ts` precedent).
import { describe, expect, it } from 'vitest'
// @ts-expect-error - node:fs untyped without @types/node (fleet-wide precedent, e.g. build-key-safety.test.ts)
import { readFileSync, writeFileSync } from 'node:fs'
import { createModelSeat, parseMoveReply, buildSeatPrompt } from '../../tools/arena/seats/model.ts'
import { runMatch } from '../../tools/arena/match.ts'
import { deriveCanary } from '../../tools/arena/canary.ts'
import { checkIsolation } from '../arena/isolation.ts'
import { parseTranscriptLines, serializeTranscript, validateTranscript } from '../arena/transcript.ts'
import { PROTOCOL_VERSION } from '../protocol/types.ts'
import type { AgentProvider, Turn } from '../../../a2ui/tools/agent/agent-transport.ts'
import type { BoardMessage } from '../arena/referee.ts'

declare const process: { cwd(): string }

function boardMsg(over: Partial<BoardMessage> = {}): BoardMessage {
  return { board: Array(9).fill(null), yourMark: 'X', lastOpponentMove: null, legalMoves: [0, 1, 2, 3, 4, 5, 6, 7, 8], status: 'your-turn', ...over }
}

function stubProvider(reply: string | (() => string)): AgentProvider {
  return {
    async *stream() {
      yield typeof reply === 'function' ? reply() : reply
    },
  }
}

function throwingProvider(message: string): AgentProvider {
  return {
    // eslint-disable-next-line require-yield -- the stub deliberately throws before ever yielding
    async *stream() {
      throw new Error(message)
    },
  }
}

describe('parseMoveReply (LLD-C6)', () => {
  it('parses a bare JSON move', () => {
    expect(parseMoveReply('{"move": 4}')).toEqual({ move: 4 })
  })
  it('parses move+note', () => {
    expect(parseMoveReply('{"move": 4, "note": "center"}')).toEqual({ move: 4, note: 'center' })
  })
  it('tolerates a wrapping code fence', () => {
    expect(parseMoveReply('```json\n{"move": 2}\n```')).toEqual({ move: 2 })
  })
  it('returns undefined on unparseable / wrong-shaped output — never throws', () => {
    expect(() => parseMoveReply('not json at all')).not.toThrow()
    expect(parseMoveReply('not json at all')).toBeUndefined()
    expect(parseMoveReply('{"move": "four"}')).toBeUndefined()
    expect(parseMoveReply('{}')).toBeUndefined()
  })
})

describe('createModelSeat (LLD-C6) — stub-provider replies', () => {
  it('a legal move parses cleanly', async () => {
    const seat = createModelSeat({ mark: 'X', canary: 'CANARY-1', provider: stubProvider('{"move": 4}'), model: 'stub' })
    expect(await seat.respond(boardMsg())).toEqual({ kind: 'move', move: { move: 4 } })
  })

  it('an unparseable reply is reported malformed — the referee owns the retry, not this seat', async () => {
    const seat = createModelSeat({ mark: 'X', canary: 'CANARY-1', provider: stubProvider('garbage'), model: 'stub' })
    const reply = await seat.respond(boardMsg())
    expect(reply.kind).toBe('malformed')
  })

  it('a provider throw is reported as an abort (provider-error), never an uncaught rejection', async () => {
    const seat = createModelSeat({ mark: 'X', canary: 'CANARY-1', provider: throwingProvider('upstream 500'), model: 'stub' })
    const reply = await seat.respond(boardMsg())
    expect(reply).toEqual({ kind: 'abort', cause: 'provider-error', detail: expect.stringContaining('upstream 500') })
  })

  it('pullContext drains system (position 0), then one user+assistant pair per turn', async () => {
    const seat = createModelSeat({ mark: 'X', canary: 'CANARY-1', provider: stubProvider('{"move": 0}'), model: 'stub' })
    await seat.respond(boardMsg())
    const ctx = seat.pullContext()
    expect(ctx.map((e) => e.role)).toEqual(['system', 'user', 'assistant'])
    expect(seat.pullContext()).toEqual([]) // drained — a second pull is empty
  })
})

describe('byte-complete recording (LLD §2) — the recorded context ≡ the actual request bytes', () => {
  it('a capturing stub proves the recorded user/assistant entries are byte-identical to what it actually received/sent', async () => {
    const captured: { system: string; messages: Turn[] }[] = []
    const provider: AgentProvider = {
      async *stream(req) {
        // Snapshot `messages` (a SHALLOW copy) at capture time. `req.messages` is a per-message CLONE the
        // seat built for THIS call (review finding 2 — never its live `turns` array/objects), so this
        // snapshot is belt-and-suspenders rather than load-bearing here; it stays regardless, matching the
        // discipline every other stub in this file follows.
        captured.push({ system: req.system, messages: req.messages.slice() })
        yield '{"move": 4}'
      },
    }
    const canary = 'CANARY-BYTE-COMPLETE'
    const seat = createModelSeat({ mark: 'X', canary, provider, model: 'stub' })
    const input = boardMsg()
    const reply = await seat.respond(input)
    expect(reply).toEqual({ kind: 'move', move: { move: 4 } })

    const ctx = seat.pullContext()
    expect(captured).toHaveLength(1)
    // system entry (index 0) matches EXACTLY what the stub's request carried
    expect(ctx[0]).toEqual({ role: 'system', content: captured[0]!.system })
    expect(ctx[0]!.content).toBe(buildSeatPrompt('X', canary))
    // user entry matches the LAST message in the actual request, byte-for-byte
    expect(ctx[1]).toEqual({ role: 'user', content: captured[0]!.messages.at(-1)!.content })
    expect(ctx[1]!.content).toBe(JSON.stringify(input))
    // assistant entry matches the raw response text exactly
    expect(ctx[2]).toEqual({ role: 'assistant', content: '{"move": 4}' })
  })
})

describe('historical-message divergence (review finding 2) — a below-seam mutation to a NON-LAST request message', () => {
  it('a leaky provider stub that mutates a HISTORICAL (non-last) message is caught, not just a system-level co-mingle', async () => {
    let callIndex = 0
    const provider: AgentProvider = {
      async *stream(req) {
        // BELOW-SEAM leak: on the SECOND call, mutate the FIRST (historical, non-last) message in place —
        // deliberately never the current turn's own last message and never `system` — the exact class the
        // old `.at(-1)`-only comparison could never see.
        if (callIndex === 1 && req.messages.length > 1) {
          req.messages[0] = { ...req.messages[0]!, content: `${req.messages[0]!.content} [co-mingled: a later turn leaked backward]` }
        }
        callIndex += 1
        yield callIndex === 1 ? '{"move": 4}' : '{"move": 0}'
      },
    }
    const seat = createModelSeat({ mark: 'X', canary: 'CANARY-HISTORICAL', provider, model: 'stub' })
    await seat.respond(boardMsg())
    await seat.respond(boardMsg({ lastOpponentMove: 1, board: ['X', 'O', null, null, null, null, null, null, null] }))

    const ctx = seat.pullContext()
    // The mutated historical `user` entry (turn 1's board framing) surfaces as an EXTRA recorded entry —
    // proving the divergence check inspects the FULL request array every call, not just its last message.
    expect(ctx.some((e) => e.role === 'user' && e.content.includes('[co-mingled: a later turn leaked backward]'))).toBe(true)
  })
})

// --- the out-of-transcript negative control (LLD-C9 / LLD §2) ---

/** A DELIBERATELY LEAKY shared provider: ONE object serving BOTH seats, which co-mingles context BELOW
 * the seat seam — it remembers the first call's system prompt (X's, carrying X's canary) and mutates the
 * SAME request object's `system` property on every subsequent call (O's), before the recording tap
 * observes it. This simulates a hidden preamble / shared client memory — never something the seat itself
 * does — and is exactly what the byte-complete adapter-boundary recording is designed to surface. */
function createLeakySharedProvider(repliesInCallOrder: string[]): AgentProvider {
  let rememberedFirstSystem: string | undefined
  let callIndex = 0
  return {
    async *stream(req) {
      const reply = repliesInCallOrder[callIndex] ?? repliesInCallOrder.at(-1)!
      if (callIndex === 0) {
        rememberedFirstSystem = req.system
      } else if (rememberedFirstSystem !== undefined) {
        // CO-MINGLE: mutate the SAME request object in place — never a new object, never something the
        // calling seat constructed or has any visibility into.
        req.system = `${req.system}\n[co-mingled from an earlier session]: ${rememberedFirstSystem}`
      }
      callIndex += 1
      yield reply
    },
  }
}

const PROVIDER_CONTROL_MATCH_ID = 'contaminated-provider-control-001'
const PROVIDER_CONTROL_DATE = '2026-07-08T00:00:00.000Z' // PINNED — required for the in-process regeneration identity assertion below

async function runLeakyProviderMatch() {
  const leaky = createLeakySharedProvider(['{"move": 4}', '{"move": 1}', '{"move": 0}', '{"move": 2}', '{"move": 8}'])
  const canaryX = deriveCanary(PROVIDER_CONTROL_MATCH_ID, 'X')
  const canaryO = deriveCanary(PROVIDER_CONTROL_MATCH_ID, 'O')
  const result = await runMatch({
    matchId: PROVIDER_CONTROL_MATCH_ID,
    scripted: false,
    date: PROVIDER_CONTROL_DATE,
    seats: {
      X: { seat: createModelSeat({ mark: 'X', canary: canaryX, provider: leaky, model: 'stub' }), provider: 'stub', model: 'stub' },
      O: { seat: createModelSeat({ mark: 'O', canary: canaryO, provider: leaky, model: 'stub' }), provider: 'stub', model: 'stub' },
    },
  })
  return { header: result.header, events: result.events }
}

describe('the out-of-transcript negative control (contaminated-provider-control, LLD-C9/SPEC-R10)', () => {
  it('the leaky shared provider co-mingles X context into O — the isolation gate catches it (non-vacuity)', async () => {
    const transcript = await runLeakyProviderMatch()
    const failures = checkIsolation(transcript)
    expect(failures.length).toBeGreaterThan(0)
    expect(failures.some((f) => f.check === 'canary')).toBe(true)
    expect(failures.some((f) => f.check === 'provenance')).toBe(true)
  })

  it('re-runs BYTE-IDENTICALLY in-process (offline, deterministic, date pinned) — the committed fixture is reproducible, not hand-authored', async () => {
    const t1 = await runLeakyProviderMatch()
    const t2 = await runLeakyProviderMatch()
    expect(serializeTranscript(t1)).toBe(serializeTranscript(t2))
  })

  it('the COMMITTED contaminated-provider-control.match.jsonl fixture still fails the gate (the standing assertion)', async () => {
    const fixturePath = `${process.cwd()}/packages/agent-ui/a2a/matches/contaminated-provider-control.match.jsonl`
    // Regenerate fresh (byte-identical to the committed copy, per the test above) rather than trusting a
    // stale file — write-if-missing so `npm test` is self-sufficient on a clean checkout, then always
    // re-validate the COMMITTED bytes below.
    let committed: string
    try {
      committed = readFileSync(fixturePath, 'utf8') as string
    } catch {
      const fresh = await runLeakyProviderMatch()
      const serialized = serializeTranscript(fresh)
      writeFileSync(fixturePath, serialized, 'utf8')
      committed = serialized
    }
    const regenerated = serializeTranscript(await runLeakyProviderMatch())
    expect(committed).toBe(regenerated) // byte-identical in-process regeneration (LLD §2)

    const lines = committed.split('\n').filter((l) => l.length > 0)
    expect(validateTranscript(lines, { protocolVersion: PROTOCOL_VERSION })).toEqual([]) // schema-valid — the leak is semantic, not a shape defect
    const parsed = parseTranscriptLines(lines)!
    const failures = checkIsolation(parsed)
    expect(failures.length).toBeGreaterThan(0) // MUST fail the gate — a green run over this fixture is a suite failure
  })
})
