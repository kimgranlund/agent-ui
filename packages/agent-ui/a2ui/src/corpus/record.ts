// record.ts: corpus record model + schema validator (corpus LLD-C2, SPEC v0.6 R1/R2/R5/R9,
// ADR-0063/ADR-0064/ADR-0231).
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
//
// ADR-0231 adds two model-visible facets, each with its own conditional branch of top-level fields:
// `multi-turn` (`priorOutput` + `clientInput` + the follow-up `a2uiOutput`) and `repair`
// (`invalidInput` + `validatorErrors` + the corrected `a2uiOutput`). The exemplar and eval branches are
// unchanged: a branch field on a facet that does not own it rejects at that field, exactly as the closed
// schema rejected it before the fields existed.

import type { A2uiActionMessage, A2uiOutput, ErrorCode, Failure } from '../protocol.ts'

export type Facet = 'exemplar' | 'eval' | 'multi-turn' | 'repair'
/** The ADR-0231 cl.1 model-visible class: public conditioning material, plain `.jsonl` shards. */
export type ModelVisibleFacet = Exclude<Facet, 'eval'>
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
  a2uiOutput?: A2uiOutput // required iff meta.facet is model-visible (SPEC-R2, ADR-0231)
  priorOutput?: A2uiOutput // multi-turn only, required (ADR-0231 cl.2): turn 1
  clientInput?: A2uiActionMessage[] // multi-turn only, required, v1 length exactly 1 (ADR-0231 cl.2)
  invalidInput?: A2uiOutput // repair only, required (ADR-0231 cl.3): the broken stream
  validatorErrors?: Failure[] // repair only, required, non-empty (ADR-0231 cl.3)
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
// The ADR-0231 branch fields, each owned by exactly one facet. On any other facet the field is still
// an unknown key (E_SCHEMA at the field path), so the exemplar and eval branches reject it as before.
const BRANCH_FIELD_OWNER: Readonly<Record<string, Facet>> = {
  priorOutput: 'multi-turn',
  clientInput: 'multi-turn',
  invalidInput: 'repair',
  validatorErrors: 'repair',
}
const KNOWN_META_KEYS = new Set([
  'facet', 'protocolVersion', 'catalogId', 'catalogVersion', 'provenance',
  'canonicalHash', 'componentsUsed', 'status', 'qualityScore',
])
const FACETS: ReadonlySet<string> = new Set<Facet>(['exemplar', 'eval', 'multi-turn', 'repair'])
// `ErrorCode` (`protocol.ts`) is a type-only union with no runtime list. A `Record<ErrorCode, true>`
// literal is exhaustive by construction: adding or removing a union member reds `tsc` here.
const ERROR_CODE_MEMBERS: Readonly<Record<ErrorCode, true>> = {
  PARSE: true, SCHEMA: true, CATALOG: true, CATALOG_UNKNOWN: true, IDGRAPH: true,
  POINTER: true, VERSION_UNSUPPORTED: true, FUNCTION: true, DEPTH_EXCEEDED: true, CONTAINMENT: true,
}
const ERROR_CODES: ReadonlySet<string> = new Set(Object.keys(ERROR_CODE_MEMBERS))
// The six required `A2uiAction` fields (runtime SPEC §5.2 / `protocol.ts`) plus its two optionals.
const ACTION_STRING_FIELDS = ['surfaceId', 'actionId', 'name', 'sourceComponentId', 'timestamp'] as const
const KNOWN_ACTION_KEYS = new Set<string>([...ACTION_STRING_FIELDS, 'context', 'wantResponse', 'dataModel'])
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

  const facet = isObject(r.meta) ? r.meta.facet : undefined
  for (const key of Object.keys(r)) {
    if (KNOWN_RECORD_KEYS.has(key)) continue
    if (BRANCH_FIELD_OWNER[key] !== undefined && BRANCH_FIELD_OWNER[key] === facet) continue
    failures.push({ code: 'E_SCHEMA', path: key })
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
  if (meta.facet === 'multi-turn') checkMultiTurnBranch(r, failures)
  if (meta.facet === 'repair') checkRepairBranch(r, failures)

  checkPins(r, meta, failures)
  checkSingleSurface(r, meta, failures)

  return failures
}

