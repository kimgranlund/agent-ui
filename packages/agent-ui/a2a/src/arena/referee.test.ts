// referee.test.ts — LLD-C2 checkpoint (SPEC-R11 AC1): alternation, illegal-move feedback + bounded
// retry, forfeit (retry-exhausted + direct abort), win/draw end-notification to BOTH seats, and every
// actual task-lifecycle transition made during a full match is `guardTransition`-legal (SPEC-R4 AC1).
import { describe, expect, it } from 'vitest'
import {
  beginMatch,
  createRefereeState,
  DEFAULT_RETRY_BOUND,
  reduce,
  type RefereeInput,
  type RefereeState,
} from './referee.ts'
import { guardTransition } from '../protocol/task-state.ts'
import { TERMINAL_STATES } from '../protocol/types.ts'
import type { Mark } from './board.ts'

function move(seat: Mark, cell: number): RefereeInput {
  return { kind: 'move', seat, move: { move: cell } }
}

/** Wrap `reduce`, recording every task-state transition it makes (both seats, every call) so the suite
 * can assert the WHOLE sequence is guardTransition-legal — not just trust the reducer's internal `advance`. */
function tracedReduce(prev: RefereeState, input: RefereeInput, trace: { seat: Mark; from: string; to: string }[]) {
  const before = { ...prev.taskState }
  const result = reduce(prev, input)
  for (const seat of ['X', 'O'] as const) {
    if (result.state.taskState[seat] !== before[seat]) {
      trace.push({ seat, from: before[seat], to: result.state.taskState[seat] })
    }
  }
  return result
}

