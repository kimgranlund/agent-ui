// workbench-summary.ts — the agent summary card's RECORDED fixture (SPEC-R9 · PRD-D4 ruled candidate (a) ·
// PRD-D5 ruled "recorded"). Two committed, validator-passing A2UI JSONL payloads (Card/Text/Stat catalog
// rows), keyed to distinct VIEW STATES: `'all'` (no facet filter and no search active) and `'filtered'`
// (either is active). `workbench-summary.test.ts` proves both payloads pass `@agent-ui/a2ui`'s shared
// validator (`validateA2ui`) BEFORE they are ever ingested by a real `ui-surface-host` — the same
// validate-before-ship discipline the `@agent-ui/a2ui/examples` seed shelf's own gate uses
// (`examples.test.ts`). No transport, no live turn — replayed straight through the published
// `ingest`/`finalize`/`dispose` seam (`surface-host.md`), the `createRecordedTransport` parity note's own
// contract: "the page is identical either way."
//
// Each message is the real `A2uiServerMessage` shape (`@agent-ui/a2ui`'s `protocol.ts`) — `ingest()` wants
// ONE JSONL LINE (a JSON string) at a time, never a parsed object, so `summaryLines()` below is what a page
// actually calls; `SUMMARY_MESSAGES` stays the typed, reviewable source of truth.

import type { A2uiServerMessage } from '@agent-ui/a2ui'

export type SummaryViewKey = 'all' | 'filtered'

const SURFACE_ID = 'workbench-summary'

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
          { id: 'title', component: 'Text', variant: 'h4', text: 'All accounts' },
          // `value` is a VIEW-STATE LABEL, never a row count — layout-checker B5: a recorded stat cannot
          // safely echo a number the live toolbar's own results count already reports (SPEC-R7), so this
          // Stat answers a question the toolbar doesn't ("is the view narrowed at all?"), never the SAME
          // question with a possibly-stale number.
          { id: 'stat', component: 'Stat', label: 'View', value: 'All', caption: 'No filter or search is active' },
          { id: 'caption', component: 'Text', variant: 'body', text: 'Showing the full account list — every seeded record.' },
        ],
      },
    },
  ],
  filtered: [
    { version: 'v1.0', createSurface: { surfaceId: SURFACE_ID, catalogId: 'agent-ui' } },
    {
      version: 'v1.0',
      updateComponents: {
        surfaceId: SURFACE_ID,
        components: [
          { id: 'root', component: 'Card', elevation: '1', children: ['content'] },
          { id: 'content', component: 'CardContent', children: ['title', 'stat', 'caption'] },
          { id: 'title', component: 'Text', variant: 'h4', text: 'Filtered view' },
          { id: 'stat', component: 'Stat', label: 'View', value: 'Filtered', caption: 'A search or status filter is narrowing the table' },
          {
            id: 'caption',
            component: 'Text',
            variant: 'body',
            text: 'Narrow further with search or the Status filter, or clear them to see every account again.',
          },
        ],
      },
    },
  ],
}

/** Exported so `workbench-summary.test.ts` can validate every key's message set — the ONE source both the
 *  test and `summaryLines()` read, never a duplicate. */
export function summaryMessages(key: SummaryViewKey): readonly A2uiServerMessage[] {
  return SUMMARY_MESSAGES[key]
}

/** The raw JSONL lines `ui-surface-host.ingest()` wants — one `JSON.stringify`d line per message, in
 *  order. A page calls `ingest()` once per line, then `finalize()`. */
export function summaryLines(key: SummaryViewKey): string[] {
  return SUMMARY_MESSAGES[key].map((message) => JSON.stringify(message))
}

/** SPEC-R9's view-key derivation: `'all'` only when NEITHER a facet filter NOR a search term is active;
 *  `'filtered'` otherwise. Binary and total — every workbench view state maps to exactly one committed
 *  summary key.
 *
 *  §2's full "view key" tuple is `filter + search + sort + page (+ selection count)` — this function
 *  narrows to filter/search only, deliberately: sort/page/selection change WHICH rows are visible or in
 *  what order, never WHETHER the set is narrowed — "all 25 accounts" vs "a narrowed subset" is the one
 *  fact a two-key recorded fixture can honestly distinguish. A future wave adding sort/page/selection-
 *  keyed summaries (e.g. "sorted by MRR descending") is a fixture-cardinality growth, not a reshape of
 *  this function's contract — SPEC-R9's own acceptance line ("≥2 keys… the rendered summary matches the
 *  CURRENT key") holds unchanged either way. */
export function summaryViewKey(state: { readonly filterActive: boolean; readonly searchActive: boolean }): SummaryViewKey {
  return state.filterActive || state.searchActive ? 'filtered' : 'all'
}
