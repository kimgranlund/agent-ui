// site/pages/table-doc.ts — the ui-table API doc page (tier=display ⇒ {doc} only, ADR-0111 /
// report-family.lld.md LLD-C11). DERIVED from `table.md` via the shared doc-page.ts renderer: the attribute
// table is built from the parsed `attributes[]`, the parts[] surface renders as the descriptor-derived Parts
// table (scroll/table/caption/thead/tbody), and the prose from the body — so neither can drift from the
// descriptor the contract trip-wire enforces (ADR-0004, one parser / two consumers). The specimen DATA are
// hand-authored (a doc page has no source to derive representative data from): a real revenue-by-region table,
// plus one degenerate strip exercising every SPEC-R3 cell-resolution case (missing/finite/non-finite/string/
// foreign value) as a live visual fixture (the bar-chart precedent).
import { mountPage } from './_page.ts' // FIRST: foundation CSS cascade + self-defining ui-* controls (ADR-0003)
import { loadTableDoc } from '../lib/frontmatter.ts'
import { composeDocPage, heading } from '../lib/doc-page.ts'

interface Column {
  readonly key: string
  readonly label: string
  readonly type?: 'string' | 'number'
}

// A representative revenue table — string + number columns, the canonical report-family job. HAND-AUTHORED:
// a doc page has no descriptor source for example content (SPEC-R9's example-content bar).
const REVENUE_COLUMNS: readonly Column[] = [
  { key: 'region', label: 'Region' },
  { key: 'revenue', label: 'Revenue', type: 'number' },
  { key: 'status', label: 'Status' },
]
const REVENUE_ROWS: readonly Record<string, string | number>[] = [
  { region: 'EMEA', revenue: 42000, status: 'On track' },
  { region: 'Americas', revenue: 58230, status: 'Ahead' },
  { region: 'APAC', revenue: 31500, status: 'At risk' },
  { region: 'LATAM', revenue: 12800, status: 'On track' },
]

// The SPEC-R3 cell-resolution matrix, made a live visual fixture: every documented case in one table — a
// missing key, a finite number, a non-finite number, a string in a number column, and a foreign value
// (boolean/array/object), each resolving through resolveCell with no throw.
const DEGENERATE_COLUMNS: readonly Column[] = [
  { key: 'case', label: 'Case' },
  { key: 'value', label: 'Value', type: 'number' },
]
const DEGENERATE_ROWS: readonly Record<string, unknown>[] = [
  { case: 'missing key' }, // no `value` key at all → empty cell
  { case: 'finite number', value: 1024 }, // Intl.NumberFormat → "1,024"
  { case: 'non-finite number', value: Number.NaN }, // → "—"
  { case: 'string in a number column', value: 'n/a' }, // rendered verbatim, never coerced
  { case: 'foreign value (array)', value: [1, 2, 3] }, // dropped → empty cell, row survives
]

const { descriptor, body } = loadTableDoc()

const { content } = mountPage({
  title: 'ui-table — API',
  intro:
    'The Display-class data table (ADR-0111, report family v1; widened in place by ADR-0163) — typed columns + ' +
    'record rows rendered as a real native <table> in light DOM, with four opt-in capabilities all default OFF: ' +
    'row selection (selectable/row-key/selected), per-column sort, control-owned search + facet filter, and ' +
    'pagination (page-size/page). Not form-associated, no cell renderers, no role=grid. Generated from ' +
    'table.md: the attribute and parts tables are descriptor-derived (they cannot drift); the live tables ' +
    'below show a representative report and every SPEC-R3 cell-resolution case — the capabilities themselves ' +
    'are exercised live on the Demo tab.',
})

composeDocPage(content, descriptor, body, renderSpecimens())

// EXPORTED (GH #882) so the width-drift gate (table-doc.browser.test.ts) mounts the SAME specimens this page
// renders — never a hand-rebuilt copy that could quietly diverge from what a reader actually sees.
export function renderSpecimens(): HTMLElement {
  const section = document.createElement('section')
  section.append(
    heading(2, 'Examples'),
    labelledTable('Revenue report', 'A representative report — string and number columns, an end-aligned numeric column with tabular numerals.', REVENUE_COLUMNS, REVENUE_ROWS, 'Revenue by region'),
    labelledTable('Degenerate: every SPEC-R3 cell case', 'Missing key, finite/non-finite number, a string in a number column, and a foreign (array) value — each resolves to a paintable cell, never a throw.', DEGENERATE_COLUMNS, DEGENERATE_ROWS, 'Cell-resolution cases'),
  )
  return section
}

function labelledTable(title: string, description: string, columns: readonly Column[], rows: readonly Record<string, unknown>[], label: string): HTMLElement {
  const wrap = document.createElement('div')
  wrap.style.cssText = 'margin:0.5rem 0 1.75rem;'
  const desc = document.createElement('p')
  desc.textContent = description

  const table = document.createElement('ui-table')
  table.setAttribute('columns', JSON.stringify(columns))
  table.setAttribute('rows', JSON.stringify(rows))
  table.setAttribute('label', label)
  // GH #882 — NO width cap here: an artificial `max-inline-size:32rem` used to clip these specimens well
  // short of the real content column, contradicting the control's own SPEC-R5 fill-the-host contract
  // (table.css: `table { inline-size: 100% }` — "a narrow table fills the host, no orphaned gutter"). The
  // cap had no site-wide precedent (no other page's specimen constrains a control's own intrinsic width)
  // and no documented rationale — a docs-example gap, not a deliberate presentation choice (issue Findings).
  // A representative specimen demonstrates the control's REAL behaviour: full width, same as a consuming
  // app's own content column would give it.

  wrap.append(heading(3, title), desc, table)
  return wrap
}
