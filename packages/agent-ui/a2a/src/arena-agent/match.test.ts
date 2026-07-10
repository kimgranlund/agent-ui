// match.test.ts — LLD-C7 checkpoint (SPEC-R12 AC1): a scripted-vs-scripted match runs end-to-end,
// no network/model, and is byte-stable across two runs (the CI backbone). Lives under `src/` (NOT
// `tools/`) purely so vitest's `packages` project glob (`packages/agent-ui/*/src/**/*.test.ts`) picks it
// up — the a2ui `src/live-agent/*.test.ts` shadow-directory precedent for testing `tools/`-scoped code
// (e.g. `providers-config.test.ts` tests `tools/agent/providers-config.ts` the same way). This file
// imports `tools/arena/*` by relative path; it asserts BEHAVIOR only, never re-derives it.
import { describe, expect, it } from 'vitest'
import { buildMatchHeader, MatchAborted, runMatch } from '../../tools/arena/match.ts'
import type { SeatChannels } from '../../tools/arena/match.ts'
import type { TranscriptEvent } from '../arena/transcript.ts'
import { A2aChannelClosedError } from '../channel/loopback.ts'
import type { Mark } from '../arena/board.ts'
import { createFirstLegalMoveSeat, createScriptedSeat } from '../../tools/arena/seats/scripted.ts'
import type { ContextEntry, Seat, SeatReply } from '../../tools/arena/seat.ts'
import { deriveCanary } from '../../tools/arena/canary.ts'
import { serializeTranscript, validateTranscript } from '../arena/transcript.ts'
import { checkIsolation } from '../arena/isolation.ts'
import { PROTOCOL_VERSION } from '../../src/protocol/types.ts'

/** A seat that never replies — used ONLY to prove the abort seam settles a race that nothing else would
 * (no timeout configured, no scripted move coming); `respond()`'s promise is deliberately left pending
 * forever so the ONLY way `withTimeout`'s race resolves is via `signal`. */
function createHangingSeat(mark: Mark, canary: string): Seat {
  const pending: ContextEntry[] = [{ role: 'system', content: `You are ${mark}, and will never reply. Canary: ${canary}` }]
  return {
    respond(): Promise<SeatReply> {
      pending.push({ role: 'user', content: 'awaiting a reply that never comes' })
      return new Promise<SeatReply>(() => {
        /* never settles */
      })
    },
    pullContext(): ContextEntry[] {
      return pending.splice(0, pending.length)
    },
  }
}

function seatsFor(matchId: string, scriptX: Parameters<typeof createScriptedSeat>[2], scriptO: Parameters<typeof createScriptedSeat>[2]) {
  return {
    X: { seat: createScriptedSeat('X', deriveCanary(matchId, 'X'), scriptX), provider: 'scripted', model: 'scripted' },
    O: { seat: createScriptedSeat('O', deriveCanary(matchId, 'O'), scriptO), provider: 'scripted', model: 'scripted' },
  }
}

