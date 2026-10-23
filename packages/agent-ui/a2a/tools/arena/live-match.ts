// live-match.ts (T-0430, LLD-C10, SPEC-R13/R17): the ONE live-match core both hosts run. The Vite dev
// adapter (`dev-proxy-plugin.ts`, Node) and the production Worker route (`a2ui/tools/agent/worker/
// arena-route.ts`, Fetch API) are thin shells over it, the split `chat-validation.ts` gave the a2ui proxy
// after GH #108: request parsing, the per-seat pair allowlist, key resolution, the seat budget and the
// header-first streaming run live HERE once, so dev and prod cannot fork. Platform-neutral by
// construction: no `node:` import, no Vite, no Worker type, no `process` read; only timers, AbortSignal and
// the builtin-free a2a/src loopback channel the runner already uses.
//
// Cost bounds (the visitor never holds a key, ADR-0073; these bound what a visitor can spend of it):
//  1. `ARENA_LIVE_MODELS` narrows the providers.json pair allowlist to the two arena seat models, so a
//     crafted body cannot run a larger model on the operator's key.
//  2. `withSeatBudget` caps provider calls and reply characters PER SEAT (one wrapper per seat, no state
//     shared across seats: a shared counter is exactly the cross-seat object the provenance premise rules
//     out). Its throw takes the seat's existing catch to `abort/provider-error`, so the referee's forfeit
//     arm completes the transcript and the referee is unchanged.
//  3. `maxOutputTokens` reaches each call as `modelSettings.maxTokens` (the seat's own option, so what the
//     seat sends stays what the recording tap sees).
//  4. `matchDeadlineMs` bounds the whole match; it fires the same abort a cancel does.
// The per-visitor rate limit is the host's (the Worker binds one; the localhost dev proxy has none).
//
// Abort (LLD-C4, its named follow-up closed here): the match signal reaches `runMatch` AND each model
// seat, so a cancel stops the in-flight paid call, not only the next move. An aborted match throws
// `MatchAborted` and its stream simply ends without `game end`, which the page discards (SPEC-R17).
import { resolvePair } from '../../../a2ui/tools/agent/providers-config.ts'
import type { ProvidersConfig } from '../../../a2ui/tools/agent/providers-config.ts'
import type { providerFor } from '../../../a2ui/tools/agent/providers/index.ts'
import type { AgentProvider } from '../../../a2ui/src/agent/agent-transport.ts'
import { buildMatchHeader, MatchAborted, runMatch } from './match.ts'
import type { MatchResult, MatchSeatConfig } from './match.ts'
import { createModelSeat } from './seats/model.ts'
import { deriveCanaryPair } from './canary.ts'
import type { Mark } from '../../src/arena/board.ts'

/** The only seat models a live match may run (the page's Sonnet-vs-Haiku pair). */
export const ARENA_LIVE_MODELS: readonly string[] = ['claude-sonnet-5-5', 'claude-haiku-5-5']

export interface ArenaCaps {
  /** Provider calls one seat may make in one match. A clean game needs at most 5 for X; the referee's
   * per-turn retry bound alone would allow 15. */
  maxCallsPerSeat: number
  /** Output tokens per provider call, sent as `modelSettings.maxTokens`. */
  maxOutputTokens: number
  /** Reply characters per call, an in-process guard independent of the provider honoring maxTokens. */
  maxReplyChars: number
  /** Wall clock for the whole match. */
  matchDeadlineMs: number
}

export const ARENA_CAPS: ArenaCaps = { maxCallsPerSeat: 9, maxOutputTokens: 256, maxReplyChars: 2048, matchDeadlineMs: 180_000 }

const RETRY_BOUND = 2 // mirrors run-flagship.ts / SPEC-R11 default
const PER_MOVE_TIMEOUT_MS = 30_000 // mirrors run-flagship.ts

export interface ArenaSeatRequest {
  provider: string
  model: string
}

export type ArenaRequestParse =
  | { ok: true; seats: Record<Mark, ArenaSeatRequest> }
  | { ok: false; status: 400; error: string }

