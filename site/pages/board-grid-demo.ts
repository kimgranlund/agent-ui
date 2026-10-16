// site/pages/board-grid-demo.ts: the ui-board-grid demo (a board of cells to target or mark, ADR-0243;
// pairs with board-grid-doc.ts, the descriptor-derived API page). Mounts the REAL control three times: a
// targetable 6x6 board whose `action` listener writes each hit back into `cells` and shows the last event
// detail, a read-only 6x5 word board with corner glyphs, and a 72-cell 8x9 board rendered in one pass.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.demo-figure/.demo-grid + section spacing)
import { el, exampleSection } from '../lib/specimens.ts'

type Cell = { row: number; col: number; mark: string; intent?: string; disabled?: boolean }
type BoardEl = HTMLElement & { cells: Cell[] }

const { content } = mountPage({
  title: 'ui-board-grid: demo',
  intro:
    'A board of cells to target or mark, live: a targetable board that records each shot, a read-only word ' +
    'board whose corner glyphs carry the state without color, and a 72-cell board in one pass. The API ' +
    'table is on the ui-board-grid API page.',
})

const text = (s: string): Text => document.createTextNode(s)
const code = (s: string): HTMLElement => el('code', {}, [text(s)])

const board = (attrs: Record<string, string>): BoardEl => el('ui-board-grid', { inline: '', ...attrs }) as BoardEl

// [1] a targetable board: the page owns the game state, the control only reports which cell was fired on.
const SHIPS = new Set(['0,1', '0,2', '0,3', '2,4', '3,4', '5,0'])
const shots: Cell[] = [
  { row: 0, col: 1, mark: '●', intent: 'danger', disabled: true },
  { row: 0, col: 2, mark: '●', intent: 'danger', disabled: true },
  { row: 1, col: 1, mark: '✕', intent: 'neutral', disabled: true },
  { row: 4, col: 4, mark: '✕', intent: 'neutral', disabled: true },
  { row: 2, col: 4, mark: '●', intent: 'danger', disabled: true },
  { row: 5, col: 0, mark: '▣', intent: 'success', disabled: true },
]
const target = board({ rows: '6', cols: '6', label: 'Enemy waters', 'action-name': 'fire' })
target.cells = [...shots]
const lastEvent = code('last action: (none yet)')
target.addEventListener('action', (e) => {
  const detail = (e as CustomEvent<{ action: string; context: { row: number; col: number } }>).detail
  const { row, col } = detail.context
  const hit = SHIPS.has(`${row},${col}`)
  shots.push(hit ? { row, col, mark: '●', intent: 'danger', disabled: true } : { row, col, mark: '✕', intent: 'neutral', disabled: true })
  target.cells = [...shots] // a cells write patches the cell in place; the roving position survives
  lastEvent.textContent = `last action: ${JSON.stringify(detail)}`
})
const targetNote = el('p', {}, [
  text('Legend: '), code('●'), text(' hit (danger), '), code('✕'), text(' miss (neutral), '), code('▣'),
  text(' sunk (success). Played cells are disabled, so the arrow keys skip them and they never fire.'),
])

// [2] a read-only word board: the guess history for CRANE, letters plus +, ? or - corner glyphs.
const GUESSES = ['SLATE', 'CHAIE', 'CRANE']
const ANSWER = 'CRANE'
const wordCells: Cell[] = []
GUESSES.forEach((guess, row) => {
  ;[...guess].forEach((letter, col) => {
    const intent = ANSWER[col] === letter ? 'success' : ANSWER.includes(letter) ? 'warning' : 'neutral'
    wordCells.push({ row, col, mark: letter, intent })
  })
})
const words = board({ rows: '6', cols: '5', label: 'Guess history for the word CRANE' })
words.cells = wordCells
const wordsNote = el('p', {}, [
  text('No '), code('action-name'), text(', so the board is read-only: it keeps one roving tab stop and never '),
  text('emits. Corner glyphs: '), code('+'), text(' right place, '), code('?'), text(' wrong place, '), code('-'),
  text(' not in the word.'),
])

// [3] a 72-cell board: every cell part is built in one pass, with no per-cell custom element.
const big = board({ rows: '8', cols: '9', label: 'A 72-cell board' })
big.cells = [
  { row: 0, col: 0, mark: 'A', intent: 'info' },
  { row: 3, col: 4, mark: 'B', intent: 'warning' },
  { row: 7, col: 8, mark: 'C', intent: 'success' },
]
const bigNote = el('p', {}, [text('8 rows by 9 columns, 72 cells, three of them marked.')])

content.append(
  exampleSection('A targetable board', target, el('p', {}, [lastEvent]), targetNote),
  exampleSection('A read-only word board', words, wordsNote),
  exampleSection('A 72-cell board', big, bigNote),
)
