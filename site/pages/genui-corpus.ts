// site/pages/genui-corpus.ts — LLD-C5 (GH #1584, genui-b3-judged-eval.lld.md §7): the GenUI B3 judged
// pack-idiom eval's results page. A minimal new page (no A2UI corpus results page exists today either —
// the `data-doc.ts`/ungrouped-site-level posture, `site/pages/_page.ts`'s own precedent), following
// `mountPage` first + `el`/`exampleSection` from `lib/specimens.ts`.
//
// Inputs (LLD §7 — exactly two, both static Vite imports, zero network): `index.json` (the summary
// `report` already derived) + every committed `records/v1/*.jsonl` shard's raw text (`?raw`, the
// `a2a-artifact-feed.ts` precedent). This page NEVER computes a score — it presents `index.json`
// verbatim; `renderCorpus(index, shards, root)` is the testable seam (LLD §7's own name for it),
// exported so `genui-corpus.test.ts` can drive it with a fixture index/shard, never the committed
// (empty) data.
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import './genui-corpus.css'
import { el } from '../lib/specimens.ts'
import type { UISandboxFrameElement } from '@agent-ui/components/components'
// Type-only, from the PURE core (never from tools/corpus-genui/legs/report.ts, whose own node:*/fs.ts
// imports would otherwise drag into this site's type program — site/tsconfig.json carries no node
// types, the SAME constraint vitest.config.ts's own `@agent-ui/a2ui/agent/*` alias comments name).
import type { GenuiCorpusIndex, GenuiCorpusIndexRecordRow } from '../../packages/agent-ui/a2ui/src/corpus-genui/index-shape.ts'
import type { GenuiCorpusRecord } from '../../packages/agent-ui/a2ui/src/corpus-genui/record.ts'

// The committed, derived summary (`report`'s own output — LLD §5). Ships with `m3:null`, zero records
// at build time (the no-fabrication law, LLD §0) — the empty state below is what actually ships tonight.
import indexData from '../../packages/agent-ui/a2ui/corpus-genui/index.json'

