// scripts/e2e-admin/probe/scenarios/round3.ts: live round 3 (T-0261), one `live-commands.sh` in
// `.sdlc/evals/rounds/2026-10-15-r3-routing/` from three parts, run by model (every Haiku run, then Sonnet, then Opus)
// so a stop at the spend cap (`../run-capped.ts`) leaves the cheap cells filled:
//
// - A. The T-0260 routing pressure pack (`routing.ts`), 12 runs, as generated there.
// - B. Round 2 regressions: round 2 scenarios that failed (`.sdlc/evals/rounds/2026-10-15-r2-presets/report.md`),
//   rerun on a model they failed on plus Haiku, with round 2's scenario fixes. Each names the tickets it re-checks.
//   The opening step (the first guess for the Lexicographer; a Concierge booking ask and its unnamed late check-out
//   question) carries an `--expect-routing` oracle for the preset's own exemplar (T-0238, T-0240, T-0253) or the
//   knowledge base (T-0231).
//   Left out: concierge dinner-at-vela and lexicographer six-guesses (the Concierge booking and the word board are
//   covered by A, C and the other Lexicographer runs), admiral concede (row-sweep and opening-salvo hold the
//   Admiral's tickets).
// - C. Long flows on Haiku, Sonnet and Opus: a full blackjack hand (deal, bet, hit, stand, deal again, bet) and a
//   Concierge booking through a change to its confirmation.
//
// Run `node --experimental-strip-types scripts/e2e-admin/probe/scenarios/round3.ts` to print the script;
// `round3.test.mjs` pins the file to this generator.

import { stepArgv, type ProbeStep, type RoutingExpect } from '../model.ts'
import { quote } from './croupier.ts'
import { ROUND_PRESETS, type RoundModel, type RoundScenario } from './round.ts'
import { routingRuns } from './routing.ts'

export const ROUND3_DIR = '.sdlc/evals/rounds/2026-10-15-r3-routing'
export const ROUND3_FILE = `${ROUND3_DIR}/live-commands.sh`

export const ROUND3_MODELS: readonly RoundModel[] = [
  { id: 'claude-haiku-5-5', short: 'haiku' },
  { id: 'claude-sonnet-5-5', short: 'sonnet' },
  { id: 'claude-opus-5-5', short: 'opus' },
]
const model = (short: string): RoundModel => ROUND3_MODELS.find((m) => m.short === short)!

const CARD_TABLE = 'domain-croupier-card-table-round'
const BOOKING_REQUEST = 'domain-concierge-booking-request'
const WORD_BOARD = 'domain-lexicographer-word-board'
const BATTLESHIP_BOARD = 'domain-admiral-battleship-board'
const KB_FULL: RoutingExpect['references'] = [{ name: 'property-knowledge-base', load: 'full' }]

/** A regression: one round 2 scenario, the models it reruns on, the tickets it re-checks. */
export interface Regression {
  agent: string
  scenario: string
  models: readonly string[]
  covers: readonly string[]
}

export const REGRESSIONS: readonly Regression[] = [
  // blackjack-rounds on Opus and seven-card-stud failed on round 2 scenario defects; these reruns show the fixes hold.
  { agent: 'croupier', scenario: 'blackjack-rounds', models: ['haiku', 'sonnet', 'opus'], covers: ['T-0229', 'T-0233', 'T-0232', 'T-0253'] },
  { agent: 'croupier', scenario: 'blackjack-moves', models: ['haiku'], covers: ['T-0229', 'T-0238'] },
  { agent: 'croupier', scenario: 'spanish-21', models: ['haiku'], covers: ['T-0214'] },
  { agent: 'croupier', scenario: 'pontoon', models: ['haiku', 'sonnet'], covers: ['T-0232'] },
  { agent: 'croupier', scenario: 'texas-holdem', models: ['haiku'], covers: ['T-0214', 'T-0240'] },
  { agent: 'croupier', scenario: 'omaha', models: ['haiku', 'opus'], covers: ['T-0214', 'T-0234'] },
  { agent: 'croupier', scenario: 'five-card-draw', models: ['haiku'], covers: ['T-0229', 'T-0234'] },
  { agent: 'croupier', scenario: 'seven-card-stud', models: ['haiku', 'sonnet', 'opus'], covers: ['T-0214', 'T-0229'] },
  { agent: 'concierge', scenario: 'spa-booking', models: ['haiku', 'sonnet'], covers: ['T-0231', 'T-0214', 'T-0240'] },
  { agent: 'concierge', scenario: 'facilities-then-tour', models: ['haiku', 'sonnet'], covers: ['T-0231'] },
  { agent: 'lexicographer', scenario: 'give-up', models: ['haiku', 'sonnet'], covers: ['T-0230', 'T-0236', 'T-0240'] },
  { agent: 'lexicographer', scenario: 'invalid-then-replay', models: ['haiku', 'sonnet'], covers: ['T-0230', 'T-0229', 'T-0236'] },
  { agent: 'admiral', scenario: 'opening-salvo', models: ['haiku', 'sonnet'], covers: ['T-0230', 'T-0236', 'T-0240'] },
  { agent: 'admiral', scenario: 'row-sweep', models: ['haiku', 'sonnet'], covers: ['T-0214'] },
]

