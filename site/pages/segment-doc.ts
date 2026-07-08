// site/pages/segment-doc.ts — the ui-segment API doc page (ADR-0095). DERIVED from `segment.md`: the API
// table is built row-by-row from the canonical parser's `attributes[]`, and the live state specimens iterate
// the parsed real boolean attributes — so neither can drift from the descriptor the contract trip-wire
// enforces (ADR-0004, one parser / two consumers). The generic table + body renderers are the SHARED
// lib/doc-page.ts. A single ui-segment is shown here; its single-selection grouping (and the shared moving
// indicator) is the ui-segmented-control page.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import { loadSegmentDoc } from '../lib/frontmatter.ts'
import { heading, renderApiTable, renderMarkdownBody, specimenRow } from '../lib/doc-page.ts'

const { descriptor, body } = loadSegmentDoc()

const { content } = mountPage({
  title: 'ui-segment — API',
  intro: 'The child leaf of ui-segmented-control (ADR-0095) — a FACE Indicator-class control that extends ' +
    'UIRadioElement with role="radio", adding no new prop or behavior of its own. Its rendered geometry ' +
    '(Control-height, ink, dividers, the moving fill) comes entirely from the HOST ui-segmented-control — ' +
    'see that page for the live shape. This page is generated from segment.md, so the API table cannot drift.',
})

content.append(renderApiTable(descriptor.attributes), renderExamples(), renderMarkdownBody(body))

// ── live specimens — standalone (a bare ui-segment renders no visible affordance of its own) ────────────────

function renderExamples(): HTMLElement {
  const section = document.createElement('section')
  section.append(heading(2, 'Examples (standalone — no host ui-segmented-control)'))

  section.append(
    heading(3, 'States'),
    specimenRow([
      segment({}, 'Unselected'),
      segment({ checked: '' }, 'Selected'),
      segment({ disabled: '' }, 'Disabled'),
      segment({ checked: '', disabled: '' }, 'Selected + disabled'),
    ]),
  )
  return section
}

// segment — a live specimen: a real <ui-segment> with the given attributes set; the label is the
// default-slot text (the accessible name). Standalone (no host), it behaves like a plain checkbox.
function segment(attrs: Record<string, string>, label: string): HTMLElement {
  const el = document.createElement('ui-segment')
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value)
  el.textContent = label
  return el
}
