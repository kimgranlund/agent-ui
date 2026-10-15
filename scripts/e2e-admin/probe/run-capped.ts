// scripts/e2e-admin/probe/run-capped.ts: run a generated `live-commands.sh` one probe at a time and stop once the
// estimated spend reaches a cap (T-0225, ported from the T-0184 run's ad hoc script). Spend is read from the dev
// proxy's `.agent-traces/*.jsonl` usage at list prices, counting only turns since the round started: the start
// time is kept in `<runs dir>/.capped-start` so a restart after an interrupt keeps the same baseline. Cache reads
// are priced as input and cache writes at 1.25x input, an overestimate.
//
// usage: node --experimental-strip-types scripts/e2e-admin/probe/run-capped.ts <live-commands.sh> --cap <usd>
//          [--root <dir>] [--max <n>] [--dry-run]
//
// Runs go in file order (the generated script lists Haiku, then Sonnet, then Opus). A run whose `--out` folder
// already holds `report.json` is skipped. A probe that exits 1 (a failed check) does not stop the round.
//
// The round archives itself (T-0241): after every run and once more when the round ends, on a cap stop or a crash,
// the round folder (the one holding `runs/`) gets `traces/` (the `.agent-traces` lines inside the round window, per
// day file), `ledger.jsonl` (one row per run with its trace line ranges, tokens and estimated cost) and `round.json`
// (the manifest). Writing after every run is what survives a kill, since `spawnSync` blocks signal handlers.

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export const PRICES_SOURCE = 'claude-api skill price table, 2026-10-06'
/** USD per million tokens, input and output (claude-api skill price table, 2026-10-06). */
export const PRICES: Readonly<Record<string, readonly [number, number]>> = {
  haiku: [0.1, 0.5],
  sonnet: [2, 10],
  opus: [4, 20],
}
const FALLBACK = 'opus' // an unknown model is priced at the dearest family, never under-counted

interface TraceUsage {
  inputTokens?: number
  outputTokens?: number
  cacheReadInputTokens?: number
  cacheCreationInputTokens?: number
}

interface TraceLine {
  at?: unknown
  model?: unknown
  usage?: TraceUsage
}

export interface Tokens {
  input: number
  output: number
  cacheRead: number
  cacheCreation: number
}

const noTokens = (): Tokens => ({ input: 0, output: 0, cacheRead: 0, cacheCreation: 0 })

function parseLine(line: string): TraceLine | undefined {
  if (line.trim() === '') return undefined
  try {
    return JSON.parse(line) as TraceLine
  } catch {
    return undefined
  }
}

/** True when a trace line's `at` falls in [since, until]; an empty bound is open. */
function inWindow(d: TraceLine, since: string, until: string): boolean {
  if (since === '' && until === '') return true
  if (typeof d.at !== 'string') return false
  return (since === '' || d.at >= since) && (until === '' || d.at <= until)
}

/** The estimated USD of one trace line at the PRICES table. */
function lineCost(d: TraceLine): number {
  const u = d.usage ?? {}
  const model = String(d.model ?? '')
  const [inPrice, outPrice] = PRICES[Object.keys(PRICES).find((k) => model.includes(k)) ?? FALLBACK]
  const input = (u.inputTokens ?? 0) + (u.cacheReadInputTokens ?? 0) + 1.25 * (u.cacheCreationInputTokens ?? 0)
  return (input * inPrice + (u.outputTokens ?? 0) * outPrice) / 1e6
}

function addTokens(t: Tokens, u: TraceUsage = {}): void {
  t.input += u.inputTokens ?? 0
  t.output += u.outputTokens ?? 0
  t.cacheRead += u.cacheReadInputTokens ?? 0
  t.cacheCreation += u.cacheCreationInputTokens ?? 0
}

/** The estimated USD of trace lines (JSONL text) whose `at` is at or after `since` (ISO). Bad lines are skipped. */
export function estimateSpend(jsonl: string, since = '', until = ''): number {
  let total = 0
  for (const line of jsonl.split('\n')) {
    const d = parseLine(line)
    if (d !== undefined && inWindow(d, since, until)) total += lineCost(d)
  }
  return total
}

