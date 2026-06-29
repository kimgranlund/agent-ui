// site/pages/text-doc.ts — the ui-text API doc page (T4, ADR-0025). DERIVED from `text.md` via the shared
// doc-page.ts renderer: the attribute table is built from the parsed `attributes[]` (the single `variant` enum),
// the Slots table from the descriptor `slots[]` (the default `text` content slot), and the prose from the body —
// so neither the table nor the examples can drift from the descriptor the contract trip-wire enforces (ADR-0004,
// one parser / two consumers). The one page-local block is the live variant ramp, and it too is DERIVED: it
// iterates the PARSED `variant` enum members, so adding a level to text.md adds its specimen here for free.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import { loadTextDoc } from '../lib/frontmatter.ts'
import { composeDocPage, findAttr, heading } from '../lib/doc-page.ts'
import type { ParsedDescriptor } from '@agent-ui/components/descriptor'

const { descriptor, body } = loadTextDoc()

const { content } = mountPage({
  title: 'ui-text — API',
  intro:
    'The Display-class text primitive — a non-interactive light-DOM leaf that renders display text at one of ' +
    'seven typographic levels (the A2UI v1.0 Text component’s live control). Generated from text.md: the single ' +
    'variant enum and the content slot are descriptor-derived, so the table cannot drift; the variant ramp below ' +
    'is the live control, iterating the same parsed enum.',
})

// renderVariants — a live <ui-text> specimen per PARSED `variant` member (the type ramp), each captioned with the
// variant it sets. Derived from the descriptor enum: a new level in text.md appears here automatically. The page
// ships no stylesheet, so the column + caption carry inline layout (the doc-page convention).
function renderVariants(d: ParsedDescriptor): HTMLElement {
  const section = document.createElement('section')
  section.append(heading(2, 'Variants'))

  const variant = findAttr(d, 'variant')
  const column = document.createElement('div')
  column.style.cssText = 'display:flex; flex-direction:column; gap:0.85rem; align-items:flex-start; margin:0.5rem 0 1.5rem;'
  for (const v of variant?.values ?? []) {
    const figure = document.createElement('figure')
    figure.style.cssText = 'display:flex; flex-direction:column; gap:0.25rem; align-items:flex-start; margin:0;'
    const specimen = document.createElement('ui-text')
    specimen.setAttribute('variant', v)
    specimen.textContent = 'The five boxing wizards jump quickly'
    const caption = document.createElement('figcaption')
    const code = document.createElement('code')
    code.textContent = `variant="${v}"`
    caption.append(code)
    figure.append(specimen, caption)
    column.append(figure)
  }
  section.append(column)
  return section
}

composeDocPage(content, descriptor, body, renderVariants(descriptor))
