// site/pages/layout-permutations.ts — the SHARED surface × layout showcase for the layout primitives (the
// tier-level demo the ratified set requires once, not 4 near-identical per-component matrices). It is built
// programmatically: the four primitives iterate membersOfTier('layout') (the descriptor glob — derived), and
// the flex-grammar + surface axes iterate the PARSED enum members from row.md (findAttr → values), so adding a
// value to the descriptor adds its specimen for free and the showcase cannot drift from the contract. All
// geometry/colour/surface comes from each container's own {name}.css — this page only lays out demo boxes.
import { mountPage } from './_page.ts' // MUST be first — pulls the load-bearing foundation CSS + ui-* controls
import './containers.css' // shared demo-content chrome (.demo-box / .demo-grid / .demo-figure)
import { loadRowDoc, membersOfTier } from '../lib/frontmatter.ts'
import { findAttr, heading } from '../lib/doc-page.ts'
import { captioned, demoBox, el } from '../lib/specimens.ts'

const rowDoc = loadRowDoc()
// The shared axis arrays — the EXACT parsed enum members from row.md (the flex three share this grammar; the
// surface axes are shared by all four). Derived, never a parallel hand-list.
const aligns = findAttr(rowDoc.descriptor, 'align')?.values ?? []
const justifies = findAttr(rowDoc.descriptor, 'justify')?.values ?? []
const gaps = findAttr(rowDoc.descriptor, 'gap')?.values ?? []
const elevations = findAttr(rowDoc.descriptor, 'elevation')?.values ?? []

const { content } = mountPage({
  title: 'Layout primitives — surface × layout',
  intro: 'The layout primitives under their shared axes: the four side by side, then ui-row\'s flex grammar ' +
    '(align / justify / gap, derived from the parsed row enums), the shared surface elevation ladder, a live ' +
    'container reflow (drag to narrow it and watch ui-row stack), and ui-grid\'s auto-fit. The live containers ' +
    'are the real controls; the boxes are demo content.',
})

// A short + a tall demo box, so a cross-axis [align] value (start/center/end/stretch/baseline) is visible.
function alignPair(): readonly Node[] {
  const tall = demoBox('tall')
  tall.style.minBlockSize = '4rem'
  return [demoBox('short'), tall, demoBox('short')]
}

// ── [1] the four primitives, same content, side by side ─────────────────────────────────────────────────────
const primitives = document.createElement('section')
primitives.append(heading(2, 'The four primitives'))
const primitivesProse = document.createElement('p')
primitivesProse.textContent =
  'The same four boxes in each primitive: ui-row lays them horizontally, ui-column and ui-list stack them ' +
  'vertically (ui-list adds role="list"), and ui-grid flows them into auto-fit tracks. Direction is the tag.'
primitives.append(primitivesProse)
const primitivesGrid = document.createElement('div')
primitivesGrid.className = 'demo-grid'
for (const member of membersOfTier('layout')) {
  const attrs: Record<string, string> = { gap: 'sm' }
  if (member.name === 'grid') attrs.min = '5rem' // a low floor so the tracks read inside the figure
  const live = el(member.tag, attrs, ['A', 'B', 'C', 'D'].map(demoBox))
  primitivesGrid.append(captioned(member.tag, live))
}
primitives.append(primitivesGrid)

// ── [2] flex grammar — align (cross axis), full-width rows so no narrow-container reflow ─────────────────────
const alignSection = document.createElement('section')
alignSection.append(heading(2, 'Flex grammar — align (cross axis → align-items)'))
for (const value of aligns) {
  alignSection.append(captioned(`[align="${value}"]`, el('ui-row', { gap: 'md', align: value }, alignPair())))
}

// ── [3] flex grammar — justify (main-axis distribution) ─────────────────────────────────────────────────────
const justifySection = document.createElement('section')
justifySection.append(heading(2, 'Flex grammar — justify (main axis → justify-content)'))
for (const value of justifies) {
  justifySection.append(captioned(`[justify="${value}"]`, el('ui-row', { gap: 'sm', justify: value }, ['1', '2', '3'].map(demoBox))))
}

