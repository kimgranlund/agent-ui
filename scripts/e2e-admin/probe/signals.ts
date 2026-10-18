// scripts/e2e-admin/probe/signals.ts: the tables every round report used to build by hand, read from the committed
// round archive (T-0342). The archive is the signal store (SPEC CL-R4): `ledger.jsonl` rows join their
// `runs/<name>/report.json` by `out` and their trace lines by `traces` ranges, in memory, never stored. A round with
// no ledger (r1, r2, t0208) is read from its reports alone, cost and turns unknown.
//
// usage: npm run eval:signals -- (--round <folder> [--round <folder>]... | --all) [--against <folder>]
//          [--floor <tag>=<rate>]... [--max-drop <delta>] [--min-samples <n>] [--rounds-dir <dir>] [--json]
//
// `--round` names one folder under `.sdlc/evals/rounds/` (`2026-10-17-r9-matrix`) or a path; repeat the flag to read
// several as one. A stray argument, an unknown flag or an unknown floor tag exits 2.
// `--against <folder>` prints the churn of every cell against that round, the baseline (CL-R9), and the trace tallies
// beside the baseline's in the same cells, sample 1 against sample 1 and all against all. Gates are opt-in:
// `--floor <tag>=<rate>` (tag regression, routing, long, other or all) and `--max-drop <delta>` exit 1 on a cell
// under its floor or one whose pass rate fell by more than the delta, reading per cell as `floorMet` does in
// `tools/corpus-genui/legs/report.ts`: a missing report counts as a fail, a baseline cell with zero samples now
// fails its floor and counts as a drop to 0, and a cell with fewer than `--min-samples` (default 3) samples on a side
// it is read from is reported, not gated. Rates compare with a 1e-9 slack, so a drop of exactly the delta passes.
//
// A cell is scenario x model family x effort. Its state for churn is pass only when every sample passed, so a mixed
// cell counts as a fail; churn also compares like samples (sample 1 on both sides) and prints each multi-sample
// cell's rate (T-0349). The trace tallies (turn outcomes, `trace.failureCodes`, failed rounds per code, repair and
// payload shapes, exemplar retrieval) compare with the baseline's runs in this round's cells, the same runs.

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readJudge } from './judge.ts'
import { EVALS_ROUNDS, modelFamily, runNameParts, usageCost, type TraceUsage } from './ledger.ts'

export interface Check {
  check: string
  turn?: number
  status: string
  detail?: string
}

interface TraceRound {
  round?: number
  status?: string
  usage?: TraceUsage
  failures?: Array<{ code?: string }>
  tools?: Array<{ name?: string; input?: { messages?: unknown } }>
}

/** One trace line of a run (one agent turn), with the fields the tables read. */
export interface Turn {
  model: string
  outcome: string
  ms: number | null
  rounds: TraceRound[]
  failureCodes: string[]
  sections: Array<{ id: string; digest: string }>
  exemplarIds: string[]
}

/** One probe run: its ledger row (when the round has one), its report and its trace lines, joined. */
export interface SignalRun {
  round: string
  name: string
  scenario: string
  sample: number
  agent: string
  model: string
  effort: string
  verdict: 'pass' | 'fail' | null
  /** The probe checks, then one `judge <rubric>.<criterion>` check per criterion of `judge.json` when the run was
   *  judged (T-0178). */
  checks: Check[]
  /** The run's `judge.json` verdict (T-0178), null when it was not judged. */
  judge: { rubric: string; score: number; threshold: number; passed: boolean } | null
  /** null when the round has no ledger. */
  costUsd: number | null
  turns: Turn[]
}

function readJson(file: string): Record<string, unknown> | undefined {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>
  } catch {
    return undefined
  }
}

function jsonLines(file: string): Array<Record<string, unknown>> {
  if (!existsSync(file)) return []
  return readFileSync(file, 'utf8')
    .split('\n')
    .flatMap((l) => {
      try {
        return l.trim() === '' ? [] : [JSON.parse(l) as Record<string, unknown>]
      } catch {
        return []
      }
    })
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '')

function toTurn(d: Record<string, unknown>): Turn {
  const model = str(d.model)
  const routing = d.routing as { sections?: Array<{ id?: unknown; digest?: unknown }> } | undefined
  return {
    model,
    outcome: str(d.outcome),
    ms: typeof d.ms === 'number' ? d.ms : null,
    rounds: Array.isArray(d.rounds) ? (d.rounds as TraceRound[]) : [],
    failureCodes: ((d.trace as { failureCodes?: unknown[] } | undefined)?.failureCodes ?? []).filter((c): c is string => typeof c === 'string'),
    sections: (routing?.sections ?? []).filter((s) => typeof s.id === 'string' && typeof s.digest === 'string').map((s) => ({ id: s.id as string, digest: s.digest as string })),
    exemplarIds: ((d.trace as { exemplarIds?: unknown[] } | undefined)?.exemplarIds ?? []).filter((c): c is string => typeof c === 'string'),
  }
}

/** The runs of one round folder. With a ledger: one per row, in ledger order, a row whose report is not written yet
 *  (an archive mid-round) read as no report. Without: one per `runs/<name>/report.json`, cost unknown. */
