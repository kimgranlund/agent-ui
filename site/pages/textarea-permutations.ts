// site/pages/textarea-permutations.ts — the ui-textarea permutations grid page (ADR-0134). Renders the full
// ui-textarea matrix — size × (empty/filled/disabled/readonly/required) — plus the `rows` growable-minimum
// demo and a resize:vertical demo. Unlike ui-button/ui-text-field there is no variant/type axis (ADR-0134:
// no adornment/codec machinery applies to plain multi-line text), so the matrix is size × state only.
//
// All geometry/colour/ARIA come from ui-textarea itself (the real control); this page only owns the page
// scaffold layout (permutations.css — the SHARED scaffold every {name}-permutations page reuses).
import { mountPage } from './_page.ts' // MUST be first — pulls the load-bearing foundation CSS + ui-* controls
import './permutations.css' // SHARED page scaffold (matrix/geo chrome), reused by every {name}-permutations page

const sizes = ['sm', 'md', 'lg'] as const

interface Column {
  readonly label: string
  readonly value?: string
  readonly placeholder?: string
  readonly disabled?: boolean
  readonly readonly?: boolean
  readonly required?: boolean
}
const columns: readonly Column[] = [
  { label: 'empty', placeholder: 'Write something…' },
  { label: 'filled', value: 'Multi-line prose\nwraps and grows.' },
  { label: 'disabled', value: 'Inert', disabled: true },
  { label: 'readonly', value: 'Select, not edit', readonly: true },
  { label: 'required', required: true },
]

interface TextareaSpec extends Column {
  readonly size: (typeof sizes)[number]
}

function makeTextarea(spec: TextareaSpec): HTMLElement {
  const el = document.createElement('ui-textarea')
  el.setAttribute('label', `${spec.size} ${spec.label}`)
  el.setAttribute('size', spec.size)
  if (spec.value !== undefined) el.setAttribute('value', spec.value)
  if (spec.placeholder !== undefined) el.setAttribute('placeholder', spec.placeholder)
  if (spec.disabled) el.setAttribute('disabled', '')
  if (spec.readonly) el.setAttribute('readonly', '')
  if (spec.required) el.setAttribute('required', '')
  return el
}

function gridText(text: string, className: string): HTMLElement {
  const cell = document.createElement('div')
  cell.className = className
  cell.textContent = text
  return cell
}

// One size section: a labelled <section> with a matrix grid — header row of column labels, then ONE row
// (this control has no second axis like button's variant), each cell one real specimen. 1 row × 5 columns.
function sizeSection(size: (typeof sizes)[number]): HTMLElement {
  const section = document.createElement('section')
  section.className = 'size-group'

  const heading = document.createElement('h2')
  heading.textContent = `size = ${size}`
  section.append(heading)

  const matrix = document.createElement('div')
  matrix.className = 'matrix'
  matrix.style.gridTemplateColumns = `max-content repeat(${columns.length}, minmax(9rem, 1fr))`

  matrix.append(gridText('state', 'matrix-head'))
  for (const column of columns) matrix.append(gridText(column.label, 'matrix-head'))

  matrix.append(gridText('ui-textarea', 'matrix-rowhead'))
  for (const column of columns) {
    const cell = document.createElement('div')
    cell.className = 'matrix-cell'
    cell.append(makeTextarea({ ...column, size }))
    matrix.append(cell)
  }

  section.append(matrix)
  return section
}

// The `rows` growable-minimum demo (ADR-0134's own multi-line law): rows sets a MIN height, not a fixed
// one — a short rows=2 stays compact when empty; typing past it scrolls (overflow-y:auto) rather than the
// box growing unbounded. Three rows values side by side, all pre-filled with enough text to show the effect.
const LOREM = 'One line.\nTwo lines.\nThree lines.\nFour lines.\nFive lines.'
function rowsSection(): HTMLElement {
  const section = document.createElement('section')
  section.className = 'size-group'
  const h = document.createElement('h2')
  h.textContent = 'rows — a growable MINIMUM, not a fixed height (ADR-0134)'
  section.append(h)

  const matrix = document.createElement('div')
  matrix.className = 'matrix'
  matrix.style.gridTemplateColumns = 'max-content repeat(3, minmax(9rem, 1fr))'
  matrix.append(gridText('rows', 'matrix-head'), gridText('2', 'matrix-head'), gridText('3 (default)', 'matrix-head'), gridText('8', 'matrix-head'))
  matrix.append(gridText('ui-textarea', 'matrix-rowhead'))
  for (const rows of ['2', '3', '8']) {
    const cell = document.createElement('div')
    cell.className = 'matrix-cell'
    const el = document.createElement('ui-textarea')
    el.setAttribute('label', `rows = ${rows}`)
    el.setAttribute('rows', rows)
    el.setAttribute('value', LOREM)
    cell.append(el)
    matrix.append(cell)
  }
  section.append(matrix)
  return section
}

const { content } = mountPage({
  title: 'Textarea — permutations',
  intro:
    'Every size × state combination of ui-textarea — empty / filled / disabled / readonly / required — plus ' +
    'the `rows` growable-minimum demo (ADR-0134: rows sets a MIN height, never a fixed one; overflow-y:auto ' +
    'scrolls content past it, resize:vertical lets the user drag it taller). There is no variant/type axis: ' +
    'ADR-0134 deliberately carries no adornment/codec machinery.',
})

for (const size of sizes) content.append(sizeSection(size))
content.append(rowsSection())
