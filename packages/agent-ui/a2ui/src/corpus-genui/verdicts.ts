// verdicts.ts — LLD-C1 §3.2 (GH #1584, genui-b3-judged-eval.lld.md): `GenuiVerdictsFile` + its strict
// parser + the pure verdict-archive merge. A NEW module, not a parametrization of `src/corpus/judge.ts` +
// `verdict-archive.ts` — editing the A2UI adapter for an eval-only slice would widen a shipped `"./corpus"`
// barrel export (LLD §3.2; the drift pair is named + accepted in LLD §9 risk 3). Same idiom as those two
// modules (unknown keys rejected, rubric name pinned, latest `date` wins, same-date disagreement is a
// conflict, identical is idempotent) — mirrored BY PATTERN, never imported.
//
// Zero-dep, platform-neutral (ADR-0062): no imports at all.

/** One dimension score set (1..5 each) — the rubric's own D1-D4 (`.claude/docs/rubrics/genui-pack-idiom.md`). */
export interface GenuiDimensionScores {
  D1: number
  D2: number
  D3: number
  D4: number
}

export interface GenuiJudgeVerdict {
  /** MIN over D1..D4 — the rubric's aggregation. The parser RE-CHECKS it when `dimensions` is present. */
  qualityScore: number
  /** Must equal `qualityScore >= 4` (parser-checked). */
  passed: boolean
  /** Every dimension < 4, by id. */
  failingDimensions?: string[]
  /** The model-judge always fills it; a critic seat may omit it. */
  dimensions?: GenuiDimensionScores
  /** <= 2 000 chars; evidence the page shows. */
  rationale?: string
}

export interface GenuiVerdictsFile {
  rubric: 'genui-pack-idiom'
  /** Must equal the rubric doc's `version:` marker (caller-supplied, the ADR-0068 cl.1 pattern). */
  rubricVersion: string
  /** A model id (`judge` leg) or a critic-seat name — never empty. */
  judgedBy: string
  /** ISO-8601; full timestamp when two files land the same day (the ADR-0165 same-date rule). */
  date: string
  /** Present when `judgedBy` is a model. */
  model?: string
  /** Keyed by record `name`. */
  verdicts: Record<string, GenuiJudgeVerdict>
}

export interface GenuiVerdictsParseIssue {
  path: string
  message: string
}

export type ParseGenuiVerdictsResult = { ok: true; file: GenuiVerdictsFile } | { ok: false; issues: GenuiVerdictsParseIssue[] }

const KNOWN_TOP_KEYS = new Set(['rubric', 'rubricVersion', 'judgedBy', 'date', 'model', 'verdicts'])
const KNOWN_VERDICT_KEYS = new Set(['qualityScore', 'passed', 'failingDimensions', 'dimensions', 'rationale'])
const KNOWN_DIMENSION_KEYS = new Set(['D1', 'D2', 'D3', 'D4'])
const DIMENSION_IDS = ['D1', 'D2', 'D3', 'D4'] as const
const RATIONALE_MAX_CHARS = 2_000

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

function isInRange1to5(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 1 && n <= 5
}

/**
 * Strict, batched, never-throws (the `src/corpus/judge.ts` idiom). `expectedRubricVersion` is
 * CALLER-supplied — this pure core never reads the rubric doc itself (ADR-0062); the Node shell reads
 * `.claude/docs/rubrics/genui-pack-idiom.md`'s `version:` marker and passes it in.
 */
