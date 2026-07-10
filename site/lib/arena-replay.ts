// site/lib/arena-replay.ts — LLD-C11 (SPEC-R13) derivation logic for the A2A tic-tac-toe demo page: turns
// a loaded match `Transcript` into (a) a paced sequence of board snapshots + narration (the replay), and
// (b) the isolation panel's data — the SAME `checkIsolation` gate the arena's own tests run, plus each
// seat's full recorded context, extracted for the side-by-side inspector. Everything here is derivation
// only (no DOM) so the drift gate (arena-replay.test.ts) can assert it directly, exactly like
// site/lib/a2ui-gallery.ts's `buildSeedGallery`/`buildSeedCard` split (derivation module vs. page module).
//
// Zero build-time network/model calls: the caller supplies the transcript's raw text (a Vite `?raw`
// static import of the committed `matches/*.jsonl` fixture in the static build, or the live proxy's
// response text under dev) — this module only PARSES + DERIVES, never fetches.
import {
  applyMove,
  checkIsolation,
  createBoard,
  parseTranscriptLines,
  readWireData,
  validateTranscript,
  PROTOCOL_VERSION,
} from '@agent-ui/a2a'
import type {
  Board,
  Mark,
  IsolationFailure,
  IsolationCheck,
  MoveMessage,
  Transcript,
  TranscriptEvent,
  ContextEvent,
  WireEvent,
  GameEventBody,
} from '@agent-ui/a2a'

/** Parse + schema-validate raw JSONL text into a `Transcript` (SPEC-R2/R12). `ok:false` carries every
 * schema failure found — the page's error panel (LLD §7 "Page fixture missing / schema-invalid") reads
 * this rather than rendering a broken/partial replay. */
export type LoadedTranscript = { ok: true; transcript: Transcript } | { ok: false; reasons: string[] }

export function loadTranscript(raw: string): LoadedTranscript {
  const lines = raw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
  const failures = validateTranscript(lines, { protocolVersion: PROTOCOL_VERSION })
  if (failures.length > 0) return { ok: false, reasons: failures.map((f) => `${f.path}: ${f.detail}`) }
  const transcript = parseTranscriptLines(lines)
  if (transcript === undefined) return { ok: false, reasons: ['transcript failed to parse after passing validation'] }
  return { ok: true, transcript }
}

// ── replay: a step per game event, each carrying the board AS OF that step ─────────────────────────────

export type ReplayStepKind = 'start' | 'move' | 'feedback' | 'end'

export interface ReplayStep {
  readonly index: number
  readonly board: Board
  readonly kind: ReplayStepKind
  readonly mark?: Mark
  readonly cell?: number
  readonly note?: string
  readonly narration: string
}

function isWireEvent(e: TranscriptEvent): e is WireEvent {
  return 'wire' in e
}

/** The spectator-only `note` a seat sent alongside `move` on the wire (LLD §2: never relayed to the
 * opponent, but the runner records it — the replay's own narration is the "spectator column" the LLD
 * names). `undefined` if that seat sent no note for this exact move. */
function noteForMove(t: Transcript, mark: Mark, cell: number): string | undefined {
  for (const e of t.events) {
    if (!isWireEvent(e) || e.wire.from !== mark || e.wire.to !== 'referee') continue
    const data = readWireData(e.wire.message) as MoveMessage | undefined
    if (data !== undefined && data.move === cell) return data.note
  }
  return undefined
}

// ── the ONE step-construction implementation — shared by the batch derivation (below) and the
// incremental accumulator (LLD-C2). Both call `stepForGameEvent`; neither hand-duplicates a narration
// string or a board-apply rule, so a live stream and a loaded fixture can never drift into two
// interpretations of the same event (the LLD's "no forked derivation" invariant).
interface StepBuilder {
  board: Board
  /** Running count of steps emitted so far (the `start` step counts as 1) — mirrors the batch
   * derivation's `steps.length`-as-next-index convention exactly. */
  count: number
}

