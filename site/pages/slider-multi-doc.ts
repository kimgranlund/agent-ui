// site/pages/slider-multi-doc.ts — the ui-slider-multi API doc page (T4). DERIVED from `slider-multi.md`:
// the API table is built row-by-row from the canonical parser's `attributes[]`, and the live size/state
// specimens iterate the parsed `size` enum + the real boolean attributes — so neither can drift from the
// descriptor the contract trip-wire enforces (ADR-0004, one parser / two consumers). The generic table +
// body renderers are the SHARED lib/doc-page.ts; only the slider-multi-specific specimens live here.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import { loadSliderMultiDoc } from '../lib/frontmatter.ts'
import { findAttr, heading, renderApiTable, renderMarkdownBody, specimenRow } from '../lib/doc-page.ts'
import type { ParsedDescriptor } from '@agent-ui/components/descriptor'

const { descriptor, body } = loadSliderMultiDoc()

const { content } = mountPage({
  title: 'ui-slider-multi — API',
  intro:
    'A FACE form-associated Range-class control (extends UIRangeElement) with dual thumbs (lo/hi) defining a ' +
    'value range within [min, max] snapped to step. Both thumbs drive independent pointer drag and keyboard ' +
    'navigation. This page is generated from slider-multi.md — the API table and specimens are derived from ' +
    'the same frontmatter the contract trip-wire validates, so they cannot drift.',
})

content.append(renderApiTable(descriptor.attributes), renderExamples(descriptor), renderMarkdownBody(body))

// ── live specimens (derived from the parsed `size` enum + the real boolean attributes) ──────────────────────

// renderExamples — working <ui-slider-multi> specimens. The Sizes row iterates the PARSED `size` enum;
// the States row stages disabled + various lo/hi combos. Each uses aria-label for an accessible name.
function renderExamples(d: ParsedDescriptor): HTMLElement {
  const section = document.createElement('section')
  section.append(heading(2, 'Examples'))

  const size = findAttr(d, 'size')
  if (size?.values) {
    section.append(
      heading(3, 'Sizes'),
      specimenRow(size.values.map((s) => sliderMulti({ size: s, 'value-lo': '20', 'value-hi': '80', 'aria-label': `size = ${s}` })),
      ),
    )
  }

  section.append(
    heading(3, 'States'),
    specimenRow([
      sliderMulti({ 'value-lo': '0', 'value-hi': '100', 'aria-label': 'Full range' }),
      sliderMulti({ 'value-lo': '25', 'value-hi': '75', 'aria-label': 'Quarter inset' }),
      sliderMulti({ 'value-lo': '50', 'value-hi': '50', 'aria-label': 'Collapsed (lo = hi)' }),
      sliderMulti({ 'value-lo': '25', 'value-hi': '75', disabled: '', 'aria-label': 'Disabled' }),
    ]),
  )
  return section
}

// sliderMulti — a live specimen: a real <ui-slider-multi> with the given attributes set.
function sliderMulti(attrs: Record<string, string>): HTMLElement {
  const el = document.createElement('ui-slider-multi')
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value)
  return el
}
