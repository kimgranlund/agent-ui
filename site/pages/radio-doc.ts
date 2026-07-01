// site/pages/radio-doc.ts — the ui-radio API doc page (T4). DERIVED from `radio.md`: the API table is built
// row-by-row from the canonical parser's `attributes[]`, and the live size/state specimens iterate the parsed
// `size` enum + the real boolean attributes — so neither can drift from the descriptor the contract trip-wire
// enforces (ADR-0004, one parser / two consumers). The generic table + body renderers are the SHARED
// lib/doc-page.ts. A single ui-radio is shown here; its single-selection grouping is the ui-radio-group page.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import { loadRadioDoc } from '../lib/frontmatter.ts'
import { findAttr, heading, renderApiTable, renderMarkdownBody, specimenRow } from '../lib/doc-page.ts'
import type { ParsedDescriptor } from '@agent-ui/components/descriptor'

const { descriptor, body } = loadRadioDoc()

const { content } = mountPage({
  title: 'ui-radio — API',
  intro: 'A FACE Indicator-class control: a dot glyph in a circular widget box (ADR-0041). A radio is a member ' +
    'of a single-selection set — see the ui-radio-group page for the container that owns exclusivity, roving, and ' +
    'the group value. This page is generated from radio.md, so the API table and size specimens cannot drift.',
})

content.append(renderApiTable(descriptor.attributes), renderExamples(descriptor), renderMarkdownBody(body))

// ── live specimens (derived from the parsed `size` enum + the real boolean attributes) ──────────────────────

// renderExamples — working <ui-radio> specimens. Sizes iterate the PARSED `size` enum; States stage
// unchecked/checked/disabled. (Exclusivity is a GROUP behaviour — demonstrated on the ui-radio-group page.)
function renderExamples(d: ParsedDescriptor): HTMLElement {
  const section = document.createElement('section')
  section.append(heading(2, 'Examples'))

  const size = findAttr(d, 'size')
  if (size?.values) {
    section.append(
      heading(3, 'Sizes'),
      specimenRow(size.values.map((s) => radio({ size: s, checked: '' }, `size = ${s}`))),
    )
  }

  section.append(
    heading(3, 'States'),
    specimenRow([
      radio({}, 'Unselected'),
      radio({ checked: '' }, 'Selected'),
      radio({ disabled: '' }, 'Disabled'),
      radio({ checked: '', disabled: '' }, 'Selected + disabled'),
    ]),
  )
  return section
}

// radio — a live specimen: a real <ui-radio> with the given attributes set; the label is the default-slot text
// (the accessible name). The dot glyph in its circular box is painted by radio.css.
function radio(attrs: Record<string, string>, label: string): HTMLElement {
  const el = document.createElement('ui-radio')
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value)
  el.textContent = label
  return el
}
