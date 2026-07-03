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
// Zero-dep, platform-neutral (SPEC-N5/ADR-0062): no imports beyond the local `record.ts` types.

import type { CorpusRecord } from './record.ts'

export interface RetrieveQuery {
  intent: string
  k: number
  catalogId: string
  protocolVersion: string
}

const TOKEN_RE = /[a-z0-9]+/g

function tokenize(text: string): string[] {
  return text.toLowerCase().match(TOKEN_RE) ?? []
}

function documentText(rec: CorpusRecord): string {
  const components = rec.meta.componentsUsed ?? []
  return `${rec.promptText} ${components.join(' ')}`
}

function termCounts(tokens: string[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const t of tokens) counts.set(t, (counts.get(t) ?? 0) + 1)
  return counts
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

  const docCounts = scope.map((r) => termCounts(tokenize(documentText(r))))

  const df = new Map<string, number>()
  for (const counts of docCounts) {
    for (const term of counts.keys()) df.set(term, (df.get(term) ?? 0) + 1)
  }
  const n = scope.length
  const idf = (term: string): number => {
    const d = df.get(term)
    return d === undefined ? 0 : Math.log((n + 1) / (d + 1)) + 1
  }

  const docNorms = docCounts.map((counts) => {
    let sumSq = 0
    for (const [term, tf] of counts) {
      const w = tf * idf(term)
      sumSq += w * w
    }
    return Math.sqrt(sumSq)
  })

  const queryCounts = termCounts(tokenize(query.intent))
  let queryNormSq = 0
  for (const [term, tf] of queryCounts) {
    const w = tf * idf(term)
    queryNormSq += w * w
  }
  const queryNorm = Math.sqrt(queryNormSq)
  if (queryNorm === 0) return []

  const scored = scope.map((record, i) => {
    let dot = 0
    for (const [term, qtf] of queryCounts) {
      const dtf = docCounts[i].get(term)
      if (dtf === undefined) continue
      dot += qtf * idf(term) * dtf * idf(term)
    }
    const denom = queryNorm * docNorms[i]
    return { record, score: denom === 0 ? 0 : dot / denom }
  })

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return a.record.name < b.record.name ? -1 : a.record.name > b.record.name ? 1 : 0
  })

  return scored.slice(0, query.k).map((s) => s.record)
}
