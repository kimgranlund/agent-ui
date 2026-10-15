// scripts/e2e-admin/probe/scenarios/croupier.ts: the Croupier closed-loop scenarios (T-0184). One scenario
// per game in the Croupier's game-rules pack (`GAMES_RULES`, site/pages/agent-admin-libraries.ts), blackjack
// twice; each plays three rounds as `npm run chat:probe` steps. `live-commands.sh` in the ticket folder is
// this file expanded (scenario x model x sample, Haiku first); `croupier.test.mjs` pins the two together.
//
// Clicks only where the label is fixed: the CardTable bet strip ("25" to "250"), "Deal again" (the round-loop
// teaching) and blackjack's "Hit" and "Stand". Every other move is a `--say`, so a model-authored label
// (Twist, Fold, Surrender) cannot stop the run. A deal is random: a click whose button the hand took away (a
// natural, a bust before Stand) fails `click-target` by name and ends that run, which the report classifies.
//
// T-0222: the opening step and every Deal again carry `--expect-turn` for the game's table component, so a deal
// answered in prose fails that turn. Other moves carry none: a refused illegal move is answered in prose on purpose.
//
// Run `node --experimental-strip-types scripts/e2e-admin/probe/scenarios/croupier.ts` to print the script.

import type { ProbeStep } from '../model.ts'

export interface CroupierScenario {
  name: string
  /** The `GAMES_RULES` label the scenario plays. */
  game: string
  steps: ProbeStep[]
  expectComponents: string[]
}

const say = (text: string): ProbeStep => ({ say: text })
const click = (label: string): ProbeStep => ({ click: label })
const DEAL_AGAIN = click('Deal again')
const CHECK_OR_CALL = 'Check, or call if there is a bet.'

const SCENARIOS: readonly CroupierScenario[] = [
  {
    name: 'blackjack-rounds',
    game: 'blackjack',
    steps: [say("Let's play blackjack."), click('100'), click('Stand'), DEAL_AGAIN, click('50'), click('Hit'), click('Stand'), DEAL_AGAIN, click('25'), click('Stand')],
    expectComponents: ['CardTable'],
  },
  {
    name: 'blackjack-moves',
    game: 'blackjack',
    steps: [say('Blackjack, please.'), click('250'), say('Double down.'), DEAL_AGAIN, click('100'), say('Hit me until I bust.'), say('Hit me again.'), DEAL_AGAIN, click('75'), say('Split if you can, otherwise stand.')],
    expectComponents: ['CardTable'],
  },
  {
    name: 'spanish-21',
    game: 'spanish-21',
    steps: [say("Let's play Spanish 21."), click('100'), click('Stand'), DEAL_AGAIN, click('100'), say('Late surrender.'), DEAL_AGAIN, click('50'), say('Hit.'), say('Stand.')],
    expectComponents: ['CardTable'],
  },
  {
    name: 'pontoon',
    game: 'pontoon',
    steps: [say("Let's play pontoon."), click('100'), say('Twist.'), say('Stick.'), DEAL_AGAIN, click('100'), say('Buy a card.'), say('Stick.'), DEAL_AGAIN, click('50'), say('Stick.')],
    expectComponents: ['CardTable'],
  },
  // Poker (T-0184 live run): a betting round can need a call (the blinds, a dealer bet) and pot-limit caps a bet,
  // so each street is one "check, or call" move and round 1 plays every street to the showdown before Deal again.
  {
    name: 'texas-holdem',
    game: 'texas-holdem',
    steps: [say("Let's play Texas hold'em."), say(CHECK_OR_CALL), say('Bet 50.'), say(CHECK_OR_CALL), say(CHECK_OR_CALL), DEAL_AGAIN, say('Fold.'), DEAL_AGAIN, say('Raise 100.'), say(CHECK_OR_CALL)],
    expectComponents: ['PlayingCard'],
  },
  {
    name: 'omaha',
    game: 'omaha',
    steps: [say("Let's play Omaha."), say(CHECK_OR_CALL), say('Bet the pot.'), say(CHECK_OR_CALL), say(CHECK_OR_CALL), DEAL_AGAIN, say('Fold.'), DEAL_AGAIN, say('Bet the pot.'), say(CHECK_OR_CALL)],
    expectComponents: ['PlayingCard'],
  },
  {
    name: 'five-card-draw',
    game: 'five-card-draw',
    steps: [say("Let's play five-card draw."), say(CHECK_OR_CALL), say('Discard my two lowest cards and draw.'), say('Bet 50.'), DEAL_AGAIN, say('Fold.'), DEAL_AGAIN, say(CHECK_OR_CALL), say('Stand pat, no discards.'), say(CHECK_OR_CALL)],
    expectComponents: ['PlayingCard'],
  },
  {
    name: 'seven-card-stud',
    game: 'seven-card-stud',
    steps: [say("Let's play seven-card stud."), say('Bring it in, or check, or call.'), say('Bet 25.'), say(CHECK_OR_CALL), say(CHECK_OR_CALL), say(CHECK_OR_CALL), DEAL_AGAIN, say('Fold.'), DEAL_AGAIN, say('Bet 50.')],
    expectComponents: ['PlayingCard'],
  },
]

