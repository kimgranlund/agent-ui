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
import type { Board, Mark, IsolationFailure, IsolationCheck, MoveMessage, Transcript, TranscriptEvent, ContextEvent, WireEvent } from '@agent-ui/a2a'

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

/** One step per `game` event (move / feedback / end) — the SAME ordered log the transcript's own
 * validator checks (SPEC-R12 "a game apply must follow the wire move it names"). A leading `start` step
 * carries the empty board so the scrubber has a step 0 to rest on before any move. */
export function buildReplaySteps(t: Transcript): ReplayStep[] {
  const steps: ReplayStep[] = [{ index: 0, board: createBoard(), kind: 'start', narration: 'New match — X moves first.' }]
  let board = createBoard()
  for (const e of t.events) {
    if (!('game' in e)) continue
    const g = e.game
    if (g.kind === 'move') {
      board = applyMove(board, g.move, g.seat)
      const note = noteForMove(t, g.seat, g.move)
      steps.push({
        index: steps.length,
        board,
        kind: 'move',
        mark: g.seat,
        cell: g.move,
        note,
        narration: `${g.seat} plays cell ${g.move}${note ? ` — “${note}”` : ''}.`,
      })
    } else if (g.kind === 'feedback') {
      steps.push({
        index: steps.length,
        board,
        kind: 'feedback',
        mark: g.seat,
        narration: `${g.seat}'s move was ${g.code.toLowerCase()} (${g.detail}) — ${g.retriesLeft} retr${g.retriesLeft === 1 ? 'y' : 'ies'} left.`,
      })
    } else {
      const reason = g.reason
      const narration =
        reason.kind === 'win'
          ? `${reason.winner} wins.`
          : reason.kind === 'draw'
            ? 'Draw — the board is full with no line.'
            : `${reason.loser} forfeits (${reason.cause.replace('-', ' ')}) — ${reason.loser === 'X' ? 'O' : 'X'} wins.`
      steps.push({ index: steps.length, board, kind: 'end', narration })
    }
  }
  return steps
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
