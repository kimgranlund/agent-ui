// scripts/e2e-admin/probe/judge.ts: judged checks on committed round transcripts (T-0178, SPEC CL-R8), the pure
// core. A rubric document per persona (`rubrics/<persona>.md`) IS the judge prompt, read verbatim after a fixed
// wrapper, the `tools/corpus-genui/legs/judge.ts` pattern. The judge scores each rubric criterion 1 to 5 with quotes
// from the transcript; the verdict is recomputed here from the scores and the rubric's threshold, never trusted from
// the model. This module never reads a key or `process.env`: `deps.provider` is injected, and the one module that
// builds the real adapter is `eval-judge.ts`, in its keyed arm.
//
// A judged run writes `runs/<name>/judge.json` beside its `report.json`; `signals.ts` reads it.

import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { AgentProvider } from '../../../packages/agent-ui/a2ui/src/agent/agent-transport.ts'
import { readMetaLine } from '../../../packages/agent-ui/a2ui/src/agent/meta-line.ts'
import { heal } from '../../../packages/agent-ui/a2ui/src/corpus/heal.ts'
import { usageCost, type TraceUsage } from './ledger.ts'
import { metaOf } from './model.ts'

export const RUBRICS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'rubrics')
export const CALIBRATION_FILE = join(RUBRICS_DIR, 'calibration.json')
/** The pinned judge. The 5.5 models accept no sampling parameter (`providers/anthropic.ts` sends none), so the
 *  temperature is the model's own default, recorded as null, never a value the adapter would drop. */
export const JUDGE_MODEL = 'claude-sonnet-5-5'
export const JUDGE_TEMPERATURE = null
const TURN_CHARS = 1_500
const WHY_CHARS = 600

const WRAPPER = `You are a strict, evidence-bound judge of one chat transcript between a user and an agent persona. Score
every criterion of the rubric below from 1 to 5. Score only what the rubric says and only from the transcript you are
given: quote the exact transcript text you weighed (copied verbatim, a few words to one sentence per quote), never
invent evidence. A turn marked [turn failed] showed the user only its error. Reply with ONLY one JSON object, no prose
before or after it, no markdown fence:

{"criteria":[{"id":"<criterion id>","score":<1-5>,"evidence":["<verbatim quote>"],"why":"<one or two sentences>"}]}

List every criterion id of the rubric exactly once. Do not compute an overall score or verdict: the caller derives
both from your per-criterion scores.

── The rubric (verbatim) ──────────────────────────────────────────────────────────────────────────────
`

export interface Rubric {
  id: string
  version: number
  /** A criterion passes at this score or above; the run passes when every criterion does. */
  threshold: number
  criteria: string[]
  /** The document after its front matter, the judge prompt verbatim. */
  body: string
  sha256: string
}

/** Parse a rubric document: a front matter block (`id`, `version`, `threshold`, `criteria: [A, B]`), then the body,
 *  which names each criterion as a `### <id>: <title>` heading. Throws on any defect. */
export function parseRubric(text: string, file = 'rubric'): Rubric {
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text)
  if (m === null) throw new Error(`${file}: no front matter block`)
  const fields = Object.fromEntries(m[1].split('\n').flatMap((l) => { const kv = /^([a-z]+):\s*(.*)$/.exec(l); return kv === null ? [] : [[kv[1], kv[2].trim()]] }))
  const id = fields.id ?? ''
  const version = Number(fields.version)
  const threshold = Number(fields.threshold)
  const criteria = /^\[(.*)\]$/.exec(fields.criteria ?? '')?.[1].split(',').map((s) => s.trim()).filter(Boolean) ?? []
  if (!/^[a-z][a-z0-9-]*$/.test(id)) throw new Error(`${file}: id must be a persona id, got ${JSON.stringify(fields.id)}`)
  if (!Number.isInteger(version) || version < 1) throw new Error(`${file}: version must be a positive integer`)
  if (!Number.isInteger(threshold) || threshold < 1 || threshold > 5) throw new Error(`${file}: threshold must be an integer 1 to 5`)
  if (criteria.length === 0) throw new Error(`${file}: criteria must list at least one id`)
  const body = m[2]
  for (const c of criteria) if (!new RegExp(`^### ${c}: `, 'm').test(body)) throw new Error(`${file}: criterion ${c} has no "### ${c}: " heading`)
  return { id, version, threshold, criteria, body, sha256: createHash('sha256').update(text).digest('hex') }
}

