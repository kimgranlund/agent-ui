import"./super-shell-D76CLu9A.js";import{n as e,r as t}from"./_page-DIBN49D1.js";import{t as n}from"./code-block-DEt2Scp8.js";import{o as r}from"./src-BCjsGt6c.js";import{t as i}from"./examples-Bg9vqHc3.js";var a=`// @agent-ui/a2ui/corpus — the corpus store's public read/admission surface (corpus LLD §12, ADR-0062).
// Exposed ONLY via the package.json "./corpus" subpath export — the root barrel (\`../index.ts\`) does
// NOT re-export this module (consumer-bundle hygiene: admission/heal/canonicalize/retrieval code must
// never enter a renderer consumer's bundle — the \`"./examples"\` precedent, ADR-0055 clause 3).
//
// Platform-neutral pure core only (SPEC-N5/ADR-0062): every re-export below resolves to a module under
// \`src/corpus/\` with zero \`node:*\`/third-party imports. Nothing from \`tools/corpus/\` (the Node fs shell:
// \`fs-store.ts\`/\`import-seeds.ts\`) is re-exported here — a consumer of this subpath never pulls in \`fs\`.

export * from './record.ts'
export * from './canonical.ts'
export * from './heal.ts'
export * from './dedup.ts'
export * from './store.ts'
export * from './admit.ts'
export * from './retrieve.ts'
export * from './export.ts'
export * from './validate.ts'
export * from './judge.ts'
`,o=`// store.ts — pure store core (corpus LLD-C1, SPEC-R1/R3/R9, ADR-0062).
//
// Platform-neutral: zero third-party deps AND zero Node builtins (ADR-0062 clause 1) — every
// operation works over in-memory \`ShardText[]\` the Node shell (\`tools/corpus/fs-store.ts\`, a later
// slice) reads off disk and hands in; this module never touches \`fs\`. \`createStore(shards)\` parses
// provided JSONL text into an in-memory index at construction time ("at parse"); \`serialize()\` derives
// the shards (and the regenerable \`index.json\`) back out, byte-stably.
//
// Invariants (LLD §2): (i) \`name\` is the unique join key across both sub-corpora. (ii) a shard under
// \`exemplar/\` holds only \`facet:"exemplar"\` records, \`eval/\` only \`facet:"eval"\` — enforced eagerly at
// parse (a mismatch throws; this can only happen from a hand-corrupted or mis-shelved shard file, never
// from \`put()\`, which is the single writer and always shelves by the record's own facet). (iii)
// \`index.json\` is DERIVED, never the source of truth — any \`index.json\`-shaped input is ignored by
// \`createStore\`, and \`serialize()\` always recomputes it fresh from the live record set. (iv) only
// \`tools/corpus/\` writes the data dir; this module is the single IN-MEMORY mutation surface (\`put\`)
// that the admission pipeline (LLD-C5) calls.

import type { CorpusRecord, Facet, Status } from './record.ts'

/** One file the store reads from or writes to. \`path\` is repo-relative (ADR-0062 clauses 3/4) — the
 * Node shell joins it to the actual filesystem root; this module never resolves or touches a real path. */
export interface ShardText {
  path: string
  text: string
}

/** The derived \`index.json\` shape (LLD §2: "{canonicalHash → name}, {catalogId → names[]}, counts"). */
export interface CorpusIndex {
  byCanonicalHash: Record<string, string>
  byCatalogId: Record<string, string[]>
  counts: { total: number; byFacet: Record<Facet, number>; byStatus: Record<Status, number> }
}

/** Scope for \`all()\` — every field is an equality filter; omitted fields are unconstrained. */
export interface CorpusStoreFilter {
  facet?: Facet
  catalogId?: string
  protocolVersion?: string
  /** Include \`status:"quarantined"\` records too (default \`false\` — every existing caller's
   * consumption semantics is unchanged). The storage-integrity read (ADR-0068 clause 5a): dedup
   * warming needs to see quarantined records so a routine re-import can never silently overwrite
   * one; ordinary consumers (retrieve/export/the leak gate) never pass this. */
  includeQuarantined?: boolean
}

export interface CorpusStore {
  /** Raw lookup by name. Unlike \`all()\`, does NOT exclude \`status:"quarantined"\` (an audit accessor). */
  get(name: string): CorpusRecord | undefined
  /** The consumption surface (SPEC-R13): every result excludes \`status:"quarantined"\`. */
  all(filter?: CorpusStoreFilter): CorpusRecord[]
  /** The admission pipeline's single in-memory write (LLD-C5) — upserts by \`name\`. */
  put(rec: CorpusRecord): void
  /** facet + protocolVersion + catalogId → the repo-relative shard path (ADR-0062). */
  shardPath(rec: CorpusRecord): string
  /** Stable JSONL per shard (sorted keys, one record per line) + the derived \`index.json\`. */
  serialize(): ShardText[]
}

// The data home (ADR-0062 clause 3) — a string fact the pure core is allowed to know (it computes
// paths, it never resolves or opens them), the same way \`protocol.ts\` knows \`SUPPORTED_VERSIONS\`.
const CORPUS_ROOT = 'packages/agent-ui/a2ui/corpus'

/** facet + protocolVersion + catalogId → the repo-relative shard path. Version pin dirs are the file-safe
 * spelling of the \`protocol.ts\` pin strings (\`.\` → \`_\`: \`'v1.0'\` → \`'v1_0'\`). \`eval\` shards carry the
 * \`.jsonl.enc\` extension the file layout (LLD §2) reserves for the LLD-C8 at-rest encryption — this is
 * pure path arithmetic, not the encryption mechanism itself (deferred, unbuilt). */
function computeShardPath(facet: Facet, protocolVersion: string, catalogId: string): string {
  const pinDir = protocolVersion.replace(/\\./g, '_')
  const ext = facet === 'eval' ? '.jsonl.enc' : '.jsonl'
  return \`\${CORPUS_ROOT}/\${facet}/\${pinDir}/\${catalogId}\${ext}\`
}

/** The facet a shard's directory segment implies — \`undefined\` for anything not under \`exemplar/\`
 * or \`eval/\` (e.g. \`index.json\`, which sits at the corpus root and is never a record shard). */
function facetOfPath(path: string): Facet | undefined {
  if (path.includes('/exemplar/')) return 'exemplar'
  if (path.includes('/eval/')) return 'eval'
  return undefined
}

/** Parse one shard's JSONL text into records, enforcing invariant (ii) eagerly. A shard whose
 * directory implies no facet (not under \`exemplar/\`/\`eval/\`) yields no records — it is not a record
 * shard (invariant iii: a stray \`index.json\` handed in is silently not a shard, never parsed as one). */
function parseShard(shard: ShardText): CorpusRecord[] {
  const facet = facetOfPath(shard.path)
  if (facet === undefined) return []

  const records: CorpusRecord[] = []
  for (const line of shard.text.split('\\n')) {
    if (line.trim() === '') continue
    const rec = JSON.parse(line) as CorpusRecord
    if (rec.meta.facet !== facet) {
      throw new Error(
        \`corpus store: facet/shard mismatch — record "\${rec.name}" is facet:"\${rec.meta.facet}" \` +
          \`but was found under a "\${facet}" shard (\${shard.path})\`,
      )
    }
    records.push(rec)
  }
  return records
}

/** Build the store's in-memory index from provided shard text. Only paths under \`exemplar/\`/\`eval/\`
 * are treated as record shards — anything else (an \`index.json\`, a misplaced file) is ignored, never
 * parsed and never blindly echoed back out (invariant iii; \`serialize()\` always recomputes it). */
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
      // the consumption-exclusion rule (SPEC-R13) — \`includeQuarantined:true\` opts a caller INTO
      // seeing them (ADR-0068 clause 5a: dedup warming, rescore's own audit read); every existing
      // consumer never passes it, so its default (false) reproduces today's behavior exactly.
      if (rec.meta.status === 'quarantined' && filter?.includeQuarantined !== true) continue
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
      out.push({ path, text: \`\${recs.map((r) => stableStringify(r)).join('\\n')}\\n\` })
    }
    out.push({ path: \`\${CORPUS_ROOT}/index.json\`, text: \`\${stableStringify(computeIndex(records))}\\n\` })
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
 * no insignificant whitespace, \`undefined\`-valued keys dropped (matches \`JSON.stringify\`'s own
 * omission rule). This is what makes \`createStore(serialize())\` byte-stable: \`serialize()\`'s sort
 * order is a pure function of a record's own keys/values, so re-serializing an already-round-tripped
 * store reproduces the identical bytes regardless of the field order the record originally arrived in. */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return \`[\${value.map((v) => stableStringify(v)).join(',')}]\`
  if (value !== null && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const keys = Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort()
    return \`{\${keys.map((k) => \`\${JSON.stringify(k)}:\${stableStringify(obj[k])}\`).join(',')}}\`
  }
  return JSON.stringify(value)
}
`,s=`// admit.ts — the admission pipeline (corpus LLD-C5, SPEC-R5-R9, ADR-0060/0061/0063).
//
// The corpus's ONE write path (LLD §2 invariant iv): every stage below is independently testable and
// short-circuits on its first failure, in this order (LLD §6):
//
//   heal (LLD-C7) -> schema/field (LLD-C2) -> facet gate (ADR-0060) -> pin check (LLD-C2)
//   -> tier-1 (LLD-C6, shared validateA2ui) -> pointer RESOLUTION (corpus-only)
//   -> leak gate (LLD-C4 MinHash vs the eval corpus) -> canonical+hash (LLD-C3) -> dedup (LLD-C4)
//   -> tier-2 rubric (deps.judge, ADR-0060) -> write (LLD-C1)
//
// \`admit(candidate, deps)\` accepts \`candidate: unknown\` (mirrors \`validateRecord\`/\`validateA2ui\`'s
// totality stance — this is the single gateway all untrusted input passes through) and a small,
// injected dependency bag (\`AdmitDeps\`) so the pipeline stays a pure function of its inputs: the
// catalog to validate against, the (stateful, shared-across-calls) store and dedup index, and an
// OPTIONAL tier-2 judge (ADR-0060's seam — absent until the harness wave lands the corpus-quality
// rubric; the stage is then simply skipped and \`qualityScore\` stays unset, the honest marker).
//
// A "candidate" differs from a full \`CorpusRecord\` in exactly the ways admission itself fills in:
// \`a2uiOutput\` may still be raw text needing \`heal\`, and \`meta.status\`/\`canonicalHash\`/\`componentsUsed\`/
// \`qualityScore\` do not exist yet (ADR-0055's seed-mapping note: "\`meta.status\` set by admission").
// \`validateRecord\` (LLD-C2) was written to check a COMPLETE \`CorpusRecord\`, so admission bridges the
// gap by defaulting a placeholder \`meta.status\` before the schema/field call purely so that stage can
// run — admission is the sole authority over the FINAL status (computed from \`heal\`'s \`changed\` flag)
// and overwrites whatever placeholder or caller-supplied value was there, always.

import type { CorpusRecord, AdmitCode, RecordFailure } from './record.ts'
import { validateRecord } from './record.ts'
import { heal } from './heal.ts'
import { canonicalize, CanonicalizeError } from './canonical.ts'
import { minHashSignature, jaccardEstimate, DEFAULT_THETA_DUP } from './dedup.ts'
import type { DedupIndex } from './dedup.ts'
import type { CorpusStore } from './store.ts'
import { validateA2ui } from './validate.ts'
import type { Catalog } from '../catalog/catalog.ts'
import type { A2uiOutput, A2uiComponent, A2uiChildTemplate, ErrorCode, Failure } from '../protocol.ts'

/** The tier-2 rubric's verdict on one candidate record (ADR-0060's injected judge seam). The corpus
 * SPEC-R8 bar itself is the judge's own concern — this module only reads \`passed\`/\`qualityScore\`. */
export interface JudgeVerdict {
  qualityScore: number
  passed: boolean
  /** Rubric dimensions that fell below the bar (ADR-0060 acceptance: "rejects with failing dimensions"). */
  failingDimensions?: string[]
}

/** Injected tier-2 rubric (ADR-0060). No shipped implementation exists yet — the harness wave supplies
 * one when the corpus-quality rubric lands; tests exercise the seam with a fake. */
export interface Judge {
  score(record: CorpusRecord): JudgeVerdict | Promise<JudgeVerdict>
}

export interface AdmitDeps {
  /** The catalog \`deps.store\`'s pinned records validate against (tier-1, LLD-C6) — the caller resolves
   * whichever \`Catalog\` matches the candidate's \`meta.catalogId\`; admission does not own catalog lookup. */
  catalog: Catalog
  /** Shared, stateful across calls in one admission session (the seed-import loop, a future harness run). */
  store: CorpusStore
  /** Shared, stateful across calls — the exact-hash + MinHash near-dup index (LLD-C4). */
  dedupIndex: DedupIndex
  /** ADR-0060's tier-2 seam. Absent ⇒ tier-2 is skipped and \`qualityScore\` stays unset. */
  judge?: Judge
}

export type AdmitResult =
  | { ok: true; record: CorpusRecord; repairs: string[] }
  | {
      ok: false
      code: AdmitCode
      message: string
      paths?: string[]
      failingDimensions?: string[]
      /** The colliding record's name (SPEC §5.2's \`AdmitResult\` sketch) — populated on BOTH E_DUP
       * flavors (exact canonical-hash and MinHash near-match) with the FIRST-ADMITTED record's name;
       * absent for every other code. A structured alternative to regex-parsing \`message\`. */
      collidesWith?: string
    }

/** Admit one candidate through the full pipeline (LLD §6). Async: \`canonicalize\` rides \`crypto.subtle\`. */
export async function admit(candidate: unknown, deps: AdmitDeps): Promise<AdmitResult> {
  if (!isObject(candidate)) return reject('E_SCHEMA', 'candidate must be an object')

  // Stage 1 — heal (LLD-C7 / ADR-0061). Only \`a2uiOutput\` is healable; its absence is legal (an
  // eval-facet candidate carries none) — the facet gate below still rejects any eval candidate.
  const healedCandidate: Record<string, unknown> = { ...candidate }
  let repairs: string[] = []
  let changed = false
  if (candidate.a2uiOutput !== undefined) {
    const healed = heal(candidate.a2uiOutput as string | A2uiOutput, extractPin(candidate))
    if (!healed.ok) return reject('E_SCHEMA', \`heal: \${healed.reason}\`)
    healedCandidate.a2uiOutput = healed.messages
    repairs = healed.repairs
    changed = healed.changed
  }
  // Bridge the candidate/record gap (see file header): \`validateRecord\` unconditionally requires a
  // valid \`meta.status\`, but admission — not the caller — owns that field. Default a placeholder ONLY
  // so the schema/field stage below can run; the true status is computed and overwritten unconditionally
  // at the write stage, so this placeholder is never observable in an admitted (or rejected) result.
  if (isObject(healedCandidate.meta)) {
    healedCandidate.meta = { status: 'valid', ...healedCandidate.meta }
  }

  // Stage 2 — schema/field (LLD-C2, ADR-0063: \`description\` unconditional; the old missing-target code is retired).
  const recordFailures = validateRecord(healedCandidate)
  const schemaFailures = recordFailures.filter((f) => f.code === 'E_SCHEMA')
  if (schemaFailures.length > 0) return rejectPaths('E_SCHEMA', schemaFailures)

  // \`healedCandidate\` passed the shape check above (batched with the pin check below, split by code) —
  // narrow via \`unknown\` since it started life as \`Record<string, unknown>\`, not a structural subtype.
  const record = healedCandidate as unknown as CorpusRecord

  // Stage 3 — the ADR-0060 facet gate: fail-closed until LLD-C8's contamination mechanism exists.
  if (record.meta.facet === 'eval') {
    return reject('E_LEAK', 'eval facet fail-closed: the LLD-C8 contamination mechanism is unbuilt (ADR-0060)')
  }

  // Stage 4 — pin check (LLD-C2, SPEC-R9).
  const pinFailures = recordFailures.filter((f) => f.code === 'E_PIN')
  if (pinFailures.length > 0) return rejectPaths('E_PIN', pinFailures)

  if (record.a2uiOutput === undefined) {
    // Unreachable in practice: an exemplar without \`a2uiOutput\` already failed schema/field above, and
    // eval candidates were already turned away by the facet gate. Kept as a defensive totality guard.
    return reject('E_SCHEMA', 'a2uiOutput is required past the facet gate')
  }
  const output = record.a2uiOutput

  // Stage 5 — tier-1 deterministic (LLD-C6, the shared \`validateA2ui\` — parity, SPEC-N1/R8-AC3).
  //
  // ADR-0187 / GH #829 — FINALIZE granularity. An admitted record IS a complete set by construction: a
  // \`CorpusRecord.a2uiOutput\` is the whole authored stream for one task, with no "more is coming" (the
  // renderer LLD §8 parity prose already said admission judges a COMPLETE \`a2uiOutput\` — finalize
  // granularity makes that claim true for the empty-surface case too, which the empty-set exemption used
  // to except). So a record declaring a surface it never delivers components for is now rejected
  // \`E_IDGRAPH\` rather than admitted as an exemplar teaching a blank card. Nothing reds: the 29-record
  // exemplar shard admits unchanged (proven by \`corpus-data.test.ts\` + the slice's re-admission sweep).
  const verdict = validateA2ui(output, deps.catalog, undefined, { atFinalize: true })
  if (!verdict.valid) return rejectTier1(verdict.failures)

  // Stage 6 — pointer RESOLUTION (corpus-only, LLD-C5 §6/§7): layered on top of tier-1's syntax-only
  // check — an exemplar bundles its complete data model, so resolution is checkable here.
  const unresolved = findUnresolvedPointers(output)
  if (unresolved.length > 0) {
    return { ok: false, code: 'E_POINTER', message: 'a binding does not resolve against the bundled data model', paths: unresolved }
  }

  // Stage 7 — leak gate (LLD-C4 MinHash vs the loaded eval prompts — an empty set today; ADR-0060/§8).
  const leakName = checkLeakGate(record, deps.store)
  if (leakName !== null) {
    return { ok: false, code: 'E_LEAK', message: \`promptText collides with the held-out eval record "\${leakName}"\` }
  }

  // Stage 8 — canonical + hash (LLD-C3): fills \`meta.canonicalHash\`/\`componentsUsed\`.
  let canonical
  try {
    canonical = await canonicalize(output)
  } catch (e) {
    // The DFS's defensive root/cycle backstop (canonical.ts): tier-1 already rejects a missing/second
    // root or a cycle before this stage ever runs (LLD §6), so this branch is a totality guard, not a
    // reachable path for any candidate that already passed stage 5 above.
    if (e instanceof CanonicalizeError) return reject('E_IDGRAPH', e.message)
    throw e
  }

  const enriched: CorpusRecord = {
    ...record,
    meta: {
      ...record.meta,
      canonicalHash: canonical.hash,
      componentsUsed: canonical.componentsUsed,
      status: changed ? 'repaired' : 'valid',
    },
  }

  // Stage 9 — dedup (LLD-C4). Checks only — registration happens at the write stage, so a candidate
  // that fails a LATER stage (the judge) never pollutes the dedup index with a record never admitted.
  const exactName = deps.dedupIndex.exact(canonical.hash)
  if (exactName !== null) return reject('E_DUP', \`exact canonical-hash collision with "\${exactName}"\`, exactName)
  const signature = minHashSignature(\`\${enriched.promptText} \${canonical.serialized}\`)
  const nearName = deps.dedupIndex.near(signature, DEFAULT_THETA_DUP)
  if (nearName !== null) {
    return reject('E_DUP', \`near-duplicate (theta>=\${DEFAULT_THETA_DUP}) of "\${nearName}"\`, nearName)
  }

  // Stage 10 — tier-2 rubric (deps.judge — INJECTED seam, ADR-0060). Absent ⇒ skipped, \`qualityScore\`
  // stays unset (the honest marker of an unjudged record).
  let finalRecord = enriched
  if (deps.judge) {
    const judged = await deps.judge.score(enriched)
    if (!judged.passed) {
      return { ok: false, code: 'E_QUALITY', message: 'below the corpus-quality rubric bar', failingDimensions: judged.failingDimensions }
    }
    finalRecord = { ...enriched, meta: { ...enriched.meta, qualityScore: judged.qualityScore } }
  }

  // Stage 11 — write (LLD-C1): \`store.put()\` is the single mutation path; dedup registers alongside it.
  deps.store.put(finalRecord)
  deps.dedupIndex.addExact(finalRecord.name, canonical.hash)
  deps.dedupIndex.addSignature(finalRecord.name, signature)

  return { ok: true, record: finalRecord, repairs }
}

// ── stage helpers ────────────────────────────────────────────────────────────────────

function extractPin(candidate: Record<string, unknown>): { protocolVersion: string } | undefined {
  const meta = candidate.meta
  return isObject(meta) && typeof meta.protocolVersion === 'string' ? { protocolVersion: meta.protocolVersion } : undefined
}

function reject(code: AdmitCode, message: string, collidesWith?: string): AdmitResult {
  return { ok: false, code, message, collidesWith }
}

function rejectPaths(code: AdmitCode, failures: RecordFailure[]): AdmitResult {
  const paths = failures.map((f) => f.path)
  return { ok: false, code, message: \`\${code}: \${paths.length} field(s) failed\`, paths }
}

// The LLD §6 tier-1 -> admission code table. \`FUNCTION\` is a render-time-only code (protocol.ts:
// binding-evaluation failures, never emitted by the static \`validateA2ui\`) and has no table row —
// defaulted to \`E_SCHEMA\` defensively rather than silently dropped.
function mapTier1Code(code: ErrorCode): AdmitCode {
  switch (code) {
    case 'PARSE':
    case 'SCHEMA':
      return 'E_SCHEMA'
    case 'VERSION_UNSUPPORTED':
      return 'E_PIN'
    case 'CATALOG':
    case 'CATALOG_UNKNOWN':
      return 'E_CATALOG'
    case 'IDGRAPH':
    case 'DEPTH_EXCEEDED': // SPEC-R2/GH #473 — a graph-shape rejection, the E_IDGRAPH family (not E_SCHEMA)
    case 'CONTAINMENT': // a2ui-container-vocabulary SPEC-R6 — same family, same reason: it judges the
      // assembled adjacency list (a region's parent), not a single component's catalog conformance.
      return 'E_IDGRAPH'
    case 'POINTER':
      return 'E_POINTER'
    default:
      return 'E_SCHEMA'
  }
}

/** Map a tier-1 verdict's failures to ONE admission code (the first failure's mapped code wins — tier-1
 * itself already short-circuits a top-level PARSE/SCHEMA defect before any batched per-component
 * failures can co-occur); \`paths\` collects every failure that shares that same mapped code. */
function rejectTier1(failures: Failure[]): AdmitResult {
  const mapped = failures.map((f) => ({ code: mapTier1Code(f.code), path: f.path }))
  const primary = mapped[0]!.code
  const paths = mapped.filter((m) => m.code === primary).map((m) => m.path)
  return { ok: false, code: primary, message: \`tier-1 validation failed (\${primary})\`, paths }
}

/** The leak gate (LLD §6/§8): an EXEMPLAR candidate's prompt is checked against every already-admitted
 * \`facet:"eval"\` record's prompt (MinHash near-match, LLD-C4's recipe applied to \`promptText\` alone —
 * an eval record may carry no \`a2uiOutput\` at all, so the full dedup recipe does not apply here). The
 * eval corpus is ALWAYS empty in phase 1 (the facet gate above fail-closes every eval candidate until
 * LLD-C8 exists), so this stage runs real logic but is vacuously satisfied today (LLD §6 "the stage
 * still runs" note) — it only fires if a caller seeds the store with an eval record directly. */
function checkLeakGate(record: CorpusRecord, store: CorpusStore): string | null {
  const evalRecords = store.all({ facet: 'eval' })
  if (evalRecords.length === 0) return null
  const candidateSig = minHashSignature(record.promptText)
  for (const evalRecord of evalRecords) {
    if (jaccardEstimate(candidateSig, minHashSignature(evalRecord.promptText)) >= DEFAULT_THETA_DUP) return evalRecord.name
  }
  return null
}

// ── pointer resolution (corpus-only, LLD §6/§7) ─────────────────────────────────────

const RESERVED_PROPS = new Set(['id', 'component', 'child', 'children', 'checks'])

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const isBindingPath = (v: unknown): v is { path: string } => isPlainObject(v) && typeof v.path === 'string'

const decodePointerToken = (token: string): string => token.replace(/~1/g, '/').replace(/~0/g, '~')

function isChildTemplate(v: string[] | A2uiChildTemplate | undefined): v is A2uiChildTemplate {
  return v !== undefined && !Array.isArray(v)
}

/** Fold a candidate's message stream into a flat component map + the final data model — the same
 * upsert/apply-in-order semantics \`canonical.ts\`'s \`foldStream\` uses (re-implemented, not imported,
 * for the same reason canonical.ts gives for its own \`setAtPointer\`: this module stays decoupled from
 * that module's private internals; both independently mirror the renderer's documented semantics). */
function foldForResolution(out: A2uiOutput): { byId: Map<string, A2uiComponent>; dataModel: unknown } {
  const byId = new Map<string, A2uiComponent>()
  let dataModel: unknown
  for (const msg of out) {
    if ('updateComponents' in msg) {
      for (const comp of msg.updateComponents.components) byId.set(comp.id, comp)
    } else if ('updateDataModel' in msg) {
      const { path, value } = msg.updateDataModel
      // Whole-document replace when no path, "" or "/" (the upstream protocol's root alias — ADR-0099).
      dataModel =
        path === undefined || path === '' || path === '/' ? value : setAtPointer(dataModel, path, value)
    }
  }
  return { byId, dataModel }
}

function setAtPointer(doc: unknown, pointer: string, value: unknown): unknown {
  if (pointer[0] !== '/') return doc // malformed/non-absolute — tier-1 rejects this before this stage runs
  const tokens = pointer.slice(1).split('/').map(decodePointerToken)
  const set = (node: unknown, i: number): unknown => {
    if (i === tokens.length) return value
    const key = tokens[i]!
    if (Array.isArray(node)) {
      const copy = node.slice()
      copy[Number(key)] = set(node[Number(key)], i + 1)
      return copy
    }
    const base = isPlainObject(node) ? node : {}
    return { ...base, [key]: set(base[key], i + 1) }
  }
  return set(doc, 0)
}

/** Read a value at an absolute-or-empty RFC-6901 pointer. \`ok:false\` means it does not resolve. */
function readPointer(doc: unknown, pointer: string): { ok: boolean; value: unknown } {
  if (pointer === '') return { ok: doc !== undefined, value: doc }
  const tokens = pointer.slice(1).split('/').map(decodePointerToken)
  let node: unknown = doc
  for (const token of tokens) {
    if (Array.isArray(node)) {
      const idx = Number(token)
      if (!Number.isInteger(idx) || idx < 0 || idx >= node.length) return { ok: false, value: undefined }
      node = node[idx]
    } else if (isPlainObject(node)) {
      if (!Object.hasOwn(node, token)) return { ok: false, value: undefined }
      node = node[token]
    } else {
      return { ok: false, value: undefined }
    }
  }
  return { ok: true, value: node }
}

/** One component's list-item scope (renderer \`ItemScope\`, minus \`index\` — resolution always checks the
 * witness element, index 0). \`arrayPath\` is the bound array's ABSOLUTE pointer, already composed
 * through any outer nesting — the exact value \`renderer/list.ts#renderList\`'s \`scopedPointer(template.
 * path, parentItemScope)\` computes for that same template at render time. */
interface EffectiveScope {
  arrayPath: string
}

/**
 * Assign every declared component the scope it would actually render under (mirrors
 * \`renderer/tree.ts#mountChildrenInto\` + \`renderer/list.ts#renderList\` exactly, statically): a DFS from
 * \`root\` following \`child\`/\`children\` propagates the CURRENT scope unchanged to every static descendant
 * (a container item's whole subtree shares one scope, not just the template's immediate target — the
 * bug this rewrite fixes: \`section_title\`/\`tile_label\` are descendants of a template target, not the
 * target itself). A \`children\`-TEMPLATE at ANY depth introduces a NEW scope for its own target (and, by
 * the same propagation, that target's descendants): the template's \`path\` is resolved relative to the
 * CURRENT scope exactly as \`scopedPointer\` does (composed as \`{current.arrayPath}/0/{path}\` — index 0,
 * the witness element) when a current scope exists, else left unchanged (the top-level-list case, where
 * \`path\` is already absolute). A component never reached from \`root\` (dangling ref, or a disconnected
 * island canonical.ts itself tolerates) is simply never visited — \`scopes.get(id)\` then naturally
 * returns \`undefined\`, the same conservative "no scope" verdict a root-level static component gets.
 */
function computeScopes(byId: Map<string, A2uiComponent>): Map<string, EffectiveScope | undefined> {
  const scopes = new Map<string, EffectiveScope | undefined>()

  const visit = (id: string, scope: EffectiveScope | undefined): void => {
    if (scopes.has(id)) return // already assigned — first-reached scope stands (tier-1 forbids cycles;
    scopes.set(id, scope) // a diamond reference through two different scopes is not a case real records hit)
    const comp = byId.get(id)
    if (comp === undefined) return // dangling — tier-1 already rejects this before this stage runs

    if (typeof comp.child === 'string') visit(comp.child, scope)

    if (Array.isArray(comp.children)) {
      for (const childId of comp.children) visit(childId, scope)
    } else if (isChildTemplate(comp.children)) {
      const arrayPath = scope === undefined ? comp.children.path : \`\${scope.arrayPath}/0/\${comp.children.path}\`
      visit(comp.children.componentId, { arrayPath })
    }
  }

  visit('root', undefined)
  return scopes
}

/**
 * Every bound (\`{path}\`) top-level property on every declared component must resolve against the
 * record's own folded data model (LLD §6/§7). Scope matches tier-1's own reach exactly (direct
 * component properties, \`RESERVED_PROPS\` excluded) — this stage adds resolution semantics on top of
 * tier-1's syntax check, not a wider surface. An ABSOLUTE path (\`/\`-led) resolves against the document
 * root; a RELATIVE path resolves only when \`computeScopes\` assigned its component a scope (anywhere
 * inside a dynamic-list item's subtree, ADR-0024 — not just the template's immediate target), through
 * the bound array's element 0 (the witness element, \`{path}/{index}/{rest}\` with \`index=0\`). A relative
 * path with no enclosing list-item scope has nothing to resolve against and is reported unresolved.
 */
function findUnresolvedPointers(out: A2uiOutput): string[] {
  const { byId, dataModel } = foldForResolution(out)
  const scopes = computeScopes(byId)

  const unresolved: string[] = []
  for (const comp of byId.values()) {
    const scope = scopes.get(comp.id)

    for (const [key, value] of Object.entries(comp)) {
      if (RESERVED_PROPS.has(key) || !isBindingPath(value)) continue
      const { path } = value

      if (path.startsWith('/')) {
        if (!readPointer(dataModel, path).ok) unresolved.push(\`\${comp.id}.\${key}\`)
        continue
      }

      if (scope === undefined) {
        unresolved.push(\`\${comp.id}.\${key}\`) // relative binding, no enclosing list-item scope
        continue
      }

      const effectivePath = path === '' ? \`\${scope.arrayPath}/0\` : \`\${scope.arrayPath}/0/\${path}\`
      if (!readPointer(dataModel, effectivePath).ok) unresolved.push(\`\${comp.id}.\${key}\`)
    }
  }

  return unresolved
}

// — small helpers ————————————————————————————————————————————————————————————————

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
`,c=`// retrieve.ts — the retriever (corpus LLD-C9, SPEC-R11/N2).
//
// Zero-dep TF-IDF cosine top-k ranking over \`promptText\` + \`meta.componentsUsed\`, scoped to a
// catalogId/protocolVersion pin. Signature note: the LLD §9 prose describes this as "pure over the
// store handle" (\`retrieve(store, {intent, k, catalogId, protocolVersion})\`), but this slice's
// decomposition entry (a2ui-corpus-store.decomp.json, node n10) draws its only build dependency from
// record.ts (n3→n10) — LLD-C1's store.ts is neither built yet at this slice's dispatch nor listed as a
// dependency edge. \`retrieve()\` therefore takes a plain \`records\` array rather than a \`CorpusStore\`
// handle; a caller composes \`retrieve(store.all(...), query)\` once the store lands. Flagged to the team
// lead as a signature reconciliation point for whoever wires this into \`admit.ts\`/the streaming driver.
//
// Facet/status exclusion (escalated, not LLD-C9-explicit): the SPEC frames retrieval as one of three
// "exemplar" conditioning modes alongside few-shot export and fine-tune export (SPEC overview line 34,
// PRD-D1), and LLD §9's exporter bullet (LLD-C10) explicitly scopes to \`facet:"exemplar"\` — but the
// LLD-C9 bullet for THIS module does not repeat the filter. Implemented here as a hard, defensive
// invariant: only \`facet:"exemplar"\`, non-\`"quarantined"\` records are ever eligible, regardless of what
// the caller passes in, so an eval-facet or quarantined record can never surface in a retrieval result.
// Flagged to the team lead in case the LLD should be amended to state this explicitly.
//
// Zero-dep, platform-neutral (SPEC-N5/ADR-0062): no imports beyond the local \`record.ts\` types and the
// shared \`text-similarity.ts\` tokenizer/cosine primitives (ADR-0091 §2 — extracted so there is exactly
// ONE implementation of the math; \`selectMiniSkills\` is the other caller).

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
  return \`\${rec.promptText} \${components.join(' ')}\`
}

/**
 * TF-IDF cosine top-k retrieval (SPEC-R11) over \`promptText\` + \`meta.componentsUsed\`, scoped to
 * \`query.catalogId\`/\`query.protocolVersion\` and restricted to non-quarantined exemplar records.
 *
 * Never throws. Resolves to \`[]\` for: an empty \`records\` input, an empty scope after filtering
 * (SPEC-R11 AC2), \`query.k <= 0\`, or a query whose tokens share zero vocabulary with the scope — a
 * zero-norm query vector makes cosine similarity undefined for every candidate, so this is treated as
 * a genuine "no match" rather than an arbitrary top-k of zero-scored records.
 *
 * Ties are broken by ascending \`name\` (unique per record, LLD §2) for a deterministic result order.
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
`,{content:l}=e({title:`A2UI authoring guide`});l.append(t(`How to author the two things that teach an agent this fleet: a CATALOG ROW (the vocabulary a model may emit) and TRAINING DATA (the seeds that teach idiomatic use). Every worked example below is derived live from the shipped catalog and seed shelf — what you read is what ships.`));function u(e,t){let n=document.createElement(`h${e}`);return n.textContent=t,n}function d(e){let t=document.createElement(`p`);return t.textContent=e,t}function f(e){let t=document.createElement(`ol`);for(let n of e){let e=document.createElement(`li`);e.textContent=n,t.append(e)}return t}function p(e){let t=r.components[e];return t?JSON.stringify({[e]:t},null,2):`/* catalog row "${e}" not found */`}function m(e,t){let n=`export interface ${t} {`,r=e.indexOf(n);if(r===-1)throw Error(`a2ui-authoring: interface "${t}" not found — renamed or removed?`);let i=0,a=r;for(;a<e.length;a++)if(e[a]===`{`)i++;else if(e[a]===`}`&&(i--,i===0)){a++;break}return e.slice(r,a)}function h(e,t){let n=e.indexOf(t);if(n===-1)throw Error(`a2ui-authoring: signature "${t}" not found — renamed or removed?`);let r=e.indexOf(`{`,n);return e.slice(n,r).trim()}l.append(u(2,`Part A — authoring a catalog row`),d(`A catalog row is the whole contract between the wire and a control: its existence puts the type on the security allowlist (only catalogued types render), its properties define what the validator accepts, and the derived system prompt advertises it to the model automatically (prompt drift is gated, so a new row is taught the moment it lands). Authoring one is five decisions:`),f([`NAME the type UpperCamelCase and bind it to exactly one ui-* widget via a factory entry — the table-parity gate demands one factory per type, no gap, no extra.`,`NAME each bindable prop by the CONTROL’S OWN prop name (the naming law) — the wire vocabulary follows the component, never an adapter’s.`,`TYPE each prop, and mark data-drivable props "bindable": true. A prop that is per-instance INTENT rather than data state omits the bindable key entirely (never "bindable": false) — the presentation-intent idiom Text.truncate and Text.emphasis established (ADR-0106/0109).`,`Give an input control at most ONE two-way slot: the value: {prop, event} mark. Display-only rows carry none.`,`Declare the child model: a children list, a single child, or none — the renderer’s adjacency walk follows it.`]),u(3,`Worked example — a display row with intent props (derived from the shipped catalog)`),n(p(`Text`)),d(`Read truncate/emphasis: boolean, no bindable key — the model may set them per instance; the data model can never drive them. Neither needed a line of factory code: booleans with no dedicated mapping ride the factory’s generic setAttr arm, and the reflected attribute IS the CSS hook.`),u(3,`Worked example — an array-typed bindable prop (derived from the shipped catalog)`),n(p(`Sparkline`)),d(`values is the catalog’s first array-typed bindable prop: the row declares the full item schema, the shared validator accepts a literal array at top-level type depth, and a {path} binding resolves to the same typed array — re-rendering on every updateDataModel. The component’s own hardened codec (malformed JSON → empty series, never a throw) is the safety net beneath the validator.`),u(3,`Before you add a prop at all — the ADR-0102 chooser`),d(`The catalog consumer has no CSS verb, so any rendered-correctness concern must be reachable without page CSS. Route the concern through the three lanes IN ORDER: Lane A — can the component own a safe default? (calendar’s fluid tracks); Lane C — can composition express it gracefully? (the form wrapped in Column gap="md", taught by exemplar); only per-instance INTENT over a safe default earns Lane B, a catalog prop (truncate, emphasis). A prop minted to repair a broken default is the anti-pattern — fix the default instead.`),u(3,`The coverage gate, and the duties a row ships with`),d(`The fleet-derived coverage gate (ADR-0087) turns red the moment a shipped descriptor has neither a catalog row nor a seeded allowlist entry with a recorded reason — so a new control lands its row in the same wave, and a deliberate exclusion is a documented disposition, never silence. Seeded allowlist entries must drain: a residue assertion fails if a drained type’s seed is left behind. Two more duties ship WITH the row: a when-to-use note in the catalog SPEC §5.2 whenever the new type competes with existing vocabulary (tile for a latest value · Sparkline for a series’ shape · BarChart for comparing magnitudes · List table for exact values), and a reference use on the examples shelf — a prop no exemplar renders is a self-correct-convergence hazard the model will misuse (the D6 lesson).`));var g=i.map(e=>e.name).join(` · `),_=i.find(e=>e.name===`report-card-dashboard`);l.append(u(2,`Part B — authoring training data`),d(`Training data lives in two homes with different bars. The EXAMPLES SHELF (src/examples/ — ${i.length} seeds today: ${g}) is the teaching surface: every seed renders in the gallery, feeds the drift gates, and is the reference use for catalog idioms. The CORPUS SHARD (corpus/exemplar/v1_0/) is the retrieval store the live agent draws from: joining it is a separate, judged act — a seed does NOT become a corpus record by existing (the shelf grew by five this month; the shard deliberately stayed at its eleven judged records).`),u(3,`Seed anatomy — the five parts every seed carries`),f([`name + description — the gallery card and the gate’s test names derive from them.`,`promptText — the USER intent this seed answers. Write it as a real ask (“Show a room booking form…”): retrieval and teaching both key off intent vocabulary, not implementation vocabulary.`,`messages — the canonical stream shape: createSurface → updateDataModel (seed the whole model in one write) → updateComponents (the full adjacency list, one root).`,`Idioms in the tree — Field-wrapped inputs under a FormProvider, Column gap="md" for form rhythm, {path} bindings for every data-model field you declare (an unreachable model field is dead weight), checks for validity, ONE submit-gated action.`,`Types — export the messages as readonly A2uiServerMessage[]; the site typecheck pins the envelope shape at check time.`]),_?u(3,`Worked example — the newest seed, derived live`):u(3,`Worked example — (report-card-dashboard not found on the shelf)`)),_&&l.append(d(`promptText: “${_.promptText}” — and its stream is ${_.messages.length} messages in the canonical order. It exists to TEACH a rule: a metric tile for the latest value, a Sparkline for the series’ shape, a BarChart for the breakdown — the seed is the §5.2 guidance in composition form.`),n(JSON.stringify(_.messages.map(e=>Object.keys(e).filter(e=>e!==`version`)),null,2)+` // the message kinds, in stream order (derived from the seed itself)`)),l.append(u(3,`The quality bar — what a seed must pass before it teaches anyone`),f([`Validator-clean: 0 CATALOG and 0 IDGRAPH failures through the SAME shared validator the renderer runs — the standing examples gate re-proves every committed seed on every test run.`,`Rendered proof: the derived gallery walks every shelf seed in a real browser — a seed that validates but paints a collapsed box fails the whole-shape law.`,`Idiomatic: graded against the payload rubric (composition, catalog idiom, binding hygiene, accessibility — every dimension ≥4). Authored-clean beats healed: a seed that needs the healer is a draft, not a teacher.`,`Reference-use duty: if the seed exists to teach a new prop or type, the teaching must be legible IN the composition — the document-row seed carries truncate AND emphasis on one Text node precisely to show two orthogonal intents composing.`]),u(3,`Shard admission — the judged pipeline (only when a seed graduates to retrieval)`),d(`Admission is validate → heal (a CLOSED, form-only repair list — anything else rejects) → dedupe (exact + near-duplicate) → record (canonical hash; byte-stable JSONL). Quality scoring is a judged act with provenance: an independent critic grades the record against the corpus rubric and emits a verdicts file; the import tool refuses quarantine exits without one (--verdicts is mandatory — a replace can never silently skip judging). Quarantined records stay in the shard, excluded from retrieval, visible in history. If you remember one rule: the shelf is where seeds teach people; the shard is where judged records teach the MODEL — and nothing crosses that line unjudged.`)),l.append(u(2,`Part C — the ./corpus store API`),d("`@agent-ui/a2ui/corpus` is the corpus store’s public read/admission surface (corpus LLD §12, ADR-0062) — exposed ONLY via this subpath, never the root `.` barrel, so a renderer consumer never pulls in admission/heal/canonicalize/retrieval code. Platform-neutral pure core: every re-export resolves to a module with zero node:*/third-party imports — nothing from tools/corpus/ (the Node fs shell) crosses this subpath."),u(3,`The public surface — verbatim from src/corpus/index.ts`),n(a.trimEnd(),`ts`),u(3,`CorpusStore — derived from source`),d("The single in-memory mutation surface (invariant iv, corpus LLD-C1): only the admission pipeline’s `put()` writes; `all()` always excludes quarantined records (the consumption law, SPEC-R13) while `get()` is the audit accessor that does not."),n(m(o,`CorpusStore`),`ts`),n(h(o,`export function createStore(`),`ts`),u(3,`admit() — the ONE write path`),d("heal → schema/field → facet gate → pin check → tier-1 (shared validateA2ui) → pointer resolution → leak gate (MinHash vs the eval corpus) → canonical+hash → dedupe → tier-2 rubric (optional judge) → write (LLD §6). `admit()` takes `candidate: unknown` (the same totality stance as `validateRecord`/`validateA2ui`) plus a small injected `AdmitDeps` bag — a pure function of its inputs, no ambient state."),n(m(s,`AdmitDeps`),`ts`),n(h(s,`export async function admit(`),`ts`),u(3,`retrieve() — zero-dep TF-IDF cosine top-k`),d('Ranks by `promptText` + `meta.componentsUsed`, scoped to a `catalogId`/`protocolVersion` pin, and restricted to non-quarantined `facet:"exemplar"` records regardless of what the caller passes in — a hard, defensive invariant so an eval-facet or quarantined record can never surface in a result. Never throws: an empty scope, `k <= 0`, or zero shared vocabulary all resolve to `[]`, not an error.'),n(m(c,`RetrieveQuery`),`ts`),n(h(c,`export function retrieve(`),`ts`),d("The rest of the surface, one line each: `canonical.ts` — canonicalize an A2uiOutput to its stable hash form; `heal.ts` — the CLOSED, form-only repair list admission runs before validation; `dedup.ts` — exact-hash + MinHash near-duplicate detection (`createDedupIndex`); `record.ts` — the `CorpusRecord` shape + `validateRecord`, the hand-rolled zero-dep schema/field checker; `export.ts` — `exportCatalogExamples`/`exportFineTune`, the two OTHER exemplar-conditioning modes alongside retrieval; `judge.ts` — `createVerdictJudge`, wiring a verdicts file into the `Judge` seam `admit()` consumes; `validate.ts` — re-exports the SAME shared `validateA2ui` the renderer runs (one validator, two consumers).")),l.append(u(3,`Sources`),d(`The written-down laws this page teaches: a2ui-catalog.spec.md §5.2 (rows + guidance notes) · ADR-0087 (whole-fleet coverage) · ADR-0102 (the three-lane chooser) · ADR-0106/0109 (presentation-intent props) · ADR-0107 (the chart rows + array props) · ADR-0055 (the seed shelf) · ADR-0060/0061/0062/0068 (admission, the corpus store, the shared healer, the judge seam). The derived examples above import the live defaultCatalog and allSeeds — if this page and the code disagree, the page is stale and its derivation is the bug.`));