// hidden-state-checks.ts: the hidden game state checks (T-0230), run on every catalog.
//
// A turn's reasoning is not carried to the next turn; only the session lines and the data models are. So a game
// with a hidden answer commits it in the game surface's own data model under the reserved key `/secret`, bound to
// no component (the T-0218 face-down hole-card precedent): the word game at `/secret/word`, Battleship at
// `/secret/fleet` (the ships the player fires on) and `/secret/playerFleet` (the player's ships), each a list of
// 0-based `{row, col}` cells in the board's own coordinates. These checks read that field and judge every mark
// against it, so a guess or a shot is resolved against one fixed answer instead of the model's memory.
//
// The Lexicographer and the Admiral turn on plain `agent-ui`, where no persona or domain check resolves, so the
// hosts add these to every catalog (`semanticChecksDeps`, and `replaySemanticChecks` for the probe replay). Each
// check is silent unless a surface carries its game's signature:
// - the word game: a TextField gated by a `^[a-z]{N}$` regex check (the `word-tiles` idiom) that names a guess, or
//   sits beside a BoardGrid;
// - Battleship: a BoardGrid with an `actionName` (the board the player fires on, the `board-grid` idiom).
// Both games ride base `agent-ui` and both draw a clickable BoardGrid, so each check also skips the other game's
// surface (T-0263): a word cue (that TextField, or `/secret/word`) with no committed fleet is never judged for a fleet,
// and a committed fleet with no word cue is never judged for a word.
// DOM-less and node-free, like `semantic-check.ts`: both server hosts import it.

import type { A2uiComponent } from '../protocol.ts'
import { readPointer } from './semantic-check.ts'
import type { SemanticAction, SemanticCheck, SemanticFinding, SurfaceView } from './semantic-check.ts'

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

interface Cell {
  row: number
  col: number
  mark?: string
  intent?: string
}

const boardGrids = (view: SurfaceView): A2uiComponent[] => [...view.components.values()].filter((c) => c.component === 'BoardGrid')

/** A BoardGrid's cells: the literal list, or the list its `{path}` binding reads off the data model. */
function cellsOf(board: A2uiComponent, dataModel: unknown): Cell[] {
  const raw = board['cells']
  const list = Array.isArray(raw) ? raw : isRecord(raw) && typeof raw['path'] === 'string' ? readPointer(dataModel, raw['path']) : undefined
  if (!Array.isArray(list)) return []
  return list.filter((c): c is Cell => isRecord(c) && Number.isInteger(c['row']) && Number.isInteger(c['col']))
}

/** The once-per-game reset: a Play again click carries `newGame: true` in its context (the End-state idiom). */
const isNewGame = (action: SemanticAction | undefined): boolean => action?.context['newGame'] === true

// ── the word game ────────────────────────────────────────────────────────────────────────────────────────────

const WORD_REGEX = /^\^\[a-z\]\{(\d+)\}\$$/
const GRADES = new Set(['success', 'warning', 'neutral'])

/** The word length a word-game surface asks for, or undefined when the surface is not one. */
function wordLength(view: SurfaceView): number | undefined {
  const hasBoard = boardGrids(view).length > 0
  for (const c of view.components.values()) {
    if (c.component !== 'TextField' || !Array.isArray(c['checks'])) continue
    const value = c['value']
    const names = [c['name'], isRecord(value) ? value['path'] : undefined].filter((x): x is string => typeof x === 'string')
    if (!hasBoard && !names.some((n) => /guess/i.test(n))) continue
    for (const check of c['checks'] as unknown[]) {
      const args = isRecord(check) && check['call'] === 'regex' && isRecord(check['args']) ? check['args'] : undefined
      const m = typeof args?.['pattern'] === 'string' ? WORD_REGEX.exec(args['pattern']) : null
      if (m) return Number(m[1])
    }
  }
  return undefined
}

/** T-0263: the game cues a surface carries, so one game's check never judges the other's board. */
const hasWordCue = (view: SurfaceView): boolean => wordLength(view) !== undefined || typeof readPointer(view.dataModel, '/secret/word') === 'string'
const hasFleetCue = (view: SurfaceView): boolean =>
  readPointer(view.dataModel, '/secret/fleet') !== undefined || readPointer(view.dataModel, '/secret/playerFleet') !== undefined

/** The committed word, lowercased, when it is `n` letters; undefined otherwise. */
function committedWord(dataModel: unknown, n: number): string | undefined {
  const word = readPointer(dataModel, '/secret/word')
  return typeof word === 'string' && new RegExp(`^[a-z]{${n}}$`, 'i').test(word) ? word.toLowerCase() : undefined
}

/** Wordle grading: exact matches first, then each remaining guess letter takes a `warning` while the secret still
 *  holds an unmatched copy of it, left to right; the rest are `neutral`. */
