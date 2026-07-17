// site/pages/sizing.ts — the public sizing & density guide: the consumer-facing story over
// .claude/docs/references/geometry.md (the LAW this page tells, never restates verbatim — cited by section for
// depth). Five size-classes, the [scale] × [size] explicit lookup (a live matrix of REAL ui-button instances,
// each caption read back via getBoundingClientRect — an empirical table, not an illustration), the compact
// realm's pad law, density-rides-rhythm-never-the-box, and single-line line-height:1.
import { mountPage, pageLead } from './_page.ts' // FIRST — foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './sizing.css'
import { heading } from '../lib/doc-page.ts'
import { el } from '../lib/specimens.ts'

const { content } = mountPage({
  title: 'Sizing & density',
  intro:
    'Control geometry is an explicit (scale × size) lookup — never a multiplier — and density touches only the ' +
    'rhythm (spacing), never the frame. This is the consumer-facing story over the geometry law; see ' +
    '.claude/docs/references/geometry.md for the full normative spec and its rationale.',
})

content.append(
  pageLead(
    'Every control’s size resolves from two independent inputs: an ancestor [scale] (the frame tier — a ' +
      'subtree-repointable multiplier’s replacement) and its own [size] attribute (sm/md/lg, which §1 row within ' +
      'that scale). The cell they select names height, font, and icon together — never derived by formula, so a ' +
      'control never drifts out of its own row.',
  ),
)

// ── 1 · the five size-classes ────────────────────────────────────────────────────────────────────────────────
content.append(heading(2, '1 · the five size-classes'))
content.append(
  el('p', {}, [
    document.createTextNode(
      'A component’s sizing LEVER is set by which class it belongs to — not every control measures itself the ' +
        'same way:',
    ),
  ]),
)

interface SizeClass {
  readonly name: string
  readonly examples: string
  readonly lever: string
}
const CLASSES: readonly SizeClass[] = [
  { name: 'Control', examples: 'button · text-field · select · field', lever: 'block-size off --md-sys-height-{size}; font off --md-sys-font-{size}; line-height:1 (single-line); inline-pad per the slot/slotless model.' },
  { name: 'Indicator', examples: 'checkbox · radio · switch · slider · tag', lever: 'block/inline-size off the widget ramp --md-sys-compact-{size} — a separate ramp from Control height.' },
  { name: 'Pattern', examples: 'tabs · segmented-control · toolbar · menu · dialog', lever: 'interactive rows take the control height; the shell uses the space scale.' },
  { name: 'Container / layout', examples: 'row · column · list · grid · card', lever: 'gaps/margins/padding off --md-sys-space-* × density; no control height at all.' },
  { name: 'Display', examples: 'icon · progress · text · tooltip', lever: 'text-bearing reads the type scale (--md-sys-typescale-*); non-text takes the control-band font-size where it sizes a glyph label. (badge lives in the compact realm — §3 below.)' },
]
{
  const table = document.createElement('table')
  table.className = 'sizing-class-table'
  const thead = document.createElement('thead')
  const headRow = document.createElement('tr')
  for (const l of ['Class', 'Examples', 'Lever']) {
    const th = document.createElement('th')
    th.textContent = l
    headRow.append(th)
  }
  thead.append(headRow)
  const tbody = document.createElement('tbody')
  for (const c of CLASSES) {
    const tr = document.createElement('tr')
    const nameCell = document.createElement('td')
    const strong = document.createElement('strong')
    strong.textContent = c.name
    nameCell.append(strong)
    const exCell = document.createElement('td')
    exCell.textContent = c.examples
    const leverCell = document.createElement('td')
    leverCell.textContent = c.lever
    tr.append(nameCell, exCell, leverCell)
    tbody.append(tr)
  }
  table.append(thead, tbody)
  content.append(table)
}

// ── 2 · the [scale] × [size] lookup — a LIVE, MEASURED matrix ───────────────────────────────────────────────
content.append(heading(2, '2 · the [scale] × [size] lookup'))
content.append(
  el('p', {}, [
    document.createTextNode(
      'Each row is a real ui-button wrapped in a [scale] ancestor; each column is its own [size]. The height ' +
        'below every button is read back live from the rendered DOM (getBoundingClientRect) — an empirical fact, ' +
        'not an illustration. The underlying height RAMP has two bands: a compact band (20 · 24 · 28, +4 linear ' +
        'steps) and an expressive band (36 · 48 · 64, ×4/3 geometric steps). Each [scale] name is a sliding ' +
        'three-value window over that one ramp — adjacent scales share values (ui-sm reads 20·24·28, ui-md reads ' +
        '24·28·36, … content-lg reads 36·48·64), which is why neighbouring cells in the matrix below repeat ' +
        'heights: a lookup over shared ramp rows, never a per-scale multiplier.',
  ),
  ]),
)