/** The deals (the opening step and every Deal again) expect the table component. */
const withDealExpect = (s: CroupierScenario): CroupierScenario => ({
  ...s,
  steps: s.steps.map((step, i) => (i === 0 || step === DEAL_AGAIN ? { ...step, expect: s.expectComponents } : step)),
})

/** Each scenario with its deals expecting the table component. */
export const CROUPIER_SCENARIOS: readonly CroupierScenario[] = SCENARIOS.map(withDealExpect)

/** Scenario defects live round 2 found (T-0225 report), fixed for the next round only: the T-0184 `live-commands.sh`
 *  is a finished run record built from SCENARIOS as they were. A Hit can bust, so the Stand after it is a `--say` (Opus
 *  5.5 busted and found no Stand). Stud has five betting streets, so round 1 needs one more check before Deal again
 *  (all three models were still on seventh street). T-0272: a house that deals fixed-limit stud with no bring-in
 *  refuses "Bring it in" and "Bet 25" (live round 3, Opus and Haiku), so every round 1 street is a check or call: six
 *  of them for five streets, one spare. */
const ROUND_STEPS: Readonly<Record<string, ProbeStep[]>> = {
  'blackjack-rounds': [say("Let's play blackjack."), click('100'), click('Stand'), DEAL_AGAIN, click('50'), click('Hit'), say('Stand.'), DEAL_AGAIN, click('25'), click('Stand')],
  'seven-card-stud': [say("Let's play seven-card stud."), ...Array.from({ length: 6 }, () => say(CHECK_OR_CALL)), DEAL_AGAIN, say('Fold.'), DEAL_AGAIN, say('Bet 50.')],
}

/** The live-round scenarios: SCENARIOS with the round's fixes. */
export const CROUPIER_ROUND_SCENARIOS: readonly CroupierScenario[] = SCENARIOS.map((s) => withDealExpect({ ...s, steps: ROUND_STEPS[s.name] ?? s.steps }))

/** The picker's Anthropic 5.5 models in spend order (Opus 5.5 joined the picker in T-0185; live round 2, T-0225). */
export const CROUPIER_MODELS: ReadonlyArray<{ id: string; short: string }> = [
  { id: 'claude-haiku-5-5', short: 'haiku' },
  { id: 'claude-sonnet-5-5', short: 'sonnet' },
  { id: 'claude-opus-5-5', short: 'opus' },
]

/** The T-0184 run's models: its `live-commands.sh` is a finished run record, so its script keeps these two. */
export const T0184_MODELS = CROUPIER_MODELS.slice(0, 2)

export const SAMPLES = 2
export const RUNS_DIR = '.sdlc/evals/rounds/2026-10-14-r1-croupier/runs'

/** The probe argv for one scenario x model x sample (default effort: no `--effort`). */
export function probeArgv(scenario: CroupierScenario, model: { id: string; short: string }, sample: number): string[] {
  const name = `${scenario.name}-${model.short}-${sample}`
  return [
    '--agent', 'croupier',
    '--model', model.id,
    ...scenario.steps.flatMap((s) => [...('say' in s ? ['--say', s.say] : 'click' in s ? ['--click', s.click] : []), ...(s.expect ?? []).flatMap((c) => ['--expect-turn', c])]),
    ...scenario.expectComponents.flatMap((c) => ['--expect-component', c]),
    '--out', `${RUNS_DIR}/${name}`,
    '--name', name,
  ]
}

export const quote = (arg: string): string => (/^[A-Za-z0-9_./:-]+$/.test(arg) ? arg : `"${arg.replace(/(["\\$`])/g, '\\$1')}"`)

/** `live-commands.sh`: every model's runs in order, sample 1 of every scenario before sample 2. */
export function liveCommandsScript(): string {
  const lines = [
    '#!/usr/bin/env bash',
    '# T-0184 Croupier closed-loop live runs. Generated by',
    '# `node --experimental-strip-types scripts/e2e-admin/probe/scenarios/croupier.ts`; do not hand-edit.',
    '# Spends API credit through the dev proxy (key in .env, never printed). Cap: $5 in total (Kim 2026-10-14).',
    '# Run top to bottom and stop at the cap: Haiku 5.5 first, then Sonnet 5.5; sample 1 of every game before',
    '# sample 2, so a stop at the cap still leaves every game x model cell with one run where it can.',
    '# A probe exits 1 when a check fails; the script goes on to the next run.',
  ]
  for (const model of T0184_MODELS) {
    for (let sample = 1; sample <= SAMPLES; sample += 1) {
      lines.push('', `# ${model.id}, sample ${sample}`)
      for (const scenario of CROUPIER_SCENARIOS) lines.push(['npm', 'run', 'chat:probe', '--', ...probeArgv(scenario, model, sample)].map(quote).join(' '))
    }
  }
  return `${lines.join('\n')}\n`
}

if (import.meta.url === `file://${process.argv[1]}`) process.stdout.write(liveCommandsScript())
