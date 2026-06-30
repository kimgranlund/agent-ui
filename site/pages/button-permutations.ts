// site/pages/button-permutations.ts — the ui-button permutations grid page (the headline demo). Renders the FULL
// ui-button matrix — every size × variant × disabled, bare-label AND with the optional leading icon slot
// (3 × 3 × 2 × 2 = 36 live controls) — the structural anatomy axis: FORWARD [ icon | label | caret ] AND its
// REVERSED [ caret | label | icon ] (position ⊥ role — ADR-0006 host-as-grid, extended by ADR-0012), and a
// [scale]/[density] subtree-geometry demo (ADR-0007).
//
// The matrix is built PROGRAMMATICALLY (loops over the size/variant/column arrays) rather than hand-written,
// so completeness is provable from the structure: |sizes| × |variants| × |columns| = 3 × 3 × 4 = 36.
//
// All geometry/colour/ARIA come from ui-button itself (the real control); this page only owns the page
// scaffold layout (permutations.css — a SHARED scaffold every {name}-permutations page reuses). The props used are the real attributes-as-API from button.md /
// button.ts `static props`: variant ∈ {solid, soft, ghost}, size ∈ {sm, md, lg}, disabled (boolean); the
// optional leading icon is a light-DOM child carrying `slot="leading"` + `data-role="icon"` (ADR-0006 host-as-grid).
import { mountPage } from './_page.ts' // MUST be first — pulls the load-bearing foundation CSS + ui-* controls
import './permutations.css' // SHARED page scaffold (matrix/geo chrome), reused by every {name}-permutations page; AFTER _page.ts

const SVG_NS = 'http://www.w3.org/2000/svg'

// The three axes of the matrix — the EXACT enum values from button.ts `static props`.
const sizes = ['sm', 'md', 'lg'] as const
const variants = ['solid', 'soft', 'ghost'] as const

// An adornment is a POSITION (the slot) × a ROLE (data-role) — orthogonal per ADR-0012. The slot PLACES it
// (start/end cell); the role SIZES the glyph (icon fills the icon-sized cell; caret is font-sized + centered).
// Because they are independent, a caret can lead and an icon can trail (the reversed structures below).
type SlotName = 'leading' | 'trailing'
type AdornmentRole = 'icon' | 'caret'

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

// A decorative download glyph — an `data-role="icon"` adornment for the given POSITION (default `leading`, its
// canonical home; the reversed structures place it `trailing`). `currentColor` makes it inherit the button ink
// (proving the slot tints with the variant); `aria-hidden` keeps the label text as the accessible name (the
// doc's guidance for decorative icons). Sized by button.css to fill the icon cell (var(--ui-button-icon)).
function makeIcon(slot: SlotName = 'leading'): SVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('slot', slot) // POSITION (start/end cell)
  svg.setAttribute('data-role', 'icon') // CONTENT role (icon · caret · future tag/badge)
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

// A decorative chevron-down (the common dropdown/disclosure adornment) — a `data-role="caret"` for the given
// POSITION (default `trailing`, its canonical home; the reversed structures place it `leading`). `currentColor`
// tints it with the variant ink; `aria-hidden` keeps the label as the accessible name (the caret carries NO
// semantics — popup/disclosure meaning belongs on the host via ARIA). The cell is icon-sized for BOTH roles;
// button.css insets the caret GLYPH to font size and centers it (ADR-0012), wherever the caret sits.
function makeCaret(slot: SlotName = 'trailing'): SVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('slot', slot) // POSITION (start/end cell)
  svg.setAttribute('data-role', 'caret') // CONTENT role
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('viewBox', '0 0 24 24')
  const path = document.createElementNS(SVG_NS, 'path')
  path.setAttribute('d', 'M6 9l6 6 6-6') // chevron-down
  path.setAttribute('fill', 'none')
  path.setAttribute('stroke', 'currentColor')
  path.setAttribute('stroke-width', '2')
  path.setAttribute('stroke-linecap', 'round')
  path.setAttribute('stroke-linejoin', 'round')
  svg.append(path)
  return svg
}

// makeAdornment — dispatch on ROLE to the matching glyph helper, PLACED in the given slot (POSITION). The
// orthogonality (ADR-0012): any role can sit in either slot — a caret can lead, an icon can trail.
function makeAdornment(slot: SlotName, role: AdornmentRole): SVGElement {
  return role === 'icon' ? makeIcon(slot) : makeCaret(slot)
}

interface ButtonSpec {
  readonly size: (typeof sizes)[number]
  readonly variant: (typeof variants)[number]
  readonly disabled: boolean
  readonly leading?: AdornmentRole // the start-cell adornment role (icon · caret), if any
  readonly trailing?: AdornmentRole // the end-cell adornment role, if any
}

