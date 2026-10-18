// scripts/e2e-admin/probe/scenarios/plan.ts: plan a live round from scenario tags (T-0343), in place of a hand-written
// `roundN.ts`. Every scenario module's scenarios carry `tags` (`round.ts`); this file holds the registry of them all and
// prints the `live-commands.sh` for the selection:
//
// - smoke: one short scenario per roster preset (`<preset>.ts`), each step on the preset's signature composite.
// - regression: the four first presets' round scenarios with round 3's routing oracles (`regressionScenario`).
// - routing: the routing pressure pack (`routing.ts`).
// - long: every long flow (round 3's, then round 5's, which holds round 4's).
//
// A run is named `<scenario>-<model>-<n>`, where the scenario starts with its first tag's prefix (`smoke-<preset>-`,
// `regress-<preset>-`, `routing-`, `long-<preset>-`), the names rounds 3 to 10 used, so `signals.ts` reads the tag back
// and a smoke cell lines up across rounds. Each `--out` is `runs/<name>`: the capped runner's `--round` retargets it.
// Runs go by model (Haiku, Sonnet, Opus), then sample, then registry order, so a stop at the cap leaves the cheap
// cells and every scenario's first sample filled.
//
// usage: node --experimental-strip-types scripts/e2e-admin/probe/scenarios/plan.ts --tag <tag> [--tag <tag>]...
//          [--persona <preset id>]... [--model <haiku | sonnet | opus | model id>]... [--samples <n>] [--cap <usd>]
//          [--round <slug>]
// Prints the script; exit 2 on a usage problem or an empty selection. `--model` defaults to all three, `--samples` to
// 1; `--cap` and `--round` only fill in the runner line of the header. `--affected` (SPEC CL-R10) is refused: no
// committed round records the bundle digests it would compare against, so it is never approximated.
// `plan.test.mjs` pins the smoke plan.

import { stepArgv } from '../model.ts'
import { ADMIRAL_SMOKE } from './admiral.ts'
import { ALCHEMIST_SCENARIOS } from './alchemist.ts'
import { CONCIERGE_SMOKE } from './concierge.ts'
import { CROUPIER_SMOKE, quote } from './croupier.ts'
import { CURATOR_SCENARIOS } from './curator.ts'
import { DUNGEON_MASTER_SCENARIOS } from './dungeon-master.ts'
import { LEXICOGRAPHER_SMOKE } from './lexicographer.ts'
import { MENTALIST_SCENARIOS } from './mentalist.ts'
import { NEGOTIATOR_SCENARIOS } from './negotiator.ts'
import { QUANT_SCENARIOS } from './quant.ts'
import { QUIZMASTER_SCENARIOS } from './quizmaster.ts'
import { RESTAURANT_SCENARIOS } from './restaurant.ts'
import { ROUND_PRESETS, SCENARIO_TAGS, type RoundModel, type RoundScenario, type ScenarioTag } from './round.ts'
import { ROUND3_MODELS, regressionScenario } from './round3.ts'
import { ROUND6_LONG_FLOWS } from './round6.ts'
import { ROUTING_SCENARIOS } from './routing.ts'
import { SHOPKEEPER_SCENARIOS } from './shopkeeper.ts'
import { STYLIST_SCENARIOS } from './stylist.ts'
import { TRAVEL_SCENARIOS } from './travel.ts'

export const PLAN_FILE = 'scripts/e2e-admin/probe/scenarios/plan.ts'
export const PLAN_USAGE = `usage: node --experimental-strip-types ${PLAN_FILE} --tag <${SCENARIO_TAGS.join(' | ')}> [--tag ...] [--persona <preset id>]... [--model <haiku | sonnet | opus | model id>]... [--samples <n>] [--cap <usd>] [--round <slug>]`

/** The run-name prefix of a scenario's first tag. */
export const TAG_PREFIX: Readonly<Record<ScenarioTag, string>> = { smoke: 'smoke', regression: 'regress', routing: 'routing', long: 'long' }

/** One scenario of the registry with its preset and its run-name stem. */
export interface PlannedScenario {
  agent: string
  scenario: RoundScenario
  /** `<prefix>-<preset>-<scenario>`; a routing scenario keeps round 3's `routing-<scenario>`. */
  id: string
}

const planned = (agent: string, scenario: RoundScenario): PlannedScenario => {
  const tag = scenario.tags[0]
  if (tag === undefined) throw new Error(`scenario ${agent} ${scenario.name} has no tag`)
  return { agent, scenario, id: tag === 'routing' ? `routing-${scenario.name}` : `${TAG_PREFIX[tag]}-${agent}-${scenario.name}` }
}

