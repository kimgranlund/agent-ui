// dashboard-summary.ts — the Support Dashboard's agent-summary RECORDED fixture (GH #499, M-F). Same
// discipline as workbench-summary.ts (SPEC-R9/PRD-D4/PRD-D5's ruled shape, the M-A MA-3 precedent this
// generalizes): committed, validator-passing A2UI JSONL payloads (Card/CardContent/Text/Stat catalog rows),
// replayed straight through the published `ingest`/`finalize` seam — no transport, no live turn.
//
// ONE deliberate growth past the workbench precedent, worth stating rather than silently copying: THREE
// keys, not two — 'all' | 'urgent' | 'high', one per ui-segmented-control segment on the dashboard page
// (dashboard.ts). workbench-summary.ts's own file banner named this as a *foreseen* extension, not this
// wave's work: "a future wave adding sort/page/selection-keyed summaries... is a fixture-cardinality
// growth, not a reshape of this function's contract." This page is that future wave for the CARDINALITY
// axis specifically (more distinct view-state keys, same recorded-not-live mechanism) — it does not touch
// the KIND of key (still one scalar view-state tag), so workbench-summary.ts's own contract is unchanged by
// this file existing alongside it.
import type { A2uiServerMessage } from '@agent-ui/a2ui'

export type SummaryViewKey = 'all' | 'urgent' | 'high'

const SURFACE_ID = 'dashboard-summary'

const SUMMARY_MESSAGES: Record<SummaryViewKey, readonly A2uiServerMessage[]> = {
  all: [
    { version: 'v1.0', createSurface: { surfaceId: SURFACE_ID, catalogId: 'agent-ui' } },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: SURFACE_ID,
        components: [
          { id: 'root', component: 'Card', elevation: '1', children: ['content'] },
          { id: 'content', component: 'CardContent', children: ['title', 'stat', 'caption'] },
          { id: 'title', component: 'Text', variant: 'h4', text: 'All tickets' },
          // `value` is a VIEW-STATE LABEL, never a row count — the workbench-summary.ts B5 rule, carried
          // over unchanged: a recorded stat cannot safely echo a number the live stat row already reports.
          { id: 'stat', component: 'Stat', label: 'Queue view', value: 'All priorities', caption: 'No priority filter is active' },
          { id: 'caption', component: 'Text', variant: 'body', text: 'Showing every seeded ticket across all four priority tiers.' },
        ],
      },
    },
  ],
  urgent: [
    { version: 'v1.0', createSurface: { surfaceId: SURFACE_ID, catalogId: 'agent-ui' } },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: SURFACE_ID,
        components: [
          { id: 'root', component: 'Card', elevation: '1', children: ['content'] },
          { id: 'content', component: 'CardContent', children: ['title', 'stat', 'caption'] },
          { id: 'title', component: 'Text', variant: 'h4', text: 'Urgent tickets' },
          { id: 'stat', component: 'Stat', label: 'Queue view', value: 'Urgent only', caption: 'Narrowed to the Urgent priority tier' },
          { id: 'caption', component: 'Text', variant: 'body', text: 'These need a response first — clear the filter to see the full queue again.' },
        ],
      },
    },
  ],
  high: [
    { version: 'v1.0', createSurface: { surfaceId: SURFACE_ID, catalogId: 'agent-ui' } },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: SURFACE_ID,
        components: [
          { id: 'root', component: 'Card', elevation: '1', children: ['content'] },
          { id: 'content', component: 'CardContent', children: ['title', 'stat', 'caption'] },
          { id: 'title', component: 'Text', variant: 'h4', text: 'High-priority tickets' },
          { id: 'stat', component: 'Stat', label: 'Queue view', value: 'High only', caption: 'Narrowed to the High priority tier' },
          { id: 'caption', component: 'Text', variant: 'body', text: 'The next tier down from the top — worth a look once that top tier is covered.' },
        ],
      },
    },
  ],
}

/** Exported so `dashboard-summary.test.ts` can validate every key's message set — the ONE source both the
 *  test and `summaryLines()` read, never a duplicate (the workbench-summary.ts precedent). */
export function summaryMessages(key: SummaryViewKey): readonly A2uiServerMessage[] {
  return SUMMARY_MESSAGES[key]
}

/** The raw JSONL lines `ui-surface-host.ingest()` wants — one `JSON.stringify`d line per message, in
 *  order. A page calls `ingest()` once per line, then `finalize()`. */
export function summaryLines(key: SummaryViewKey): string[] {
  return SUMMARY_MESSAGES[key].map((message) => JSON.stringify(message))
}

/** dashboard.ts's own view-key derivation: the ui-segmented-control's `value` IS the key directly (no
 *  aggregation step — unlike workbench's filter+search binary fold, this page's filter is already a single
 *  scalar selection, so the mapping is the identity function over the three legal values). Falls back to
 *  'all' for any unrecognized/empty value (the HTMLSelectElement.value "no match resolves to unselected"
 *  precedent segmented-control.md's own `value` setter names — never a silent undefined key). */
export function summaryViewKey(segmentValue: string | null): SummaryViewKey {
  return segmentValue === 'urgent' || segmentValue === 'high' ? segmentValue : 'all'
}
