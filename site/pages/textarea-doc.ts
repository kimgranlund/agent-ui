// site/pages/textarea-doc.ts — the ui-textarea API doc page (ADR-0134). DERIVED from `textarea.md` via the
// shared doc-page.ts renderer (composeDocPage threads the attribute/properties/events/parts tables through
// for free — including the Parts section the site-coverage parts-render gate requires). Only the live
// specimens are hand-authored here.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import { loadTextareaDoc } from '../lib/frontmatter.ts'
import { composeDocPage, findAttr, heading, renderChangelogTable, specimenRow } from '../lib/doc-page.ts'
import { applyDemoWidth } from '../lib/specimens.ts'
import type { ParsedDescriptor } from '@agent-ui/components/descriptor'

const { descriptor, body } = loadTextareaDoc()

const { content } = mountPage({
  title: 'ui-textarea — API',
  intro: 'The fleet\'s first FACE multi-line text primitive — a sibling of ui-text-field, not one ' +
    'of its modes. This page is generated from textarea.md: the API table and the size specimens are derived ' +
    'from the same frontmatter the contract trip-wire validates, so they cannot drift; see the Permutations ' +
    'and States pages for the full size/rows matrix and the live interaction states.',
})

composeDocPage(content, descriptor, body, renderExamples(descriptor))

// Provenance (TKT-0054): the decision record this page's intro previously cited inline now lives here only —
// HAND-AUTHORED, not derivable from any canonical index (no ADR/TKT index cross-links to the pages it built).
const changelog = renderChangelogTable([
  { date: '2026-07-14', type: 'Decision', id: 'ADR-0134', summary: 'Shipped ui-textarea: a new FACE multi-line text primitive, a sibling of ui-text-field, not one of its modes.' },
])
if (changelog) content.append(changelog)

// ── live specimens (derived from the parsed `size` enum + the real boolean attributes) ──────────────────────

function renderExamples(d: ParsedDescriptor): HTMLElement {
  const section = document.createElement('section')
  section.append(heading(2, 'Examples'))

  const size = findAttr(d, 'size')
  if (size?.values) {
    section.append(
      heading(3, 'Sizes'),
      specimenRow(size.values.map((s) => textarea({ label: `size = ${s}`, size: s, value: 'Multi-line prose wraps and grows past the rows minimum.' }))),
    )
  }

  section.append(
    heading(3, 'States'),
    specimenRow([
      textarea({ label: 'Empty', placeholder: 'Write something…' }),
      textarea({ label: 'Rows = 6', rows: '6', value: 'A taller minimum — rows sets a MIN height, not a fixed one.' }),
      textarea({ label: 'Required', required: true }),
      textarea({ label: 'Read only', value: 'Select me, but you cannot edit', readonly: true }),
      textarea({ label: 'Disabled', value: 'Inert', disabled: true }),
    ]),
  )

  return section
}

interface TextareaSpec {
  readonly label: string
  readonly value?: string
  readonly placeholder?: string
  readonly size?: string
  readonly rows?: string
  readonly required?: boolean
  readonly readonly?: boolean
  readonly disabled?: boolean
}

function textarea(spec: TextareaSpec): HTMLElement {
  const el = document.createElement('ui-textarea')
  el.setAttribute('label', spec.label)
  if (spec.value !== undefined) el.setAttribute('value', spec.value)
  if (spec.placeholder !== undefined) el.setAttribute('placeholder', spec.placeholder)
  if (spec.size) el.setAttribute('size', spec.size)
  if (spec.rows) el.setAttribute('rows', spec.rows)
  if (spec.required) el.setAttribute('required', '')
  if (spec.readonly) el.setAttribute('readonly', '')
  if (spec.disabled) el.setAttribute('disabled', '')
  applyDemoWidth(el, '16rem')
  return el
}
