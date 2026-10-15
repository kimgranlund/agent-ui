// scripts/e2e-admin/probe/scenarios/lexicographer.ts: the Lexicographer scenarios for live round 2 (T-0225). The
// `word-tiles` skill (site/pages/agent-admin-libraries.ts) teaches ONE BoardGrid of guesses, ONE GameHud for
// guesses used and status, and ONE ResultCard at the end; the default catalog's `selection.json` routes "a board
// of cells to target or mark" to BoardGrid and "a settled game outcome" to ResultCard. A game start and every
// valid guess expect BoardGrid on their turn, a give-up expects ResultCard. A guess the model must refuse (not
// five letters) carries no `--expect-turn`: it is answered in prose on purpose.
//
// Every move is a `--say`: a guess typed into the model's TextField has no fixed label to click.

import type { ProbeStep } from '../model.ts'
import type { RoundScenario } from './round.ts'

const say = (text: string, ...expect: string[]): ProbeStep => (expect.length ? { say: text, expect } : { say: text })

export const LEXICOGRAPHER_SCENARIOS: readonly RoundScenario[] = [
  {
    name: 'six-guesses',
    steps: [
      say("Let's play the word game.", 'BoardGrid'),
      say('My guess: crane.', 'BoardGrid'),
      say('My guess: slate.', 'BoardGrid'),
      say('My guess: pious.', 'BoardGrid'),
      say('Can I have a hint?'),
      say('My guess: flock.', 'BoardGrid'),
    ],
    expectComponents: ['BoardGrid', 'GameHud'],
  },
  {
    name: 'give-up',
    steps: [
      say('Start a new word game.', 'BoardGrid'),
      say('My guess: audio.', 'BoardGrid'),
      say('My guess: stern.', 'BoardGrid'),
      say('I give up. What was the word?', 'ResultCard'),
    ],
    expectComponents: ['BoardGrid', 'GameHud', 'ResultCard'],
  },
  {
    name: 'invalid-then-replay',
    steps: [
      say('New word game, please.', 'BoardGrid'),
      say('My guess: cat.'),
      say('My guess: ghost.', 'BoardGrid'),
      say('My guess: brine.', 'BoardGrid'),
      say('I give up.', 'ResultCard'),
      say('Play again.', 'BoardGrid'),
    ],
    expectComponents: ['BoardGrid', 'GameHud', 'ResultCard'],
  },
]

export const LEXICOGRAPHER_MODELS: ReadonlyArray<{ id: string; short: string }> = [
  { id: 'claude-haiku-5-5', short: 'haiku' },
  { id: 'claude-sonnet-5-5', short: 'sonnet' },
]
