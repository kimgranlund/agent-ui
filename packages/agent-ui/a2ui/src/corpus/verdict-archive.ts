// verdict-archive.ts — the durable machine-readable admission-disposition record (ADR-0165 clause 3).
//
// An admission-time `E_QUALITY` rejection is written NOWHERE by `admit()` — stage 10 returns the
// rejection before `store.put()` and before the dedup index registers anything (corpus LLD §6's
// asymmetry, deliberately left intact by ADR-0165 clause 9: the record moves NEXT TO the store, not
// INTO it). The durable home is the archived verdicts file: `import-seeds --verdicts <path>` copies its
// own already-validated input verbatim into `corpus/verdicts/` (clause 1), and THIS module is the pure
// merge over those parsed files — `Map<name, ArchivedVerdict>`, latest `date` wins.
//
// Pure, zero-dep, platform-neutral (SPEC-N5 / ADR-0062): no `node:*` here. The two readers each keep
// their OWN fs discipline over this one shared merge (clause 3) — `tools/corpus/fs-store.ts`'s
// `loadVerdictArchive()` for the Node shell, and `admission-coverage.test.ts`'s own `walk()`/
// `readFileSync` for the src-side gate (which never imports tool-shell code).
//
// Deliberately OFF the `"./corpus"` barrel, matching its `disposition-allowlist.ts` sibling: this is
// import/coverage-tooling bookkeeping, not a corpus API surface a renderer consumer would ever want in
// its bundle (clause 3's explicit ruling on that fork).

import { parseVerdictsFile } from './judge.ts'
import type { ParseVerdictsResult, VerdictsFile } from './judge.ts'

/** One name's durable disposition, flattened out of the `VerdictsFile` that carried it. `passed:false`
 *  IS the durable `E_QUALITY` record (ADR-0165 clause 3) — the outcome ADR-0068's Consequences called
 *  "queryable" without ever wiring up how. `sourceFile` names the archived file it came from, so a
 *  conflict/halt message can cite real paths rather than "somewhere in the archive"; both readers pass
 *  a REPO-RELATIVE path. */
export interface ArchivedVerdict {
  passed: boolean
  qualityScore: number
  failingDimensions?: string[]
  rubricVersion: string
  judgedBy: string
  date: string
  sourceFile: string
}

/** One parsed archived file, paired with the repo-relative path it was read from. */
export interface ArchivedVerdictsSource {
  sourceFile: string
  file: VerdictsFile
}

/** Two files of the SAME `date` carrying DIFFERENT verdicts for one name — a re-judge is deliberate,
 *  never a drive-by (mirrors ADR-0068 clause 4's rescore conflict rule, which halts the whole run
 *  before any write rather than picking a winner). */
export interface VerdictArchiveConflict {
  name: string
  date: string
  sourceFiles: [string, string]
  message: string
}

export type MergeVerdictArchiveResult =
  | { ok: true; archive: Map<string, ArchivedVerdict> }
  | { ok: false; conflicts: VerdictArchiveConflict[] }

/**
 * Merge parsed archived verdicts files into one `Map<name, ArchivedVerdict>` (ADR-0165 clause 3).
 *
 * **Precedence: latest `date` wins.** Dates are compared as plain strings — every verdicts file in the
 * estate dates ISO-8601 (`YYYY-MM-DD`), which sorts lexicographically, and `parseVerdictsFile` only
 * guarantees a non-empty string, so a string compare is exactly as strong as the parsed contract.
 *
 * Same-date DISAGREEMENT on one name is a structured error, not a silent pick: every conflict across
 * the whole archive is collected (the `validateRecord`/`rescore` batch-not-short-circuit idiom) and the
 * caller halts with nothing written. Same-date AGREEMENT is not a conflict — re-archiving an identical
 * verdict is the idempotent case.
 *
 * Callers pass `sources` in a DETERMINISTIC order (both readers sort by path) so a conflict message
 * names the same two files every run.
 */