describe('runMatch (LLD-C7) — scripted end-to-end', () => {
  it('a full scripted match (X wins) produces a valid, isolation-clean transcript', async () => {
    const matchId = 'test-win'
    const result = await runMatch({
      matchId,
      scripted: true,
      date: '2026-07-08T00:00:00.000Z',
      seats: seatsFor(
        matchId,
        [{ move: 0 }, { move: 1 }, { move: 2 }], // X: top row
        [{ move: 3 }, { move: 4 }],
      ),
    })
    expect(result.end).toEqual({ kind: 'win', winner: 'X' })
    const lines = serializeTranscript({ header: result.header, events: result.events }).split('\n').filter((l) => l.length > 0)
    expect(validateTranscript(lines, { protocolVersion: PROTOCOL_VERSION })).toEqual([])
    expect(checkIsolation({ header: result.header, events: result.events })).toEqual([])
  })

  it('an illegal move earns structured feedback then a legal move continues the match (SPEC-R11 AC1)', async () => {
    const matchId = 'test-illegal-then-legal'
    const result = await runMatch({
      matchId,
      scripted: true,
      seats: seatsFor(
        matchId,
        [{ move: 0 }, { move: 0 }, { move: 1 }, { move: 2 }], // X: legal, ILLEGAL retry (occupied), legal, legal (win)
        [{ move: 3 }, { move: 4 }],
      ),
    })
    expect(result.end).toEqual({ kind: 'win', winner: 'X' })
    const feedbackEvents = result.events.filter((e) => 'game' in e && e.game.kind === 'feedback')
    expect(feedbackEvents).toHaveLength(1)
    expect(feedbackEvents[0]).toEqual({ game: { kind: 'feedback', seat: 'X', code: 'ILLEGAL', detail: expect.any(String), retriesLeft: 1 } })
  })

  it('exhausting the retry bound forfeits the game; transcript records the reason', async () => {
    const matchId = 'test-forfeit'
    const result = await runMatch({
      matchId,
      scripted: true,
      retryBound: 1,
      seats: seatsFor(matchId, [{ malformed: 'garbage' }], [{ move: 0 }]),
    })
    expect(result.end).toEqual({ kind: 'forfeit', loser: 'X', cause: 'retries-exhausted' })
    const endEvent = result.events.find((e) => 'game' in e && e.game.kind === 'end')
    expect(endEvent).toEqual({ game: { kind: 'end', reason: { kind: 'forfeit', loser: 'X', cause: 'retries-exhausted' } } })
  })

  it('a direct abort forfeits immediately, no retry consumed', async () => {
    const matchId = 'test-abort'
    const result = await runMatch({
      matchId,
      scripted: true,
      retryBound: 5,
      seats: seatsFor(matchId, [{ abort: 'provider-error', detail: 'upstream 500' }], [{ move: 0 }]),
    })
    expect(result.end).toEqual({ kind: 'forfeit', loser: 'X', cause: 'provider-error' })
  })

  it('a full-length first-legal-move match ends in a draw or a win, never crashes, and is isolation-clean', async () => {
    const matchId = 'test-grind'
    const result = await runMatch({
      matchId,
      scripted: true,
      seats: {
        X: { seat: createFirstLegalMoveSeat('X', deriveCanary(matchId, 'X')), provider: 'scripted', model: 'scripted' },
        O: { seat: createFirstLegalMoveSeat('O', deriveCanary(matchId, 'O')), provider: 'scripted', model: 'scripted' },
      },
    })
    expect(['win', 'draw']).toContain(result.end.kind)
    expect(checkIsolation({ header: result.header, events: result.events })).toEqual([])
  })

  it('BYTE-STABLE across two runs of the SAME matchId (SPEC-R12 AC1, the CI backbone)', async () => {
    const matchId = 'test-byte-stable'
    const run = () =>
      runMatch({
        matchId,
        scripted: true,
        date: '2026-07-08T00:00:00.000Z',
        seats: seatsFor(matchId, [{ move: 0 }, { move: 1 }, { move: 2 }], [{ move: 3 }, { move: 4 }]),
      })
    const r1 = await run()
    const r2 = await run()
    const t1 = serializeTranscript({ header: r1.header, events: r1.events })
    const t2 = serializeTranscript({ header: r2.header, events: r2.events })
    expect(t1).toBe(t2)
  })

  it('onEvent (LLD §6, C10) fires synchronously per event, incrementally, in the SAME order as the returned array', async () => {
    const matchId = 'test-on-event'
    const observed: TranscriptEvent[] = []
    // Snapshotted the moment each event fires — proves incremental delivery (a copy per call), not a
    // single dump of the final array handed back after `runMatch` resolves.
    const snapshotLengthsAtCallTime: number[] = []
    const result = await runMatch({
      matchId,
      scripted: true,
      date: '2026-07-08T00:00:00.000Z',
      seats: seatsFor(matchId, [{ move: 0 }, { move: 1 }, { move: 2 }], [{ move: 3 }, { move: 4 }]),
      onEvent: (event) => {
        observed.push(event)
        snapshotLengthsAtCallTime.push(observed.length)
      },
    })
    // Strictly increasing 1,2,3,... — each call sees exactly one more event than the last, never the
    // whole batch at once.
    expect(snapshotLengthsAtCallTime).toEqual(observed.map((_, i) => i + 1))
    expect(observed.length).toBeGreaterThan(1)
    // Exactly the same sequence, in order, as the array `runMatch` returns — the returned-array behavior
    // stays byte-identical whether or not a caller taps the hook.
    expect(observed).toEqual(result.events)
  })

  // Review follow-up (Low, header-desync class): `buildMatchHeader` is the ONE construction both `runMatch`
  // (its own returned `MatchResult.header`) and the dev proxy (which needs the header BEFORE the match
  // starts, to write it up front) call — proves a caller building a header from the SAME opts up front gets
  // byte-identical output to what `runMatch` independently attaches to its result.
  it('buildMatchHeader(opts), called BEFORE the match runs, equals the header runMatch attaches to its own result (same opts)', async () => {
    const matchId = 'test-header-parity'
    const opts = {
      matchId,
      scripted: true,
      date: '2026-07-08T00:00:00.000Z',
      seats: seatsFor(matchId, [{ move: 0 }, { move: 1 }, { move: 2 }], [{ move: 3 }, { move: 4 }]),
    }
    const preComputedHeader = buildMatchHeader(opts)
    const result = await runMatch(opts)
    expect(preComputedHeader).toEqual(result.header)
  })

  it('teardown closes BOTH endpoints of BOTH loopback pairs — a straggler send afterward rejects, never silently drops (review fix, Step 0(a))', async () => {
    const matchId = 'test-teardown'
    let captured: Record<Mark, SeatChannels> | undefined
    const result = await runMatch({
      matchId,
      scripted: true,
      seats: seatsFor(matchId, [{ move: 0 }, { move: 1 }, { move: 2 }], [{ move: 3 }, { move: 4 }]),
      captureChannels: (channels) => {
        captured = channels
      },
    })
    expect(result.end.kind).toBe('win')
    expect(captured).toBeDefined()
    for (const mark of ['X', 'O'] as const) {
      await expect(captured![mark].referee.send({ kind: 'message', role: 'agent', parts: [], messageId: 'straggler' })).rejects.toBeInstanceOf(A2aChannelClosedError)
      await expect(captured![mark].seat.send({ kind: 'message', role: 'user', parts: [], messageId: 'straggler' })).rejects.toBeInstanceOf(A2aChannelClosedError)
    }
  })
})

