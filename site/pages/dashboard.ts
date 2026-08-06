// dashboard.ts — the Support Dashboard (GH #499, M-F: the fleet's SECOND SaaS composition). A site-hosted
// demo page composed ENTIRELY from already-published fleet primitives — zero new controls minted, the SAME
// discipline workbench.ts (GH #461, MA-3) proved for a different page shape. Structural precedent:
// workbench.ts itself — this file reuses its shell convention (ui-workspace-shell, one authored
// data-slot="content" region, no shell-facing CSS beyond a plain dimension) VERBATIM, because MA-3 already
// re-verified PRD-A1 ("ui-workspace-shell hosts a content region with no new shell-side work") for the
// workbench shape; this page's own green browser suite (dashboard.browser.test.ts) re-confirms it holds for
// a materially different content shape too — stat tiles + a chart + a read-only table, not a data-table +
// toolbar + edit-modal — which is the whole point of a SECOND composition (does the frame generalize, or
// did MA-3 just fit the workbench's own content by luck?).
//
// ── the four parts (stat cards · chart · table · agent summary) ────────────────────────────────────────
// Stat cards: four `ui-stat` tiles (ADR-0111), every number COMPUTED from dashboard-data.ts's one fixture
//   (computeDashboardStats) — never hand-typed a second time. Chart: `ui-bar-chart` (ADR-0107 v1 scope —
//   line/area/pie/donut/combo stay fenced), an all-positive category breakdown (computeCategoryBreakdown),
//   same fixture, same "computed, not duplicated" rule. Table: `ui-table` (ADR-0163) over the RAW fixture
//   rows, sortable, unselectable, unpaginated — a deliberately SIMPLER configuration than the workbench's
//   fully-widened one (selectable + paginated + filtered), proving the control's simpler surface composes
//   just as cleanly, not only its maximal one. Agent summary: `ui-surface-host` replaying a RECORDED
//   (dashboard-summary.ts) A2UI fixture, the exact workbench-summary.ts mechanism, now proven at THREE
//   view-state keys instead of two (the workbench file's own "future wave" note, realized here).
//
// The priority filter is a genuinely different toolbar vehicle from the workbench's `ui-form-popover` +
// checkbox group: a `ui-segmented-control` (single-select-of-three), because this page's filter has no
// multi-value facet to aggregate — a composition decision, not a missing primitive (inv-5-saas.md §5's own
// "composition-inventory non-gap" framing). It drives BOTH `table.filter` (the ADR-0163 one-way-in state
// prop, same mechanism the workbench toolbar writes) and the agent-summary key — never `table.rows`.
//
// COMPOSITION DECISION, stated rather than silently made: the four stat tiles and the category chart read
// the FULL fixture always — they answer "what does the whole queue look like?", a board-wide posture — while
// the table and the agent summary track the CURRENT priority-filter selection. A real KPI dashboard reads
// this same way (headline tiles don't re-derive when a list below is narrowed); flagged here per the
// dispatch's "note it as an open fork" instruction, since the source issue doesn't mandate either choice.
//
// No fetch layer (GH #499's zero-network fence, the same non-goal workbench's SPEC-N1/N10 pinned) — every
// import below names only published `@agent-ui/*` subpaths, none of them a transport. No `createMemoryStore`
// (dashboard-data.ts's own banner explains why: this page never mutates anything, so it owns no store).

import '@agent-ui/components/foundation-styles.css' // [1] foundation: tokens.css → dimensions.css (FIRST)
import '@agent-ui/components/base-styles.css' // [1b] the DOCUMENT BASE layer: typeface/leading/ink/rendering (shell-less pages need this or they render in the UA serif)
import '@agent-ui/components/component-styles.css' // [2] per-control CSS (stat/bar-chart/table/segmented-control/segment/field/card/text — one bundle)
import '@agent-ui/components/components' // [3] self-defining ui-* controls (the whole default-catalog fleet)
import '@agent-ui/app/workspace-shell.css'
import '@agent-ui/app/super-shell.css' // ui-workspace-shell composes ui-super-shell (LLD-C5) — the composed child's own sheet, the workbench.ts/agent-admin-app.ts precedent
import '@agent-ui/app/surface-host.css'
import '@agent-ui/app/workspace-shell' // self-defines ui-workspace-shell
import '@agent-ui/app/surface-host' // self-defines ui-surface-host
import './dashboard.css' // page-local: full-viewport sizing (a plain dimension, no shell frame rules) + content-region layout only

