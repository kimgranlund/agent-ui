// site/pages/bar-chart-doc.ts — the ui-bar-chart API doc page (tier=display ⇒ {doc} only, ADR-0107 /
// chart-family.lld.md LLD-C9). DERIVED from `bar-chart.md` via the shared doc-page.ts renderer: the attribute
// table is built from the parsed `attributes[]` and the prose from the body (the parts[] surface is documented in
// the body's Rendering/Accessibility prose, not a table — composeDocPage renders no parts table) — so neither the
// table nor the body can drift from the descriptor the contract trip-wire enforces (ADR-0004, one parser / two
// consumers). This control declares no properties/events/slots, so those tables are omitted. The specimen DATA are
// hand-authored (a doc page has no source to derive
// representative data from) — a real region breakdown + a real mixed-sign change series, not lorem stubs, so the
// chart demonstrates its actual "how do these magnitudes compare?" job incl. the diverging zero-baseline model
// (SPEC-R6, SPEC-R9 example bar).
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import { loadBarChartDoc } from '../lib/frontmatter.ts'
import { composeDocPage, heading } from '../lib/doc-page.ts'

interface Datum {
  readonly label: string
  readonly value: number
}

// An all-positive region breakdown — the canonical bar-list job (labels · length-proportional bars · printed
// values), the max spanning the full track (SPEC-R7). HAND-AUTHORED: a doc page has no descriptor source for
// example content (SPEC-R9's example-content bar — never a lorem stub).
const REVENUE_BY_REGION: readonly Datum[] = [
  { label: 'EMEA', value: 42 },
  { label: 'Americas', value: 58 },
  { label: 'APAC', value: 31 },
  { label: 'LATAM', value: 12 },
]

// A mixed-sign quarter-over-quarter change series — the DIVERGING model (SPEC-R6): every bar shares one zero
// origin, positive bars grow toward inline-end, negative bars toward inline-start, so gain/loss reads at a glance
// with the signed printed value as the exact datum.
const QOQ_CHANGE: readonly Datum[] = [
  { label: 'EMEA', value: 8 },
  { label: 'Americas', value: 15 },
  { label: 'APAC', value: -6 },
  { label: 'LATAM', value: -11 },
]

const { descriptor, body } = loadBarChartDoc()

const { content } = mountPage({
  title: 'ui-bar-chart — API',
  intro:
    'The Display-class magnitude-comparison bar list (ADR-0107, chart-family v1) — an axis-free chart answering ' +
    '“how do these magnitudes compare?” with a length-proportional bar list, the printed value as the datum. ' +
    'Non-interactive, non-form-associated: no ticks, no legend, no events. Generated from bar-chart.md: the ' +
    'attribute table is descriptor-derived (it cannot drift; parts are documented in the prose); the live charts below show the ' +
    'all-positive and the mixed-sign diverging models against real data.',
})

composeDocPage(content, descriptor, body, renderSpecimens())

// renderSpecimens — the live-chart section: the canonical all-positive breakdown, the mixed-sign diverging model,
// and a degenerate strip (SPEC-R7 edge cases as visual fixtures), under one "Examples" heading so composeDocPage's
// single specimens slot carries them together (the text-doc.ts precedent).
function renderSpecimens(): HTMLElement {
  const section = document.createElement('section')
  section.append(
    heading(2, 'Examples'),
    labelledChart(
      'Magnitude comparison',
      'All-positive data — the zero baseline sits at the inline-start edge, so every bar measures from there and ' +
        'the max (Americas) spans the full track.',
      REVENUE_BY_REGION,
      'Revenue by region',
    ),
    labelledChart(
      'The diverging model',
      'Mixed-sign data — every bar shares one zero origin; gains grow toward inline-end, losses toward ' +
        'inline-start, the signed printed value carrying the exact reading (SPEC-R6).',
      QOQ_CHANGE,
      'QoQ revenue change by region',
    ),
    renderDegenerate(),
  )
  return section
}

// renderDegenerate — a SPEC-R7 edge case made a live visual fixture: all-zero data renders every bar zero-length
// while the printed `0`s carry the whole reading (the host stays role=list with real listitem rows — an honest
// empty-magnitude state, not a silent one). HAND-AUTHORED fixture from the descriptor's "Degenerate data" prose.
function renderDegenerate(): HTMLElement {
  return labelledChart(
    'Degenerate: all-zero',
    'Every value is zero → every bar is zero-length; the printed `0`s carry the reading and the list still ' +
      'announces its rows (SPEC-R7). Empty/malformed input renders zero rows the same way.',
    [
      { label: 'EMEA', value: 0 },
      { label: 'Americas', value: 0 },
      { label: 'APAC', value: 0 },
    ],
    'Revenue by region (no data yet)',
  )
}

// labelledChart — a titled, described live <ui-bar-chart> specimen. `data` is the JSON-string attribute form
// (bar-chart.md — the safe codec round-trips it); `label` is the accessible name.
function labelledChart(title: string, description: string, data: readonly Datum[], label: string): HTMLElement {
  const wrap = document.createElement('div')
  wrap.style.cssText = 'margin:0.5rem 0 1.75rem;'
  const desc = document.createElement('p')
  desc.textContent = description

  const chart = document.createElement('ui-bar-chart')
  chart.setAttribute('data', JSON.stringify(data))
  chart.setAttribute('label', label)
  chart.setAttribute('style', 'max-inline-size:26rem;') // size it to a reading column (the control owns display:grid; default is a 16em floor)

  wrap.append(heading(3, title), desc, chart)
  return wrap
}
