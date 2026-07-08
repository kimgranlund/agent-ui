// isolation.ts — LLD-C4: the isolation gate (SPEC-R10). Pure, zero-dep — this module imports ONLY from
// `./board.ts`/`./referee.ts`/`./transcript.ts` (never `tools/`), so the browser page can run the SAME
// checker in-page later (SPEC-R13) with no fork. Four checks, batch (never throws): canary absence,
// wire origin, closed schema, context provenance (LLD §2).
//
// COMPLETENESS SCOPE (review finding 1, LLD §2): the closed-schema check validates top-level
// `BoardMessage` keys PLUS the referee-form-pinned nested strings it can cheaply pin from this module
// (the `feedback` object's own closed key set, and the exact ILLEGAL `feedback.detail` template referee.ts
// generates deterministically) — it does NOT content-validate free-text nested fields the referee merely
// relays (a MALFORMED `feedback.detail`, which carries the seat's own unbounded raw reply or a runner
// timeout message) or `assistant`-role context entries (the seat's own free-form output). That free-text
// surface rides on the canary-absence check (check 1) only: a genuine cross-seat leak necessarily either
// carries a foreign canary token or lands as an ILLEGAL feedback.detail deviating from the pinned form —
// see the isolation.test.ts negative controls for both.
import type { Mark } from './board.ts'
import type { BoardMessage } from './referee.ts'
import type { ContextEvent, Party, Transcript, TranscriptEvent, WireEvent } from './transcript.ts'
import { readWireData } from './transcript.ts'

export type IsolationCheck = 'canary' | 'wire-origin' | 'closed-schema' | 'provenance'

export interface IsolationFailure {
  check: IsolationCheck
  detail: string
}

const CANARY_PATTERN = /A2A-ISOLATION-CANARY-[XO]-[0-9a-fA-F]+/g

function other(mark: Mark): Mark {
  return mark === 'X' ? 'O' : 'X'
}

function isWireEvent(e: TranscriptEvent): e is WireEvent {
  return 'wire' in e
}

function isContextEvent(e: TranscriptEvent): e is ContextEvent {
  return 'context' in e
}

/** The BoardMessage closed key set (LLD §2) — an extra key on a referee->seat body is a leak vector. */
const BOARD_MESSAGE_KEYS = new Set(['board', 'yourMark', 'lastOpponentMove', 'legalMoves', 'status', 'feedback'])

/** `feedback`'s own closed key set (BoardMessage['feedback'], referee.ts) — a nested extra key is the
 * exact leak vector finding 1 named: the top-level filter alone never looks INSIDE an allowed key. */
const FEEDBACK_KEYS = new Set(['code', 'detail', 'retriesLeft'])

/** The referee's own ILLEGAL `feedback.detail` template — mirrors referee.ts's `retryOrForfeit` call site
 * (`` `cell ${move} is occupied or out of range` ``) verbatim. Pinned here (not imported — `isolation.ts`
 * only ever `import type`s from `referee.ts`, by design, so the browser reuse stays zero-runtime-dep) as a
 * regex over every JSON-numeric form `move` can take — including JS's exponential `String(Number)`
 * grammar (review fix: `{"move": 1e21}` passes `parseMoveReply`'s `Number.isInteger` check, so
 * `String(1e21) === "1e+21"` DOES reach this template; the pre-fix pattern missed the `[eE][+-]?\d+`
 * exponent suffix and spuriously failed a clean match). ILLEGAL is the one feedback form referee.ts fully
 * authors deterministically (MALFORMED carries the seat's own free-text reply or a runner timeout message
 * — neither is a referee-authored form, so neither is pinned; see the header's completeness scope). */
const ILLEGAL_DETAIL_PATTERN = /^cell (-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|NaN|-?Infinity) is occupied or out of range$/

/** Nested-shape validation for an ALLOWED top-level `feedback` value (finding 1's stronger arm): closes
 * `feedback`'s own key set, and — where referee.ts fully determines the string (ILLEGAL) — pins its exact
 * form, so a hand-edited leak hiding opponent content behind a valid top-level shape still fails. */
function checkFeedbackShape(to: Party, feedback: unknown): IsolationFailure[] {
  if (typeof feedback !== 'object' || feedback === null || Array.isArray(feedback)) {
    return [{ check: 'closed-schema', detail: `referee->${to} message carries a non-object feedback field` }]
  }
  const failures: IsolationFailure[] = []
  const extra = Object.keys(feedback).filter((k) => !FEEDBACK_KEYS.has(k))
  if (extra.length > 0) {
    failures.push({ check: 'closed-schema', detail: `referee->${to} message carries extra feedback key(s): ${extra.join(', ')}` })
  }
  const code = (feedback as { code?: unknown }).code
  const detail = (feedback as { detail?: unknown }).detail
  if (code === 'ILLEGAL' && typeof detail === 'string' && !ILLEGAL_DETAIL_PATTERN.test(detail)) {
    failures.push({ check: 'closed-schema', detail: `referee->${to} message carries a non-pinned ILLEGAL feedback.detail: "${detail}"` })
  }
  return failures
}

function extractCanaries(text: string): string[] {
  return [...text.matchAll(CANARY_PATTERN)].map((m) => m[0])
}

/**
 * Check 1 — canary absence: seat A's canary appears nowhere in (a) seat B's full recorded context, or
 * (b) any wire message addressed to B — and symmetrically.
 */
