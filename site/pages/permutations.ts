// site/pages/permutations.ts — slice A2, the permutations grid page (the headline demo). Renders the FULL
// ui-button matrix — every size × variant × disabled, bare-label AND with the optional leading icon slot
// (3 × 3 × 2 × 2 = 36 live controls) — plus a [scale]/[density] subtree-geometry demo (ADR-0007).
//
// The matrix is built PROGRAMMATICALLY (loops over the size/variant/column arrays) rather than hand-written,
// so completeness is provable from the structure: |sizes| × |variants| × |columns| = 3 × 3 × 4 = 36.
//
// All geometry/colour/ARIA come from ui-button itself (the real control); this page only owns the page
// scaffold layout (permutations.css). The props used are the real attributes-as-API from button.md /
// button.ts `static props`: variant ∈ {solid, soft, ghost}, size ∈ {sm, md, lg}, disabled (boolean); the
// optional leading icon is a light-DOM child carrying `slot="icon"` (ADR-0006 host-as-grid).
import { mountPage } from './_page.ts' // MUST be first — pulls the load-bearing foundation CSS + ui-* controls
import './permutations.css' // AFTER _page.ts so the page scaffold cascades after the component layer

const SVG_NS = 'http://www.w3.org/2000/svg'

// The three axes of the matrix — the EXACT enum values from button.ts `static props`.
const sizes = ['sm', 'md', 'lg'] as const
const variants = ['solid', 'soft', 'ghost'] as const

// The four columns per variant row: the (icon × disabled) cross. `disabled` is marked in the header label;
// the disabled control also renders muted (button.css repoints to the neutral roles).
interface Column {
  readonly label: string
  readonly icon: boolean
  readonly disabled: boolean
}
const columns: readonly Column[] = [
  { label: 'bare', icon: false, disabled: false },
  { label: 'bare · disabled', icon: false, disabled: true },
  { label: '+ icon', icon: true, disabled: false },
  { label: '+ icon · disabled', icon: true, disabled: true },
]

// A leading icon for the optional `slot="icon"` cell — a decorative download glyph. `currentColor` makes it
// inherit the button ink (proving the slot tints with the variant); `aria-hidden` keeps the label text as the
// accessible name (the doc's guidance for decorative icons). Sized by button.css (var(--ui-button-icon)).
function makeIcon(): SVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('slot', 'icon')
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('viewBox', '0 0 24 24')
  const path = document.createElementNS(SVG_NS, 'path')
  path.setAttribute('d', 'M12 3v10m0 0l-4-4m4 4l4-4M5 21h14')
  path.setAttribute('fill', 'none')
  path.setAttribute('stroke', 'currentColor')
  path.setAttribute('stroke-width', '2')
  path.setAttribute('stroke-linecap', 'round')
  path.setAttribute('stroke-linejoin', 'round')
  svg.append(path)
  return svg
}

interface ButtonSpec {
  readonly size: (typeof sizes)[number]
  readonly variant: (typeof variants)[number]
  readonly disabled: boolean
  readonly icon: boolean
}

// Build one real <ui-button>. Attributes are the author surface — variant/size/disabled all REFLECT, so
// setAttribute drives the same styling/behaviour as author-set markup. Icon-first child order (leading slot),
// then the label text — the label is the accessible name.
function makeButton(spec: ButtonSpec): HTMLElement {
  const button = document.createElement('ui-button')
  button.setAttribute('variant', spec.variant)
  button.setAttribute('size', spec.size)
  if (spec.disabled) button.setAttribute('disabled', '')
  if (spec.icon) button.append(makeIcon())
  button.append(document.createTextNode('Button'))
  return button
}

function gridText(text: string, className: string): HTMLElement {
  const cell = document.createElement('div')
  cell.className = className
  cell.textContent = text
  return cell
}

// One size section: a labelled <section> with a matrix grid — header row of column labels, then a row per
// variant (variant label + the four (icon × disabled) buttons). 3 variants × 4 columns = 12 buttons / section.
function sizeSection(size: (typeof sizes)[number]): HTMLElement {
  const section = document.createElement('section')
  section.className = 'size-group'

  const heading = document.createElement('h2')
  heading.textContent = `size = ${size}`
  section.append(heading)

  const matrix = document.createElement('div')
  matrix.className = 'matrix'

  // Header row: an empty corner, then one label per column.
  matrix.append(gridText('', 'matrix-corner'))
  for (const column of columns) matrix.append(gridText(column.label, 'matrix-head'))

  // One row per variant.
  for (const variant of variants) {
    matrix.append(gridText(`variant = ${variant}`, 'matrix-rowhead'))
    for (const column of columns) {
      const cell = document.createElement('div')
      cell.className = 'matrix-cell'
      cell.append(makeButton({ size, variant, disabled: column.disabled, icon: column.icon }))
      matrix.append(cell)
    }
  }

  section.append(matrix)
  return section
}

// A geometry-demo row: a labelled caption + a cluster wrapper carrying [scale=…] or [density=…] on an
// ANCESTOR of the buttons. The derived ramp lives on `*` (dimensions.css), so each button re-substitutes the
// multiplier it inherits — the subtree repointing visibly recomputes the frame ([scale]) or the icon↔label
// gap ([density]). Icon buttons are used so the density gap delta is visible (the gap is density-bearing).
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
  cluster.append(makeButton({ size: 'md', variant: 'solid', disabled: false, icon: true }))
  cluster.append(makeButton({ size: 'lg', variant: 'soft', disabled: false, icon: true }))
  row.append(cluster)

  return row
}

function geometryBlock(
  title: string,
  note: string,
  attr: 'scale' | 'density',
  values: readonly (string | null)[],
): HTMLElement {
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
  title: 'Button — permutations',
  intro:
    'Every size × variant × disabled combination of ui-button — bare-label and with the optional leading ' +
    'icon slot (36 live controls) — plus a [scale] / [density] subtree-geometry demo (ADR-0007).',
})

// [1] The full matrix — one section per size.
for (const size of sizes) content.append(sizeSection(size))

// [2] The subtree-geometry demo — [scale] resizes the frame; [density] resizes only the icon↔label gap.
const geometry = document.createElement('section')
geometry.className = 'geometry-demo'
const geoHeading = document.createElement('h2')
geoHeading.textContent = 'Subtree geometry — [scale] & [density] (ADR-0007)'
geometry.append(geoHeading)
geometry.append(
  geometryBlock(
    '[scale] — the frame multiplier',
    'An ancestor [scale] multiplies both the frame (height) and the font; the per-subtree ramp recomputes.',
    'scale',
    [null, 'compact', 'spacious'],
  ),
)
geometry.append(
  geometryBlock(
    '[density] — the rhythm multiplier',
    'An ancestor [density] multiplies ONLY the icon↔label gap; the frame holds. Watch the icon-to-label spacing.',
    'density',
    [null, 'compact', 'spacious'],
  ),
)
content.append(geometry)
