// site/pages/table-demo.ts — the ui-table demo (the Display-class data table, ADR-0111, widened in place by
// ADR-0163; pairs with table-doc.ts, the descriptor-derived API page — report-family LLD-C21 "table-doc/demo
// gain capability examples"). Mounts the REAL control over a realistic accounts / sign-ups report and turns on
// every opt-in capability, live: sortable columns (a real stamped header <button> commits `change`),
// multi-selection with select-all (a real checkbox column commits `select`), the composed search surface (a
// bound ui-text-field writing `search`), a facet `filter` (a ui-segmented-control writing one filter entry),
// and pagination (a composed ui-pagination footer whose own `change` bubbles through the host). Plus a
// single-select radio specimen and the byte-identical default-off baseline. An event log proves the two-event
// contract on the real control — never a mock.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.event-log + section spacing)
import { applyDemoWidth, el, exampleSection } from '../lib/specimens.ts'
import type { UITableElement, UITextFieldElement } from '@agent-ui/components/components'

const { content } = mountPage({
  title: 'ui-table — demo',
  intro:
    'The widened data table, live: sortable columns, multi- and single-selection with a select/change event ' +
    'log, a composed search field, a plan facet filter, and pagination — every ADR-0163 capability on one real ' +
    'accounts report, plus the default-off baseline. The API table is on the ui-table API page.',
})

const text = (s: string): Text => document.createTextNode(s)
const strong = (s: string): HTMLElement => el('strong', {}, [text(s)])
const code = (s: string): HTMLElement => el('code', {}, [text(s)])

// ── realistic report data (hand-authored — a believable accounts book for a SaaS month) ────────────────────
interface Column {
  readonly key: string
  readonly label: string
  readonly type?: 'string' | 'number'
  readonly sortable?: boolean
  readonly searchable?: boolean
}
type Row = Readonly<Record<string, string | number>>

const COLUMNS: readonly Column[] = [
  { key: 'account', label: 'Account', sortable: true },
  { key: 'plan', label: 'Plan', sortable: true },
  { key: 'region', label: 'Region', sortable: true },
  { key: 'seats', label: 'Seats', type: 'number', sortable: true },
  { key: 'mrr', label: 'MRR (USD)', type: 'number', sortable: true },
  { key: 'signedUp', label: 'Signed up', sortable: true, searchable: false }, // opts OUT of free-text search
]
const ROWS: readonly Row[] = [
  { account: 'Acme Robotics', plan: 'Team', region: 'Americas', seats: 48, mrr: 4320, signedUp: '2026-07-02' },
  { account: 'Blue Fjord Labs', plan: 'Pro', region: 'EMEA', seats: 12, mrr: 1080, signedUp: '2026-07-03' },
  { account: 'Cobalt Analytics', plan: 'Free', region: 'Americas', seats: 3, mrr: 0, signedUp: '2026-07-03' },
  { account: 'Delta Freight', plan: 'Team', region: 'APAC', seats: 65, mrr: 5850, signedUp: '2026-07-05' },
  { account: 'Émile & Fils', plan: 'Pro', region: 'EMEA', seats: 8, mrr: 720, signedUp: '2026-07-06' },
  { account: 'Fathom Health', plan: 'Team', region: 'Americas', seats: 120, mrr: 10800, signedUp: '2026-07-08' },
  { account: 'Granite Works', plan: 'Free', region: 'EMEA', seats: 2, mrr: 0, signedUp: '2026-07-09' },
  { account: 'Halcyon Media', plan: 'Pro', region: 'APAC', seats: 21, mrr: 1890, signedUp: '2026-07-11' },
  { account: 'Iris Optics', plan: 'Pro', region: 'Americas', seats: 15, mrr: 1350, signedUp: '2026-07-12' },
  { account: 'Juniper Legal', plan: 'Team', region: 'EMEA', seats: 34, mrr: 3060, signedUp: '2026-07-14' },
  { account: 'Kestrel Aero', plan: 'Free', region: 'APAC', seats: 4, mrr: 0, signedUp: '2026-07-15' },
  { account: 'Lumen Energy', plan: 'Team', region: 'LATAM', seats: 52, mrr: 4680, signedUp: '2026-07-16' },
  { account: 'Meridian Bank', plan: 'Team', region: 'EMEA', seats: 210, mrr: 18900, signedUp: '2026-07-18' },
  { account: 'Nimbus Weather', plan: 'Free', region: 'Americas', seats: 1, mrr: 0, signedUp: '2026-07-19' },
  { account: 'Orchard Foods', plan: 'Pro', region: 'LATAM', seats: 9, mrr: 810, signedUp: '2026-07-21' },
  { account: 'Pioneer Rail', plan: 'Team', region: 'APAC', seats: 77, mrr: 6930, signedUp: '2026-07-22' },
  { account: 'Quill Publishing', plan: 'Pro', region: 'EMEA', seats: 18, mrr: 1620, signedUp: '2026-07-24' },
  { account: 'Riverstone Realty', plan: 'Free', region: 'Americas', seats: 2, mrr: 0, signedUp: '2026-07-25' },
  { account: 'Solstice Games', plan: 'Pro', region: 'APAC', seats: 26, mrr: 2340, signedUp: '2026-07-27' },
  { account: 'Tundra Logistics', plan: 'Team', region: 'Americas', seats: 41, mrr: 3690, signedUp: '2026-07-28' },
  { account: 'Umber Studios', plan: 'Free', region: 'LATAM', seats: 5, mrr: 0, signedUp: '2026-07-29' },
  { account: 'Vantage Security', plan: 'Team', region: 'EMEA', seats: 96, mrr: 8640, signedUp: '2026-07-30' },
  { account: 'Willow & Co', plan: 'Pro', region: 'Americas', seats: 11, mrr: 990, signedUp: '2026-07-31' },
  { account: 'Zenith Motors', plan: 'Team', region: 'APAC', seats: 150, mrr: 13500, signedUp: '2026-08-01' },
]

