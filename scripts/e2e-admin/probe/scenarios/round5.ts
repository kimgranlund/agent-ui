// scripts/e2e-admin/probe/scenarios/round5.ts: live round 5 (T-0287), one `live-commands.sh` in
// `.sdlc/evals/rounds/2026-10-15-r5-fixes/`, run by model (every Haiku run, then Sonnet, then Opus) so a stop at the
// $15 spend cap (`../run-capped.ts`) leaves the cheap cells filled. It measures whether the round 4 fixes (T-0276 to
// T-0286) hold live, in two parts:
//
// - R. Reruns: every round 4 run whose ledger verdict is fail (`R4_FAILED`, 26 runs), same scenario, model and name,
//   regenerated from the current generators (`round4.ts` and the ones it builds on), so the T-0277 Swedish massage,
//   T-0283 stud and T-0279 and T-0285 oracle fixes carry through.
// - L. Long flows on Haiku and Sonnet: round 4's Concierge booking through confirmation, spa services (ProductCard per
//   treatment, T-0279) and Lexicographer opening through give-up, plus a facility-hours flow (one compact info card,
//   a Card holding a DescriptionList, T-0285). A long flow whose run name is already a rerun runs once, as the rerun.
//
// Run `node --experimental-strip-types scripts/e2e-admin/probe/scenarios/round5.ts` to print the script;
// `round5.test.mjs` pins the file to this generator.

import { quote, sayRouted as say, type RoutingExpect } from '../model.ts'
import type { RoundModel, RoundScenario } from './round.ts'
import { ROUND3_MODELS, round3Argv } from './round3.ts'
import { ROUND4_LONG_FLOWS, ROUND4_LONG_MODELS, round4Runs } from './round4.ts'

export const ROUND5_DIR = '.sdlc/evals/rounds/2026-10-15-r5-fixes'
export const ROUND5_FILE = `${ROUND5_DIR}/live-commands.sh`
export const ROUND5_CAP = 15

/** The round 4 runs whose verdict was fail (`.sdlc/evals/rounds/2026-10-15-r4-fixes/ledger.jsonl`), in its order. */
export const R4_FAILED: readonly string[] = [
  'routing-decoy-words-haiku-1',
  'routing-long-session-haiku-1',
  'routing-two-surfaces-haiku-1',
  'regress-croupier-texas-holdem-haiku-1',
  'regress-croupier-omaha-haiku-1',
  'regress-croupier-seven-card-stud-haiku-1',
  'regress-concierge-spa-booking-haiku-1',
  'regress-concierge-facilities-then-tour-haiku-1',
  'regress-lexicographer-give-up-haiku-1',
  'regress-lexicographer-invalid-then-replay-haiku-1',
  'regress-admiral-row-sweep-haiku-1',
  'long-concierge-booking-haiku-1',
  'long-concierge-booking-confirm-haiku-1',
  'long-concierge-spa-services-haiku-1',
  'long-lexicographer-game-give-up-haiku-1',
  'routing-decoy-words-sonnet-1',
  'routing-long-session-sonnet-1',
  'routing-two-surfaces-sonnet-1',
  'regress-concierge-spa-booking-sonnet-1',
  'regress-concierge-facilities-then-tour-sonnet-1',
  'long-concierge-booking-sonnet-1',
  'long-concierge-booking-confirm-sonnet-1',
  'long-concierge-spa-services-sonnet-1',
  'regress-croupier-omaha-opus-1',
  'regress-croupier-seven-card-stud-opus-1',
  'long-concierge-booking-opus-1',
]

/** The long flows run on Haiku and Sonnet only (Kim 2026-10-16), as in round 4. */
export const ROUND5_LONG_MODELS: readonly RoundModel[] = ROUND4_LONG_MODELS

const KB_FULL: RoutingExpect['references'] = [{ name: 'property-knowledge-base', load: 'full' }]

/** L: round 4's long flows plus the T-0285 facility-hours flow, each on Haiku and Sonnet. */
export const ROUND5_LONG_FLOWS: ReadonlyArray<{ agent: string; scenario: RoundScenario; covers: readonly string[] }> = [
  ...ROUND4_LONG_FLOWS,
  {
    agent: 'concierge',
    covers: ['T-0285'],
    scenario: {
      name: 'facility-hours',
      tags: ['long'],
      steps: [
        // T-0285: a step's expect is any-of, so the ruled Card plus DescriptionList is pinned by DescriptionList alone.
        say('What are the opening hours of the pool, gym and spa? Check the property-knowledge-base.', { domains: ['hospitality'], references: KB_FULL }, 'DescriptionList'),
        say('Is late check-out possible?'),
        say("Thanks, that's all."),
      ],
      expectComponents: ['DescriptionList'],
    },
  },
]

export interface Round5Run {
  part: 'rerun' | 'long'
  name: string
  agent: string
  model: RoundModel
  argv: string[]
}

const retarget = (argv: string[], name: string): string[] => argv.map((a, i) => (argv[i - 1] === '--out' ? `${ROUND5_DIR}/runs/${name}` : a))

/** Every run in script order: by model (Haiku, Sonnet, Opus), reruns first in round 4's order, then the long flows. */
export function round5Runs(): Round5Run[] {
  const r4 = new Map(round4Runs().map((r) => [r.name, r]))
  const reruns: Round5Run[] = R4_FAILED.map((name) => {
    const r = r4.get(name)
    if (r === undefined) throw new Error(`no round 4 run ${name}`)
    return { part: 'rerun', name, agent: r.agent, model: r.model, argv: retarget(r.argv, name) }
  })
  const rerun = new Set(R4_FAILED)
  const long: Round5Run[] = ROUND5_LONG_FLOWS.flatMap(({ agent, scenario }) =>
    ROUND5_LONG_MODELS.map((m) => {
      const name = `long-${agent}-${scenario.name}-${m.short}-1`
      return { part: 'long' as const, name, agent, model: m, argv: retarget(round3Argv(agent, scenario, m, name), name) }
    }),
  ).filter((r) => !rerun.has(r.name))
  return ROUND3_MODELS.flatMap((m) => [...reruns, ...long].filter((r) => r.model.id === m.id))
}

/** `.sdlc/evals/rounds/2026-10-15-r5-fixes/live-commands.sh`. */
export function round5CommandsScript(): string {
  const lines = [
    '#!/usr/bin/env bash',
    '# T-0287 live round 5: round 4 failed-run reruns, Concierge and Lexicographer long flows. Generated by',
    '# `node --experimental-strip-types scripts/e2e-admin/probe/scenarios/round5.ts`; do not hand-edit.',
    `# Spends API credit through the dev proxy (key in .env, never printed). Cap: $${ROUND5_CAP} in total (Kim 2026-10-16).`,
    `#   node --experimental-strip-types scripts/e2e-admin/probe/run-capped.ts --describe ${ROUND5_FILE}`,
    `#   node --experimental-strip-types scripts/e2e-admin/probe/run-capped.ts ${ROUND5_FILE} --cap ${ROUND5_CAP} --round r5-fixes`,
    '# Haiku 5.5 first, then Sonnet 5.5, then Opus 5.5; sample 1. A probe exits 1 when a check fails.',
  ]
  let current = ''
  for (const run of round5Runs()) {
    if (run.model.id !== current) {
      current = run.model.id
      lines.push('', `# ${current}`)
    }
    lines.push(['npm', 'run', 'chat:probe', '--', ...run.argv].map(quote).join(' '))
  }
  return `${lines.join('\n')}\n`
}

if (import.meta.url === `file://${process.argv[1]}`) process.stdout.write(round5CommandsScript())
