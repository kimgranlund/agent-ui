// board-grid-model.ts: the pure, DOM-free cell hardening for ui-board-grid (ADR-0243, the BoardGrid fork
// sheet). No DOM, no host, unit-testable in plain Node/Vitest (the source-list-model.ts in-folder pure-core
// split, ADR-0111 cl.8). Owns:
//
//   1. `cleanCells`: the drop-malformed-entries cleaner (the cleanSources/cleanSuggestions idiom). A
//      non-array input is `[]`; an entry survives only as a plain object whose `row` and `col` are
//      non-negative integers. Everything else is HARDENED, not a second reason to drop it: a non-string
//      `mark` degrades to `''`, an out-of-set `intent` is dropped as a field (the cell renders with no
//      intent), and `disabled` is true only for a real `true`.
//   2. `placeCells`: the board-shape pass. A cell outside `rows` x `cols` is dropped, and when two entries
//      share one position the LATER entry wins.
//   3. `boardDim`, the rows/cols guard (non-finite or negative is 0, a fraction floors), `INTENT_GLYPH`
//      (the corner glyph per intent) and `cellLabel` (the accessible name: mark, intent, row n, column m).
//   4. `cellsProp`, the safe JSON codec (the `sourcesProp` shape verbatim): `from(null)` is `[]`, malformed
//      attribute JSON also falls back to `[]`, never throws; every parse runs through `cleanCells`.

import type { PropConfig, PropType } from '../../dom/props.ts'

/** The fleet intent set (`controls/badge/badge.props.gen.ts`), the same set ADR-0243 gives ProductCard. */
export const BOARD_INTENTS = ['neutral', 'info', 'success', 'warning', 'danger'] as const
export type BoardIntent = (typeof BOARD_INTENTS)[number]

/** One board cell: 0-based `row`/`col`, the `mark` text, an optional `intent`, and `disabled`. */
export interface BoardCell {
  row: number
  col: number
  mark: string
  intent?: BoardIntent
  disabled: boolean
}

/** The corner glyph per intent (ADR-0243 mockup legend): the non-color signifier, never color alone. */
export const INTENT_GLYPH: Readonly<Record<BoardIntent, string>> = {
  success: '+',
  warning: '?',
  neutral: '-',
  danger: '!',
  info: 'i',
}

const isPlainObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isIndex = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0
const isIntent = (v: unknown): v is BoardIntent => typeof v === 'string' && (BOARD_INTENTS as readonly string[]).includes(v)

/** Harden an arbitrary input into board cells. Order is preserved, so `placeCells` can let the later win. */
export function cleanCells(input: unknown): BoardCell[] {
  if (!Array.isArray(input)) return []
  const out: BoardCell[] = []
  for (const entry of input) {
    if (!isPlainObject(entry)) continue
    if (!isIndex(entry.row) || !isIndex(entry.col)) continue
    const cell: BoardCell = {
      row: entry.row,
      col: entry.col,
      mark: typeof entry.mark === 'string' ? entry.mark : '',
      disabled: entry.disabled === true,
    }
    if (isIntent(entry.intent)) cell.intent = entry.intent
    out.push(cell)
  }
  return out
}

/** A rows/cols value as a usable board dimension: a non-finite or negative number is 0, a fraction floors. */
export function boardDim(n: number | null | undefined): number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

/** Key the cells by row-major index `row * cols + col`, dropping any outside `rows` x `cols`; later wins. */
export function placeCells(cells: readonly BoardCell[], rows: number, cols: number): Map<number, BoardCell> {
  const out = new Map<number, BoardCell>()
  for (const cell of cells) {
    if (cell.row >= rows || cell.col >= cols) continue
    out.set(cell.row * cols + cell.col, cell)
  }
  return out
}

/** The cell's accessible name: the non-empty parts of mark, intent word, `row n`, `column m` (1-based). */
export function cellLabel(cell: BoardCell | undefined, row: number, col: number): string {
  const parts = [cell?.mark.trim() ?? '', cell?.intent ?? '', `row ${row + 1}`, `column ${col + 1}`]
  return parts.filter((p) => p !== '').join(', ')
}

const cellsType: PropType<BoardCell[]> = {
  from(attr) {
    if (attr === null) return []
    try {
      return cleanCells(JSON.parse(attr))
    } catch {
      return []
    }
  },
  to(value) {
    return JSON.stringify(value)
  },
}

export const cellsProp: PropConfig<BoardCell[]> = {
  type: cellsType,
  default: [],
}
