// scripts/e2e-admin/probe/eval-judge.ts: the `eval:judge` CLI (T-0178, SPEC CL-R8). Judged checks on committed round
// transcripts, scored by the pinned judge model against the persona rubrics in `probe/rubrics/`.
//
// usage: npm run eval:judge -- <cmd>
//
//   check [--rounds-dir <dir>]   KEYLESS. Parses every rubric and checks the calibration set: each cited run has a
//                                `report.json` of the rubric's persona, each rubric has a good and a bad case. Runs in
//                                `check:scripts`.
//   selftest [--cap <usd>] [--repo-root <dir>] [--rounds-dir <dir>]
//                                NEEDS KEY. Scores every calibration case; exits 0 only when every bad case lands
//                                under its rubric's threshold and every good case at or over it. Prints the cost.
//                                Writes nothing. A manual measurement, never a gate.
//   run --round <folder> [--only <run substring>] [--cap <usd>] [--dry-run] [--repo-root <dir>] [--rounds-dir <dir>]
//                                NEEDS KEY (not with --dry-run). Judges every run of the round whose persona has a
//                                rubric and writes `runs/<name>/judge.json`; `--dry-run` lists them and spends nothing.
//
// The cap (default $5) is checked before each call against an overestimate of that call, so a run stops before the
// call the remaining budget cannot cover. Exit codes: 0 green, 1 a calibration miss, a parse failure or a cap stop,
// 2 setup (unknown command or flag, no key, a bad rubric or calibration citation, an unknown round).
//
// THE KEY BOUNDARY: this file is the ONE module in `scripts/e2e-admin/` that reads the key or builds the real
// provider adapter, and only in the keyed arms (`selftest`, `run`). `judge.ts` takes `provider` as a parameter.
// `--repo-root` redirects only the `.env` lookup (a lane worktree has no `.env`).

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AgentProvider } from '../../../packages/agent-ui/a2ui/src/agent/agent-transport.ts'
import { anthropicProvider } from '../../../packages/agent-ui/a2ui/src/agent/providers/anthropic.ts'
import { resolvePair, validateProvidersConfig, type ProvidersConfig } from '../../../packages/agent-ui/a2ui/tools/agent/providers-config.ts'
import { readAnthropicApiKey, readAnthropicWorkspaceId } from '../../../packages/agent-ui/a2ui/tools/corpus-genui/fs.ts'
import { calibrated, JUDGE_MODEL, judgeTranscript, loadCalibration, loadRubric, REPO_ROOT, RUBRICS_DIR, transcriptOf, writeJudge, type Rubric } from './judge.ts'
import { EVALS_ROUNDS, PRICES, modelFamily } from './ledger.ts'

const VALUE_FLAGS = ['--cap', '--repo-root', '--rounds-dir', '--round', '--only']
const BARE_FLAGS = ['--dry-run']
const USAGE = 'usage: npm run eval:judge -- check | selftest [--cap <usd>] | run --round <folder> [--only <run>] [--cap <usd>] [--dry-run]  (each also takes --rounds-dir <dir>; the keyed ones --repo-root <dir>)\n'
const OUT_TOKENS = 2_000

/** An overestimate of one judge call: three chars a token in, the reply at its ceiling out. */
function estimate(rubric: Rubric, transcript: string): number {
  const [i, o] = PRICES[modelFamily(JUDGE_MODEL)]
  return ((rubric.body.length + transcript.length + 2_000) / 3 * i + OUT_TOKENS * o) / 1e6
}

