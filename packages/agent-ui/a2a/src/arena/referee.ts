// referee.ts — LLD-C2: the deterministic turn engine, a PURE reducer over the task lifecycle (SPEC-R9,
// R11; LLD §3). Never a model. Owns legality (via board.ts), turn order, retries, and game end; drives
// each seat's `TaskState` through `guardTransition`/`TASK_TRANSITIONS` (SPEC-R4) — including the
// arena-driven `input-required -> completed` forfeit edge (a seat that never validly replied this turn
// goes straight from "owes a move" to "done", skipping `working`).
//
// State-machine summary (LLD §3):
//   awaiting(seat) --legal move--> apply -> win? end(won/lost) : draw? end(draw) : awaiting(other), retries reset
//   awaiting(seat) --illegal/malformed--> retriesLeft-- -> >0: feedback(illegal-retry) same seat
//                                                        -> 0: end(forfeit -> opponent wins)
//   end(*) --> notify BOTH seats -> tasks completed (terminal, SPEC-R4)
//
// Task-state convention (family policy, not upstream-normative — task-state.ts's own note): the seat
// whose turn it is sits at `input-required` (it owes a move); the other seat sits at `working` (idle,
// nothing needed from it right now). A LEGAL reply transitions the replying seat `input-required ->
// working` (it answered) before anything else — so a normal win/draw ends via `working -> completed` for
// BOTH seats. An illegal/malformed reply with retries remaining does NOT transition at all (the seat
// still owes a move, unchanged). A forfeit (retry bound exhausted, or a direct abort/provider hard-fail)
// happens while the seat is STILL `input-required` — hence the direct `input-required -> completed` edge.
import type { Board, Mark } from './board.ts'
import { applyMove, boardOutcome, createBoard, isLegalMove, legalMoves } from './board.ts'
import { guardTransition } from '../protocol/task-state.ts'
import type { TaskState } from '../protocol/types.ts'

export const DEFAULT_RETRY_BOUND = 2 // SPEC-R11 default

export type GameStatus = 'your-turn' | 'illegal-retry' | 'won' | 'lost' | 'draw' | 'forfeit-win' | 'forfeit-loss'

/** The ONLY thing a seat ever receives (LLD §2) — closed shape, no extra keys (the wire-origin audit
 * depends on this staying exactly this set). */
export interface BoardMessage {
  board: Board
  yourMark: Mark
  lastOpponentMove: number | null
  legalMoves: number[]
  status: GameStatus
  feedback?: { code: 'ILLEGAL' | 'MALFORMED'; detail: string; retriesLeft: number }
}

/** What a seat sends back. `note` is spectator-only — the referee NEVER relays it to the opponent. */
export interface MoveMessage {
  move: number
  note?: string
}

export type ForfeitCause = 'retries-exhausted' | 'provider-error' | 'aborted'

export type EndReason =
  | { kind: 'win'; winner: Mark }
  | { kind: 'draw' }
  | { kind: 'forfeit'; loser: Mark; cause: ForfeitCause }

export interface RefereeState {
  board: Board
  toMove: Mark
  retryBound: number
  retriesLeft: Record<Mark, number>
  taskState: Record<Mark, TaskState>
  /** The last cell each mark itself played (used to fill the OPPONENT's `lastOpponentMove`). */
  lastMoveBy: Record<Mark, number | null>
  phase: 'playing' | 'ended'
  end?: EndReason
}

export interface RefereeOutbound {
  to: Mark
  message: BoardMessage
}

export interface ReduceResult {
  state: RefereeState
  outbound: RefereeOutbound[]
}

function other(mark: Mark): Mark {
  return mark === 'X' ? 'O' : 'X'
}

/** Guard + apply one task-lifecycle move (SPEC-R4). Throws on an illegal transition — unreachable by
 * construction (every call site below only ever names a table-legal edge); `referee.test.ts` walks full
 * matches and re-asserts every actual transition the referee made against `guardTransition` directly,
 * so this throw path is a defect trip-wire, not expected-reachable control flow. */
function advance(taskState: Record<Mark, TaskState>, seat: Mark, to: TaskState): Record<Mark, TaskState> {
  const failures = guardTransition(taskState[seat], to)
  if (failures.length > 0) {
    throw new Error(`referee: illegal task transition for ${seat}: ${taskState[seat]} -> ${to} (${failures[0]!.detail})`)
  }
  return { ...taskState, [seat]: to }
}

export function createRefereeState(retryBound: number = DEFAULT_RETRY_BOUND): RefereeState {
  return {
    board: createBoard(),
    toMove: 'X',
    retryBound,
    retriesLeft: { X: retryBound, O: retryBound },
    taskState: { X: 'submitted', O: 'submitted' },
    lastMoveBy: { X: null, O: null },
    phase: 'playing',
  }
}

function boardMessageFor(state: RefereeState, seat: Mark, status: GameStatus, feedback?: BoardMessage['feedback']): BoardMessage {
  const msg: BoardMessage = {
    board: state.board,
    yourMark: seat,
    lastOpponentMove: state.lastMoveBy[other(seat)],
    legalMoves: legalMoves(state.board),
    status,
  }
  return feedback === undefined ? msg : { ...msg, feedback }
}

/** Start the match: both seats `submitted -> working`; the first mover (X) additionally `working ->
 * input-required`, carrying the opening `your-turn` prompt. O stays `working` (idle) until asked. */
