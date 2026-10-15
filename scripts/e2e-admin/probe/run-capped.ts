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

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

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

/** The estimated USD of trace lines (JSONL text) whose `at` is at or after `since` (ISO). Bad lines are skipped. */
export function estimateSpend(jsonl: string, since = ''): number {
  let total = 0
  for (const line of jsonl.split('\n')) {
    if (line.trim() === '') continue
    let d: { at?: unknown; model?: unknown; usage?: TraceUsage }
    try {
      d = JSON.parse(line)
    } catch {
      continue
    }
    if (since !== '' && (typeof d.at !== 'string' || d.at < since)) continue
    const u = d.usage ?? {}
    const model = String(d.model ?? '')
    const [inPrice, outPrice] = PRICES[Object.keys(PRICES).find((k) => model.includes(k)) ?? FALLBACK]
    const input = (u.inputTokens ?? 0) + (u.cacheReadInputTokens ?? 0) + 1.25 * (u.cacheCreationInputTokens ?? 0)
    total += (input * inPrice + (u.outputTokens ?? 0) * outPrice) / 1e6
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
  const todo = o.commands.filter((c) => !o.done(c.out))
  const skipped = o.commands.length - todo.length
  let ran = 0
  for (const c of todo.slice(0, o.max ?? todo.length)) {
    const before = o.spend()
    if (before >= o.cap) {
      log(`CAP reached at $${before.toFixed(2)} after ${ran}/${todo.length} runs`)
      return { ran, skipped, capped: true, spend: before }
    }
    const rc = o.exec(c.cmd)
    ran += 1
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
  const dry = argv.includes('--dry-run')
  const since = dry ? new Date().toISOString() : roundStart(join(root, runsDir, '.capped-start'))
  const result = runCapped({
    commands,
    cap,
    spend: () => traceSpend(root, since),
    exec: (cmd) => (dry ? 0 : (spawnSync(cmd, { shell: true, cwd: root, stdio: 'inherit' }).status ?? 1)),
    done: (out) => existsSync(join(root, out, 'report.json')),
    max: flag('--max') !== undefined ? Number(flag('--max')) : undefined,
    log: (line) => process.stdout.write(`${line}\n`),
  })
  return result.capped ? 3 : 0
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(main(process.argv.slice(2)))
