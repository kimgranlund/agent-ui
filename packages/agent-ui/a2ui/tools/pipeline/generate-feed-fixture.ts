// generate-feed-fixture.ts — LLD-C4: a dev-only Node script (never imported by src/, never a standing
// gate) that (re)generates the committed artifact-feed fixture deterministically, composed ONLY through
// the LLD-C1/C2 builders (`wrapServerTurn`/`wrapClientTurn`) — never hand-typed A2A envelopes — so the
// fixture is provably shaped exactly the way the bridge module itself produces wire messages. Run with:
//   npx tsx packages/agent-ui/a2ui/tools/pipeline/generate-feed-fixture.ts
//
// Composed ONLY from the existing default catalog (vocabulary honesty, LLD §5 — no Chart type exists).
// Three exchanges, two artifact classes: (1) a Card/CardHeader/CardContent + Grid metric-tile report with
// a Refresh Button (the stats-grid-dashboard seed idiom); (2) a List-templated report table over
// updateDataModel rows (the dynamic-lists seed idiom); (3) one prose-only exchange (no DataPart), proving
// the feed renders MIXED messages, not artifact-only.
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { A2uiServerMessage } from '../../src/protocol.ts'
import { wrapClientTurn, wrapServerTurn } from './transports/a2a.ts'

const HERE = dirname(fileURLToPath(import.meta.url))
const FIXTURE_PATH = join(HERE, 'fixtures', 'artifact-feed.a2a.jsonl')

const CONTEXT_ID = 'ctx-artifact-feed'
const PROVENANCE_DATE = '2026-07-08'

// ── exchange 1: the Q2 revenue report — Card/CardHeader/CardContent + a Grid of metric tiles + a Refresh
//    button (LLD §5 fact 1) ──────────────────────────────────────────────────────────────────────────
const REVENUE_SURFACE = 'revenue-report'
const revenueMessages: A2uiServerMessage[] = [
  { version: 'v1.0', createSurface: { surfaceId: REVENUE_SURFACE, catalogId: 'agent-ui' } },
  {
    version: 'v1.0',
    updateDataModel: {
      surfaceId: REVENUE_SURFACE,
      value: {
        stats: [
          { label: 'Revenue', value: '2.4', unit: 'M€' },
          { label: 'Growth', value: '+12', unit: '%' },
          { label: 'New customers', value: '340', unit: '' },
          { label: 'Churn', value: '2.1', unit: '%' },
        ],
      },
    },
  },
  {
    version: 'v1.0',
    updateComponents: {
      surfaceId: REVENUE_SURFACE,
      components: [
        { id: 'root', component: 'Card', elevation: '1', children: ['header', 'content'] },
        { id: 'header', component: 'CardHeader', children: ['title'] },
        { id: 'title', component: 'Text', variant: 'h4', text: 'Q2 Revenue Report' },
        { id: 'content', component: 'CardContent', children: ['col'] },
        { id: 'col', component: 'Column', gap: 'md', children: ['grid', 'actions'] },
        { id: 'grid', component: 'Grid', gap: 'md', min: '12rem', children: { path: '/stats', componentId: 'stat_tile' } },
        { id: 'stat_tile', component: 'Card', elevation: '1', children: ['stat_content'] },
        { id: 'stat_content', component: 'CardContent', children: ['stat_col'] },
        { id: 'stat_col', component: 'Column', gap: 'xs', children: ['stat_label', 'stat_value'] },
        { id: 'stat_label', component: 'Text', variant: 'caption', text: { path: 'label' } },
        { id: 'stat_value', component: 'Text', variant: 'h3', text: '${value}${unit}' },
        { id: 'actions', component: 'Row', gap: 'md', justify: 'end', children: ['btn_refresh'] },
        { id: 'btn_refresh', component: 'Button', variant: 'solid', label: 'Refresh data', action: { action: 'refresh_revenue' } },
      ],
    },
  },
]

// ── exchange 2: revenue by region — a List-templated report table over updateDataModel rows (LLD §5
//    fact 2, the dynamic-lists seed idiom) ──────────────────────────────────────────────────────────
const REGION_SURFACE = 'revenue-by-region'
const regionMessages: A2uiServerMessage[] = [
  { version: 'v1.0', createSurface: { surfaceId: REGION_SURFACE, catalogId: 'agent-ui' } },
  {
    version: 'v1.0',
    updateDataModel: {
      surfaceId: REGION_SURFACE,
      value: {
        regions: [
          { region: 'North America', revenue: '1.1M€', share: '46%' },
          { region: 'Europe', revenue: '0.8M€', share: '33%' },
          { region: 'Asia-Pacific', revenue: '0.5M€', share: '21%' },
        ],
      },
    },
  },
  {
    version: 'v1.0',
    updateComponents: {
      surfaceId: REGION_SURFACE,
      components: [
        { id: 'root', component: 'Column', gap: 'md', children: ['title', 'table'] },
        { id: 'title', component: 'Text', variant: 'h4', text: 'Revenue by region' },
        { id: 'table', component: 'List', gap: 'sm', children: { path: '/regions', componentId: 'region_row' } },
        { id: 'region_row', component: 'Card', elevation: '1', children: ['region_content'] },
        { id: 'region_content', component: 'CardContent', children: ['region_row_inner'] },
        { id: 'region_row_inner', component: 'Row', justify: 'between', align: 'center', gap: 'md', children: ['region_name', 'region_stats'] },
        { id: 'region_name', component: 'Text', variant: 'body', text: { path: 'region' } },
        { id: 'region_stats', component: 'Text', variant: 'caption', text: '${revenue} · ${share}' },
      ],
    },
  },
]

function buildLines(): string[] {
  const header = { a2aFeed: { protocolVersion: '0.3.0', a2ui: 'v1.0', provenance: { source: 'authored', date: PROVENANCE_DATE } } }
  const lines: unknown[] = [header]

  lines.push(wrapClientTurn({ text: 'Show me the Q2 revenue report.' }, { messageId: 'u1', contextId: CONTEXT_ID }))
  lines.push(wrapServerTurn(revenueMessages, { messageId: 'a1', contextId: CONTEXT_ID, prose: "Here's the Q2 revenue report." }))

  lines.push(wrapClientTurn({ text: 'Break revenue down by region.' }, { messageId: 'u2', contextId: CONTEXT_ID }))
  lines.push(wrapServerTurn(regionMessages, { messageId: 'a2', contextId: CONTEXT_ID, prose: 'Here is the regional breakdown.' }))

  // exchange 3: prose-only both ways — no DataPart at all (LLD §5 fact 3, the mixed-message proof).
  lines.push(wrapClientTurn({ text: "Thanks — that's helpful." }, { messageId: 'u3', contextId: CONTEXT_ID }))
  lines.push(wrapServerTurn([], { messageId: 'a3', contextId: CONTEXT_ID, prose: "You're welcome! Let me know if you'd like a deeper breakdown." }))

  return lines.map((l) => JSON.stringify(l))
}

const content = `${buildLines().join('\n')}\n`
writeFileSync(FIXTURE_PATH, content, 'utf8')
// eslint-disable-next-line no-console -- a one-off generation script, stdout is the operator feedback
console.log(`wrote ${FIXTURE_PATH} (${buildLines().length} lines)`)
