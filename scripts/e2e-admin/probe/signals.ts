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
// `--against <folder>` prints the churn of every cell against that round, the baseline (CL-R9). Gates are opt-in:
// `--floor <tag>=<rate>` (tag regression, routing, long, other or all) and `--max-drop <delta>` exit 1 on a cell
// under its floor or one whose pass rate fell by more than the delta, reading per cell as `floorMet` does in
// `tools/corpus-genui/legs/report.ts`: a missing report counts as a fail, a baseline cell with zero samples now
// fails its floor and counts as a drop to 0, and a cell with fewer than `--min-samples` (default 3) samples on a side
// it is read from is reported, not gated. Rates compare with a 1e-9 slack, so a drop of exactly the delta passes.
//
// A cell is scenario x model family x effort. Its state for churn is pass only when every sample passed, so a mixed
// cell counts as a fail.

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
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
}

/** One trace line of a run (one agent turn), with the fields the tables read. */
export interface Turn {
  model: string
  outcome: string
  ms: number | null
  rounds: TraceRound[]
  failureCodes: string[]
  sections: Array<{ id: string; digest: string }>
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
  checks: Check[]
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
  const run = (name: string, siblings: string[], report: Record<string, unknown> | undefined, row: Record<string, unknown> | undefined): SignalRun => {
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
      checks: Array.isArray(report?.checks) ? (report.checks as Check[]) : [],
      costUsd: row === undefined ? null : typeof row.costUsd === 'number' ? row.costUsd : 0,
      turns,
    }
  }
  const ledger = join(dir, 'ledger.jsonl')
  if (existsSync(ledger)) {
    const rows = jsonLines(ledger).filter((row) => typeof row.out === 'string')
    const names = rows.map((row) => str(row.name) || basename(row.out as string))
    return rows.map((row, i) => run(names[i], names, readJson(join(dir, 'runs', basename(row.out as string), 'report.json')), row))
  }
  const runs = join(dir, 'runs')
  if (!existsSync(runs)) return []
  const names = readdirSync(runs, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(runs, e.name, 'report.json')))
    .map((e) => e.name)
    .sort()
  return names.map((name) => run(name, names, readJson(join(runs, name, 'report.json')), undefined))
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
  /** Turns per persona with no `routing.sections` (a halted turn carries none). */
  noSections: Record<string, number>
}

/** Nearest-rank percentile of a non-empty sorted list. */
const pct = (sorted: number[], p: number): number => sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)]

/** A turn is saved when it did not halt and shipped with no `*_UNCORRECTED` or SURFACE_DEGRADED code. */
const savedTurn = (t: Turn): boolean => t.outcome !== 'halt' && !t.failureCodes.some((c) => c.endsWith('_UNCORRECTED') || c === 'SURFACE_DEGRADED')

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

  // Fired counts failed rounds (a code once per round); extra USD is the cost of the repair round that answers a
  // failed round, split evenly across that round's codes.
  const retries = new Map<string, { code: string; fired: number; turns: number; saved: number; extraUsd: number }>()
  for (const t of runs.flatMap((r) => r.turns)) {
    const inTurn = new Set<string>()
    t.rounds.forEach((rd, i) => {
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
      }
    })
    for (const code of inTurn) {
      const x = retries.get(code)!
      x.turns += 1
      if (savedTurn(t)) x.saved += 1
    }
  }

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
    retries: [...retries.values()].sort((a, b) => b.fired - a.fired || byName<{ code: string }>((x) => x.code)(a, b)),
    spend,
    digests: [...digests.values()].sort(byName((d) => `${d.agent}\u0000${d.section}\u0000${d.digest}`)),
    noSections,
  }
}

export const TRANSITIONS = ['fail to pass', 'pass to fail', 'fail to fail', 'pass to pass'] as const
export type Transition = (typeof TRANSITIONS)[number]

export interface Churn {
  transitions: Record<Transition, string[]>
  /** Cells only in the current round. */
  added: string[]
  /** Cells only in the baseline. */
  gone: string[]
}

/** The churn of every cell from a baseline round to the current one. */
export function churn(base: SignalRun[], current: SignalRun[]): Churn {
  const state = (c: Cell): 'pass' | 'fail' => (c.pass === c.runs ? 'pass' : 'fail')
  const before = new Map(cellsOf(base).map((c) => [c.key, c]))
  const after = cellsOf(current)
  const transitions = Object.fromEntries(TRANSITIONS.map((t) => [t, [] as string[]])) as Record<Transition, string[]>
  for (const c of after) {
    const b = before.get(c.key)
    if (b !== undefined) transitions[`${state(b)} to ${state(c)}` as Transition].push(c.key)
  }
  const now = new Set(after.map((c) => c.key))
  return { transitions, added: after.filter((c) => !before.has(c.key)).map((c) => c.key), gone: [...before.keys()].filter((k) => !now.has(k)) }
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

export interface RenderOptions {
  rounds: string[]
  against?: { round: string; churn: Churn }
  gate?: { misses: GateMiss[]; ungated: string[] }
}

/** The signals of some runs as markdown; no timestamps, so a rewrite of the same round is byte-identical. */
export function renderSignals(runs: SignalRun[], o: RenderOptions): string {
  const s = aggregate(runs)
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

  if (o.against !== undefined) {
    const c = o.against.churn
    L.push('', `## Churn against ${o.against.round}`, '', 'A cell passes when every sample passed; a mixed cell or a run with no report counts as a fail.', '')
    L.push('| Transition | Count | Cells |', '| --- | --- | --- |')
    for (const t of TRANSITIONS) L.push(`| ${t} | ${c.transitions[t].length} | ${t === 'pass to pass' ? 'stable' : c.transitions[t].map((k) => `\`${k}\``).join(', ')} |`)
    if (c.added.length > 0) L.push(`| only in this round | ${c.added.length} | ${c.added.map((k) => `\`${k}\``).join(', ')} |`)
    if (c.gone.length > 0) L.push(`| only in ${o.against.round} | ${c.gone.length} | ${c.gone.map((k) => `\`${k}\``).join(', ')} |`)
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
  const against = base !== undefined ? { round: basename(locate(againstName!)!), churn: churn(base, current) } : undefined
  const rounds = dirs.map((d) => basename(d))
  if (argv.includes('--json')) write(`${JSON.stringify({ ...aggregate(current), rounds, ...(against ? { against } : {}), ...(g ? { gate: g } : {}) }, null, 2)}\n`)
  else write(renderSignals(current, { rounds, against, gate: g }))
  return g !== undefined && g.misses.length > 0 ? 1 : 0
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(main(process.argv.slice(2)))