export function readRound(dir: string): SignalRun[] {
  const round = basename(dir)
  const days = new Map<string, Array<Record<string, unknown> | undefined>>()
  const traceLines = (file: string): Array<Record<string, unknown> | undefined> => {
    if (!days.has(file)) {
      const p = join(dir, file)
      days.set(file, existsSync(p) ? readFileSync(p, 'utf8').split('\n').map((l) => { try { return JSON.parse(l) as Record<string, unknown> } catch { return undefined } }) : [])
    }
    return days.get(file) ?? []
  }
  const run = (name: string, siblings: string[], runDir: string, row: Record<string, unknown> | undefined): SignalRun => {
    const report = readJson(join(runDir, 'report.json'))
    const judged = readJudge(runDir)
    // The ledger's own `scenario` predates T-0342 on older rounds (T-0329 bucketed every sample), so it is rederived.
    const { scenario, sample } = runNameParts(name, siblings)
    const v = (row !== undefined && 'verdict' in row ? row.verdict : report?.verdict) as unknown
    const turns: Turn[] = []
    for (const t of (row?.traces as Array<{ file?: string; from?: number; to?: number }> | undefined) ?? []) {
      const lines = traceLines(String(t.file))
      for (let n = t.from ?? 1; n <= (t.to ?? 0); n += 1) {
        const d = lines[n - 1]
        if (d !== undefined) turns.push(toTurn(d))
      }
    }
    return {
      round,
      name,
      scenario,
      sample,
      agent: str(row?.agent) || str(report?.agent),
      model: str(row?.model) || str(report?.model),
      effort: str(row?.effort) || 'default',
      verdict: v === 'pass' || v === 'fail' ? v : null,
      checks: [
        ...(Array.isArray(report?.checks) ? (report.checks as Check[]) : []),
        ...(judged?.criteria ?? []).map((c) => ({ check: `judge ${judged!.rubric.id}.${c.id}`, status: c.passed ? 'pass' : 'fail', detail: `score ${c.score}, threshold ${judged!.threshold}` })),
      ],
      judge: judged === undefined ? null : { rubric: judged.rubric.id, score: judged.score, threshold: judged.threshold, passed: judged.passed },
      costUsd: row === undefined ? null : typeof row.costUsd === 'number' ? row.costUsd : 0,
      turns,
    }
  }
  const ledger = join(dir, 'ledger.jsonl')
  if (existsSync(ledger)) {
    const rows = jsonLines(ledger).filter((row) => typeof row.out === 'string')
    const names = rows.map((row) => str(row.name) || basename(row.out as string))
    return rows.map((row, i) => run(names[i], names, join(dir, 'runs', basename(row.out as string)), row))
  }
  const runs = join(dir, 'runs')
  if (!existsSync(runs)) return []
  const names = readdirSync(runs, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(runs, e.name, 'report.json')))
    .map((e) => e.name)
    .sort()
  return names.map((name) => run(name, names, join(runs, name), undefined))
}

/** Several round folders read as one. */
export function readRounds(dirs: string[]): SignalRun[] {
  return dirs.flatMap((d) => readRound(d))
}

const FAMILY_ORDER = ['haiku', 'sonnet', 'opus']
function modelOrder(models: Iterable<string>): string[] {
  const set = new Set(models)
  return [...FAMILY_ORDER.filter((m) => set.has(m)), ...[...set].filter((m) => !FAMILY_ORDER.includes(m)).sort()]
}

/** The floor tag of a scenario, read from its name prefix until scenarios carry tags (CL-R9). */
export function tagOf(scenario: string): string {
  if (scenario.startsWith('regress-')) return 'regression'
  if (scenario.startsWith('routing-')) return 'routing'
  if (scenario.startsWith('long-')) return 'long'
  return 'other'
}

export interface Cell {
  /** `<scenario>-<model>`, plus `@<effort>` off the default effort: the run name without its sample. */
  key: string
  scenario: string
  model: string
  effort: string
  agent: string
  tag: string
  pass: number
  runs: number
}

const cellKey = (r: SignalRun): string => `${r.scenario}-${modelFamily(r.model)}${r.effort === 'default' ? '' : `@${r.effort}`}`

export function cellsOf(runs: SignalRun[]): Cell[] {
  const cells = new Map<string, Cell>()
  for (const r of runs) {
    const key = cellKey(r)
    const c = cells.get(key) ?? { key, scenario: r.scenario, model: modelFamily(r.model), effort: r.effort, agent: r.agent, tag: tagOf(r.scenario), pass: 0, runs: 0 }
    c.runs += 1
    if (r.verdict === 'pass') c.pass += 1
    cells.set(key, c)
  }
  const order = modelOrder([...cells.values()].map((c) => c.model))
  return [...cells.values()].sort((a, b) => (a.scenario !== b.scenario ? (a.scenario < b.scenario ? -1 : 1) : order.indexOf(a.model) - order.indexOf(b.model) || (a.effort < b.effort ? -1 : a.effort > b.effort ? 1 : 0)))
}

export interface Signals {
  rounds: string[]
  runs: number
  models: string[]
  byModel: Record<string, { pass: number; runs: number }>
  cells: Cell[]
  presets: Array<{ agent: string; model: string; pass: number; runs: number }>
  mixed: Cell[]
  checks: Array<{ check: string; fails: number; runs: number }>
  retries: Array<{ code: string; fired: number; turns: number; saved: number; extraUsd: number }>
  spend: Array<{ model: string; runs: number; turns: number; usd: number | null; msP50: number | null; msP90: number | null }>
  digests: Array<{ agent: string; section: string; digest: string; turns: number }>
  /** Judged runs (T-0178) per rubric x model family: runs judged, passed, and the mean of their lowest scores. */
  judged: Array<{ rubric: string; model: string; runs: number; pass: number; meanScore: number }>
  /** Turns per persona with no `routing.sections` (a halted turn carries none). */
  noSections: Record<string, number>
  tally: Tally
}

