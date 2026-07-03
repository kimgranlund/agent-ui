// judge.ts — the corpus-quality judge activation (corpus LLD-C8, ADR-0060/0068).
//
// The tier-2 rubric is a DOCUMENT (`.claude/docs/rubrics/a2ui-corpus.md`) scored by a critic seat
// (`a2ui-reviewer`) — judgment happens OUTSIDE `admit()`'s pipeline (SPEC-R8: generator/critic
// separation). This module is the deterministic adapter over the critic's authored verdicts (ADR-0068
// clause 2) — it never scores anything itself. Pure, zero-dep, platform-neutral (SPEC-N5/ADR-0062): no
// filesystem access here — the Node shell (`tools/corpus/rescore.ts`, `import-seeds.ts`) reads
// `a2ui-corpus.md`'s `version:` marker and passes it in as `expectedRubricVersion`.

import type { CorpusRecord } from './record.ts'
import type { Judge, JudgeVerdict } from './admit.ts'

/** The ADR-0068 / SPEC §5.3 artifact a critic authors against `a2ui-corpus.md` — ONE file, naming
 * every record it judged this run. */
export interface VerdictsFile {
  rubric: 'a2ui-corpus'
  rubricVersion: string
  judgedBy: string
  date: string
  verdicts: Record<string, JudgeVerdict>
}

/** One structured `parseVerdictsFile` rejection — mirrors `RecordFailure`'s path+message shape (the
 * house idiom for saying WHERE a malformed document went wrong, not just THAT it did). */
export interface VerdictsParseIssue {
  path: string
  message: string
}

export type ParseVerdictsResult = { ok: true; file: VerdictsFile } | { ok: false; issues: VerdictsParseIssue[] }

const KNOWN_TOP_KEYS = new Set(['rubric', 'rubricVersion', 'judgedBy', 'date', 'verdicts'])
const KNOWN_VERDICT_KEYS = new Set(['qualityScore', 'passed', 'failingDimensions'])

/**
 * Parse + validate a verdicts-file JSON document (ADR-0068 clause 1/2; SPEC §5.3). Total: never
 * throws — malformed JSON, a missing/mismatched `rubric`/`rubricVersion`, an unknown top-level or
 * per-verdict key, and a malformed per-name verdict are all BATCHED into `issues` (mirrors
 * `validateRecord`'s batch-not-short-circuit stance), not reported one at a time.
 *
 * `expectedRubricVersion` is CALLER-supplied — this pure core never reads `a2ui-corpus.md` itself
 * (ADR-0062); the Node shell reads the rubric document's `version:` marker and passes it in. A
 * verdicts file whose own `rubricVersion` disagrees is rejected — a verdict is meaningless without the
 * standard it scored against (ADR-0068 clause 1).
 */
export function parseVerdictsFile(text: string, expectedRubricVersion: string): ParseVerdictsResult {
  let doc: unknown
  try {
    doc = JSON.parse(text)
  } catch (e) {
    return { ok: false, issues: [{ path: '', message: `invalid JSON: ${(e as Error).message}` }] }
  }
  if (!isObject(doc)) return { ok: false, issues: [{ path: '', message: 'the verdicts file must be a JSON object' }] }

  const issues: VerdictsParseIssue[] = []

  if (doc.rubric !== 'a2ui-corpus') {
    issues.push({ path: 'rubric', message: `expected "a2ui-corpus", got ${JSON.stringify(doc.rubric)}` })
  }
  if (typeof doc.rubricVersion !== 'string' || doc.rubricVersion === '') {
    issues.push({ path: 'rubricVersion', message: 'must be a non-empty string' })
  } else if (doc.rubricVersion !== expectedRubricVersion) {
    issues.push({
      path: 'rubricVersion',
      message: `"${doc.rubricVersion}" does not match the rubric document's current version "${expectedRubricVersion}"`,
    })
  }
  if (typeof doc.judgedBy !== 'string' || doc.judgedBy === '') {
    issues.push({ path: 'judgedBy', message: 'must be a non-empty string' })
  }
  if (typeof doc.date !== 'string' || doc.date === '') {
    issues.push({ path: 'date', message: 'must be a non-empty string' })
  }
  for (const key of Object.keys(doc)) {
    if (!KNOWN_TOP_KEYS.has(key)) issues.push({ path: key, message: 'unknown key' })
  }

  const verdicts: Record<string, JudgeVerdict> = {}
  if (!isObject(doc.verdicts)) {
    issues.push({ path: 'verdicts', message: 'must be an object' })
  } else {
    for (const [name, v] of Object.entries(doc.verdicts)) {
      const parsed = parseOneVerdict(v, `verdicts.${name}`, issues)
      if (parsed !== undefined) verdicts[name] = parsed
    }
  }

  if (issues.length > 0) return { ok: false, issues }
  return {
    ok: true,
    file: {
      rubric: 'a2ui-corpus',
      rubricVersion: doc.rubricVersion as string,
      judgedBy: doc.judgedBy as string,
      date: doc.date as string,
      verdicts,
    },
  }
}

function parseOneVerdict(v: unknown, path: string, issues: VerdictsParseIssue[]): JudgeVerdict | undefined {
  if (!isObject(v)) {
    issues.push({ path, message: 'must be an object' })
    return undefined
  }
  let ok = true
  for (const key of Object.keys(v)) {
    if (!KNOWN_VERDICT_KEYS.has(key)) {
      issues.push({ path: `${path}.${key}`, message: 'unknown key' })
      ok = false
    }
  }
  if (typeof v.qualityScore !== 'number') {
    issues.push({ path: `${path}.qualityScore`, message: 'must be a number' })
    ok = false
  }
  if (typeof v.passed !== 'boolean') {
    issues.push({ path: `${path}.passed`, message: 'must be a boolean' })
    ok = false
  }
  if (v.failingDimensions !== undefined) {
    const fd = v.failingDimensions
    if (!Array.isArray(fd) || fd.some((d) => typeof d !== 'string')) {
      issues.push({ path: `${path}.failingDimensions`, message: 'must be a string array' })
      ok = false
    }
  }
  if (!ok) return undefined
  return {
    qualityScore: v.qualityScore as number,
    passed: v.passed as boolean,
    ...(v.failingDimensions !== undefined ? { failingDimensions: v.failingDimensions as string[] } : {}),
  }
}

/** Thrown by `createVerdictJudge(...).score()` when a candidate's `record.name` has no entry in the
 * verdicts file — fail-closed (ADR-0068 clause 2): a wired judge means EVERY candidate must be judged,
 * never silently admitted unjudged into a judged-era corpus. `import-seeds --verdicts` maps this throw
 * to report+halt (the θ_dup halt precedent) — never a silent skip. */
export class UnjudgedCandidateError extends Error {
  readonly recordName: string
  constructor(recordName: string) {
    super(`no verdict for record "${recordName}" in the verdicts file — every candidate must be judged once a judge is wired`)
    this.name = 'UnjudgedCandidateError'
    this.recordName = recordName
  }
}

/**
 * The ADR-0060 tier-2 seam's realization (ADR-0068 clause 2): a deterministic name-lookup adapter over
 * a critic-authored `VerdictsFile`. All judgment already happened in the critic seat that authored
 * `file` — this function performs no scoring of its own, only the lookup + fail-closed guard.
 */
export function createVerdictJudge(file: VerdictsFile): Judge {
  return {
    score(record: CorpusRecord): JudgeVerdict {
      const verdict = file.verdicts[record.name]
      if (verdict === undefined) throw new UnjudgedCandidateError(record.name)
      return verdict
    },
  }
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