/** The round 2 tickets round 3 re-checks; every one is covered by at least one regression. */
export const ROUND2_TICKETS = ['T-0214', 'T-0229', 'T-0230', 'T-0231', 'T-0232', 'T-0233', 'T-0234', 'T-0236', 'T-0238', 'T-0240', 'T-0253'] as const

/** The routing oracle a regression step carries, by preset: the opening turn retrieves the preset's own composite
 *  (a card table turn ranks no board, T-0253), a Concierge booking ask its booking exemplar, and an unnamed late
 *  check-out question loads the knowledge base in full (T-0231). The Lexicographer's sits on its first guess: keyless
 *  `retrieve` at k 3 ranks no word board for "Start a new word game." (a phase 2 finding, not a live one). */
function regressionRouting(agent: string, step: ProbeStep, index: number): RoutingExpect | undefined {
  const text = 'say' in step ? step.say : ''
  if (agent === 'croupier' && index === 0) return { domains: ['croupier'], exemplars: { include: [CARD_TABLE], exclude: [WORD_BOARD, BATTLESHIP_BOARD] } }
  if (agent === 'concierge' && /^Book /.test(text)) return { domains: ['concierge'], exemplars: { include: [BOOKING_REQUEST] } }
  if (agent === 'concierge' && /late check-out/.test(text)) return { domains: ['concierge'], references: KB_FULL }
  if (agent === 'lexicographer' && index === 1) return { exemplars: { include: [WORD_BOARD] } }
  if (agent === 'admiral' && index === 0) return { exemplars: { include: [BATTLESHIP_BOARD] } }
  return undefined
}

/** The round 2 scenario a regression reruns, with its routing oracles. */
export function regressionScenario(r: Regression): RoundScenario {
  const s = ROUND_PRESETS.find((p) => p.agent === r.agent)?.scenarios.find((x) => x.name === r.scenario)
  if (s === undefined) throw new Error(`no round 2 scenario ${r.agent} ${r.scenario}`)
  return {
    ...s,
    steps: s.steps.map((step, i) => {
      const routing = regressionRouting(r.agent, step, i)
      return routing === undefined ? step : { ...step, expectRouting: routing }
    }),
  }
}

const say = (text: string, routing?: RoutingExpect, ...expect: string[]): ProbeStep => ({ say: text, ...(expect.length ? { expect } : {}), ...(routing !== undefined ? { expectRouting: routing } : {}) })
const click = (label: string, ...expect: string[]): ProbeStep => ({ click: label, ...(expect.length ? { expect } : {}) })