function createStepBuilder(): { builder: StepBuilder; startStep: ReplayStep } {
  return {
    builder: { board: createBoard(), count: 1 },
    startStep: { index: 0, board: createBoard(), kind: 'start', narration: 'New match — X moves first.' },
  }
}

/** Build the ONE step a single `game` event produces, advancing `builder`'s running board/count. `note`
 * is the spectator note for a `move` event — resolved by the caller (a whole-transcript scan in the batch
 * path, an as-you-go map in the accumulator), never re-derived here. */
function stepForGameEvent(g: GameEventBody, builder: StepBuilder, note: string | undefined): ReplayStep {
  const index = builder.count
  builder.count += 1
  if (g.kind === 'move') {
    builder.board = applyMove(builder.board, g.move, g.seat)
    return {
      index,
      board: builder.board,
      kind: 'move',
      mark: g.seat,
      cell: g.move,
      note,
      narration: `${g.seat} plays cell ${g.move}${note ? ` — “${note}”` : ''}.`,
    }
  }
  if (g.kind === 'feedback') {
    return {
      index,
      board: builder.board,
      kind: 'feedback',
      mark: g.seat,
      narration: `${g.seat}'s move was ${g.code.toLowerCase()} (${g.detail}) — ${g.retriesLeft} retr${g.retriesLeft === 1 ? 'y' : 'ies'} left.`,
    }
  }
  const reason = g.reason
  const narration =
    reason.kind === 'win'
      ? `${reason.winner} wins.`
      : reason.kind === 'draw'
        ? 'Draw — the board is full with no line.'
        : `${reason.loser} forfeits (${reason.cause.replace('-', ' ')}) — ${reason.loser === 'X' ? 'O' : 'X'} wins.`
  return { index, board: builder.board, kind: 'end', narration }
}

/** One step per `game` event (move / feedback / end) — the SAME ordered log the transcript's own
 * validator checks (SPEC-R12 "a game apply must follow the wire move it names"). A leading `start` step
 * carries the empty board so the scrubber has a step 0 to rest on before any move. */
export function buildReplaySteps(t: Transcript): ReplayStep[] {
  const { builder, startStep } = createStepBuilder()
  const steps: ReplayStep[] = [startStep]
  for (const e of t.events) {
    if (!('game' in e)) continue
    const g = e.game
    const note = g.kind === 'move' ? noteForMove(t, g.seat, g.move) : undefined
    steps.push(stepForGameEvent(g, builder, note))
  }
  return steps
}

// ── LLD-C2: the incremental accumulator (SPEC-R17 AC1/AC2) ────────────────────────────────────────────
// Feeds the SAME `stepForGameEvent` one raw line at a time — a live stream and `buildReplaySteps` over the
// completed transcript can never disagree about what a step IS, only about how the per-move `note` is
// looked up (a whole-transcript scan there; an as-you-go map here, since only-what's-arrived exists yet).

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export interface ReplayAccumulator {
  /** Feed ONE raw transcript line (header first). Returns the steps/context lines this line appended —
   * empty for a wire-only line — or a typed fault (malformed line, line before header). Fail-closed:
   * after a fault the accumulator accepts nothing further. */
  push(
    line: string,
  ):
    | { ok: true; steps: ReplayStep[]; contexts: { seat: Mark; line: ContextLine }[] }
    | { ok: false; reason: string }
  /** Every raw line pushed so far, verbatim — the accumulated text a completed run hands BACK to the
   * batch path (`loadTranscript`), guaranteeing the live and fixture paths converge byte-identically. */
  raw(): string
  /** True once a `game:{kind:'end'}` event has been pushed — the referee emits exactly one for every
   * completed match (win · draw · forfeit). COMPLETION IS THIS MODULE'S FACT, not the validator's:
   * `validateTranscript` deliberately has no terminal-event requirement, so a cleanly truncated valid
   * prefix VALIDATES ok — the caller's `done` state MUST gate on this, never on stream end alone. */
  isComplete(): boolean
}

