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
// - Battleship: a BoardGrid with an `actionName` (the board the player fires on, the `board-grid` idiom) that also
//   reads as Battleship (a committed fleet, a Battleship cue word, or the player's own read-only board; T-0316).
// T-0265 adds one more Battleship check that reads the say turn's words rather than a surface: a typed shot at the
// targeted board answered in prose alone, or a game asked for with no board. T-0280 adds its word-game twin: a typed
// guess or a give-up at the targeted board answered in prose alone, or a give-up with no ResultCard; T-0291 judges one
// typed with no target against the open word game, and a Play again answered in prose; T-0322, a word game asked for
// with no board. T-0284: a
// Battleship board opened with no GameHud. T-0296: a Battleship surrender answered with no ResultCard. T-0366: a move
// typed at an open board-less game (the Negotiator's deal sheet, the Dungeon Master's quest log) answered in prose alone.
// Both games ride base `agent-ui` and both draw a clickable BoardGrid, so each check also skips the other game's
// surface (T-0263): a word cue (that TextField, or `/secret/word`) with no committed fleet is never judged for a fleet,
// and a committed fleet with no word cue is never judged for a word.
// DOM-less and node-free, like `semantic-check.ts`: both server hosts import it.

import type { A2uiComponent } from '../protocol.ts'
import { GAME_WORDS } from './composite-moments.ts'
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

/** T-0316 (D1): the Battleship words a recorded Admiral board carries in its id, labels, stats or bound paths ("Enemy
 *  waters", "Ships afloat", `/fleet`). A clickable BoardGrid alone is any board game (tic-tac-toe, the plainest). */
const FLEET_WORDS = /\b(?:battleships?|fleets?|ships?|waters|seas?|navy|naval|admiral|salvo|torpedo(?:es)?|sunk|afloat)\b/i

/** T-0316 (D1): a surface that reads as Battleship: a fleet cue, a Battleship word on the surface, or a read-only
 *  BoardGrid (the player's own board) beside the one the player fires on. */
const hasBattleshipCue = (view: SurfaceView): boolean =>
  hasFleetCue(view) ||
  FLEET_WORDS.test(`${view.surfaceId} ${JSON.stringify([...view.components.values()])}`) ||
  boardGrids(view).some((b) => typeof b['actionName'] !== 'string' || b['actionName'] === '')

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
 * FLEET_SECRET_MISSING: a surface with a clickable BoardGrid (the board the player fires on) and a Battleship cue
 * (`hasBattleshipCue`, T-0316) whose data model commits no `/secret/fleet` or `/secret/playerFleet`. SHOT_RESULT_WRONG: a ● on that board where the committed
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
      (v) =>
        boardGrids(v).some((b) => typeof b['actionName'] === 'string' && b['actionName'] !== '') && hasBattleshipCue(v) && !(hasWordCue(v) && !hasFleetCue(v)),
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

/** T-0265: a shot the player types ("Fire at A2.", "B7"), its coordinate as the capture. */
const TYPED_SHOT = /\b(?:fire|shoot|strike|attack|bomb|target)\b[^.?!]*?\b([a-j]\s?(?:10|[1-9]))\b|^\s*([a-j]\s?(?:10|[1-9]))[.!]?\s*$/i

/**
 * T-0265 (the recorded Haiku 5.5 Admiral, round 3 opening-salvo t4 and row-sweep t2): "Fire at A2." was answered
 * with a meta-line targeting enemy-waters and the shot resolved in prose, so the board kept its old marks.
 * ACTION_NOT_APPLIED: a say turn that types a shot and declares an open surface its target sends that surface no
 * update and opens no new board. SURFACE_MISSING: a say turn that asks for a game of Battleship, not a question about
 * it, answered with no surface at all.
 */
