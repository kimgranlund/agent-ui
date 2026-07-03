// admit.ts — the admission pipeline (corpus LLD-C5, SPEC-R5-R9, ADR-0060/0061/0063).
//
// The corpus's ONE write path (LLD §2 invariant iv): every stage below is independently testable and
// short-circuits on its first failure, in this order (LLD §6):
//
//   heal (LLD-C7) -> schema/field (LLD-C2) -> facet gate (ADR-0060) -> pin check (LLD-C2)
//   -> tier-1 (LLD-C6, shared validateA2ui) -> pointer RESOLUTION (corpus-only)
//   -> leak gate (LLD-C4 MinHash vs the eval corpus) -> canonical+hash (LLD-C3) -> dedup (LLD-C4)
//   -> tier-2 rubric (deps.judge, ADR-0060) -> write (LLD-C1)
//
// `admit(candidate, deps)` accepts `candidate: unknown` (mirrors `validateRecord`/`validateA2ui`'s
// totality stance — this is the single gateway all untrusted input passes through) and a small,
// injected dependency bag (`AdmitDeps`) so the pipeline stays a pure function of its inputs: the
// catalog to validate against, the (stateful, shared-across-calls) store and dedup index, and an
// OPTIONAL tier-2 judge (ADR-0060's seam — absent until the harness wave lands the corpus-quality
// rubric; the stage is then simply skipped and `qualityScore` stays unset, the honest marker).
//
// A "candidate" differs from a full `CorpusRecord` in exactly the ways admission itself fills in:
// `a2uiOutput` may still be raw text needing `heal`, and `meta.status`/`canonicalHash`/`componentsUsed`/
// `qualityScore` do not exist yet (ADR-0055's seed-mapping note: "`meta.status` set by admission").
// `validateRecord` (LLD-C2) was written to check a COMPLETE `CorpusRecord`, so admission bridges the
// gap by defaulting a placeholder `meta.status` before the schema/field call purely so that stage can
// run — admission is the sole authority over the FINAL status (computed from `heal`'s `changed` flag)
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
 * SPEC-R8 bar itself is the judge's own concern — this module only reads `passed`/`qualityScore`. */
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
  /** The catalog `deps.store`'s pinned records validate against (tier-1, LLD-C6) — the caller resolves
   * whichever `Catalog` matches the candidate's `meta.catalogId`; admission does not own catalog lookup. */
  catalog: Catalog
  /** Shared, stateful across calls in one admission session (the seed-import loop, a future harness run). */
  store: CorpusStore
  /** Shared, stateful across calls — the exact-hash + MinHash near-dup index (LLD-C4). */
  dedupIndex: DedupIndex
  /** ADR-0060's tier-2 seam. Absent ⇒ tier-2 is skipped and `qualityScore` stays unset. */
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
      /** The colliding record's name (SPEC §5.2's `AdmitResult` sketch) — populated on BOTH E_DUP
       * flavors (exact canonical-hash and MinHash near-match) with the FIRST-ADMITTED record's name;
       * absent for every other code. A structured alternative to regex-parsing `message`. */
      collidesWith?: string
    }

