// site/pages/otp-field-permutations.ts — the ui-otp-field permutations grid page (code-entry-control.lld.md,
// GH #490 S2-a). Renders the full ui-otp-field matrix — size × (empty/partial/complete/disabled/required) —
// plus a `length` variation row (4/6/8-digit codes). Unlike ui-text-field there is no type/variant axis (no
// adornment/codec machinery applies to a digit-only code), so the matrix is size × state only.
//
// All geometry/colour/ARIA come from ui-otp-field itself (the real control); this page only owns the page
// scaffold layout (permutations.css — the SHARED scaffold every {name}-permutations page reuses).
import { mountPage } from './_page.ts' // MUST be first — pulls the load-bearing foundation CSS + ui-* controls
import './permutations.css' // SHARED page scaffold (matrix/geo chrome), reused by every {name}-permutations page

const sizes = ['sm', 'md', 'lg'] as const

interface Column {
  readonly label: string
  readonly value?: string
  readonly disabled?: boolean
  readonly required?: boolean
}
const columns: readonly Column[] = [
  { label: 'empty' },
  { label: 'partial', value: '42' },
  { label: 'complete', value: '424242' },
  { label: 'disabled', value: '424242', disabled: true },
  { label: 'required', required: true },
]

interface OtpFieldSpec extends Column {
  readonly size: (typeof sizes)[number]
}

function makeOtpField(spec: OtpFieldSpec): HTMLElement {
  const el = document.createElement('ui-otp-field')
  el.setAttribute('label', `${spec.size} ${spec.label}`)
  el.setAttribute('size', spec.size)
  if (spec.value !== undefined) el.setAttribute('value', spec.value)
  if (spec.disabled) el.setAttribute('disabled', '')
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

  matrix.append(gridText('ui-otp-field', 'matrix-rowhead'))
  for (const column of columns) {
    const cell = document.createElement('div')
    cell.className = 'matrix-cell'
    cell.append(makeOtpField({ ...column, size }))
    matrix.append(cell)
  }

  section.append(matrix)
  return section
}

// The `length` variation demo — 4/6/8-digit codes, all empty (the cell count is the only geometry it varies).
function lengthSection(): HTMLElement {
  const section = document.createElement('section')
  section.className = 'size-group'
  const h = document.createElement('h2')
  h.textContent = 'length — the N-cell count (§7: no min-inline-size floor; the grid IS the floor)'
  section.append(h)

  const matrix = document.createElement('div')
  matrix.className = 'matrix'
  matrix.style.gridTemplateColumns = 'max-content repeat(3, minmax(9rem, 1fr))'
  matrix.append(gridText('length', 'matrix-head'), gridText('4', 'matrix-head'), gridText('6 (default)', 'matrix-head'), gridText('8', 'matrix-head'))
  matrix.append(gridText('ui-otp-field', 'matrix-rowhead'))
  for (const length of ['4', '6', '8']) {
    const cell = document.createElement('div')
    cell.className = 'matrix-cell'
    const el = document.createElement('ui-otp-field')
    el.setAttribute('label', `length = ${length}`)
    el.setAttribute('length', length)
    cell.append(el)
    matrix.append(cell)
  }
  section.append(matrix)
  return section
}

const { content } = mountPage({
  title: 'ui-otp-field — permutations',
  intro:
    'Every size × state combination of ui-otp-field — empty / partial / complete / disabled / required — ' +
    'plus the `length` cell-count demo (code-entry-control.lld.md §7: this control ships NO min-inline-size ' +
    'floor — the N-cell grid\'s own intrinsic size already IS the floor). There is no variant/type axis: a ' +
    'one-time-code entry carries no adornment/codec machinery.',
})

for (const size of sizes) content.append(sizeSection(size))
content.append(lengthSection())