/** The trace line tallies a round report used to count by hand (T-0349). Keys are sorted. */
export interface Tally {
  turns: number
  /** Turns per `outcome` (ok, halt). */
  outcomes: Record<string, number>
  /** Turns per `trace.failureCodes` code, a code once per turn: the shipped turn's codes, SURFACE_DEGRADED among them. */
  failureCodes: Record<string, number>
  /** Failed rounds per producer code, a code once per round (the retry table's fired). */
  failedRounds: Record<string, number>
  /** Rounds with a tool input that sent `messages` as a string, not an array, a round once. */
  stringMessages: number
  /** Per code: the repair rounds that answer a failed round carrying it, and how many of them called no tool (an
   *  empty `tools` array; a trace line older than the `tools` field counts as a repair, never as reply-only). */
  repairs: Record<string, { repairs: number; replyOnly: number }>
  /** Turns per persona (the run's preset) x `trace.exemplarIds` id, a turn once per id. */
  retrieval: Array<{ agent: string; exemplar: string; turns: number }>
  /** Distinct turns per persona that retrieved at least one exemplar. */
  retrievalTurns: Record<string, number>
}

type Retry = Signals['retries'][number]

/** A turn is saved when it did not halt and shipped with no `*_UNCORRECTED` or SURFACE_DEGRADED code. */
const savedTurn = (t: Turn): boolean => t.outcome !== 'halt' && !t.failureCodes.some((c) => c.endsWith('_UNCORRECTED') || c === 'SURFACE_DEGRADED')

const sortedRecord = <T>(m: Map<string, T>): Record<string, T> => Object.fromEntries([...m.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
const bump = (m: Map<string, number>, k: string): void => void m.set(k, (m.get(k) ?? 0) + 1)

/** One walk over the trace lines: the tallies and the retry table (`aggregate`'s retries). Fired counts failed rounds
 *  (a code once per round); extra USD is the cost of the repair round that answers a failed round, split evenly
 *  across that round's codes. */
function walk(runs: SignalRun[]): { tally: Tally; retries: Retry[] } {
  const outcomes = new Map<string, number>()
  const failureCodes = new Map<string, number>()
  const retries = new Map<string, Retry>()
  const retrievalTurns = new Map<string, number>()
  const repairs = new Map<string, { repairs: number; replyOnly: number }>()
  const retrieval = new Map<string, { agent: string; exemplar: string; turns: number }>()
  let turns = 0
  let stringMessages = 0
  for (const r of runs) {
    for (const t of r.turns) {
      turns += 1
      bump(outcomes, t.outcome || '(none)')
      for (const code of new Set(t.failureCodes)) bump(failureCodes, code)
      if (t.exemplarIds.length > 0) bump(retrievalTurns, r.agent)
      for (const id of new Set(t.exemplarIds)) {
        const k = `${r.agent}\u0000${id}`
        const x = retrieval.get(k) ?? { agent: r.agent, exemplar: id, turns: 0 }
        x.turns += 1
        retrieval.set(k, x)
      }
      const inTurn = new Set<string>()
      t.rounds.forEach((rd, i) => {
        if ((rd.tools ?? []).some((tool) => typeof tool.input?.messages === 'string')) stringMessages += 1
        if (rd.status !== 'failed') return
        const codes = [...new Set((rd.failures ?? []).map((f) => f.code).filter((c): c is string => typeof c === 'string'))]
        const repair = t.rounds[i + 1]
        const extra = repair !== undefined && codes.length > 0 ? usageCost(t.model, repair.usage) / codes.length : 0
        for (const code of codes) {
          const x = retries.get(code) ?? { code, fired: 0, turns: 0, saved: 0, extraUsd: 0 }
          x.fired += 1
          x.extraUsd += extra
          retries.set(code, x)
          inTurn.add(code)
          if (repair === undefined) continue
          const y = repairs.get(code) ?? { repairs: 0, replyOnly: 0 }
          y.repairs += 1
          if (Array.isArray(repair.tools) && repair.tools.length === 0) y.replyOnly += 1
          repairs.set(code, y)
        }
      })
      for (const code of inTurn) {
        const x = retries.get(code)!
        x.turns += 1
        if (savedTurn(t)) x.saved += 1
      }
    }
  }
  const byCode = [...retries.values()].sort((a, b) => b.fired - a.fired || (a.code < b.code ? -1 : a.code > b.code ? 1 : 0))
  return {
    retries: byCode,
    tally: {
      turns,
      outcomes: sortedRecord(outcomes),
      failureCodes: sortedRecord(failureCodes),
      failedRounds: sortedRecord(new Map(byCode.map((x) => [x.code, x.fired]))),
      stringMessages,
      repairs: sortedRecord(repairs),
      retrieval: [...retrieval.values()].sort((a, b) => (a.agent !== b.agent ? (a.agent < b.agent ? -1 : 1) : b.turns - a.turns || (a.exemplar < b.exemplar ? -1 : a.exemplar > b.exemplar ? 1 : 0))),
      retrievalTurns: sortedRecord(retrievalTurns),
    },
  }
}

export const tally = (runs: SignalRun[]): Tally => walk(runs).tally

/** Nearest-rank percentile of a non-empty sorted list. */
const pct = (sorted: number[], p: number): number => sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)]


