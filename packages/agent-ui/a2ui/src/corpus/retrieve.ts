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
// ADR-0231 cl.4 widens the eligible facet to the model-visible class through an OPT-IN `facet` field
// whose default is `exemplar`, so every existing caller is byte-identical. `eval` is not a
// `ModelVisibleFacet` and so cannot be named: the held-out class never surfaces, by construction.
//
// Zero-dep, platform-neutral (SPEC-N5/ADR-0062): no imports beyond the local `record.ts` types and the
// shared `text-similarity.ts` tokenizer/cosine primitives (ADR-0091 §2 — extracted so there is exactly
// ONE implementation of the math; `selectMiniSkills` is the other caller). Also the pure `base-id.ts`:
// ADR-0243 cl.3 matches the catalog scope on the BASE segment of `query.catalogId`, so a derived
// `<base>--<persona>` turn retrieves its base's exemplars.
//
// T-0238: the domain rule, mirroring `selectMiniSkills`. A record's domains are those of the domain-layer types it
// uses (`catalog/layers.ts`, pure data over the import-free id grammar). On a turn that selects domains, a record
// of another domain never surfaces and the turn's own domain composites rank first; the rest of `k` comes from the
// remaining records with a positive score only, so zero-score records no longer pad the few-shot block (round 2:
// a Croupier "Deal again" turn got agent-roster-drawer and booking-reservation that way). A base turn selects no
// domain and keeps every record.
//
// T-0240: the scope rule. A record stamped with a derived `<base>--<persona>` id (a persona shard, so it uses that
// persona's fragment types) is in scope only on a turn whose catalog id IS that id; a record stamped with a base id
// stays in scope for its base and every catalog derived from it. A croupier turn draws on the base and croupier
// shards, a concierge turn never sees a croupier record, and a base turn sees neither.
//
// T-0253: the family rule, games only. A persona turn's composite family is the types its fragment homes
// (`personas/<persona>`: CardTable and PlayingCard for croupier). Each game is its own family, so when the family is
// non-empty a games record ranks first only if it uses a family type. Other domains keep the T-0238 order, because their
// composites serve one job together (a concierge turn still ranks the ServiceCard gateway first).
//
// T-0273: another game's composite (a board on a card table's turn) never surfaces on a family turn. Under T-0253 it
// competed with the rest on a positive score, so "Hit." ranked the Battleship board second on shared vocabulary.

import type { CorpusRecord, ModelVisibleFacet } from './record.ts'
import { baseCatalogId } from './base-id.ts'
import { CATALOG_LAYER_MAP, selectedDomains } from '../catalog/layers.ts'
import { splitCatalogId } from '../catalog/catalog-id.ts'
import { topKByCosine } from './text-similarity.ts'

export interface RetrieveQuery {
  intent: string
  k: number
  catalogId: string
  protocolVersion: string
  /** The model-visible facet to draw from (ADR-0231 cl.4). Omitted means `exemplar`, the pre-ADR scope. */
  facet?: ModelVisibleFacet
  /** T-0202 (catalog architecture CA-R4): the effective catalog's component types. When given, a record whose
   *  `meta.componentsUsed` names a type outside it is never retrieved, so an exemplar never teaches a type the
   *  turn cannot emit (a base turn after a type moved to a domain). Omitted: no type filter. */
  componentTypes?: readonly string[]
}

function documentText(rec: CorpusRecord): string {
  const components = rec.meta.componentsUsed ?? []
  return `${rec.promptText} ${components.join(' ')}`
}

/** T-0238: the domains of the domain-layer types a record uses (`[]` for a core-only record). */
function recordDomains(rec: CorpusRecord): string[] {
  const out = new Set<string>()
  for (const t of rec.meta.componentsUsed ?? []) {
    const row = Object.hasOwn(CATALOG_LAYER_MAP, t) ? CATALOG_LAYER_MAP[t]! : undefined
    if (row?.layer === 'domain' && row.domain !== undefined) out.add(row.domain)
  }
  return [...out]
}

/** T-0253: the domains whose composites are rival families (one game each), ranked by the persona's own family. */
const FAMILY_DOMAINS: readonly string[] = ['games']

/** T-0253: the domain-layer types a `<base>--<persona>` id's fragment homes (`[]` for a base id). */
function familyTypes(catalogId: string): Set<string> {
  const { tail } = splitCatalogId(catalogId)
  const home = `personas/${tail}`
  return new Set(tail === undefined ? [] : Object.entries(CATALOG_LAYER_MAP).flatMap(([t, r]) => (r.layer === 'domain' && r.home === home ? [t] : [])))
}

/**
 * TF-IDF cosine top-k retrieval (SPEC-R11) over `promptText` + `meta.componentsUsed`, scoped to
 * `query.catalogId`/`query.protocolVersion` and restricted to non-quarantined records of one
 * model-visible facet (`query.facet`, default `exemplar`). The catalog scope is the base of
 * `query.catalogId` plus, for a derived id, the records stamped with exactly that id (T-0240).
 *
 * T-0238: on a turn whose catalog selects domains (`selectedDomains`), a record using another domain's type is out
 * of scope, the turn's own domain records rank first (all of them, best match first), and the remaining slots take
 * only records that score above zero. Fewer than `k` results is the honest answer when nothing else matches.
 * T-0253: on a persona turn whose fragment homes domain types, a games record ranks first only if it uses one of them;
 * T-0273: a games record that uses none of them is out of scope on that turn.
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

  const facet: ModelVisibleFacet = query.facet ?? 'exemplar'
  const base = baseCatalogId(query.catalogId) // ADR-0243 cl.3: a derived `<base>--<persona>` query draws from the base shard
  const emittable = query.componentTypes === undefined ? undefined : new Set(query.componentTypes)
  const scope = records.filter(
    (r) =>
      (r.meta.catalogId === base || r.meta.catalogId === query.catalogId) && // T-0240: a persona shard only on its own turn
      r.meta.protocolVersion === query.protocolVersion &&
      r.meta.facet === facet &&
      r.meta.status !== 'quarantined' &&
      (emittable === undefined || (r.meta.componentsUsed ?? []).every((t) => emittable.has(t))),
  )
  if (scope.length === 0) return []

  const byName = (a: CorpusRecord, b: CorpusRecord): number => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)
  const selected = selectedDomains(query.catalogId)
  const family = familyTypes(query.catalogId)
  const ofFamily = (r: CorpusRecord, domains: readonly string[]): boolean =>
    family.size === 0 || !domains.some((d) => FAMILY_DOMAINS.includes(d)) || (r.meta.componentsUsed ?? []).some((t) => family.has(t))
  const own: CorpusRecord[] = []
  const rest: CorpusRecord[] = []
  for (const r of scope) {
    const domains = recordDomains(r)
    if (selected.length > 0 && domains.some((d) => !selected.includes(d))) continue
    if (selected.length > 0 && !ofFamily(r, domains)) continue // T-0273: another game's composite
    ;(domains.length > 0 && selected.length > 0 ? own : rest).push(r)
  }
  const ranked = topKByCosine(own, documentText, query.intent, own.length, byName)
  const first = [...ranked, ...own.filter((r) => !ranked.includes(r)).sort(byName)].slice(0, query.k)
  return [...first, ...topKByCosine(rest, documentText, query.intent, query.k - first.length, byName, 0)]
}
