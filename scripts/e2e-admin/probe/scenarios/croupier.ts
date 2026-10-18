// scripts/e2e-admin/probe/scenarios/croupier.ts: the Croupier closed-loop scenarios (T-0184). One scenario
// per game in the Croupier's game-rules pack (`GAMES_RULES`, site/pages/agent-admin-libraries.ts), blackjack
// twice; each plays three rounds as `npm run chat:probe` steps. `live-commands.sh` in the ticket folder is
// this file expanded (scenario x model x sample, Haiku first); `croupier.test.mjs` pins the two together.
//
// Clicks only where the label is fixed: the CardTable bet strip ("25" to "250"), "Deal again" (the round-loop
// teaching) and blackjack's "Hit" and "Stand". Every other move is a `--say`, so a model-authored label
// (Twist, Fold, Surrender) cannot stop the run. A deal is random: a click whose button the hand took away (a
// bust before Stand) fails `click-target` by name and ends that run, which the report classifies. T-0347: a natural
// settles the hand on the deal, so the live-round blackjack-family steps carry `--skip-if-phase settled` (below).
//
// T-0222: the opening step and every Deal again carry `--expect-turn` for the game's table component, so a deal
// answered in prose fails that turn. Other moves carry none: a refused illegal move is answered in prose on purpose.
//
// Run `node --experimental-strip-types scripts/e2e-admin/probe/scenarios/croupier.ts` to print the script.

import { click, quote, say, stepArgv, type ProbeStep } from '../model.ts'
import type { ScenarioTag } from './round.ts'

export interface CroupierScenario {
  name: string
  tags: readonly ScenarioTag[]
  /** The `GAMES_RULES` label the scenario plays. */
  game: string
  steps: ProbeStep[]
  expectComponents: string[]
}

const DEAL_AGAIN = click('Deal again')
const CHECK_OR_CALL = 'Check, or call if there is a bet.'
/** T-0283: a stud street that is harmless on a finished hand, so the step after the last street is still Deal again. */
export const STUD_STREET = 'Check, or call if there is a bet. If the hand is already over, leave the table as it is.'

/** T-0370 (live round 11 cluster J, :37 to :38): pontoon forbids sticking under 15, so "Buy a card." then "Stick." on a
 *  hand of 14 is refused by the rules, the hand never settles and Deal again finds no button on the newest table. The
 *  agent was right. This step follows round 2's Stick: a settled hand skips it (`--skip-if-phase settled`), a refused
 *  stick plays it, and it twists to 15 or more and sticks (or busts), so the hand is over before Deal again. Like
 *  STUD_STREET (T-0283) it is harmless on a finished hand. */
export const TWIST_TO_STICK = 'If the hand is still in play, twist while it is under 15, then stick. If the hand is already over, leave the table as it is.'