export function parseGenuiVerdictsFile(text: string, expectedRubricVersion: string): ParseGenuiVerdictsResult {
  let doc: unknown
  try {
    doc = JSON.parse(text)
  } catch (e) {
    return { ok: false, issues: [{ path: '', message: `invalid JSON: ${(e as Error).message}` }] }
  }
  if (!isObject(doc)) return { ok: false, issues: [{ path: '', message: 'the verdicts file must be a JSON object' }] }

  const issues: GenuiVerdictsParseIssue[] = []

  if (doc.rubric !== 'genui-pack-idiom') {
    issues.push({ path: 'rubric', message: `expected "genui-pack-idiom", got ${JSON.stringify(doc.rubric)}` })
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
  if (doc.model !== undefined && (typeof doc.model !== 'string' || doc.model === '')) {
    issues.push({ path: 'model', message: 'when present, must be a non-empty string' })
  }
  for (const key of Object.keys(doc)) {
    if (!KNOWN_TOP_KEYS.has(key)) issues.push({ path: key, message: 'unknown key' })
  }

  const verdicts: Record<string, GenuiJudgeVerdict> = {}
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
      rubric: 'genui-pack-idiom',
      rubricVersion: doc.rubricVersion as string,
      judgedBy: doc.judgedBy as string,
      date: doc.date as string,
      ...(doc.model !== undefined ? { model: doc.model as string } : {}),
      verdicts,
    },
  }
}