export function createReplayAccumulator(): ReplayAccumulator {
  let headerSeen = false
  let faulted = false
  let complete = false
  const pushedLines: string[] = []
  // seat:move -> the note that seat's wire move carried, first-wins (mirrors `noteForMove`'s own
  // first-match-in-event-order semantics over the whole transcript).
  const noteByMove = new Map<string, string | undefined>()
  const { builder, startStep } = createStepBuilder()

  function refuse(reason: string): { ok: false; reason: string } {
    faulted = true
    return { ok: false, reason }
  }

  return {
    push(line) {
      if (faulted) return refuse('accumulator already faulted; refusing further input')

      if (!headerSeen) {
        try {
          JSON.parse(line)
        } catch (e) {
          return refuse(`malformed header line: ${String(e)}`)
        }
        headerSeen = true
        pushedLines.push(line)
        return { ok: true, steps: [startStep], contexts: [] }
      }

      let parsed: unknown
      try {
        parsed = JSON.parse(line)
      } catch (e) {
        return refuse(`malformed event line: ${String(e)}`)
      }
      if (!isPlainObject(parsed)) return refuse('malformed event: not an object')
      const keys = (['wire', 'context', 'game'] as const).filter((k) => k in parsed)
      if (keys.length !== 1) {
        return refuse(`malformed event: must carry exactly one of wire|context|game (got: ${keys.join(',') || 'none'})`)
      }
      pushedLines.push(line)
      const event = parsed as unknown as TranscriptEvent

      if (isWireEvent(event)) {
        const { from, to, message } = event.wire
        if (to === 'referee' && (from === 'X' || from === 'O')) {
          const data = readWireData(message) as MoveMessage | undefined
          if (data !== undefined && typeof data.move === 'number' && !noteByMove.has(`${from}:${data.move}`)) {
            noteByMove.set(`${from}:${data.move}`, data.note)
          }
        }
        return { ok: true, steps: [], contexts: [] }
      }
      if (isContextEvent(event)) {
        return { ok: true, steps: [], contexts: [{ seat: event.context.seat, line: { role: event.context.entry.role, content: event.context.entry.content } }] }
      }
      const g = event.game
      const note = g.kind === 'move' ? noteByMove.get(`${g.seat}:${g.move}`) : undefined
      const step = stepForGameEvent(g, builder, note)
      if (g.kind === 'end') complete = true
      return { ok: true, steps: [step], contexts: [] }
    },
    raw() {
      return pushedLines.length > 0 ? pushedLines.join('\n') + '\n' : ''
    },
    isComplete() {
      return complete
    },
  }
}

// ── isolation panel: the verdict + each seat's full recorded context ───────────────────────────────────

export const ISOLATION_CHECKS: readonly IsolationCheck[] = ['canary', 'wire-origin', 'closed-schema', 'provenance']

export interface ContextLine {
  readonly role: 'system' | 'user' | 'assistant'
  readonly content: string
}

export interface IsolationReport {
  readonly failures: IsolationFailure[]
  readonly byCheck: Record<IsolationCheck, IsolationFailure[]>
  readonly clean: boolean
  readonly contexts: Record<Mark, ContextLine[]>
}

function isContextEvent(e: TranscriptEvent): e is ContextEvent {
  return 'context' in e
}

/** Run the arena's OWN `checkIsolation` (never a re-derived/forked check, LLD §2 "in-page proof") over
 * the loaded transcript, and pull each seat's full recorded context alongside it, for the side-by-side
 * inspector — the same source data the gate itself reads. */
export function buildIsolationReport(t: Transcript): IsolationReport {
  const failures = checkIsolation(t)
  const byCheck = Object.fromEntries(ISOLATION_CHECKS.map((c) => [c, failures.filter((f) => f.check === c)])) as Record<
    IsolationCheck,
    IsolationFailure[]
  >
  const contexts: Record<Mark, ContextLine[]> = { X: [], O: [] }
  for (const e of t.events) {
    if (isContextEvent(e)) contexts[e.context.seat].push({ role: e.context.entry.role, content: e.context.entry.content })
  }
  return { failures, byCheck, clean: failures.length === 0, contexts }
}
