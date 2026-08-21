// site/pages/line-chart-demo.ts — the ui-line-chart demo (the Display-class axis-bearing line/area chart,
// ADR-0205, EXTENDED by ADR-0229 cl.3; pairs with line-chart-doc.ts, the descriptor-derived API page).
// Mounts the REAL control over realistic report series — p95 latency (all-positive ⇒ the value-floor
// baseline), net cash flow (mixed sign ⇒ the zero-line baseline), MRR under the area variant, the `axes`
// state (gridlines/chips/gradient/projected+now-marker) over a real revenue-by-month series, a zero-
// padding full-bleed composition, a report-row layout, degenerate data, and a live rolling window driven
// by real ui-buttons — never a mock. A display leaf emits nothing; the honesty proof is the mounted
// control's own baseline/gridlines/chips re-deriving under real `values`/`axes`/`projected` writes.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.demo-figure/.demo-grid + section spacing)
import { applyDemoWidth, captioned, el, exampleSection, uiButton } from '../lib/specimens.ts'

const { content } = mountPage({
  title: 'ui-line-chart — demo',
  intro:
    'The axis-bearing line chart, live: real report series under both baseline branches (the value floor for ' +
    'an all-positive series, the zero line for a mixed-sign one), the area variant, the opt-in `axes` state ' +
    '(gridlines, chips, gradient fill, projected + now-marker), a zero-padding full-bleed composition, a ' +
    'report row, the degenerate cases, and a rolling window under live values writes. The API table is on ' +
    'the ui-line-chart API page.',
})

const text = (s: string): Text => document.createTextNode(s)
const strong = (s: string): HTMLElement => el('strong', {}, [text(s)])
const code = (s: string): HTMLElement => el('code', {}, [text(s)])

// ── realistic report series (hand-authored — a believable SaaS operations week/month/year) ──────────────────
const P95_LATENCY_24H = [212, 208, 205, 199, 201, 240, 318, 402, 388, 361, 344, 352, 349, 371, 366, 340, 322, 310, 298, 287, 275, 251, 230, 219] // ms, hourly
const NET_CASH_FLOW_12M = [-18400, -12100, -9800, -3200, 1400, -2600, 4900, 7300, 6100, 9800, 12400, 15200] // USD, monthly
const MRR_12M = [41200, 42800, 43100, 44900, 46200, 45800, 47600, 49100, 50400, 52300, 53900, 55700] // USD
const SIGNUPS_30D = [18, 22, 19, 25, 31, 12, 9, 27, 30, 28, 33, 35, 14, 11, 29, 32, 38, 36, 40, 17, 13, 37, 41, 39, 44, 42, 19, 15, 46, 48]

const lineChart = (values: readonly number[], label: string, variant?: 'line' | 'area'): HTMLElement =>
  el('ui-line-chart', { values: JSON.stringify(values), label, ...(variant ? { variant } : {}) })

// ── [1] the two baseline branches — an all-positive series floors at its own min; a mixed-sign one at zero ──
const latency = lineChart(P95_LATENCY_24H, 'p95 latency, last 24 h (ms)')
const cashFlow = lineChart(NET_CASH_FLOW_12M, 'Net cash flow, 12 months (USD)')
const baselines = el('div', { class: 'demo-grid' }, [
  captioned('all-positive → baseline = the value floor (199)', latency),
  captioned('spans zero → baseline = the zero line', cashFlow),
])
const baselineNote = el('p', {}, [
  text('The '), strong('baseline'), text(' is the zero line when the range spans zero, else the series’ own floor — ' +
    'an all-positive latency series bottoms out at 199 ms, not at an assumed zero axis (deliberately unlike '),
  code('ui-bar-chart'), text('’s always-zero law). The '), strong('min / max'), text(' value labels above and below the ' +
    'plot are always shown, as real DOM text — the axis vocabulary itself.'),
])

// ── [2] the area variant — the fill closes to the BASELINE, not the geometric bottom ────────────────────────
const area = el('div', { class: 'demo-grid' }, [
  captioned('variant="area" — all-positive: fill down to the floor', lineChart(MRR_12M, 'MRR, 12 months (USD)', 'area')),
  captioned('variant="area" — mixed sign: fill to the zero line, both directions', lineChart(NET_CASH_FLOW_12M, 'Net cash flow (USD)', 'area')),
])

// ── [3] the `axes` state (ADR-0229 cl.3) — gridlines/chips/gradient fill/projected+now-marker ────────────────
const MRR_BY_MONTH = [41200, 42800, 43100, 44900, 46200, 45800] // USD, the SAME shape MRR_12M's opening half shows
const MONTH_LABELS = ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug']
const axesLineChart = (values: readonly number[], labels: readonly string[], label: string, projected?: number): HTMLElement =>
  el('ui-line-chart', {
    axes: '',
    variant: 'area',
    values: JSON.stringify(values),
    labels: JSON.stringify(labels),
    label,
    ...(projected !== undefined ? { projected: String(projected) } : {}),
  })