/** Admit one candidate through the full pipeline (LLD §6). Async: `canonicalize` rides `crypto.subtle`. */
export async function admit(candidate: unknown, deps: AdmitDeps): Promise<AdmitResult> {
  if (!isObject(candidate)) return reject('E_SCHEMA', 'candidate must be an object')

  // Stage 1 — heal (LLD-C7 / ADR-0061). Only `a2uiOutput` is healable; its absence is legal (an
  // eval-facet candidate carries none) — the facet gate below still rejects any eval candidate.
  const healedCandidate: Record<string, unknown> = { ...candidate }
  let repairs: string[] = []
  let changed = false
  if (candidate.a2uiOutput !== undefined) {
    const healed = heal(candidate.a2uiOutput as string | A2uiOutput, extractPin(candidate))
    if (!healed.ok) return reject('E_SCHEMA', `heal: ${healed.reason}`)
    healedCandidate.a2uiOutput = healed.messages
    repairs = healed.repairs
    changed = healed.changed
  }
  // Bridge the candidate/record gap (see file header): `validateRecord` unconditionally requires a
  // valid `meta.status`, but admission — not the caller — owns that field. Default a placeholder ONLY
  // so the schema/field stage below can run; the true status is computed and overwritten unconditionally
  // at the write stage, so this placeholder is never observable in an admitted (or rejected) result.
  if (isObject(healedCandidate.meta)) {
    healedCandidate.meta = { status: 'valid', ...healedCandidate.meta }
  }

  // Stage 2 — schema/field (LLD-C2, ADR-0063: `description` unconditional; the old missing-target code is retired).
  const recordFailures = validateRecord(healedCandidate)
  const schemaFailures = recordFailures.filter((f) => f.code === 'E_SCHEMA')
  if (schemaFailures.length > 0) return rejectPaths('E_SCHEMA', schemaFailures)

  // `healedCandidate` passed the shape check above (batched with the pin check below, split by code) —
  // narrow via `unknown` since it started life as `Record<string, unknown>`, not a structural subtype.
  const record = healedCandidate as unknown as CorpusRecord

  // Stage 3 — the ADR-0060 facet gate: fail-closed until LLD-C8's contamination mechanism exists.
  if (record.meta.facet === 'eval') {
    return reject('E_LEAK', 'eval facet fail-closed: the LLD-C8 contamination mechanism is unbuilt (ADR-0060)')
  }

  // Stage 4 — pin check (LLD-C2, SPEC-R9).
  const pinFailures = recordFailures.filter((f) => f.code === 'E_PIN')
  if (pinFailures.length > 0) return rejectPaths('E_PIN', pinFailures)

  if (record.a2uiOutput === undefined) {
    // Unreachable in practice: an exemplar without `a2uiOutput` already failed schema/field above, and
    // eval candidates were already turned away by the facet gate. Kept as a defensive totality guard.
    return reject('E_SCHEMA', 'a2uiOutput is required past the facet gate')
  }
  const output = record.a2uiOutput

  // Stage 5 — tier-1 deterministic (LLD-C6, the shared `validateA2ui` — parity, SPEC-N1/R8-AC3).
  const verdict = validateA2ui(output, deps.catalog)
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
    return { ok: false, code: 'E_LEAK', message: `promptText collides with the held-out eval record "${leakName}"` }
  }

  // Stage 8 — canonical + hash (LLD-C3): fills `meta.canonicalHash`/`componentsUsed`.
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
  if (exactName !== null) return reject('E_DUP', `exact canonical-hash collision with "${exactName}"`, exactName)
  const signature = minHashSignature(`${enriched.promptText} ${canonical.serialized}`)
  const nearName = deps.dedupIndex.near(signature, DEFAULT_THETA_DUP)
  if (nearName !== null) {
    return reject('E_DUP', `near-duplicate (theta>=${DEFAULT_THETA_DUP}) of "${nearName}"`, nearName)
  }

  // Stage 10 — tier-2 rubric (deps.judge — INJECTED seam, ADR-0060). Absent ⇒ skipped, `qualityScore`
  // stays unset (the honest marker of an unjudged record).
  let finalRecord = enriched
  if (deps.judge) {
    const judged = await deps.judge.score(enriched)
    if (!judged.passed) {
      return { ok: false, code: 'E_QUALITY', message: 'below the corpus-quality rubric bar', failingDimensions: judged.failingDimensions }
    }
    finalRecord = { ...enriched, meta: { ...enriched.meta, qualityScore: judged.qualityScore } }
  }

  // Stage 11 — write (LLD-C1): `store.put()` is the single mutation path; dedup registers alongside it.
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
  return { ok: false, code, message: `${code}: ${paths.length} field(s) failed`, paths }
}

// The LLD §6 tier-1 -> admission code table. `FUNCTION` is a render-time-only code (protocol.ts:
// binding-evaluation failures, never emitted by the static `validateA2ui`) and has no table row —
// defaulted to `E_SCHEMA` defensively rather than silently dropped.
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
      return 'E_IDGRAPH'
    case 'POINTER':
      return 'E_POINTER'
    default:
      return 'E_SCHEMA'
  }
}

/** Map a tier-1 verdict's failures to ONE admission code (the first failure's mapped code wins — tier-1
 * itself already short-circuits a top-level PARSE/SCHEMA defect before any batched per-component
 * failures can co-occur); `paths` collects every failure that shares that same mapped code. */
function rejectTier1(failures: Failure[]): AdmitResult {
  const mapped = failures.map((f) => ({ code: mapTier1Code(f.code), path: f.path }))
  const primary = mapped[0]!.code
  const paths = mapped.filter((m) => m.code === primary).map((m) => m.path)
  return { ok: false, code: primary, message: `tier-1 validation failed (${primary})`, paths }
}