/** C: the long flows, each on every model. */
export const LONG_FLOWS: ReadonlyArray<{ agent: string; scenario: RoundScenario }> = [
  {
    agent: 'croupier',
    // Hit is a click (the moves must be on the table, T-0233); the Stand after it is a `--say`, since a Hit can bust.
    // The bet after Deal again is a click, so a new round dealt without the bet strip fails click-target (T-0232).
    scenario: {
      name: 'blackjack-hand',
      steps: [
        say("Let's play blackjack.", { domains: ['croupier'], exemplars: { include: [CARD_TABLE], exclude: [WORD_BOARD, BATTLESHIP_BOARD] } }, 'CardTable'),
        click('100', 'CardTable'),
        click('Hit', 'CardTable'),
        say('Stand.'),
        click('Deal again', 'CardTable'),
        click('50', 'CardTable'),
        say('Stand.'),
      ],
      expectComponents: ['CardTable'],
    },
  },
  {
    agent: 'concierge',
    scenario: {
      name: 'booking',
      steps: [
        say('What spa services can I book during my stay?', undefined, 'ProductCard'),
        say('Book a 60-minute Swedish massage at the spa on Thursday 19 November 2026 at 15:00 for one guest, name Alex Moreau.', { domains: ['concierge'], exemplars: { include: [BOOKING_REQUEST] } }, 'BookingForm'),
        say('Make it 16:00 instead, same day.', undefined, 'BookingForm'),
        say('Those details are right, please confirm the booking.', undefined, 'BookingConfirmation'),
        say("Thanks, that's all."),
      ],
      expectComponents: ['ProductCard', 'BookingForm', 'BookingConfirmation'],
    },
  },
]

export interface Round3Run {
  part: 'routing' | 'regress' | 'long'
  name: string
  agent: string
  model: RoundModel
  argv: string[]
}

/** The probe argv for one scenario x model, out at `<round>/runs/<name>`. */
export function round3Argv(agent: string, scenario: RoundScenario, m: RoundModel, name: string): string[] {
  return [
    '--agent', agent,
    '--model', m.id,
    ...scenario.steps.flatMap(stepArgv),
    ...scenario.expectComponents.flatMap((c) => ['--expect-component', c]),
    '--out', `${ROUND3_DIR}/runs/${name}`,
    '--name', name,
  ]
}

/** Every run in script order: by model (Haiku, Sonnet, Opus), then part (A, B, C), then each part's own order. */
export function round3Runs(): Round3Run[] {
  const pack: Round3Run[] = routingRuns().map(({ scenario, model: m, argv }) => {
    const name = argv[argv.indexOf('--name') + 1]
    return { part: 'routing', name, agent: scenario.agent, model: m, argv: argv.map((a, i) => (argv[i - 1] === '--out' ? `${ROUND3_DIR}/runs/${name}` : a)) }
  })
  const regress: Round3Run[] = REGRESSIONS.flatMap((r) =>
    r.models.map((short) => {
      const name = `regress-${r.agent}-${r.scenario}-${short}-1`
      return { part: 'regress' as const, name, agent: r.agent, model: model(short), argv: round3Argv(r.agent, regressionScenario(r), model(short), name) }
    }),
  )
  const long: Round3Run[] = LONG_FLOWS.flatMap(({ agent, scenario }) =>
    ROUND3_MODELS.map((m) => {
      const name = `long-${agent}-${scenario.name}-${m.short}-1`
      return { part: 'long' as const, name, agent, model: m, argv: round3Argv(agent, scenario, m, name) }
    }),
  )
  return ROUND3_MODELS.flatMap((m) => [...pack, ...regress, ...long].filter((r) => r.model.id === m.id))
}

/** `.sdlc/evals/rounds/2026-10-15-r3-routing/live-commands.sh`. */
export function round3CommandsScript(): string {
  const lines = [
    '#!/usr/bin/env bash',
    '# T-0261 live round 3: the routing pressure pack, round 2 regressions, long flows. Generated by',
    '# `node --experimental-strip-types scripts/e2e-admin/probe/scenarios/round3.ts`; do not hand-edit.',
    '# Spends API credit through the dev proxy (key in .env, never printed). Cap: $20 in total (Kim 2026-10-15).',
    `#   node --experimental-strip-types scripts/e2e-admin/probe/run-capped.ts --describe ${ROUND3_FILE}`,
    `#   node --experimental-strip-types scripts/e2e-admin/probe/run-capped.ts ${ROUND3_FILE} --cap 20 --round r3-routing`,
    '# Haiku 5.5 first, then Sonnet 5.5, then Opus 5.5; sample 1. A probe exits 1 when a check fails.',
  ]
  let current = ''
  for (const run of round3Runs()) {
    if (run.model.id !== current) {
      current = run.model.id
      lines.push('', `# ${current}`)
    }
    lines.push(['npm', 'run', 'chat:probe', '--', ...run.argv].map(quote).join(' '))
  }
  return `${lines.join('\n')}\n`
}

if (import.meta.url === `file://${process.argv[1]}`) process.stdout.write(round3CommandsScript())
