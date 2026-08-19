// site/pages/bar-chart-demo.ts — the ui-bar-chart demo (the Display-class magnitude-comparison bar list,
// ADR-0107; pairs with bar-chart-doc.ts, the descriptor-derived API page). Mounts the REAL control over a
// realistic regional revenue report: a quarter switcher (a real ui-segmented-control whose `change` commit
// writes the chart's `data`), the mixed-sign diverging model (month-over-month change), long labels, the
// degenerate cases, and an ancestor `[density]` — never a mock. A display leaf emits nothing; the switcher's
// own change event log is the honesty proof that a real prop write re-renders the real row list.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.event-log/.demo-figure/.demo-grid + section spacing)
import { applyDemoWidth, captioned, el, exampleSection } from '../lib/specimens.ts'

const { content } = mountPage({
  title: 'ui-bar-chart — demo',
  intro:
    'The axis-free bar list, live: revenue by region with a quarter switcher writing data, the mixed-sign ' +
    'diverging model for month-over-month change, long labels, the degenerate cases, and density. ' +
    'The API table is on the ui-bar-chart API page.',
})

const text = (s: string): Text => document.createTextNode(s)
const strong = (s: string): HTMLElement => el('strong', {}, [text(s)])
const code = (s: string): HTMLElement => el('code', {}, [text(s)])

interface Datum { readonly label: string; readonly value: number }

const barChart = (data: readonly Datum[], label: string): HTMLElement =>
  el('ui-bar-chart', { data: JSON.stringify(data), label })

// ── realistic report data (hand-authored — a believable regional revenue book, USD thousands) ────────────────
const REVENUE_BY_QUARTER: Readonly<Record<string, readonly Datum[]>> = {
  q1: [
    { label: 'Americas', value: 58230 },
    { label: 'EMEA', value: 42000 },
    { label: 'APAC', value: 31500 },
    { label: 'LATAM', value: 12800 },
    { label: 'Middle East & Africa', value: 7400 },
  ],
  q2: [
    { label: 'Americas', value: 61900 },
    { label: 'EMEA', value: 45100 },
    { label: 'APAC', value: 36800 },
    { label: 'LATAM', value: 11200 },
    { label: 'Middle East & Africa', value: 9100 },
  ],
  q3: [
    { label: 'Americas', value: 60400 },
    { label: 'EMEA', value: 48700 },
    { label: 'APAC', value: 41200 },
    { label: 'LATAM', value: 13900 },
    { label: 'Middle East & Africa', value: 8600 },
  ],
}
const MOM_CHANGE: readonly Datum[] = [ // month-over-month change, % — mixed sign ⇒ the diverging model
  { label: 'Sign-ups', value: 12.4 },
  { label: 'Activation', value: 3.1 },
  { label: 'Churn', value: -2.7 },
  { label: 'Support tickets', value: -8.9 },
  { label: 'p95 latency', value: 4.2 },
]

// ── [1] revenue by region — a live chart under a real quarter switcher ──────────────────────────────────────
const revenue = barChart(REVENUE_BY_QUARTER.q1, 'Revenue by region, Q1 (USD k)')
applyDemoWidth(revenue, '32rem')
const switcher = el('ui-segmented-control', { name: 'quarter' }, [
  el('ui-segment', { value: 'q1', checked: '' }, [text('Q1')]),
  el('ui-segment', { value: 'q2' }, [text('Q2')]),
  el('ui-segment', { value: 'q3' }, [text('Q3')]),
])
const log = document.createElement('ul')
log.className = 'event-log'
log.setAttribute('aria-live', 'polite')
let seq = 0
// ui-segmented-control (a ui-radio-group subclass) commits its selection via `change` (no detail — read `.value`)
switcher.addEventListener('change', () => {
  const value = String((switcher as HTMLElement & { value: string | null }).value ?? '')
  const data = REVENUE_BY_QUARTER[value]
  if (!data) return
  // a REAL prop write on the mounted control — the whole row list re-renders (no incremental API)
  ;(revenue as HTMLElement & { data: readonly Datum[]; label: string }).data = data
  ;(revenue as HTMLElement & { label: string }).label = `Revenue by region, ${value.toUpperCase()} (USD k)`
  seq += 1
  const line = document.createElement('li')
  line.textContent = `#${String(seq).padStart(2, '0')}  change  quarter=${JSON.stringify(value)}  → data rewritten (${data.length} rows)`
  log.append(line)
  log.scrollTop = log.scrollHeight
})
const revenueBlock = el('div', { style: 'display:flex; flex-direction:column; gap:1rem; align-items:flex-start;' }, [
  switcher,
  revenue,
])
const revenueNote = el('p', {}, [
  text('One row per datum in data order — '), strong('label · bar · printed value'), text(' on a shared grid, so bars ' +
    'stay length-comparable and the printed value (Intl-formatted) is the accessible datum. Picking a quarter writes the chart’s '),
  code('data'), text(' and '), code('label'), text(' props from the switcher’s '), code('change'), text(' commit; the ' +
    'long “Middle East & Africa” label wraps inside the bounded 40% label column instead of starving the bars.'),
])

// ── [2] the mixed-sign diverging model — a shared zero point, negatives grow toward inline-start ────────────
const mom = barChart(MOM_CHANGE, 'Month-over-month change, %')
applyDemoWidth(mom, '32rem')
const momNote = el('p', {}, [
  text('When negatives are present every bar shares one zero origin and diverges from it — churn and support ' +
    'tickets fell, sign-ups and latency rose. Still axis-free: the signed printed value carries the exact reading.'),
])

// ── [3] degenerate data — every case still paints and still announces ───────────────────────────────────────
const degenerate = el('div', { class: 'demo-grid' }, [
  captioned('data="[]" — zero rows (role=list, empty)', barChart([], 'Empty report')),
  captioned('one datum — one full-length row', barChart([{ label: 'Americas', value: 58230 }], 'Single region')),
  captioned('all equal — every bar full length', barChart([{ label: 'Free', value: 400 }, { label: 'Pro', value: 400 }, { label: 'Team', value: 400 }], 'Seats per plan')),
  captioned('all zero — printed 0s carry the reading', barChart([{ label: 'Refunds', value: 0 }, { label: 'Chargebacks', value: 0 }], 'Disputes this week')),
  captioned('all negative — zero point at inline-end', barChart([{ label: 'Q1', value: -1200 }, { label: 'Q2', value: -4800 }, { label: 'Q3', value: -2300 }], 'Net burn (USD k)')),
  captioned('a malformed entry is dropped, the rest render', el('ui-bar-chart', { data: '[{"label":"EMEA","value":42},{"label":"broken"},{"label":"APAC","value":31}]', label: 'Hardened input' })),
])

// ── [4] density — row rhythm rides an ancestor [density]; bar thickness stays invariant ─────────────────────
const density = el('div', { class: 'demo-grid' }, [
  captioned('default density', barChart(REVENUE_BY_QUARTER.q3, 'Revenue by region, Q3')),
  captioned('[density="compact"] ancestor', el('div', { density: 'compact' }, [barChart(REVENUE_BY_QUARTER.q3, 'Revenue by region, Q3 (compact)')])),
])

content.append(
  exampleSection('Revenue by region', revenueBlock, revenueNote),
  exampleSection('change event log (the quarter switcher)', log),
  exampleSection('Mixed sign — the diverging model', mom, momNote),
  exampleSection('Degenerate data', degenerate),
  exampleSection('Density', density),
)
