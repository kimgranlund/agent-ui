// site/pages/text-field-permutations.ts — the ui-text-field permutation matrix (T2). Renders the size × state
// grid built PROGRAMMATICALLY: the size axis iterates the PARSED `size` enum from text-field.md (so adding a
// step to the descriptor adds its row for free), crossed with the real statically-renderable states (empty,
// filled, + leading icon, readonly, disabled). Completeness is provable from structure: |sizes| × |columns|.
// Below the matrix: the optional-adornment anatomy (the leading/trailing slot POSITIONS) and a [scale]/[density]
// subtree-geometry demo (ADR-0007) — text-field's density-bearing quantity is the adornment↔editor gap, so the
// [density] leg leads with a leading icon to make the gap delta visible.
//
// Every specimen is given a page-supplied display width via applyDemoWidth (the ADR-0021 width rationale — a
// ~20ch floor, layout owns the width above it — lives there, once) — layout context, not a restyle; all
// geometry/colour/state appearance is text-field.css's.
import { mountPage } from './_page.ts' // MUST be first — pulls the load-bearing foundation CSS + ui-* controls
import './permutations.css' // SHARED page scaffold (matrix/geo chrome), reused by every {name}-permutations page; AFTER _page.ts
import { loadTextFieldDoc } from '../lib/frontmatter.ts'
import { findAttr } from '../lib/doc-page.ts'
import { applyDemoWidth, searchIcon } from '../lib/specimens.ts'

const SPECIMEN_WIDTH = '14rem' // the display width passed to applyDemoWidth

const { descriptor } = loadTextFieldDoc()

// The size axis — the EXACT parsed enum members from text-field.md (NOT a parallel hand-list). Empty only if
// the descriptor somehow carried no `size` enum (it does; this keeps the derivation honest if that ever changes).
const sizes: readonly string[] = findAttr(descriptor, 'size')?.values ?? []

// The state columns — the statically-renderable states of a real field (the interaction states hover/focus/
// user-invalid need pointer/keyboard, so they live on the states showcase, not this static grid). Each column is
// a recipe of real attributes/slots; `leading` adds the canonical leading-icon adornment.
interface Column {
  readonly label: string
  readonly value?: string
  readonly placeholder?: string
  readonly leading?: boolean
  readonly readonly?: boolean
  readonly disabled?: boolean
}
const columns: readonly Column[] = [
  { label: 'empty', placeholder: 'Placeholder' },
  { label: 'filled', value: 'Typed value' },
  { label: '+ leading icon', value: 'With icon', leading: true },
  { label: 'readonly', value: 'Fixed', readonly: true },
  { label: 'disabled', value: 'Inert', disabled: true },
]

// FieldSpec — the field-attribute recipe makeField builds a real control from (distinct from Column, whose
// `label` is the matrix HEADER text, not a field attribute).
interface FieldSpec {
  readonly size?: string
  readonly type?: string
  readonly value?: string
  readonly placeholder?: string
  readonly leading?: boolean
  readonly trailing?: boolean
  readonly readonly?: boolean
  readonly disabled?: boolean
}

// makeField — one real <ui-text-field>. Attributes are the author surface (size/type/readonly/disabled all
// REFLECT, so setAttribute drives the same styling + the type-resolver's control-injected adornments as
// author-set markup); `value` seeds the editor part. The leading / trailing icons are light-DOM children carrying
// the canonical slot POSITION + data-role="icon".
function makeField(spec: FieldSpec): HTMLElement {
  const el = document.createElement('ui-text-field')
  if (spec.size) el.setAttribute('size', spec.size)
  if (spec.type) el.setAttribute('type', spec.type)
  if (spec.value !== undefined) el.setAttribute('value', spec.value)
  if (spec.placeholder !== undefined) el.setAttribute('placeholder', spec.placeholder)
  if (spec.readonly) el.setAttribute('readonly', '')
  if (spec.disabled) el.setAttribute('disabled', '')
  if (spec.leading) el.append(searchIcon('leading'))
  if (spec.trailing) el.append(searchIcon('trailing'))
  applyDemoWidth(el, SPECIMEN_WIDTH)
  return el
}

function gridText(text: string, className: string): HTMLElement {
  const cell = document.createElement('div')
  cell.className = className
  cell.textContent = text
  return cell
}

