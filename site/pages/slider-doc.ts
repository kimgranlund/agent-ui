// site/pages/slider-doc.ts — the ui-slider API doc page (T4). DERIVED from `slider.md`: the API table is
// built row-by-row from the canonical parser's `attributes[]`, and the live size/state specimens iterate the
// parsed `size` enum + the real boolean attributes — so neither can drift from the descriptor the contract
// trip-wire enforces (ADR-0004, one parser / two consumers). The generic table + body renderers are the SHARED
// lib/doc-page.ts; only the slider-specific specimens live here. Rail + thumb paint in CSS (slider.css).
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import { loadSliderDoc } from '../lib/frontmatter.ts'
import { findAttr, heading, renderApiTable, renderMarkdownBody, specimenRow } from '../lib/doc-page.ts'
import type { ParsedDescriptor } from '@agent-ui/components/descriptor'

const { descriptor, body } = loadSliderDoc()

const { content } = mountPage({
  title: 'ui-slider — API',
  intro:
    'A FACE form-associated Indicator-class Range control (extends UIRangeElement) with a rail (fill gradient) ' +
    'and a 2px-inset thumb (ADR-0041). Value is clamped to [min, max] snapped to step; pointer drag and keyboard ' +
    'navigation update it live. This page is generated from slider.md — the API table and specimens are derived ' +
    'from the same frontmatter the contract trip-wire validates, so they cannot drift.',
})

content.append(renderApiTable(descriptor.attributes), renderExamples(descriptor), renderMarkdownBody(body))

// ── live specimens (derived from the parsed `size` enum + the real boolean attributes) ──────────────────────

// renderExamples — working <ui-slider> specimens. The Sizes row iterates the PARSED `size` enum; the States
// row stages disabled + an explicit midpoint value. Each slider uses aria-label for an accessible name.
function renderExamples(d: ParsedDescriptor): HTMLElement {
  const section = document.createElement('section')
  section.append(heading(2, 'Examples'))

  const size = findAttr(d, 'size')
  if (size?.values) {
    section.append(
      heading(3, 'Sizes'),
      specimenRow(size.values.map((s) => slider({ size: s, value: '50', 'aria-label': `size = ${s}` })),
      ),
    )
  }

  section.append(
    heading(3, 'States'),
    specimenRow([
      slider({ value: '0', 'aria-label': 'Value 0 (min)' }),
      slider({ value: '50', 'aria-label': 'Value 50 (mid)' }),
      slider({ value: '100', 'aria-label': 'Value 100 (max)' }),
      slider({ value: '50', disabled: '', 'aria-label': 'Disabled' }),
    ]),
  )
  return section
}

// slider — a live specimen: a real <ui-slider> with the given attributes set.
// The rail (gradient fill) + thumb (box − 4px, ADR-0041 cl.3) paint via slider.css.
function slider(attrs: Record<string, string>, _label?: string): HTMLElement {
  const el = document.createElement('ui-slider')
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value)
  return el
}