export const fleetShotAppliedCheck: SemanticCheck = {
  id: 'fleet-shot-applied',
  requires: ['BoardGrid'],
  check({ surfaces, action, intent, target }) {
    if (action !== undefined || intent === undefined) return []
    if (target === undefined) {
      if (surfaces.length > 0 || !/\bbattleships?\b/i.test(intent) || /\?\s*$/.test(intent.trim())) return []
      return [
        {
          code: 'SURFACE_MISSING',
          path: 'opening:battleship',
          message:
            'The player asked for a game of Battleship and this turn opens no board, so the game exists only in prose. ' +
            'Call render_surface with a createSurface for the board the player fires on (a BoardGrid with an actionName) and commit both fleets at /secret, not only prose.',
        },
      ]
    }
    const m = TYPED_SHOT.exec(intent)
    const cell = (m?.[1] ?? m?.[2])?.replace(/\s/g, '').toUpperCase()
    if (cell === undefined) return []
    // An update to the target, or a new board the player fires on (a fresh game), applies the shot.
    const firingBoard = (v: SurfaceView): boolean => boardGrids(v).some((b) => typeof b['actionName'] === 'string' && b['actionName'] !== '')
    if (surfaces.some((v) => v.surfaceId === target || (v.priorDataModel === undefined && firingBoard(v)))) return []
    return [
      {
        code: 'ACTION_NOT_APPLIED',
        path: `${target}:${cell}`,
        message:
          `The player fired at ${cell} on ${target}, and this turn sends it no update, so the board still shows the old marks. ` +
          `Call render_surface with an updateDataModel for ${target}: the shot's mark on the board, your return fire on the player's board and the status, not only prose.`,
      },
    ]
  },
}

