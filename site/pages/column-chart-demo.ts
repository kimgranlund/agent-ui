// site/pages/column-chart-demo.ts — the ui-column-chart demo (the Display-class axis-bearing stacked
// column chart, ADR-0228/ADR-0229; pairs with column-chart-doc.ts, the descriptor-derived API page).
// Mounts the REAL control over a realistic revenue-by-month dataset: stacked series, the dense
// single-series board archetype, the projected/ghost trailing column + now-marker, the static highlight
// callout, a zero-padding full-bleed composition, degenerate data, and a live rewrite driven by real
// ui-buttons — never a mock. A display leaf emits nothing; the honesty proof is the mounted control's
// own gridlines/segments/chips re-deriving under real `data` writes.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.demo-figure/.demo-grid + section spacing)
import { applyDemoWidth, captioned, el, exampleSection, uiButton } from '../lib/specimens.ts'

const { content } = mountPage({
  title: 'ui-column-chart — demo',
  intro:
    'The axis-bearing stacked column chart, live: a realistic revenue-by-month dataset under both the ' +
    'stacked and dense single-series schemas, the projected/ghost trailing column with its now-marker, ' +
    'the static highlight callout, a zero-padding full-bleed composition, the degenerate cases, and a ' +
    'live data rewrite. The API table is on the ui-column-chart API page.',
})

const text = (s: string): Text => document.createTextNode(s)
const strong = (s: string): HTMLElement => el('strong', {}, [text(s)])
const code = (s: string): HTMLElement => el('code', {}, [text(s)])

interface Row {
  label: string
  values: number[]
}

// ── a realistic dataset (hand-authored — a believable SaaS revenue-by-month split, the GH #1561 board shape) ──
const REVENUE_BY_MONTH: Row[] = [
  { label: 'Mar', values: [18, 6] },
  { label: 'Apr', values: [21, 7] },
  { label: 'May', values: [19, 8] },
  { label: 'Jun', values: [24, 9] },
  { label: 'Jul', values: [27, 10] },
  { label: 'Aug', values: [23, 8] },
]
const SERIES = ['Product', 'Services']
const DAILY_ACTIVE_USERS: Row[] = Array.from({ length: 21 }, (_, i) => ({
  label: `${i + 1}`,
  values: [Math.round(1200 + Math.sin(i / 3) * 220 + (i % 5 === 0 ? 180 : 0))],
}))

const columnChart = (
  data: readonly Row[],
  label: string,
  opts?: { series?: readonly string[]; projected?: number; highlight?: number },
): HTMLElement =>
  el('ui-column-chart', {
    data: JSON.stringify(data),
    label,
    ...(opts?.series ? { series: JSON.stringify(opts.series) } : {}),
    ...(opts?.projected !== undefined ? { projected: String(opts.projected) } : {}),
    ...(opts?.highlight !== undefined ? { highlight: String(opts.highlight) } : {}),
  })

// ── [1] stacked vs. dense single-series — one schema, no fork ────────────────────────────────────────────────
const stacked = columnChart(REVENUE_BY_MONTH, 'Revenue by month', { series: SERIES })
const dense = columnChart(DAILY_ACTIVE_USERS, 'Daily active users, this month')
const schemaGrid = el('div', { class: 'demo-grid' }, [
  captioned('series=["Product","Services"] — stacked', stacked),
  captioned('no series — the dense single-series board archetype', dense),
])
const schemaNote = el('p', {}, [
  text('The same '), code('data: {label, values[]}[]'), text(' schema renders either shape — '),
  code('values.length'), text(' decides, never a separate control or a `type` fork.'),
])

// ── [2] projected + now-marker (ADR-0228 cl.4) ────────────────────────────────────────────────────────────────
const projected = columnChart(REVENUE_BY_MONTH, 'Revenue by month, incl. projection', { series: SERIES, projected: 1 })
const projectedNote = el('p', {}, [
  text('The trailing month ('), strong('Aug'), text(') renders as a hollow, dashed-outline ghost; the '),
  strong('now-marker'), text(' — a baseline dot plus a SHORT tick, never a full-height rule — sits at the ' +
    'actual/projected boundary.'),
])

// ── [3] the static highlight callout (ADR-0228 cl.5) ─────────────────────────────────────────────────────────
const highlighted = columnChart(REVENUE_BY_MONTH, 'Revenue by month, Jul highlighted', { series: SERIES, highlight: 4 })
const highlightNote = el('p', {}, [
  text('A '), code('highlight'), text(' index renders a static callout — no hover, no focus, no ' +
    'keyboard. The agent decides what is highlighted; the fact is also repeated in the generated '),
  code('role="img"'), text(' summary for AT parity.'),
])

