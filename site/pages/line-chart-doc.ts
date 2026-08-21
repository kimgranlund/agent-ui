// site/pages/line-chart-doc.ts — the ui-line-chart API doc page (tier=display ⇒ {doc} only, ADR-0205,
// EXTENDED by ADR-0229 cl.3). DERIVED from `line-chart.md` via the shared doc-page.ts renderer: the
// attribute table is built from the parsed `attributes[]` (now six: values/label/variant/axes/labels/
// projected), the parts[] surface renders as the descriptor-derived Parts table, and the prose from the
// body — so neither the tables nor the body can drift from the descriptor the contract trip-wire enforces
// (ADR-0004, one parser / two consumers). This control declares no properties/events/slots, so those
// tables are omitted. One page-local block is DERIVED: the variant strip iterates the PARSED `variant`
// enum (line · area). The specimen SERIES are hand-authored (a doc page has no source to derive
// representative data from) — the sparkline-doc.ts precedent's revenue trend, reused here so the two
// chart docs are directly comparable; the axes-state strip uses a real revenue-by-month series (the SAME
// convention `column-chart-doc.ts` established for its own demo, per ADR-0229 cl.3's build wave).
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import { loadLineChartDoc } from '../lib/frontmatter.ts'
import { composeDocPage, findAttr, heading } from '../lib/doc-page.ts'
import type { ParsedDescriptor } from '@agent-ui/components/descriptor'

// The SAME twelve-month revenue trend sparkline-doc.ts uses — a real series with a genuine shape (dip,
// recovery, sustained climb), directly comparable across the two chart docs. HAND-AUTHORED: a doc page has
// no descriptor source for example content.
const REVENUE_TREND = [42, 45, 41, 48, 52, 49, 58, 61, 60, 67, 72, 78] as const

// A series that spans zero — demonstrates the baseline's zero-line branch (ADR-0205 cl.1), contrasted with
// the all-positive REVENUE_TREND above (whose baseline floors at its own minimum).
const NET_CHANGE = [-4, 2, 6, -1, 3, 5, -2, 4] as const

// The SAME revenue-by-month shape `column-chart-doc.ts` shows (a genuine seasonal ramp) — directly
// comparable across the two axis-bearing chart docs; the trailing month is the `projected` demo point.
const REVENUE_BY_MONTH = [18, 21, 19, 24, 27, 23] as const
const MONTH_LABELS = ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'] as const

const SHOWCASE_BOX = 'inline-size:20rem; block-size:8rem;'
const AXES_SHOWCASE_BOX = 'inline-size:24rem; block-size:14rem;'

const { descriptor, body } = loadLineChartDoc()

const { content } = mountPage({
  title: 'ui-line-chart — API',
  intro:
    'The Display-class axis-bearing line/area chart (ADR-0205, Extended by ADR-0229 cl.3). The default ' +
    'state pairs a value-range baseline with always-shown min/max value labels; the opt-in `axes` state ' +
    'swaps those labels for nice-number gridlines, tick/category chips, a gradient area fill, and a ' +
    'provisional/now-marker system for the time axis. Non-interactive, non-form-associated in either ' +
    'state: no legend, no events, single-series only (v1). Generated from line-chart.md: the attribute ' +
    'and parts tables are descriptor-derived (they cannot drift).',
})

composeDocPage(content, descriptor, body, renderSpecimens(descriptor))

// renderSpecimens — the live-mark section: the variant strip (derived from the parsed enum) + the baseline
// strip (all-positive floor vs. spanning-zero) + the axes-state strip (gridlines/chips/gradient/projected)
// + a degenerate strip, under one "Examples" heading.
function renderSpecimens(d: ParsedDescriptor): HTMLElement {
  const section = document.createElement('section')
  section.append(
    heading(2, 'Examples'),
    renderVariantStrip(d),
    renderBaselineStrip(),
    renderAxesStrip(),
    renderDegenerateStrip(),
  )
  return section
}

// renderAxesStrip — the `axes` state (ADR-0229 cl.3): nice-number gridlines + category-label chips from a
// real revenue-by-month series, the gradient area fill, and the projected/now-marker system on the
// trailing month — directly comparable to `ui-column-chart`'s own projected+now-marker demo.
function renderAxesStrip(): HTMLElement {
  const wrap = document.createElement('div')
  const intro = document.createElement('p')
  intro.textContent =
    'The `axes` state swaps the min/max label rows for the shared ADR-0228 tick/gridline/category system ' +
    '— gridlines over the series’ own value range, category chips from `labels` (month names, index-' +
    'aligned to `values`), a gradient area fill, and the trailing month rendered PROJECTED (a dashed ' +
    'stroke + a now-marker at the actual/projected boundary — the same mechanism `ui-column-chart` uses).'
  wrap.append(heading(3, 'The `axes` state'), intro)

  const row = specimenFlexRow()
  row.append(
    labelled('axes, variant="area"', axesLineChart({ projected: 0 })),
    labelled('axes, variant="area", projected="1"', axesLineChart({ projected: 1 })),
  )
  wrap.append(row)
  return wrap
}

