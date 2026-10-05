// eval-agent-behavior.ts: the agent-behavior eval CLI (GH #1810). Scores producer turns on concept
// selection, negative selection against the `notFor` edges, repair from structured validator errors
// (first-pass versus eventual versus halt), plus a per-persona leg.
//
// Run from the repo root via Node type-stripping:
//
//   node --experimental-strip-types packages/agent-ui/a2ui/tools/agent-eval/eval-agent-behavior.ts <cmd>
//   npm run eval:agent-behavior -- <cmd>
//
//   selftest [--repo-root <dir>]   KEYLESS. Verifies the fixture pins, then runs every scripted turn in
//                                  fixtures/scripted-turns.json and compares it with its `expect`. Every
//                                  result line is labeled `scripted`: a scripted result is never a model
//                                  score. Runs in `check:scripts`.
//   live --leg selection|persona [--model <id>] [--only <case-id substring>] [--repo-root <dir>]
//                                  NEEDS KEY. Kim's named manual run against a real model, never a
//                                  standing gate.
//
// Exit codes: 0 all green, 1 any case or scripted expectation failed (or a pin problem), 2 setup failure
// (missing or unparseable fixture, unknown command or leg, unknown model, no key, an `--only` matching
// nothing).
//
// `--repo-root` redirects only the `.env` key lookup and the fixtures dir. `providers.json`, the catalogs
// and the sidecars always load from `process.cwd()`: `selection-guidance.ts` reads the sidecars from cwd
// at module load.
//
// Fixture pins (fork 4, Kim 2026-10-05): fixtures/pins.json pins the sha256 of every fixture's raw bytes.
// After a deliberate fixture edit, update its pin by hand in the SAME change:
//   shasum -a 256 packages/agent-ui/a2ui/tools/agent-eval/fixtures/<file>
//
// THE KEY BOUNDARY: this file is the ONE module in this dir that reads the key or builds the real
// provider adapter. Every other module takes `provider: AgentProvider` as a plain parameter. Nothing in
// this dir writes a file; there is no report artifact.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { anthropicProvider } from '../../src/agent/providers/anthropic.ts'
import type { AgentProvider } from '../../src/agent/agent-transport.ts'
import { retrieve } from '../../src/corpus/retrieve.ts'
import { resolvePair, validateProvidersConfig } from '../agent/providers-config.ts'
import type { ProvidersConfig } from '../agent/providers-config.ts'
import { readAnthropicApiKey, loadA2uiShard } from '../corpus-genui/fs.ts'
import { deriveSelectionCases, loadCaseCatalog, loadPersonaCases, parsePersonaCase } from './cases.ts'
import type { PersonaCase, SelectionCase } from './cases.ts'
import { observeTurn } from './observe.ts'
import type { ObserveDeps } from './observe.ts'
import { runPersonaLeg, runSelectionLeg } from './legs.ts'
import type { LegResult } from './legs.ts'
import { scriptedProvider } from './scripted.ts'
import { verifyPins } from './pins.ts'

const PROVIDERS_CONFIG_PATH = 'packages/agent-ui/a2ui/tools/agent/providers.json'
const FIXTURES_REL = 'packages/agent-ui/a2ui/tools/agent-eval/fixtures'
const FIXTURE_FILES = ['scripted-turns.json', 'persona-cases.json', 'pins.json'] as const

export function helpText(): string {
  return [
    'eval-agent-behavior: the agent-behavior eval CLI (GH #1810)',
    '',
    'usage: npm run eval:agent-behavior -- <command> [flags]',
    '',
    '  selftest [--repo-root <dir>]                 KEYLESS   pins + scripted turns (check:scripts)',
    '  live --leg selection|persona [--model <id>] [--only <case-id substring>] [--repo-root <dir>]',
    '                                               NEEDS KEY manual run against a real model',
    '',
    'exit codes: 0 green, 1 any failure, 2 setup failure',
  ].join('\n')
}

