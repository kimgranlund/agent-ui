// site/pages/layout-overview.ts — the "Layout primitives" family overview (T7). The member list is DERIVED
// from the shipped descriptors via membersOfTier('layout') (the Vite descriptor glob) — a new layout primitive
// appears here automatically, so the listing cannot drift from the fleet (the T7 coverage discipline). Per
// member the page derives the tag, the ARIA role (from the descriptor's `aria.role`), the layout grammar it
// carries (flex vs track, derived from whether it has an `align` vs a `min` attribute), and a link to its API
// doc. The shared-shape prose is hand-authored (it summarizes ADR-0015/0016 — a T7 conceptual summary).
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo-content chrome; never restyles a ui-* control
import { membersOfTier } from '../lib/frontmatter.ts'
import { findAttr, heading } from '../lib/doc-page.ts'

const { content } = mountPage({
  title: 'Layout primitives',
  intro: 'The structural layout family — ui-row, ui-column, ui-list, ui-grid. They share the UIContainerElement ' +
    'surface base (elevation / brightness, ADR-0015) and, for the flex three, one spreadable flex grammar ' +
    '(align / justify / gap / wrap, ADR-0016). Direction is the element\'s identity — pick the tag, not a prop.',
})

// ── the shared shape (hand-authored — a T7 summary citing the canonical ADRs) ───────────────────────────────
const shape = document.createElement('section')
shape.append(heading(2, 'The shared shape'))
const shapeProse = document.createElement('p')
shapeProse.textContent =
  'Each primitive extends UIContainerElement: it is structural (not form-associated), carries the two signed ' +
  'surface axes (elevation, the scheme-inverting plane; brightness, the scheme-consistent tonal shift; both ' +
  '-3…3, 0 = the neutral base), is intrinsically responsive (it reflows on its own container/own width, not a ' +
  'viewport breakpoint — no breakpoint props), and holds zero colour opinion (the surface paints once in the ' +
  'shared container.css seam). The flex three (row / column / list) add the shared flex grammar; ui-grid is a ' +
  'track grid (auto-fit / minmax) with a gap and a min floor instead.'
shape.append(shapeProse)

// ── the members (DERIVED from the shipped layout descriptors) ───────────────────────────────────────────────
const members = membersOfTier('layout')

const list = document.createElement('section')
list.append(heading(2, `Members (${String(members.length)})`))

const table = document.createElement('table')
const thead = document.createElement('thead')
const headRow = document.createElement('tr')
for (const label of ['Element', 'ARIA role', 'Grammar', 'API doc']) {
  const th = document.createElement('th')
  th.textContent = label
  th.style.textAlign = 'left'
  headRow.append(th)
}
thead.append(headRow)
table.append(thead)

const tbody = document.createElement('tbody')
for (const member of members) {
  const d = member.doc.descriptor
  const role = d.maps.get('aria')?.get('role') ?? 'none'
  // Grammar is DERIVED from the attribute surface: an `align` attr ⇒ the flex grammar; a `min` attr ⇒ the track grid.
  const grammar = findAttr(d, 'align') ? 'flex (align · justify · gap · wrap)' : findAttr(d, 'min') ? 'track grid (auto-fit · gap · min)' : '—'

  const tr = document.createElement('tr')

  const tagCell = document.createElement('td')
  const tagCode = document.createElement('code')
  tagCode.textContent = member.tag
  tagCell.append(tagCode)

  const roleCell = document.createElement('td')
  roleCell.textContent = role

  const grammarCell = document.createElement('td')
  grammarCell.textContent = grammar

  const linkCell = document.createElement('td')
  const link = document.createElement('a')
  link.href = `./${member.name}-doc.html`
  link.textContent = `${member.name}-doc`
  linkCell.append(link)

  tr.append(tagCell, roleCell, grammarCell, linkCell)
  tbody.append(tr)
}
table.append(tbody)
list.append(table)

const more = document.createElement('p')
more.innerHTML = 'See the <a href="./layout-permutations.html">surface × layout showcase</a> for every primitive ' +
  'under the shared axes — the flex grammar, the surface ladder, and the grid auto-fit.'
list.append(more)

content.append(shape, list)