export function aggregate(runs: SignalRun[]): Signals {
  const models = modelOrder(runs.map((r) => modelFamily(r.model)))
  const byModel: Signals['byModel'] = {}
  for (const m of models) byModel[m] = { pass: 0, runs: 0 }
  for (const r of runs) {
    const m = byModel[modelFamily(r.model)]
    m.runs += 1
    if (r.verdict === 'pass') m.pass += 1
  }
  const cells = cellsOf(runs)

  const presets = new Map<string, { agent: string; model: string; pass: number; runs: number }>()
  for (const r of runs) {
    const k = `${r.agent}\u0000${modelFamily(r.model)}`
    const p = presets.get(k) ?? { agent: r.agent, model: modelFamily(r.model), pass: 0, runs: 0 }
    p.runs += 1
    if (r.verdict === 'pass') p.pass += 1
    presets.set(k, p)
  }

  const checks = new Map<string, { check: string; fails: number; runs: Set<string> }>()
  for (const r of runs) {
    for (const c of r.checks) {
      if (c.status !== 'fail') continue
      const h = checks.get(c.check) ?? { check: c.check, fails: 0, runs: new Set<string>() }
      h.fails += 1
      h.runs.add(`${r.round}/${r.name}`)
      checks.set(c.check, h)
    }
  }

  const w = walk(runs)

  const spend = models.map((model) => {
    const rs = runs.filter((r) => modelFamily(r.model) === model)
    const turns = rs.flatMap((r) => r.turns)
    const ms = turns.map((t) => t.ms).filter((m): m is number => m !== null).sort((a, b) => a - b)
    const known = rs.every((r) => r.costUsd !== null)
    return {
      model,
      runs: rs.length,
      turns: turns.length,
      usd: known ? Math.round(rs.reduce((s, r) => s + (r.costUsd ?? 0), 0) * 1e6) / 1e6 : null,
      msP50: ms.length > 0 ? pct(ms, 0.5) : null,
      msP90: ms.length > 0 ? pct(ms, 0.9) : null,
    }
  })

  const digests = new Map<string, { agent: string; section: string; digest: string; turns: number }>()
  const noSections: Record<string, number> = {}
  for (const r of runs) {
    for (const t of r.turns) {
      if (t.sections.length === 0) noSections[r.agent] = (noSections[r.agent] ?? 0) + 1
      for (const s of t.sections) {
        const k = `${r.agent}\u0000${s.id}\u0000${s.digest}`
        const d = digests.get(k) ?? { agent: r.agent, section: s.id, digest: s.digest, turns: 0 }
        d.turns += 1
        digests.set(k, d)
      }
    }
  }

  const judged = new Map<string, { rubric: string; model: string; runs: number; pass: number; sum: number }>()
  for (const r of runs) {
    if (!r.judge) continue
    const k = `${r.judge.rubric}\u0000${modelFamily(r.model)}`
    const j = judged.get(k) ?? { rubric: r.judge.rubric, model: modelFamily(r.model), runs: 0, pass: 0, sum: 0 }
    j.runs += 1
    j.sum += r.judge.score
    if (r.judge.passed) j.pass += 1
    judged.set(k, j)
  }

  const byName = <T>(key: (x: T) => string) => (a: T, b: T): number => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0)
  return {
    rounds: [...new Set(runs.map((r) => r.round))],
    runs: runs.length,
    models,
    byModel,
    cells,
    presets: [...presets.values()].sort((a, b) => byName<{ agent: string }>((x) => x.agent)(a, b) || models.indexOf(a.model) - models.indexOf(b.model)),
    mixed: cells.filter((c) => c.pass > 0 && c.pass < c.runs),
    checks: [...checks.values()].map((h) => ({ check: h.check, fails: h.fails, runs: h.runs.size })).sort((a, b) => b.fails - a.fails || byName<{ check: string }>((x) => x.check)(a, b)),
    retries: w.retries,
    spend,
    digests: [...digests.values()].sort(byName((d) => `${d.agent}\u0000${d.section}\u0000${d.digest}`)),
    judged: [...judged.values()].map(({ sum, ...j }) => ({ ...j, meanScore: Math.round((sum / j.runs) * 100) / 100 })).sort((a, b) => byName<{ rubric: string }>((x) => x.rubric)(a, b) || models.indexOf(a.model) - models.indexOf(b.model)),
    noSections,
    tally: w.tally,
  }
}

export const TRANSITIONS = ['fail to pass', 'pass to fail', 'fail to fail', 'pass to pass'] as const
export type Transition = (typeof TRANSITIONS)[number]

export interface Churn {
  transitions: Record<Transition, string[]>
  /** The same transitions on like samples: each cell's sample 1 against the baseline's sample 1 (T-0349). */
  sampleOne: Record<Transition, string[]>
  /** Cells in both rounds with more than one sample on either side, as rates. */
  rates: Array<{ cell: string; base: { pass: number; runs: number }; now: { pass: number; runs: number } }>
  /** Cells only in the current round. */
  added: string[]
  /** Cells only in the baseline. */
  gone: string[]
}

function transitionsOf(base: SignalRun[], current: SignalRun[]): Record<Transition, string[]> {
  const state = (c: Cell): 'pass' | 'fail' => (c.pass === c.runs ? 'pass' : 'fail')
  const before = new Map(cellsOf(base).map((c) => [c.key, c]))
  const transitions = Object.fromEntries(TRANSITIONS.map((t) => [t, [] as string[]])) as Record<Transition, string[]>
  for (const c of cellsOf(current)) {
    const b = before.get(c.key)
    if (b !== undefined) transitions[`${state(b)} to ${state(c)}` as Transition].push(c.key)
  }
  return transitions
}