export function gradeGuess(guess: string, secret: string): string[] {
  const grades: string[] = [...guess].map((ch, i) => (secret[i] === ch ? 'success' : 'neutral'))
  const left = new Map<string, number>()
  for (let i = 0; i < secret.length; i++) if (grades[i] !== 'success') left.set(secret[i]!, (left.get(secret[i]!) ?? 0) + 1)
  for (let i = 0; i < guess.length; i++) {
    const n = grades[i] === 'success' ? 0 : (left.get(guess[i]!) ?? 0)
    if (n > 0) {
      grades[i] = 'warning'
      left.set(guess[i]!, n - 1)
    }
  }
  return grades
}

/** Each fully graded row of a word board (one letter and one grade per column 0..n-1), by row index. */
function gradedRows(cells: readonly Cell[], n: number): Map<number, { guess: string; grades: string[] }> {
  const byRow = new Map<number, Cell[]>()
  for (const c of cells) byRow.set(c.row, [...(byRow.get(c.row) ?? []), c])
  const out = new Map<number, { guess: string; grades: string[] }>()
  for (const [row, list] of byRow) {
    const cols = [...Array(n).keys()].map((col) => list.find((c) => c.col === col))
    if (cols.some((c) => c === undefined || typeof c.mark !== 'string' || !/^[a-z]$/i.test(c.mark.trim()) || !GRADES.has(c.intent ?? ''))) continue
    out.set(row, { guess: cols.map((c) => c!.mark!.trim().toLowerCase()).join(''), grades: cols.map((c) => c!.intent!) })
  }
  return out
}

const sameRow = (a: { guess: string; grades: string[] }, b: { guess: string; grades: string[] }): boolean =>
  a.guess === b.guess && a.grades.join() === b.grades.join()

/**
 * WORD_SECRET_MISSING: a word-game surface whose data model commits no `/secret/word` of the asked length, on the
 * opening turn or any later one. WORD_MARK_WRONG: a graded row of its BoardGrid whose grades disagree with the
 * committed word. WORD_SECRET_CHANGED: the committed word differs from the one the session left while a row graded
 * before this round is still on the board (the same game); a Play again click or a reset board starts a new one.
 */
export const wordSecretCheck: SemanticCheck = {
  id: 'word-secret',
  requires: ['TextField'],
  check({ surfaces, action }) {
    const findings: SemanticFinding[] = []
    for (const view of surfaces) {
      const n = wordLength(view)
      if (n === undefined || (hasFleetCue(view) && typeof readPointer(view.dataModel, '/secret/word') !== 'string')) continue
      const secret = committedWord(view.dataModel, n)
      if (secret === undefined) {
        findings.push({
          code: 'WORD_SECRET_MISSING',
          path: `${view.surfaceId}:/secret/word`,
          message: `Surface "${view.surfaceId}" is a ${n}-letter word game but its data model commits no secret word: write the answer once, ${n} lowercase letters, at /secret/word in this surface's data model (bound to no component), and mark every guess against it.`,
        })
        continue
      }
      for (const board of boardGrids(view)) {
        for (const [row, { guess, grades }] of gradedRows(cellsOf(board, view.dataModel), n)) {
          const want = gradeGuess(guess, secret)
          if (want.join() === grades.join()) continue
          findings.push({
            code: 'WORD_MARK_WRONG',
            path: `${view.surfaceId}:${board.id}`,
            message: `Row ${row} of BoardGrid "${board.id}" marks ${guess.toUpperCase()} as ${grades.join(', ')}, but against the committed word at /secret/word it grades as ${want.join(', ')}: re-mark that row and keep /secret/word unchanged.`,
          })
        }
      }
      const before = committedWord(view.priorDataModel, n)
      if (before === undefined || before === secret || isNewGame(action)) continue
      const kept = boardGrids(view).some((board) => {
        const prior = gradedRows(cellsOf(board, view.priorDataModel), n)
        const now = gradedRows(cellsOf(board, view.dataModel), n)
        return [...prior].some(([row, r]) => now.has(row) && sameRow(now.get(row)!, r))
      })
      if (kept) {
        findings.push({
          code: 'WORD_SECRET_CHANGED',
          path: `${view.surfaceId}:/secret/word`,
          message: `The secret word at /secret/word changed mid-game on surface "${view.surfaceId}": restore the word committed at the start of this game and mark the guess against it.`,
        })
      }
    }
    return findings
  },
}

// ── Battleship ───────────────────────────────────────────────────────────────────────────────────────────────

const HIT = '●'
const MISS = '✕'

/** A committed fleet as a set of `row,col` keys, or undefined when the field is not a non-empty cell list. */
function committedFleet(dataModel: unknown, key: 'fleet' | 'playerFleet'): Set<string> | undefined {
  const list = readPointer(dataModel, `/secret/${key}`)
  if (!Array.isArray(list) || list.length === 0) return undefined
  if (!list.every((c) => isRecord(c) && Number.isInteger(c['row']) && Number.isInteger(c['col']))) return undefined
  return new Set(list.map((c) => `${(c as Cell).row},${(c as Cell).col}`))
}

const sameSet = (a: Set<string>, b: Set<string>): boolean => a.size === b.size && [...a].every((k) => b.has(k))