import type { UIStatElement, UIBarChartElement, UITableElement, UISegmentedControlElement } from '@agent-ui/components/components'
import type { UISurfaceHostElement } from '@agent-ui/app'

import {
  TICKET_COLUMNS,
  TICKET_ROW_KEY,
  PRIORITY_FACET_KEY,
  FIXTURE_RECORDS,
  computeDashboardStats,
  computeCategoryBreakdown,
} from './dashboard-data.ts'
import { summaryLines, summaryViewKey, type SummaryViewKey } from './dashboard-summary.ts'

const root = document.querySelector('#app') ?? document.body

// ── small light-DOM chrome helpers (page chrome only — never restyle a ui-* control's internals) ─────────
function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (className) node.className = className
  return node
}

// ════════════════ the shell — one ui-workspace-shell, ONE authored slot (the workbench.ts precedent) ═════
const shell = document.createElement('ui-workspace-shell')

const header = document.createElement('div')
header.setAttribute('data-slot', 'header')
header.className = 'dc-header'
const title = document.createElement('h1')
title.className = 'dc-title'
title.textContent = 'Support Dashboard'
const note = document.createElement('p')
note.className = 'dc-note'
note.textContent = 'Demo data — a fixed, seeded snapshot. Nothing on this page is editable.'
header.append(title, note)

const content = document.createElement('main')
content.setAttribute('data-slot', 'content')
const dcContent = el('div', 'dc-content')
content.append(dcContent)

shell.append(header, content)
root.append(shell)

// ════════════════ the stat row (four ui-stat tiles, board-wide — never re-derives on the priority filter) ═
const statsSection = document.createElement('section')
statsSection.className = 'dc-stats'
statsSection.setAttribute('aria-labelledby', 'dc-stats-title')
const statsTitle = document.createElement('h2')
statsTitle.id = 'dc-stats-title'
statsTitle.className = 'dc-section-title'
statsTitle.textContent = 'Overview'
// layout-checker finding (GH #499 follow-up): the board-wide-vs-filtered fork above (COMPOSITION DECISION)
// had zero on-screen signal — a narrowed table with frozen tiles above it reads as a bug, not a design
// choice, without this line stating it out loud.
const statsCaption = document.createElement('p')
statsCaption.className = 'dc-caption'
statsCaption.textContent = 'Board-wide across every ticket — unaffected by the priority filter below.'

const stats = computeDashboardStats(FIXTURE_RECORDS)
const statsRow = el('div', 'dc-stats-row')

function statTile(label: string, figure: string, caption: string): UIStatElement {
  const stat = document.createElement('ui-stat') as UIStatElement
  stat.label = label
  stat.figure = figure
  stat.caption = caption
  return stat
}

statsRow.append(
  statTile('Open tickets', String(stats.openCount), `of ${FIXTURE_RECORDS.length} total`),
  statTile('Avg. first response', `${stats.avgFirstResponseMinutes}m`, 'across all tickets'),
  statTile('Avg. CSAT', stats.ratedCount > 0 ? String(stats.avgCsat) : '—', `${stats.ratedCount} rated`),
  statTile('Active agents', String(stats.activeAgentCount), 'assigned this queue'),
)
statsSection.append(statsTitle, statsCaption, statsRow)

// ════════════════ the chart (ui-bar-chart, ADR-0107 v1 scope — board-wide, same posture as the stats) ═════
const chartSection = document.createElement('section')
chartSection.className = 'dc-chart'
chartSection.setAttribute('aria-labelledby', 'dc-chart-title')
const chartTitle = document.createElement('h2')
chartTitle.id = 'dc-chart-title'
chartTitle.className = 'dc-section-title'
chartTitle.textContent = 'Tickets by category'
// Same on-screen signal as statsCaption above, and for the same reason — this card is the OTHER board-wide
// one the priority filter leaves untouched.
const chartCaption = document.createElement('p')
chartCaption.className = 'dc-caption'
chartCaption.textContent = 'Board-wide across every ticket — unaffected by the priority filter below.'