export function beginMatch(state: RefereeState): ReduceResult {
  let taskState = advance(state.taskState, 'X', 'working')
  taskState = advance(taskState, 'O', 'working')
  taskState = advance(taskState, 'X', 'input-required')
  const next: RefereeState = { ...state, taskState }
  return { state: next, outbound: [{ to: 'X', message: boardMessageFor(next, 'X', 'your-turn') }] }
}

export type RefereeInput =
  | { kind: 'move'; seat: Mark; move: MoveMessage }
  /** Unparseable reply, or the runner mapping a per-move timeout (LLD §7) — consumes a retry, same as illegal. */
  | { kind: 'malformed'; seat: Mark; detail: string }
  /** Provider hard-fail / abort (LLD §7) — a DIRECT forfeit, no retry consumed. */
  | { kind: 'abort'; seat: Mark; cause: Extract<ForfeitCause, 'provider-error' | 'aborted'>; detail: string }

function endBoth(state: RefereeState, end: EndReason, statusFor: (seat: Mark) => GameStatus): ReduceResult {
  const ended: RefereeState = { ...state, phase: 'ended', end }
  return {
    state: ended,
    outbound: [
      { to: 'X', message: boardMessageFor(ended, 'X', statusFor('X')) },
      { to: 'O', message: boardMessageFor(ended, 'O', statusFor('O')) },
    ],
  }
}

/** Direct forfeit while `loser` is STILL `input-required` (it never validly replied this turn) — the
 * arena-driven `input-required -> completed` edge. */
function forfeit(state: RefereeState, loser: Mark, cause: ForfeitCause): ReduceResult {
  let taskState = advance(state.taskState, loser, 'completed') // input-required -> completed, direct
  taskState = advance(taskState, other(loser), 'completed') // working -> completed
  return endBoth({ ...state, taskState }, { kind: 'forfeit', loser, cause }, (seat) => (seat === loser ? 'forfeit-loss' : 'forfeit-win'))
}

function retryOrForfeit(state: RefereeState, seat: Mark, code: 'ILLEGAL' | 'MALFORMED', detail: string): ReduceResult {
  const retriesLeft = state.retriesLeft[seat] - 1
  if (retriesLeft > 0) {
    const next: RefereeState = { ...state, retriesLeft: { ...state.retriesLeft, [seat]: retriesLeft } }
    return { state: next, outbound: [{ to: seat, message: boardMessageFor(next, seat, 'illegal-retry', { code, detail, retriesLeft }) }] }
  }
  return forfeit(state, seat, 'retries-exhausted')
}

function applyLegalMove(state: RefereeState, seat: Mark, move: number): ReduceResult {
  const board = applyMove(state.board, move, seat)
  const lastMoveBy = { ...state.lastMoveBy, [seat]: move }
  const outcome = boardOutcome(board)
  const answered = advance(state.taskState, seat, 'working') // it answered — leaves input-required

  if (outcome.kind === 'win' || outcome.kind === 'draw') {
    let taskState = advance(answered, seat, 'completed')
    taskState = advance(taskState, other(seat), 'completed')
    const end: EndReason = outcome.kind === 'win' ? { kind: 'win', winner: outcome.mark } : { kind: 'draw' }
    const ended: RefereeState = { ...state, board, lastMoveBy, taskState, phase: 'ended', end }
    const statusFor = (s: Mark): GameStatus =>
      outcome.kind === 'draw' ? 'draw' : outcome.mark === s ? 'won' : 'lost'
    return {
      state: ended,
      outbound: [
        { to: 'X', message: boardMessageFor(ended, 'X', statusFor('X')) },
        { to: 'O', message: boardMessageFor(ended, 'O', statusFor('O')) },
      ],
    }
  }

  // Ongoing — flip turn, reset the replying seat's retry budget (a fresh bound each of ITS turns), ask
  // the other seat.
  const next = other(seat)
  const taskState = advance(answered, next, 'input-required')
  const nextState: RefereeState = {
    ...state,
    board,
    lastMoveBy,
    taskState,
    toMove: next,
    retriesLeft: { ...state.retriesLeft, [seat]: state.retryBound },
  }
  return { state: nextState, outbound: [{ to: next, message: boardMessageFor(nextState, next, 'your-turn') }] }
}

/** The reducer (LLD-C2). Throws only on a runner programming error (calling after the game ended, or for
 * a seat whose turn it isn't) — both are unreachable given a correctly-driven match runner, never a
 * match-content outcome. */
export function reduce(state: RefereeState, input: RefereeInput): ReduceResult {
  if (state.phase === 'ended') throw new Error('referee.reduce: called after the game already ended')
  if (input.seat !== state.toMove) {
    throw new Error(`referee.reduce: input from ${input.seat} but it is ${state.toMove}'s turn`)
  }

  if (input.kind === 'abort') return forfeit(state, input.seat, input.cause)
  if (input.kind === 'malformed') return retryOrForfeit(state, input.seat, 'MALFORMED', input.detail)
  if (!isLegalMove(state.board, input.move.move)) {
    return retryOrForfeit(state, input.seat, 'ILLEGAL', `cell ${input.move.move} is occupied or out of range`)
  }
  return applyLegalMove(state, input.seat, input.move.move)
}
