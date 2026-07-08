// admit.ts — the admission pipeline (corpus LLD-C3, SPEC-R14/AC1). Injected deps keep the core pure —
// zero-dep (no `fs`, no Node builtins); the import tool (`tools/corpus/import-seeds.ts`) wires real deps
// (a SPEC-file read + `existsSync` for citation resolution, `readFileSync` for transcript loading).
//
// Stage order (LLD §3 — each independently testable; batch WITHIN a stage, short-circuit BETWEEN
// stages, the a2ui `admit.ts` shape):
//   1. schema + pin + citation shape  -> validateCorpusRecord (E_SCHEMA / E_PIN / E_CITE)
//   2. citation resolution            -> E_CITE (skipped for status:'quarantined', LLD §3/§4)
//   3. replay                         -> E_REPLAY (skipped for status:'quarantined')
//
// Admission never mutates `status` (LLD §3): no healer exists to compute `repaired` — records are
// authored `valid`, and quarantining is a curator edit to `seeds.ts` re-imported through the import tool.
import type { A2aCitation, A2aCorpusRecord, CorpusFailure } from './record.ts'
import { validateCorpusRecord } from './record.ts'
import { validateA2a } from '../protocol/validate.ts'
import { parseTranscriptLines, validateTranscript } from '../arena/transcript.ts'
import { checkIsolation } from '../arena/isolation.ts'

export interface AdmitDeps {
  protocolVersion: string // the import tool passes PROTOCOL_VERSION
  resolveCitation(c: A2aCitation): boolean // tool wires: hv -> SPEC §2 ledger read; repo -> existsSync
  loadTranscript(path: string): string | undefined // tool wires: readFileSync; undefined = unreadable
}

export type AdmitResult =
  | { admitted: true; record: A2aCorpusRecord }
  | { admitted: false; failures: CorpusFailure[] }

/** Admit one candidate through the full pipeline (LLD §3). Pure function of `(candidate, deps)`. */
export function admitRecord(candidate: unknown, deps: AdmitDeps): AdmitResult {
  // Stage 1 — schema + pin + citation shape (LLD-C1).
  const schemaFailures = validateCorpusRecord(candidate, { protocolVersion: deps.protocolVersion })
  if (schemaFailures.length > 0) return { admitted: false, failures: schemaFailures }

  // Passed stage 1 -> the candidate is a structurally valid A2aCorpusRecord.
  const record = candidate as A2aCorpusRecord

  // Quarantined lines skip resolution + replay entirely (LLD §3/§4 quarantine semantics: "a quarantined
  // record may legitimately no longer replay — that is what quarantine records").
  if (record.meta.status === 'quarantined') return { admitted: true, record }

  // Stage 2 — citation resolution (batch: every citation checked, not first-only).
  const citeFailures: CorpusFailure[] = []
  record.citations.forEach((c, i) => {
    if (!deps.resolveCitation(c)) {
      citeFailures.push({ code: 'E_CITE', path: `citations[${i}]`, detail: citationDetail(c) })
    }
  })
  if (citeFailures.length > 0) return { admitted: false, failures: citeFailures }

  // Stage 3 — replay (batch: every wire artifact checked).
  const replayFailures: CorpusFailure[] = []
  record.wire.forEach((w, i) => {
    if (w.kind === 'transcript') {
      replayFailures.push(...checkTranscriptReplay(w, i, deps))
      return
    }
    // Inline artifact: reuse the SAME shared validator admission never forks (SPEC-N4). `expect` is
    // passed EXPLICITLY (never 'auto') so a mislabeled artifact fails rather than being re-classified.
    const verdict = validateA2a(w.artifact, { protocolVersion: deps.protocolVersion, expect: w.kind })
    if (verdict.length > 0) {
      replayFailures.push({
        code: 'E_REPLAY',
        path: `wire[${i}]`,
        detail: verdict.map((f) => `${f.code}@${f.path}`).join(', '),
      })
    }
  })
  if (replayFailures.length > 0) return { admitted: false, failures: replayFailures }

  return { admitted: true, record }
}

function citationDetail(c: A2aCitation): string {
  return c.kind === 'hv' ? `HV row "${c.row}" does not resolve in the §2 ledger` : `repo path "${c.path}" does not resolve`
}

/** A transcript reference: read it, validate its schema (re-checks the header pin, SPEC-R2), then run
 * the arena's own isolation gate and MATCH the declared expectation — a mismatch in EITHER direction is
 * E_REPLAY (LLD §3: a contaminated control that starts passing the gate is a stale negative control,
 * exactly as much a defect as a clean match that starts failing). */
function checkTranscriptReplay(
  w: Extract<A2aCorpusRecord['wire'][number], { kind: 'transcript' }>,
  i: number,
  deps: AdmitDeps,
): CorpusFailure[] {
  const text = deps.loadTranscript(w.path)
  if (text === undefined) {
    return [{ code: 'E_REPLAY', path: `wire[${i}]`, detail: `transcript unreadable at "${w.path}"` }]
  }

  const lines = text.split('\n').filter((l) => l.trim() !== '')
  const schemaFailures = validateTranscript(lines, { protocolVersion: deps.protocolVersion })
  if (schemaFailures.length > 0) {
    return [{ code: 'E_REPLAY', path: `wire[${i}]`, detail: `transcript schema failed: ${JSON.stringify(schemaFailures)}` }]
  }

  const transcript = parseTranscriptLines(lines)
  if (transcript === undefined) {
    return [{ code: 'E_REPLAY', path: `wire[${i}]`, detail: 'transcript failed to parse despite passing schema validation' }]
  }

  const isolationFailures = checkIsolation(transcript)
  const isClean = isolationFailures.length === 0
  const expectClean = w.expect === 'clean'
  if (isClean === expectClean) return []

  return [
    {
      code: 'E_REPLAY',
      path: `wire[${i}]`,
      detail: expectClean
        ? `expected a clean isolation verdict but got failures: ${JSON.stringify(isolationFailures)}`
        : 'expected a contaminated isolation verdict but the transcript passed clean — a stale negative control',
    },
  ]
}
