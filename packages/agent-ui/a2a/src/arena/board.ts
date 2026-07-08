// board.ts — LLD-C1: the tic-tac-toe rules table (SPEC-R9). Pure, zero-dep: 9-cell board, the 8 win
// lines, legality, win/draw detection. No task lifecycle, no I/O, no randomness — the referee (LLD-C2)
// is the only consumer that adds turn-taking and the task-state machine on top of this.

export type Mark = 'X' | 'O'
export type Cell = Mark | null
/** Always length 9, row-major (0,1,2 / 3,4,5 / 6,7,8). */
export type Board = Cell[]

export const BOARD_SIZE = 9

/** The 8 win lines: 3 rows, 3 columns, 2 diagonals. */
export const WIN_LINES: readonly (readonly [number, number, number])[] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
]

export function createBoard(): Board {
  return Array.from({ length: BOARD_SIZE }, () => null)
}

/** Every open cell index, in ascending order. */
export function legalMoves(board: Board): number[] {
  const out: number[] = []
  for (let i = 0; i < board.length; i++) if (board[i] === null) out.push(i)
  return out
}

/** Two illegal classes, both caught here: out-of-range and occupied (LLD §7). */
export function isLegalMove(board: Board, index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < BOARD_SIZE && board[index] === null
}

/** Pure — returns a NEW board; never mutates the input. */
export function applyMove(board: Board, index: number, mark: Mark): Board {
  const next = board.slice()
  next[index] = mark
  return next
}

/** The winning mark, or `null` if no line is complete. */
export function checkWinner(board: Board): Mark | null {
  for (const [a, b, c] of WIN_LINES) {
    const v = board[a]
    if (v !== null && v === board[b] && v === board[c]) return v
  }
  return null
}

export function isFull(board: Board): boolean {
  return board.every((c) => c !== null)
}

export type BoardOutcome = { kind: 'win'; mark: Mark } | { kind: 'draw' } | { kind: 'ongoing' }

/**
 * Win is checked BEFORE draw (LLD §7 "Draw / simultaneous-looking end"): a completing move that fills
 * the last cell AND closes a line is a win, never a draw.
 */
export function boardOutcome(board: Board): BoardOutcome {
  const winner = checkWinner(board)
  if (winner !== null) return { kind: 'win', mark: winner }
  if (isFull(board)) return { kind: 'draw' }
  return { kind: 'ongoing' }
}
