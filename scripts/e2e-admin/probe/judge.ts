// scripts/e2e-admin/probe/judge.ts: judged checks on committed round transcripts (T-0178, SPEC CL-R8), the pure
// core. A rubric document per persona (`rubrics/<persona>.md`) IS the judge prompt, read verbatim after a fixed
// wrapper, the `tools/corpus-genui/legs/judge.ts` pattern. The judge scores each rubric criterion 1 to 5 with quotes
// from the transcript; the verdict is recomputed here from the scores and the rubric's threshold, never trusted from
// the model. This module never reads a key or `process.env`: `deps.provider` is injected, and the one module that
// builds the real adapter is `eval-judge.ts`, in its keyed arm.
//
// A judged run writes `judged/<name>.json` in its round folder, a new file only: a finished record (the run's
// `report.json`, the round's `signals.md`, an earlier `judged/` file) is never rewritten. `signals.ts` reads it into a
// Judged checks table, a measurement that never moves a run's verdict, pass rate or gate.

import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { AgentProvider } from '../../../packages/agent-ui/a2ui/src/agent/agent-transport.ts'
import { readMetaLine } from '../../../packages/agent-ui/a2ui/src/agent/meta-line.ts'
import { heal } from '../../../packages/agent-ui/a2ui/src/corpus/heal.ts'
import { usageCost, type TraceUsage } from './ledger.ts'
import { metaOf } from './model.ts'

export const RUBRICS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'rubrics')
export const CALIBRATION_FILE = join(RUBRICS_DIR, 'calibration.json')
/** The folder inside a round that holds one `<run name>.json` per judged run. */
export const JUDGED_DIR = 'judged'
/** The pinned judge. The 5.5 models accept no sampling parameter (`providers/anthropic.ts` sends none), so the
 *  temperature is the model's own default, recorded as null, never a value the adapter would drop. */
export const JUDGE_MODEL = 'claude-sonnet-5-5'
export const JUDGE_TEMPERATURE = null
/** A long reply keeps its head and its tail, so a JSON leak at the end of a reply stays in view. */
const HEAD_CHARS = 1_000
const TAIL_CHARS = 1_000
const WHY_CHARS = 600