function checkCanaryAbsence(t: Transcript): IsolationFailure[] {
  const failures: IsolationFailure[] = []
  const ownCanaries: Record<Mark, Set<string>> = { X: new Set(), O: new Set() }
  for (const e of t.events) {
    if (isContextEvent(e)) {
      for (const c of extractCanaries(e.context.entry.content)) ownCanaries[e.context.seat].add(c)
    }
  }
  for (const mark of ['X', 'O'] as const) {
    const foreign = other(mark)
    const foreignCanaries = ownCanaries[foreign]
    if (foreignCanaries.size === 0) continue // nothing to check absence of (e.g. a fixture with no canary at all)
    for (const e of t.events) {
      if (isContextEvent(e) && e.context.seat === mark) {
        for (const c of extractCanaries(e.context.entry.content)) {
          if (foreignCanaries.has(c)) {
            failures.push({ check: 'canary', detail: `${foreign}'s canary "${c}" found in ${mark}'s recorded context` })
          }
        }
      }
      if (isWireEvent(e) && e.wire.to === mark) {
        for (const c of extractCanaries(JSON.stringify(e.wire.message))) {
          if (foreignCanaries.has(c)) {
            failures.push({ check: 'canary', detail: `${foreign}'s canary "${c}" found in a wire message addressed to ${mark}` })
          }
        }
      }
    }
  }
  return failures
}

/** Check 2 — wire origin: every seat-inbound message has `from: 'referee'`; no seat->seat entry exists
 * in either direction. */
function checkWireOrigin(t: Transcript): IsolationFailure[] {
  const failures: IsolationFailure[] = []
  for (const e of t.events) {
    if (!isWireEvent(e)) continue
    const { from, to } = e.wire
    if ((to === 'X' || to === 'O') && from !== 'referee') {
      failures.push({ check: 'wire-origin', detail: `message addressed to ${to} has non-referee origin "${from}"` })
    }
  }
  return failures
}

/** Check 3 — closed schema: every referee->seat body validates as `BoardMessage` with NO extra keys —
 * top-level AND, where cheaply pinnable, one level into the `feedback` nested field (finding 1: a
 * top-level-only key check never looks inside an allowed key, so a leak could hide there). */
function checkClosedSchema(t: Transcript): IsolationFailure[] {
  const failures: IsolationFailure[] = []
  for (const e of t.events) {
    if (!isWireEvent(e) || e.wire.from !== 'referee') continue
    const data = readWireData(e.wire.message)
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      failures.push({ check: 'closed-schema', detail: `referee->${e.wire.to} message carries no BoardMessage data` })
      continue
    }
    const extra = Object.keys(data).filter((k) => !BOARD_MESSAGE_KEYS.has(k))
    if (extra.length > 0) {
      failures.push({ check: 'closed-schema', detail: `referee->${e.wire.to} message carries extra key(s): ${extra.join(', ')}` })
    }
    const feedback = (data as { feedback?: unknown }).feedback
    if (feedback !== undefined) failures.push(...checkFeedbackShape(e.wire.to, feedback))
  }
  return failures
}

/**
 * Check 4 — context provenance: every `system` entry sits at position 0, and every `user` entry
 * byte-identically frames a `BoardMessage` the transcript shows was ACTUALLY sent to that seat.
 * `assistant` entries have NO referee-authored form to check against (they are the seat's own free-form
 * output) — this check does not, and cannot, validate them; that surface rides on the canary-absence
 * check (check 1) and the closed-schema check (check 3, `feedback.detail`) instead, per the module
 * header's completeness scope. A genuine cross-seat leak necessarily either carries a foreign canary
 * token or an extra-keyed/non-pinned wire body — those are what catch a co-mingled/injected
 * assistant-role entry, never this check.
 */
function checkProvenance(t: Transcript): IsolationFailure[] {
  const failures: IsolationFailure[] = []
  const sentBoardMessages: Record<Mark, BoardMessage[]> = { X: [], O: [] }
  const contextIndex: Record<Mark, number> = { X: 0, O: 0 }
  for (const e of t.events) {
    if (isWireEvent(e) && e.wire.from === 'referee' && (e.wire.to === 'X' || e.wire.to === 'O')) {
      const data = readWireData(e.wire.message)
      if (data !== undefined) sentBoardMessages[e.wire.to].push(data as BoardMessage)
    }
    if (isContextEvent(e)) {
      const { seat, entry } = e.context
      const idx = contextIndex[seat]
      if (entry.role === 'system') {
        if (idx !== 0) failures.push({ check: 'provenance', detail: `${seat}'s context has a "system" entry NOT at position 0 (index ${idx})` })
      } else if (entry.role === 'user') {
        const matches = sentBoardMessages[seat].some((bm) => JSON.stringify(bm) === entry.content)
        if (!matches) failures.push({ check: 'provenance', detail: `${seat}'s context has a "user" entry with no matching referee BoardMessage` })
      }
      contextIndex[seat] = idx + 1
    }
  }
  return failures
}

/** The gate (LLD-C4, SPEC-R10 AC1). Batch: runs all four checks and returns every failure found — never
 * throws. Non-vacuous by construction: the committed negative controls (LLD-C9) each assert a non-zero
 * exit here. */
export function checkIsolation(t: Transcript): IsolationFailure[] {
  return [...checkCanaryAbsence(t), ...checkWireOrigin(t), ...checkClosedSchema(t), ...checkProvenance(t)]
}
