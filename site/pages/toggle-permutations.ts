// site/pages/toggle-permutations.ts — the ui-toggle permutations grid (GH #832). Renders the FULL matrix —
// every size × anatomy-shape × pressed/disabled combination (3 sizes × 4 anatomy shapes × 4 states = 48 live
// controls) — built PROGRAMMATICALLY (loops over the size/anatomy/state arrays), the button-permutations.ts
// precedent: completeness is provable from the structure, not a hand-typed list.
//
// The three axes are the real attributes-as-API from toggle.md / toggle.ts `static props`: size ∈
// {sm, md, lg}, pressed (boolean), disabled (boolean). The anatomy axis is the three FIXED-role slots
// (icon/label/state-icon, toggle.md's Slots section) — a markup SHAPE, same underivable-from-attributes
// status button-doc.ts's own Anatomy section carries. All geometry/colour/ARIA come from ui-toggle itself;
// this page only owns the shared page scaffold (permutations.css, reused by every {name}-permutations page).
import { mountPage } from './_page.ts' // MUST be first — pulls the load-bearing foundation CSS + ui-* controls
import './permutations.css' // SHARED page scaffold (matrix/geo chrome), reused by every {name}-permutations page
import { resolveIcon, type IconName } from '@agent-ui/icons'
import '@agent-ui/icons/phosphor' // registers + activates the Phosphor default pack (ADR-0066) — resolveIcon below

const sizes = ['sm', 'md', 'lg'] as const

interface Anatomy {
  readonly label: string
  readonly icon?: IconName
  readonly stateIcon?: IconName
}
const anatomies: readonly Anatomy[] = [
  { label: 'label' },
  { label: 'icon · label', icon: 'chats-circle' },
  { label: 'label · state-icon', stateIcon: 'eye' },
  { label: 'icon · label · state-icon', icon: 'gear-six', stateIcon: 'eye' },
]

interface StateCol {
  readonly label: string
  readonly pressed: boolean
  readonly disabled: boolean
}
const states: readonly StateCol[] = [
  { label: 'unpressed', pressed: false, disabled: false },
  { label: 'pressed', pressed: true, disabled: false },
  { label: 'unpressed · disabled', pressed: false, disabled: true },
  { label: 'pressed · disabled', pressed: true, disabled: true },
]

function makeToggle(size: (typeof sizes)[number], anatomy: Anatomy, state: StateCol): HTMLElement {
  const el = document.createElement('ui-toggle')
  el.setAttribute('size', size)
  if (state.pressed) el.setAttribute('pressed', '')
  if (state.disabled) el.setAttribute('disabled', '')
  if (anatomy.icon) {
    const icon = resolveIcon(anatomy.icon)
    icon.setAttribute('slot', 'icon')
    el.append(icon)
  }
  el.append(document.createTextNode('Toggle'))
  if (anatomy.stateIcon) {
    const icon = resolveIcon(anatomy.stateIcon)
    icon.setAttribute('slot', 'state-icon')
    el.append(icon)
  }
  return el
}

function gridText(text: string, className: string): HTMLElement {
  const cell = document.createElement('div')
  cell.className = className
  cell.textContent = text
  return cell
}

// One size section: a labelled <section> with a matrix — header row of state labels, then a row per anatomy
// shape. 4 anatomies × 4 states = 16 toggles / section.
function sizeSection(size: (typeof sizes)[number]): HTMLElement {
  const section = document.createElement('section')
  section.className = 'size-group'

  const heading = document.createElement('h2')
  heading.textContent = `size = ${size}`
  section.append(heading)

  const matrix = document.createElement('div')
  matrix.className = 'matrix'
  matrix.style.gridTemplateColumns = `max-content repeat(${states.length}, minmax(7rem, 1fr))`

  matrix.append(gridText('anatomy', 'matrix-head')) // the corner names the row axis
  for (const state of states) matrix.append(gridText(state.label, 'matrix-head'))

  for (const anatomy of anatomies) {
    matrix.append(gridText(anatomy.label, 'matrix-rowhead'))
    for (const state of states) {
      const cell = document.createElement('div')
      cell.className = 'matrix-cell'
      cell.append(makeToggle(size, anatomy, state))
      matrix.append(cell)
    }
  }

  section.append(matrix)
  return section
}

const { content } = mountPage({
  title: 'Toggle — permutations',
  intro:
    'Every size × anatomy-shape × pressed/disabled combination of ui-toggle — 48 live controls — the three ' +
    'fixed-role slots (icon · label · state-icon, toggle.md’s Slots section) crossed with pressed/disabled.',
})

for (const size of sizes) content.append(sizeSection(size))
