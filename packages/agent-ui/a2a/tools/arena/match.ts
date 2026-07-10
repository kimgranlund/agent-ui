// match.ts — LLD-C7: the match runner (SPEC-R10, R12). The runner owns BOTH endpoints of each
// seat<->referee loopback pair (SPEC-R8 — the arena's isolation boundary) and closes BOTH on teardown
// (review fix: with `loopback.ts`'s send-into-closed-peer now rejecting loudly, Step 0(a), a leaked
// straggler send here would be loud, not silent). Star topology: the runner is the ONE composer that
// sees both seats — solely to relay each turn through the referee and record it; it never forwards
// content between seats (the wire audit — SPEC-R9 AC1 — proves nothing ever crosses directly).
//
// LLD-C4 (SPEC-R17 AC3): `RunMatchOptions.signal` adds a user-initiated abort, raced at the SAME point
// `withTimeout` already races the per-move timeout, plus checked between outbound deliveries. On fire,
// the runner throws `MatchAborted` — the existing `finally` below still closes all four channel
// endpoints, so a cancel is never a silent leak. With no signal passed, every race/check is a no-op and
// `runMatch` is byte-identical to before this option existed (the scripted CI zero-regression control).
import { createLoopbackPair } from '../../src/channel/loopback.ts'
import type { A2aChannel } from '../../src/channel/loopback.ts'
import { beginMatch, createRefereeState, reduce } from '../../src/arena/referee.ts'
import type { BoardMessage, EndReason, MoveMessage, RefereeInput, RefereeState } from '../../src/arena/referee.ts'
import { readWireData, wireMessage } from '../../src/arena/transcript.ts'
import type { GameEvent, TranscriptEvent, TranscriptHeader } from '../../src/arena/transcript.ts'
import type { Mark } from '../../src/arena/board.ts'
import { PROTOCOL_VERSION } from '../../src/protocol/types.ts'
import type { Seat } from './seat.ts'

export interface MatchSeatConfig {
  seat: Seat
  provider: string
  model: string
}

export interface RunMatchOptions {
  matchId: string
  seats: Record<Mark, MatchSeatConfig>
  scripted: boolean
  /** Pin for byte-identical regeneration (LLD §2's provider-control note) — omit to use `Date.now()`. */
  date?: string
  retryBound?: number
  perMoveTimeoutMs?: number
  /** Test-only escape hatch: called with the runner's own channel map right after creation, so a test can
   * assert post-match teardown state (both endpoints of both pairs closed) without the runner exposing
   * its internals as part of the normal return shape. */
  captureChannels?: (channels: Record<Mark, SeatChannels>) => void
  /** Fires synchronously, once per event, in the SAME order it is appended to the returned `events` array
   * (LLD §6 — a caller, e.g. the dev proxy, observes events as they occur without the runner changing its
   * buffer-then-serialize shape). Invoked AFTER the event is pushed, so a hook that reads the accumulated
   * array sees itself included; the returned `MatchResult.events` stays byte-identical either way. */
  onEvent?: (event: TranscriptEvent) => void
  /** LLD-C4 (SPEC-R17 AC3): a user-initiated abort. Raced at the SAME point the per-move timeout already
   * races (`withTimeout`'s three-way race) and checked between outbound deliveries; on fire, the runner
   * throws `MatchAborted` — the existing `finally` still closes all four channel endpoints. Omitted (the
   * default), `runMatch` behaves byte-identically to before this option existed (the zero-regression
   * control, SPEC-R17 AC3). */
  signal?: AbortSignal
}

/** LLD-C4: thrown when `opts.signal` fires mid-match. Never thrown for any other reason — a caller (the
 * dev proxy) distinguishes "the match was cancelled" from every other runner failure by catching this
 * specific type. */
export class MatchAborted extends Error {
  constructor() {
    super('match aborted')
    this.name = 'MatchAborted'
  }
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new MatchAborted()
}

export interface MatchResult {
  header: TranscriptHeader
  events: TranscriptEvent[]
  end: EndReason
}

export interface SeatChannels {
  referee: A2aChannel
  seat: A2aChannel
}

/** The subset of `RunMatchOptions` a transcript header depends on — no match state (result, events),
 * so it can be built BEFORE a match runs, not only after. */
export type BuildMatchHeaderOptions = Pick<RunMatchOptions, 'matchId' | 'seats' | 'scripted' | 'date'>