const SCALES = ['ui-sm', 'ui-md', 'ui-lg', 'content-sm', 'content-md', 'content-lg'] as const
const SIZES = ['sm', 'md', 'lg'] as const

const matrix = document.createElement('div')
matrix.className = 'sizing-matrix'
const header = document.createElement('div')
header.className = 'sizing-matrix-header'
header.append(el('span', { class: 'sizing-matrix-corner' }))
for (const size of SIZES) header.append(el('span', { class: 'sizing-matrix-headcell' }, [document.createTextNode(`size="${size}"`)]))
matrix.append(header)

const captions: { readonly button: HTMLElement; readonly caption: HTMLElement }[] = []
for (const scale of SCALES) {
  const row = document.createElement('div')
  row.className = 'sizing-matrix-row'
  row.append(el('span', { class: 'sizing-matrix-rowhead' }, [document.createTextNode(`[scale="${scale}"]`)]))
  for (const size of SIZES) {
    const cell = document.createElement('div')
    cell.className = 'sizing-matrix-cell'
    cell.setAttribute('scale', scale)
    const button = document.createElement('ui-button')
    button.setAttribute('variant', 'soft')
    button.setAttribute('size', size)
    button.textContent = size
    const caption = document.createElement('span')
    caption.className = 'sizing-matrix-caption'
    caption.textContent = '…'
    cell.append(button, caption)
    row.append(cell)
    captions.push({ button, caption })
  }
  matrix.append(row)
}
content.append(matrix)

// Measure AFTER every cell is connected (content is appended to the live document by the time this runs, since
// mountPage already inserted the shell synchronously) — a real getBoundingClientRect read, not a computed guess.
for (const { button, caption } of captions) {
  const height = Math.round(button.getBoundingClientRect().height)
  caption.textContent = `${height}px`
}

// ── 3 · the compact realm — a separate pad law ───────────────────────────────────────────────────────────────
content.append(heading(2, '3 · the compact realm'))
content.append(
  el('p', {}, [
    document.createTextNode(
      'Always-compact widgets — checkbox, switch, radio, slider, tag, badge, chip — never use the h/2 pad law: ' +
        'h/2 would over-pad a keycap or a count pill. They size their box on the dedicated --md-sys-compact-{size} ' +
        'ramp instead (a two-band ladder, ui-* tight / content-* generous) and keep a fixed compact pad. Below, ' +
        'a checkbox and a badge — both compact-realm, neither reads --md-sys-height-*:',
    ),
  ]),
)
{
  const checkbox = document.createElement('ui-checkbox')
  const badge = document.createElement('ui-badge')
  badge.setAttribute('intent', 'success')
  badge.setAttribute('label', 'Compact') // ui-badge's text is the `label` PROP, not slotted content (badge.md)
  content.append(el('div', { class: 'sizing-inline-row' }, [checkbox, badge]))
}

// ── 4 · density rides rhythm, never the box ──────────────────────────────────────────────────────────────────
content.append(heading(2, '4 · density rides rhythm, never the box'))
content.append(
  el('p', {}, [
    document.createTextNode(
      '[density] multiplies ONLY the icon-to-label gap — the frame (height, font, inline-pad) holds exactly. ' +
        'Watch the label sit closer to or further from the icon below while the button height never changes:',
    ),
  ]),
)
{
  const row = document.createElement('div')
  row.className = 'sizing-density-row'
  for (const density of ['compact', 'comfortable', 'spacious'] as const) {
    const cluster = document.createElement('div')
    cluster.className = 'sizing-density-cluster'
    cluster.setAttribute('density', density)
    const label = el('span', { class: 'sizing-density-label' }, [document.createTextNode(`[density="${density}"]`)])
    const button = document.createElement('ui-button')
    button.setAttribute('variant', 'soft')
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    icon.setAttribute('slot', 'leading')
    icon.setAttribute('data-role', 'icon')
    icon.setAttribute('viewBox', '0 0 24 24')
    icon.setAttribute('fill', 'currentColor')
    icon.setAttribute('aria-hidden', 'true')
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
    circle.setAttribute('cx', '12')
    circle.setAttribute('cy', '12')
    circle.setAttribute('r', '8')
    icon.append(circle)
    button.append(icon, document.createTextNode('Label'))
    cluster.append(label, button)
    row.append(cluster)
  }
  content.append(row)
}

// ── 5 · single-line line-height: 1 ───────────────────────────────────────────────────────────────────────────
content.append(heading(2, '5 · single-line controls set line-height: 1'))
content.append(
  el('p', {}, [
    document.createTextNode(
      'A single-line Control-class control’s text sets line-height: var(--md-sys-control-line-height) (= 1): the ' +
        'line, like a glyph, centers in the fixed frame with no extra leading — the frame height is unchanged, ' +
        'the tighter line box just removes the slack a browser’s default line-height would otherwise add. This ' +
        'excludes the Display class (ui-text): multi-line document text keeps its own per-role×size type ' +
        'line-height instead.',
    ),
  ]),
)
