// site/pages/stat-doc.ts — the ui-stat API doc page (tier=display ⇒ {doc} only, ADR-0111 /
// report-family.lld.md LLD-C11). DERIVED from `stat.md` via the shared doc-page.ts renderer: the attribute
// table is built from the parsed `attributes[]`, the parts[] surface renders as the descriptor-derived Parts
// table (label/value/delta/delta-glyph/delta-word/caption), and the prose from the body — so neither can drift
// from the descriptor the contract trip-wire enforces (ADR-0004). The specimen DATA are hand-authored (a doc
// page has no source to derive representative data from) — an up/down/flat strip, the canonical delta-direction
// job (SPEC-R7/R9), plus a no-delta/no-caption minimal tile.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import { loadStatDoc } from '../lib/frontmatter.ts'
import { composeDocPage, heading } from '../lib/doc-page.ts'

interface StatSpecimen {
  readonly label: string
  readonly value: string
  readonly delta?: number
  readonly caption?: string
}

// Up / down / flat — the three delta directions (SPEC-R9), plus a minimal tile with neither delta nor caption.
// HAND-AUTHORED: a doc page has no descriptor source for example content.
const STATS: readonly StatSpecimen[] = [
  { label: 'Revenue', value: '48200', delta: 12, caption: 'vs last month' },
  { label: 'Churn', value: '2.4%', delta: -0.6, caption: 'vs last month' },
  { label: 'Uptime', value: '99.98%', delta: 0, caption: 'vs last 30 days' },
  { label: 'Active users', value: '1284' },
]

const { descriptor, body } = loadStatDoc()

const { content } = mountPage({
  title: 'ui-stat — API',
  intro:
    'The Display-class metric tile (ADR-0111, report family v1) — label + value + optional delta + optional ' +
    'caption as real, selectable DOM text. Not interactive, not form-associated: no events, no keyboard ' +
    'contract, no [size]/[scale] control geometry. Generated from stat.md: the attribute and parts tables are ' +
    'descriptor-derived; the strip below shows the three delta directions plus a minimal tile.',
})

composeDocPage(content, descriptor, body, renderSpecimens())

function renderSpecimens(): HTMLElement {
  const section = document.createElement('section')
  section.append(heading(2, 'Examples'), heading(3, 'Up / down / flat / minimal'))
  const desc = document.createElement('p')
  desc.textContent =
    'delta renders a component-drawn direction glyph + the signed number; direction is not goodness — the ' +
    'ink never varies by direction (up/down/flat share one colour). The last tile carries no delta and no ' +
    'caption, both optional.'
  const row = document.createElement('div')
  row.style.cssText = 'display:flex; gap:1.25rem; flex-wrap:wrap; margin:0.5rem 0 1.75rem;'
  for (const stat of STATS) row.append(statSpecimen(stat))
  section.append(desc, row)
  return section
}

function statSpecimen(stat: StatSpecimen): HTMLElement {
  const el = document.createElement('ui-stat')
  el.setAttribute('label', stat.label)
  el.setAttribute('figure', stat.value)
  if (stat.delta !== undefined) el.setAttribute('delta', String(stat.delta))
  if (stat.caption !== undefined) el.setAttribute('caption', stat.caption)
  return el
}