const axesGrid = el('div', { class: 'demo-grid' }, [
  captioned('axes, variant="area"', axesLineChart(MRR_BY_MONTH, MONTH_LABELS, 'MRR by month')),
  captioned('axes, variant="area", projected="1"', axesLineChart(MRR_BY_MONTH, MONTH_LABELS, 'MRR by month, incl. projection', 1)),
])
const axesNote = el('p', {}, [
  text('The '), code('axes'), text(' state swaps the min/max label rows for the shared ADR-0228 tick/' +
    'gridline/category system — gridlines over the series’ own value range, month chips from '),
  code('labels'), text(' (index-aligned to '), code('values'), text('), and a gradient-to-transparent area ' +
    'fill. The trailing month on the right renders '), strong('projected'), text(' (a dashed stroke + a ' +
    'now-marker at the actual/projected boundary) — the SAME mechanism '), code('ui-column-chart'), text(' uses.'),
])

// ── [3b] a zero-padding full-bleed `axes` composition — Kim's contract, realized for the time axis ────────────
const bleed = axesLineChart(MRR_BY_MONTH, MONTH_LABELS, 'MRR by month, incl. projection', 1)
applyDemoWidth(bleed, '100%')
bleed.style.setProperty('--ui-line-chart-min-block-size', '11em')
const bleedCard = el('div', {
  style: 'border-radius: var(--md-sys-shape-corner-base); overflow: hidden; background: var(--md-sys-color-neutral-container-low, var(--md-sys-color-neutral-container));',
}, [bleed])
const bleedNote = el('p', {}, [
  text('Dropped into a zero-padding card with NO consumer CSS — every tick/category chip floats '),
  strong('inside'), text(' the plot box (the chrome-inset knob), never pushing it — the same ADR-0228 cl.3 ' +
    'contract '), code('ui-column-chart'), text(' realizes, now proven for a point-major series too.'),
])

// ── [4] a report row — the chart in the layout a dashboard actually gives it ────────────────────────────────
const wide = lineChart(SIGNUPS_30D, 'Sign-ups, last 30 days', 'area')
applyDemoWidth(wide, '100%')
wide.style.setProperty('--ui-line-chart-min-block-size', '12em')
const reportRow = el('div', { class: 'demo-figure' }, [
  el('div', { style: 'display:flex; justify-content:space-between; gap:1rem; align-items:baseline;' }, [
    strong('Sign-ups, last 30 days'),
    el('span', { style: 'font-variant-numeric: tabular-nums;' }, [text('831 total · 48 today')]),
  ]),
  wide,
])
const reportNote = el('p', {}, [
  text('The host defaults to a 16em × 9em floor; here it fills its column and raises '),
  code('--ui-line-chart-min-block-size'), text(' to 12em. Stroke width is density-invariant; the label↔plot row gap ' +
    'rides the space ladder.'),
])

// ── [5] degenerate data — every case still paints and still announces ───────────────────────────────────────
const degenerate = el('div', { class: 'demo-grid' }, [
  captioned('values="[]" — no data (empty tile, "no data" name)', lineChart([], 'Empty series')),
  captioned('values="[42]" — one point (a centered dot, baseline coincident)', lineChart([42], 'Single point')),
  captioned('values="[7,7,7,7]" — all equal (a flat line on its baseline)', lineChart([7, 7, 7, 7], 'Flat series')),
  captioned('non-finite entries dropped', el('ui-line-chart', { values: '[3,"x",5,null,4,8,7]', label: 'Hardened input' })),
])

// ── [6] a live rolling window — real prop writes; baseline + min/max labels re-derive on every write ────────
const live = lineChart(P95_LATENCY_24H, 'p95 latency, rolling 24 h (ms)')
applyDemoWidth(live, '32rem')
let rolling = [...P95_LATENCY_24H]
const readout = code(`${rolling.length} points · low ${Math.min(...rolling)} · high ${Math.max(...rolling)}`)
const write = (next: readonly number[]): void => {
  rolling = [...next]
  ;(live as HTMLElement & { values: readonly number[] }).values = rolling // a real prop write — whole re-render
  readout.textContent = `${rolling.length} points · low ${Math.min(...rolling)} · high ${Math.max(...rolling)}`
}
const push = uiButton('Push a new sample')
push.addEventListener('click', () => {
  const last = rolling[rolling.length - 1]
  write([...rolling.slice(1), Math.max(150, Math.round(last + (Math.random() - 0.5) * 80))])
})
const spike = uiButton('Simulate an incident spike')
spike.addEventListener('click', () => write([...rolling.slice(1), 1240]))
const reset = uiButton('Reset', 'ghost')
reset.addEventListener('click', () => write(P95_LATENCY_24H))
const liveBlock = el('div', { style: 'display:flex; flex-direction:column; gap:0.75rem; align-items:flex-start;' }, [
  live,
  el('div', { style: 'display:flex; gap:0.75rem; align-items:center; flex-wrap:wrap;' }, [push, spike, reset, readout]),
])
const liveNote = el('p', {}, [
  text('Every click writes '), code('values'), text(' with a rolled window; the tile rebuilds as a whole (A2UI '),
  code('updateDataModel'), text(' semantics) — watch the max label jump to 1,240 on a spike and the plot re-normalize.'),
])

content.append(
  exampleSection('The two baseline branches', baselines, baselineNote),
  exampleSection('Area variant', area),
  exampleSection('The `axes` state', axesGrid, axesNote),
  exampleSection('A zero-padding full-bleed `axes` composition', bleedCard, bleedNote),
  exampleSection('A report row', reportRow, reportNote),
  exampleSection('Degenerate data', degenerate),
  exampleSection('Live rolling window', liveBlock, liveNote),
)