/** The churn of every cell from a baseline round to the current one. */
export function churn(base: SignalRun[], current: SignalRun[]): Churn {
  const before = new Map(cellsOf(base).map((c) => [c.key, c]))
  const after = cellsOf(current)
  const one = (rs: SignalRun[]): SignalRun[] => rs.filter((r) => r.sample === 1)
  const rates = after.flatMap((c) => {
    const b = before.get(c.key)
    return b !== undefined && (b.runs > 1 || c.runs > 1) ? [{ cell: c.key, base: { pass: b.pass, runs: b.runs }, now: { pass: c.pass, runs: c.runs } }] : []
  })
  const now = new Set(after.map((c) => c.key))
  return { transitions: transitionsOf(base, current), sampleOne: transitionsOf(one(base), one(current)), rates, added: after.filter((c) => !before.has(c.key)).map((c) => c.key), gone: [...before.keys()].filter((k) => !now.has(k)) }
}

/** The baseline runs in the current round's cells: the same runs a targeted round reran. */
export function sameCells(base: SignalRun[], current: SignalRun[]): SignalRun[] {
  const keys = new Set(current.map(cellKey))
  return base.filter((r) => keys.has(cellKey(r)))
}

export interface GateOptions {
  /** Pass-rate floor per tag; `all` applies to every tag without its own. */
  floors: Record<string, number>
  maxDrop?: number
  minSamples: number
}

export interface GateMiss {
  cell: string
  reason: string
}

/** Rates are compared with this slack, so a drop of exactly the delta (9 of 10 to 7 of 10 at 0.2) is not a miss. */
const EPS = 1e-9

/** The cells that miss a floor or drop past the delta. Cells are the current round's plus the baseline's. A cell is
 *  gated only with at least `minSamples` samples on each side it is read from; a baseline cell with no sample now
 *  is the exception both gates catch: it fails its floor and counts as a drop to 0, never skipped. */
export function gate(current: SignalRun[], base: SignalRun[] | undefined, o: GateOptions): { misses: GateMiss[]; ungated: string[] } {
  const now = new Map(cellsOf(current).map((c) => [c.key, c]))
  const before = new Map(cellsOf(base ?? []).map((c) => [c.key, c]))
  const keys = [...new Set([...now.keys(), ...before.keys()])].sort()
  const misses: GateMiss[] = []
  const ungated = new Set<string>()
  const enough = (x: Cell): boolean => x.runs >= o.minSamples
  for (const key of keys) {
    const c = now.get(key)
    const b = before.get(key)
    const tag = (c ?? b)!.tag
    const floor = o.floors[tag] ?? o.floors.all
    if (floor !== undefined) {
      if (c === undefined) misses.push({ cell: key, reason: `no sample (the ${tag} floor is ${floor})` })
      else if (!enough(c)) ungated.add(key)
      else if (c.pass < floor * c.runs - EPS) misses.push({ cell: key, reason: `${c.pass} of ${c.runs} under the ${tag} floor ${floor}` })
    }
    if (o.maxDrop !== undefined && b !== undefined) {
      if (!enough(b) || (c !== undefined && !enough(c))) ungated.add(key)
      else {
        const was = b.pass / b.runs
        const rate = c === undefined ? 0 : c.pass / c.runs
        if (was - rate > o.maxDrop + EPS) misses.push({ cell: key, reason: `dropped ${was.toFixed(2)} to ${rate.toFixed(2)}${c === undefined ? ' (no sample now)' : ''} (more than ${o.maxDrop})` })
      }
    }
  }
  return { misses, ungated: [...ungated] }
}

const usd = (n: number | null): string => (n === null ? 'unknown' : n.toFixed(2))
const ofN = (p: { pass: number; runs: number } | undefined): string => (p === undefined ? '' : `${p.pass} of ${p.runs}`)

export interface Against {
  round: string
  churn: Churn
  /** This round's sample 1 runs and all its runs, and the same two of the baseline's runs in this round's cells. */
  tallies: { sampleOne: Tally; baseSampleOne: Tally; all: Tally; base: Tally }
}

/** Churn and the trace tallies of the current round against a baseline round; `all` is the current round's tally
 *  when the caller already aggregated it. */
export function against(round: string, base: SignalRun[], current: SignalRun[], all: Tally = tally(current)): Against {
  const one = (rs: SignalRun[]): SignalRun[] => rs.filter((r) => r.sample === 1)
  const same = sameCells(base, current)
  return { round, churn: churn(base, current), tallies: { sampleOne: tally(one(current)), baseSampleOne: tally(one(same)), all, base: tally(same) } }
}

export interface RenderOptions {
  rounds: string[]
  /** The runs' aggregate when the caller already has it. */
  signals?: Signals
  against?: Against
  gate?: { misses: GateMiss[]; ungated: string[] }
}