export function mergeVerdictArchive(sources: readonly ArchivedVerdictsSource[]): MergeVerdictArchiveResult {
  const archive = new Map<string, ArchivedVerdict>()
  const conflicts: VerdictArchiveConflict[] = []

  for (const { sourceFile, file } of sources) {
    for (const [name, verdict] of Object.entries(file.verdicts)) {
      const candidate: ArchivedVerdict = {
        passed: verdict.passed,
        qualityScore: verdict.qualityScore,
        ...(verdict.failingDimensions !== undefined ? { failingDimensions: verdict.failingDimensions } : {}),
        rubricVersion: file.rubricVersion,
        judgedBy: file.judgedBy,
        date: file.date,
        sourceFile,
      }
      const existing = archive.get(name)
      if (existing === undefined) {
        archive.set(name, candidate)
        continue
      }
      if (candidate.date > existing.date) {
        archive.set(name, candidate)
        continue
      }
      if (candidate.date < existing.date) continue
      if (sameVerdict(existing, candidate)) continue
      conflicts.push({
        name,
        date: candidate.date,
        sourceFiles: [existing.sourceFile, candidate.sourceFile],
        message:
          `"${name}": two archived verdicts files dated ${candidate.date} disagree — ` +
          `${existing.sourceFile} says ${describe(existing)}, ${candidate.sourceFile} says ${describe(candidate)}. ` +
          'A re-judge must carry a LATER date (ADR-0165 clause 3); same-date disagreement is never resolved silently.',
      })
    }
  }

  if (conflicts.length > 0) return { ok: false, conflicts }
  return { ok: true, archive }
}

/**
 * Parse an ARCHIVED verdicts file. ADR-0165 clause 7 — "an archived refusal does not expire": a
 * `passed:false` entry scored against an OLDER `rubricVersion` still blocks and still reds, so an
 * archived file is validated against ITS OWN declared version rather than the rubric document's current
 * one. (`parseVerdictsFile`'s version-equality check is exactly right for the file an operator hands
 * `--verdicts` at run time — that verdict must be current — and exactly wrong for a historical record;
 * clause 7 names the requirement, this function is its mechanism.) Every OTHER validation
 * `parseVerdictsFile` performs is unchanged: a malformed archive is still an error, and a file with no
 * usable `rubricVersion` fails on that field.
 */
export function parseArchivedVerdicts(text: string): ParseVerdictsResult {
  let declared = ''
  try {
    const doc: unknown = JSON.parse(text)
    if (typeof doc === 'object' && doc !== null && !Array.isArray(doc)) {
      const v = (doc as Record<string, unknown>).rubricVersion
      if (typeof v === 'string') declared = v
    }
  } catch {
    // Leave `declared` empty — `parseVerdictsFile` re-parses and reports the real JSON error itself.
  }
  return parseVerdictsFile(text, declared)
}

/**
 * The archived file's name: `<date>--<slug>.json` (ADR-0165 clause 2). `date` is the `VerdictsFile`'s
 * OWN `date` field — never the wall clock, so re-running an old file resolves to the same path and the
 * idempotence criterion stays honest. `slugSource` is the basename of the operator's `--verdicts`
 * argument sans `.json`: they already named that file deliberately, so two distinct waves on one date
 * collide only if the operator gave both the same name (and clause 2's write-time rule catches that
 * rather than overwriting).
 *
 * Both parts are slugified — lowercased, every non-alphanumeric run collapsed to one `-`, ends trimmed.
 * Slugifying the DATE too is defensive rather than decorative: `date` is only guaranteed to be a
 * non-empty string, and a `/` in it would otherwise escape the archive directory.
 */
export function verdictArchiveFileName(date: string, slugSource: string): string {
  const datePart = slugify(date) || 'undated'
  const slugPart = slugify(slugSource) || 'verdicts'
  return `${datePart}--${slugPart}.json`
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function sameVerdict(a: ArchivedVerdict, b: ArchivedVerdict): boolean {
  if (a.passed !== b.passed || a.qualityScore !== b.qualityScore) return false
  const ad = a.failingDimensions ?? []
  const bd = b.failingDimensions ?? []
  return ad.length === bd.length && ad.every((d, i) => d === bd[i])
}

function describe(v: ArchivedVerdict): string {
  const dims = v.failingDimensions !== undefined && v.failingDimensions.length > 0 ? `, failing ${v.failingDimensions.join('/')}` : ''
  return `passed=${String(v.passed)} qualityScore=${String(v.qualityScore)}${dims}`
}