// ADR-0231 cl.2 shape: all three fields present; `clientInput` is exactly one `action` envelope whose
// body carries the six required `A2uiAction` fields with the right primitive types. Any other client
// envelope kind (`error`, `functionResponse`) is a v1 non-goal and rejects at `clientInput[0]`.
function checkMultiTurnBranch(r: Record<string, unknown>, failures: RecordFailure[]): void {
  checkStreamShape(r, 'priorOutput', failures)
  if (r.a2uiOutput === undefined) failures.push({ code: 'E_SCHEMA', path: 'a2uiOutput' })

  const ci = r.clientInput
  if (ci === undefined || !Array.isArray(ci) || ci.length !== 1) {
    failures.push({ code: 'E_SCHEMA', path: 'clientInput' })
    return
  }
  const env: unknown = ci[0]
  if (!isObject(env) || !isObject(env.action) || Object.keys(env).some((k) => k !== 'version' && k !== 'action')) {
    failures.push({ code: 'E_SCHEMA', path: 'clientInput[0]' })
    return
  }
  if (typeof env.version !== 'string') failures.push({ code: 'E_SCHEMA', path: 'clientInput[0].version' })
  const action = env.action
  const at = 'clientInput[0].action'
  for (const key of Object.keys(action)) {
    if (!KNOWN_ACTION_KEYS.has(key)) failures.push({ code: 'E_SCHEMA', path: `${at}.${key}` })
  }
  for (const key of ACTION_STRING_FIELDS) requireStr(action, key, `${at}.${key}`, failures)
  if (!isObject(action.context)) failures.push({ code: 'E_SCHEMA', path: `${at}.context` })
  if (action.wantResponse !== undefined && typeof action.wantResponse !== 'boolean') {
    failures.push({ code: 'E_SCHEMA', path: `${at}.wantResponse` })
  }
}

// ADR-0231 cl.3 shape: all three fields present; `validatorErrors` is a non-empty list of
// `{ code, path }` entries with `code` in the full `ErrorCode` union. Membership only: which codes a
// pair can actually carry is enforced by admission's recomputation equality, not here.
function checkRepairBranch(r: Record<string, unknown>, failures: RecordFailure[]): void {
  checkStreamShape(r, 'invalidInput', failures)
  if (r.a2uiOutput === undefined) failures.push({ code: 'E_SCHEMA', path: 'a2uiOutput' })

  const ve = r.validatorErrors
  if (ve === undefined || !Array.isArray(ve) || ve.length === 0) {
    failures.push({ code: 'E_SCHEMA', path: 'validatorErrors' })
    return
  }
  ve.forEach((entry: unknown, i) => {
    const at = `validatorErrors[${i}]`
    if (!isObject(entry)) {
      failures.push({ code: 'E_SCHEMA', path: at })
      return
    }
    for (const key of Object.keys(entry)) {
      if (key !== 'code' && key !== 'path') failures.push({ code: 'E_SCHEMA', path: `${at}.${key}` })
    }
    if (typeof entry.code !== 'string' || !ERROR_CODES.has(entry.code)) {
      failures.push({ code: 'E_SCHEMA', path: `${at}.code` })
    }
    requireStr(entry, 'path', `${at}.path`, failures)
  })
}

// A required message-array stream other than `a2uiOutput` (whose shape check runs before `meta`):
// present, an array, every item an object.
function checkStreamShape(r: Record<string, unknown>, key: 'priorOutput' | 'invalidInput', failures: RecordFailure[]): void {
  const stream = r[key]
  if (!Array.isArray(stream)) {
    failures.push({ code: 'E_SCHEMA', path: key })
    return
  }
  stream.forEach((item: unknown, i) => {
    if (!isObject(item)) failures.push({ code: 'E_SCHEMA', path: `${key}[${i}]` })
  })
}