const makeTable = (attrs: Record<string, string>): UITableElement =>
  el('ui-table', { columns: JSON.stringify(COLUMNS), rows: JSON.stringify(ROWS), ...attrs }) as UITableElement

// ── the shared event log — the two-event contract (select · change), plus the bubbling pagination change ────
const log = document.createElement('ul')
log.className = 'event-log'
log.setAttribute('aria-live', 'polite')
let seq = 0
const record = (source: string, kind: string, detail: string): void => {
  seq += 1
  const line = document.createElement('li')
  line.textContent = `#${String(seq).padStart(2, '0')}  ${source.padEnd(8)}${kind.padEnd(8)}${detail}`
  log.append(line)
  log.scrollTop = log.scrollHeight
}
const wireLog = (table: UITableElement, source: string): void => {
  // `select` — a row checkbox/radio or the header select-all committed; no detail: read `el.selected`
  table.addEventListener('select', () => record(source, 'select', `selected=${JSON.stringify(table.selected)}`))
  // `change` — EITHER a sort-button commit (read `el.sort`) OR the composed ui-pagination footer's own change
  // (detail `{page}`), which bubbles through the host and is deliberately NOT re-emitted by the table
  table.addEventListener('change', (event) => {
    const detail = (event as CustomEvent<{ page?: number } | null>).detail
    if (detail && typeof detail.page === 'number') record(source, 'change', `page=${detail.page} (bubbled from ui-pagination)`)
    else record(source, 'change', `sort=${JSON.stringify(table.sort)}`)
  })
}

// ── [1] the full-capability report — sort + multi-select + search + filter + pagination on ONE table ────────
const report = makeTable({
  label: 'Accounts — July sign-ups',
  selectable: 'multi',
  'row-key': 'account',
  selected: JSON.stringify(['Fathom Health', 'Meridian Bank']),
  sort: JSON.stringify({ key: 'mrr', direction: 'descending' }),
  'page-size': '8',
})
wireLog(report, 'report')

// the composed query surface — the table renders NO search UI of its own (ADR-0163 cl.2): a bound
// ui-text-field's `value` writes the table's `search` on every `input` (the shared-path idiom)
const searchField = el('ui-text-field', { type: 'search', label: 'Search accounts', placeholder: 'e.g. Fjord, EMEA, Team' }) as UITextFieldElement
applyDemoWidth(searchField, '18rem')
searchField.addEventListener('input', () => {
  report.search = String(searchField.value ?? '')
})

// the facet filter — one bounded `{key, values}` entry from a ui-segmented-control (a radio-group subclass:
// commits via `change`; read `.value`)
const planFacet = el('ui-segmented-control', { name: 'plan' }, [
  el('ui-segment', { value: 'all', checked: '' }, [text('All plans')]),
  el('ui-segment', { value: 'Free' }, [text('Free')]),
  el('ui-segment', { value: 'Pro' }, [text('Pro')]),
  el('ui-segment', { value: 'Team' }, [text('Team')]),
])
planFacet.addEventListener('change', () => {
  const plan = String((planFacet as HTMLElement & { value: string | null }).value ?? 'all')
  report.filter = plan === 'all' ? [] : [{ key: 'plan', values: [plan] }]
  report.page = 1 // a narrowing facet may drop pageCount under the current page — reset explicitly (the documented residual)
})