/** The cells of `board` whose ● or ✕ disagrees with `fleet`. */
function wrongShots(cells: readonly Cell[], fleet: Set<string>): Cell[] {
  return cells.filter((c) => {
    const mark = c.mark?.trim()
    const ship = fleet.has(`${c.row},${c.col}`)
    return (mark === HIT && !ship) || (mark === MISS && ship)
  })
}

const resolved = (cells: readonly Cell[]): Set<string> =>
  new Set(cells.filter((c) => c.mark?.trim() === HIT || c.mark?.trim() === MISS).map((c) => `${c.row},${c.col}:${c.mark!.trim()}`))

const listCells = (cells: readonly Cell[]): string => cells.map((c) => `(${c.row}, ${c.col}) ${c.mark!.trim() === HIT ? 'hit' : 'miss'}`).join(', ')

/**
 * FLEET_SECRET_MISSING: a surface with a clickable BoardGrid (the board the player fires on) whose data model
 * commits no `/secret/fleet` or `/secret/playerFleet`. SHOT_RESULT_WRONG: a ● on that board where the committed
 * fleet has no ship, or a ✕ where it has one. RETURN_FIRE_WRONG: the same on a read-only BoardGrid (the player's
 * board) of any surface this round touches, against `/secret/playerFleet`. FLEET_SECRET_CHANGED: a committed fleet
 * differs from the one the session left while a shot resolved before this round is still on the board.
 */
export const fleetSecretCheck: SemanticCheck = {
  id: 'fleet-secret',
  requires: ['BoardGrid'],
  check({ surfaces, action }) {
    const findings: SemanticFinding[] = []
    const targets = surfaces.filter(
      (v) => boardGrids(v).some((b) => typeof b['actionName'] === 'string' && b['actionName'] !== '') && !(hasWordCue(v) && !hasFleetCue(v)),
    )
    let playerFleet: Set<string> | undefined
    for (const view of targets) {
      const fleet = committedFleet(view.dataModel, 'fleet')
      const theirs = committedFleet(view.dataModel, 'playerFleet')
      playerFleet ??= theirs
      for (const [key, set] of [['fleet', fleet], ['playerFleet', theirs]] as const) {
        if (set !== undefined) continue
        findings.push({
          code: 'FLEET_SECRET_MISSING',
          path: `${view.surfaceId}:/secret/${key}`,
          message: `Surface "${view.surfaceId}" is a Battleship board but its data model commits no ${key === 'fleet' ? 'fleet of yours' : 'player fleet'}: at game start place both fleets and write them once at /secret/fleet (your ships) and /secret/playerFleet (the player's ships) in this surface's data model, each a list of 0-based {row, col} cells, bound to no component; resolve every shot against them.`,
        })
      }
      const boards = boardGrids(view).filter((b) => typeof b['actionName'] === 'string' && b['actionName'] !== '')
      if (fleet !== undefined) {
        for (const board of boards) {
          const wrong = wrongShots(cellsOf(board, view.dataModel), fleet)
          if (wrong.length === 0) continue
          findings.push({
            code: 'SHOT_RESULT_WRONG',
            path: `${view.surfaceId}:${board.id}`,
            message: `BoardGrid "${board.id}" marks ${listCells(wrong)}, which disagrees with the fleet committed at /secret/fleet: mark ● only where a ship sits and ✕ only where none does, and keep /secret/fleet unchanged.`,
          })
        }
      }
      if (isNewGame(action)) continue
      for (const [key, now] of [['fleet', fleet], ['playerFleet', theirs]] as const) {
        const before = committedFleet(view.priorDataModel, key)
        if (now === undefined || before === undefined || sameSet(before, now)) continue
        const kept = boards.some((board) => {
          const prior = resolved(cellsOf(board, view.priorDataModel))
          const current = resolved(cellsOf(board, view.dataModel))
          return [...prior].some((k) => current.has(k))
        })
        if (!kept) continue
        findings.push({
          code: 'FLEET_SECRET_CHANGED',
          path: `${view.surfaceId}:/secret/${key}`,
          message: `The fleet at /secret/${key} changed mid-game on surface "${view.surfaceId}": restore the placement committed at the start of this game and resolve the shot against it.`,
        })
      }
    }
    if (playerFleet === undefined) return findings
    for (const view of surfaces) {
      for (const board of boardGrids(view).filter((b) => typeof b['actionName'] !== 'string' || b['actionName'] === '')) {
        const wrong = wrongShots(cellsOf(board, view.dataModel), playerFleet)
        if (wrong.length === 0) continue
        findings.push({
          code: 'RETURN_FIRE_WRONG',
          path: `${view.surfaceId}:${board.id}`,
          message: `BoardGrid "${board.id}" (the player's board) marks ${listCells(wrong)}, which disagrees with the player's fleet committed at /secret/playerFleet: resolve your return fire against that placement.`,
        })
      }
    }
    return findings
  },
}

/** Every hidden-state check, in the order the hosts run them. */
export const HIDDEN_STATE_CHECKS: readonly SemanticCheck[] = [wordSecretCheck, fleetSecretCheck]
