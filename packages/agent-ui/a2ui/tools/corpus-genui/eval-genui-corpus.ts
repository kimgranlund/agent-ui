// eval-genui-corpus.ts — LLD-C4 (GH #1584, genui-b3-judged-eval.lld.md §4): the ONE CLI, five legs
// (`collect` · `generate` · `judge` · `apply` · `report`) — the only writer of `corpus-genui/`.
//
// Run via Node type-stripping from the repo root (the `tools/corpus/rescore.ts` run path):
//
//   node --experimental-strip-types packages/agent-ui/a2ui/tools/corpus-genui/eval-genui-corpus.ts <leg> [flags]
//   npm run eval:genui-corpus -- <leg> [flags]
//
// Exit codes (LLD §4): 0 every leg green · 1 any red, each listed · 2 setup failure (no key on a key
// leg, unknown model, unreadable rubric/data dir, a bad flag combination). `--dry-run` on every leg
// computes and prints, writes nothing. `--help` lists the legs with their side.
//
// THE KEY BOUNDARY (LLD §0): this file is the ONE place that ever constructs the real `anthropicProvider`
// — `generate`/`judge`'s own leg modules never read `process.env` or a key themselves; they take
// `deps.provider: AgentProvider` as a plain parameter, so a test drives them through a stub and the real
// adapter is reached ONLY through this CLI's key-bearing arm (never in a test).

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { anthropicProvider } from '../../src/agent/providers/anthropic.ts'
import { resolvePair, validateProvidersConfig } from '../agent/providers-config.ts'
import type { ProvidersConfig } from '../agent/providers-config.ts'
import { readAnthropicApiKey } from './fs.ts'
import { runCollectLeg } from './legs/collect.ts'
import { runGenerateLeg } from './legs/generate.ts'
import { runJudgeLeg } from './legs/judge.ts'
import { runApplyLeg } from './legs/apply.ts'
import { runReportLeg } from './legs/report.ts'

declare const process: { argv: string[]; cwd(): string; env: Record<string, string | undefined>; exit(code: number): never }
declare const console: { log(...args: unknown[]): void; error(...args: unknown[]): void }

const PROVIDERS_CONFIG_PATH = 'packages/agent-ui/a2ui/tools/agent/providers.json'

const LEGS = [
  { name: 'collect', side: 'KEYLESS' },
  { name: 'generate', side: 'NEEDS KEY' },
  { name: 'judge', side: 'NEEDS KEY' },
  { name: 'apply', side: 'KEYLESS' },
  { name: 'report', side: 'KEYLESS' },
] as const

/** Exported for the CLI-entry test (n4a) to assert on the printed shape without spawning a process. */
export function helpText(): string {
  const lines = [
    'eval-genui-corpus — the GenUI B3 judged pack-idiom eval CLI (GH #1584)',
    '',
    'usage: npm run eval:genui-corpus -- <leg> [flags]',
    '',
    ...LEGS.map((leg) => `  ${leg.name.padEnd(10)} ${leg.side}`),
    '',
    'every leg accepts --dry-run (compute + print, write nothing)',
    'every leg accepts --repo-root <dir> (the tree read/written + whose .env supplies the key; default: cwd)',
    '  collect  --from <dir|file> [--pack <id> --prompt <id> | --unpinned]',
    '  generate [--model <id>] [--only-pack <id>] [--only-prompt <id>] [--control] [--dogfood] [--runs N]',
    '  judge    [--judge-model <id>] [--only <name>] [--calibrate] [--out <path>]',
    '  apply    --verdicts <path>',
    '  report   [--require-m3]',
  ]
  return lines.join('\n')
}

function flagValue(argv: readonly string[], name: string): string | undefined {
  const idx = argv.indexOf(`--${name}`)
  return idx === -1 ? undefined : argv[idx + 1]
}
function hasFlag(argv: readonly string[], name: string): boolean {
  return argv.includes(`--${name}`)
}

function loadProvidersConfig(repoRoot: string): ProvidersConfig {
  const cfg = JSON.parse(readFileSync(join(repoRoot, PROVIDERS_CONFIG_PATH), 'utf8') as string) as ProvidersConfig
  validateProvidersConfig(cfg)
  return cfg
}

/** The whole CLI dispatch, factored out of `main()` so the CLI-entry test can drive it directly (in
 *  addition to the child-process AC7 proof) without a real subprocess for the fast leg-by-leg cases. */
