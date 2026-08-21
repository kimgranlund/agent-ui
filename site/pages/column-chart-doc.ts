// site/pages/column-chart-doc.ts — the ui-column-chart API doc page (tier=display ⇒ {doc} only,
// ADR-0228/ADR-0229). DERIVED from `column-chart.md` via the shared doc-page.ts renderer: the attribute
// table is built from the parsed `attributes[]`, the parts[] surface renders as the descriptor-derived
// Parts table (plot/grid-line/now-dot/now-tick/columns/category/segment/chrome/tick-label/
// category-label/callout), and the prose from the body — so neither the tables nor the body can drift
// from the descriptor the contract trip-wire enforces (ADR-0004, one parser / two consumers). This
// control declares no properties/events/slots, so those tables are omitted. The specimen DATA is
// hand-authored (a doc page has no source to derive representative data from) — a revenue-by-month
// series, the shape GH #1561's own Figma boards show.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import { loadColumnChartDoc } from '../lib/frontmatter.ts'
import { composeDocPage, heading } from '../lib/doc-page.ts'

// A believable revenue-by-month split across two product lines — a real dataset with a genuine shape
// (a seasonal ramp), directly comparable across the strips below. HAND-AUTHORED: a doc page has no
// descriptor source for example content.
const REVENUE_BY_MONTH = [
  { label: 'Mar', values: [18, 6] },
  { label: 'Apr', values: [21, 7] },
  { label: 'May', values: [19, 8] },
  { label: 'Jun', values: [24, 9] },
  { label: 'Jul', values: [27, 10] },
  { label: 'Aug', values: [23, 8] },
] as const
const SERIES = ['Product', 'Services'] as const

const SHOWCASE_BOX = 'inline-size:24rem; block-size:14rem;'

const { descriptor, body } = loadColumnChartDoc()

const { content } = mountPage({
  title: 'ui-column-chart — API',
  intro:
    'The Display-class axis-bearing stacked column chart (ADR-0228/ADR-0229) — a category-major ' +
    'stacked (or dense single-series) column mark consuming the shared axis/inset/series vocabulary: ' +
    'nice-number gridlines, real-DOM tick/category-label pills, a projected/ghost trailing column, a ' +
    'now-marker, and a static highlight callout. Non-interactive, non-form-associated: no hover, no ' +
    'keyboard contract, no events. Generated from column-chart.md: the attribute and parts tables are ' +
    'descriptor-derived (they cannot drift).',
})

composeDocPage(content, descriptor, body, renderSpecimens())

// renderSpecimens — the live-mark section: the stacked-series strip, the projected/now-marker strip, the
// highlight-callout strip, and a degenerate strip, under one "Examples" heading.
function renderSpecimens(): HTMLElement {
  const section = document.createElement('section')
  section.append(
    heading(2, 'Examples'),
    renderStackedStrip(),
    renderProjectedStrip(),
    renderHighlightStrip(),
    renderDegenerateStrip(),
  )
  return section
}

function renderStackedStrip(): HTMLElement {
  const wrap = document.createElement('div')
  const intro = document.createElement('p')
  intro.textContent =
    'The same revenue-by-month data as a dense single-series run (values.length === 1) versus a ' +
    'two-series stack — one schema, no fork.'
  wrap.append(heading(3, 'Dense single-series vs. stacked'), intro)

  const single = REVENUE_BY_MONTH.map((r) => ({ label: r.label, values: [r.values[0] + r.values[1]] }))
  const row = specimenFlexRow()
  row.append(
    labelled('single-series (dense run)', columnChart({ data: single, label: 'Total revenue by month' })),
    labelled('series=["Product","Services"] (stacked)', columnChart({ data: [...REVENUE_BY_MONTH], series: [...SERIES], label: 'Revenue by month' })),
  )
  wrap.append(row)
  return wrap
}

function renderProjectedStrip(): HTMLElement {
  const wrap = document.createElement('div')
  const intro = document.createElement('p')
  intro.textContent =
    'The trailing month rendered as a hollow, dashed-outline ghost (projected="1") plus the now-marker ' +
    '— a baseline dot and a SHORT tick, never a full-height rule (ADR-0228 cl.4).'
  wrap.append(heading(3, 'Projected + now-marker'), intro)

  const row = specimenFlexRow()
  row.append(labelled('projected="1"', columnChart({ data: [...REVENUE_BY_MONTH], series: [...SERIES], projected: 1, label: 'Revenue by month' })))
  wrap.append(row)
  return wrap
}

function renderHighlightStrip(): HTMLElement {
  const wrap = document.createElement('div')
  const intro = document.createElement('p')
  intro.textContent =
    'A static, data-driven callout — no hover, no focus, no keyboard — at the row `highlight` names ' +
    '(ADR-0228 cl.5).'
  wrap.append(heading(3, 'The highlight callout'), intro)

  const row = specimenFlexRow()
  row.append(labelled('highlight="4" (Jul)', columnChart({ data: [...REVENUE_BY_MONTH], series: [...SERIES], highlight: 4, label: 'Revenue by month' })))
  wrap.append(row)
  return wrap
}

function renderDegenerateStrip(): HTMLElement {
  const wrap = document.createElement('div')
  const intro = document.createElement('p')
  intro.textContent = 'Every degenerate input still paints the box and still announces — it never throws.'
  wrap.append(heading(3, 'Degenerate data'), intro)

  const row = specimenFlexRow()
  row.append(
    labelled('empty → an empty host, "no data"', columnChart({ data: [], label: 'Empty dataset' })),
    labelled('one category → one column', columnChart({ data: [{ label: 'Solo', values: [7] }], label: 'Single category' })),
    labelled('a negative value drops the WHOLE row', columnChart({ data: [{ label: 'ok', values: [10] }, { label: 'neg', values: [3, -2] }], label: 'Hardened input' })),
  )
  wrap.append(row)
  return wrap
}

// columnChart — a live <ui-column-chart> in the showcase box. `data`/`series` are the JSON-string
// attribute form (column-chart.md — the safe codec round-trips them).
function columnChart(opts: {
  data?: readonly { label: string; values: readonly number[] }[]
  series?: readonly string[]
  projected?: number
  highlight?: number
  label?: string
}): HTMLElement {
  const el = document.createElement('ui-column-chart')
  el.setAttribute('data', JSON.stringify(opts.data ?? REVENUE_BY_MONTH))
  if (opts.series) el.setAttribute('series', JSON.stringify(opts.series))
  if (opts.projected !== undefined) el.setAttribute('projected', String(opts.projected))
  if (opts.highlight !== undefined) el.setAttribute('highlight', String(opts.highlight))
  if (opts.label) el.setAttribute('label', opts.label)
  el.setAttribute('style', SHOWCASE_BOX)
  return el
}

// labelled — a captioned figure wrapping one specimen (the code/caption below the mark).
function labelled(caption: string, specimen: HTMLElement): HTMLElement {
  const figure = document.createElement('figure')
  figure.style.cssText = 'display:flex; flex-direction:column; gap:0.4rem; align-items:flex-start; margin:0;'
  const cap = document.createElement('figcaption')
  cap.style.fontSize = '0.8rem'
  const code = document.createElement('code')
  code.textContent = caption
  cap.append(code)
  figure.append(specimen, cap)
  return figure
}

// specimenFlexRow — a wrapping row of specimen figures (a doc page ships no stylesheet of its own).
function specimenFlexRow(): HTMLElement {
  const row = document.createElement('div')
  row.style.cssText = 'display:flex; gap:1.5rem; align-items:flex-end; flex-wrap:wrap; margin:0.5rem 0 1.5rem;'
  return row
}
