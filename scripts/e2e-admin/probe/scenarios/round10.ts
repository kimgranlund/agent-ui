// scripts/e2e-admin/probe/scenarios/round10.ts: live round 10 (T-0341), a targeted round after the round 9 fixes
// (T-0328, T-0330 to T-0335). One `live-commands.sh` in `.sdlc/evals/rounds/2026-10-17-r10-targeted/` (Kim 2026-10-17:
// round 9 failures plus the runs each fix touches, 3 samples on unstable runs, about $10; the next round is the full
// matrix):
//
// - The round 9 failed runs (`R9_FAILED`, from `.sdlc/evals/rounds/2026-10-17-r9-matrix/ledger.jsonl`).
// - The runs each fix touches (`R9_FIX_RUNS`): the round 9 runs whose trace lines carry the code or turn the fix
//   changed, which are the runs its mechanism metric is read from.
// - Minus `R10_EXCLUDED`, each with its reason.
// - The unstable runs (`R10_UNSTABLE`: `blackjack-rounds-haiku` and the other Haiku blackjack-family openings) run
//   `R10_SAMPLES` samples, named `-1` to `-3`; every other run is sample 1 under its round 9 name.
//
// Each run is round 9's argv apart from `--out` and `--name`, so sample 1 compares with round 9 directly. Runs go
// cheapest first by `R10_COST` (the larger of the round 8 and round 9 ledger costs, since a round 9 run that halted on
// turn 0 cost less than its full script), so a stop at the $10 spend cap (`../run-capped.ts`) drops the dearest runs.
//
// Run `node --experimental-strip-types scripts/e2e-admin/probe/scenarios/round10.ts` to print the script;
// `round10.test.mjs` pins the file to this generator.

import { quote } from './croupier.ts'
import type { RoundModel } from './round.ts'
import { round9Runs } from './round9.ts'

export const ROUND10_DIR = '.sdlc/evals/rounds/2026-10-17-r10-targeted'
export const ROUND10_FILE = `${ROUND10_DIR}/live-commands.sh`
export const ROUND10_CAP = 10
export const R10_SAMPLES = 3

/** The round 9 runs whose verdict was fail, in its ledger order. */
export const R9_FAILED: readonly string[] = [
  'regress-croupier-blackjack-rounds-haiku-1',
  'regress-concierge-facilities-then-tour-haiku-1',
  'routing-domain-switch-haiku-1',
  'routing-long-session-haiku-1',
  'routing-guidance-conflict-haiku-1',
  'long-croupier-blackjack-hand-haiku-1',
  'long-concierge-spa-services-haiku-1',
  'regress-croupier-blackjack-moves-sonnet-1',
  'regress-croupier-omaha-opus-1',
  'regress-croupier-five-card-draw-opus-1',
]

