// record.ts — corpus record model + schema validator (corpus LLD-C2, SPEC v0.5 R1/R2/R5/R9,
// ADR-0063/ADR-0064).
//
// `validateRecord` is the zero-dep, hand-rolled checker for the CorpusRecord shape (SPEC §5.1's
// draft-07 schema, transcribed field-by-field — no schema-validation dependency, SPEC-N5). Per the
// LLD-C5 admission pipeline (corpus LLD §6), it owns exactly TWO stages: "schema/field" (E_SCHEMA —
// including the ADR-0063 unconditional-`description` rule and the ADR-0064 single-surface rule) and
// "pin check" (E_PIN, SPEC-R9). Everything downstream — the ADR-0060 facet gate (E_LEAK), tier-1
// catalog/id-graph/pointer checks (E_CATALOG/E_IDGRAPH/E_POINTER, `validate.ts`), dedup (E_DUP), and
// the tier-2 judge (E_QUALITY) — belongs to later slices (`admit.ts`, LLD-C5).
//
// Pure and TOTAL: never throws, always returns a (possibly empty) failure list — the safety net
// mirrors `renderer/validate.ts`'s `validateA2ui`, the shared validator this module's sibling
// `validate.ts` re-exports.

import type { A2uiOutput } from '../protocol.ts'

export type Facet = 'exemplar' | 'eval'
export type Status = 'valid' | 'repaired' | 'quarantined'
export type ProvenanceSource = 'authored' | 'distilled' | 'mined'

export interface CorpusRecord {
  name: string
  description: string
  promptText: string
  target?: string
  catalog?: string
  role_description?: string
  workflow_description?: string
  a2uiOutput?: A2uiOutput // required iff meta.facet === 'exemplar' (SPEC-R2)
  meta: {
    facet: Facet
    protocolVersion: string
    catalogId: string
    catalogVersion?: string
    provenance: { source: ProvenanceSource; origin: string }
    canonicalHash?: string
    componentsUsed?: string[]
    status: Status
    qualityScore?: number
  }
}

// The SPEC §5.3 admission error-code vocabulary — shared by every corpus-store stage. Later slices
// (dedup.ts, heal.ts, admit.ts) import this type rather than redeclaring it.
export type AdmitCode =
  | 'E_SCHEMA'
  | 'E_CATALOG'
  | 'E_IDGRAPH'
  | 'E_POINTER'
  | 'E_DUP'
  | 'E_QUALITY'
  | 'E_PIN'
  | 'E_LEAK'

/** One record-validation failure: an admission code paired with the offending field path. */
export interface RecordFailure {
  code: AdmitCode
  path: string
}

const KNOWN_RECORD_KEYS = new Set([
  'name', 'description', 'promptText', 'target', 'catalog',
  'role_description', 'workflow_description', 'a2uiOutput', 'meta',
])
const KNOWN_META_KEYS = new Set([
  'facet', 'protocolVersion', 'catalogId', 'catalogVersion', 'provenance',
  'canonicalHash', 'componentsUsed', 'status', 'qualityScore',
])
const FACETS: ReadonlySet<string> = new Set<Facet>(['exemplar', 'eval'])
const STATUSES: ReadonlySet<string> = new Set<Status>(['valid', 'repaired', 'quarantined'])
const PROVENANCE_SOURCES: ReadonlySet<string> = new Set<ProvenanceSource>(['authored', 'distilled', 'mined'])

/**
 * Validate a candidate against the corpus record schema (SPEC §5.1). Never throws — returns []
 * when valid, otherwise every failure found (batch, not short-circuit) as an admission code + path.
 */
export function validateRecord(r: unknown): RecordFailure[] {
  try {
    return run(r)
  } catch {
    // Totality safety net (mirrors `renderer/validate.ts`'s `validateA2ui`): any unforeseen input
    // still yields a verdict, never a throw.
    return [{ code: 'E_SCHEMA', path: '' }]
  }
}

