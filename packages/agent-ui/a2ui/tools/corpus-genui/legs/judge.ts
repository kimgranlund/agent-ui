// judge.ts — LLD-C4 §4.2 (GH #1584), the `judge` leg (NEEDS KEY): score pending records against the
// rubric — the rubric document IS the judge prompt, read VERBATIM at run time (one source, no drift pair
// between the standard and the prompt). This module's CODE ships and is stub-tested (`deps.provider` is
// the injection point); it never reads `process.env` or a `.env` file itself — the real adapter is
// constructed only by the CLI entry's key-bearing arm.

import type { AgentProvider } from '../../../src/agent/agent-transport.ts'
import { GENUI_PACKS } from '../../../src/agent/prompts/genui-packs.ts'
import type { GenuiCorpusRecord } from '../../../src/corpus-genui/record.ts'
import type { GenuiVerdictsFile, GenuiJudgeVerdict, GenuiDimensionScores } from '../../../src/corpus-genui/verdicts.ts'
import {
  loadGenuiRecords,
  loadPrompts,
  readRubricBody,
  readRubricVersion,
  archiveGenuiVerdicts,
  genuiVerdictArchiveFileName,
  VERDICTS_DIR,
} from '../fs.ts'

const DIMENSION_IDS = ['D1', 'D2', 'D3', 'D4'] as const
const RATIONALE_MAX_CHARS = 2_000

/** The fixed wrapper — role + the JSON reply schema + the honesty floor. The rubric document (read
 *  verbatim, LLD §4.2) is appended AFTER this, so the judge's whole standard-of-record lives in ONE
 *  document this repo already gates (`harness_checks.py rubric`), never a second copy drifting inside a
 *  hand-authored prompt string. */
const JUDGE_WRAPPER = `You are a strict, evidence-bound quality judge for a GenUI pack-idiom eval. You score ONE record at a
time against the rubric below — D1 through D4, each 1..5. Score only what the rubric says; cite the lint
numbers you are given (never re-derive them, never invent evidence you were not handed). Reply with ONLY a
single JSON object, no prose before or after it, no markdown code fence:

{"dimensions":{"D1":<1-5>,"D2":<1-5>,"D3":<1-5>,"D4":<1-5>},"failingDimensions":["D2"],"rationale":"<= 2000 chars, cite the concrete evidence you weighed"}

failingDimensions lists every dimension you scored below 4 (empty array if none). Do not compute
qualityScore or passed yourself — the caller derives both from your per-dimension scores.

── The rubric (verbatim) ──────────────────────────────────────────────────────────────────────────────
`

export interface JudgeOptions {
  judgeModel?: string
  /** Filter to one record name. */
  only?: string
  /** Score every candidate TWICE and report the per-dimension delta — never writes an output file. */
  calibrate?: boolean
  /** Default: `verdicts/<date>--<slug(judgeModel)>.json`. */
  out?: string
  dryRun?: boolean
  now?: () => string
}

export interface JudgeParseFailure {
  name: string
  reason: 'E_JUDGE_PARSE'
  raw: string
}

export interface JudgeCalibrationRow {
  name: string
  deltas: Record<(typeof DIMENSION_IDS)[number], number>
  maxDelta: number
}

export interface JudgeResult {
  ok: boolean
  verdicts: Record<string, GenuiJudgeVerdict>
  parseFailures: JudgeParseFailure[]
  outPath?: string
  archiveOutcome?: 'archived' | 'unchanged' | 'conflict'
  conflict?: { existingHash: string; incomingHash: string }
  calibration?: JudgeCalibrationRow[]
}

function pairedPackLabel(repoRoot: string, promptId: string): string | undefined {
  const prompt = loadPrompts(repoRoot).prompts.find((p) => p.id === promptId)
  if (prompt === undefined) return undefined
  return GENUI_PACKS.find((p) => p.id === prompt.packId)?.label
}

function buildUserMessage(repoRoot: string, record: GenuiCorpusRecord): string {
  const pack = record.packId === null ? undefined : GENUI_PACKS.find((p) => p.id === record.packId)
  const packBodySection =
    pack !== undefined
      ? pack.body
      : `CONTROL — no pack (this generation was NOT conditioned on a pack; read D2 as "idiom use relative to ` +
        `the pack this prompt is normally paired with"${(() => {
          const label = pairedPackLabel(repoRoot, record.promptId)
          return label !== undefined ? `, "${label}"` : ''
        })()})`
  return [
    `PACK BODY:\n${packBodySection}`,
    `PROMPT:\n${record.promptText}`,
    `LINT EVIDENCE (cite, never recompute):\n${JSON.stringify(record.meta.lint)}`,
    `HTML:\n${record.html}`,
  ].join('\n\n')
}

interface ParsedReply {
  dimensions: GenuiDimensionScores
  failingDimensions: string[]
  rationale?: string
}

function isInRange1to5(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 1 && n <= 5
}

/** Strict JSON parse of the judge's raw reply (LLD §4.2) — `undefined` on ANY structural defect (not
 *  JSON, missing/out-of-range dimensions, a non-string-array failingDimensions). */