// The streams a facet bundles, in stream order. The exemplar (and eval, and an unknown facet) bundle
// `a2uiOutput` alone, so the walks below are byte-identical to the pre-ADR-0231 ones for them.
type StreamField = 'priorOutput' | 'clientInput' | 'invalidInput' | 'a2uiOutput'
function streamsOf(facet: unknown): readonly StreamField[] {
  if (facet === 'multi-turn') return ['priorOutput', 'clientInput', 'a2uiOutput']
  if (facet === 'repair') return ['invalidInput', 'a2uiOutput']
  return ['a2uiOutput']
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

// SPEC-R9: every record MUST pin `protocolVersion`/`catalogId` (non-empty, AC1), and every message's
// `version` and every `createSurface.catalogId` in every stream the record bundles (ADR-0231: the
// multi-turn prior, client and follow-up streams; the repair invalid and corrected streams) MUST agree
// with those pins (corpus LLD §6/§8). All three arms raise `E_PIN`.
//
// The two server streams admission never heals (`priorOutput`, `invalidInput`; ADR-0231 cl.4) are held
// stricter than `a2uiOutput`: a message whose `version` is ABSENT (or not a string) there is `E_PIN` too,
// not only one that names another version. Filling an absent `version` is the healer's arm (d)
// (ADR-0061), so a repair pair built around that breakage is a named non-goal (ADR-0231 cl.3/cl.7), and a
// prior turn is held to the same post-heal shape its follow-up has. `a2uiOutput` keeps the mismatch-only arm:
// stage 1 has already filled its absent versions from the pin. `clientInput`'s envelope `version` is a
// required string in its own shape check (E_SCHEMA), so it keeps the mismatch-only arm as well.
const UNHEALED_STREAMS: ReadonlySet<StreamField> = new Set(['priorOutput', 'invalidInput'])

function checkPins(r: Record<string, unknown>, meta: Record<string, unknown>, failures: RecordFailure[]): void {
  const protocolVersion = meta.protocolVersion
  const catalogId = meta.catalogId
  if (typeof protocolVersion !== 'string' || protocolVersion === '') {
    failures.push({ code: 'E_PIN', path: 'meta.protocolVersion' })
  }
  if (typeof catalogId !== 'string' || catalogId === '') {
    failures.push({ code: 'E_PIN', path: 'meta.catalogId' })
  }

  for (const field of streamsOf(meta.facet)) {
    const stream = r[field]
    if (!Array.isArray(stream)) continue
    const unhealed = UNHEALED_STREAMS.has(field)
    stream.forEach((msg: unknown, i) => {
      if (!isObject(msg)) return
      const versionChecked = unhealed || typeof msg.version === 'string'
      if (typeof protocolVersion === 'string' && versionChecked && msg.version !== protocolVersion) {
        failures.push({ code: 'E_PIN', path: `${field}[${i}].version` })
      }
      const cs = msg.createSurface
      if (isObject(cs) && typeof catalogId === 'string' && typeof cs.catalogId === 'string' && cs.catalogId !== catalogId) {
        failures.push({ code: 'E_PIN', path: `${field}[${i}].createSurface.catalogId` })
      }
    })
  }
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
//
// ADR-0231 widens the rule to every model-visible facet over the UNION of the streams it bundles, walked
// in stream order (multi-turn: `priorOutput`, `clientInput`, `a2uiOutput`; repair: `invalidInput`,
// `a2uiOutput`), and requires the facet's own `a2uiOutput` to carry at least one surface-bearing message
// (an empty follow-up or an empty correction teaches nothing). In `clientInput` the `action` body's
// `surfaceId` is the surface-bearing field. The exemplar walk (one stream, `a2uiOutput`) is unchanged.
const SURFACE_BEARING_KEYS = ['createSurface', 'updateComponents', 'updateDataModel', 'deleteSurface', 'actionResponse'] as const

function checkSingleSurface(r: Record<string, unknown>, meta: Record<string, unknown>, failures: RecordFailure[]): void {
  const facet = meta.facet
  if (facet !== 'exemplar' && facet !== 'multi-turn' && facet !== 'repair') return
  if (!Array.isArray(r.a2uiOutput)) return

  let firstSurfaceId: string | undefined
  let outputHasSurface = false

  for (const field of streamsOf(facet)) {
    const stream = r[field]
    if (!Array.isArray(stream)) continue
    for (let i = 0; i < stream.length; i++) {
      const msg: unknown = stream[i]
      if (!isObject(msg)) continue
      const surfaceId = field === 'clientInput' ? actionSurfaceIdOf(msg) : surfaceIdOf(msg)
      if (surfaceId === undefined) continue // callFunction (or an unrecognized/malformed envelope): excluded

      if (field === 'a2uiOutput') outputHasSurface = true
      if (firstSurfaceId === undefined) {
        firstSurfaceId = surfaceId
      } else if (surfaceId !== firstSurfaceId) {
        // EXACTLY one surface, not at-most-one: report the SECOND surface's first message, then stop;
        // one failure names the violation (ADR-0064 acceptance: "rejects at the second surface's message path").
        failures.push({ code: 'E_SCHEMA', path: `${field}[${i}]` })
        return
      }
    }
  }

  // Zero surfaces addressed (e.g. a callFunction-only output) renders nothing and is not an exemplar —
  // the EXACTLY-one bound closes this hole too (it would otherwise pass tier-1 vacuously: no surface,
  // no id-graph check). For an exemplar `a2uiOutput` is the only stream, so this is the same predicate.
  if (!outputHasSurface) failures.push({ code: 'E_SCHEMA', path: 'a2uiOutput' })
}

function surfaceIdOf(msg: Record<string, unknown>): string | undefined {
  for (const key of SURFACE_BEARING_KEYS) {
    const body = msg[key]
    if (isObject(body) && typeof body.surfaceId === 'string') return body.surfaceId
  }
  return undefined
}

function actionSurfaceIdOf(msg: Record<string, unknown>): string | undefined {
  const body = msg.action
  return isObject(body) && typeof body.surfaceId === 'string' ? body.surfaceId : undefined
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