// ── [4] a zero-padding full-bleed composition — Kim's contract, realized ─────────────────────────────────────
const bleed = columnChart(REVENUE_BY_MONTH, 'Revenue by month', { series: SERIES, projected: 1 })
applyDemoWidth(bleed, '100%')
bleed.style.setProperty('--ui-column-chart-min-block-size', '11em')
const bleedCard = el('div', {
  style: 'border-radius: var(--md-sys-shape-corner-base); overflow: hidden; background: var(--md-sys-color-neutral-container-low, var(--md-sys-color-neutral-container));',
}, [bleed])
const bleedNote = el('p', {}, [
  text('Dropped into a zero-padding card with NO consumer CSS — every chip and the callout float '),
  strong('inside'), text(' the box (the chrome-inset knob), never pushing it. This is Kim\'s zero-padding-' +
    'container contract (ADR-0228 cl.3), realized as a mechanism.'),
])

// ── [5] degenerate data — every case still paints and still announces ────────────────────────────────────────
const degenerate = el('div', { class: 'demo-grid' }, [
  captioned('data="[]" — an empty host, "no data"', columnChart([], 'Empty dataset')),
  captioned('one category → one column', columnChart([{ label: 'Solo', values: [7] }], 'Single category')),
  captioned('a negative value drops the WHOLE row (stack semantics)', columnChart([{ label: 'ok', values: [10] }, { label: 'neg', values: [3, -2] }], 'Hardened input')),
  captioned('a ragged row pads with trailing zeros', el('ui-column-chart', { data: '[{"label":"a","values":[10,5]},{"label":"b","values":[3]}]', series: '["A","B"]', label: 'Ragged input' })),
])

// ── [6] a live rewrite — real prop writes; gridlines/segments/chips re-derive on every write ───────────────────
const live = columnChart(REVENUE_BY_MONTH, 'Revenue by month, live', { series: SERIES })
applyDemoWidth(live, '32rem')
let current = REVENUE_BY_MONTH.map((r) => ({ label: r.label, values: [...r.values] }))
const readout = code(`${current.length} months · total ${current.reduce((s, r) => s + r.values.reduce((a, b) => a + b, 0), 0)}`)
const write = (next: Row[]): void => {
  current = next
  ;(live as HTMLElement & { data: Row[] }).data = current // a real prop write — whole re-render
  readout.textContent = `${current.length} months · total ${current.reduce((s, r) => s + r.values.reduce((a, b) => a + b, 0), 0)}`
}
const reshuffle = uiButton('Reshuffle values')
reshuffle.addEventListener('click', () => {
  write(current.map((r) => ({ label: r.label, values: r.values.map(() => Math.max(1, Math.round(Math.random() * 30))) })))
})
const addMonth = uiButton('Add a month')
addMonth.addEventListener('click', () => {
  const months = ['Sep', 'Oct', 'Nov', 'Dec']
  const next = months[(current.length - 6) % months.length] ?? `M${current.length + 1}`
  write([...current, { label: next, values: [Math.round(Math.random() * 20) + 5, Math.round(Math.random() * 8) + 2] }])
})
const reset = uiButton('Reset', 'ghost')
reset.addEventListener('click', () => write(REVENUE_BY_MONTH.map((r) => ({ label: r.label, values: [...r.values] }))))
const liveBlock = el('div', { style: 'display:flex; flex-direction:column; gap:0.75rem; align-items:flex-start;' }, [
  live,
  el('div', { style: 'display:flex; gap:0.75rem; align-items:center; flex-wrap:wrap;' }, [reshuffle, addMonth, reset, readout]),
])
const liveNote = el('p', {}, [
  text('Every click writes '), code('data'), text(' with a new array; the whole mark rebuilds (A2UI '),
  code('updateDataModel'), text(' semantics) — watch the gridlines, stacked segments, and chips re-derive together.'),
])

content.append(
  exampleSection('Stacked vs. dense single-series', schemaGrid, schemaNote),
  exampleSection('Projected + now-marker', projected, projectedNote),
  exampleSection('The highlight callout', highlighted, highlightNote),
  exampleSection('A zero-padding full-bleed composition', bleedCard, bleedNote),
  exampleSection('Degenerate data', degenerate),
  exampleSection('Live data rewrite', liveBlock, liveNote),
)