describe('runMatch — the abort seam (LLD-C4, SPEC-R17 AC3)', () => {
  it('zero-regression: a signal that never fires produces a BYTE-IDENTICAL transcript to the no-signal run', async () => {
    const matchId = 'test-abort-zero-regression'
    const date = '2026-07-08T00:00:00.000Z'
    const build = (signal?: AbortSignal) =>
      runMatch({
        matchId,
        scripted: true,
        date,
        seats: seatsFor(matchId, [{ move: 0 }, { move: 1 }, { move: 2 }], [{ move: 3 }, { move: 4 }]),
        signal,
      })
    const withoutSignal = await build(undefined)
    const withUnfiredSignal = await build(new AbortController().signal)
    expect(serializeTranscript({ header: withUnfiredSignal.header, events: withUnfiredSignal.events })).toBe(
      serializeTranscript({ header: withoutSignal.header, events: withoutSignal.events }),
    )
  })

  it('a signal already aborted before the match starts rejects immediately with MatchAborted — no seat is ever asked to move', async () => {
    const matchId = 'test-abort-preemptive'
    const controller = new AbortController()
    controller.abort()
    let xAsked = false
    const seats = {
      X: {
        seat: {
          respond: (): Promise<SeatReply> => {
            xAsked = true
            return Promise.resolve({ kind: 'move', move: { move: 0 } })
          },
          pullContext: (): ContextEntry[] => [],
        },
        provider: 'scripted',
        model: 'scripted',
      },
      O: { seat: createScriptedSeat('O', deriveCanary(matchId, 'O'), [{ move: 3 }]), provider: 'scripted', model: 'scripted' },
    }
    await expect(runMatch({ matchId, scripted: true, seats, signal: controller.signal })).rejects.toBeInstanceOf(MatchAborted)
    expect(xAsked).toBe(false)
  })

  it('a signal aborted mid-match (while a seat reply is pending) rejects with MatchAborted, and teardown STILL closes all four channel endpoints', async () => {
    const matchId = 'test-abort-mid-match'
    const controller = new AbortController()
    let captured: Record<Mark, SeatChannels> | undefined
    const seats = {
      X: { seat: createHangingSeat('X', deriveCanary(matchId, 'X')), provider: 'scripted', model: 'scripted' },
      O: { seat: createScriptedSeat('O', deriveCanary(matchId, 'O'), [{ move: 3 }]), provider: 'scripted', model: 'scripted' },
    }
    const run = runMatch({
      matchId,
      scripted: true,
      seats,
      signal: controller.signal,
      captureChannels: (channels) => {
        captured = channels
      },
    })
    // Give the runner a turn to reach the point of awaiting X's (forever-pending) reply before cancelling.
    await new Promise((resolve) => setTimeout(resolve, 10))
    controller.abort()
    await expect(run).rejects.toBeInstanceOf(MatchAborted)
    expect(captured).toBeDefined()
    for (const mark of ['X', 'O'] as const) {
      await expect(captured![mark].referee.send({ kind: 'message', role: 'agent', parts: [], messageId: 'straggler' })).rejects.toBeInstanceOf(A2aChannelClosedError)
      await expect(captured![mark].seat.send({ kind: 'message', role: 'user', parts: [], messageId: 'straggler' })).rejects.toBeInstanceOf(A2aChannelClosedError)
    }
  })
})
