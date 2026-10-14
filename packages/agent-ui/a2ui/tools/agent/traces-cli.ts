// traces-cli.ts (T-0151): `npm run traces` reads the dev proxy's trace log (`.agent-traces/*.jsonl`,
// written by `trace-log.ts`) and prints the last N turns as a short table, or one turn in full.
//
//   npm run traces                 the last 10 turns
//   npm run traces -- --last 30    the last 30 turns
//   npm run traces -- --full 1     the newest turn in full (the `#` column of the table)
//   npm run traces -- --dir <path> read another folder
//
// Exit 0 on a printed table or turn (an absent or empty log prints a note and exits 0), 1 when `--full`
// names a turn the log does not hold, 2 on a bad argument.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { TRACE_DIR_NAME, failedRoundSummary } from './trace-log.ts'
import type { AgentTraceLine } from './trace-log.ts'

declare const process: { argv: string[]; cwd(): string; exitCode?: number }

/** Every parsed line in `dir`, oldest first (day files sort by name, lines keep append order). */
export function readTraceLines(dir: string): AgentTraceLine[] {
  if (!existsSync(dir)) return []
  const out: AgentTraceLine[] = []
  for (const name of readdirSync(dir).filter((n) => n.endsWith('.jsonl')).sort()) {
    for (const raw of readFileSync(join(dir, name), 'utf8').split('\n')) {
      if (raw.trim() === '') continue
      try {
        out.push(JSON.parse(raw) as AgentTraceLine)
      } catch {
        // a torn last line (a crash mid-append) is skipped, never fatal
      }
    }
  }
  return out
}

function oneLine(text: string, width: number): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length <= width ? flat : `${flat.slice(0, width - 3)}...`
}

/** The first error, else the first warning, of a turn. */
export function firstIssue(line: AgentTraceLine): string {
  if (line.error !== undefined) return `${line.error.status !== undefined ? `${line.error.status} ` : ''}${line.error.message}`
  return line.warnings?.[0] ?? ''
}

function pad(text: string, width: number): string {
  return text.length >= width ? text.slice(0, width) : text + ' '.repeat(width - text.length)
}

/** The table of the last `count` turns, newest first; `#` is the number `--full` takes. */
export function formatTable(lines: readonly AgentTraceLine[], count: number): string {
  const rows = lines.slice(-count).reverse()
  const header = ['#', 'time (UTC)', 'route', 'agent', 'model', 'outcome', 'retries', 'ms', 'first error or warning']
  const body = rows.map((l, i) => [
    String(i + 1),
    l.at.slice(5, 19).replace('T', ' '),
    l.route,
    l.agent ?? '-',
    l.model,
    l.outcome,
    String(l.retries?.length ?? 0),
    String(l.ms),
    oneLine(firstIssue(l), 70),
  ])
  const widths = header.map((h, c) => Math.max(h.length, ...body.map((r) => r[c]!.length)))
  const render = (cells: string[]): string => cells.map((cell, c) => (c === cells.length - 1 ? cell : pad(cell, widths[c]!))).join('  ').trimEnd()
  return [render(header), ...body.map(render)].join('\n')
}

/** One turn in full: the request, each step, each retry and its failures, each round's raw output, the
 *  surface, usage, and the error with its upstream body. */
