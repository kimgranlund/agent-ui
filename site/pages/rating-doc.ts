// site/pages/rating-doc.ts — the ui-rating API doc page (ADR-0216; GH #1395). DERIVED from `rating.md`: the
// API table is built row-by-row from the canonical parser's `attributes[]`, and the live size/state specimens
// iterate the parsed `size` enum + the real boolean attributes — so neither can drift from the descriptor the
// contract trip-wire enforces (ADR-0004, one parser / two consumers). The generic table + body renderers are
// the SHARED lib/doc-page.ts; only the rating-specific specimens live here. The star mark paints in CSS
// (rating.css) — an owned inline-SVG row, no icons-pack dependency (ADR-0216 cl.3).
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import { loadRatingDoc } from '../lib/frontmatter.ts'
import { composeDocPage, findAttr, heading, specimenRow } from '../lib/doc-page.ts'
import type { ParsedDescriptor } from '@agent-ui/components/descriptor'

const { descriptor, body } = loadRatingDoc()

const { content } = mountPage({
  title: 'ui-rating — API',
  intro:
    'A FACE form-associated Indicator-class Range control (extends UIRangeElement) that renders a fraction-' +
    'accurate star row from an owned inline-SVG mark (ADR-0216) — no icons-pack dependency. Serves BOTH display ' +
    '(readonly + a bound/literal value) and input (bound value, keyboard/pointer commit) on the same row. This ' +
    'page is generated from rating.md — the API table and specimens are derived from the same frontmatter the ' +
    'contract trip-wire validates, so they cannot drift.',
})

// rating.md declares a `parts:` entry (label + stars) — composeDocPage is the ONE render path that also
// emits the Parts table (site-coverage.test.ts's standing gate: every parts-bearing descriptor's doc page
// must render one).
composeDocPage(content, descriptor, body, renderExamples(descriptor))

// ── live specimens (derived from the parsed `size` enum + the real boolean attributes) ──────────────────────

// renderExamples — working <ui-rating> specimens. The Sizes row iterates the PARSED `size` enum; the States
// row stages the display idiom (readonly + a bound fraction), disabled, and a bare interactive row.
function renderExamples(d: ParsedDescriptor): HTMLElement {
  const section = document.createElement('section')
  section.append(heading(2, 'Examples'))

  const size = findAttr(d, 'size')
  if (size?.values) {
    section.append(
      heading(3, 'Sizes'),
      specimenRow(
        size.values.map((s) => rating({ size: s, value: '3', max: '5', 'aria-label': `size = ${s}` })),
      ),
    )
  }

  section.append(
    heading(3, 'States'),
    specimenRow([
      rating({ value: '4.3', max: '5', readonly: '', 'aria-label': 'Average rating (readonly, fraction-accurate)' }),
      rating({ value: '0', max: '5', 'aria-label': 'Rate this' }),
      rating({ value: '2', max: '5', step: '0.5', 'aria-label': 'Rate this (halves)' }),
      rating({ value: '3', max: '5', disabled: '', 'aria-label': 'Disabled' }),
    ]),
  )
  return section
}

// rating — a live specimen: a real <ui-rating> with the given attributes set. The two-row star mark
// (low-alpha base + clipped full-ink fill) paints via rating.css.
function rating(attrs: Record<string, string>): HTMLElement {
  const el = document.createElement('ui-rating')
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value)
  return el
}