// Build one real <ui-button>. Attributes are the author surface — variant/size/disabled all REFLECT, so
// setAttribute drives the same styling/behaviour as author-set markup. Child order IS column order — the
// leading adornment, then the label text (the accessible name), then the trailing adornment.
function makeButton(spec: ButtonSpec): HTMLElement {
  const button = document.createElement('ui-button')
  button.setAttribute('variant', spec.variant)
  button.setAttribute('size', spec.size)
  if (spec.disabled) button.setAttribute('disabled', '')
  // Child order IS column order (host-as-grid auto-places in DOM order): leading → label → trailing.
  if (spec.leading) button.append(makeAdornment('leading', spec.leading))
  button.append(document.createTextNode('Button'))
  if (spec.trailing) button.append(makeAdornment('trailing', spec.trailing))
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
      cell.append(makeButton({ size, variant, disabled: column.disabled, leading: column.icon ? 'icon' : undefined }))
      matrix.append(cell)
    }
  }

  section.append(matrix)
  return section
}

// The structural anatomy axis (ADR-0006, extended by ADR-0012): the host-as-grid composes an OPTIONAL leading
// adornment and an OPTIONAL trailing adornment, each carrying a ROLE independent of its POSITION. POSITION (the
// slot) places the cell; ROLE (data-role) sizes the glyph — so the SAME four structures read FORWARD (leading
// icon × trailing caret) or REVERSED (leading caret × trailing icon).
interface Anatomy {
  readonly label: string
  readonly leading?: AdornmentRole
  readonly trailing?: AdornmentRole
}

// Forward structures: the leading ICON × trailing CARET cross — [ label ] · [ icon | label ] ·
// [ label | caret ] · [ icon | label | caret ] (the affordance the trailing caret signals: menu / disclosure).
const forwardAnatomies: readonly Anatomy[] = [
  { label: 'label' },
  { label: 'icon · label', leading: 'icon' },
  { label: 'label · caret', trailing: 'caret' },
  { label: 'icon · label · caret', leading: 'icon', trailing: 'caret' },
]

// Reversed structures (ADR-0012: position ⊥ role): the CARET on the leading edge, the ICON on the trailing
// edge. Padding stays slot-presence-driven (role-agnostic), so the inline pads are symmetric whenever BOTH
// slots fill — and the leading caret glyph is still font-sized (the BTN-CARET law holds on either edge).
const reversedAnatomies: readonly Anatomy[] = [
  { label: 'caret · label', leading: 'caret' },
  { label: 'label · icon', trailing: 'icon' },
  { label: 'caret · label · icon', leading: 'caret', trailing: 'icon' },
]

// The anatomy matrix: a row per variant × one column per structure (size md). Reuses the .matrix chrome, but
// the column count is DERIVED from the structure list (one column per anatomy) — the shared .matrix grid is
// fixed at 4 columns, so set the template explicitly to stay provably-complete for any structure set.
function anatomySection(title: string, anatomies: readonly Anatomy[]): HTMLElement {
  const section = document.createElement('section')
  section.className = 'size-group'

  const heading = document.createElement('h2')
  heading.textContent = title
  section.append(heading)

  const matrix = document.createElement('div')
  matrix.className = 'matrix'
  matrix.style.gridTemplateColumns = `max-content repeat(${anatomies.length}, minmax(7rem, 1fr))`

  matrix.append(gridText('', 'matrix-corner'))
  for (const anatomy of anatomies) matrix.append(gridText(anatomy.label, 'matrix-head'))

  for (const variant of variants) {
    matrix.append(gridText(`variant = ${variant}`, 'matrix-rowhead'))
    for (const anatomy of anatomies) {
      const cell = document.createElement('div')
      cell.className = 'matrix-cell'
      cell.append(makeButton({ size: 'md', variant, disabled: false, leading: anatomy.leading, trailing: anatomy.trailing }))
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
  cluster.append(makeButton({ size: 'md', variant: 'solid', disabled: false, leading: 'icon' }))
  cluster.append(makeButton({ size: 'lg', variant: 'soft', disabled: false, leading: 'icon' }))
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
    'icon slot (36 live controls) — the [ icon | label | caret ] structural anatomy and its reversed ' +
    '[ caret | label | icon ] (position ⊥ role), and a [scale] / [density] subtree-geometry demo (ADR-0007).',
})

// [1] The full matrix — one section per size.
for (const size of sizes) content.append(sizeSection(size))

// [2] The structural anatomy — position ⊥ role (ADR-0012): the FORWARD leading-icon × trailing-caret cross,
// then its REVERSED mirror (caret on the leading edge, icon on the trailing edge).
content.append(anatomySection('Anatomy — [ icon | label | caret ]', forwardAnatomies))
content.append(anatomySection('Anatomy (reversed) — [ caret | label | icon ]', reversedAnatomies))

// [3] The subtree-geometry demo — [scale] resizes the frame; [density] resizes only the icon↔label gap.
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
    'An ancestor [density] multiplies ONLY the icon↔label gap; the frame holds. Watch the icon-to-label spacing.',
    'density',
    [null, 'compact', 'spacious'],
  ),
)
content.append(geometry)