function isSeatRequest(value: unknown): value is ArenaSeatRequest {
  if (value === null || typeof value !== 'object') return false
  const seat = value as { provider?: unknown; model?: unknown }
  return typeof seat.provider === 'string' && typeof seat.model === 'string'
}

/** Shape-check a parsed `{seats:{X,O}}` body. Only `{provider, model}` per seat is read; nothing else in
 * the body reaches a seat. */
export function parseArenaRequest(body: unknown): ArenaRequestParse {
  const seats = body !== null && typeof body === 'object' ? (body as { seats?: unknown }).seats : undefined
  const candidate = seats !== null && typeof seats === 'object' ? (seats as { X?: unknown; O?: unknown }) : {}
  for (const mark of ['X', 'O'] as const) {
    if (!isSeatRequest(candidate[mark])) return { ok: false, status: 400, error: `seat ${mark}: missing {provider, model}` }
  }
  const X = candidate.X as ArenaSeatRequest
  const O = candidate.O as ArenaSeatRequest
  return { ok: true, seats: { X: { provider: X.provider, model: X.model }, O: { provider: O.provider, model: O.model } } }
}

export type ArenaSeatResolution =
  | { ok: true; provider: AgentProvider }
  | { ok: false; status: 400 | 503; error: string }

/** Resolve + key-check + dispatch ONE seat's `{provider, model}` (SPEC-R13's per-seat validation, "a
 * crafted body cannot escape it"): the providers.json pair allowlist, then the arena model allowlist, then
 * the server-side key. `ok:false` carries the HTTP status to send (400 for a bad pair, 503 for no key or an
 * undispatchable provider), never a 500 for a client-input problem. `deps.workspaceId` reaches the adapter
 * as the Worker's `/__a2ui/agent` routes already pass it (T-0192). */
export function resolveArenaSeat(
  config: ProvidersConfig,
  env: Record<string, string | undefined>,
  req: ArenaSeatRequest,
  mark: Mark,
  deps: { providerFor: typeof providerFor; workspaceId?: string },
): ArenaSeatResolution {
  const pair = resolvePair(config, req.provider, req.model)
  if (!pair.ok) return { ok: false, status: 400, error: `seat ${mark}: ${pair.reason}` }
  if (!ARENA_LIVE_MODELS.includes(req.model)) return { ok: false, status: 400, error: `seat ${mark}: model not allowed in the live arena` }
  const apiKey = env[pair.envKey]
  if (apiKey === undefined || apiKey === '') return { ok: false, status: 503, error: `seat ${mark}: no-key` }
  const dispatch = deps.providerFor(req.provider, {
    apiKey,
    endpoint: pair.entry.endpoint,
    ...(deps.workspaceId !== undefined && deps.workspaceId !== '' ? { workspaceId: deps.workspaceId } : {}),
  })
  if (!dispatch.ok) return { ok: false, status: 503, error: `seat ${mark}: ${dispatch.reason}` }
  return { ok: true, provider: dispatch.provider }
}

/** Thrown by `withSeatBudget` when a seat exceeds its call or reply-size cap. The seat's own catch turns it
 * into `abort/provider-error`, a forfeit the transcript records. */
export class ArenaBudgetExceeded extends Error {
  readonly limit: 'calls' | 'reply-chars'
  constructor(limit: 'calls' | 'reply-chars', detail: string) {
    super(`arena budget exceeded (${limit}): ${detail}`)
    this.name = 'ArenaBudgetExceeded'
    this.limit = limit
  }
}

/** Wrap ONE seat's provider with its own call and reply-size budget. The call cap throws BEFORE the inner
 * provider is reached. The reply cap aborts the inner stream through a signal combined with the caller's.
 *
 * The request object is passed down as the SAME object (only its `signal` is swapped in place), never a
 * spread copy: the recording tap above this wrapper reads `req.system`/`req.messages` back after the call,
 * so a below-seam provider that mutates the request in place (the contaminated-provider negative control)
 * must mutate the object the tap holds, or the leak would go unrecorded. */
