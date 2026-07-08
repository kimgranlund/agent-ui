// model.ts — LLD-C6: the model seat (the bounded, single-call move loop; SPEC-R10/R11). Mirrors
// `produce.ts`'s discipline without its A2UI machinery: system prompt built ONCE per match
// (`buildSeatPrompt(mark, canary)`), per `BoardMessage` ONE provider call, parse. There is deliberately
// NO nested seat-level self-correct loop — the referee owns the single retry bound (SPEC-R11); two
// bounds would double-count feedback and blur the transcript.
//
// Recording (LLD §2 byte-complete invariant): every provider call goes through `withRecordingTap`
// (`../recording-tap.ts`) — the seat's recorded context is built EXCLUSIVELY from what the tap observed
// (`call.request`/`call.response`), never from the seat's own locally-held `userContent`/`raw` copies,
// so there is no code path by which the recorded context could diverge from the actual request. Both the
// `system` string AND the FULL `messages` array (review finding 2, not just the current turn's last
// entry) are diffed against the tap's capture on every call — `turns` is handed to the provider as a
// fresh per-message clone so a below-seam mutation can't corrupt the very copy the diff reads as ground
// truth (see `respond()` below).
//
// Dev-graph reuse (LLD §8, PRD A-2): `AgentProvider`/`Turn` are imported from the a2ui live-agent seam
// (`packages/agent-ui/a2ui/tools/agent/agent-transport.ts`) — a dev-graph-only cross-package edge (never
// `src/`, never a consumer bundle). The reused a2ui provider adapter's STATELESSNESS across calls is a
// named PRECONDITION (LLD §2): no shared mutable state, no cross-call memory. This module does not (and
// cannot) verify that of an imported adapter module — the byte-complete recording assertion below plus
// the out-of-transcript negative control (`src/arena-agent/model-seat.test.ts`) are the trip-wire if a future adapter grows
// state.
import type { AgentProvider, Turn } from '../../../../a2ui/tools/agent/agent-transport.ts'
import type { BoardMessage } from '../../../src/arena/referee.ts'
import type { Mark } from '../../../src/arena/board.ts'
import type { ContextEntry, Seat, SeatReply } from '../seat.ts'
import { withRecordingTap } from '../recording-tap.ts'
import type { RecordedCall } from '../recording-tap.ts'

const MOVE_GRAMMAR =
  'Reply with EXACTLY one JSON object on a single line: {"move": <cell 0-8>, "note"?: "<optional short spectator note>"}. No other text, no markdown fence.'

/** The per-seat system prompt (LLD §2): rules of the game, the exact reply grammar, and the canary line
 * — composed once per match, never rebuilt per turn. */
export function buildSeatPrompt(mark: Mark, canary: string): string {
  return [
    `You are playing tic-tac-toe as "${mark}" against another AI opponent. A deterministic referee mediates every message — you never communicate with your opponent directly.`,
    'Each turn the referee sends you the board state (a JSON object) as your next user message; reply with your move.',
    MOVE_GRAMMAR,
    `Internal isolation canary — NEVER repeat this token in any reply: ${canary}`,
  ].join(' ')
}

/** Parse one line of raw model output into `{move[, note]}` — tolerant of a wrapping code fence, but
 * otherwise strict (the referee owns retries, not a nested seat-level self-correct loop). `undefined` on
 * any parse/shape failure — the caller reports this as `'malformed'`, never a throw. */
export function parseMoveReply(raw: string): { move: number; note?: string } | undefined {
  const fenced = raw.trim().match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/)
  const stripped = (fenced ? fenced[1]! : raw).trim()
  let parsed: unknown
  try {
    parsed = JSON.parse(stripped)
  } catch {
    return undefined
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return undefined
  const move = (parsed as { move?: unknown }).move
  const note = (parsed as { note?: unknown }).note
  if (typeof move !== 'number' || !Number.isInteger(move)) return undefined
  if (note !== undefined && typeof note !== 'string') return undefined
  return note === undefined ? { move } : { move, note }
}