export async function runCli(argv: readonly string[], repoRoot: string, env: Record<string, string | undefined>): Promise<number> {
  const leg = argv[0]
  if (leg === undefined || leg === '--help' || hasFlag(argv, 'help')) {
    console.log(helpText())
    return 0
  }

  const rest = argv.slice(1)
  const dryRun = hasFlag(rest, 'dry-run')

  if (leg === 'collect') {
    const result = await runCollectLeg(repoRoot, {
      from: flagValue(rest, 'from'),
      pack: flagValue(rest, 'pack'),
      prompt: flagValue(rest, 'prompt'),
      unpinned: hasFlag(rest, 'unpinned'),
      dryRun,
    })
    if (!result.ok) {
      console.error(`collect: ${result.setupError}`)
      return 2
    }
    if (result.promptCount !== undefined) {
      console.log(`collect: no --from given — ${result.promptCount} prompt(s) in prompts.json, nothing to collect`)
      return 0
    }
    console.log(`collect: ${result.written.length} written, ${result.dups.length} dup(s) skipped, ${result.wireFailures.length} wire failure(s)`)
    for (const wf of result.wireFailures) console.error(`  E_WIRE: ${wf.line.slice(0, 200)}`)
    return result.wireFailures.length > 0 ? 1 : 0
  }

  if (leg === 'generate' || leg === 'judge') {
    const providersConfig = loadProvidersConfig(repoRoot)
    const anthropicEntry = providersConfig.providers.anthropic
    if (anthropicEntry === undefined) {
      console.error(`${leg}: providers.json carries no "anthropic" entry`)
      return 2
    }
    const modelFlag = flagValue(rest, leg === 'generate' ? 'model' : 'judge-model')
    const model = modelFlag ?? anthropicEntry.defaultModel
    const resolved = resolvePair(providersConfig, 'anthropic', model)
    if (!resolved.ok) {
      console.error(`${leg}: unknown model "${model}" (${resolved.reason}) — writing nothing.`)
      return 2
    }
    const apiKey = readAnthropicApiKey(repoRoot, env)
    if (apiKey === undefined) {
      console.error(`${leg}: no ANTHROPIC_API_KEY found (process.env or repo-root .env) — aborting, not faking a result, writing nothing.`)
      return 2
    }
    const provider = anthropicProvider({ apiKey, endpoint: resolved.entry.endpoint })

    if (leg === 'generate') {
      const runsFlag = flagValue(rest, 'runs')
      const result = await runGenerateLeg(
        repoRoot,
        model,
        {
          onlyPack: flagValue(rest, 'only-pack'),
          onlyPrompt: flagValue(rest, 'only-prompt'),
          control: hasFlag(rest, 'control'),
          dogfood: hasFlag(rest, 'dogfood'),
          runs: runsFlag !== undefined ? Number(runsFlag) : undefined,
          dryRun,
        },
        { provider },
      )
      console.log(`generate: ${result.written.length} written, ${result.misses.length} miss(es)`)
      for (const m of result.misses) console.error(`  miss: promptId=${m.promptId} packId=${m.packId ?? 'control'} run=${m.runIndex}: ${m.reason}`)
      return result.misses.length > 0 ? 1 : 0
    }

    const result = await runJudgeLeg(
      repoRoot,
      model,
      { only: flagValue(rest, 'only'), calibrate: hasFlag(rest, 'calibrate'), out: flagValue(rest, 'out'), dryRun },
      { provider },
    )
    if (result.calibration !== undefined) {
      console.log(`judge --calibrate: ${result.calibration.length} record(s) scored twice`)
      for (const row of result.calibration) console.log(`  ${row.name}: maxDelta=${row.maxDelta}`)
      return result.ok ? 0 : 1
    }
    if (dryRun) {
      console.log(`judge --dry-run: ${result.pendingCount ?? 0} pending record(s), would write ${result.outPath}`)
      return 0
    }
    console.log(`judge: ${Object.keys(result.verdicts).length} verdict(s), ${result.parseFailures.length} parse failure(s)`)
    for (const f of result.parseFailures) console.error(`  E_JUDGE_PARSE: ${f.name}`)
    if (result.archiveOutcome === 'conflict') {
      console.error(`  archive conflict at ${result.outPath} (existing ${result.conflict?.existingHash} != incoming ${result.conflict?.incomingHash})`)
      return 2
    }
    return result.parseFailures.length > 0 ? 1 : 0
  }

  if (leg === 'apply') {
    const verdictsPath = flagValue(rest, 'verdicts')
    if (verdictsPath === undefined) {
      console.error('apply: usage: apply --verdicts <path>')
      return 2
    }
    const result = await runApplyLeg(repoRoot, { verdictsPath, dryRun })
    if (!result.ok) {
      console.error(`apply: HALTED — ${result.issues.length} issue(s), nothing written:`)
      for (const issue of result.issues) console.error(`  - ${issue}`)
      return 1
    }
    console.log(`apply: ${result.updated.length} updated, ${result.noops.length} no-op(s)`)
    return 0
  }

  if (leg === 'report') {
    const result = runReportLeg(repoRoot, { requireM3: hasFlag(rest, 'require-m3'), dryRun })
    console.log(result.summary)
    return result.ok ? 0 : 1
  }

  console.error(`eval-genui-corpus: unknown leg "${leg}"`)
  console.log(helpText())
  return 2
}

async function main(): Promise<void> {
  // `--repo-root <dir>`: the tree every leg reads/writes AND whose `.env` backs the key lookup — the one
  // seam that lets the CLI-entry test (n4a) spawn the literal invocation at the REAL cwd (which
  // `produce.ts`'s import chain needs at module load) while proving the no-key arm against a temp root
  // that carries no `.env` (GH #1592: a dev host's git-ignored repo-root `.env` otherwise supplies a key
  // and the "no key" proof makes a live provider call).
  const argv = process.argv.slice(2)
  const repoRoot = flagValue(argv, 'repo-root') ?? process.cwd()
  const code = await runCli(argv, repoRoot, process.env)
  process.exit(code)
}

// CLI-entry guard (the `import-seeds.ts` precedent, GH #335/#343) — `main()` fires only when THIS file
// is the process entry, never on import (so the tools test can import `runCli`/leg modules directly).
if (process.argv[1]?.endsWith('eval-genui-corpus.ts')) {
  void main()
}