function run(r: unknown): RecordFailure[] {
  const failures: RecordFailure[] = []
  if (!isObject(r)) {
    failures.push({ code: 'E_SCHEMA', path: '' })
    return failures
  }

  for (const key of Object.keys(r)) {
    if (!KNOWN_RECORD_KEYS.has(key)) failures.push({ code: 'E_SCHEMA', path: key })
  }

  requireStr(r, 'name', 'name', failures)
  // `description` is unconditionally required for every facet — upstream's `dataset_schema.json`
  // requires it outright and defines no missing-target failure (SPEC v0.4 §5.1 + R1-AC2/R2-AC2,
  // ADR-0063: `target` defaults to `description` for the judge, a consumer rule, not a validation one).
  requireStr(r, 'description', 'description', failures)
  requireStr(r, 'promptText', 'promptText', failures)
  optionalStr(r, 'target', 'target', failures)
  optionalStr(r, 'catalog', 'catalog', failures)
  optionalStr(r, 'role_description', 'role_description', failures)
  optionalStr(r, 'workflow_description', 'workflow_description', failures)
  checkA2uiOutputShape(r, failures)

  const meta = r.meta
  if (!isObject(meta)) {
    failures.push({ code: 'E_SCHEMA', path: 'meta' })
    return failures
  }

  checkMeta(meta, failures)

  if (meta.facet === 'exemplar' && r.a2uiOutput === undefined) {
    failures.push({ code: 'E_SCHEMA', path: 'a2uiOutput' })
  }

  checkPins(r, meta, failures)
  checkSingleSurface(r, meta, failures)

  return failures
}

function checkMeta(meta: Record<string, unknown>, failures: RecordFailure[]): void {
  for (const key of Object.keys(meta)) {
    if (!KNOWN_META_KEYS.has(key)) failures.push({ code: 'E_SCHEMA', path: `meta.${key}` })
  }

  if (typeof meta.facet !== 'string' || !FACETS.has(meta.facet)) {
    failures.push({ code: 'E_SCHEMA', path: 'meta.facet' })
  }
  if (typeof meta.status !== 'string' || !STATUSES.has(meta.status)) {
    failures.push({ code: 'E_SCHEMA', path: 'meta.status' })
  }
  optionalStr(meta, 'catalogVersion', 'meta.catalogVersion', failures)
  optionalStr(meta, 'canonicalHash', 'meta.canonicalHash', failures)
  if (meta.qualityScore !== undefined && typeof meta.qualityScore !== 'number') {
    failures.push({ code: 'E_SCHEMA', path: 'meta.qualityScore' })
  }
  if (meta.componentsUsed !== undefined) {
    const cu = meta.componentsUsed
    if (!Array.isArray(cu) || cu.some((s) => typeof s !== 'string')) {
      failures.push({ code: 'E_SCHEMA', path: 'meta.componentsUsed' })
    }
  }

  const provenance = meta.provenance
  if (!isObject(provenance)) {
    failures.push({ code: 'E_SCHEMA', path: 'meta.provenance' })
  } else {
    if (typeof provenance.source !== 'string' || !PROVENANCE_SOURCES.has(provenance.source)) {
      failures.push({ code: 'E_SCHEMA', path: 'meta.provenance.source' })
    }
    // SPEC-R5 AC1: `provenance.origin` MUST be non-empty (the one explicitly-AC'd emptiness rule
    // besides the SPEC-R9 pin fields below — every other string field is type-only per §5.1).
    if (typeof provenance.origin !== 'string' || provenance.origin === '') {
      failures.push({ code: 'E_SCHEMA', path: 'meta.provenance.origin' })
    }
  }
  // NOTE: `protocolVersion`/`catalogId` are part of the same §5.1 `meta.required` list as the fields
  // above, but the LLD reassigns their presence/value checks to the pin stage (`checkPins`, E_PIN) —
  // deliberately NOT E_SCHEMA (corpus LLD §6 "pin check (LLD-C2) → E_PIN").
}

function checkA2uiOutputShape(r: Record<string, unknown>, failures: RecordFailure[]): void {
  if (r.a2uiOutput === undefined) return
  if (!Array.isArray(r.a2uiOutput)) {
    failures.push({ code: 'E_SCHEMA', path: 'a2uiOutput' })
    return
  }
  r.a2uiOutput.forEach((item, i) => {
    if (!isObject(item)) failures.push({ code: 'E_SCHEMA', path: `a2uiOutput[${i}]` })
  })
}