// sizeSection — one labelled <section> per size: a header row of the state-column labels, then a single field
// row (one field per column) at that size. |columns| fields per section; the column count sets the grid template.
function sizeSection(size: string): HTMLElement {
  const section = document.createElement('section')
  section.className = 'size-group'

  const heading = document.createElement('h2')
  heading.textContent = `size = ${size}`
  section.append(heading)

  const matrix = document.createElement('div')
  matrix.className = 'matrix'
  matrix.style.gridTemplateColumns = `max-content repeat(${columns.length}, minmax(9rem, 1fr))`

  matrix.append(gridText('', 'matrix-corner'))
  for (const column of columns) matrix.append(gridText(column.label, 'matrix-head'))

  matrix.append(gridText(`size = ${size}`, 'matrix-rowhead'))
  for (const column of columns) {
    const cell = document.createElement('div')
    cell.className = 'matrix-cell'
    // Build the field from the column's attribute recipe (its `label` is the header, not a field attribute).
    cell.append(makeField({ size, value: column.value, placeholder: column.placeholder, leading: column.leading, readonly: column.readonly, disabled: column.disabled }))
    matrix.append(cell)
  }

  section.append(matrix)
  return section
}

// ── the optional-adornment anatomy (anatomy.md / ADR-0006/0012) — the leading/trailing slot POSITIONS ─────────
interface Anatomy {
  readonly label: string
  readonly leading?: boolean
  readonly trailing?: boolean
}
const anatomies: readonly Anatomy[] = [
  { label: 'editor' },
  { label: 'icon · editor', leading: true },
  { label: 'editor · icon', trailing: true },
  { label: 'icon · editor · icon', leading: true, trailing: true },
]

function anatomySection(): HTMLElement {
  const section = document.createElement('section')
  section.className = 'size-group'
  const heading = document.createElement('h2')
  heading.textContent = 'Anatomy — optional [ leading | editor | trailing ] adornments'
  section.append(heading)

  const matrix = document.createElement('div')
  matrix.className = 'matrix'
  matrix.style.gridTemplateColumns = `repeat(${anatomies.length}, minmax(9rem, 1fr))`
  for (const anatomy of anatomies) matrix.append(gridText(anatomy.label, 'matrix-head'))
  for (const anatomy of anatomies) {
    const cell = document.createElement('div')
    cell.className = 'matrix-cell'
    cell.append(makeField({ size: 'md', value: 'Search', leading: anatomy.leading, trailing: anatomy.trailing }))
    matrix.append(cell)
  }
  section.append(matrix)
  return section
}

// ── the `type` variants (Wave 3, ADR-0044) — the type-resolver's control-injected adornments + inputmode + codec ─
// The type axis iterates the EXACT parsed `type` enum from text-field.md (NOT a hand-list), so adding a type to
// the descriptor adds its specimen for free. Each type maps to a representative seed value + a one-line note of
// what the resolver injects — the editorial CONTENT (a plausible value per type) is hand-authored, but the SET of
// types is derived, and `type='text'` is the identity config (byte-identical to the pre-Wave-3 control).
const types: readonly string[] = findAttr(descriptor, 'type')?.values ?? []

interface TypeSample {
  readonly value: string
  readonly placeholder: string
  readonly note: string // what the type-resolver adds (adornment / inputmode / codec) — shown as the caption
}
const TYPE_SAMPLES: Record<string, TypeSample> = {
  text: { value: 'Plain text', placeholder: 'Text', note: 'identity — no adornment' },
  email: { value: 'user@example.com', placeholder: 'you@example.com', note: 'inputmode=email · pattern → typeMismatch' },
  url: { value: 'https://example.com', placeholder: 'https://…', note: 'inputmode=url · URL parse → typeMismatch' },
  tel: { value: '+1 555 010 1234', placeholder: '+1 555 …', note: 'inputmode=tel' },
  password: { value: 'correct horse', placeholder: 'Password', note: 'masked · reveal toggle (trailing)' },
  search: { value: 'query text', placeholder: 'Search…', note: 'magnifier (leading) · clear button (trailing)' },
  number: { value: '42', placeholder: '0', note: 'inputmode=numeric · step ± buttons · numeric codec' },
  currency: { value: '1234.5', placeholder: '0.00', note: 'currency symbol (leading) · money codec' },
}