export function formatFull(l: AgentTraceLine): string {
  const out: string[] = []
  out.push(`${l.at}  ${l.route}  ${l.outcome}  ${l.ms} ms`)
  out.push(`agent: ${l.agent ?? '-'}  provider: ${l.provider}  model: ${l.model}${l.effort ? `  effort: ${l.effort}` : ''}${l.mode ? `  mode: ${l.mode}` : ''}${l.catalogId ? `  catalog: ${l.catalogId}` : ''}`)
  out.push('', 'user:', l.user)
  if (l.steps.length > 0) {
    out.push('', 'steps:')
    for (const s of l.steps) {
      const extra = [s.round !== undefined ? `round ${s.round}` : '', s.codes?.length ? `codes ${s.codes.join(',')}` : '', s.detail ? oneLine(s.detail, 80) : '']
        .filter(Boolean)
        .join('  ')
      out.push(`  +${s.ms}ms  ${s.stage}${extra ? `  ${extra}` : ''}`)
    }
  }
  if (l.retries.length > 0) {
    out.push('', 'retries:')
    for (const r of l.retries) {
      out.push(`  round ${r.round} after:`)
      for (const f of r.failures) out.push(`    ${f.code}${f.path ? ` at ${f.path}` : ''}${f.detail ? `: ${f.detail}` : ''}`)
    }
  }
  for (const r of l.rounds) {
    const usage = r.usage ? `, in ${r.usage.inputTokens} out ${r.usage.outputTokens}` : ''
    const thinking = r.thinking ? `, thinking ${r.thinking.deltas} deltas ${r.thinking.chars} chars` : ''
    out.push('', `round ${r.round} (${r.status ?? 'no verdict'}, ${r.ms} ms${usage}${thinking})${r.error ? `  error: ${r.error}` : ''}:`)
    if (r.status === 'failed') out.push(...failedRoundSummary(r).slice(1))
    if (r.text !== '') out.push(r.text)
    for (const t of r.tools) out.push(`  tool ${t.name}: ${JSON.stringify(t.input)}`)
  }
  const ops = Object.entries(l.surface.ops)
    .map(([op, n]) => `${op} ${n}`)
    .join(', ')
  const types = Object.entries(l.surface.types ?? {})
    .map(([type, n]) => `${type} ${n}`)
    .join(', ')
  out.push('', `surface: ${l.surface.lines} lines${ops ? ` (${ops})` : ''}, ${l.surface.components} components${types ? ` (types ${types})` : ''}${l.surface.surfaceIds.length ? `, ids ${l.surface.surfaceIds.join(', ')}` : ''}`)
  if (l.trace) out.push(`trace: rounds ${l.trace.rounds}, healed ${l.trace.healed}, failure codes ${l.trace.failureCodes.join(',') || '-'}${l.trace.promptChars !== undefined ? `, prompt ${l.trace.promptChars} chars${l.trace.promptOver ? ' (over budget)' : ''}` : ''}`)
  if (l.usage) out.push(`usage: in ${l.usage.inputTokens} out ${l.usage.outputTokens}${l.usage.cacheReadInputTokens !== undefined ? ` cache-read ${l.usage.cacheReadInputTokens}` : ''}`)
  if (l.reply !== undefined) out.push('', 'reply:', l.reply)
  if (l.warnings.length > 0) out.push('', 'warnings:', ...l.warnings.map((w) => `  ${w}`))
  if (l.error) {
    out.push('', `error: ${l.error.name}${l.error.status !== undefined ? ` (status ${l.error.status})` : ''}`, `  ${l.error.message}`)
    if (l.error.body !== undefined) out.push('  body:', `  ${l.error.body}`)
    for (const f of l.error.failures ?? []) out.push(`  ${f.code}${f.path ? ` at ${f.path}` : ''}${f.detail ? `: ${f.detail}` : ''}`)
  }
  return out.join('\n')
}

export function runCli(argv: readonly string[], io: { log: (text: string) => void; root?: string } = { log: console.log }): number {
  let count = 10
  let full: number | undefined
  let dir = join(io.root ?? process.cwd(), TRACE_DIR_NAME)
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!
    const next = argv[i + 1]
    const asCount = (v: string | undefined): number | undefined => (v !== undefined && /^\d+$/.test(v) && Number(v) > 0 ? Number(v) : undefined)
    if (arg === '--last' || arg === '-n') {
      const n = asCount(next)
      if (n === undefined) return usage(io, `${arg} takes a positive number`)
      count = n
      i++
    } else if (arg === '--full') {
      const n = asCount(next)
      if (n === undefined) return usage(io, '--full takes a positive turn number (1 is the newest)')
      full = n
      i++
    } else if (arg === '--dir') {
      if (next === undefined) return usage(io, '--dir takes a path')
      dir = next
      i++
    } else if (asCount(arg) !== undefined) {
      count = asCount(arg)!
    } else {
      return usage(io, `unknown argument ${arg}`)
    }
  }
  const lines = readTraceLines(dir)
  if (lines.length === 0) {
    io.log(`no agent traces in ${dir} (run a live turn under npm run dev; A2UI_AGENT_TRACES=0 turns the log off)`)
    return 0
  }
  if (full !== undefined) {
    const line = lines[lines.length - full]
    if (line === undefined) {
      io.log(`no turn #${full}: the log holds ${lines.length}`)
      return 1
    }
    io.log(formatFull(line))
    return 0
  }
  io.log(formatTable(lines, count))
  return 0
}

function usage(io: { log: (text: string) => void }, problem: string): number {
  io.log(`traces: ${problem}\nusage: npm run traces [-- --last <n>] [--full <n>] [--dir <path>]`)
  return 2
}

if (process.argv[1]?.endsWith('traces-cli.ts')) process.exitCode = runCli(process.argv.slice(2))