/** The leak gate (LLD §6/§8): an EXEMPLAR candidate's prompt is checked against every already-admitted
 * `facet:"eval"` record's prompt (MinHash near-match, LLD-C4's recipe applied to `promptText` alone —
 * an eval record may carry no `a2uiOutput` at all, so the full dedup recipe does not apply here). The
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
 * upsert/apply-in-order semantics `canonical.ts`'s `foldStream` uses (re-implemented, not imported,
 * for the same reason canonical.ts gives for its own `setAtPointer`: this module stays decoupled from
 * that module's private internals; both independently mirror the renderer's documented semantics). */
function foldForResolution(out: A2uiOutput): { byId: Map<string, A2uiComponent>; dataModel: unknown } {
  const byId = new Map<string, A2uiComponent>()
  let dataModel: unknown
  for (const msg of out) {
    if ('updateComponents' in msg) {
      for (const comp of msg.updateComponents.components) byId.set(comp.id, comp)
    } else if ('updateDataModel' in msg) {
      const { path, value } = msg.updateDataModel
      dataModel = path === undefined || path === '' ? value : setAtPointer(dataModel, path, value)
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

/** Read a value at an absolute-or-empty RFC-6901 pointer. `ok:false` means it does not resolve. */
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

/** One component's list-item scope (renderer `ItemScope`, minus `index` — resolution always checks the
 * witness element, index 0). `arrayPath` is the bound array's ABSOLUTE pointer, already composed
 * through any outer nesting — the exact value `renderer/list.ts#renderList`'s `scopedPointer(template.
 * path, parentItemScope)` computes for that same template at render time. */
interface EffectiveScope {
  arrayPath: string
}

/**
 * Assign every declared component the scope it would actually render under (mirrors
 * `renderer/tree.ts#mountChildrenInto` + `renderer/list.ts#renderList` exactly, statically): a DFS from
 * `root` following `child`/`children` propagates the CURRENT scope unchanged to every static descendant
 * (a container item's whole subtree shares one scope, not just the template's immediate target — the
 * bug this rewrite fixes: `section_title`/`tile_label` are descendants of a template target, not the
 * target itself). A `children`-TEMPLATE at ANY depth introduces a NEW scope for its own target (and, by
 * the same propagation, that target's descendants): the template's `path` is resolved relative to the
 * CURRENT scope exactly as `scopedPointer` does (composed as `{current.arrayPath}/0/{path}` — index 0,
 * the witness element) when a current scope exists, else left unchanged (the top-level-list case, where
 * `path` is already absolute). A component never reached from `root` (dangling ref, or a disconnected
 * island canonical.ts itself tolerates) is simply never visited — `scopes.get(id)` then naturally
 * returns `undefined`, the same conservative "no scope" verdict a root-level static component gets.
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
      const arrayPath = scope === undefined ? comp.children.path : `${scope.arrayPath}/0/${comp.children.path}`
      visit(comp.children.componentId, { arrayPath })
    }
  }

  visit('root', undefined)
  return scopes
}

/**
 * Every bound (`{path}`) top-level property on every declared component must resolve against the
 * record's own folded data model (LLD §6/§7). Scope matches tier-1's own reach exactly (direct
 * component properties, `RESERVED_PROPS` excluded) — this stage adds resolution semantics on top of
 * tier-1's syntax check, not a wider surface. An ABSOLUTE path (`/`-led) resolves against the document
 * root; a RELATIVE path resolves only when `computeScopes` assigned its component a scope (anywhere
 * inside a dynamic-list item's subtree, ADR-0024 — not just the template's immediate target), through
 * the bound array's element 0 (the witness element, `{path}/{index}/{rest}` with `index=0`). A relative
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
        if (!readPointer(dataModel, path).ok) unresolved.push(`${comp.id}.${key}`)
        continue
      }

      if (scope === undefined) {
        unresolved.push(`${comp.id}.${key}`) // relative binding, no enclosing list-item scope
        continue
      }

      const effectivePath = path === '' ? `${scope.arrayPath}/0` : `${scope.arrayPath}/0/${path}`
      if (!readPointer(dataModel, effectivePath).ok) unresolved.push(`${comp.id}.${key}`)
    }
  }

  return unresolved
}

// — small helpers ————————————————————————————————————————————————————————————————

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