function parseJudgeReply(raw: string): ParsedReply | undefined {
  let doc: unknown
  try {
    doc = JSON.parse(raw.trim())
  } catch {
    return undefined
  }
  if (typeof doc !== 'object' || doc === null || Array.isArray(doc)) return undefined
  const obj = doc as Record<string, unknown>
  const dims = obj.dimensions
  if (typeof dims !== 'object' || dims === null || Array.isArray(dims)) return undefined
  const d = dims as Record<string, unknown>
  for (const id of DIMENSION_IDS) if (!isInRange1to5(d[id])) return undefined
  const dimensions: GenuiDimensionScores = { D1: d.D1 as number, D2: d.D2 as number, D3: d.D3 as number, D4: d.D4 as number }
  let failingDimensions: string[] = []
  if (obj.failingDimensions !== undefined) {
    if (!Array.isArray(obj.failingDimensions) || obj.failingDimensions.some((x) => typeof x !== 'string')) return undefined
    failingDimensions = obj.failingDimensions as string[]
  }
  let rationale: string | undefined
  if (obj.rationale !== undefined) {
    if (typeof obj.rationale !== 'string') return undefined
    rationale = obj.rationale.slice(0, RATIONALE_MAX_CHARS)
  }
  return { dimensions, failingDimensions, rationale }
}

/** MIN(D1..D4) + passed — computed here, NEVER trusted from the model's own arithmetic (LLD §4.2); the
 *  model's OWN `failingDimensions` array is discarded in favor of recomputing it from the scores. */
function toVerdict(parsed: ParsedReply): GenuiJudgeVerdict {
  const { D1, D2, D3, D4 } = parsed.dimensions
  const qualityScore = Math.min(D1, D2, D3, D4)
  const failingDimensions = DIMENSION_IDS.filter((id) => parsed.dimensions[id] < 4)
  return {
    qualityScore,
    passed: qualityScore >= 4,
    ...(failingDimensions.length > 0 ? { failingDimensions } : {}),
    dimensions: parsed.dimensions,
    ...(parsed.rationale !== undefined ? { rationale: parsed.rationale } : {}),
  }
}

async function callJudge(deps: { provider: AgentProvider }, judgeModel: string, system: string, user: string): Promise<string> {
  let text = ''
  for await (const fragment of deps.provider.stream({ model: judgeModel, system, messages: [{ role: 'user', content: user }] })) {
    text += fragment
  }
  return text
}

export async function runJudgeLeg(repoRoot: string, judgeModel: string, opts: JudgeOptions, deps: { provider: AgentProvider }): Promise<JudgeResult> {
  const rubricVersion = readRubricVersion(repoRoot)
  if (rubricVersion === undefined) {
    return { ok: false, verdicts: {}, parseFailures: [] }
  }
  const system = JUDGE_WRAPPER + readRubricBody(repoRoot)
  const now = opts.now ?? (() => new Date().toISOString())

  const all = loadGenuiRecords(repoRoot)
  const pending = all.filter(({ record }) => record.meta.status === 'pending' && (opts.only === undefined || record.name === opts.only))

  // `--dry-run` must never hit the judge model API — the CLI's own contract for the flag
  // (eval-genui-corpus.ts:52). Short-circuit BEFORE any `callJudge` call, for both the
  // calibrate and normal paths: report the pending count + intended outPath, spend nothing.
  if (opts.dryRun === true) {
    const outPath = opts.out ?? `${VERDICTS_DIR}/${genuiVerdictArchiveFileName(now(), judgeModel)}`
    return {
      ok: true,
      verdicts: {},
      parseFailures: [],
      outPath,
      ...(opts.calibrate === true ? { calibration: [] } : {}),
    }
  }

  if (opts.calibrate === true) {
    const calibration: JudgeCalibrationRow[] = []
    for (const { record } of pending) {
      const user = buildUserMessage(repoRoot, record)
      const rawA = await callJudge(deps, judgeModel, system, user)
      const rawB = await callJudge(deps, judgeModel, system, user)
      const a = parseJudgeReply(rawA)
      const b = parseJudgeReply(rawB)
      if (a === undefined || b === undefined) continue
      const deltas = Object.fromEntries(DIMENSION_IDS.map((id) => [id, Math.abs(a.dimensions[id] - b.dimensions[id])])) as Record<
        (typeof DIMENSION_IDS)[number],
        number
      >
      calibration.push({ name: record.name, deltas, maxDelta: Math.max(...Object.values(deltas)) })
    }
    const ok = calibration.every((row) => row.maxDelta <= 1)
    return { ok, verdicts: {}, parseFailures: [], calibration }
  }

  const verdicts: Record<string, GenuiJudgeVerdict> = {}
  const parseFailures: JudgeParseFailure[] = []
  for (const { record } of pending) {
    const raw = await callJudge(deps, judgeModel, system, buildUserMessage(repoRoot, record))
    const parsed = parseJudgeReply(raw)
    if (parsed === undefined) {
      parseFailures.push({ name: record.name, reason: 'E_JUDGE_PARSE', raw })
      continue
    }
    verdicts[record.name] = toVerdict(parsed)
  }

  const file: GenuiVerdictsFile = {
    rubric: 'genui-pack-idiom',
    rubricVersion,
    judgedBy: judgeModel,
    date: now(),
    model: judgeModel,
    verdicts,
  }
  const text = `${JSON.stringify(file, null, 2)}\n`
  const outPath = opts.out ?? `${VERDICTS_DIR}/${genuiVerdictArchiveFileName(file.date, judgeModel)}`

  const outcome = archiveGenuiVerdicts(repoRoot, outPath, text)
  if (outcome.kind === 'conflict') {
    return {
      ok: false,
      verdicts,
      parseFailures,
      outPath,
      archiveOutcome: 'conflict',
      conflict: { existingHash: outcome.existingHash, incomingHash: outcome.incomingHash },
    }
  }
  return { ok: parseFailures.length === 0, verdicts, parseFailures, outPath, archiveOutcome: outcome.kind }
}
