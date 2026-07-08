// record.ts — the A2A corpus record model + schema validator (corpus LLD-C1, SPEC-R14/AC1).
//
// Mirrors the a2ui corpus's `record.ts` discipline (`packages/agent-ui/a2ui/src/corpus/record.ts`) —
// re-derived here, not shared: this file is zero-dep (no `fs`, no Node builtins) so the browser page
// (B5, LLD-C9) can import the SAME validator the admission tool and the standing gate use (SPEC-N1's
// no-forks stance applied to the corpus).
//
// Code ownership (LLD §2, the design note repeated verbatim so a future edit can't silently drift):
// `validateCorpusRecord` owns THREE of the corpus's four admission codes —
//   E_SCHEMA — container shape: closed key sets on the record and `meta`, vocab checks on
//              `facet`/`status`/`provenance.source`, well-formed `wire[]` discriminators (incl. the
//              `expect` vocab on a transcript reference), non-empty `provenance.origin`.
//   E_PIN    — `meta.protocolVersion` non-empty AND `=== opts.protocolVersion` (presence is
//              deliberately E_PIN, not E_SCHEMA — the a2ui `checkPins` precedent).
//   E_CITE   — the SHAPE/EMPTINESS arm only: `citations` must be a non-empty array of well-formed
//              entries. Anything wrong with GROUNDING carries E_CITE end to end (so a firing fixture
//              per code stays clean) — citation RESOLUTION and all of E_REPLAY need I/O or the shared
//              validator and belong to admission (`admit.ts`, LLD-C3), not this module.
//
// No healer exists here (LLD §8.4): a malformed candidate is rejected, never repaired — every seed is
// typed, authored TS (LLD-C4), not raw/mined model output.
//
// Pure and TOTAL: never throws — always returns a (possibly empty) failure list, the same safety net
// `validateRecord`/`validateA2a` use.

export type A2aFacet = 'concept' | 'demo'
export type A2aRecordStatus = 'valid' | 'quarantined'
export type A2aProvenanceSource = 'authored' | 'distilled' | 'mined'

/** Grounding citation — the record's tie to verified truth (SPEC-R14's grounding arm; PRD-G6
 * discipline). 'hv' rows are the SPEC §2 host-verification ledger (the verbatim-quote substrate);
 * 'repo' paths point at committed artifacts (an ADR, a module, a fixture). Resolution is checked by
 * admission/the gate, never trusted here — this module only checks SHAPE. */
export type A2aCitation =
  | { kind: 'hv'; row: string } // 'HV-1'…'HV-12' — must exist RESOLVED in the SPEC §2 ledger
  | { kind: 'repo'; path: string } // repo-relative; must exist on disk

/** One wire artifact. Inline kinds are exactly the shared validator's own artifact vocabulary
 * (`A2aArtifactKind`, `../protocol/validate.ts` — SPEC-R6 judges message · task · card · rpc-request ·
 * rpc-response); 'transcript' references a committed match fixture BY PATH (never inlined — one fact,
 * one home: the fixture stays owned by the arena's LLD-C9) and declares the isolation verdict it
 * expects. */
export type A2aWireArtifact =
  | { kind: 'message' | 'task' | 'card' | 'rpc-request' | 'rpc-response'; artifact: unknown }
  | { kind: 'transcript'; path: string; expect: 'clean' | 'contaminated' }

export interface A2aCorpusRecord {
  name: string // unique join key across BOTH shards (the a2ui invariant i)
  description: string // one-line summary (the page card's subtitle)
  body: string // the teaching prose — the ONE home for concept prose (SPEC-R15)
  citations: A2aCitation[] // ≥ 1 — a record with no resolvable grounding is not "documented"
  wire: A2aWireArtifact[] // ≥ 1 (SPEC-R14 "one or more wire artifacts")
  meta: {
    facet: A2aFacet
    protocolVersion: string // must equal the family pin (PROTOCOL_VERSION, `../protocol/types.ts`)
    provenance: { source: A2aProvenanceSource; origin: string }
    status: A2aRecordStatus
  }
}

