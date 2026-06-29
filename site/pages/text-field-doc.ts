// site/pages/text-field-doc.ts — the ui-text-field API doc page (T4). DERIVED from `text-field.md`: the API
// table is built row-by-row from the canonical parser's `attributes[]`, and the live size/state specimens
// iterate the parsed enum / the real boolean attributes — so neither the table nor the examples can drift from
// the descriptor the contract trip-wire enforces (ADR-0004, one parser / two consumers). The generic table +
// body renderers are the SHARED lib/doc-page.ts (same renderer as button-doc.ts); only the text-field-specific
// specimens + the Slots/anatomy section live here. The anatomy specimens are the one hand-authored block: the
// leading/trailing adornment POSITIONS (slot=leading/trailing × data-role=icon) are markup SHAPES, not
// attributes, so they are authored here rather than derived from the parse.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import { loadTextFieldDoc } from '../lib/frontmatter.ts'
import { findAttr, heading, renderApiTable, renderMarkdownBody, specimenRow } from '../lib/doc-page.ts'
import { applyDemoWidth, searchIcon } from '../lib/specimens.ts'
import type { ParsedDescriptor } from '@agent-ui/components/descriptor'

const SPECIMEN_WIDTH = '16rem' // the page-supplied display width (the ADR-0021 width rationale lives in applyDemoWidth)

const { descriptor, body } = loadTextFieldDoc()

const { content } = mountPage({
  title: 'ui-text-field — API',
  intro: 'The first FACE form-associated control. This page is generated from text-field.md: the API table and ' +
    'the size specimens are derived from the same frontmatter the contract trip-wire validates, so they cannot ' +
    'drift; the States examples and the anatomy shapes are hand-authored.',
})

content.append(renderApiTable(descriptor.attributes), renderExamples(descriptor), renderAnatomy(), renderMarkdownBody(body))

// ── live specimens (derived from the parsed enum + the real boolean attributes) ─────────────────────────────

// renderExamples — working <ui-text-field> specimens. The Sizes row iterates the PARSED `size` enum members,
// so adding a step to text-field.md adds a specimen here for free. The States row stages the real boolean
// attributes (readonly · disabled · required) plus a filled vs empty field — each honestly labelled.
function renderExamples(d: ParsedDescriptor): HTMLElement {
  const section = document.createElement('section')
  section.append(heading(2, 'Examples'))

  const size = findAttr(d, 'size')
  if (size?.values) {
    section.append(
      heading(3, 'Sizes'),
      specimenRow(size.values.map((s) => field({ size: s, label: s, placeholder: `size = ${s}` }))),
    )
  }

  section.append(
    heading(3, 'States'),
    specimenRow([
      field({ label: 'Empty', placeholder: 'Placeholder shows when empty' }),
      field({ label: 'Filled', value: 'A typed value' }),
      field({ label: 'Read only', value: 'Fixed value', readonly: '' }),
      field({ label: 'Disabled', value: 'Inert', disabled: '' }),
      field({ label: 'Required', placeholder: 'required (empty)', required: '' }),
    ]),
  )
  return section
}

// field — a live specimen: a real <ui-text-field> with the given attributes set. The label becomes the editor's
// aria-label (the labelling seam); applyDemoWidth supplies the display width (the ADR-0021 width rationale lives there).
function field(attrs: Record<string, string>): HTMLElement {
  const el = document.createElement('ui-text-field')
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value)
  applyDemoWidth(el, SPECIMEN_WIDTH)
  return el
}

// ── anatomy specimens (hand-authored: the leading/trailing adornment POSITIONS, anatomy.md / ADR-0006/0012) ──

// One anatomy specimen: a caption + which adornment POSITIONS carry a (decorative) icon. These are markup
// SHAPES (slot = leading/trailing × data-role = icon), not attributes, so they are hand-authored rather than
// derived from the parse. The editor is the centre value cell (a control PART, not a user slot); the optional
// leading/trailing icon cells flank it (presence-driven host-as-grid).
interface AnatomyShape {
  readonly caption: string
  readonly leading?: boolean
  readonly trailing?: boolean
}

function renderAnatomy(): HTMLElement {
  const shapes: readonly AnatomyShape[] = [
    { caption: '[ editor ]' },
    { caption: '[ icon | editor ]', leading: true },
    { caption: '[ editor | icon ]', trailing: true },
    { caption: '[ icon | editor | icon ]', leading: true, trailing: true },
  ]
  const section = document.createElement('section')
  section.append(
    heading(2, 'Anatomy — optional [ leading | editor | trailing ] adornments'),
    specimenRow(shapes.map(anatomySpecimen)),
  )
  return section
}

// anatomySpecimen — one captioned figure: the live field above its structure notation (the page ships no
// stylesheet, so the figure carries inline layout). The editor part is control-injected; the leading/trailing
// icons are light-DOM children carrying the canonical slot POSITION + data-role="icon" CONTENT role.
function anatomySpecimen(shape: AnatomyShape): HTMLElement {
  const figure = document.createElement('figure')
  figure.style.cssText = 'display:flex; flex-direction:column; align-items:flex-start; gap:0.5rem; margin:0;'
  const el = document.createElement('ui-text-field')
  el.setAttribute('label', shape.caption)
  el.setAttribute('placeholder', 'Search…')
  applyDemoWidth(el, SPECIMEN_WIDTH)
  if (shape.leading) el.append(searchIcon('leading'))
  if (shape.trailing) el.append(searchIcon('trailing'))
  const caption = document.createElement('figcaption')
  const code = document.createElement('code')
  code.textContent = shape.caption
  caption.append(code)
  figure.append(el, caption)
  return figure
}