function keyedProvider(repoRoot: string, env: Record<string, string | undefined>): AgentProvider | string {
  const cfg = JSON.parse(readFileSync(join(REPO_ROOT, 'packages/agent-ui/a2ui/tools/agent/providers.json'), 'utf8')) as ProvidersConfig
  validateProvidersConfig(cfg)
  const resolved = resolvePair(cfg, 'anthropic', JUDGE_MODEL)
  if (!resolved.ok) return `the pinned judge ${JUDGE_MODEL} is not in providers.json (${resolved.reason})`
  const apiKey = readAnthropicApiKey(repoRoot, env)
  if (apiKey === undefined) return 'no ANTHROPIC_API_KEY found (process env or --repo-root .env); aborting, not faking a result.'
  return anthropicProvider({ apiKey, endpoint: resolved.entry.endpoint, workspaceId: readAnthropicWorkspaceId(repoRoot, env) })
}

interface Job {
  label: string
  runDir: string
  rubric: Rubric
  transcript: string
}

/** Judge each job under the cap; `onFile` gets each result. Returns the spend and whether the cap stopped it. */
async function judgeAll(jobs: Job[], provider: AgentProvider, cap: number, write: (s: string) => void, onFile: (j: Job, r: Awaited<ReturnType<typeof judgeTranscript>>) => void): Promise<{ spent: number; stopped: number }> {
  let spent = 0
  for (let i = 0; i < jobs.length; i += 1) {
    const j = jobs[i]
    const est = estimate(j.rubric, j.transcript)
    if (spent + est > cap) {
      write(`cap: $${spent.toFixed(4)} spent, the next call (est $${est.toFixed(4)}) would pass $${cap}; ${jobs.length - i} left unjudged\n`)
      return { spent, stopped: jobs.length - i }
    }
    const r = await judgeTranscript(j.label, j.transcript, j.rubric, { provider })
    const cost = r.ok ? r.file.costUsd : r.costUsd
    spent += cost > 0 ? cost : est
    onFile(j, r)
  }
  return { spent, stopped: 0 }
}

const scores = (f: { criteria: Array<{ id: string; score: number }> }): string => f.criteria.map((c) => `${c.id} ${c.score}`).join(', ')