// Every committed shard's raw jsonl text, keyed by its resolved path — an EMPTY object at ship (no
// records/v1/*.jsonl exist yet); `import.meta.glob` never requires the directory to exist.
const shardModules = import.meta.glob('../../packages/agent-ui/a2ui/corpus-genui/records/v1/*.jsonl', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const { content } = mountPage({
  title: 'GenUI Corpus Eval',
  intro:
    'The judged pack-idiom eval (PRD §8 m3): a judge-scored ≥ 4/5 verdict against the ' +
    'genui-pack-idiom rubric for demonstrable use of the picked pack’s idioms. This page presents ' +
    '`corpus-genui/index.json` verbatim — it never computes a score itself. The judged run is a NAMED ' +
    'MANUAL run (never `npm test`/`test:browser`) — see `packages/agent-ui/a2ui/corpus-genui/README.md`.',
})

/** Every shard's lines, keyed by record `name` — the page's ONLY source of `html`/`surfaceId` (the
 *  index row itself carries neither, LLD §5's own schema). */
function parseShards(shards: Record<string, string>): Map<string, GenuiCorpusRecord> {
  const byName = new Map<string, GenuiCorpusRecord>()
  for (const text of Object.values(shards)) {
    for (const line of text.split('\n')) {
      if (line.trim() === '') continue
      const rec = JSON.parse(line) as GenuiCorpusRecord
      byName.set(rec.name, rec)
    }
  }
  return byName
}

/** The m3 panel — `floorMet` verdict, judged/passed/passRate/min/mean, a per-pack row, the control delta
 *  when present (LLD §7 layout point 2). The EMPTY state (`m3:null`, what ships tonight) says so
 *  plainly, names the exact runbook invocation, and renders NO placeholder numbers (LLD §7). */
function m3Panel(index: GenuiCorpusIndex): HTMLElement {
  const panel = el('div', { class: 'genui-corpus-m3', 'data-testid': 'm3-panel' })
  if (index.m3 === null) {
    panel.append(
      el('p', { role: 'status' }, [
        document.createTextNode(
          'No judged run yet — run `npm run eval:genui-corpus -- generate` / `judge` / `apply` / `report` (needs ANTHROPIC_API_KEY).',
        ),
      ]),
    )
    return panel
  }
  const { m3 } = index
  panel.setAttribute('data-floor-met', String(m3.floorMet))
  panel.append(
    el('p', {}, [
      document.createTextNode(
        `floorMet: ${String(m3.floorMet)} · judged: ${m3.judged} · passed: ${m3.passed} · ` +
          `passRate: ${(m3.passRate * 100).toFixed(0)}% · minScore: ${m3.minScore} · meanScore: ${m3.meanScore.toFixed(2)}`,
      ),
    ]),
  )
  const list = document.createElement('ul')
  for (const [packId, row] of Object.entries(m3.perPack).sort(([a], [b]) => (a < b ? -1 : 1))) {
    const li = document.createElement('li')
    li.textContent = `${packId}: judged=${row.judged} passed=${row.passed} meanD2=${row.meanD2.toFixed(2)} minScore=${row.minScore}`
    list.append(li)
  }
  panel.append(list)
  if (m3.control) {
    panel.append(
      el('p', {}, [document.createTextNode(`control delta: judged=${m3.control.judged} meanD2=${m3.control.meanD2.toFixed(2)}`)]),
    )
  }
  return panel
}

function cell(text: string): HTMLTableCellElement {
  const td = document.createElement('td')
  td.textContent = text
  return td
}

/** Per-JUDGED-row disclosure (LLD §7 layout point 4): a REAL `ui-sandbox-frame` mounts LAZILY, only on
 *  the disclosure's open transition — an unopened page mounts zero iframes. */
function judgedDetailCell(record: GenuiCorpusRecord, row: GenuiCorpusIndexRecordRow): HTMLTableCellElement {
  const td = document.createElement('td')
  const disclosure = document.createElement('ui-disclosure')
  disclosure.setAttribute('summary', 'View surface')
  let mounted = false
  disclosure.addEventListener('toggle', () => {
    if (mounted || !disclosure.hasAttribute('open')) return
    mounted = true
    const detail = el('div', { class: 'genui-corpus-detail' })
    const frame = document.createElement('ui-sandbox-frame') as UISandboxFrameElement
    frame.surfaceId = record.surfaceId
    frame.html = record.html
    detail.append(frame)
    if (row.rationale !== undefined) {
      detail.append(el('p', { class: 'genui-corpus-rationale' }, [document.createTextNode(row.rationale)]))
    }
    disclosure.append(detail)
  })
  td.append(disclosure)
  return td
}

function recordRow(row: GenuiCorpusIndexRecordRow, record: GenuiCorpusRecord | undefined): HTMLTableRowElement {
  const tr = document.createElement('tr')
  tr.dataset.recordName = row.name
  tr.append(
    cell(row.name),
    cell(row.packId ?? 'control'),
    cell(row.promptId),
    cell(row.model ?? '—'),
    cell(row.status),
    cell(row.qualityScore !== undefined ? String(row.qualityScore) : '—'),
    cell(row.failingDimensions !== undefined && row.failingDimensions.length > 0 ? row.failingDimensions.join(', ') : '—'),
    cell(row.verdictDate ?? '—'),
    cell(row.htmlHash.slice(0, 8)),
  )
  tr.append(row.status === 'judged' && record !== undefined ? judgedDetailCell(record, row) : document.createElement('td'))
  return tr
}

/** The record table (LLD §7 layout point 3): one row per record. Zero rows (the empty state) renders
 *  headers only — never a placeholder/sample row. */
function recordTable(index: GenuiCorpusIndex, shards: Map<string, GenuiCorpusRecord>): HTMLElement {
  const table = document.createElement('table')
  table.className = 'genui-corpus-table'
  const thead = document.createElement('thead')
  const headRow = document.createElement('tr')
  for (const h of ['Name', 'Pack', 'Prompt', 'Model', 'Status', 'Score', 'Failing', 'Verdict date', 'Hash', 'Surface']) {
    const th = document.createElement('th')
    th.textContent = h
    headRow.append(th)
  }
  thead.append(headRow)
  table.append(thead)

  const tbody = document.createElement('tbody')
  for (const row of index.records) tbody.append(recordRow(row, shards.get(row.name)))
  table.append(tbody)
  return table
}

/** The whole page render — LLD §7's testable seam. `index`/`shards` are injected so a test drives the
 *  fixture-rendered path without touching the committed (empty) data. */
export function renderCorpus(index: GenuiCorpusIndex, shards: Record<string, string>, root: HTMLElement): void {
  root.replaceChildren()
  const byName = parseShards(shards)
  root.append(
    m3Panel(index),
    el('p', { class: 'genui-corpus-count' }, [document.createTextNode(`${index.records.length} record${index.records.length === 1 ? '' : 's'}`)]),
    recordTable(index, byName),
  )
}

const root = el('div', { class: 'genui-corpus-root' })
content.append(root)
renderCorpus(indexData as GenuiCorpusIndex, shardModules, root)