/** The smoke scenarios by preset, in roster order (each persona file's `order`). */
export const SMOKE_PRESETS: ReadonlyArray<{ agent: string; scenarios: readonly RoundScenario[] }> = [
  { agent: 'croupier', scenarios: [CROUPIER_SMOKE] },
  { agent: 'quant', scenarios: QUANT_SCENARIOS },
  { agent: 'concierge', scenarios: [CONCIERGE_SMOKE] },
  { agent: 'restaurant', scenarios: RESTAURANT_SCENARIOS },
  { agent: 'travel', scenarios: TRAVEL_SCENARIOS },
  { agent: 'curator', scenarios: CURATOR_SCENARIOS },
  { agent: 'stylist', scenarios: STYLIST_SCENARIOS },
  { agent: 'shopkeeper', scenarios: SHOPKEEPER_SCENARIOS },
  { agent: 'quizmaster', scenarios: QUIZMASTER_SCENARIOS },
  { agent: 'mentalist', scenarios: MENTALIST_SCENARIOS },
  { agent: 'negotiator', scenarios: NEGOTIATOR_SCENARIOS },
  { agent: 'lexicographer', scenarios: [LEXICOGRAPHER_SMOKE] },
  { agent: 'admiral', scenarios: [ADMIRAL_SMOKE] },
  { agent: 'alchemist', scenarios: ALCHEMIST_SCENARIOS },
  { agent: 'dungeon-master', scenarios: DUNGEON_MASTER_SCENARIOS },
]

/** Every taggable scenario: smoke, then regression, routing and long, each in its own module's order. */
export function scenarioRegistry(): PlannedScenario[] {
  return [
    ...SMOKE_PRESETS.flatMap((p) => p.scenarios.map((s) => planned(p.agent, s))),
    ...ROUND_PRESETS.flatMap((p) => p.scenarios.map((s) => planned(p.agent, regressionScenario({ agent: p.agent, scenario: s.name, models: [], covers: [] })))),
    ...ROUTING_SCENARIOS.map((s) => planned(s.agent, s)),
    ...ROUND6_LONG_FLOWS.map(({ agent, scenario }) => planned(agent, scenario)),
  ]
}

export interface PlanOptions {
  tags: ScenarioTag[]
  personas: string[]
  models: RoundModel[]
  samples: number
  cap?: number
  round?: string
}

export class PlanUsageError extends Error {}

const VALUE_FLAGS = ['--tag', '--persona', '--model', '--samples', '--cap', '--round'] as const

/** Parse the CLI; every problem is a `PlanUsageError` (exit 2). */
export function parsePlanArgs(argv: readonly string[], registry: readonly PlannedScenario[] = scenarioRegistry()): PlanOptions {
  const tags: ScenarioTag[] = []
  const personas: string[] = []
  const models: RoundModel[] = []
  const single = new Map<string, string>()
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i]!
    if (flag === '--affected') throw new PlanUsageError('--affected is refused (SPEC CL-R10): no committed round records the bundle digests it would compare against, and it is never approximated')
    if (!(VALUE_FLAGS as readonly string[]).includes(flag)) throw new PlanUsageError(`unknown argument "${flag}"`)
    const value = argv[i + 1]
    if (value === undefined || value === '') throw new PlanUsageError(`${flag} needs a value`)
    if (flag === '--tag') {
      if (!(SCENARIO_TAGS as readonly string[]).includes(value)) throw new PlanUsageError(`unknown tag "${value}" (${SCENARIO_TAGS.join(', ')})`)
      tags.push(value as ScenarioTag)
    } else if (flag === '--persona') {
      if (!registry.some((s) => s.agent === value)) throw new PlanUsageError(`no scenario for preset "${value}"`)
      personas.push(value)
    } else if (flag === '--model') {
      const model = ROUND3_MODELS.find((m) => m.short === value || m.id === value)
      if (model === undefined) throw new PlanUsageError(`unknown model "${value}" (${ROUND3_MODELS.map((m) => m.short).join(', ')} or their ids)`)
      models.push(model)
    } else {
      if (single.has(flag)) throw new PlanUsageError(`${flag} given twice`)
      single.set(flag, value)
    }
  }
  if (tags.length === 0) throw new PlanUsageError('a plan needs at least one --tag')
  const samples = Number(single.get('--samples') ?? '1')
  if (!Number.isInteger(samples) || samples < 1) throw new PlanUsageError('--samples takes a whole number of at least 1')
  const capText = single.get('--cap')
  const cap = capText === undefined ? undefined : Number(capText)
  if (cap !== undefined && !(Number.isFinite(cap) && cap > 0)) throw new PlanUsageError('--cap takes a positive number of USD')
  const round = single.get('--round')
  if (round !== undefined && !/^[a-z0-9][a-z0-9-]*$/.test(round)) throw new PlanUsageError('--round takes lowercase letters, digits and dashes')
  return {
    tags,
    personas,
    models: ROUND3_MODELS.filter((m) => models.length === 0 || models.includes(m)),
    samples,
    ...(cap !== undefined ? { cap } : {}),
    ...(round !== undefined ? { round } : {}),
  }
}