// ── [4] flex grammar — gap (the --md-sys-space ladder; rides [density], not [scale]) ────────────────────────────
const gapSection = document.createElement('section')
gapSection.append(heading(2, 'Flex grammar — gap (the --md-sys-space ladder)'))
const gapGrid = document.createElement('div')
gapGrid.className = 'demo-grid'
for (const value of gaps) {
  gapGrid.append(captioned(`[gap="${value}"]`, el('ui-row', { gap: value }, ['A', 'B', 'C'].map(demoBox))))
}
gapSection.append(gapGrid)

// ── [5] surface — elevation ladder (shared by all four; brightness is the tonal sibling) ────────────────────
const surfaceSection = document.createElement('section')
surfaceSection.append(heading(2, 'Surface — elevation (the scheme-inverting plane)'))
const surfaceProse = document.createElement('p')
surfaceProse.textContent =
  'elevation selects the surface plane (the scheme-inverting --md-sys-color-neutral-surface ladder; 0 = the neutral base). ' +
  'brightness is its scheme-consistent tonal sibling. The plane paints once in the shared container.css seam.'
surfaceSection.append(surfaceProse)
const surfaceGrid = document.createElement('div')
surfaceGrid.className = 'demo-grid'
for (const value of elevations) {
  surfaceGrid.append(captioned(`[elevation="${value}"]`, el('ui-row', { elevation: value, gap: 'sm' }, ['A', 'B'].map(demoBox))))
}
surfaceSection.append(surfaceGrid)

// ── [6] container reflow (LIVE) — a ui-row in a user-resizable query container; drag it narrow to watch it stack
// ui-row reflows on its nearest ANCESTOR query container's width (row.css `@container (inline-size < 24rem)`),
// NOT a viewport breakpoint (ADR-0016), while `reflow` stays at its default `auto` (ADR-0096 — unchanged
// behavior for ui-row). The `.reflow-frame` wrapper IS that query container and is `resize: horizontal`, so
// dragging it below 24rem stacks the row to a column live. ui-column's mirror switch (wide→row) is now GATED
// behind `reflow="auto"` and defaults to `locked` (ADR-0096) — it does NOT share this always-on behavior, and
// ui-list never had an @container rule at all (it is a plain `UIContainerElement`, not a `ui-column` subclass).
const reflowSection = document.createElement('section')
reflowSection.append(heading(2, 'Container reflow (live) — drag the frame narrow'))
const reflowProse = document.createElement('p')
reflowProse.textContent =
  'ui-row reflows on its nearest ancestor query container, not the viewport (no breakpoint prop) — its reflow ' +
  'prop defaults to "auto". Drag the frame\'s bottom-right handle to narrow it — under 24rem the row stacks to ' +
  'a column, then springs back when widened. ui-column\'s mirror switch is opt-in (reflow="auto"; it defaults ' +
  'to "locked") and ui-list has no @container rule at all — this live @container responsiveness is ui-row-only.'
reflowSection.append(reflowProse)
const reflowFrame = document.createElement('div')
reflowFrame.className = 'reflow-frame'
reflowFrame.append(el('ui-row', { gap: 'md', align: 'center' }, ['Alpha', 'Beta', 'Gamma', 'Delta'].map(demoBox)))
reflowSection.append(reflowFrame)

// ── [7] grid auto-fit / min — the track floor sets how many columns pack ────────────────────────────────────
const gridSection = document.createElement('section')
gridSection.append(heading(2, 'Grid — auto-fit / min (the track floor)'))
const gridProse = document.createElement('p')
gridProse.textContent =
  'ui-grid packs as many minmax(min, 1fr) tracks as its own width fits, then flexes each. A lower min floor ' +
  'packs more columns; resize the window to watch the track count change (no breakpoint prop).'
gridSection.append(gridProse)
for (const min of ['6rem', '12rem']) {
  gridSection.append(captioned(`[min="${min}"]`, el('ui-grid', { gap: 'md', min }, [1, 2, 3, 4, 5, 6, 7, 8].map((n) => demoBox(`Cell ${n}`)))))
}

content.append(primitives, alignSection, justifySection, gapSection, surfaceSection, reflowSection, gridSection)