/** The estimated spend of every trace file under `<root>/.agent-traces` since `since`. */
export function traceSpend(root: string, since: string): number {
  const dir = join(root, '.agent-traces')
  if (!existsSync(dir)) return 0
  return readdirSync(dir)
    .filter((f) => f.endsWith('.jsonl'))
    .reduce((sum, f) => sum + estimateSpend(readFileSync(join(dir, f), 'utf8'), since), 0)
}

/** The probe commands of a `live-commands.sh`, in file order, with each one's `--out` folder. */
export function parseCommands(text: string): Array<{ cmd: string; out: string }> {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '' && !l.startsWith('#') && l.includes('chat:probe'))
    .map((cmd) => ({ cmd, out: /--out (\S+)/.exec(cmd)?.[1] ?? '' }))
}

export interface CappedOptions {
  commands: Array<{ cmd: string; out: string }>
  cap: number
  /** The round's spend so far. */
  spend: () => number
  /** Run one command; returns its exit code. */
  exec: (cmd: string) => number
  /** Called after each run with its start and end time (ISO) and exit code. */
  onRun?: (c: { cmd: string; out: string }, rc: number, startedAt: string, endedAt: string) => void
  now?: () => string
  /** True when a run's out folder already holds a report. */
  done: (out: string) => boolean
  max?: number
  log?: (line: string) => void
}

export interface CappedResult {
  ran: number
  skipped: number
  capped: boolean
  spend: number
}

/** Run the commands in order until the spend reaches the cap; a run already reported is skipped. */
export function runCapped(o: CappedOptions): CappedResult {
  const log = o.log ?? (() => {})
  const now = o.now ?? (() => new Date().toISOString())
  const todo = o.commands.filter((c) => !o.done(c.out))
  const skipped = o.commands.length - todo.length
  let ran = 0
  for (const c of todo.slice(0, o.max ?? todo.length)) {
    const before = o.spend()
    if (before >= o.cap) {
      log(`CAP reached at $${before.toFixed(2)} after ${ran}/${todo.length} runs`)
      return { ran, skipped, capped: true, spend: before }
    }
    const startedAt = now()
    const rc = o.exec(c.cmd)
    ran += 1
    o.onRun?.(c, rc, startedAt, now())
    log(`[${ran}/${todo.length}] rc=${rc} $${o.spend().toFixed(2)} :: ${c.out}`)
  }
  const spend = o.spend()
  log(`done ${ran}/${todo.length} runs (${skipped} already reported), estimated spend $${spend.toFixed(2)}`)
  return { ran, skipped, capped: false, spend }
}

/** The round's start time, written once beside the runs so a restart keeps the baseline. */
export function roundStart(stateFile: string, now: () => string = () => new Date().toISOString()): string {
  if (existsSync(stateFile)) return readFileSync(stateFile, 'utf8').trim()
  mkdirSync(dirname(stateFile), { recursive: true })
  const at = now()
  writeFileSync(stateFile, `${at}\n`)
  return at
}

/** One run as the runner saw it; the archive adds its trace ranges, tokens and cost. */
export interface RunRecord {
  out: string
  name: string
  scenario: string
  agent: string
  model: string
  startedAt: string
  endedAt: string
  exitCode: number
  /** The probe report's verdict, or null when the probe wrote no report (setup failure, crash). */
  verdict: 'pass' | 'fail' | null
}

/** The run record of one probe command; `verdict` is read by the caller from the run's report. */
export function runRecord(cmd: string, rc: number, startedAt: string, endedAt: string, verdict: RunRecord['verdict']): RunRecord {
  const flag = (n: string): string => new RegExp(`--${n} (?:"([^"]*)"|(\\S+))`).exec(cmd)?.slice(1).find((v) => v !== undefined) ?? ''
  const name = flag('name')
  return {
    out: flag('out'),
    name,
    scenario: name.replace(/-(haiku|sonnet|opus)-\d+$/, ''),
    agent: flag('agent'),
    model: flag('model'),
    startedAt,
    endedAt,
    exitCode: rc,
    verdict,
  }
}

export interface ArchiveOptions {
  /** The checkout whose `.agent-traces/` the dev proxy writes. */
  root: string
  /** The round folder (absolute), the parent of `runs/`. */
  roundDir: string
  since: string
  until: string
  /** This invocation's runs; rows already in `ledger.jsonl` from an earlier invocation are kept. */
  runs: RunRecord[]
  commit: string
  liveCommands: string
  cap: number
  stop: 'done' | 'cap' | 'crash'
}

