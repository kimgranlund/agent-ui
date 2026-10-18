// scripts/e2e-admin/probe/scenarios/round4.ts: live round 4 (T-0275), one `live-commands.sh` in
// `.sdlc/evals/rounds/2026-10-15-r4-fixes/`, run by model (every Haiku run, then Sonnet, then Opus) so a stop at the
// $15 spend cap (`../run-capped.ts`) leaves the cheap cells filled. It measures whether the round 3 fixes (T-0258,
// T-0262 to T-0274) hold live, in two parts:
//
// - R. Reruns: every round 3 run whose ledger verdict is fail (`R3_FAILED`, 31 runs), same scenario, model and name,
//   regenerated from the current generators (`round3.ts`, `routing.ts`, `round.ts`), so the T-0270 doc-only and
//   T-0272 stud fixes carry through.
// - L. Long flows on Haiku and Sonnet: a fully specified Concierge booking through confirmation (a pre-filled
//   BookingForm, then one BookingConfirmation, T-0266), a spa services ask then a booking from it (ProductCard,
//   T-0267, T-0279), and a Lexicographer game from the opening through a give-up and a replay (word board on the opening,
//   T-0268; ResultCard and the game-over exemplar on the give-up, T-0274).
//
// Run `node --experimental-strip-types scripts/e2e-admin/probe/scenarios/round4.ts` to print the script;
// `round4.test.mjs` pins the file to this generator.

import { quote, sayRouted as say } from '../model.ts'
import type { RoundModel, RoundScenario } from './round.ts'
import { ROUND3_MODELS, round3Argv, round3Runs } from './round3.ts'

export const ROUND4_DIR = '.sdlc/evals/rounds/2026-10-15-r4-fixes'
export const ROUND4_FILE = `${ROUND4_DIR}/live-commands.sh`
export const ROUND4_CAP = 15

/** The round 3 runs whose verdict was fail (`.sdlc/evals/rounds/2026-10-15-r3-routing/ledger.jsonl`), in its order. */
export const R3_FAILED: readonly string[] = [
  'routing-decoy-words-haiku-1',
  'routing-long-session-haiku-1',
  'routing-doc-only-haiku-1',
  'routing-two-surfaces-haiku-1',
  'regress-croupier-blackjack-rounds-haiku-1',
  'regress-croupier-blackjack-moves-haiku-1',
  'regress-croupier-texas-holdem-haiku-1',
  'regress-croupier-omaha-haiku-1',
  'regress-croupier-five-card-draw-haiku-1',
  'regress-croupier-seven-card-stud-haiku-1',
  'regress-concierge-spa-booking-haiku-1',
  'regress-concierge-facilities-then-tour-haiku-1',
  'regress-lexicographer-give-up-haiku-1',
  'regress-lexicographer-invalid-then-replay-haiku-1',
  'regress-admiral-opening-salvo-haiku-1',
  'regress-admiral-row-sweep-haiku-1',
  'long-concierge-booking-haiku-1',
  'routing-decoy-words-sonnet-1',
  'routing-long-session-sonnet-1',
  'routing-doc-only-sonnet-1',
  'routing-two-surfaces-sonnet-1',
  'regress-concierge-spa-booking-sonnet-1',
  'regress-concierge-facilities-then-tour-sonnet-1',
  'regress-lexicographer-give-up-sonnet-1',
  'regress-lexicographer-invalid-then-replay-sonnet-1',
  'regress-admiral-opening-salvo-sonnet-1',
  'regress-admiral-row-sweep-sonnet-1',
  'long-concierge-booking-sonnet-1',
  'regress-croupier-omaha-opus-1',
  'regress-croupier-seven-card-stud-opus-1',
  'long-concierge-booking-opus-1',
]

/** The long flows run on Haiku and Sonnet only (Kim 2026-10-15). */
export const ROUND4_LONG_MODELS: readonly RoundModel[] = ROUND3_MODELS.filter((m) => m.short !== 'opus')

const BOOKING_REQUEST = 'domain-concierge-booking-request'
const WORD_BOARD = 'domain-lexicographer-word-board'
const GAME_OVER = 'domain-lexicographer-game-over'
const BOOK_ASK = 'Book a 60-minute Swedish massage at the spa on Thursday 19 November 2026 at 15:00 for one guest, name Alex Moreau.'