describe('referee (LLD-C2) — turn engine', () => {
  it('beginMatch: both submitted -> working, X -> input-required, opening your-turn prompt to X only', () => {
    const state = createRefereeState()
    const { state: next, outbound } = beginMatch(state)
    expect(next.taskState).toEqual({ X: 'input-required', O: 'working' })
    expect(outbound).toEqual([
      { to: 'X', message: { board: next.board, yourMark: 'X', lastOpponentMove: null, legalMoves: [0, 1, 2, 3, 4, 5, 6, 7, 8], status: 'your-turn' } },
    ])
  })

  it('alternates turns on legal moves, resetting retries and flipping toMove', () => {
    let state = beginMatch(createRefereeState()).state
    const r1 = reduce(state, move('X', 0))
    state = r1.state
    expect(state.toMove).toBe('O')
    expect(state.taskState).toEqual({ X: 'working', O: 'input-required' })
    expect(r1.outbound).toEqual([{ to: 'O', message: { board: state.board, yourMark: 'O', lastOpponentMove: 0, legalMoves: [1, 2, 3, 4, 5, 6, 7, 8], status: 'your-turn' } }])

    const r2 = reduce(state, move('O', 3))
    state = r2.state
    expect(state.toMove).toBe('X')
    expect(r2.outbound[0]!.message.lastOpponentMove).toBe(3)
  })

  it('illegal move: structured feedback to the SAME seat, retry bound decrements, game continues', () => {
    const state = beginMatch(createRefereeState()).state
    const r = reduce(state, move('X', 99)) // out of range
    expect(r.state.phase).toBe('playing')
    expect(r.state.toMove).toBe('X') // still X's turn
    expect(r.outbound).toHaveLength(1)
    expect(r.outbound[0]).toEqual({
      to: 'X',
      message: {
        board: r.state.board,
        yourMark: 'X',
        lastOpponentMove: null,
        legalMoves: [0, 1, 2, 3, 4, 5, 6, 7, 8],
        status: 'illegal-retry',
        feedback: { code: 'ILLEGAL', detail: 'cell 99 is occupied or out of range', retriesLeft: DEFAULT_RETRY_BOUND - 1 },
      },
    })
  })

  it('a scripted seat emitting illegal then legal completes with ONE structured-feedback exchange recorded (SPEC-R11 AC1)', () => {
    // X occupies cell 0; then O tries cell 0 too (illegal — occupied), then O plays legally at cell 1.
    let state = beginMatch(createRefereeState()).state
    state = reduce(state, move('X', 0)).state // now O's turn
    const oIllegal = reduce(state, move('O', 0)) // occupied by X — illegal
    expect(oIllegal.outbound[0]!.message.status).toBe('illegal-retry')
    const oLegal = reduce(oIllegal.state, move('O', 1))
    expect(oLegal.state.phase).toBe('playing')
    expect(oLegal.state.toMove).toBe('X')
  })

  it('exhausting the retry bound forfeits to the opponent; both seats notified; end reason recorded', () => {
    const state = beginMatch(createRefereeState(2)).state
    let r = reduce(state, move('X', -1)) // 1st illegal — retriesLeft 1
    expect(r.state.phase).toBe('playing')
    r = reduce(r.state, move('X', -1)) // 2nd illegal — bound exhausted
    expect(r.state.phase).toBe('ended')
    expect(r.state.end).toEqual({ kind: 'forfeit', loser: 'X', cause: 'retries-exhausted' })
    expect(r.outbound).toHaveLength(2)
    const toX = r.outbound.find((o) => o.to === 'X')!
    const toO = r.outbound.find((o) => o.to === 'O')!
    expect(toX.message.status).toBe('forfeit-loss')
    expect(toO.message.status).toBe('forfeit-win')
  })

  it('a direct abort (provider hard-fail) forfeits immediately — no retry consumed', () => {
    const state = beginMatch(createRefereeState(5)).state
    const r = reduce(state, { kind: 'abort', seat: 'X', cause: 'provider-error', detail: 'upstream 500' })
    expect(r.state.phase).toBe('ended')
    expect(r.state.end).toEqual({ kind: 'forfeit', loser: 'X', cause: 'provider-error' })
    expect(r.state.retriesLeft.X).toBe(5) // untouched — direct forfeit, not a retry consumption
  })

  it('a malformed reply (unparseable / timeout) is handled exactly like illegal — same bound, same feedback code', () => {
    const state = beginMatch(createRefereeState(1)).state
    const r = reduce(state, { kind: 'malformed', seat: 'X', detail: 'could not parse move' })
    expect(r.state.phase).toBe('ended') // bound=1, exhausted on first malformed
    expect(r.state.end).toEqual({ kind: 'forfeit', loser: 'X', cause: 'retries-exhausted' })
  })

  it('game end (win) notifies BOTH seats and completes both tasks (terminal, SPEC-R4)', () => {
    let s = beginMatch(createRefereeState()).state
    // X: 0,1,2 (top row); O: 3,4 — X wins on move 3 (its 3rd move)
    s = reduce(s, move('X', 0)).state
    s = reduce(s, move('O', 3)).state
    s = reduce(s, move('X', 1)).state
    s = reduce(s, move('O', 4)).state
    const r = reduce(s, move('X', 2)) // completes top row
    expect(r.state.phase).toBe('ended')
    expect(r.state.end).toEqual({ kind: 'win', winner: 'X' })
    expect(r.state.taskState).toEqual({ X: 'completed', O: 'completed' })
    for (const terminal of TERMINAL_STATES) expect(guardTransition(terminal, 'working')).not.toEqual([]) // terminals seal
    const toX = r.outbound.find((o) => o.to === 'X')!
    const toO = r.outbound.find((o) => o.to === 'O')!
    expect(toX.message.status).toBe('won')
    expect(toO.message.status).toBe('lost')
  })

  it('a draw notifies both seats status "draw"', () => {
    // Builds the same no-line-complete full board as board.test.ts's draw fixture: X O X / X O O / O X X.
    let s = beginMatch(createRefereeState()).state
    const seq: { seat: Mark; cell: number }[] = [
      { seat: 'X', cell: 0 },
      { seat: 'O', cell: 1 },
      { seat: 'X', cell: 2 },
      { seat: 'O', cell: 4 },
      { seat: 'X', cell: 3 },
      { seat: 'O', cell: 5 },
      { seat: 'X', cell: 7 },
      { seat: 'O', cell: 6 },
    ]
    for (const { seat, cell } of seq) {
      s = reduce(s, move(seat, cell)).state
    }
    // final move: X at 8 (X's 5th move — the 9th overall) — fills the board, no line completes
    const r = reduce(s, move('X', 8))
    expect(r.state.end).toEqual({ kind: 'draw' })
    expect(r.outbound.every((o) => o.message.status === 'draw')).toBe(true)
  })

  it('a full match: every ACTUAL task-lifecycle transition is guardTransition-legal (SPEC-R4 AC1)', () => {
    // beginMatch's own transitions (submitted -> working -> input-required) are asserted directly here —
    // they are the two edges `advance()` applies before the traced loop below even starts.
    expect(guardTransition('submitted', 'working')).toEqual([])
    expect(guardTransition('working', 'input-required')).toEqual([])
    let state = beginMatch(createRefereeState()).state
    const sequence: RefereeInput[] = [move('X', 0), move('O', 1), move('X', 3), move('O', 2), move('X', 6)] // X wins column 0,3,6
    const trace: { seat: Mark; from: string; to: string }[] = []
    for (const input of sequence) {
      const result = tracedReduce(state, input, trace)
      state = result.state
    }
    expect(state.end).toEqual({ kind: 'win', winner: 'X' })
    for (const t of trace) {
      expect(guardTransition(t.from as never, t.to as never)).toEqual([])
    }
    expect(trace.length).toBeGreaterThan(0)
  })

  it('reduce throws if called after the game already ended (programming-error trip-wire)', () => {
    const s = beginMatch(createRefereeState(1)).state
    const r = reduce(s, { kind: 'abort', seat: 'X', cause: 'aborted', detail: 'x' })
    expect(() => reduce(r.state, move('O', 0))).toThrow(/already ended/)
  })

  it('reduce throws if the input names a seat whose turn it is not', () => {
    const s = beginMatch(createRefereeState()).state
    expect(() => reduce(s, move('O', 0))).toThrow(/it is X's turn/)
  })
})