function flagValue(argv: readonly string[], name: string): string | undefined {
  const idx = argv.indexOf(`--${name}`)
  return idx === -1 ? undefined : argv[idx + 1]
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

interface ScriptedExpect {
  exitCode?: number
  names?: string
  outcome?: string
  rounds?: number
  failureCodes?: string[]
}

interface ScriptedTurn {
  id: string
  leg: 'selection' | 'persona' | 'repair'
  case: unknown
  rounds: string[]
  expect: ScriptedExpect
}

function parseScriptedTurns(doc: unknown): ScriptedTurn[] {
  if (!isObject(doc) || !Array.isArray(doc.turns)) throw new Error('scripted-turns.json must hold a "turns" array')
  return doc.turns.map((t: unknown, i: number) => {
    if (!isObject(t) || typeof t.id !== 'string') throw new Error(`scripted turn ${i} needs a string "id"`)
    if (t.leg !== 'selection' && t.leg !== 'persona' && t.leg !== 'repair') throw new Error(`scripted turn "${t.id}" has an unknown leg`)
    if (!Array.isArray(t.rounds) || t.rounds.length === 0 || !t.rounds.every((r) => typeof r === 'string')) {
      throw new Error(`scripted turn "${t.id}" needs a non-empty "rounds" string array`)
    }
    if (!isObject(t.case)) throw new Error(`scripted turn "${t.id}" needs a "case" object`)
    return { id: t.id, leg: t.leg, case: t.case, rounds: t.rounds as string[], expect: (isObject(t.expect) ? t.expect : {}) as ScriptedExpect }
  })
}

function asSelectionCase(raw: unknown, turnId: string): SelectionCase {
  const c = raw as Record<string, unknown>
  for (const key of ['id', 'source', 'catalogId', 'expectType', 'forbidType', 'why', 'prompt']) {
    if (typeof c[key] !== 'string') throw new Error(`scripted turn "${turnId}" selection case needs a string "${key}"`)
  }
  return c as unknown as SelectionCase
}

/** Run ONE scripted turn through its leg (or `observeTurn` for repair) and compare it with `expect`.
 *  Returns the mismatches (empty when it matches) plus a short "got" summary. */
export async function runScriptedTurn(turn: ScriptedTurn): Promise<{ mismatches: string[]; got: string }> {
  const deps: ObserveDeps = { provider: scriptedProvider(turn.rounds), retrieve: () => [] }
  const exp = turn.expect
  const mismatches: string[] = []
  if (turn.leg === 'repair') {
    const c = turn.case as Record<string, unknown>
    if (typeof c.catalogId !== 'string' || typeof c.prompt !== 'string') throw new Error(`scripted turn "${turn.id}" repair case needs "catalogId" and "prompt"`)
    const obs = await observeTurn({ catalog: loadCaseCatalog(c.catalogId), prompt: c.prompt }, deps)
    const codes = obs.failureCodes === null ? 'not-observed' : `[${obs.failureCodes.join(',')}]`
    if (exp.outcome !== undefined && obs.outcome !== exp.outcome) mismatches.push(`expected outcome ${exp.outcome} got ${obs.outcome}`)
    if (exp.rounds !== undefined && obs.rounds !== exp.rounds) mismatches.push(`expected rounds ${exp.rounds} got ${obs.rounds}`)
    if (exp.failureCodes !== undefined && JSON.stringify(obs.failureCodes) !== JSON.stringify(exp.failureCodes)) {
      mismatches.push(`expected failureCodes [${exp.failureCodes.join(',')}] got ${codes}`)
    }
    return { mismatches, got: `outcome ${obs.outcome}, rounds ${obs.rounds}, failureCodes ${codes}` }
  }
  const legCase = turn.leg === 'selection' ? asSelectionCase(turn.case, turn.id) : parsePersonaCase(turn.case)
  const result: LegResult =
    turn.leg === 'selection' ? await runSelectionLeg([legCase as SelectionCase], deps) : await runPersonaLeg([legCase as PersonaCase], deps)
  // Only the findings text between `FAIL <case id> ` and ` repair=` counts, matched as a whole word: the
  // case id (`agent-ui:Text->Code`) and the repair suffix (`failureCodes=`) both hold "Code", so matching
  // the whole line would pass vacuously.
  const failPrefix = `FAIL ${legCase.id} `
  const findings = result.lines
    .filter((l) => l.startsWith(failPrefix))
    .map((l) => l.slice(failPrefix.length).split(' repair=')[0]!)
  const names = exp.names !== undefined && findings.some((f) => new RegExp(`\\b${exp.names}\\b`).test(f))
  if (exp.exitCode !== undefined && result.exitCode !== exp.exitCode) mismatches.push(`expected exit ${exp.exitCode} got ${result.exitCode}`)
  if (exp.names !== undefined && !names) mismatches.push(`expected a failing finding naming ${exp.names}`)
  const named = names ? `, names ${exp.names}` : ''
  return { mismatches, got: `exit ${result.exitCode}${named}` }
}

function expectText(exp: ScriptedExpect): string {
  const parts: string[] = []
  if (exp.exitCode !== undefined) parts.push(`exit ${exp.exitCode}`)
  if (exp.names !== undefined) parts.push(`names ${exp.names}`)
  if (exp.outcome !== undefined) parts.push(`outcome ${exp.outcome}`)
  if (exp.rounds !== undefined) parts.push(`rounds ${exp.rounds}`)
  if (exp.failureCodes !== undefined) parts.push(`failureCodes [${exp.failureCodes.join(',')}]`)
  return parts.join(', ')
}

async function runSelftest(fixturesDir: string): Promise<number> {
  const docs: Record<string, unknown> = {}
  for (const file of FIXTURE_FILES) {
    try {
      docs[file] = JSON.parse(readFileSync(join(fixturesDir, file), 'utf8'))
    } catch (err) {
      console.error(`selftest: cannot read ${file} in ${fixturesDir} (${err instanceof Error ? err.message : String(err)})`)
      return 2
    }
  }
  let turns: ScriptedTurn[]
  try {
    turns = parseScriptedTurns(docs['scripted-turns.json'])
    loadPersonaCases(fixturesDir)
  } catch (err) {
    console.error(`selftest: ${err instanceof Error ? err.message : String(err)}`)
    return 2
  }

  const pins = verifyPins(fixturesDir)
  if (!pins.ok) {
    console.error(`selftest: ${pins.problems.length} fixture pin problem(s); update pins.json by hand with shasum -a 256 in the same change:`)
    for (const p of pins.problems) console.error(`  - ${p}`)
    return 1
  }

  let failed = 0
  for (const turn of turns) {
    let mismatches: string[]
    let got: string
    try {
      ;({ mismatches, got } = await runScriptedTurn(turn))
    } catch (err) {
      mismatches = [`error: ${err instanceof Error ? err.message : String(err)}`]
      got = 'an error'
    }
    if (mismatches.length > 0) failed += 1
    const verdict = mismatches.length > 0 ? 'FAIL' : 'PASS'
    const detail = mismatches.length > 0 ? `: ${mismatches.join('; ')}` : ''
    console.log(`scripted ${verdict} ${turn.id} expected ${expectText(turn.expect)} got ${got}${detail}`)
  }
  console.log(`scripted summary: ${turns.length} turn(s), ${failed} mismatch(es); pins ok`)
  return failed > 0 ? 1 : 0
}

function loadProvidersConfig(): ProvidersConfig {
  const cfg = JSON.parse(readFileSync(join(process.cwd(), PROVIDERS_CONFIG_PATH), 'utf8')) as ProvidersConfig
  validateProvidersConfig(cfg)
  return cfg
}

async function runLive(rest: readonly string[], repoRoot: string, fixturesDir: string, env: Record<string, string | undefined>): Promise<number> {
  const leg = flagValue(rest, 'leg')
  if (leg !== 'selection' && leg !== 'persona') {
    console.error(`live: --leg must be selection or persona${leg === undefined ? '' : ` (got "${leg}")`}`)
    return 2
  }
  let cfg: ProvidersConfig
  try {
    cfg = loadProvidersConfig()
  } catch (err) {
    console.error(`live: cannot load ${PROVIDERS_CONFIG_PATH} (${err instanceof Error ? err.message : String(err)})`)
    return 2
  }
  const entry = cfg.providers.anthropic
  if (entry === undefined) {
    console.error('live: providers.json carries no "anthropic" entry')
    return 2
  }
  const model = flagValue(rest, 'model') ?? entry.defaultModel
  const resolved = resolvePair(cfg, 'anthropic', model)
  if (!resolved.ok) {
    console.error(`live: unknown model "${model}" (${resolved.reason})`)
    return 2
  }
  const apiKey = readAnthropicApiKey(repoRoot, env)
  if (apiKey === undefined) {
    console.error('live: no ANTHROPIC_API_KEY found (process env or --repo-root .env); aborting, not faking a result.')
    return 2
  }
  const provider: AgentProvider = anthropicProvider({ apiKey, endpoint: resolved.entry.endpoint })

  const only = flagValue(rest, 'only')
  const shard = loadA2uiShard(process.cwd())
  const deps: ObserveDeps = { provider, retrieve: (q) => retrieve(shard, q), model }
  let result: LegResult
  if (leg === 'selection') {
    const cases = deriveSelectionCases().filter((c) => only === undefined || c.id.includes(only))
    if (cases.length === 0) {
      console.error(`live: --only "${only}" matches no selection case`)
      return 2
    }
    result = await runSelectionLeg(cases, deps)
  } else {
    let all: PersonaCase[]
    try {
      all = loadPersonaCases(fixturesDir)
    } catch (err) {
      console.error(`live: cannot read persona cases (${err instanceof Error ? err.message : String(err)})`)
      return 2
    }
    const cases = all.filter((c) => only === undefined || c.id.includes(only))
    if (cases.length === 0) {
      console.error(`live: --only "${only}" matches no persona case`)
      return 2
    }
    result = await runPersonaLeg(cases, deps)
  }
  for (const line of result.lines) console.log(`live model=${model} ${line}`)
  return result.exitCode
}

/** The whole CLI dispatch, factored out of `main()` so tests drive it without a subprocess. */
export async function runCli(argv: readonly string[], repoRoot: string, env: Record<string, string | undefined>): Promise<number> {
  const cmd = argv[0]
  if (cmd === undefined || cmd === '--help') {
    console.log(helpText())
    return 0
  }
  const fixturesDir = join(repoRoot, FIXTURES_REL)
  if (cmd === 'selftest') return runSelftest(fixturesDir)
  if (cmd === 'live') return runLive(argv.slice(1), repoRoot, fixturesDir, env)
  console.error(`eval-agent-behavior: unknown command "${cmd}"`)
  console.error(helpText())
  return 2
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2)
  const repoRoot = flagValue(argv, 'repo-root') ?? process.cwd()
  process.exit(await runCli(argv, repoRoot, process.env))
}

// CLI-entry guard (the `eval-genui-corpus.ts` precedent): `main()` fires only when this file is the
// process entry, never on import, so the vitest `tools` project can import `runCli`.
if (process.argv[1]?.endsWith('eval-agent-behavior.ts')) {
  void main()
}