/** A run's trace lines: 1-based, inclusive, in the archived day file. */
interface TraceRange {
  file: string
  from: number
  to: number
}

const SCREENSHOTS = 'runs/*/*.png'

/** Write the round's `traces/`, `ledger.jsonl` and `round.json`; safe to call again, each call rewrites all three. */
export function archiveRound(o: ArchiveOptions): { runs: number; tokens: Tokens; costUsd: number } {
  const traceDir = join(o.root, '.agent-traces')
  // Every in-window line, in day-file order, with its line number in the archived copy.
  const kept: Array<{ file: string; n: number; d: TraceLine }> = []
  mkdirSync(join(o.roundDir, 'traces'), { recursive: true })
  const days = existsSync(traceDir) ? readdirSync(traceDir).filter((f) => f.endsWith('.jsonl')).sort() : []
  for (const file of days) {
    const lines = readFileSync(join(traceDir, file), 'utf8').split('\n').filter((l) => {
      const d = parseLine(l)
      return d !== undefined && inWindow(d, o.since, o.until)
    })
    if (lines.length === 0) continue
    writeFileSync(join(o.roundDir, 'traces', file), `${lines.join('\n')}\n`)
    lines.forEach((l, i) => kept.push({ file, n: i + 1, d: parseLine(l) as TraceLine }))
  }

  const ledgerFile = join(o.roundDir, 'ledger.jsonl')
  const byOut = new Map<string, RunRecord>()
  if (existsSync(ledgerFile)) {
    for (const l of readFileSync(ledgerFile, 'utf8').split('\n')) {
      const row = parseLine(l) as (RunRecord & { at?: unknown }) | undefined
      if (row?.out !== undefined) byOut.set(row.out, runRecordOf(row))
    }
  }
  for (const r of o.runs) byOut.set(r.out, r)

  const totals = noTokens()
  let costUsd = 0
  const rows = [...byOut.values()]
    .sort((a, b) => (a.startedAt < b.startedAt ? -1 : 1))
    .map((r) => {
      const tokens = noTokens()
      let cost = 0
      const traces: TraceRange[] = []
      for (const k of kept) {
        if (!inWindow(k.d, r.startedAt, r.endedAt)) continue
        addTokens(tokens, k.d.usage)
        cost += lineCost(k.d)
        const file = `traces/${k.file}`
        const last = traces.at(-1)
        if (last?.file === file && last.to === k.n - 1) last.to = k.n
        else traces.push({ file, from: k.n, to: k.n })
      }
      addTokens(totals, { inputTokens: tokens.input, outputTokens: tokens.output, cacheReadInputTokens: tokens.cacheRead, cacheCreationInputTokens: tokens.cacheCreation })
      costUsd += cost
      return { ...r, traces, tokens, costUsd: Math.round(cost * 1e6) / 1e6 }
    })
  writeFileSync(ledgerFile, rows.map((r) => JSON.stringify(r)).join('\n') + (rows.length > 0 ? '\n' : ''))

  const ignore = join(o.roundDir, '.gitignore')
  const ignored = existsSync(ignore) ? readFileSync(ignore, 'utf8') : ''
  if (!ignored.split('\n').includes(SCREENSHOTS)) writeFileSync(ignore, `${ignored}${ignored === '' || ignored.endsWith('\n') ? '' : '\n'}${SCREENSHOTS}\n`)

  const round = {
    kind: 'live-round',
    commit: o.commit,
    liveCommands: o.liveCommands,
    cap: o.cap,
    stop: o.stop,
    window: { since: o.since, until: o.until },
    prices: { source: PRICES_SOURCE, table: PRICES, fallback: FALLBACK, note: 'USD per million tokens, input and output; cache reads priced as input, cache writes at 1.25x input' },
    totals: { runs: rows.length, traceLines: kept.length, tokens: totals, costUsd: Math.round(costUsd * 1e6) / 1e6 },
    files: {
      traces: 'traces/<day>.jsonl: the .agent-traces lines inside the window, same shape as the dev proxy log',
      ledger: 'ledger.jsonl: one row per run, traces as 1-based inclusive line ranges into traces/',
      runs: 'runs/<name>/: report.json and fixture.json, committed',
      screenshots: `${SCREENSHOTS}: kept on disk, out of git (the round's .gitignore)`,
    },
  }
  writeFileSync(join(o.roundDir, 'round.json'), `${JSON.stringify(round, null, 2)}\n`)
  return { runs: rows.length, tokens: totals, costUsd }
}