/** Build the transcript header (LLD §2's provider-control note) from `opts` ALONE — no match results.
 * `runMatch` calls this for its own returned `MatchResult.header`; a caller that needs the header BEFORE
 * the match starts (the dev proxy, which writes it to the response up front so it can stream events as
 * they occur) calls it too, with the SAME opts — one construction, not two hand-maintained ones that can
 * silently drift apart (review fix — the header-desync class). */
export function buildMatchHeader(opts: BuildMatchHeaderOptions): TranscriptHeader {
  return {
    matchId: opts.matchId,
    protocolVersion: PROTOCOL_VERSION,
    seats: {
      X: { provider: opts.seats.X.provider, model: opts.seats.X.model },
      O: { provider: opts.seats.O.provider, model: opts.seats.O.model },
    },
    date: opts.date ?? new Date().toISOString(),
    scripted: opts.scripted,
  }
}

function makeSeatChannels(): SeatChannels {
  const [referee, seat] = createLoopbackPair()
  return { referee, seat }
}

async function nextFrom(chan: A2aChannel) {
  return chan.receive()[Symbol.asyncIterator]().next()
}

/** A per-match, purely-incrementing sequence — `wireMessage`'s `messageId` is a function of
 * within-match order only (never a process-lifetime counter), so two runs of the same scripted match
 * are byte-identical (SPEC-N3/SPEC-R12 AC1). */
function makeSeq(): () => number {
  let n = 0
  return () => {
    n += 1
    return n
  }
}

/** Accumulates the transcript AND fans each event out to `onEvent` (LLD §6, C10) the instant it's
 * appended — the ONE place `events.push` happens, so the returned array and the per-event hook can never
 * drift out of sync (same order, same contents, zero double-derivation). `onEvent` is optional; when
 * absent this degrades to a bare accumulator, so `runMatch`'s returned-array behavior is byte-identical
 * whether or not a caller taps the hook. */
interface EventSink {
  readonly events: TranscriptEvent[]
  push(event: TranscriptEvent): void
}

function makeEventSink(onEvent: ((event: TranscriptEvent) => void) | undefined): EventSink {
  const events: TranscriptEvent[] = []
  return {
    events,
    push(event) {
      events.push(event)
      onEvent?.(event)
    },
  }
}

/** Send `message` referee->seat over the CHANNEL (not a bare function call) — the receiving end drains
 * it back out before it's recorded, proving genuine transit through the SPEC-R8 boundary. */
async function deliverBoardMessage(
  channels: SeatChannels,
  to: Mark,
  message: BoardMessage,
  sink: EventSink,
  nextSeq: () => number,
): Promise<void> {
  await channels.referee.send(wireMessage('referee', nextSeq(), message))
  const { value } = await nextFrom(channels.seat)
  const delivered = value ?? wireMessage('referee', nextSeq(), message)
  sink.push({ wire: { from: 'referee', to, message: delivered } })
}

/** Timeout + abort wrapper (LLD §7/LLD-C4): a per-move timeout counts as a MALFORMED reply — the runner's
 * concern; the reducer stays pure/timer-free (SPEC-N3). A three-way race with `signal` (SPEC-R17 AC3):
 * the seat's reply, the timeout, or the caller's abort — whichever settles first. Cleans up its own timer
 * + abort listener on every path (no dangling handles across a 9-move game). With `signal` omitted this
 * degrades to the original two-way race, byte-identical to before the seam existed (the zero-regression
 * control). */
function withTimeout<T>(promise: Promise<T>, ms: number | undefined, signal?: AbortSignal): Promise<{ ok: true; value: T } | { ok: false }> {
  return new Promise((resolve, reject) => {
    let settled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    function cleanup(): void {
      if (timer !== undefined) clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
    }
    function finish(fn: () => void): void {
      if (settled) return
      settled = true
      cleanup()
      fn()
    }
    function onAbort(): void {
      finish(() => reject(new MatchAborted()))
    }
    if (signal?.aborted) {
      finish(() => reject(new MatchAborted()))
      return
    }
    signal?.addEventListener('abort', onAbort)
    if (ms !== undefined) timer = setTimeout(() => finish(() => resolve({ ok: false })), ms)
    promise.then(
      (value) => finish(() => resolve({ ok: true, value })),
      (err: unknown) => finish(() => reject(err as Error)),
    )
  })
}