const SCENARIOS: readonly CroupierScenario[] = [
  {
    name: 'blackjack-rounds',
    tags: ['regression'],
    game: 'blackjack',
    steps: [say("Let's play blackjack."), click('100'), click('Stand'), DEAL_AGAIN, click('50'), click('Hit'), click('Stand'), DEAL_AGAIN, click('25'), click('Stand')],
    expectComponents: ['CardTable'],
  },
  {
    name: 'blackjack-moves',
    tags: ['regression'],
    game: 'blackjack',
    steps: [say('Blackjack, please.'), click('250'), say('Double down.'), DEAL_AGAIN, click('100'), say('Hit me until I bust.'), say('Hit me again.'), DEAL_AGAIN, click('75'), say('Split if you can, otherwise stand.')],
    expectComponents: ['CardTable'],
  },
  {
    name: 'spanish-21',
    tags: ['regression'],
    game: 'spanish-21',
    steps: [say("Let's play Spanish 21."), click('100'), click('Stand'), DEAL_AGAIN, click('100'), say('Late surrender.'), DEAL_AGAIN, click('50'), say('Hit.'), say('Stand.')],
    expectComponents: ['CardTable'],
  },
  {
    name: 'pontoon',
    tags: ['regression'],
    game: 'pontoon',
    steps: [say("Let's play pontoon."), click('100'), say('Twist.'), say('Stick.'), DEAL_AGAIN, click('100'), say('Buy a card.'), say('Stick.'), DEAL_AGAIN, click('50'), say('Stick.')],
    expectComponents: ['CardTable'],
  },
  // Poker (T-0184 live run): a betting round can need a call (the blinds, a dealer bet) and pot-limit caps a bet,
  // so each street is one "check, or call" move and round 1 plays every street to the showdown before Deal again.
  {
    name: 'texas-holdem',
    tags: ['regression'],
    game: 'texas-holdem',
    steps: [say("Let's play Texas hold'em."), say(CHECK_OR_CALL), say('Bet 50.'), say(CHECK_OR_CALL), say(CHECK_OR_CALL), DEAL_AGAIN, say('Fold.'), DEAL_AGAIN, say('Raise 100.'), say(CHECK_OR_CALL)],
    expectComponents: ['PlayingCard'],
  },
  {
    name: 'omaha',
    tags: ['regression'],
    game: 'omaha',
    steps: [say("Let's play Omaha."), say(CHECK_OR_CALL), say('Bet the pot.'), say(CHECK_OR_CALL), say(CHECK_OR_CALL), DEAL_AGAIN, say('Fold.'), DEAL_AGAIN, say('Bet the pot.'), say(CHECK_OR_CALL)],
    expectComponents: ['PlayingCard'],
  },
  {
    name: 'five-card-draw',
    tags: ['regression'],
    game: 'five-card-draw',
    steps: [say("Let's play five-card draw."), say(CHECK_OR_CALL), say('Discard my two lowest cards and draw.'), say('Bet 50.'), DEAL_AGAIN, say('Fold.'), DEAL_AGAIN, say(CHECK_OR_CALL), say('Stand pat, no discards.'), say(CHECK_OR_CALL)],
    expectComponents: ['PlayingCard'],
  },
  {
    name: 'seven-card-stud',
    tags: ['regression'],
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
 *  refuses "Bring it in" and "Bet 25" (live round 3, Opus and Haiku), so every round 1 street is a check or call. T-0283:
 *  the spare sixth check reached a hand Opus had already settled (live round 4), which it read as "deal again" and
 *  opened round 2 in prose, so Deal again found no button. Round 1 has one step per betting round, five, and each
 *  leaves a finished hand on the table, so Deal again comes next however early the hand ends. T-0325: in hold'em the
 *  dealer folded to "Bet 50." (live round 8, Opus) and the next scripted check started round 2, so every step after a
 *  bet or a raise is that harmless street too. */
const ROUND_STEPS: Readonly<Record<string, ProbeStep[]>> = {
  'blackjack-rounds': [say("Let's play blackjack."), click('100'), click('Stand'), DEAL_AGAIN, click('50'), click('Hit'), say('Stand.'), DEAL_AGAIN, click('25'), click('Stand')],
  'texas-holdem': [say("Let's play Texas hold'em."), say(CHECK_OR_CALL), say('Bet 50.'), say(STUD_STREET), say(STUD_STREET), DEAL_AGAIN, say('Fold.'), DEAL_AGAIN, say('Raise 100.'), say(STUD_STREET)],
  'seven-card-stud': [say("Let's play seven-card stud."), ...Array.from({ length: 5 }, () => say(STUD_STREET)), DEAL_AGAIN, say('Fold.'), DEAL_AGAIN, say('Bet 50.')],
  pontoon: [say("Let's play pontoon."), click('100'), say('Twist.'), say('Stick.'), DEAL_AGAIN, click('100'), say('Buy a card.'), say('Stick.'), say(TWIST_TO_STICK), DEAL_AGAIN, click('50'), say('Stick.')],
}

/** T-0347 (live round 10 cluster D, :80 and :101 to :103): a natural settles the hand on the deal, and the scripted
 *  in-hand steps after the bet (Stand, Twist, Stick, Buy a card) then have no button, or a model that answers one in
 *  prose opens a new table the next Deal again misses. The agent was right, so every in-hand step of the blackjack family
 *  carries `--skip-if-phase settled`: the probe does not play it while the newest table is settled, so a hand a natural
 *  ended is skipped and Deal again comes next (`stepSkip`). The opening, a bet and Deal again stay unmarked, and so
 *  does blackjack-moves' "Hit me again.", which probes a hit on a busted table. */
const BLACKJACK_FAMILY = ['blackjack-rounds', 'blackjack-moves', 'spanish-21', 'pontoon']
const SKIP_PHASE = 'settled'
const isBet = (step: ProbeStep): boolean => 'click' in step && /^\d+$/.test(step.click)
/** Played on a settled table on purpose: the post-bust probe of blackjack-moves. */
const HIT_AFTER_BUST = 'Hit me again.'
const skipOnNatural = (s: CroupierScenario): CroupierScenario =>
  BLACKJACK_FAMILY.includes(s.name)
    ? { ...s, steps: s.steps.map((step, i) => (i === 0 || step === DEAL_AGAIN || isBet(step) || ('say' in step && step.say === HIT_AFTER_BUST) ? step : { ...step, skipIfPhase: SKIP_PHASE })) }
    : s

/** What every finished round's committed `live-commands.sh` predates: the T-0347 flag and the T-0370 pontoon follow-up
 *  step. A finished run record is never rewritten, so each finished round's pin compares its committed file with the
 *  generator's output minus both. */
const TWIST_TO_STICK_ARGS = ` ${stepArgv({ say: TWIST_TO_STICK, skipIfPhase: SKIP_PHASE }).map(quote).join(' ')}`
export const withoutSkipMarks = (script: string): string => script.replaceAll(TWIST_TO_STICK_ARGS, '').replaceAll(` --skip-if-phase ${SKIP_PHASE}`, '')

/** The live-round scenarios: SCENARIOS with the round's fixes. */
export const CROUPIER_ROUND_SCENARIOS: readonly CroupierScenario[] = SCENARIOS.map((s) => withDealExpect(skipOnNatural({ ...s, steps: ROUND_STEPS[s.name] ?? s.steps })))

/** T-0343: the smoke case, the deal and a bet, each on the table. A natural after the bet still leaves the table, so no
 *  step needs `--skip-if-phase`. */
export const CROUPIER_SMOKE: CroupierScenario = {
  name: 'blackjack-deal',
  game: 'blackjack',
  tags: ['smoke'],
  steps: [say("Let's play blackjack.", 'CardTable'), click('100', 'CardTable')],
  expectComponents: ['CardTable'],
}

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
    ...scenario.steps.flatMap(stepArgv),
    ...scenario.expectComponents.flatMap((c) => ['--expect-component', c]),
    '--out', `${RUNS_DIR}/${name}`,
    '--name', name,
  ]
}

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