/** The RunRecord fields of a ledger row (drops the derived ones so they are recomputed). */
function runRecordOf(row: RunRecord): RunRecord {
  const { out, name, scenario, agent, model, startedAt, endedAt, exitCode, verdict } = row
  return { out, name, scenario, agent, model, startedAt, endedAt, exitCode, verdict }
}

export interface RoundOptions {
  root: string
  liveCommands: string
  commands: Array<{ cmd: string; out: string }>
  cap: number
  since: string
  exec: (cmd: string) => number
  commit: string
  max?: number
  log?: (line: string) => void
  now?: () => string
}

/** Run a round under the cap and archive it after every run and once more at the end, whatever stops it. */
export function runRound(o: RoundOptions): CappedResult {
  const now = o.now ?? (() => new Date().toISOString())
  const runsDir = o.commands[0]?.out ? dirname(o.commands[0].out) : dirname(o.liveCommands)
  const roundDir = join(o.root, o.commands[0]?.out ? dirname(runsDir) : runsDir)
  const runs: RunRecord[] = []
  const archive = (stop: ArchiveOptions['stop']): void => {
    archiveRound({ root: o.root, roundDir, since: o.since, until: now(), runs, commit: o.commit, liveCommands: o.liveCommands, cap: o.cap, stop })
  }
  let stop: ArchiveOptions['stop'] = 'crash'
  try {
    const result = runCapped({
      commands: o.commands,
      cap: o.cap,
      spend: () => traceSpend(o.root, o.since),
      exec: o.exec,
      done: (out) => existsSync(join(o.root, out, 'report.json')),
      max: o.max,
      log: o.log,
      now,
      onRun: (c, rc, startedAt, endedAt) => {
        runs.push(runRecord(c.cmd, rc, startedAt, endedAt, reportVerdict(join(o.root, c.out, 'report.json'))))
        archive('crash') // a kill before the final write leaves the round marked as not finished
      },
    })
    stop = result.capped ? 'cap' : 'done'
    return result
  } finally {
    archive(stop)
  }
}

function reportVerdict(file: string): RunRecord['verdict'] {
  try {
    const v = (JSON.parse(readFileSync(file, 'utf8')) as { verdict?: unknown }).verdict
    return v === 'pass' || v === 'fail' ? v : null
  } catch {
    return null
  }
}

function main(argv: string[]): number {
  const file = argv.find((a, i) => !a.startsWith('--') && !['--cap', '--root', '--max'].includes(argv[i - 1] ?? ''))
  const flag = (name: string): string | undefined => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined)
  const cap = Number(flag('--cap'))
  if (file === undefined || !Number.isFinite(cap) || cap <= 0) {
    process.stderr.write('usage: run-capped.ts <live-commands.sh> --cap <usd> [--root <dir>] [--max <n>] [--dry-run]\n')
    return 2
  }
  const root = flag('--root') ?? process.cwd()
  const commands = parseCommands(readFileSync(file, 'utf8'))
  const runsDir = commands[0]?.out ? dirname(commands[0].out) : dirname(file)
  const max = flag('--max') !== undefined ? Number(flag('--max')) : undefined
  const log = (line: string): void => void process.stdout.write(`${line}\n`)
  if (argv.includes('--dry-run')) {
    const since = new Date().toISOString()
    const result = runCapped({ commands, cap, spend: () => traceSpend(root, since), exec: () => 0, done: (out) => existsSync(join(root, out, 'report.json')), max, log })
    return result.capped ? 3 : 0
  }
  const result = runRound({
    root,
    liveCommands: file,
    commands,
    cap,
    since: roundStart(join(root, runsDir, '.capped-start')),
    exec: (cmd) => spawnSync(cmd, { shell: true, cwd: root, stdio: 'inherit' }).status ?? 1,
    commit: spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout?.trim() ?? '',
    max,
    log,
  })
  return result.capped ? 3 : 0
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(main(process.argv.slice(2)))
