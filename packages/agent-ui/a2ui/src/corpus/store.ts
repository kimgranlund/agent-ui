// store.ts — pure store core (corpus LLD-C1, SPEC-R1/R3/R9, ADR-0062).
//
// Platform-neutral: zero third-party deps AND zero Node builtins (ADR-0062 clause 1) — every
// operation works over in-memory `ShardText[]` the Node shell (`tools/corpus/fs-store.ts`, a later
// slice) reads off disk and hands in; this module never touches `fs`. `createStore(shards)` parses
// provided JSONL text into an in-memory index at construction time ("at parse"); `serialize()` derives
// the shards (and the regenerable `index.json`) back out, byte-stably.
//
// Invariants (LLD §2): (i) `name` is the unique join key across both sub-corpora. (ii) a shard under
// `exemplar/` holds only `facet:"exemplar"` records, `eval/` only `facet:"eval"` — enforced eagerly at
// parse (a mismatch throws; this can only happen from a hand-corrupted or mis-shelved shard file, never
// from `put()`, which is the single writer and always shelves by the record's own facet). (iii)
// `index.json` is DERIVED, never the source of truth — any `index.json`-shaped input is ignored by
// `createStore`, and `serialize()` always recomputes it fresh from the live record set. (iv) only
// `tools/corpus/` writes the data dir; this module is the single IN-MEMORY mutation surface (`put`)
// that the admission pipeline (LLD-C5) calls.

import type { CorpusRecord, Facet, Status } from './record.ts'

/** One file the store reads from or writes to. `path` is repo-relative (ADR-0062 clauses 3/4) — the
 * Node shell joins it to the actual filesystem root; this module never resolves or touches a real path. */
export interface ShardText {
  path: string
  text: string
}

/** The derived `index.json` shape (LLD §2: "{canonicalHash → name}, {catalogId → names[]}, counts"). */
export interface CorpusIndex {
  byCanonicalHash: Record<string, string>
  byCatalogId: Record<string, string[]>
  counts: { total: number; byFacet: Record<Facet, number>; byStatus: Record<Status, number> }
}

/** Scope for `all()` — every field is an equality filter; omitted fields are unconstrained. */
export interface CorpusStoreFilter {
  facet?: Facet
  catalogId?: string
  protocolVersion?: string
}

export interface CorpusStore {
  /** Raw lookup by name. Unlike `all()`, does NOT exclude `status:"quarantined"` (an audit accessor). */
  get(name: string): CorpusRecord | undefined
  /** The consumption surface (SPEC-R13): every result excludes `status:"quarantined"`. */
  all(filter?: CorpusStoreFilter): CorpusRecord[]
  /** The admission pipeline's single in-memory write (LLD-C5) — upserts by `name`. */
  put(rec: CorpusRecord): void
  /** facet + protocolVersion + catalogId → the repo-relative shard path (ADR-0062). */
  shardPath(rec: CorpusRecord): string
  /** Stable JSONL per shard (sorted keys, one record per line) + the derived `index.json`. */
  serialize(): ShardText[]
}

// The data home (ADR-0062 clause 3) — a string fact the pure core is allowed to know (it computes
// paths, it never resolves or opens them), the same way `protocol.ts` knows `SUPPORTED_VERSIONS`.
const CORPUS_ROOT = 'packages/agent-ui/a2ui/corpus'

/** facet + protocolVersion + catalogId → the repo-relative shard path. Version pin dirs are the file-safe
 * spelling of the `protocol.ts` pin strings (`.` → `_`: `'v1.0'` → `'v1_0'`). `eval` shards carry the
 * `.jsonl.enc` extension the file layout (LLD §2) reserves for the LLD-C8 at-rest encryption — this is
 * pure path arithmetic, not the encryption mechanism itself (deferred, unbuilt). */
function computeShardPath(facet: Facet, protocolVersion: string, catalogId: string): string {
  const pinDir = protocolVersion.replace(/\./g, '_')
  const ext = facet === 'eval' ? '.jsonl.enc' : '.jsonl'
  return `${CORPUS_ROOT}/${facet}/${pinDir}/${catalogId}${ext}`
}

/** The facet a shard's directory segment implies — `undefined` for anything not under `exemplar/`
 * or `eval/` (e.g. `index.json`, which sits at the corpus root and is never a record shard). */
function facetOfPath(path: string): Facet | undefined {
  if (path.includes('/exemplar/')) return 'exemplar'
  if (path.includes('/eval/')) return 'eval'
  return undefined
}