/** T-0280: a guess the player types ("My guess: audio.", "Guess crane"), the word as the capture. */
const TYPED_GUESS = /\bguess\b(?:\s+is)?\s*[:,-]?\s*["'“‘]?([a-z]{2,12})\b/i
/** T-0280: the player gives the word game up ("I give up.", "What was the word?"). */
const GIVE_UP = /\b(?:give up|gave up|i quit|i resign|what was the word|what's the word|tell me the word|reveal the word)\b/i
/** T-0291: the player asks for a fresh game after one ended ("Play again.", "New game", "Another word"; T-0322: "New
 *  word game"). */
const PLAY_AGAIN = /\b(?:play again|new (?:word )?game|another (?:game|round|word|one)|rematch|start over|go again)\b/i
/** T-0322: the player asks for a word game by name ("New word game, please.", "Let's play Wordle."). */
const WORD_GAME = /\b(?:word game|word puzzle|wordle|guess the word|\d+-letter word)\b/i

/**
 * T-0280 (the recorded Haiku 5.5 Lexicographer, round 4 :86-:89): "My guess: audio." and "I give up." were answered
 * with a meta-line targeting word-forge and the grades and the answer in prose, so the board never moved and no
 * ResultCard shipped. ACTION_NOT_APPLIED: a say turn that types a guess, or gives up, and declares an open surface its
 * target sends that surface no update and opens no new surface. RESULT_CARD_MISSING: a give-up answered with
 * surfaces but no ResultCard on any of them (the hand-built Card of round 4 :122).
 * T-0291 (round 5 :94, :95, :72): a give-up with no target declared (Haiku read the give-up as a flow end owed no UI),
 * and "Play again." answered in prose. A give-up or a replay ask typed with no target is judged against the last open
 * word-game surface (the T-0286 croupier precedent), and a replay ask that sends the game surface no update and opens
 * no new one is ACTION_NOT_APPLIED too.
 * T-0322 (round 8 :101): "New word game, please." with no word game open was answered in prose with no surface.
 * SURFACE_MISSING: a say turn that asks for a word game, not a question about one, with no game open, no target and
 * no surface (the Battleship opening's twin).
 */
export const wordMoveAppliedCheck: SemanticCheck = {
  id: 'word-move-applied',
  requires: ['BoardGrid', 'ResultCard'],
  check({ surfaces, action, intent, target, open }) {
    if (action !== undefined || intent === undefined) return []
    const game = target ?? (open ?? []).filter((v) => hasWordCue(v) && !hasFleetCue(v)).at(-1)?.surfaceId
    if (game === undefined) {
      if (surfaces.length > 0 || target !== undefined || !WORD_GAME.test(intent) || /\?\s*$/.test(intent.trim())) return []
      return [
        {
          code: 'SURFACE_MISSING',
          path: 'opening:word-game',
          message:
            'The word-game check found that the player asked for a word game and this turn opens no board, so the game exists only in prose. ' +
            'Call render_surface with a createSurface for the word board (a BoardGrid of guesses, the guess field) and commit the secret word at /secret/word, not only prose.',
        },
      ]
    }
    if (isFleetGame(game, surfaces, open)) return []
    const touched = surfaces.some((v) => v.surfaceId === game || v.priorDataModel === undefined)
    if (GIVE_UP.test(intent)) {
      if (surfaces.some((v) => [...v.components.values()].some((c) => c.component === 'ResultCard'))) return []
      return [
        touched
          ? {
              code: 'RESULT_CARD_MISSING',
              path: `${game}:give-up`,
              message:
                `The word-game check found that the player gave up the game on ${game} and this turn shows the outcome without a ResultCard. ` +
                'Make it ONE ResultCard with its outcome, title, the answer in the summary, stats and a Play again action, and drop the hand-built result.',
            }
          : {
              code: 'ACTION_NOT_APPLIED',
              path: `${game}:give-up`,
              message:
                `The word-game check found that the player gave up the game on ${game} and this turn sends it no update, so the answer exists only in prose. ` +
                'A give-up ends the game, not an ask flow: its closing turn still shows the result on the board. ' +
                `Call render_surface with an updateComponents for ${game} that shows ONE ResultCard (outcome, title, the answer in the summary, stats, a Play again action), not only prose.`,
            },
      ]
    }
    if (PLAY_AGAIN.test(intent)) {
      if (touched) return []
      return [
        {
          code: 'ACTION_NOT_APPLIED',
          path: `${game}:play-again`,
          message:
            `The word-game check found that the player asked to play again and this turn sends ${game} no update, so the new game exists only in prose. ` +
            `Call render_surface with an updateComponents and an updateDataModel for ${game}: a new secret word at /secret/word, an empty board, six guesses left and the cleared guess field, not only prose.`,
        },
      ]
    }
    // A guess stays judged only at a declared target: one typed with none (a 3-letter "cat") may rightly stay prose.
    const guess = TYPED_GUESS.exec(intent)?.[1]?.toLowerCase()
    if (guess === undefined || target === undefined || touched) return []
    return [
      {
        code: 'ACTION_NOT_APPLIED',
        path: `${game}:${guess}`,
        message:
          `The word-game check found that the player guessed "${guess}" on ${game} and this turn sends it no update, so the board still shows the old rows. ` +
          `Call render_surface with an updateDataModel for ${game}: the guess's graded row on the board (or, for a guess that is not a valid word, the status saying so), the guesses left and the cleared field, not only prose.`,
      },
    ]
  },
}

/**
 * T-0284 (the recorded Haiku 5.5 Admiral, round 4 row-sweep t0): "Battleship, please." opened a Column with a Text
 * title, the BoardGrid and a Text bound to /hud/status, so the GameHud composite row (which reads literal words)
 * stayed silent. GAME_HUD_MISSING: a Battleship board opened this round (a clickable BoardGrid on a surface that
 * commits a fleet) with no GameHud on its surface.
 */
export const fleetHudCheck: SemanticCheck = {
  id: 'fleet-hud',
  requires: ['BoardGrid', 'GameHud'],
  check({ surfaces }) {
    const findings: SemanticFinding[] = []
    for (const view of surfaces) {
      if (view.priorDataModel !== undefined || !hasFleetCue(view)) continue
      const types = new Set([...view.components.values()].map((c) => c.component))
      if (types.has('GameHud')) continue
      const board = boardGrids(view).find((b) => typeof b['actionName'] === 'string' && b['actionName'] !== '')
      if (board === undefined) continue
      findings.push({
        code: 'GAME_HUD_MISSING',
        path: `${view.surfaceId}:${board.id}`,
        message:
          `${view.surfaceId} opens a Battleship board with no GameHud, so the game's status and score have no strip. ` +
          `Add ONE GameHud beside BoardGrid "${board.id}" with its title, status and stats (shots fired, ships left) bound to the data model, and drop the hand-built title and status text.`,
      })
    }
    return findings
  },
}

/** T-0296: the player concedes a Battleship game ("I surrender. Reveal your fleet.", "I concede", "I give up"). */
const CONCEDE = /\b(?:surrender(?:s|ed)?|concede[sd]?|forfeit|i resign|give up|gave up|i quit)\b/i

/**
 * T-0296 (live round 6, :112, :298 and :484, all three models): "I surrender. Reveal your fleet." targeting
 * enemy-waters revealed the fleet on the board and shipped no ResultCard, so the game never ended. Kim's ruling
 * (2026-10-16): a surrender ends like a normal game end, ONE ResultCard beside the revealed board.
 * RESULT_CARD_MISSING: a concession at a Battleship surface (the target, or with none the last open fleet game)
 * answered with surfaces but no ResultCard on any of them; ACTION_NOT_APPLIED: one answered in prose alone.
 */
export const fleetConcedeCheck: SemanticCheck = {
  id: 'fleet-concede',
  requires: ['BoardGrid', 'ResultCard'],
  check({ surfaces, action, intent, target, open }) {
    if (action !== undefined || intent === undefined || !CONCEDE.test(intent)) return []
    const game = target ?? (open ?? []).filter((v) => hasFleetCue(v) && !hasWordCue(v)).at(-1)?.surfaceId
    if (game === undefined || !isFleetGame(game, surfaces, open)) return []
    if (surfaces.some((v) => [...v.components.values()].some((c) => c.component === 'ResultCard'))) return []
    const touched = surfaces.some((v) => v.surfaceId === game || v.priorDataModel === undefined)
    return [
      touched
        ? {
            code: 'RESULT_CARD_MISSING',
            path: `${game}:concede`,
            message:
              `The Battleship check found that the player conceded the game on ${game} and this turn shows the outcome without a ResultCard. ` +
              'A surrender ends the game like a sunk fleet: keep the revealed board and add ONE ResultCard beside it (outcome lose, a title, a one-line summary, the final stats such as shots fired and hits) whose child is a Play again Button with newGame true.',
          }
        : {
            code: 'ACTION_NOT_APPLIED',
            path: `${game}:concede`,
            message:
              `The Battleship check found that the player conceded the game on ${game} and this turn sends it no update, so the end of the game exists only in prose. ` +
              `Call render_surface with an updateComponents for ${game} that reveals your fleet on the board and adds ONE ResultCard beside it (outcome lose, title, summary, stats, a Play again action), not only prose.`,
          },
    ]
  },
}

/** T-0296: whether a surface id names a Battleship game (it commits a fleet and asks for no word), this turn or earlier. */
function isFleetGame(id: string, surfaces: readonly SurfaceView[], open: readonly SurfaceView[] | undefined): boolean {
  return [...surfaces, ...(open ?? [])].some((v) => v.surfaceId === id && hasFleetCue(v) && !hasWordCue(v))
}

/** T-0366: the surfaces another check owns a move on (a board, a card table, a booking), so one move gets one finding. */
const OWNED_ELSEWHERE = new Set(['BoardGrid', 'CardTable', 'PlayingCard', 'BookingForm', 'BookingConfirmation'])
/** T-0366: a question about the game or its rules, which may stay prose ("What are the rules?", "Explain the rules."). */
const RULES_ASK = /\b(?:rules?|how (?:do|does|can) (?:i|you|we|this|it|the game) (?:play|work|win)|how to (?:play|win)|what (?:is|are) (?:the )?(?:goal|point|aim))\b|^\s*(?:explain|remind me|tell me (?:about|more))\b/i
/** T-0366: a question that still plays a move: an offer, a price or a counter put as a question ("How about 20 gold?"). */
const MOVE_QUESTION = /\d|\b(?:how about|what about|would you (?:take|accept|sell|do)|will you (?:take|accept|sell|do)|i(?:'ll| will)? (?:offer|pay|give))\b/i
/** T-0366: a question in form: a question mark, or a wh-opener ("What is your lowest price"); is, do, when, help and
 *  tell me also open imperatives ("When the goblin swings, I dodge left"), so they make no question. */
const QUESTION = /\?\s*$|^\s*(?:what|how|why|who|where|which)\b/i
/** T-0366: small talk: thanks, a laugh or a greeting with no move word after it ("Thanks, I appreciate it."); "Okay,
 *  deal." and "Ok, 20 gold then." are moves. */
const SMALL_TALK = /^\s*(?:thanks|thank you|cheers|haha|ha|lol|wow|nice|cool|great|hi|hello|hey)\b/i
const MOVE_WORD = /\d|\b(?:deal|offer|accept|pay|take|give|sell|buy|counter|open|go|walk|step|enter|attack|fight|run|climb|search|grab|pick|use|cast|drink|read|light|help|dodge|hide|talk)\b/i

/** T-0366: whether a say turn plays a move rather than asking about the game or chatting. */
function playsMove(intent: string): boolean {
  if (RULES_ASK.test(intent)) return false
  if (QUESTION.test(intent)) return MOVE_QUESTION.test(intent)
  return !(SMALL_TALK.test(intent) && !MOVE_WORD.test(intent))
}

/** T-0366: the player's words as a repair message may quote them: one line, no quotes, at most 60 characters. */
function quoted(intent: string): string {
  const flat = intent.replace(/["'“”‘’`]/g, '').replace(/\s+/g, ' ').trim()
  return flat.length <= 60 ? flat : `${flat.slice(0, 57).trimEnd()}...`
}

/**
 * T-0366 (the T-0362 smoke re-record, Haiku 5.5, traces 4 and 6): "I offer 20." targeting deal-1 and "I open the door
 * and step inside." targeting quest-log were each answered in one round with a reply and no render_surface call, so
 * the HUD kept the old price and the log the old scene. ACTION_NOT_APPLIED: a say turn whose meta-line declares an open
 * game surface its target (the surface it says it will change: a GameHud, or the shared game words) and plays a move
 * there sends that target no update; only an update to that surface id applies the move. A surface another check owns
 * (a board, a card table, a booking) is left to that check, so a move gets one ACTION_NOT_APPLIED.
 */
export const boardlessMoveAppliedCheck: SemanticCheck = {
  id: 'boardless-move-applied',
  requires: ['GameHud'],
  check({ surfaces, action, intent, target, open }) {
    if (action !== undefined || intent === undefined || target === undefined || !playsMove(intent.trim())) return []
    const game = (open ?? []).find((v) => v.surfaceId === target)
    if (game === undefined || surfaces.some((v) => v.surfaceId === target)) return []
    const comps = [...game.components.values()]
    if (comps.some((c) => OWNED_ELSEWHERE.has(c.component)) || hasFleetCue(game) || hasWordCue(game)) return []
    if (!comps.some((c) => c.component === 'GameHud') && !GAME_WORDS.test(`${target} ${JSON.stringify(comps)}`)) return []
    return [
      {
        code: 'ACTION_NOT_APPLIED',
        path: `${target}:move`,
        message:
          `The game check found that the player made a move on ${target} ("${quoted(intent)}") and this turn sends it no update, so the move exists only in prose. ` +
          `Call render_surface with an updateDataModel or updateComponents for ${target} that applies what the move changed (its stats, status and story), not only prose.`,
      },
    ]
  },
}

/** Every hidden-state check, in the order the hosts run them. */
export const HIDDEN_STATE_CHECKS: readonly SemanticCheck[] = [wordSecretCheck, fleetSecretCheck, fleetShotAppliedCheck, wordMoveAppliedCheck, fleetHudCheck, fleetConcedeCheck, boardlessMoveAppliedCheck]