async function collectSeatReply(
  seat: Seat,
  channels: SeatChannels,
  mark: Mark,
  boardMessage: BoardMessage,
  perMoveTimeoutMs: number | undefined,
  sink: EventSink,
  nextSeq: () => number,
  signal?: AbortSignal,
): Promise<RefereeInput> {
  const raced = await withTimeout(seat.respond(boardMessage), perMoveTimeoutMs, signal)
  if (!raced.ok) {
    return { kind: 'malformed', seat: mark, detail: `per-move timeout exceeded (${String(perMoveTimeoutMs)}ms)` }
  }
  const reply = raced.value
  if (reply.kind === 'move') {
    await channels.seat.send(wireMessage(mark, nextSeq(), reply.move))
    const { value } = await nextFrom(channels.referee)
    const delivered = value ?? wireMessage(mark, nextSeq(), reply.move)
    sink.push({ wire: { from: mark, to: 'referee', message: delivered } })
    const move = (readWireData(delivered) as MoveMessage | undefined) ?? reply.move
    return { kind: 'move', seat: mark, move }
  }
  if (reply.kind === 'malformed') return { kind: 'malformed', seat: mark, detail: reply.detail }
  return { kind: 'abort', seat: mark, cause: reply.cause, detail: reply.detail }
}

function drainContext(seat: Seat, mark: Mark, sink: EventSink): void {
  for (const entry of seat.pullContext()) sink.push({ context: { seat: mark, entry } })
}

/** Derive the `feedback` game event from an ACTUALLY-sent outbound message — only fires for the
 * illegal/malformed RETRY arm (`status: 'illegal-retry'`); a forfeit's reason is captured by the final
 * `{game:{kind:'end',...}}` event instead, so no separate feedback event is needed there. */
function gameEventForOutbound(mark: Mark, message: BoardMessage): GameEvent | undefined {
  if (message.status !== 'illegal-retry' || message.feedback === undefined) return undefined
  return { game: { kind: 'feedback', seat: mark, code: message.feedback.code, detail: message.feedback.detail, retriesLeft: message.feedback.retriesLeft } }
}

/**
 * Run one full match (LLD-C7): drives the referee (LLD-C2) via each seat (LLD-C5/C6) over its own
 * loopback pair (SPEC-R8), producing the ordered transcript event log.
 */
export async function runMatch(opts: RunMatchOptions): Promise<MatchResult> {
  const sink = makeEventSink(opts.onEvent)
  const channels: Record<Mark, SeatChannels> = { X: makeSeatChannels(), O: makeSeatChannels() }
  opts.captureChannels?.(channels)
  const pendingBoardMessage: Partial<Record<Mark, BoardMessage>> = {}
  const nextSeq = makeSeq()

  try {
    let state: RefereeState = createRefereeState(opts.retryBound)
    const begin = beginMatch(state)
    state = begin.state

    for (const ob of begin.outbound) {
      throwIfAborted(opts.signal)
      await deliverBoardMessage(channels[ob.to], ob.to, ob.message, sink, nextSeq)
      pendingBoardMessage[ob.to] = ob.message
      drainContext(opts.seats[ob.to].seat, ob.to, sink)
    }

    while (state.phase === 'playing') {
      const toMove = state.toMove
      const boardMessage = pendingBoardMessage[toMove]
      if (boardMessage === undefined) throw new Error(`match runner: no pending BoardMessage for ${toMove} (referee/runner desync)`)

      const boardBefore = state.board
      const input = await collectSeatReply(opts.seats[toMove].seat, channels[toMove], toMove, boardMessage, opts.perMoveTimeoutMs, sink, nextSeq, opts.signal)
      drainContext(opts.seats[toMove].seat, toMove, sink)

      const result = reduce(state, input)
      state = result.state

      if (input.kind === 'move' && result.state.board !== boardBefore) {
        sink.push({ game: { kind: 'move', seat: toMove, move: input.move.move } })
      }

      for (const ob of result.outbound) {
        throwIfAborted(opts.signal)
        const feedback = gameEventForOutbound(ob.to, ob.message)
        await deliverBoardMessage(channels[ob.to], ob.to, ob.message, sink, nextSeq)
        pendingBoardMessage[ob.to] = ob.message
        if (feedback) sink.push(feedback)
        drainContext(opts.seats[ob.to].seat, ob.to, sink)
      }
    }

    sink.push({ game: { kind: 'end', reason: state.end! } })

    const header = buildMatchHeader(opts)
    return { header, events: sink.events, end: state.end! }
  } finally {
    // Teardown: BOTH endpoints of BOTH pairs, always — a straggler send after this rejects loudly
    // (Step 0(a)), never silently drops (the review's teardown note).
    for (const mark of ['X', 'O'] as const) {
      channels[mark].referee.close()
      channels[mark].seat.close()
    }
  }
}