const WRAPPER = `You are a strict, evidence-bound judge of one chat transcript between a user and an agent persona. Score
every criterion of the rubric below from 1 to 5. Score only what the rubric says and only from the transcript you are
given: quote the exact transcript text you weighed (copied verbatim, a few words to one sentence per quote), never
invent evidence. Each turn lists: what the user said or clicked; "Agent says", the reply the agent sent that turn;
"Chat log, added this turn", the words the chat log the user saw gained that turn (the log edits earlier messages in
place, so this can be a fragment, and JSON here was shown to the user); "Agent surface" and "Surface text", the
components and their visible strings; "Surface data", the data model the turn wrote (state the surface renders, never
shown as chat text). A turn marked [turn failed] showed the user only its error. Reply with ONLY one JSON object, no
prose before or after it, no markdown fence:

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

/** The rubric for a persona, or undefined when it has none. Throws when the file's front matter `id` is not its name. */
export function loadRubric(persona: string, dir = RUBRICS_DIR): Rubric | undefined {
  const file = join(dir, `${persona}.md`)
  if (!existsSync(file)) return undefined
  const rubric = parseRubric(readFileSync(file, 'utf8'), file)
  if (rubric.id !== persona) throw new Error(`${file}: front matter id ${rubric.id} is not the file name ${persona}`)
  return rubric
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
/** The head and the tail of a long text with the elided middle marked. */
export const clip = (s: string, head = HEAD_CHARS, tail = TAIL_CHARS): string =>
  s.length > head + tail ? `${s.slice(0, head)} [... ${s.length - head - tail} chars elided ...] ${s.slice(-tail)}` : s
const VISIBLE = ['text', 'label', 'title', 'subtitle', 'caption', 'placeholder', 'description'] as const

/** The component types, literal visible strings and data model writes the shipped A2UI lines of one turn carry. */
function surfaceOf(lines: readonly string[]): { types: string[]; strings: string[]; data: string[] } {
  const types = new Set<string>()
  const strings: string[] = []
  const data: string[] = []
  for (const line of lines) {
    if (readMetaLine(line) !== undefined || line.trim() === '') continue
    const healed = heal(line)
    if (!healed.ok) continue
    for (const msg of (Array.isArray(healed.messages) ? healed.messages : [healed.messages]) as unknown[]) {
      const dm = isObject(msg) ? msg.updateDataModel : undefined
      if (isObject(dm) && 'value' in dm) data.push(`${typeof dm.path === 'string' ? dm.path : '/'} = ${JSON.stringify(dm.value)}`)
      const body = isObject(msg) ? msg.updateComponents : undefined
      if (!isObject(body) || !Array.isArray(body.components)) continue
      for (const c of body.components) {
        if (!isObject(c)) continue
        if (typeof c.component === 'string') types.add(c.component)
        for (const k of VISIBLE) if (typeof c[k] === 'string' && c[k] !== '' && !strings.includes(c[k])) strings.push(c[k])
      }
    }
  }
  return { types: [...types], strings, data }
}

interface ReportTurn {
  index?: number
  step?: { say?: string; click?: string; page?: string }
  lines?: string[]
  proseText?: string
  clickMissing?: unknown
}

/** The words a turn added to the chat log: `proseText` (the log the user saw, the text `no-json-as-prose` judges)
 *  against the previous turn's log, as the runs of words a word-level longest common subsequence marks inserted,
 *  joined with " ... ". The log is not append-only: a click turn's reply replaces an earlier message in place, so a
 *  prefix cut would hand the turn every later message too. */
export function addedWords(before: string, now: string): string {
  const a = before.split(/\s+/).filter(Boolean)
  const b = now.split(/\s+/).filter(Boolean)
  let lo = 0
  while (lo < a.length && lo < b.length && a[lo] === b[lo]) lo += 1
  let hiA = a.length
  let hiB = b.length
  while (hiA > lo && hiB > lo && a[hiA - 1] === b[hiB - 1]) {
    hiA -= 1
    hiB -= 1
  }
  const x = a.slice(lo, hiA)
  const y = b.slice(lo, hiB)
  // lcs[i][j]: the LCS length of x[i..] and y[j..].
  const lcs = Array.from({ length: x.length + 1 }, () => new Array<number>(y.length + 1).fill(0))
  for (let i = x.length - 1; i >= 0; i -= 1) for (let j = y.length - 1; j >= 0; j -= 1) lcs[i][j] = x[i] === y[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
  const runs: string[][] = []
  let run: string[] = []
  const flush = (): void => {
    if (run.length > 0) runs.push(run)
    run = []
  }
  let i = 0
  let j = 0
  while (j < y.length) {
    if (i < x.length && x[i] === y[j]) {
      flush()
      i += 1
      j += 1
    } else if (i < x.length && lcs[i + 1][j] >= lcs[i][j + 1]) i += 1
    else run.push(y[j++])
  }
  flush()
  return runs.map((r) => r.join(' ')).join(' ... ')
}

/** The transcript a judge reads, from a probe `report.json`. Per turn: what the user said or clicked; the reply the
 *  agent sent (the turn's meta-lines, as `metaOf` reads them); what the chat log the user saw gained that turn (its
 *  `proseText` against the previous turn's, `addedWords`), where a JSON leak or an error banner shows; the surface
 *  (component types and literal visible strings) and the data model the turn wrote, the table state a reply is
 *  judged against. A long text keeps its head and tail. A halted turn shows its error. */
export function transcriptOf(report: { agent?: unknown; turns?: unknown }): string {
  const out: string[] = [`Persona: ${typeof report.agent === 'string' ? report.agent : 'unknown'}`]
  const turns = Array.isArray(report.turns) ? (report.turns as ReportTurn[]) : []
  let log = ''
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
    if (meta.error !== undefined) out.push(`Agent: [turn failed] ${clip(meta.error, 300, 0)}`)
    else out.push(`Agent says: ${clip(meta.prose.join('').trim()) || '(no reply text)'}`)
    if (typeof t.proseText === 'string') {
      out.push(`Chat log, added this turn: ${clip(addedWords(log, t.proseText)) || '(nothing)'}`)
      log = t.proseText
    }
    const s = surfaceOf(lines)
    if (s.types.length > 0) out.push(`Agent surface: ${s.types.join(', ')}`, `Surface text: ${clip(s.strings.map((x) => JSON.stringify(x)).join(' '))}`)
    if (s.data.length > 0) out.push(`Surface data: ${clip(s.data.join('; '))}`)
  })
  return `${out.join('\n')}\n`
}

export interface CriterionScore {
  id: string
  score: number
  /** At or over the threshold and supported. */
  passed: boolean
  /** At least one quote, and every quote found in the transcript: a criterion the judge backed with invented or no
   *  evidence fails, whatever its score. */
  supported: boolean
  /** Each quote, and whether it appears in the transcript (see `quoteFound`). */
  evidence: Array<{ quote: string; found: boolean }>
  why: string
}

/** `judged/<name>.json` in a round folder. */
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
  /** Every criterion passed (at or over the threshold and supported). */
  passed: boolean
  usage: TraceUsage
  costUsd: number
  at: string
}

export type JudgeOutcome = { ok: true; file: JudgeFile } | { ok: false; reason: 'E_JUDGE_PARSE'; raw: string; usage: TraceUsage; costUsd: number }

const norm = (s: string): string => s.replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/\s+/g, ' ').trim()

/** Whether a quote is in the transcript: whitespace and curly quotes normalized, outer quote marks dropped, and a quote
 *  the judge elided with `...` found fragment by fragment. An empty quote is never found. */
export function quoteFound(quote: string, transcript: string): boolean {
  const hay = norm(transcript)
  const parts = norm(quote).replace(/^["']+|["']+$/g, '').split(/\.\.\.|\u2026/).map((p) => p.trim()).filter((p) => p !== '')
  return parts.length > 0 && parts.every((p) => hay.includes(p))
}

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

/** The provider request for one judge call; `eval-judge.ts` estimates a call's cost from it. */
export function judgeRequest(transcript: string, rubric: Rubric, model = JUDGE_MODEL): { model: string; system: string; messages: Array<{ role: 'user'; content: string }> } {
  return { model, system: WRAPPER + rubric.body, messages: [{ role: 'user', content: `TRANSCRIPT:\n${transcript}` }] }
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
    ...judgeRequest(transcript, rubric, model),
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
  const criteria: CriterionScore[] = parsed.map((c) => {
    const evidence = c.evidence.map((quote) => ({ quote, found: quoteFound(quote, transcript) }))
    const supported = evidence.length > 0 && evidence.every((e) => e.found)
    return { id: c.id, score: c.score, passed: supported && c.score >= rubric.threshold, supported, evidence, why: c.why }
  })
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
      passed: criteria.every((c) => c.passed),
      usage,
      costUsd,
      at: (deps.now ?? (() => new Date().toISOString()))(),
    },
  }
}

/** A judged run's file in its round folder. */
export const judgedPath = (roundDir: string, run: string): string => join(roundDir, JUDGED_DIR, `${run}.json`)

/** Write a judged run into its round's `judged/` folder as a new file; an existing file is never rewritten. */
export function writeJudge(roundDir: string, file: JudgeFile): { path: string; written: boolean } {
  const path = judgedPath(roundDir, file.run)
  if (existsSync(path)) return { path, written: false }
  mkdirSync(join(roundDir, JUDGED_DIR), { recursive: true })
  writeFileSync(path, `${JSON.stringify(file, null, 2)}\n`, { flag: 'wx' })
  return { path, written: true }
}

const isScore = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 5

/** Why a parsed file is not a judged run, or undefined when it is one. */
function judgeDefect(doc: unknown): string | undefined {
  if (!isObject(doc) || doc.kind !== 'agent-ui-judge') return 'not an agent-ui-judge file'
  if (!isObject(doc.rubric) || typeof doc.rubric.id !== 'string' || !/^[a-z][a-z0-9-]*$/.test(doc.rubric.id)) return 'no rubric id'
  if (!isScore(doc.threshold)) return 'threshold is not an integer 1 to 5'
  if (!isScore(doc.score) || typeof doc.passed !== 'boolean') return 'no score or verdict'
  if (!Array.isArray(doc.criteria) || doc.criteria.length === 0) return 'no criteria'
  for (const c of doc.criteria) if (!isObject(c) || typeof c.id !== 'string' || !isScore(c.score) || typeof c.passed !== 'boolean') return 'a criterion without an id, a score 1 to 5 and a verdict'
  return undefined
}

/** A run's judged file, or undefined when it has none. A file that does not parse as one is skipped with a warning. */
export function readJudge(roundDir: string, run: string, warn: (s: string) => void = (s) => void process.stderr.write(s)): JudgeFile | undefined {
  const path = judgedPath(roundDir, run)
  if (!existsSync(path)) return undefined
  let doc: unknown
  try {
    doc = JSON.parse(readFileSync(path, 'utf8'))
  } catch (err) {
    warn(`judge: skipping ${path}: ${err instanceof Error ? err.message : String(err)}\n`)
    return undefined
  }
  const defect = judgeDefect(doc)
  if (defect !== undefined) {
    warn(`judge: skipping ${path}: ${defect}\n`)
    return undefined
  }
  return doc as JudgeFile
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
 *  under `roundsDir`, its persona is the rubric's, a good case's verdict is pass and a bad case's fail, and each
 *  rubric has at least one good and one bad case. Returns
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
      const { agent, verdict } = JSON.parse(readFileSync(report, 'utf8')) as { agent?: string; verdict?: string }
      if (agent !== c.rubric) problems.push(`${at}: persona ${agent} is not rubric ${c.rubric}`)
      const want = c.expect === 'good' ? 'pass' : 'fail'
      if (verdict !== want) problems.push(`${at}: a ${c.expect} case must be a run with verdict ${want}, this one is ${verdict}`)
    }
    sides.set(c.rubric, (sides.get(c.rubric) ?? new Set()).add(c.expect))
  }
  for (const [r, s] of sides) if (!s.has('good') || !s.has('bad')) problems.push(`rubric ${r}: needs at least one good and one bad case`)
  return { cases, problems }
}

/** Whether a judged calibration case landed on its side: a bad case under the threshold, a good one at or over. */
export const calibrated = (c: CalibrationCase, file: JudgeFile): boolean => (c.expect === 'bad' ? !file.passed : file.passed)

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