export type CorpusAdmitCode = 'E_SCHEMA' | 'E_PIN' | 'E_CITE' | 'E_REPLAY'
export interface CorpusFailure {
  code: CorpusAdmitCode
  path: string
  detail: string
}

const KNOWN_RECORD_KEYS = new Set(['name', 'description', 'body', 'citations', 'wire', 'meta'])
const KNOWN_META_KEYS = new Set(['facet', 'protocolVersion', 'provenance', 'status'])
const FACETS: ReadonlySet<string> = new Set<A2aFacet>(['concept', 'demo'])
const STATUSES: ReadonlySet<string> = new Set<A2aRecordStatus>(['valid', 'quarantined'])
const PROVENANCE_SOURCES: ReadonlySet<string> = new Set<A2aProvenanceSource>(['authored', 'distilled', 'mined'])
const INLINE_WIRE_KINDS: ReadonlySet<string> = new Set(['message', 'task', 'card', 'rpc-request', 'rpc-response'])
const TRANSCRIPT_EXPECTATIONS: ReadonlySet<string> = new Set(['clean', 'contaminated'])

/**
 * Validate a candidate against the corpus record schema (LLD §2). Never throws — returns [] when
 * valid, otherwise every failure found (batch, not short-circuit).
 */
export function validateCorpusRecord(r: unknown, opts: { protocolVersion: string }): CorpusFailure[] {
  try {
    return run(r, opts)
  } catch (e) {
    // Totality safety net (mirrors `validateRecord`/`validateA2a`): any unforeseen input still yields a
    // verdict, never a throw.
    return [{ code: 'E_SCHEMA', path: '', detail: `unexpected validator exception: ${String(e)}` }]
  }
}

function run(r: unknown, opts: { protocolVersion: string }): CorpusFailure[] {
  const failures: CorpusFailure[] = []
  if (!isObject(r)) {
    failures.push({ code: 'E_SCHEMA', path: '', detail: 'candidate must be an object' })
    return failures
  }

  for (const key of Object.keys(r)) {
    if (!KNOWN_RECORD_KEYS.has(key)) failures.push({ code: 'E_SCHEMA', path: key, detail: `unknown top-level key "${key}"` })
  }

  requireNonEmptyStr(r, 'name', 'name', failures)
  requireNonEmptyStr(r, 'description', 'description', failures)
  requireNonEmptyStr(r, 'body', 'body', failures)
  checkCitationsShape(r.citations, failures)
  checkWireShape(r.wire, failures)

  const meta = r.meta
  if (!isObject(meta)) {
    failures.push({ code: 'E_SCHEMA', path: 'meta', detail: 'meta must be an object' })
    return failures
  }
  checkMeta(meta, failures)
  checkPin(meta, opts, failures)

  return failures
}

function checkMeta(meta: Record<string, unknown>, failures: CorpusFailure[]): void {
  for (const key of Object.keys(meta)) {
    if (!KNOWN_META_KEYS.has(key)) failures.push({ code: 'E_SCHEMA', path: `meta.${key}`, detail: `unknown meta key "${key}"` })
  }

  if (typeof meta.facet !== 'string' || !FACETS.has(meta.facet)) {
    failures.push({ code: 'E_SCHEMA', path: 'meta.facet', detail: `facet must be one of ${[...FACETS].join('|')}` })
  }
  if (typeof meta.status !== 'string' || !STATUSES.has(meta.status)) {
    failures.push({ code: 'E_SCHEMA', path: 'meta.status', detail: `status must be one of ${[...STATUSES].join('|')}` })
  }

  const provenance = meta.provenance
  if (!isObject(provenance)) {
    failures.push({ code: 'E_SCHEMA', path: 'meta.provenance', detail: 'provenance must be an object' })
    return
  }
  if (typeof provenance.source !== 'string' || !PROVENANCE_SOURCES.has(provenance.source)) {
    failures.push({ code: 'E_SCHEMA', path: 'meta.provenance.source', detail: `source must be one of ${[...PROVENANCE_SOURCES].join('|')}` })
  }
  if (typeof provenance.origin !== 'string' || provenance.origin === '') {
    failures.push({ code: 'E_SCHEMA', path: 'meta.provenance.origin', detail: 'origin must be a non-empty string' })
  }
}

