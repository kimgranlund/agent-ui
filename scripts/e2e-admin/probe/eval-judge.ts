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
//                                under its rubric's threshold and every good case at or over it. Prints each
//                                criterion's score, reason and quotes (found or not), and the cost.
//                                Writes nothing. A manual measurement, never a gate.
//   run --round <folder> [--only <run substring>] [--cap <usd>] [--dry-run] [--repo-root <dir>] [--rounds-dir <dir>]
//                                NEEDS KEY (not with --dry-run). Judges every run of the round whose persona has a
//                                rubric and has no judged file yet, writing `judged/<name>.json` in the round folder
//                                (a new file only; no file already in the round is rewritten); `--dry-run` lists them
//                                and spends nothing.
//
// The cap (default $5) is checked before each call against an overestimate of that call (the prompt at three chars a
// token, the reply at the `max_tokens` the adapter sends), so a run stops before the call the remaining budget cannot
// cover. A provider error leaves its run unjudged and the next run goes on; a second error in a row stops. Every run
// ends with its spend, judged, remaining and error counts. Exit codes: 0 green, 1 a calibration miss, a parse
// failure, a provider error or a cap stop, 2 setup (unknown command or flag, no key, a bad rubric or calibration citation, an unknown round).
//
// THE KEY BOUNDARY: this file is the ONE module in `scripts/e2e-admin/` that reads the key or builds the real
// provider adapter, and only in the keyed arms (`selftest`, `run`). `judge.ts` takes `provider` as a parameter.
// `--repo-root` redirects only the `.env` lookup (a lane worktree has no `.env`).

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AgentProvider } from '../../../packages/agent-ui/a2ui/src/agent/agent-transport.ts'
import { anthropicProvider, buildRequestBody } from '../../../packages/agent-ui/a2ui/src/agent/providers/anthropic.ts'
import { resolvePair, validateProvidersConfig, type ProvidersConfig } from '../../../packages/agent-ui/a2ui/tools/agent/providers-config.ts'
import { readAnthropicApiKey, readAnthropicWorkspaceId } from '../../../packages/agent-ui/a2ui/tools/corpus-genui/fs.ts'
import { calibrated, JUDGE_MODEL, judgedPath, judgeRequest, judgeTranscript, loadCalibration, loadRubric, REPO_ROOT, RUBRICS_DIR, transcriptOf, writeJudge, type JudgeFile, type Rubric } from './judge.ts'
import { EVALS_ROUNDS, PRICES, modelFamily } from './ledger.ts'

const VALUE_FLAGS = ['--cap', '--repo-root', '--rounds-dir', '--round', '--only']
const BARE_FLAGS = ['--dry-run']
const USAGE = 'usage: npm run eval:judge -- check | selftest [--cap <usd>] | run --round <folder> [--only <run>] [--cap <usd>] [--dry-run]  (each also takes --rounds-dir <dir>; the keyed ones --repo-root <dir>)\n'
/** An overestimate of one judge call: the request's prompt at three chars a token in, and the reply at the
 *  `max_tokens` the Anthropic adapter actually sends for it out. */