function parseOneVerdict(v: unknown, path: string, issues: GenuiVerdictsParseIssue[]): GenuiJudgeVerdict | undefined {
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
  if (!isInRange1to5(v.qualityScore)) {
    issues.push({ path: `${path}.qualityScore`, message: 'must be a number in 1..5' })
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
  let dimensions: GenuiDimensionScores | undefined
  if (v.dimensions !== undefined) {
    dimensions = parseDimensions(v.dimensions, `${path}.dimensions`, issues)
    if (dimensions === undefined) ok = false
  }
  if (v.rationale !== undefined) {
    if (typeof v.rationale !== 'string') {
      issues.push({ path: `${path}.rationale`, message: 'must be a string' })
      ok = false
    } else if (v.rationale.length > RATIONALE_MAX_CHARS) {
      issues.push({ path: `${path}.rationale`, message: `must be <= ${RATIONALE_MAX_CHARS} chars (got ${v.rationale.length})` })
      ok = false
    }
  }
  if (!ok) return undefined

  const qualityScore = v.qualityScore as number
  const passed = v.passed as boolean
  // The rubric's own bar (LLD §3.2 / the rubric doc): passed must equal qualityScore >= 4 — parser-checked,
  // never trusted from the model's own arithmetic.
  if (passed !== qualityScore >= 4) {
    issues.push({ path: `${path}.passed`, message: `must equal (qualityScore >= 4) — got passed=${String(passed)}, qualityScore=${qualityScore}` })
    return undefined
  }
  // When `dimensions` is present, re-check the MIN aggregation actually produced `qualityScore`.
  if (dimensions !== undefined) {
    const min = Math.min(dimensions.D1, dimensions.D2, dimensions.D3, dimensions.D4)
    if (min !== qualityScore) {
      issues.push({ path: `${path}.qualityScore`, message: `must equal MIN(dimensions) — MIN is ${min}, qualityScore is ${qualityScore}` })
      return undefined
    }
  }

  return {
    qualityScore,
    passed,
    ...(v.failingDimensions !== undefined ? { failingDimensions: v.failingDimensions as string[] } : {}),
    ...(dimensions !== undefined ? { dimensions } : {}),
    ...(v.rationale !== undefined ? { rationale: v.rationale as string } : {}),
  }
}

function parseDimensions(v: unknown, path: string, issues: GenuiVerdictsParseIssue[]): GenuiDimensionScores | undefined {
  if (!isObject(v)) {
    issues.push({ path, message: 'must be an object' })
    return undefined
  }
  let ok = true
  for (const key of Object.keys(v)) {
    if (!KNOWN_DIMENSION_KEYS.has(key)) {
      issues.push({ path: `${path}.${key}`, message: 'unknown key' })
      ok = false
    }
  }
  for (const id of DIMENSION_IDS) {
    if (!isInRange1to5(v[id])) {
      issues.push({ path: `${path}.${id}`, message: 'must be a number in 1..5' })
      ok = false
    }
  }
  if (!ok) return undefined
  return { D1: v.D1 as number, D2: v.D2 as number, D3: v.D3 as number, D4: v.D4 as number }
}

// ── the verdict archive — the pure merge (the ADR-0165 clause 3 pattern, mirrored) ─────────────────────

/** One name's durable disposition, flattened out of the `GenuiVerdictsFile` that carried it. */
export interface GenuiArchivedVerdict extends GenuiJudgeVerdict {
  rubricVersion: string
  judgedBy: string
  date: string
  /** Repo-relative path the caller read this file from. */
  sourceFile: string
}

export interface GenuiArchivedVerdictsSource {
  sourceFile: string
  file: GenuiVerdictsFile
}

/** Two files of the SAME `date` carrying DIFFERENT verdicts for one name — halt, never pick a winner. */
export interface GenuiVerdictArchiveConflict {
  name: string
  date: string
  sourceFiles: [string, string]
  message: string
}

export type MergeGenuiVerdictArchiveResult = { ok: true; archive: Map<string, GenuiArchivedVerdict> } | { ok: false; conflicts: GenuiVerdictArchiveConflict[] }

function sameGenuiVerdict(a: GenuiArchivedVerdict, b: GenuiArchivedVerdict): boolean {
  if (a.passed !== b.passed || a.qualityScore !== b.qualityScore) return false
  const ad = a.failingDimensions ?? []
  const bd = b.failingDimensions ?? []
  return ad.length === bd.length && ad.every((d, i) => d === bd[i])
}

function describeGenuiVerdict(v: GenuiArchivedVerdict): string {
  const dims = v.failingDimensions !== undefined && v.failingDimensions.length > 0 ? `, failing ${v.failingDimensions.join('/')}` : ''
  return `passed=${String(v.passed)} qualityScore=${String(v.qualityScore)}${dims}`
}

/**
 * Parse an ARCHIVED verdicts file (the ADR-0165 clause 7 pattern, mirrored): "an archived refusal does
 * not expire" — a `passed:false` entry scored against an OLDER `rubricVersion` still blocks, so an
 * archived file is validated against ITS OWN declared version rather than the rubric doc's current one.
 * Every OTHER check `parseGenuiVerdictsFile` performs is unchanged.
 */
export function parseArchivedGenuiVerdictsFile(text: string): ParseGenuiVerdictsResult {
  let declared = ''
  try {
    const doc: unknown = JSON.parse(text)
    if (isObject(doc) && typeof doc.rubricVersion === 'string') declared = doc.rubricVersion
  } catch {
    // leave `declared` empty — parseGenuiVerdictsFile re-parses and reports the real JSON error itself.
  }
  return parseGenuiVerdictsFile(text, declared)
}

/**
 * Merge parsed `GenuiVerdictsFile`s into `Map<name, GenuiArchivedVerdict>` (LLD §3.2). Latest `date` wins
 * (plain string compare — every date in this estate is ISO-8601, which sorts lexicographically);
 * same-date DISAGREEMENT is a structured conflict, collected across the whole archive (batch, not
 * short-circuit); same-date AGREEMENT is idempotent.
 */
export function mergeGenuiVerdictArchive(sources: readonly GenuiArchivedVerdictsSource[]): MergeGenuiVerdictArchiveResult {
  const archive = new Map<string, GenuiArchivedVerdict>()
  const conflicts: GenuiVerdictArchiveConflict[] = []

  for (const { sourceFile, file } of sources) {
    for (const [name, verdict] of Object.entries(file.verdicts)) {
      const candidate: GenuiArchivedVerdict = {
        ...verdict,
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
      if (sameGenuiVerdict(existing, candidate)) continue
      conflicts.push({
        name,
        date: candidate.date,
        sourceFiles: [existing.sourceFile, candidate.sourceFile],
        message:
          `"${name}": two archived verdicts files dated ${candidate.date} disagree — ` +
          `${existing.sourceFile} says ${describeGenuiVerdict(existing)}, ${candidate.sourceFile} says ${describeGenuiVerdict(candidate)}. ` +
          'A re-judge must carry a LATER date; same-date disagreement is never resolved silently.',
      })
    }
  }

  if (conflicts.length > 0) return { ok: false, conflicts }
  return { ok: true, archive }
}