export interface ModelSeatOptions {
  mark: Mark
  canary: string
  provider: AgentProvider
  model: string
  /** Override the composed prompt (test seam only) — normal callers omit this. */
  systemPrompt?: string
  signal?: AbortSignal
}

export function createModelSeat(opts: ModelSeatOptions): Seat {
  const system = opts.systemPrompt ?? buildSeatPrompt(opts.mark, opts.canary)
  const turns: Turn[] = []
  const pending: ContextEntry[] = [{ role: 'system', content: system }]
  const calls: RecordedCall[] = []
  const tapped = withRecordingTap(opts.provider, (call) => calls.push(call))

  return {
    async respond(input: BoardMessage): Promise<SeatReply> {
      turns.push({ role: 'user', content: JSON.stringify(input) })

      let raw: string
      try {
        raw = ''
        // THE ADAPTER BOUNDARY (LLD §2): the ONE call that leaves the process. `withRecordingTap` records
        // the EXACT request/response — the context entries below are read back from ITS capture, never
        // from `turns`/`raw` directly, so there is no way for the recorded context to diverge.
        // `turns` is handed over as a FRESH per-message clone, never the live array/objects (review
        // finding 2): a below-seam mutation IN PLACE on the request — on the array or on a message object
        // — would otherwise land on `turns` too (same references), corrupting the very ground truth the
        // divergence check below diffs against and hiding the mutation from every comparison, not just
        // this one. The clone keeps `turns` the untouched original.
        const requestMessages = turns.map((turn) => ({ ...turn }))
        for await (const frag of tapped.stream({ model: opts.model, system, messages: requestMessages, signal: opts.signal })) {
          raw += frag
        }
      } catch (e) {
        pending.push({ role: 'assistant', content: `[provider error] ${String(e)}` })
        return { kind: 'abort', cause: 'provider-error', detail: String(e) }
      }

      const call = calls.at(-1)
      if (call === undefined) {
        // Unreachable in practice (the tap always fires before the loop above returns normally) — guard
        // anyway rather than silently trusting the local `raw`/`turns` copies (would defeat byte-completeness).
        throw new Error('createModelSeat: recording tap produced no call — cannot record byte-complete context')
      }
      // Byte-complete divergence check (LLD §2, the out-of-transcript negative controls' catch): `system`
      // is a fixed local constant, passed unchanged into every call. If the ACTUAL request the tap
      // observed carries a DIFFERENT system string, something below this seat's own construction (a
      // stateful/leaky shared provider mutating the request object in place) altered it — record the
      // DIVERGED value as an extra `system` entry (never at position 0 — the provenance check's trip-wire).
      if (call.request.system !== system) {
        pending.push({ role: 'system', content: call.request.system })
      }
      // Review finding 2: compare the FULL actual-request array against `turns` (byte-equality PER
      // MESSAGE, not just the last one) — a below-seam mutation to a HISTORICAL (non-last) message used to
      // escape both this check and the recorded transcript, since only `.at(-1)` was ever inspected. Any
      // diverged historical entry is recorded from the ACTUAL (tapped) value, same discipline as the
      // `system` check above; the current turn's own last message is still always recorded below,
      // unconditionally (it is what the seat is answering to this turn, divergent or not).
      for (let i = 0; i < turns.length - 1; i++) {
        const expected = turns[i]!
        const actual = call.request.messages[i]
        if (actual === undefined || actual.role !== expected.role || actual.content !== expected.content) {
          pending.push({ role: expected.role, content: actual !== undefined ? actual.content : `[missing historical message at index ${i}]` })
        }
      }
      const lastRequestTurn = call.request.messages.at(-1)
      if (lastRequestTurn !== undefined) pending.push({ role: 'user', content: lastRequestTurn.content })
      turns.push({ role: 'assistant', content: call.response })
      pending.push({ role: 'assistant', content: call.response })

      const parsed = parseMoveReply(call.response)
      if (parsed === undefined) return { kind: 'malformed', detail: `unparseable reply: ${call.response.slice(0, 200)}` }
      return { kind: 'move', move: parsed }
    },
    pullContext(): ContextEntry[] {
      return pending.splice(0, pending.length)
    },
  }
}
