// site/pages/board-grid-doc.ts: the ui-board-grid API doc page (tier=pattern, so {doc, demo}; ADR-0243).
// DERIVED from `board-grid.md` via the shared doc-page.ts renderer: the attribute, events and parts tables
// are built from the parsed descriptor and the prose from its body, so neither can drift from the
// descriptor the contract trip-wire enforces (ADR-0004, one parser / two consumers). The specimens are
// HAND-AUTHORED: a doc page has no source to derive a representative board from (the example-authoring
// law: representative, not a lorem stub).
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import { loadBoardGridDoc } from '../lib/frontmatter.ts'
import { composeDocPage, findAttr, heading } from '../lib/doc-page.ts'
import type { ParsedDescriptor } from '@agent-ui/components/descriptor'

type BoardCellSpec = { row: number; col: number; mark?: string; intent?: string; disabled?: boolean }
type BoardEl = HTMLElement & { cells: BoardCellSpec[] }

const { descriptor, body } = loadBoardGridDoc()

const { content } = mountPage({
  title: 'ui-board-grid: API',
  intro:
    'A board of cells to target or mark (ADR-0243). Marks are text plus intent, never color alone; the ' +
    'board has one roving tab stop, arrow keys move by cell and row, and Enter or Space on an enabled cell ' +
    'emits `action` when `actionName` is set. Generated from board-grid.md: the attribute, events and parts ' +
    'tables are descriptor-derived; the specimens below are hand-composed.',
})

composeDocPage(content, descriptor, body, renderSpecimens(descriptor))

// renderSpecimens: an interactive board, a read-only board with every intent glyph, and the intent set
// itself, iterated from the PARSED `cells` row description so the page names what the descriptor names.
function renderSpecimens(d: ParsedDescriptor): HTMLElement {
  const section = document.createElement('section')
  section.append(heading(2, 'Examples'), renderTargetBoard(), renderIntentBoard(d))
  return section
}

// renderTargetBoard: a mid-game 6x6 targeting board. Hit and missed cells are disabled, so the roving
// tab stop and the arrow keys skip them, and the `action` log below names the last activated cell.
function renderTargetBoard(): HTMLElement {
  const wrap = document.createElement('div')
  const intro = document.createElement('p')
  intro.textContent =
    'An interactive board (`action-name="fire"`). Played cells are disabled: Tab lands on the first open ' +
    'cell, the arrows skip played cells, and Enter or Space fires.'
  const board = boardGrid({ rows: 6, cols: 6, label: 'Enemy waters', actionName: 'fire' })
  board.cells = [
    { row: 0, col: 1, mark: '●', intent: 'danger', disabled: true },
    { row: 0, col: 2, mark: '●', intent: 'danger', disabled: true },
    { row: 1, col: 1, mark: '✕', intent: 'neutral', disabled: true },
    { row: 3, col: 4, mark: '✕', intent: 'neutral', disabled: true },
  ]
  const log = document.createElement('code')
  log.textContent = 'action: (none yet)'
  board.addEventListener('action', (e) => {
    log.textContent = `action: ${JSON.stringify((e as CustomEvent).detail)}`
  })
  wrap.append(heading(3, 'An interactive board'), intro, board, paragraph(log))
  return wrap
}

// renderIntentBoard: a read-only 1x5 board, one cell per intent in the descriptor's own order.
function renderIntentBoard(d: ParsedDescriptor): HTMLElement {
  const wrap = document.createElement('div')
  const intro = document.createElement('p')
  intro.textContent =
    'A read-only board (no `action-name`): each intent tints the cell with its container color and adds a ' +
    'corner glyph, so the state survives without color.'
  const intents = ['neutral', 'info', 'success', 'warning', 'danger']
  const board = boardGrid({ rows: 1, cols: intents.length, label: 'Intent set' })
  board.cells = intents.map((intent, col) => ({ row: 0, col, mark: intent[0]!.toUpperCase(), intent }))
  const note = document.createElement('p')
  note.textContent = `Attributes: ${(d.attributes.map((a) => a.name) as string[]).join(', ')}. ` +
    `\`cells\` default: ${JSON.stringify(findAttr(d, 'cells')?.default ?? '')} (the live default is an empty array).`
  wrap.append(heading(3, 'Intent glyphs'), intro, board, note)
  return wrap
}

// boardGrid: a live <ui-board-grid> with its shape and label set.
function boardGrid(opts: { rows: number; cols: number; label: string; actionName?: string }): BoardEl {
  const el = document.createElement('ui-board-grid') as BoardEl
  el.setAttribute('rows', String(opts.rows))
  el.setAttribute('cols', String(opts.cols))
  el.setAttribute('label', opts.label)
  if (opts.actionName) el.setAttribute('action-name', opts.actionName)
  el.setAttribute('inline', '')
  return el
}

function paragraph(node: Node): HTMLElement {
  const p = document.createElement('p')
  p.append(node)
  return p
}