// SPEC-R14: every record MUST pin `protocolVersion` — presence is deliberately E_PIN, not E_SCHEMA (the
// a2ui `checkPins` precedent, LLD §2).
function checkPin(meta: Record<string, unknown>, opts: { protocolVersion: string }, failures: CorpusFailure[]): void {
  const pin = meta.protocolVersion
  if (typeof pin !== 'string' || pin === '') {
    failures.push({ code: 'E_PIN', path: 'meta.protocolVersion', detail: 'protocolVersion must be a non-empty string' })
    return
  }
  if (pin !== opts.protocolVersion) {
    failures.push({
      code: 'E_PIN',
      path: 'meta.protocolVersion',
      detail: `unsupported protocolVersion "${pin}" (expected "${opts.protocolVersion}")`,
    })
  }
}

// The grounding arm owns its own code end to end (LLD §2): a missing/empty/malformed `citations`
// carries E_CITE, never E_SCHEMA — so a firing fixture per admission code stays clean (one concern, one
// code).
function checkCitationsShape(citations: unknown, failures: CorpusFailure[]): void {
  if (!Array.isArray(citations) || citations.length === 0) {
    failures.push({ code: 'E_CITE', path: 'citations', detail: 'citations must be a non-empty array' })
    return
  }
  citations.forEach((c, i) => {
    if (!isObject(c)) {
      failures.push({ code: 'E_CITE', path: `citations[${i}]`, detail: 'citation must be an object' })
      return
    }
    if (c.kind === 'hv') {
      if (typeof c.row !== 'string' || c.row === '') {
        failures.push({ code: 'E_CITE', path: `citations[${i}]`, detail: 'hv citation must carry a non-empty "row"' })
      }
    } else if (c.kind === 'repo') {
      if (typeof c.path !== 'string' || c.path === '') {
        failures.push({ code: 'E_CITE', path: `citations[${i}]`, detail: 'repo citation must carry a non-empty "path"' })
      }
    } else {
      failures.push({ code: 'E_CITE', path: `citations[${i}]`, detail: `unknown citation kind: ${String(c.kind)}` })
    }
  })
}

// Wire shape/discriminator checks are E_SCHEMA (LLD §2) — content validity (replay) is admission's job.
function checkWireShape(wire: unknown, failures: CorpusFailure[]): void {
  if (!Array.isArray(wire) || wire.length === 0) {
    failures.push({ code: 'E_SCHEMA', path: 'wire', detail: 'wire must be a non-empty array' })
    return
  }
  wire.forEach((w, i) => {
    if (!isObject(w)) {
      failures.push({ code: 'E_SCHEMA', path: `wire[${i}]`, detail: 'wire artifact must be an object' })
      return
    }
    if (w.kind === 'transcript') {
      if (typeof w.path !== 'string' || w.path === '') {
        failures.push({ code: 'E_SCHEMA', path: `wire[${i}].path`, detail: 'transcript reference must carry a non-empty "path"' })
      }
      if (typeof w.expect !== 'string' || !TRANSCRIPT_EXPECTATIONS.has(w.expect)) {
        failures.push({ code: 'E_SCHEMA', path: `wire[${i}].expect`, detail: `expect must be one of ${[...TRANSCRIPT_EXPECTATIONS].join('|')}` })
      }
      return
    }
    if (typeof w.kind !== 'string' || !INLINE_WIRE_KINDS.has(w.kind)) {
      failures.push({ code: 'E_SCHEMA', path: `wire[${i}].kind`, detail: `unknown wire kind: ${String(w.kind)}` })
      return
    }
    if (!('artifact' in w) || w.artifact === undefined) {
      failures.push({ code: 'E_SCHEMA', path: `wire[${i}].artifact`, detail: 'inline wire artifact must carry "artifact"' })
    }
  })
}

// — small helpers (mirrors `validate.ts`'s defensive style) ————————————————————

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

function requireNonEmptyStr(o: Record<string, unknown>, key: string, path: string, failures: CorpusFailure[]): void {
  if (typeof o[key] !== 'string' || o[key] === '') {
    failures.push({ code: 'E_SCHEMA', path, detail: `${key} must be a non-empty string` })
  }
}