/** The CLI; returns the exit code. */
export async function main(argv: string[], env: Record<string, string | undefined> = process.env, write: (s: string) => void = (s) => void process.stdout.write(s)): Promise<number> {
  const fail = (msg: string): number => {
    process.stderr.write(`${msg}\n${USAGE}`)
    return 2
  }
  const [cmd, ...rest] = argv
  for (let i = 0; i < rest.length; i += 1) {
    if (VALUE_FLAGS.includes(rest[i])) {
      if (rest[i + 1] === undefined || rest[i + 1].startsWith('--')) return fail(`${rest[i]} needs a value`)
      i += 1
    } else if (!BARE_FLAGS.includes(rest[i])) return fail(rest[i].startsWith('--') ? `unknown flag ${rest[i]}` : `unexpected argument ${rest[i]}`)
  }
  const one = (flag: string): string | undefined => rest.flatMap((a, i) => (a === flag ? [rest[i + 1]] : [])).at(-1)
  const roundsDir = one('--rounds-dir') ?? join(REPO_ROOT, EVALS_ROUNDS)
  const repoRoot = one('--repo-root') ?? process.cwd()
  const cap = Number(one('--cap') ?? 5)
  if (!Number.isFinite(cap) || cap <= 0) return fail('--cap takes a positive number of USD')

  if (cmd === 'check' || cmd === 'selftest') {
    let rubrics: string[]
    try {
      rubrics = readdirSync(RUBRICS_DIR).filter((f) => f.endsWith('.md')).map((f) => loadRubric(f.slice(0, -3))!.id)
    } catch (err) {
      return fail(`rubric: ${err instanceof Error ? err.message : String(err)}`)
    }
    const { cases, problems } = loadCalibration(roundsDir)
    for (const r of rubrics) if (!cases.some((c) => c.rubric === r)) problems.push(`rubric ${r}: no calibration case`)
    if (problems.length > 0) return fail(`calibration: ${problems.length} problem(s):\n${problems.map((p) => `  ${p}`).join('\n')}`)
    if (cmd === 'check') {
      write(`eval:judge check: ${rubrics.length} rubrics (${rubrics.join(', ')}), ${cases.length} calibration cases, every citation resolves\n`)
      return 0
    }
    const provider = keyedProvider(repoRoot, env)
    if (typeof provider === 'string') return fail(`selftest: ${provider}`)
    const jobs: Job[] = cases.map((c) => {
      const runDir = join(roundsDir, c.round, 'runs', c.run)
      return { label: `${c.round}/${c.run}`, runDir, rubric: loadRubric(c.rubric)!, transcript: transcriptOf(JSON.parse(readFileSync(join(runDir, 'report.json'), 'utf8'))) }
    })
    let misses = 0
    let i = 0
    const { spent, stopped } = await judgeAll(jobs, provider, cap, write, (j, r) => {
      const c = cases[i++]
      if (!r.ok) {
        misses += 1
        write(`PARSE ${c.expect} ${j.label}: the judge reply did not parse (${r.raw.slice(0, 200)})\n`)
        return
      }
      const ok = calibrated(c, r.file)
      if (!ok) misses += 1
      write(`${ok ? 'ok  ' : 'MISS'} ${c.expect} ${c.rubric} ${j.label}: score ${r.file.score} (threshold ${r.file.threshold}; ${scores(r.file)})\n`)
    })
    write(`eval:judge selftest: ${cases.length - misses - stopped} of ${cases.length} calibrated, judge ${JUDGE_MODEL}, cost $${spent.toFixed(4)} (estimated at list prices, cap $${cap})\n`)
    return misses > 0 || stopped > 0 ? 1 : 0
  }

  if (cmd === 'run') {
    const round = one('--round')
    if (round === undefined) return fail('run needs --round <folder>')
    const runsDir = join(roundsDir, round, 'runs')
    if (!existsSync(runsDir)) return fail(`no round folder ${round} under ${roundsDir}`)
    const only = one('--only')
    const jobs: Job[] = []
    for (const name of readdirSync(runsDir).sort()) {
      const file = join(runsDir, name, 'report.json')
      if ((only !== undefined && !name.includes(only)) || !existsSync(file)) continue
      const report = JSON.parse(readFileSync(file, 'utf8')) as { agent?: string }
      const rubric = typeof report.agent === 'string' ? loadRubric(report.agent) : undefined
      if (rubric !== undefined) jobs.push({ label: name, runDir: join(runsDir, name), rubric, transcript: transcriptOf(report) })
    }
    if (jobs.length === 0) return fail(`no run in ${round}${only === undefined ? '' : ` matching ${only}`} has a persona rubric`)
    if (rest.includes('--dry-run')) {
      const est = jobs.reduce((s, j) => s + estimate(j.rubric, j.transcript), 0)
      write(`${jobs.map((j) => `would judge ${j.label} (${j.rubric.id} v${j.rubric.version})`).join('\n')}\n${jobs.length} runs, estimate $${est.toFixed(4)}, cap $${cap}\n`)
      return 0
    }
    const provider = keyedProvider(repoRoot, env)
    if (typeof provider === 'string') return fail(`run: ${provider}`)
    let parse = 0
    const { spent, stopped } = await judgeAll(jobs, provider, cap, write, (j, r) => {
      if (!r.ok) {
        parse += 1
        write(`PARSE ${j.label}: the judge reply did not parse\n`)
        return
      }
      writeJudge(j.runDir, r.file)
      write(`${r.file.passed ? 'pass' : 'fail'} ${j.label}: score ${r.file.score} (threshold ${r.file.threshold}; ${scores(r.file)})\n`)
    })
    write(`eval:judge run: ${jobs.length - parse - stopped} of ${jobs.length} judged, cost $${spent.toFixed(4)} (cap $${cap})\n`)
    return parse > 0 || stopped > 0 ? 1 : 0
  }
  return fail(cmd === undefined ? 'name a command' : `unknown command ${cmd}`)
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(await main(process.argv.slice(2)))