// renderVariantStrip — one live <ui-line-chart> per PARSED `variant` enum member, the SAME revenue trend so
// the two variants (a bare stroke vs. the same stroke with a filled area) are directly comparable.
function renderVariantStrip(d: ParsedDescriptor): HTMLElement {
  const wrap = document.createElement('div')
  const intro = document.createElement('p')
  intro.textContent =
    'The same twelve-month revenue trend under each `variant` — the min/max labels are always shown ' +
    '(ADR-0205 cl.3), and the baseline floors at the series minimum (all values are positive here).'
  wrap.append(heading(3, '`variant` — line vs. area'), intro)

  const row = specimenFlexRow()
  for (const variant of findAttr(d, 'variant')?.values ?? []) {
    row.append(labelled(`variant="${variant}"`, lineChart({ variant, label: 'Revenue trend' })))
  }
  wrap.append(row)
  return wrap
}

// renderBaselineStrip — the two baseline branches (ADR-0205 cl.1) as live, side-by-side fixtures: an
// all-positive series (baseline = the value floor) vs. a spanning-zero series (baseline = the zero-line).
function renderBaselineStrip(): HTMLElement {
  const wrap = document.createElement('div')
  const intro = document.createElement('p')
  intro.textContent =
    'The baseline is the zero line when the value range spans zero, else the series’ own value floor — ' +
    'never an assumed zero axis (unlike ui-bar-chart’s always-zero baseline).'
  wrap.append(heading(3, 'The baseline'), intro)

  const row = specimenFlexRow()
  row.append(
    labelled('all-positive → baseline floors at the min', lineChart({ values: [...REVENUE_TREND], label: 'Revenue trend' })),
    labelled('spans zero → baseline is the zero-line', lineChart({ values: [...NET_CHANGE], label: 'Net change' })),
  )
  wrap.append(row)
  return wrap
}

// renderDegenerateStrip — the degenerate cases as live visual fixtures: a single point, an all-equal series,
// and empty input (an empty box that still paints + still announces `no data`).
function renderDegenerateStrip(): HTMLElement {
  const wrap = document.createElement('div')
  const intro = document.createElement('p')
  intro.textContent = 'Every degenerate input still paints the box and still announces — it never throws.'
  wrap.append(heading(3, 'Degenerate data'), intro)

  const cases: readonly { caption: string; values: readonly number[] }[] = [
    { caption: 'one point → a centered dot, baseline coincident', values: [7] },
    { caption: 'all-equal → a flat mid-line, baseline coincident', values: [5, 5, 5, 5, 5] },
    { caption: 'empty → no data', values: [] },
  ]
  const row = specimenFlexRow()
  for (const c of cases) row.append(labelled(c.caption, lineChart({ values: [...c.values], label: c.caption })))
  wrap.append(row)
  return wrap
}

// lineChart — a live <ui-line-chart> in the showcase box, `values` defaulting to the shared revenue trend.
// `values` is the JSON-string attribute form (line-chart.md — the safe codec round-trips it); `variant`/
// `label` are plain string attributes.
function lineChart(opts: { values?: readonly number[]; variant?: string; label?: string }): HTMLElement {
  const el = document.createElement('ui-line-chart')
  el.setAttribute('values', JSON.stringify(opts.values ?? REVENUE_TREND))
  if (opts.variant) el.setAttribute('variant', opts.variant)
  if (opts.label) el.setAttribute('label', opts.label)
  el.setAttribute('style', SHOWCASE_BOX)
  return el
}

// axesLineChart — a live `axes` <ui-line-chart> in the larger showcase box (room for the chrome band),
// the shared revenue-by-month series + month labels, `variant="area"` (the gradient fill demo).
function axesLineChart(opts: { projected: number }): HTMLElement {
  const el = document.createElement('ui-line-chart')
  el.setAttribute('axes', '')
  el.setAttribute('variant', 'area')
  el.setAttribute('values', JSON.stringify(REVENUE_BY_MONTH))
  el.setAttribute('labels', JSON.stringify(MONTH_LABELS))
  el.setAttribute('projected', String(opts.projected))
  el.setAttribute('label', 'Revenue trend')
  el.setAttribute('style', AXES_SHOWCASE_BOX)
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