// a live selection readout — the bound `selected` prop, read back after every select commit
const selectedOut = code(JSON.stringify(report.selected))
report.addEventListener('select', () => { selectedOut.textContent = JSON.stringify(report.selected) })
const clearSelection = el('ui-button', { variant: 'ghost' }, [text('Clear selection')])
clearSelection.addEventListener('click', () => {
  report.selected = [] // a PROGRAMMATIC write — applies silently, no `select` (the fleet commit law); refresh the readout by hand
  selectedOut.textContent = '[]'
})

const toolbar = el('div', { style: 'display:flex; gap:1rem; align-items:flex-end; flex-wrap:wrap; margin-block-end:1rem;' }, [
  searchField,
  planFacet,
])
const readout = el('p', { style: 'display:flex; gap:0.75rem; align-items:center; flex-wrap:wrap;' }, [
  text('selected = '), selectedOut, clearSelection,
])
const reportBlock = el('div', {}, [toolbar, report, readout])
const reportNote = el('p', {}, [
  text('Every capability composes through ONE pipeline: rows → '), code('filter'), text(' → '), code('search'), text(' → '),
  code('sort'), text(' → page window → the stamped '), code('<tbody>'), text('. Click a '), strong('column header'),
  text(' to sort (ascending → descending; another column starts fresh; a real stamped '), code('<button>'), text(' with '),
  code('aria-sort'), text(' on the sorted '), code('<th>'), text('), tick a '), strong('row checkbox'), text(' or the '),
  strong('select-all'), text(' (which operates on the MATCHING set — try it under a filter), type in the '),
  strong('search field'), text(' (case- and diacritic-insensitive over the searchable columns — "emile" finds Émile & Fils; the ' +
    'Signed-up column opts out), pick a '), strong('plan facet'), text(', and page with the composed footer. Selection identity is the '),
  code('row-key'), text(' column ("account"), held against the WHOLE set — a filtered-out selected row stays selected.'),
])

// ── [2] single selection — a radio column, one shared name per table ───────────────────────────────────────
const single = makeTable({
  label: 'Pick the account to review',
  selectable: 'single',
  'row-key': 'account',
  'page-size': '6',
  sort: JSON.stringify({ key: 'account', direction: 'ascending' }),
})
wireLog(single, 'single')
const singleNote = el('p', {}, [
  code('selectable="single"'), text(' stamps a leading radio column (an empty header cell — a radio column has no select-all); ' +
    'a click commits '), code('select'), text(' with a one-identity '), code('selected'), text('. These native inputs and the sort ' +
    'buttons are the fleet’s one sanctioned "no native form elements" exception (ADR-0163 cl.3): they sit in the normal tab ' +
    'order — no roving tabindex, no '), code('role=grid'), text('.'),
])

// ── [3] the default-off baseline — byte-identical to the pre-widening display-only control ──────────────────
const baseline = el('ui-table', {
  label: 'Revenue by region',
  columns: JSON.stringify([
    { key: 'region', label: 'Region' },
    { key: 'revenue', label: 'Revenue (USD)', type: 'number' },
    { key: 'status', label: 'Status' },
  ]),
  rows: JSON.stringify([
    { region: 'Americas', revenue: 58230, status: 'Ahead' },
    { region: 'EMEA', revenue: 42000, status: 'On track' },
    { region: 'APAC', revenue: 31500, status: 'At risk' },
    { region: 'LATAM', revenue: 12800, status: 'On track' },
  ]),
})
const baselineNote = el('p', {}, [
  text('With every capability at its default (off) value the rendered DOM is byte-identical to the original ' +
    'display-only table (ADR-0163 cl.10): a real '), code('<table>'), text(' with a '), code('<caption>'), text(', plain '),
  code('<th scope="col">'), text(' headers, no selection column, no footer.'),
])

content.append(
  exampleSection('The full-capability report', reportBlock, reportNote),
  exampleSection('select / change event log', log),
  exampleSection('Single selection', single, singleNote),
  exampleSection('Default-off baseline', baseline, baselineNote),
)
