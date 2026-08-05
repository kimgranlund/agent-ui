// site/pages/pagination-demo.ts — the ui-pagination interaction demo (the ratified pattern-tier `demo`;
// ADR-0163 cl.6, SPEC-R3). Mounts the REAL control and proves its interaction honestly: a live event log
// shows a stop commit round-tripping on a USER gesture (a programmatic `page`/`pages` write is silent), the
// honest empty state (pages < 2), and composing with `ui-table`'s own `page-size` capability. The control
// owns all windowing/commit/ARIA (pagination.ts/.css) — this page only stages it and logs.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './containers.css' // shared demo chrome (.event-log + section spacing)
import { el, exampleSection } from '../lib/specimens.ts'

const { content } = mountPage({
  title: 'ui-pagination — demo',
  intro: 'ui-pagination, live. Click a stop (previous/next/a page number); the event log proves `page` ' +
    'round-trips on a USER gesture only. Includes the honest empty state (pages < 2) and composing with ' +
    'ui-table\'s own page-size capability. The API table is on the ui-pagination API page.',
})

const text = (s: string): Text => document.createTextNode(s)

// ── event log (shared shape — the segmented-control-demo.ts precedent) ──────────────────────────────────────
const log = document.createElement('ul')
log.className = 'event-log'
log.setAttribute('aria-live', 'polite')
let seq = 0
const record = (kind: string, detail: unknown): void => {
  seq += 1
  const line = document.createElement('li')
  line.textContent = `#${String(seq).padStart(2, '0')}  ${kind}  detail=${JSON.stringify(detail)}`
  log.append(line)
  log.scrollTop = log.scrollHeight
}

// ── standalone — a mid-range page (both ellipsis markers + the active stop paint) ────────────────────────────
const standalone = el('ui-pagination', { label: 'Search results', page: '5', pages: '12' })
standalone.addEventListener('change', (event) => record('change', (event as CustomEvent<{ page: number }>).detail))

// ── the honest empty state — pages < 2 renders NOTHING ─────────────────────────────────────────────────────
const emptyWrap = el('div', { 'data-demo-role': 'empty-wrap' }, [
  el('ui-pagination', { label: 'Nothing to page through', pages: '1' }),
])
const emptyNote = el('p', {}, [
  text('The element above is a real '), el('code', {}, [text('<ui-pagination pages="1">')]),
  text(' — it renders zero children. A list with one page has nothing to navigate.'),
])

// ── composing with ui-table (page-size) ─────────────────────────────────────────────────────────────────────
const columns = JSON.stringify([
  { key: 'region', label: 'Region' },
  { key: 'revenue', label: 'Revenue', type: 'number' },
])
const rows = JSON.stringify(
  Array.from({ length: 25 }, (_, i) => ({ region: `Region ${i + 1}`, revenue: (i + 1) * 1000 })),
)
const table = el('ui-table', {
  label: 'Revenue by region (paged)',
  columns,
  rows,
  'page-size': '10',
})
const tableNote = el('p', {}, [
  text('This table sets '), el('code', {}, [text('page-size="10"')]),
  text(' — it stamps a '), el('code', {}, [text('ui-pagination')]),
  text(' in its own footer (outside the scroll container) and windows the 25 rows into pages of 10, ' +
    'internally. Clicking a page there also fires the table\'s own '), el('code', {}, [text('change')]),
  text(' event.'),
])
table.addEventListener('change', () => record('table change', { page: (table as unknown as { page: number }).page }))

content.append(
  exampleSection('Standalone — a mid-range page (12 pages)', standalone),
  log,
  exampleSection('The honest empty state (pages < 2)', emptyWrap, emptyNote),
  exampleSection('Composing with ui-table (page-size)', table, tableNote),
)