/** Per round 9 fix, the round 9 runs it touches (round 9 trace lines in the comments). */
export const R9_FIX_RUNS: Readonly<Record<string, readonly string[]>> = {
  // A: SURFACE_DROPPED on a renamed surface, and the halts (:1, :74, :84, :120, :127, :128, :143, :147, :157), plus
  // the Haiku blackjack openings where BET_TABLE_MISSING starts it (:2).
  'T-0328': [
    'regress-croupier-blackjack-rounds-haiku-1',
    'regress-croupier-blackjack-moves-haiku-1',
    'routing-domain-switch-haiku-1',
    'routing-guidance-conflict-haiku-1',
    'long-croupier-blackjack-hand-haiku-1',
    'routing-long-session-haiku-1',
    'regress-concierge-spa-booking-haiku-1',
    'regress-concierge-facilities-then-tour-haiku-1',
    'long-concierge-spa-services-haiku-1',
  ],
  // C: a dropped surface with a BOOKING_FORM_MISSING finding (:127, :128, :157).
  'T-0330': ['long-concierge-spa-services-haiku-1', 'routing-long-session-haiku-1'],
  // D: the BookingForm read-back cue (:84), and every Concierge booking flow it can newly fire on.
  'T-0331': [
    'regress-concierge-facilities-then-tour-haiku-1',
    'regress-concierge-spa-booking-haiku-1',
    'regress-concierge-dinner-at-vela-haiku-1',
    'long-concierge-booking-haiku-1',
    'long-concierge-booking-confirm-haiku-1',
    'long-concierge-spa-services-haiku-1',
    'routing-long-session-haiku-1',
    'regress-concierge-facilities-then-tour-sonnet-1',
  ],
  // E: NARRATED_MECHANICS turns, now a reply-only repair (:8, :20, :28, :29, :42, :49, :70, :105, :182, :190, :207,
  // :240, :294, :391).
  'T-0332': [
    'regress-croupier-blackjack-moves-haiku-1',
    'regress-croupier-spanish-21-haiku-1',
    'regress-croupier-pontoon-haiku-1',
    'regress-croupier-texas-holdem-haiku-1',
    'regress-croupier-omaha-haiku-1',
    'regress-croupier-seven-card-stud-haiku-1',
    'regress-admiral-opening-salvo-haiku-1',
    'regress-croupier-blackjack-moves-sonnet-1',
    'regress-croupier-spanish-21-sonnet-1',
    'regress-croupier-texas-holdem-sonnet-1',
    'regress-croupier-seven-card-stud-sonnet-1',
    'routing-domain-switch-sonnet-1',
    'regress-croupier-texas-holdem-opus-1',
  ],
  // G: BOOKING_CONFIRMATION_MISSING on captions (:257, :491; :85 still fires), and the Haiku twin of :491 (:131).
  'T-0333': [
    'regress-concierge-facilities-then-tour-haiku-1',
    'regress-concierge-facilities-then-tour-sonnet-1',
    'routing-long-session-haiku-1',
    'routing-long-session-opus-1',
  ],
  // H: payouts per game (:14, :19, :27, :189), and blackjack staying at 3:2.
  'T-0334': [
    'regress-croupier-pontoon-haiku-1',
    'regress-croupier-spanish-21-haiku-1',
    'regress-croupier-blackjack-rounds-haiku-1',
    'regress-croupier-blackjack-moves-haiku-1',
    'regress-croupier-spanish-21-sonnet-1',
    'regress-croupier-pontoon-sonnet-1',
  ],
  // Retrieval: the Concierge booking confirm turns (:128, :134, :138, :151, :154, :75, :85).
  'T-0335': [
    'long-concierge-booking-haiku-1',
    'long-concierge-booking-confirm-haiku-1',
    'regress-concierge-spa-booking-haiku-1',
    'regress-concierge-facilities-then-tour-haiku-1',
    'routing-long-session-haiku-1',
  ],
}

/** Failed or touched runs left out, and why. */
export const R10_EXCLUDED: Readonly<Record<string, string>> = {
  'regress-croupier-omaha-opus-1': 'cluster F, the PlayingCard type floor (T-0189, still proposed): no round 9 fix touches it and it failed render-lint in rounds 6, 8 and 9 ($1.42)',
  'regress-croupier-five-card-draw-opus-1': 'cluster F, the PlayingCard type floor (T-0189, still proposed): no round 9 fix touches it and it failed render-lint in rounds 6, 8 and 9 ($1.55)',
  'regress-croupier-texas-holdem-opus-1': 'one T-0332 fire (:391); the reply-only repair is measured on 11 Haiku and Sonnet runs ($1.36)',
  'regress-croupier-seven-card-stud-sonnet-1': 'one T-0332 fire (:240); the reply-only repair is measured on 11 Haiku and Sonnet runs, and the cut keeps the estimate under $8 ($0.86)',
}

/** The unstable runs: `blackjack-rounds-haiku` (four causes in rounds 6 to 9) and the other Haiku blackjack-family
 *  openings (BET_TABLE_MISSING on 5 of 7 in round 9). */
export const R10_UNSTABLE: readonly string[] = [
  'regress-croupier-blackjack-rounds-haiku-1',
  'regress-croupier-blackjack-moves-haiku-1',
  'regress-croupier-spanish-21-haiku-1',
  'regress-croupier-pontoon-haiku-1',
  'routing-domain-switch-haiku-1',
  'routing-guidance-conflict-haiku-1',
  'long-croupier-blackjack-hand-haiku-1',
]