/** L: the long flows, each on Haiku and Sonnet. */
export const ROUND4_LONG_FLOWS: ReadonlyArray<{ agent: string; scenario: RoundScenario; covers: readonly string[] }> = [
  {
    agent: 'concierge',
    covers: ['T-0266'],
    scenario: {
      name: 'booking-confirm',
      tags: ['long'],
      steps: [
        say(BOOK_ASK, { domains: ['concierge'], exemplars: { include: [BOOKING_REQUEST] } }, 'BookingForm'),
        say('Those details are right, please confirm the booking.', undefined, 'BookingConfirmation'),
        say("Thanks, that's all."),
      ],
      expectComponents: ['BookingForm', 'BookingConfirmation'],
    },
  },
  {
    agent: 'concierge',
    covers: ['T-0267', 'T-0266'],
    scenario: {
      name: 'spa-services',
      tags: ['long'],
      steps: [
        say('What spa services can I book during my stay?', { domains: ['concierge'] }, 'ProductCard'),
        say('Book the first one for Thursday 19 November 2026 at 15:00, one guest, name Alex Moreau.', undefined, 'BookingForm'),
      ],
      expectComponents: ['ProductCard', 'BookingForm'],
    },
  },
  {
    agent: 'lexicographer',
    covers: ['T-0268', 'T-0274'],
    scenario: {
      name: 'game-give-up',
      tags: ['long'],
      steps: [
        say('Start a new word game.', { exemplars: { include: [WORD_BOARD] } }, 'BoardGrid'),
        say('My guess: crane.', undefined, 'BoardGrid'),
        say('My guess: pious.', undefined, 'BoardGrid'),
        say('I give up.', { exemplars: { include: [GAME_OVER] } }, 'ResultCard'),
        say('Play again.', undefined, 'BoardGrid'),
      ],
      expectComponents: ['BoardGrid', 'GameHud', 'ResultCard'],
    },
  },
]

export interface Round4Run {
  part: 'rerun' | 'long'
  name: string
  agent: string
  model: RoundModel
  argv: string[]
}

const retarget = (argv: string[], name: string): string[] => argv.map((a, i) => (argv[i - 1] === '--out' ? `${ROUND4_DIR}/runs/${name}` : a))

/** Every run in script order: by model (Haiku, Sonnet, Opus), reruns first in round 3's order, then the long flows. */
export function round4Runs(): Round4Run[] {
  const r3 = new Map(round3Runs().map((r) => [r.name, r]))
  const reruns: Round4Run[] = R3_FAILED.map((name) => {
    const r = r3.get(name)
    if (r === undefined) throw new Error(`no round 3 run ${name}`)
    return { part: 'rerun', name, agent: r.agent, model: r.model, argv: retarget(r.argv, name) }
  })
  const long: Round4Run[] = ROUND4_LONG_FLOWS.flatMap(({ agent, scenario }) =>
    ROUND4_LONG_MODELS.map((m) => {
      const name = `long-${agent}-${scenario.name}-${m.short}-1`
      return { part: 'long' as const, name, agent, model: m, argv: retarget(round3Argv(agent, scenario, m, name), name) }
    }),
  )
  return ROUND3_MODELS.flatMap((m) => [...reruns, ...long].filter((r) => r.model.id === m.id))
}

/** `.sdlc/evals/rounds/2026-10-15-r4-fixes/live-commands.sh`. */
export function round4CommandsScript(): string {
  const lines = [
    '#!/usr/bin/env bash',
    '# T-0275 live round 4: round 3 failed-run reruns, Concierge and Lexicographer long flows. Generated by',
    '# `node --experimental-strip-types scripts/e2e-admin/probe/scenarios/round4.ts`; do not hand-edit.',
    `# Spends API credit through the dev proxy (key in .env, never printed). Cap: $${ROUND4_CAP} in total (Kim 2026-10-15).`,
    `#   node --experimental-strip-types scripts/e2e-admin/probe/run-capped.ts --describe ${ROUND4_FILE}`,
    `#   node --experimental-strip-types scripts/e2e-admin/probe/run-capped.ts ${ROUND4_FILE} --cap ${ROUND4_CAP} --round r4-fixes`,
    '# Haiku 5.5 first, then Sonnet 5.5, then Opus 5.5; sample 1. A probe exits 1 when a check fails.',
  ]
  let current = ''
  for (const run of round4Runs()) {
    if (run.model.id !== current) {
      current = run.model.id
      lines.push('', `# ${current}`)
    }
    lines.push(['npm', 'run', 'chat:probe', '--', ...run.argv].map(quote).join(' '))
  }
  return `${lines.join('\n')}\n`
}

if (import.meta.url === `file://${process.argv[1]}`) process.stdout.write(round4CommandsScript())