export interface PlannedRun {
  name: string
  agent: string
  scenario: string
  model: RoundModel
  sample: number
  argv: string[]
}

/** The probe argv for one scenario x model x sample; out dir `runs/<name>`. */
export function planArgv(s: PlannedScenario, model: RoundModel, name: string): string[] {
  return [
    '--agent', s.agent,
    '--model', model.id,
    ...s.scenario.steps.flatMap(stepArgv),
    ...s.scenario.expectComponents.flatMap((c) => ['--expect-component', c]),
    '--out', `runs/${name}`,
    '--name', name,
  ]
}

/** The selected runs in script order: by model, then sample, then registry order. */
export function planRuns(o: PlanOptions, registry: readonly PlannedScenario[] = scenarioRegistry()): PlannedRun[] {
  const picked = registry.filter((s) => s.scenario.tags.some((t) => o.tags.includes(t)) && (o.personas.length === 0 || o.personas.includes(s.agent)))
  return o.models.flatMap((model) =>
    Array.from({ length: o.samples }, (_, i) => i + 1).flatMap((sample) =>
      picked.map((s) => {
        const name = `${s.id}-${model.short}-${sample}`
        return { name, agent: s.agent, scenario: s.id, model, sample, argv: planArgv(s, model, name) }
      }),
    ),
  )
}

/** The `live-commands.sh` for a plan; `argv` is the plan's own command line, echoed in the header. */
export function planScript(o: PlanOptions, argv: readonly string[], registry: readonly PlannedScenario[] = scenarioRegistry()): string {
  const runs = planRuns(o, registry)
  const per = o.models.map((m) => `${m.short} ${runs.filter((r) => r.model.id === m.id).length}`).join(', ')
  const lines = [
    '#!/usr/bin/env bash',
    `# Planned by \`node --experimental-strip-types ${PLAN_FILE} ${argv.map(quote).join(' ')}\` (T-0343); do not hand-edit.`,
    `# Tag ${o.tags.join(', ')}${o.personas.length > 0 ? `, preset ${o.personas.join(', ')}` : ''}: ${runs.length} runs (${per}), ${o.samples} sample${o.samples === 1 ? '' : 's'} each; by model, then sample, then scenario.`,
    '# Spends API credit through the dev proxy (key in .env, never printed). Check it keyless, then run it through the',
    '# capped runner, always with --round (each --out is runs/<name>):',
    '#   node --experimental-strip-types scripts/e2e-admin/probe/run-capped.ts --describe <this file>',
    `#   node --experimental-strip-types scripts/e2e-admin/probe/run-capped.ts <this file> --cap ${o.cap ?? '<usd>'} --round ${o.round ?? '<slug>'}`,
    '# A probe exits 1 when a check fails.',
  ]
  let current = ''
  for (const run of runs) {
    if (run.model.id !== current) {
      current = run.model.id
      lines.push('', `# ${current}`)
    }
    lines.push(['npm', 'run', 'chat:probe', '--', ...run.argv].map(quote).join(' '))
  }
  return `${lines.join('\n')}\n`
}

/** The CLI: the script on stdout and exit 0, or the problem and the usage on stderr and exit 2. */
export function planMain(argv: readonly string[], out: (text: string) => void, err: (text: string) => void): number {
  try {
    const registry = scenarioRegistry()
    const o = parsePlanArgs(argv, registry)
    if (planRuns(o, registry).length === 0) throw new PlanUsageError(`no scenario is tagged ${o.tags.join(' or ')}${o.personas.length > 0 ? ` for ${o.personas.join(', ')}` : ''}`)
    out(planScript(o, argv, registry))
    return 0
  } catch (e) {
    if (!(e instanceof PlanUsageError)) throw e
    err(`plan: ${e.message}\n${PLAN_USAGE}\n`)
    return 2
  }
}

if (import.meta.url === `file://${process.argv[1]}`) process.exitCode = planMain(process.argv.slice(2), (t) => process.stdout.write(t), (t) => process.stderr.write(t))