// typeSection — one section iterating the parsed `type` enum: a live field per type, seeded with a plausible
// value so the control-injected adornments (search magnifier + clear, password reveal, currency symbol, number
// steppers) actually render, above a caption naming what that type injects. |types| specimens by construction.
function typeSection(): HTMLElement {
  const section = document.createElement('section')
  section.className = 'size-group'
  const heading = document.createElement('h2')
  heading.textContent = 'Type variants — the auto-adornments, inputmode & codec (ADR-0044)'
  section.append(heading)

  const intro = document.createElement('p')
  intro.className = 'geo-note'
  intro.textContent =
    'The [type] enum (' + (types.join(' · ') || 'no types parsed') + ') selects a resolver that injects the ' +
    'right adornments (search magnifier + clear, password reveal, currency symbol, number steppers), sets the ' +
    'editor inputmode, and applies the value codec (number / currency). Interact with a specimen to see the ' +
    'reveal toggle, the clear button, or the steppers.'
  section.append(intro)

  const matrix = document.createElement('div')
  matrix.className = 'matrix'
  matrix.style.gridTemplateColumns = `repeat(${types.length}, minmax(11rem, 1fr))`
  for (const type of types) matrix.append(gridText(`type = ${type}`, 'matrix-head'))
  for (const type of types) {
    const sample = TYPE_SAMPLES[type] ?? { value: '', placeholder: type, note: type }
    const cell = document.createElement('div')
    cell.className = 'matrix-cell'
    cell.append(makeField({ size: 'md', type, value: sample.value, placeholder: sample.placeholder }))
    const caption = document.createElement('p')
    caption.className = 'geo-label'
    caption.textContent = sample.note
    cell.append(caption)
    matrix.append(cell)
  }
  section.append(matrix)
  return section
}

// ── subtree geometry (ADR-0007) — [scale] resizes the frame; [density] resizes the adornment↔editor gap ───────
function geometryRow(attr: 'scale' | 'density', value: string | null): HTMLElement {
  const row = document.createElement('div')
  row.className = 'geo-row'

  const caption = document.createElement('p')
  caption.className = 'geo-label'
  caption.textContent = value === null ? `(baseline — no [${attr}])` : `[${attr}="${value}"]`
  row.append(caption)

  const cluster = document.createElement('div')
  cluster.className = 'geo-cluster'
  if (value !== null) cluster.setAttribute(attr, value)
  // A leading icon makes the [density] gap delta visible (the gap is the density-bearing quantity).
  cluster.append(makeField({ size: 'md', value: 'Field', leading: true }))
  row.append(cluster)
  return row
}

function geometryBlock(title: string, note: string, attr: 'scale' | 'density', values: readonly (string | null)[]): HTMLElement {
  const block = document.createElement('div')
  block.className = 'geo-block'
  const heading = document.createElement('h3')
  heading.textContent = title
  block.append(heading)
  const desc = document.createElement('p')
  desc.className = 'geo-note'
  desc.textContent = note
  block.append(desc)
  for (const value of values) block.append(geometryRow(attr, value))
  return block
}

const { content } = mountPage({
  title: 'ui-text-field — permutations',
  intro:
    'Every size × state of ui-text-field — empty, filled, with a leading icon, readonly, and disabled — built ' +
    'programmatically from the parsed size enum (' + (sizes.join(' · ') || 'no sizes parsed') + '). Below: the ' +
    'optional leading/trailing adornment anatomy, the eight [type] variants (their auto-adornments, inputmode & ' +
    'codec), and a [scale] / [density] subtree-geometry demo (ADR-0007).',
})

// [1] The matrix — one section per parsed size.
for (const size of sizes) content.append(sizeSection(size))

// [2] The optional-adornment anatomy.
content.append(anatomySection())

// [3] The `type` variants — the type-resolver's adornments/inputmode/codec, iterated over the parsed type enum.
content.append(typeSection())

// [4] The subtree-geometry demo — [scale] resizes the frame; [density] resizes only the adornment↔editor gap.
const geometry = document.createElement('section')
geometry.className = 'geometry-demo'
const geoHeading = document.createElement('h2')
geoHeading.textContent = 'Subtree geometry — [scale] & [density] (ADR-0007)'
geometry.append(geoHeading)
geometry.append(
  geometryBlock(
    '[scale] — the frame multiplier',
    'An ancestor [scale] selects a frame tier — the tight ui-* control band or the generous content-* reading ' +
      'band (ADR-0032) — and the per-subtree ramp recomputes both the frame (height) and the font.',
    'scale',
    [null, 'ui-sm', 'ui-lg', 'content-lg'],
  ),
)
geometry.append(
  geometryBlock(
    '[density] — the rhythm multiplier',
    'An ancestor [density] multiplies ONLY the adornment↔editor gap; the frame holds. Watch the icon-to-editor spacing.',
    'density',
    [null, 'compact', 'spacious'],
  ),
)
content.append(geometry)