const chart = document.createElement('ui-bar-chart') as UIBarChartElement
chart.label = 'Tickets by category'
chart.data = computeCategoryBreakdown(FIXTURE_RECORDS)
chartSection.append(chartTitle, chartCaption, chart)

// ════════════════ the table + the priority filter (ui-segmented-control — a single-select vehicle, never
// the workbench's multi-checkbox facet aggregation; SPEC-N3's residual doesn't apply here — a
// single-select filter needs no N-commits-into-one-array glue) ════════════════════════════════════════════
const tableSection = document.createElement('section')
tableSection.className = 'dc-table-section'
tableSection.setAttribute('aria-labelledby', 'dc-table-title')
const tableTitle = document.createElement('h2')
tableTitle.id = 'dc-table-title'
tableTitle.className = 'dc-section-title'
tableTitle.textContent = 'Support tickets'

const filterFieldWrap = document.createElement('ui-field')
filterFieldWrap.setAttribute('label', 'Priority')
const priorityFilter = document.createElement('ui-segmented-control') as UISegmentedControlElement
priorityFilter.name = 'priority-filter'

function segment(value: string, text: string, checked: boolean): HTMLElement {
  const node = document.createElement('ui-segment')
  node.setAttribute('value', value)
  if (checked) node.setAttribute('checked', '')
  node.textContent = text
  return node
}
priorityFilter.append(segment('all', 'All', true), segment('urgent', 'Urgent', false), segment('high', 'High', false))
filterFieldWrap.append(priorityFilter)

const table = document.createElement('ui-table') as UITableElement
table.label = 'Support tickets'
table.columns = TICKET_COLUMNS
table.rowKey = TICKET_ROW_KEY
table.rows = FIXTURE_RECORDS as unknown as UITableElement['rows']

const tableWrap = el('div', 'dc-table-wrap')
tableWrap.append(table)

tableSection.append(tableTitle, filterFieldWrap, tableWrap)

// ════════════════ the agent summary card (ui-surface-host, dashboard-summary.ts's recorded fixture) ═══════
const summarySection = document.createElement('section')
summarySection.className = 'dc-summary'
summarySection.setAttribute('aria-labelledby', 'dc-summary-title')
const summaryTitle = document.createElement('h2')
summaryTitle.id = 'dc-summary-title'
summaryTitle.className = 'dc-section-title'
summaryTitle.textContent = 'Agent summary'
summarySection.append(summaryTitle)

let summaryHost: UISurfaceHostElement | undefined
let currentSummaryKey: SummaryViewKey | undefined

/** Swap the mounted `ui-surface-host` for the given key — the workbench.ts `applySummaryKey` mechanism
 *  verbatim: `ingest()` is append-only, so switching payloads mints a fresh instance rather than
 *  re-ingesting into a disposed one. A no-op when the key is unchanged. */
function applySummaryKey(key: SummaryViewKey): void {
  if (key === currentSummaryKey) return
  currentSummaryKey = key
  summaryHost?.remove()
  const host = document.createElement('ui-surface-host') as UISurfaceHostElement
  host.wrap = true
  host.bare = true
  host.className = 'dc-summary-host'
  summarySection.append(host)
  summaryHost = host
  for (const line of summaryLines(key)) host.ingest(line)
  host.finalize()
}

// ════════════════ the ONE table.filter write site (the segmented control never reassigns table.rows) ══════
priorityFilter.addEventListener('change', () => {
  const value = priorityFilter.value
  const key = summaryViewKey(value)
  table.filter = (key === 'all' ? [] : [{ key: PRIORITY_FACET_KEY, values: [key === 'urgent' ? 'Urgent' : 'High'] }]) as unknown as UITableElement['filter']
  applySummaryKey(key)
})

// ════════════════ compose the content region — zero bespoke shell chrome, this page's own content only ════
dcContent.append(statsSection, chartSection, tableSection, summarySection)

applySummaryKey(summaryViewKey(priorityFilter.value)) // the initial 'all' key, before any interaction
