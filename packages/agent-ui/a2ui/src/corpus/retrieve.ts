// retrieve.ts — the retriever (corpus LLD-C9, SPEC-R11/N2).
//
// Zero-dep TF-IDF cosine top-k ranking over `promptText` + `meta.componentsUsed`, scoped to a
// catalogId/protocolVersion pin. Signature note: the LLD §9 prose describes this as "pure over the
// store handle" (`retrieve(store, {intent, k, catalogId, protocolVersion})`), but this slice's
// decomposition entry (a2ui-corpus-store.decomp.json, node n10) draws its only build dependency from
// record.ts (n3→n10) — LLD-C1's store.ts is neither built yet at this slice's dispatch nor listed as a
// dependency edge. `retrieve()` therefore takes a plain `records` array rather than a `CorpusStore`
// handle; a caller composes `retrieve(store.all(...), query)` once the store lands. Flagged to the team
// lead as a signature reconciliation point for whoever wires this into `admit.ts`/the streaming driver.
//
// Facet/status exclusion (escalated, not LLD-C9-explicit): the SPEC frames retrieval as one of three
// "exemplar" conditioning modes alongside few-shot export and fine-tune export (SPEC overview line 34,
// PRD-D1), and LLD §9's exporter bullet (LLD-C10) explicitly scopes to `facet:"exemplar"` — but the
// LLD-C9 bullet for THIS module does not repeat the filter. Implemented here as a hard, defensive
// invariant: only `facet:"exemplar"`, non-`"quarantined"` records are ever eligible, regardless of what
// the caller passes in, so an eval-facet or quarantined record can never surface in a retrieval result.
// Flagged to the team lead in case the LLD should be amended to state this explicitly.
//
// Zero-dep, platform-neutral (SPEC-N5/ADR-0062): no imports beyond the local `record.ts` types and the
// shared `text-similarity.ts` tokenizer/cosine primitives (ADR-0091 §2 — extracted so there is exactly
// ONE implementation of the math; `selectMiniSkills` is the other caller).

import type { CorpusRecord } from './record.ts'
import { topKByCosine } from './text-similarity.ts'

export interface RetrieveQuery {
  intent: string
  k: number
  catalogId: string
  protocolVersion: string
}

function documentText(rec: CorpusRecord): string {
  const components = rec.meta.componentsUsed ?? []
  return `${rec.promptText} ${components.join(' ')}`
}

/**
 * TF-IDF cosine top-k retrieval (SPEC-R11) over `promptText` + `meta.componentsUsed`, scoped to
 * `query.catalogId`/`query.protocolVersion` and restricted to non-quarantined exemplar records.
 *
 * Never throws. Resolves to `[]` for: an empty `records` input, an empty scope after filtering
 * (SPEC-R11 AC2), `query.k <= 0`, or a query whose tokens share zero vocabulary with the scope — a
 * zero-norm query vector makes cosine similarity undefined for every candidate, so this is treated as
 * a genuine "no match" rather than an arbitrary top-k of zero-scored records.
 *
 * Ties are broken by ascending `name` (unique per record, LLD §2) for a deterministic result order.
 */
export function retrieve(records: readonly CorpusRecord[], query: RetrieveQuery): CorpusRecord[] {
  if (query.k <= 0) return []

  const scope = records.filter(
    (r) =>
      r.meta.catalogId === query.catalogId &&
      r.meta.protocolVersion === query.protocolVersion &&
      r.meta.facet === 'exemplar' &&
      r.meta.status !== 'quarantined',
  )
  if (scope.length === 0) return []

  return topKByCosine(scope, documentText, query.intent, query.k, (a, b) =>
    a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
  )
}
