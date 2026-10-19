// site/pages/glyph-doc.ts: the ui-glyph API doc page (tier=display => {doc} only, ADR-0245 clauses 4 and 5).
// Derived from `glyph.md` through the shared doc-page.ts renderer, so the API table cannot drift from the
// descriptor the contract trip-wire enforces (ADR-0004). The one page-local block iterates the real
// GLYPH_SYMBOLS set, once enlarged through the host's own slot override and once per size inside the library
// root register (`data-tier="product" data-scale="md"`), so a mark added to the path table appears here for
// free, then sets an icon beside a glyph in large text: the icon follows the text, the glyph keeps its glyph
// box (ADR-0245 Amendment 6).
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import { loadGlyphDoc } from '../lib/frontmatter.ts'
import { composeDocPage, heading, specimenRow } from '../lib/doc-page.ts'
import { GLYPH_SYMBOLS } from '@agent-ui/components/controls/glyph'

const { descriptor, body } = loadGlyphDoc()

const { content } = mountPage({
  title: 'ui-glyph: API',
  intro:
    'The functional-mark display atom (ADR-0245): one of twelve marks drawn from the library path table in its ' +
    'own glyph box, the sibling of ui-icon. Generated from glyph.md: the API table is descriptor-derived; the ' +
    'marks below are live.',
})

composeDocPage(content, descriptor, body, renderMarks())

function figureFor(symbol: string, slot?: string): HTMLElement {
  const figure = document.createElement('figure')
  figure.style.cssText = 'display:flex; flex-direction:column; gap:0.35rem; align-items:center; margin:0;'
  const glyph = document.createElement('ui-glyph')
  glyph.setAttribute('symbol', symbol)
  if (slot) {
    // the documented per-mark override: the inset follows the slot (T-0374), so the enlarged mark sets it too
    glyph.style.setProperty('--ui-glyph-slot', slot)
    glyph.style.setProperty('--ui-glyph-inset', `calc(${slot} / 8)`)
  }
  const caption = document.createElement('figcaption')
  caption.style.fontSize = '0.75rem'
  const code = document.createElement('code')
  code.textContent = symbol
  caption.append(code)
  figure.append(glyph, caption)
  return figure
}

function renderMarks(): HTMLElement {
  const section = document.createElement('section')
  const enlarged = specimenRow(GLYPH_SYMBOLS.map((symbol) => figureFor(symbol, '1.5rem')))
  section.append(heading(2, 'The twelve marks'), enlarged, heading(3, 'At the library root, sizes sm, md and lg'))
  const region = document.createElement('div')
  region.setAttribute('data-tier', 'product')
  region.setAttribute('data-scale', 'md')
  for (const size of ['sm', 'md', 'lg']) {
    const row = specimenRow(GLYPH_SYMBOLS.map((symbol) => figureFor(symbol)))
    row.setAttribute('data-size', size)
    region.append(row)
  }
  section.append(region, heading(3, 'An icon follows the text, a glyph keeps its box'), iconBesideGlyph())
  return section
}

/** One line of large text with an icon and a glyph in it: the icon grows to 1em, the glyph stays n + 6 in its 3n slot. */
function iconBesideGlyph(): HTMLElement {
  const line = document.createElement('p')
  line.style.cssText = 'display:flex; align-items:center; gap:0.5rem; font-size:1.5rem; margin:0;'
  const icon = document.createElement('ui-icon')
  icon.setAttribute('symbol', 'calendar-check')
  const glyph = document.createElement('ui-glyph')
  glyph.setAttribute('symbol', 'plus')
  line.append(icon, document.createTextNode('Add a date'), glyph)
  return line
}