/** The rubric for a persona, or undefined when it has none. */
export function loadRubric(persona: string, dir = RUBRICS_DIR): Rubric | undefined {
  const file = join(dir, `${persona}.md`)
  return existsSync(file) ? parseRubric(readFileSync(file, 'utf8'), file) : undefined
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const clip = (s: string, n: number): string => (s.length > n ? `${s.slice(0, n)}...` : s)
const VISIBLE = ['text', 'label', 'title', 'subtitle', 'caption', 'placeholder', 'description'] as const

/** The component types and literal visible strings the shipped A2UI lines of one turn carry. */
function surfaceOf(lines: readonly string[]): { types: string[]; strings: string[] } {
  const types = new Set<string>()
  const strings: string[] = []
  for (const line of lines) {
    if (readMetaLine(line) !== undefined || line.trim() === '') continue
    const healed = heal(line)
    if (!healed.ok) continue
    for (const msg of (Array.isArray(healed.messages) ? healed.messages : [healed.messages]) as unknown[]) {
      const body = isObject(msg) ? msg.updateComponents : undefined
      if (!isObject(body) || !Array.isArray(body.components)) continue
      for (const c of body.components) {
        if (!isObject(c)) continue
        if (typeof c.component === 'string') types.add(c.component)
        for (const k of VISIBLE) if (typeof c[k] === 'string' && c[k] !== '' && !strings.includes(c[k])) strings.push(c[k])
      }
    }
  }
  return { types: [...types], strings }
}

interface ReportTurn {
  index?: number
  step?: { say?: string; click?: string; page?: string }
  lines?: string[]
  clickMissing?: unknown
}

/** The transcript a judge reads, from a probe `report.json`: per turn what the user said or clicked, the agent's
 *  reply text (the note, else the streamed text, as `metaOf` reads it), and the surface it shipped (component types
 *  and literal visible strings). A halted turn shows its error. */
export function transcriptOf(report: { agent?: unknown; turns?: unknown }): string {
  const out: string[] = [`Persona: ${typeof report.agent === 'string' ? report.agent : 'unknown'}`]
  const turns = Array.isArray(report.turns) ? (report.turns as ReportTurn[]) : []
  turns.forEach((t, i) => {
    const step = t.step ?? {}
    const lines = Array.isArray(t.lines) ? t.lines : []
    const n = typeof t.index === 'number' ? t.index : i
    out.push('', `## Turn ${n}`)
    if (typeof step.say === 'string') out.push(`User says: ${step.say}`)
    else if (typeof step.click === 'string') out.push(`User clicks: ${step.click}`)
    else out.push(`(the page sent this turn itself: ${step.page ?? 'unknown'})`)
    if (t.clickMissing !== undefined) {
      out.push('(the probe found no such button on the page, so no agent turn ran)')
      return
    }
    const meta = metaOf(lines)
    if (meta.error !== undefined) out.push(`Agent: [turn failed] ${clip(meta.error, 300)}`)
    else out.push(`Agent says: ${clip(meta.prose.join('').trim(), TURN_CHARS) || '(no reply text)'}`)
    const s = surfaceOf(lines)
    if (s.types.length > 0) out.push(`Agent surface: ${s.types.join(', ')}`, `Surface text: ${clip(s.strings.map((x) => JSON.stringify(x)).join(' '), TURN_CHARS)}`)
  })
  return `${out.join('\n')}\n`
}

export interface CriterionScore {
  id: string
  score: number
  passed: boolean
  /** Each quote, and whether it appears in the transcript (whitespace-normalized). */
  evidence: Array<{ quote: string; found: boolean }>
  why: string
}

/** `runs/<name>/judge.json`. */
export interface JudgeFile {
  kind: 'agent-ui-judge'
  version: 1
  run: string
  rubric: { id: string; version: number; sha256: string }
  model: string
  temperature: null
  threshold: number
  criteria: CriterionScore[]
  /** The lowest criterion score. */
  score: number
  /** Every criterion at or over the threshold. */
  passed: boolean
  usage: TraceUsage
  costUsd: number
  at: string
}

export type JudgeOutcome = { ok: true; file: JudgeFile } | { ok: false; reason: 'E_JUDGE_PARSE'; raw: string; usage: TraceUsage; costUsd: number }

const norm = (s: string): string => s.replace(/\s+/g, ' ').trim()

/** Strict parse of the judge reply against the rubric's criteria; undefined on any defect (not JSON, a missing,
 *  repeated or unknown criterion, a score outside 1 to 5, evidence that is not a string array). One markdown fence
 *  around the object is tolerated. */
export function parseReply(raw: string, rubric: Rubric): Array<{ id: string; score: number; evidence: string[]; why: string }> | undefined {
  const text = raw.trim().replace(/^```(?:json)?\s*\n([\s\S]*?)\n```$/, '$1')
  let doc: unknown
  try {
    doc = JSON.parse(text)
  } catch {
    return undefined
  }
  if (!isObject(doc) || !Array.isArray(doc.criteria)) return undefined
  const out: Array<{ id: string; score: number; evidence: string[]; why: string }> = []
  for (const c of doc.criteria) {
    if (!isObject(c) || typeof c.id !== 'string' || !rubric.criteria.includes(c.id) || out.some((o) => o.id === c.id)) return undefined
    if (typeof c.score !== 'number' || !Number.isInteger(c.score) || c.score < 1 || c.score > 5) return undefined
    if (!Array.isArray(c.evidence) || c.evidence.some((q) => typeof q !== 'string')) return undefined
    out.push({ id: c.id, score: c.score, evidence: c.evidence as string[], why: typeof c.why === 'string' ? c.why.slice(0, WHY_CHARS) : '' })
  }
  if (out.length !== rubric.criteria.length) return undefined
  return rubric.criteria.map((id) => out.find((o) => o.id === id)!)
}

/** Score one transcript against one rubric. `deps.model` overrides the pinned judge (tests only). */
export async function judgeTranscript(
  run: string,
  transcript: string,
  rubric: Rubric,
  deps: { provider: AgentProvider; model?: string; now?: () => string },
): Promise<JudgeOutcome> {
  const model = deps.model ?? JUDGE_MODEL
  const usage: TraceUsage = {}
  let raw = ''
  const stream = deps.provider.stream({
    model,
    system: WRAPPER + rubric.body,
    messages: [{ role: 'user', content: `TRANSCRIPT:\n${transcript}` }],
    onEvent: (ev) => {
      if (ev.kind !== 'usage' || ev.usage === undefined) return
      for (const k of ['inputTokens', 'outputTokens', 'cacheReadInputTokens', 'cacheCreationInputTokens'] as const) {
        const v = ev.usage[k]
        if (typeof v === 'number') usage[k] = (usage[k] ?? 0) + v
      }
    },
  })
  for await (const fragment of stream) raw += fragment
  const costUsd = Math.round(usageCost(model, usage) * 1e6) / 1e6
  const parsed = parseReply(raw, rubric)
  if (parsed === undefined) return { ok: false, reason: 'E_JUDGE_PARSE', raw, usage, costUsd }
  const hay = norm(transcript)
  const criteria: CriterionScore[] = parsed.map((c) => ({
    id: c.id,
    score: c.score,
    passed: c.score >= rubric.threshold,
    evidence: c.evidence.map((quote) => ({ quote, found: norm(quote) !== '' && hay.includes(norm(quote)) })),
    why: c.why,
  }))
  const score = Math.min(...criteria.map((c) => c.score))
  return {
    ok: true,
    file: {
      kind: 'agent-ui-judge',
      version: 1,
      run,
      rubric: { id: rubric.id, version: rubric.version, sha256: rubric.sha256 },
      model,
      temperature: JUDGE_TEMPERATURE,
      threshold: rubric.threshold,
      criteria,
      score,
      passed: score >= rubric.threshold,
      usage,
      costUsd,
      at: (deps.now ?? (() => new Date().toISOString()))(),
    },
  }
}

/** Write `judge.json` into a run folder; returns its path. */
export function writeJudge(runDir: string, file: JudgeFile): string {
  const out = join(runDir, 'judge.json')
  writeFileSync(out, `${JSON.stringify(file, null, 2)}\n`)
  return out
}

/** A run folder's `judge.json`, or undefined when it has none or it does not parse as one. */
export function readJudge(runDir: string): JudgeFile | undefined {
  const file = join(runDir, 'judge.json')
  if (!existsSync(file)) return undefined
  try {
    const doc = JSON.parse(readFileSync(file, 'utf8')) as JudgeFile
    return doc.kind === 'agent-ui-judge' && Array.isArray(doc.criteria) ? doc : undefined
  } catch {
    return undefined
  }
}

/** One calibration case: a committed round run cited as a known-good pass or a known-bad fail of its rubric. */
export interface CalibrationCase {
  rubric: string
  round: string
  run: string
  expect: 'good' | 'bad'
  /** Why the run is good or bad, naming the criterion a bad case visibly misses. */
  why: string
}

/** Read and check the calibration set: every case names a rubric that parses and a run whose `report.json` exists
 *  under `roundsDir`, its persona is the rubric's, and each rubric has at least one good and one bad case. Returns
 *  the cases and the problems found. */
export function loadCalibration(roundsDir: string, file = CALIBRATION_FILE, rubricsDir = RUBRICS_DIR): { cases: CalibrationCase[]; problems: string[] } {
  const problems: string[] = []
  let cases: CalibrationCase[] = []
  try {
    cases = (JSON.parse(readFileSync(file, 'utf8')) as { cases: CalibrationCase[] }).cases
  } catch (err) {
    return { cases: [], problems: [`${file}: ${err instanceof Error ? err.message : String(err)}`] }
  }
  const sides = new Map<string, Set<string>>()
  for (const c of cases) {
    const at = `${c.round}/${c.run}`
    let rubric: Rubric | undefined
    try {
      rubric = loadRubric(c.rubric, rubricsDir)
    } catch (err) {
      problems.push(`${at}: ${err instanceof Error ? err.message : String(err)}`)
      continue
    }
    if (rubric === undefined) problems.push(`${at}: no rubric ${c.rubric}`)
    if (c.expect !== 'good' && c.expect !== 'bad') problems.push(`${at}: expect must be good or bad`)
    if (typeof c.why !== 'string' || c.why.trim() === '') problems.push(`${at}: no why`)
    const report = join(roundsDir, c.round, 'runs', c.run, 'report.json')
    if (!existsSync(report)) problems.push(`${at}: no report.json under ${roundsDir}`)
    else {
      const agent = (JSON.parse(readFileSync(report, 'utf8')) as { agent?: string }).agent
      if (agent !== c.rubric) problems.push(`${at}: persona ${agent} is not rubric ${c.rubric}`)
    }
    sides.set(c.rubric, (sides.get(c.rubric) ?? new Set()).add(c.expect))
  }
  for (const [r, s] of sides) if (!s.has('good') || !s.has('bad')) problems.push(`rubric ${r}: needs at least one good and one bad case`)
  return { cases, problems }
}

/** Whether a judged calibration case landed on its side: a bad case under the threshold, a good one at or over. */
export const calibrated = (c: CalibrationCase, file: JudgeFile): boolean => (c.expect === 'bad' ? !file.passed : file.passed)

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
