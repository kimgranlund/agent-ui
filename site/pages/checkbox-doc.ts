// site/pages/checkbox-doc.ts — the ui-checkbox API doc page (T4). DERIVED from `checkbox.md`: the API table is
// built row-by-row from the canonical parser's `attributes[]`, and the live size/state specimens iterate the
// parsed `size` enum + the real boolean attributes — so neither the table nor the examples can drift from the
// descriptor the contract trip-wire enforces (ADR-0004, one parser / two consumers). The generic table + body
// renderers are the SHARED lib/doc-page.ts (same renderer as button-doc.ts); only the checkbox-specific
// specimens live here. The Indicator widget box + glyph paint in CSS, so the specimens carry no markup shapes.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import { loadCheckboxDoc } from '../lib/frontmatter.ts'
import { findAttr, heading, renderApiTable, renderMarkdownBody, specimenRow } from '../lib/doc-page.ts'
import type { ParsedDescriptor } from '@agent-ui/components/descriptor'

const { descriptor, body } = loadCheckboxDoc()

const { content } = mountPage({
  title: 'ui-checkbox — API',
  intro: 'A FACE form-associated Indicator-class control with a tri-state checked/indeterminate value. This page ' +
    'is generated from checkbox.md: the API table and the size specimens are derived from the same frontmatter ' +
    'the contract trip-wire validates, so they cannot drift; the States examples are hand-staged.',
})

content.append(renderApiTable(descriptor.attributes), renderExamples(descriptor), renderMarkdownBody(body))

// ── live specimens (derived from the parsed `size` enum + the real boolean attributes) ──────────────────────

// renderExamples — working <ui-checkbox> specimens. The Sizes row iterates the PARSED `size` enum, so adding a
// step to checkbox.md adds a specimen for free. The States row stages the real attributes (checked · disabled ·
// required), and Indeterminate sets the property-only tri-state (NOT an attribute, ADR-0042 IND-C1).
function renderExamples(d: ParsedDescriptor): HTMLElement {
  const section = document.createElement('section')
  section.append(heading(2, 'Examples'))

  const size = findAttr(d, 'size')
  if (size?.values) {
    section.append(
      heading(3, 'Sizes'),
      specimenRow(size.values.map((s) => checkbox({ size: s }, `size = ${s}`))),
    )
  }

  section.append(
    heading(3, 'States'),
    specimenRow([
      checkbox({}, 'Unchecked'),
      checkbox({ checked: '' }, 'Checked'),
      checkbox({ disabled: '' }, 'Disabled'),
      checkbox({ checked: '', disabled: '' }, 'Checked + disabled'),
      checkbox({ required: '' }, 'Required'),
    ]),
  )

  // indeterminate is property-only (never an attribute) — set it on the live element (property-wins on upgrade).
  const tri = checkbox({}, 'Indeterminate')
  ;(tri as HTMLElement & { indeterminate: boolean }).indeterminate = true
  section.append(heading(3, 'Indeterminate (property)'), specimenRow([tri]))

  return section
}

// checkbox — a live specimen: a real <ui-checkbox> with the given attributes set; the label is the default-slot
// text (the accessible name). The widget box + checkmark/dash glyph are painted by checkbox.css.
function checkbox(attrs: Record<string, string>, label: string): HTMLElement {
  const el = document.createElement('ui-checkbox')
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value)
  el.textContent = label
  return el
}