/** Parse one shard's JSONL text into records, enforcing invariant (ii) eagerly. A shard whose
 * directory implies no facet (not under `exemplar/`/`eval/`) yields no records — it is not a record
 * shard (invariant iii: a stray `index.json` handed in is silently not a shard, never parsed as one). */
function parseShard(shard: ShardText): CorpusRecord[] {
  const facet = facetOfPath(shard.path)
  if (facet === undefined) return []

  const records: CorpusRecord[] = []
  for (const line of shard.text.split('\n')) {
    if (line.trim() === '') continue
    const rec = JSON.parse(line) as CorpusRecord
    if (rec.meta.facet !== facet) {
      throw new Error(
        `corpus store: facet/shard mismatch — record "${rec.name}" is facet:"${rec.meta.facet}" ` +
          `but was found under a "${facet}" shard (${shard.path})`,
      )
    }
    records.push(rec)
  }
  return records
}

/** Build the store's in-memory index from provided shard text. Only paths under `exemplar/`/`eval/`
 * are treated as record shards — anything else (an `index.json`, a misplaced file) is ignored, never
 * parsed and never blindly echoed back out (invariant iii; `serialize()` always recomputes it). */
export function createStore(shards: ShardText[] = []): CorpusStore {
  const records = new Map<string, CorpusRecord>() // name -> record (invariant i)

  for (const shard of shards) {
    for (const rec of parseShard(shard)) records.set(rec.name, rec)
  }

  const shardPath = (rec: CorpusRecord): string =>
    computeShardPath(rec.meta.facet, rec.meta.protocolVersion, rec.meta.catalogId)

  const get = (name: string): CorpusRecord | undefined => records.get(name)

  const all = (filter?: CorpusStoreFilter): CorpusRecord[] => {
    const out: CorpusRecord[] = []
    for (const rec of records.values()) {
      if (rec.meta.status === 'quarantined') continue // the consumption-exclusion rule, SPEC-R13
      if (filter?.facet !== undefined && rec.meta.facet !== filter.facet) continue
      if (filter?.catalogId !== undefined && rec.meta.catalogId !== filter.catalogId) continue
      if (filter?.protocolVersion !== undefined && rec.meta.protocolVersion !== filter.protocolVersion) continue
      out.push(rec)
    }
    return out
  }

  const put = (rec: CorpusRecord): void => {
    records.set(rec.name, rec) // upsert by name — dedup (LLD-C4) runs upstream in admission, not here
  }

  const serialize = (): ShardText[] => {
    const byShard = new Map<string, CorpusRecord[]>()
    for (const rec of records.values()) {
      const path = shardPath(rec)
      const bucket = byShard.get(path)
      if (bucket) bucket.push(rec)
      else byShard.set(path, [rec])
    }

    const out: ShardText[] = []
    for (const [path, recs] of byShard) {
      out.push({ path, text: `${recs.map((r) => stableStringify(r)).join('\n')}\n` })
    }
    out.push({ path: `${CORPUS_ROOT}/index.json`, text: `${stableStringify(computeIndex(records))}\n` })
    return out
  }

  return { get, all, put, shardPath, serialize }
}

function computeIndex(records: Map<string, CorpusRecord>): CorpusIndex {
  const byCanonicalHash: Record<string, string> = {}
  const byCatalogId: Record<string, string[]> = {}
  const byFacet: Record<Facet, number> = { exemplar: 0, eval: 0 }
  const byStatus: Record<Status, number> = { valid: 0, repaired: 0, quarantined: 0 }

  for (const rec of records.values()) {
    if (rec.meta.canonicalHash !== undefined) byCanonicalHash[rec.meta.canonicalHash] = rec.name
    const bucket = byCatalogId[rec.meta.catalogId]
    if (bucket) bucket.push(rec.name)
    else byCatalogId[rec.meta.catalogId] = [rec.name]
    byFacet[rec.meta.facet]++
    byStatus[rec.meta.status]++
  }

  return { byCanonicalHash, byCatalogId, counts: { total: records.size, byFacet, byStatus } }
}

/** Deterministic JSON text: object keys sorted, arrays keep element order (significant — SPEC-R6),
 * no insignificant whitespace, `undefined`-valued keys dropped (matches `JSON.stringify`'s own
 * omission rule). This is what makes `createStore(serialize())` byte-stable: `serialize()`'s sort
 * order is a pure function of a record's own keys/values, so re-serializing an already-round-tripped
 * store reproduces the identical bytes regardless of the field order the record originally arrived in. */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(',')}]`
  if (value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const keys = Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort()
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`
  }
  return JSON.stringify(value)
}
