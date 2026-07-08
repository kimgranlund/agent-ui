// board.test.ts — LLD-C1 checkpoint: all 8 win lines, draw, both illegal classes, win-before-draw.
import { describe, expect, it } from 'vitest'
import {
  applyMove,
  boardOutcome,
  BOARD_SIZE,
  checkWinner,
  createBoard,
  isFull,
  isLegalMove,
  legalMoves,
  WIN_LINES,
} from './board.ts'
import type { Board } from './board.ts'

function boardFrom(cells: (0 | 1 | null)[]): Board {
  // 0 = X, 1 = O, null = empty — a terse fixture DSL for the 8-line sweep below.
  return cells.map((c) => (c === 0 ? 'X' : c === 1 ? 'O' : null))
}

describe('board (LLD-C1)', () => {
  it('createBoard is 9 empty cells', () => {
    const b = createBoard()
    expect(b).toHaveLength(BOARD_SIZE)
    expect(b.every((c) => c === null)).toBe(true)
  })

  it('WIN_LINES has exactly 8 lines (3 rows, 3 cols, 2 diagonals)', () => {
    expect(WIN_LINES).toHaveLength(8)
  })

  it.each(WIN_LINES.map((line, i) => [i, line] as const))('win line %i (%j) is detected for both marks', (_i, line) => {
    for (const mark of ['X', 'O'] as const) {
      let b = createBoard()
      for (const idx of line) b = applyMove(b, idx, mark)
      expect(checkWinner(b)).toBe(mark)
      expect(boardOutcome(b)).toEqual({ kind: 'win', mark })
    }
  })

  it('a non-winning full board is a draw', () => {
    // X O X / X O O / O X X — no line complete, board full
    const b = boardFrom([0, 1, 0, 0, 1, 1, 1, 0, 0])
    expect(checkWinner(b)).toBeNull()
    expect(isFull(b)).toBe(true)
    expect(boardOutcome(b)).toEqual({ kind: 'draw' })
  })

  it('an ongoing (non-full, no winner) board reports "ongoing"', () => {
    const b = boardFrom([0, null, null, null, null, null, null, null, null])
    expect(boardOutcome(b)).toEqual({ kind: 'ongoing' })
  })

  it('win is checked BEFORE draw: a completing move on a full board is a WIN, never a draw', () => {
    // X X _ / O O X / X O O  -> filling cell 2 with X completes the top row AND fills the board
    const b = boardFrom([0, 0, null, 1, 1, 0, 0, 1, 1])
    const completed = applyMove(b, 2, 'X')
    expect(isFull(completed)).toBe(true)
    expect(checkWinner(completed)).toBe('X')
    expect(boardOutcome(completed)).toEqual({ kind: 'win', mark: 'X' })
  })

  it('isLegalMove: in-range + empty is legal', () => {
    const b = createBoard()
    expect(isLegalMove(b, 0)).toBe(true)
    expect(isLegalMove(b, 8)).toBe(true)
  })

  it('isLegalMove: out-of-range is illegal (both directions + non-integer)', () => {
    const b = createBoard()
    expect(isLegalMove(b, -1)).toBe(false)
    expect(isLegalMove(b, 9)).toBe(false)
    expect(isLegalMove(b, 1.5)).toBe(false)
  })

  it('isLegalMove: an occupied cell is illegal', () => {
    const b = applyMove(createBoard(), 4, 'X')
    expect(isLegalMove(b, 4)).toBe(false)
  })

  it('legalMoves lists every open cell in ascending order', () => {
    const b = applyMove(applyMove(createBoard(), 0, 'X'), 8, 'O')
    expect(legalMoves(b)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('applyMove is pure — never mutates the input board', () => {
    const b = createBoard()
    const next = applyMove(b, 0, 'X')
    expect(b[0]).toBeNull()
    expect(next[0]).toBe('X')
    expect(b).not.toBe(next)
  })
})