/** Per selected round 9 run, the larger of its round 8 and round 9 ledger `costUsd`: the order key and the estimate. */
export const R10_COST: Readonly<Record<string, number>> = {
  'routing-domain-switch-haiku-1': 0.011999,
  'routing-guidance-conflict-haiku-1': 0.01367,
  'long-concierge-spa-services-haiku-1': 0.017316,
  'long-concierge-booking-confirm-haiku-1': 0.017917,
  'regress-concierge-dinner-at-vela-haiku-1': 0.021422,
  'long-concierge-booking-haiku-1': 0.02154,
  'regress-admiral-opening-salvo-haiku-1': 0.025971,
  'long-croupier-blackjack-hand-haiku-1': 0.026319,
  'regress-concierge-spa-booking-haiku-1': 0.028004,
  'regress-concierge-facilities-then-tour-haiku-1': 0.03285,
  'regress-croupier-blackjack-rounds-haiku-1': 0.03305,
  'regress-croupier-texas-holdem-haiku-1': 0.039809,
  'regress-croupier-spanish-21-haiku-1': 0.04185,
  'regress-croupier-pontoon-haiku-1': 0.044572,
  'regress-croupier-omaha-haiku-1': 0.044711,
  'regress-croupier-blackjack-moves-haiku-1': 0.045222,
  'regress-croupier-seven-card-stud-haiku-1': 0.051491,
  'routing-long-session-haiku-1': 0.090287,
  'routing-domain-switch-sonnet-1': 0.282046,
  'regress-concierge-facilities-then-tour-sonnet-1': 0.41966,
  'regress-croupier-blackjack-moves-sonnet-1': 0.671534,
  'regress-croupier-texas-holdem-sonnet-1': 0.709652,
  'regress-croupier-pontoon-sonnet-1': 0.723624,
  'regress-croupier-spanish-21-sonnet-1': 0.913908,
  'routing-long-session-opus-1': 2.436428,
}

export interface Round10Run {
  /** The round 9 run it repeats. */
  of: string
  sample: number
  name: string
  agent: string
  model: RoundModel
  argv: string[]
}

const rename = (argv: string[], name: string): string[] =>
  argv.map((a, i) => (argv[i - 1] === '--out' ? `${ROUND10_DIR}/runs/${name}` : argv[i - 1] === '--name' ? name : a))

/** The selected round 9 runs: failed or touched, minus the exclusions. */
export function round10Selected(): string[] {
  const all = new Set([...R9_FAILED, ...Object.values(R9_FIX_RUNS).flat()])
  return [...all].filter((n) => !(n in R10_EXCLUDED))
}

/** Every run in script order: cheapest first by `R10_COST`, a run's samples together. */
export function round10Runs(): Round10Run[] {
  const byName = new Map(round9Runs().map((r) => [r.name, r]))
  const cost = (name: string): number => {
    const c = R10_COST[name]
    if (c === undefined) throw new Error(`no cost for ${name}`)
    return c
  }
  return round10Selected()
    .sort((a, b) => cost(a) - cost(b))
    .flatMap((of) => {
      const r = byName.get(of)
      if (r === undefined) throw new Error(`no round 9 run ${of}`)
      const samples = R10_UNSTABLE.includes(of) ? R10_SAMPLES : 1
      return Array.from({ length: samples }, (_, i) => {
        const name = `${of.replace(/-1$/, '')}-${i + 1}`
        return { of, sample: i + 1, name, agent: r.agent, model: r.model, argv: rename(r.argv, name) }
      })
    })
}

/** Sum of `R10_COST` over every run, the expected spend. */
export function round10ExpectedUsd(): number {
  return round10Runs().reduce((sum, r) => sum + R10_COST[r.of], 0)
}

/** `.sdlc/evals/rounds/2026-10-17-r10-targeted/live-commands.sh`. */
export function round10CommandsScript(): string {
  const runs = round10Runs()
  const per = (short: string): number => runs.filter((r) => r.model.short === short).length
  const lines = [
    '#!/usr/bin/env bash',
    "# T-0341 live round 10: round 9's failed runs plus the runs each round 9 fix touches (T-0328, T-0330 to T-0335),",
    '# 3 samples on the unstable Haiku blackjack openings. Generated by',
    '# `node --experimental-strip-types scripts/e2e-admin/probe/scenarios/round10.ts`; do not hand-edit.',
    `# Spends API credit through the dev proxy (key in .env, never printed). Cap: $${ROUND10_CAP} in total (Kim 2026-10-17).`,
    `#   node --experimental-strip-types scripts/e2e-admin/probe/run-capped.ts --describe ${ROUND10_FILE}`,
    `#   node --experimental-strip-types scripts/e2e-admin/probe/run-capped.ts ${ROUND10_FILE} --cap ${ROUND10_CAP} --round r10-targeted`,
    `# ${runs.length} runs (Haiku ${per('haiku')}, Sonnet ${per('sonnet')}, Opus ${per('opus')}), cheapest first by the larger of the round 8`,
    `# and 9 costs (expected about $${round10ExpectedUsd().toFixed(2)}). A probe exits 1 when a check fails.`,
    '# Left out:',
    ...Object.entries(R10_EXCLUDED).map(([n, why]) => `#   ${n}: ${why}.`),
    '',
  ]
  for (const run of runs) lines.push(['npm', 'run', 'chat:probe', '--', ...run.argv].map(quote).join(' '))
  return `${lines.join('\n')}\n`
}

if (import.meta.url === `file://${process.argv[1]}`) process.stdout.write(round10CommandsScript())