// SPEC-R9: every record MUST pin `protocolVersion`/`catalogId` (non-empty, AC1), and — when the
// record bundles an `a2uiOutput` — every message's `version` and every `createSurface.catalogId`
// MUST agree with those pins (corpus LLD §6/§8). All three arms raise `E_PIN`.
function checkPins(r: Record<string, unknown>, meta: Record<string, unknown>, failures: RecordFailure[]): void {
  const protocolVersion = meta.protocolVersion
  const catalogId = meta.catalogId
  if (typeof protocolVersion !== 'string' || protocolVersion === '') {
    failures.push({ code: 'E_PIN', path: 'meta.protocolVersion' })
  }
  if (typeof catalogId !== 'string' || catalogId === '') {
    failures.push({ code: 'E_PIN', path: 'meta.catalogId' })
  }
  if (!Array.isArray(r.a2uiOutput)) return

  r.a2uiOutput.forEach((msg, i) => {
    if (!isObject(msg)) return
    if (typeof protocolVersion === 'string' && typeof msg.version === 'string' && msg.version !== protocolVersion) {
      failures.push({ code: 'E_PIN', path: `a2uiOutput[${i}].version` })
    }
    const cs = msg.createSurface
    if (isObject(cs) && typeof catalogId === 'string' && typeof cs.catalogId === 'string' && cs.catalogId !== catalogId) {
      failures.push({ code: 'E_PIN', path: `a2uiOutput[${i}].createSurface.catalogId` })
    }
  })
}

// A v1 corpus record is SINGLE-SURFACE (SPEC-R2 AC3, ADR-0064): every surface-bearing envelope in an
// exemplar's `a2uiOutput` must carry the SAME `surfaceId`, and at least one such envelope must exist.
// `callFunction` is the one envelope kind with no `surfaceId` (SPEC-R14/ADR-0034 — `functionCallId` is
// its top-level sibling instead) and is excluded from the count, not banned. The shared validator
// (`validateA2ui`) judges id-graphs PER surface, so a multi-surface stream is tier-1-legal; the
// canonicalizer folds GLOBALLY (no surface scoping) and would silently last-write-wins two surfaces'
// same-named components into a chimera before hashing. Rejecting here — the record schema, the same
// message walk `checkPins` already does — means the standing corpus-data gate (LLD-C15) also catches a
// hand-edited multi-surface line in a stored shard, not only a freshly-admitted one.
const SURFACE_BEARING_KEYS = ['createSurface', 'updateComponents', 'updateDataModel', 'deleteSurface', 'actionResponse'] as const

function checkSingleSurface(r: Record<string, unknown>, meta: Record<string, unknown>, failures: RecordFailure[]): void {
  if (meta.facet !== 'exemplar' || !Array.isArray(r.a2uiOutput)) return

  let firstSurfaceId: string | undefined
  let sawAnySurface = false

  for (let i = 0; i < r.a2uiOutput.length; i++) {
    const msg = r.a2uiOutput[i]
    if (!isObject(msg)) continue
    const surfaceId = surfaceIdOf(msg)
    if (surfaceId === undefined) continue // callFunction (or an unrecognized/malformed envelope) — excluded

    sawAnySurface = true
    if (firstSurfaceId === undefined) {
      firstSurfaceId = surfaceId
    } else if (surfaceId !== firstSurfaceId) {
      // EXACTLY one surface, not at-most-one: report the SECOND surface's first message, then stop —
      // one failure names the violation (ADR-0064 acceptance: "rejects at the second surface's message path").
      failures.push({ code: 'E_SCHEMA', path: `a2uiOutput[${i}]` })
      return
    }
  }

  // Zero surfaces addressed (e.g. a callFunction-only output) renders nothing and is not an exemplar —
  // the EXACTLY-one bound closes this hole too (it would otherwise pass tier-1 vacuously: no surface,
  // no id-graph check).
  if (!sawAnySurface) failures.push({ code: 'E_SCHEMA', path: 'a2uiOutput' })
}

function surfaceIdOf(msg: Record<string, unknown>): string | undefined {
  for (const key of SURFACE_BEARING_KEYS) {
    const body = msg[key]
    if (isObject(body) && typeof body.surfaceId === 'string') return body.surfaceId
  }
  return undefined
}

// — small helpers (mirrors `renderer/validate.ts`'s defensive style) ————————————————————

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

function requireStr(o: Record<string, unknown>, key: string, path: string, failures: RecordFailure[]): void {
  if (typeof o[key] !== 'string') failures.push({ code: 'E_SCHEMA', path })
}

function optionalStr(o: Record<string, unknown>, key: string, path: string, failures: RecordFailure[]): void {
  if (o[key] !== undefined && typeof o[key] !== 'string') failures.push({ code: 'E_SCHEMA', path })
}