export function estimate(rubric: Rubric, transcript: string): number {
  const req = judgeRequest(transcript, rubric)
  const body = buildRequestBody(req)
  const out = typeof body.max_tokens === 'number' ? body.max_tokens : 0
  const [i, o] = PRICES[modelFamily(JUDGE_MODEL)]
  const chars = req.system.length + req.messages.reduce((n, m) => n + m.content.length, 0)
  return ((chars / 3) * i + out * o) / 1e6
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

interface Tally {
  spent: number
  judged: number
  remaining: number
  errors: number
}

/** Judge each job under the cap; `onFile` gets each result. A provider error leaves its job unjudged and the next one
 *  goes on; a second error in a row stops. Prints the spend, judged, remaining and error counts however it ends. */
async function judgeAll(jobs: Job[], provider: AgentProvider, cap: number, write: (s: string) => void, onFile: (j: Job, r: Awaited<ReturnType<typeof judgeTranscript>>) => void): Promise<Tally> {
  const t: Tally = { spent: 0, judged: 0, remaining: jobs.length, errors: 0 }
  let inARow = 0
  for (const j of jobs) {
    const est = estimate(j.rubric, j.transcript)
    if (t.spent + est > cap) {
      write(`cap: the next call (est $${est.toFixed(4)}) would pass $${cap}\n`)
      break
    }
    let r: Awaited<ReturnType<typeof judgeTranscript>>
    try {
      r = await judgeTranscript(j.label, j.transcript, j.rubric, { provider })
    } catch (err) {
      // The call may have billed before it failed, so the estimate counts against the cap.
      t.spent += est
      t.remaining -= 1
      t.errors += 1
      inARow += 1
      write(`ERROR ${j.label}: unjudged, ${err instanceof Error ? err.message : String(err)}\n`)
      if (inARow >= 2) {
        write('stop: two provider errors in a row\n')
        break
      }
      continue
    }
    inARow = 0
    const cost = r.ok ? r.file.costUsd : r.costUsd
    t.spent += cost > 0 ? cost : est
    t.remaining -= 1
    if (r.ok) t.judged += 1
    onFile(j, r)
  }
  write(`spent $${t.spent.toFixed(4)} (estimated at list prices, cap $${cap}), judged ${t.judged}, remaining ${t.remaining}, errors ${t.errors}\n`)
  return t
}

/** Each criterion's score, verdict, reason and quotes, so a miss explains itself. */
export const explain = (f: JudgeFile): string =>
  f.criteria
    .map((c) => `    ${c.id} ${c.score} ${c.passed ? 'pass' : 'fail'}${c.supported ? '' : ' (unsupported evidence)'}: ${c.why}\n${c.evidence.map((e) => `      ${e.found ? 'found' : 'NOT FOUND'}: ${JSON.stringify(e.quote)}\n`).join('')}`)
    .join('')

const scores = (f: { criteria: Array<{ id: string; score: number }> }): string => f.criteria.map((c) => `${c.id} ${c.score}`).join(', ')

/** The CLI; returns the exit code. `deps.provider` stands in for the keyed adapter (tests only). */
export async function main(
  argv: string[],
  env: Record<string, string | undefined> = process.env,
  write: (s: string) => void = (s) => void process.stdout.write(s),
  deps: { provider?: AgentProvider } = {},
): Promise<number> {
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
    const provider = deps.provider ?? keyedProvider(repoRoot, env)
    if (typeof provider === 'string') return fail(`selftest: ${provider}`)
    const jobs: Job[] = cases.map((c) => {
      const runDir = join(roundsDir, c.round, 'runs', c.run)
      return { label: `${c.round}/${c.run}`, runDir, rubric: loadRubric(c.rubric)!, transcript: transcriptOf(JSON.parse(readFileSync(join(runDir, 'report.json'), 'utf8'))) }
    })
    let misses = 0
    let landed = 0
    const t = await judgeAll(jobs, provider, cap, write, (j, r) => {
      const c = cases[jobs.indexOf(j)]
      if (!r.ok) {
        misses += 1
        write(`PARSE ${c.expect} ${j.label}: the judge reply did not parse (${r.raw.slice(0, 200)})\n`)
        return
      }
      const ok = calibrated(c, r.file)
      if (ok) landed += 1
      else misses += 1
      write(`${ok ? 'ok  ' : 'MISS'} ${c.expect} ${c.rubric} ${j.label}: score ${r.file.score} (threshold ${r.file.threshold}; ${scores(r.file)})\n`)
      write(explain(r.file))
    })
    write(`eval:judge selftest: ${landed} of ${cases.length} calibrated, judge ${JUDGE_MODEL}, cost $${t.spent.toFixed(4)}\n`)
    return misses > 0 || t.remaining > 0 || t.errors > 0 ? 1 : 0
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
      if (rubric === undefined) continue
      if (existsSync(judgedPath(join(roundsDir, round), name))) {
        write(`already judged ${name}: ${judgedPath(join(roundsDir, round), name)} is kept, never rewritten\n`)
        continue
      }
      jobs.push({ label: name, runDir: join(runsDir, name), rubric, transcript: transcriptOf(report) })
    }
    if (jobs.length === 0) return fail(`no unjudged run in ${round}${only === undefined ? '' : ` matching ${only}`} has a persona rubric`)
    if (rest.includes('--dry-run')) {
      const est = jobs.reduce((s, j) => s + estimate(j.rubric, j.transcript), 0)
      write(`${jobs.map((j) => `would judge ${j.label} (${j.rubric.id} v${j.rubric.version})`).join('\n')}\n${jobs.length} runs, estimate $${est.toFixed(4)}, cap $${cap}\n`)
      return 0
    }
    const provider = deps.provider ?? keyedProvider(repoRoot, env)
    if (typeof provider === 'string') return fail(`run: ${provider}`)
    let parse = 0
    const t = await judgeAll(jobs, provider, cap, write, (j, r) => {
      if (!r.ok) {
        parse += 1
        write(`PARSE ${j.label}: the judge reply did not parse\n`)
        return
      }
      const { path } = writeJudge(join(roundsDir, round), r.file)
      write(`${r.file.passed ? 'pass' : 'fail'} ${j.label}: score ${r.file.score} (threshold ${r.file.threshold}; ${scores(r.file)}) -> ${path}\n`)
    })
    write(`eval:judge run: ${t.judged} of ${jobs.length} judged\n`)
    return parse > 0 || t.remaining > 0 || t.errors > 0 ? 1 : 0
  }
  return fail(cmd === undefined ? 'name a command' : `unknown command ${cmd}`)
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(await main(process.argv.slice(2)))