export function withSeatBudget(provider: AgentProvider, caps: Pick<ArenaCaps, 'maxCallsPerSeat' | 'maxReplyChars'>): AgentProvider {
  let calls = 0
  return {
    async *stream(req) {
      calls += 1
      if (calls > caps.maxCallsPerSeat) throw new ArenaBudgetExceeded('calls', `call ${calls} over the per-seat cap of ${caps.maxCallsPerSeat}`)
      const outer = req.signal
      const own = new AbortController()
      const forward = (): void => own.abort()
      if (outer?.aborted) own.abort()
      outer?.addEventListener('abort', forward)
      req.signal = own.signal
      let chars = 0
      try {
        for await (const frag of provider.stream(req)) {
          chars += frag.length
          if (chars > caps.maxReplyChars) {
            own.abort()
            throw new ArenaBudgetExceeded('reply-chars', `reply over ${caps.maxReplyChars} characters`)
          }
          yield frag
        }
      } finally {
        outer?.removeEventListener('abort', forward)
        req.signal = outer
      }
    },
  }
}

export interface StartLiveMatchOptions {
  seats: Record<Mark, { provider: AgentProvider; selection: ArenaSeatRequest }>
  /** Receives the header line, then one transcript line per event, each terminated by `\n`. Synchronous:
   * a host that writes asynchronously serializes its own writes and aborts `signal` on a failed one. */
  write(line: string): void
  signal: AbortSignal
  caps?: ArenaCaps
  /** Test seam: pin the match id (and so the canaries). Hosts omit it. */
  matchId?: string
}

/** Run one live match: the header line first, then each transcript event as `runMatch` appends it. Resolves
 * with the completed `MatchResult` (its last written line is `game end`); throws `MatchAborted` when
 * `signal` fires or the deadline passes, after which nothing more is written. */
export async function startLiveMatch(opts: StartLiveMatchOptions): Promise<MatchResult> {
  const caps = opts.caps ?? ARENA_CAPS
  const matchId = opts.matchId ?? `live-${Date.now()}`
  const controller = new AbortController()
  const forward = (): void => controller.abort()
  if (opts.signal.aborted) controller.abort()
  opts.signal.addEventListener('abort', forward)
  const deadline = setTimeout(forward, caps.matchDeadlineMs)
  try {
    if (controller.signal.aborted) throw new MatchAborted()
    // deriveCanaryPair asserts X !== O at construction (review finding 3, LLD §7): fail-fast, never silent.
    const canaries = deriveCanaryPair(matchId)
    const seatConfig = (mark: Mark): MatchSeatConfig => {
      const { provider, selection } = opts.seats[mark]
      return {
        seat: createModelSeat({
          mark,
          canary: canaries[mark],
          provider: withSeatBudget(provider, caps),
          model: selection.model,
          maxTokens: caps.maxOutputTokens,
          signal: controller.signal,
        }),
        provider: selection.provider,
        model: selection.model,
      }
    }
    const seats: Record<Mark, MatchSeatConfig> = { X: seatConfig('X'), O: seatConfig('O') }
    // Pin `date` so the header written NOW is byte-identical to the one `runMatch` derives for its own
    // `MatchResult.header`: `buildMatchHeader` is the ONE construction both call (the header-desync class).
    const date = new Date().toISOString()
    opts.write(JSON.stringify(buildMatchHeader({ matchId, seats, scripted: false, date })) + '\n')
    return await runMatch({
      matchId,
      scripted: false,
      date,
      retryBound: RETRY_BOUND,
      perMoveTimeoutMs: PER_MOVE_TIMEOUT_MS,
      seats,
      signal: controller.signal,
      onEvent: (event) => {
        if (!controller.signal.aborted) opts.write(JSON.stringify(event) + '\n')
      },
    })
  } finally {
    clearTimeout(deadline)
    opts.signal.removeEventListener('abort', forward)
  }
}
