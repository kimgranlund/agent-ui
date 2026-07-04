// site/pages/text-doc.ts — the ui-text API doc page (T4, ADR-0078). DERIVED from `text.md` via the shared
// doc-page.ts renderer: the attribute table is built from the parsed `attributes[]` (the three orthogonal
// enums — variant/size/as), the Slots table from the descriptor `slots[]` (the default `text` content slot),
// and the prose from the body — so neither the table nor the examples can drift from the descriptor the
// contract trip-wire enforces (ADR-0004, one parser / two consumers). Two page-local blocks are DERIVED: the
// variant × size matrix iterates the PARSED `variant` enum × the PARSED `size` enum (27 live cells), and the
// `as` stamping row iterates the PARSED `as` enum (minus `none`, which has no stamp to demonstrate) — so a new
// role/size/semantic value in text.md adds its specimen here for free.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import { loadTextDoc } from '../lib/frontmatter.ts'
import { composeDocPage, findAttr, heading, tableHead, tableRow, codeCell } from '../lib/doc-page.ts'
import type { ParsedDescriptor } from '@agent-ui/components/descriptor'

const SPECIMEN_TEXT = 'The five boxing wizards jump quickly'

const { descriptor, body } = loadTextDoc()

const { content } = mountPage({
  title: 'ui-text — API',
  intro:
    'The Display-class text primitive — a non-interactive light-DOM leaf rendering the fleet’s M3-derived type ' +
    'scale (the A2UI v1.0 Text component’s live control). Three orthogonal axes: `variant` (the visual type ' +
    'ROLE), `size` (the row within the role), and `as` (document semantics — the real element it STAMPS around ' +
    'the light-DOM children). Generated from text.md: the attribute table and the two specimen blocks below are ' +
    'descriptor-derived, so they cannot drift from the parsed enums.',
})

composeDocPage(content, descriptor, body, renderSpecimens(descriptor))

// renderSpecimens — both live-specimen blocks, composed in one section so composeDocPage's single specimens
// slot carries them together (the button-doc.ts precedent splits sections via a plain content.append instead;
// here the two ARE the one "Examples" concern, so they nest under a shared heading).
function renderSpecimens(d: ParsedDescriptor): HTMLElement {
  const section = document.createElement('section')
  section.append(heading(2, 'Examples'), renderVariantSizeMatrix(d), renderAsSpecimens(d))
  return section
}

// renderVariantSizeMatrix — the full variant×size matrix (ADR-0078 cl.1's "every 9×3 cell is defined"), one
// table row per PARSED `variant` member, one column per PARSED `size` member — each cell a live <ui-text> at
// that exact pair, so the matrix demonstrates the same 27 distinct cells the browser-truth harness measures.
function renderVariantSizeMatrix(d: ParsedDescriptor): HTMLElement {
  const wrap = document.createElement('div')
  wrap.append(heading(3, 'Variants × sizes'))

  const variants = findAttr(d, 'variant')?.values ?? []
  const sizes = findAttr(d, 'size')?.values ?? []

  const table = document.createElement('table')
  table.append(tableHead('Variant', ...sizes))
  const tbody = document.createElement('tbody')
  for (const v of variants) {
    const cells = sizes.map((s) => {
      const td = document.createElement('td')
      td.append(specimen({ variant: v, size: s }))
      return td
    })
    tbody.append(tableRow(codeCell(v), ...cells))
  }
  table.append(tbody)
  wrap.append(table)
  return wrap
}

// renderAsSpecimens — one live <ui-text as="…"> specimen per non-`none` PARSED `as` enum member. Every
// specimen renders IDENTICALLY (default variant/size) — the stamp is visually transparent by design (cl.4's
// "zero geometry delta") — so the caption is where the semantic difference actually shows: the wire attribute
// alongside the real tag it stamps.
function renderAsSpecimens(d: ParsedDescriptor): HTMLElement {
  const wrap = document.createElement('div')
  const intro = document.createElement('p')
  intro.textContent =
    'Same visual treatment (default variant/size) — only the semantic element wrapping the text differs.'
  wrap.append(heading(3, '`as` — semantic stamping'), intro)

  const column = document.createElement('div')
  column.style.cssText = 'display:flex; flex-direction:column; gap:0.5rem; align-items:flex-start; margin:0.5rem 0 1.5rem;'
  const as = findAttr(d, 'as')
  for (const tag of (as?.values ?? []).filter((v) => v !== 'none')) {
    const figure = document.createElement('figure')
    figure.style.cssText = 'display:flex; flex-direction:row; gap:0.75rem; align-items:baseline; margin:0;'
    const caption = document.createElement('figcaption')
    const code = document.createElement('code')
    code.textContent = `as="${tag}" → <${tag}>`
    caption.append(code)
    figure.append(specimen({ as: tag }), caption)
    column.append(figure)
  }
  wrap.append(column)
  return wrap
}

// specimen — a live <ui-text> with the given axis attributes set, filled with the shared specimen text.
function specimen(attrs: Record<string, string>): HTMLElement {
  const el = document.createElement('ui-text')
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value)
  el.textContent = SPECIMEN_TEXT
  return el
}
