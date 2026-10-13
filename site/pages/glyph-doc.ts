// site/pages/glyph-doc.ts: the ui-glyph API doc page (tier=display => {doc} only, ADR-0245 clauses 4 and 5).
// Derived from `glyph.md` through the shared doc-page.ts renderer, so the API table cannot drift from the
// descriptor the contract trip-wire enforces (ADR-0004). The one page-local block iterates the real
// GLYPH_SYMBOLS set, once outside any region (the em fallbacks) and once per size inside the library root
// register (`data-tier="product" data-scale="sm"`), so a mark added to the path table appears here for free.
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

function figureFor(symbol: string): HTMLElement {
  const figure = document.createElement('figure')
  figure.style.cssText = 'display:flex; flex-direction:column; gap:0.35rem; align-items:center; margin:0;'
  const glyph = document.createElement('ui-glyph')
  glyph.setAttribute('symbol', symbol)
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
  const outside = document.createElement('div')
  outside.style.fontSize = '1.5rem'
  outside.append(specimenRow(GLYPH_SYMBOLS.map(figureFor)))
  section.append(heading(2, 'The twelve marks'), outside, heading(3, 'At the library root, sizes sm, md and lg'))
  const region = document.createElement('div')
  region.setAttribute('data-tier', 'product')
  region.setAttribute('data-scale', 'sm')
  for (const size of ['sm', 'md', 'lg']) {
    const row = specimenRow(GLYPH_SYMBOLS.map(figureFor))
    row.setAttribute('data-size', size)
    region.append(row)
  }
  section.append(region)
  return section
}