/** The signals of some runs as markdown; no timestamps, so a rewrite of the same round is byte-identical. */
export function renderSignals(runs: SignalRun[], o: RenderOptions): string {
  const s = o.signals ?? aggregate(runs)
  const L: string[] = [`# Eval signals: ${o.rounds.join(', ')}`, '']
  L.push('Generated by `scripts/e2e-admin/probe/signals.ts` (T-0342) from the round archive; do not edit by hand. Regenerate: `npm run eval:signals -- ' + o.rounds.map((r) => `--round ${r}`).join(' ') + '`.', '')
  const fails = runs.filter((r) => r.verdict === 'fail').length
  const missing = runs.filter((r) => r.verdict === null).length
  const total = s.spend.every((x) => x.usd !== null) ? s.spend.reduce((a, x) => a + (x.usd ?? 0), 0) : null
  L.push(`- Runs: ${s.runs} (${s.runs - fails - missing} pass, ${fails} fail, ${missing} no report)`)
  L.push(`- Spend: ${total === null ? 'unknown (no ledger)' : `$${total.toFixed(2)} estimated at list prices (ledger.jsonl)`}`)
  L.push(`- By model: ${s.models.map((m) => `${m} ${ofN(s.byModel[m])}`).join(', ') || 'none'}`, '')

  const head = (first: string): void => void L.push(`| ${first} | ${s.models.join(' | ')} |`, `| --- |${s.models.map(() => ' --- |').join('')}`)
  L.push('## Pass rate, scenario by model', '')
  head('Scenario')
  const scenarios = [...new Set(s.cells.map((c) => `${c.scenario}${c.effort === 'default' ? '' : `@${c.effort}`}`))]
  for (const sc of scenarios) {
    L.push(`| ${sc} |${s.models.map((m) => ` ${ofN(s.cells.find((c) => `${c.scenario}${c.effort === 'default' ? '' : `@${c.effort}`}` === sc && c.model === m))} |`).join('').replace(/  \|/g, ' |')}`)
  }
  L.push('', '## Pass rate, preset by model', '')
  head('Preset')
  for (const agent of [...new Set(s.presets.map((p) => p.agent))]) {
    L.push(`| ${agent || '(none)'} |${s.models.map((m) => ` ${ofN(s.presets.find((p) => p.agent === agent && p.model === m))} |`).join('').replace(/  \|/g, ' |')}`)
  }
  L.push(`| All |${s.models.map((m) => ` ${ofN(s.byModel[m])} |`).join('')}`)

  L.push('', '## Mixed cells', '')
  if (s.mixed.length === 0) L.push('None: every cell passed or failed on all its samples.')
  else for (const c of s.mixed) L.push(`- \`${c.key}\`: ${c.pass} of ${c.runs}`)

  L.push('', '## Failing checks', '', 'Probe check results with status fail, from each `runs/<name>/report.json`.', '')
  if (s.checks.length === 0) L.push('None.')
  else {
    L.push('| Check | Fails | Runs |', '| --- | --- | --- |')
    for (const c of s.checks) L.push(`| ${c.check} | ${c.fails} | ${c.runs} |`)
  }

  if (s.judged.length > 0) {
    L.push('', '## Judged checks', '', 'Each judged run\'s `runs/<name>/judge.json` (`npm run eval:judge`, T-0178): a run passes when every rubric criterion scores at or over the threshold; the score is its lowest criterion. Each criterion is also a `judge <rubric>.<criterion>` row above.', '')
    L.push('| Rubric | Model | Judged | Pass | Mean score |', '| --- | --- | --- | --- | --- |')
    for (const j of s.judged) L.push(`| ${j.rubric} | ${j.model} | ${j.runs} | ${j.pass} | ${j.meanScore} |`)
  }

  L.push('', '## Producer retry codes', '', 'From the trace lines: fired counts failed rounds (turns), saved counts turns that did not halt and shipped with no `*_UNCORRECTED` or SURFACE_DEGRADED code, and extra USD is the repair round that answers each failed round, split across its codes.', '')
  if (s.retries.length === 0) L.push('None (no trace lines, or no failed round).')
  else {
    L.push('| Code | Fired (turns) | Saved | Extra USD |', '| --- | --- | --- | --- |')
    for (const x of s.retries) L.push(`| ${x.code} | ${x.fired} (${x.turns}) | ${x.saved} | ${x.extraUsd.toFixed(2)} |`)
  }

  L.push('', '## Spend and latency per turn', '', 'USD from `ledger.jsonl` at the round.json prices (an overestimate); latency is each trace line\'s `ms`, nearest-rank p50 and p90.', '')
  L.push('| Model | Runs | Turns | USD | USD per turn | ms p50 | ms p90 |', '| --- | --- | --- | --- | --- | --- | --- |')
  for (const x of s.spend) L.push(`| ${x.model} | ${x.runs} | ${x.usd === null ? 'unknown' : x.turns} | ${usd(x.usd)} | ${x.usd === null || x.turns === 0 ? 'unknown' : (x.usd / x.turns).toFixed(3)} | ${x.msP50 ?? 'unknown'} | ${x.msP90 ?? 'unknown'} |`)

  L.push('', '## Section digests per persona', '', 'Each trace line\'s `routing.sections[].digest`, the three most frequent per section (`--json` lists every one); a halted turn carries none.', '')
  if (s.digests.length === 0) L.push('None recorded.')
  else {
    L.push('| Persona | Section | Digests | Turns | Most frequent (turns) |', '| --- | --- | --- | --- | --- |')
    for (const key of [...new Set(s.digests.map((d) => `${d.agent}\u0000${d.section}`))]) {
      const ds = s.digests.filter((d) => `${d.agent}\u0000${d.section}` === key).sort((a, b) => b.turns - a.turns || (a.digest < b.digest ? -1 : 1))
      const top = ds.slice(0, 3).map((d) => `\`${d.digest}\` (${d.turns})`).join(', ')
      L.push(`| ${ds[0].agent} | ${ds[0].section} | ${ds.length} | ${ds.reduce((n, d) => n + d.turns, 0)} | ${top}${ds.length > 3 ? `, ${ds.length - 3} more` : ''} |`)
    }
  }
  const bare = Object.entries(s.noSections)
  if (bare.length > 0) L.push('', `Turns with no sections: ${bare.map(([a, n]) => `${a} ${n}`).join(', ')}.`)

  const t = s.tally
  L.push('', '## Turn outcomes and failure codes', '', 'Each trace line\'s `outcome` and `trace.failureCodes` (the codes the shipped turn carries), counted as turns.', '')
  L.push('| Measure | Turns |', '| --- | --- |', `| All turns | ${t.turns} |`)
  for (const [k, n] of Object.entries(t.outcomes)) L.push(`| outcome ${k} | ${n} |`)
  for (const [k, n] of Object.entries(t.failureCodes)) L.push(`| ${k} | ${n} |`)

  L.push('', '## Repair and payload shapes', '', 'A repair round answers a failed round; reply-only means it called no tool. String `messages` counts rounds whose tool input sent `messages` as a string.', '')
  L.push(`- String \`messages\`: ${t.stringMessages} rounds`)
  if (Object.keys(t.repairs).length === 0) L.push('- Repairs: none')
  else {
    L.push('', '| Code | Repairs | Reply-only |', '| --- | --- | --- |')
    for (const [k, x] of Object.entries(t.repairs)) L.push(`| ${k} | ${x.repairs} | ${x.replyOnly} |`)
  }

  L.push('', '## Exemplar retrieval per persona', '', 'Each trace line\'s `trace.exemplarIds`, the five most retrieved per persona (`--json` lists every one).', '')
  if (t.retrieval.length === 0) L.push('None recorded.')
  else {
    L.push('| Persona | Exemplars | Turns retrieving | Most retrieved (turns) |', '| --- | --- | --- | --- |')
    for (const agent of [...new Set(t.retrieval.map((x) => x.agent))]) {
      const xs = t.retrieval.filter((x) => x.agent === agent)
      const top = xs.slice(0, 5).map((x) => `\`${x.exemplar}\` (${x.turns})`).join(', ')
      L.push(`| ${agent || '(none)'} | ${xs.length} | ${t.retrievalTurns[agent] ?? 0} | ${top}${xs.length > 5 ? `, ${xs.length - 5} more` : ''} |`)
    }
  }

  if (o.against !== undefined) {
    const c = o.against.churn
    const base = o.against.round
    const cells = (ks: string[]): string => ks.map((k) => `\`${k}\``).join(', ')
    L.push('', `## Churn against ${base}`, '', 'A cell passes when every sample passed; a mixed cell or a run with no report counts as a fail. Sample 1 compares like samples, each cell\'s first sample on both sides.', '')
    L.push('| Transition | Count | Cells | Sample 1 | Cells (sample 1) |', '| --- | --- | --- | --- | --- |')
    for (const tr of TRANSITIONS) L.push(`| ${tr} | ${c.transitions[tr].length} | ${tr === 'pass to pass' ? 'stable' : cells(c.transitions[tr])} | ${c.sampleOne[tr].length} | ${tr === 'pass to pass' ? 'stable' : cells(c.sampleOne[tr])} |`)
    if (c.added.length > 0) L.push(`| only in this round | ${c.added.length} | ${cells(c.added)} | | |`)
    if (c.gone.length > 0) L.push(`| only in ${base} | ${c.gone.length} | ${cells(c.gone)} | | |`)
    if (c.rates.length > 0) {
      L.push('', 'Cells with more than one sample, as rates:', '', `| Cell | ${base} | This round |`, '| --- | --- | --- |')
      for (const r of c.rates) L.push(`| \`${r.cell}\` | ${ofN(r.base)} | ${ofN(r.now)} |`)
    }

    const { sampleOne: s1, baseSampleOne: b1, all, base: b } = o.against.tallies
    const cols = [s1, b1, all, b]
    const row = (label: string, f: (x: Tally) => string | number): void => void L.push(`| ${label} |${cols.map((x) => ` ${f(x)} |`).join('')}`)
    const union = (f: (x: Tally) => Record<string, unknown>): string[] => [...new Set(cols.flatMap((x) => Object.keys(f(x))))].sort()
    const head = `| Sample 1 | ${base} sample 1 | All samples | ${base} all |`
    L.push('', `## Trace tallies against ${base}, same cells`, '', `The ${base} columns read its runs in this round's cells; sample 1 compares with sample 1, all with all.`, '')
    L.push(`| Measure ${head}`, '| --- | --- | --- | --- | --- |')
    row('Turns', (x) => x.turns)
    for (const k of union((x) => x.outcomes)) row(`Turns, outcome ${k}`, (x) => x.outcomes[k] ?? 0)
    row('String `messages` rounds', (x) => x.stringMessages)
    for (const k of union((x) => x.repairs)) row(`Reply-only repairs, ${k}`, (x) => (x.repairs[k] === undefined ? '0 of 0' : `${x.repairs[k].replyOnly} of ${x.repairs[k].repairs}`))
    for (const k of union((x) => x.failedRounds)) row(`Failed rounds, ${k}`, (x) => x.failedRounds[k] ?? 0)
    for (const k of union((x) => x.failureCodes)) row(`Turns with ${k}`, (x) => x.failureCodes[k] ?? 0)

    const turnsOf = (x: Tally, agent: string, id: string): number => x.retrieval.find((r) => r.agent === agent && r.exemplar === id)?.turns ?? 0
    const ids = [...new Set(cols.flatMap((x) => x.retrieval.map((r) => `${r.agent}\u0000${r.exemplar}`)))].sort().map((k) => k.split('\u0000'))
    const moved = ids.filter(([a, id]) => turnsOf(s1, a, id) !== turnsOf(b1, a, id) || turnsOf(all, a, id) !== turnsOf(b, a, id))
    L.push('', `## Exemplar retrieval against ${base}, same cells`, '', 'Turns retrieving each exemplar, the rows whose count moved sample 1 to sample 1 or all to all.', '')
    if (moved.length === 0) L.push('None moved.')
    else {
      L.push(`| Persona | Exemplar ${head}`, '| --- | --- | --- | --- | --- | --- |')
      for (const [a, id] of moved) L.push(`| ${a || '(none)'} | \`${id}\` |${cols.map((x) => ` ${turnsOf(x, a, id)} |`).join('')}`)
    }
  }
  if (o.gate !== undefined) {
    L.push('', '## Gates', '')
    if (o.gate.misses.length === 0) L.push('Every gated cell met its floor and delta.')
    for (const m of o.gate.misses) L.push(`- MISS \`${m.cell}\`: ${m.reason}`)
    if (o.gate.ungated.length > 0) L.push(`- Not gated (too few samples): ${o.gate.ungated.map((k) => `\`${k}\``).join(', ')}`)
  }
  return `${L.join('\n')}\n`
}

/** Write `signals.md` into a round folder, the round alone; returns its path. */
export function writeSignals(roundDir: string): string {
  const file = join(roundDir, 'signals.md')
  writeFileSync(file, renderSignals(readRound(roundDir), { rounds: [basename(roundDir)] }))
  return file
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
export const FLOOR_TAGS = ['regression', 'routing', 'long', 'other', 'all'] as const
const VALUE_FLAGS = ['--round', '--against', '--floor', '--max-drop', '--min-samples', '--rounds-dir']
const BARE_FLAGS = ['--all', '--json']
const USAGE = 'usage: npm run eval:signals -- (--round <folder> [--round <folder>]... | --all) [--against <folder>] [--floor <tag>=<rate>]... [--max-drop <delta>] [--min-samples <n>] [--rounds-dir <dir>] [--json]\n'

/** The CLI; returns the exit code. */
export function main(argv: string[], write: (s: string) => void = (s) => void process.stdout.write(s)): number {
  const fail = (msg: string): number => {
    process.stderr.write(`${msg}\n${USAGE}`)
    return 2
  }
  const values = (flag: string): string[] => argv.flatMap((a, i) => (a === flag && argv[i + 1] !== undefined ? [argv[i + 1]] : []))
  const one = (flag: string): string | undefined => values(flag).at(-1)
  for (let i = 0; i < argv.length; i += 1) {
    if (VALUE_FLAGS.includes(argv[i])) {
      if (argv[i + 1] === undefined || argv[i + 1].startsWith('--')) return fail(`${argv[i]} needs a value`)
      i += 1
    } else if (!BARE_FLAGS.includes(argv[i])) return fail(argv[i].startsWith('--') ? `unknown flag ${argv[i]}` : `unexpected argument ${argv[i]} (one value per --round; repeat the flag)`)
  }
  const roundsDir = one('--rounds-dir') ?? join(ROOT, EVALS_ROUNDS)
  const locate = (r: string): string | undefined => [isAbsolute(r) ? r : join(roundsDir, r), resolve(r)].find((p) => existsSync(p))

  const names = argv.includes('--all') && existsSync(roundsDir) ? readdirSync(roundsDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort() : values('--round')
  if (names.length === 0) return fail('name at least one --round, or --all')
  const dirs: string[] = []
  for (const n of names) {
    const d = locate(n)
    if (d === undefined) return fail(`no round folder ${n} under ${roundsDir}`)
    dirs.push(d)
  }
  const floors: Record<string, number> = {}
  for (const f of values('--floor')) {
    const m = /^([a-z]+)=(0(?:\.\d+)?|1(?:\.0+)?)$/.exec(f)
    if (m === null) return fail(`--floor takes <tag>=<rate between 0 and 1>, got ${f}`)
    if (!(FLOOR_TAGS as readonly string[]).includes(m[1])) return fail(`--floor tag ${m[1]} is not one of ${FLOOR_TAGS.join(', ')}`)
    floors[m[1]] = Number(m[2])
  }
  const num = (flag: string, fallback?: number): number | undefined | null => {
    const v = one(flag)
    if (v === undefined) return fallback
    return Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : null
  }
  const maxDrop = num('--max-drop')
  const minSamples = num('--min-samples', 3)
  if (maxDrop === null || minSamples === null || minSamples === undefined) return fail('--max-drop and --min-samples take a non-negative number')

  const current = readRounds(dirs)
  if (current.length === 0) return fail(`no runs in ${names.join(', ')}`)
  const againstName = one('--against')
  let base: SignalRun[] | undefined
  if (againstName !== undefined) {
    const d = locate(againstName)
    if (d === undefined) return fail(`no round folder ${againstName} under ${roundsDir}`)
    base = readRound(d)
  }
  const gated = Object.keys(floors).length > 0 || maxDrop !== undefined
  const g = gated ? gate(current, base, { floors, maxDrop, minSamples }) : undefined
  const s = aggregate(current)
  const vs = base !== undefined ? against(basename(locate(againstName!)!), base, current, s.tally) : undefined
  const rounds = dirs.map((d) => basename(d))
  if (argv.includes('--json')) write(`${JSON.stringify({ ...s, rounds, ...(vs ? { against: vs } : {}), ...(g ? { gate: g } : {}) }, null, 2)}\n`)
  else write(renderSignals(current, { rounds, signals: s, against: vs, gate: g }))
  return g !== undefined && g.misses.length > 0 ? 1 : 0
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(main(process.argv.slice(2)))
