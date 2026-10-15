// scripts/e2e-admin/probe/scenarios/admiral.ts: the Admiral (Battleship) scenarios for live round 2 (T-0225). The
// `board-grid` skill and `battle-rounds` playbook (site/pages/agent-admin-libraries.ts) teach ONE clickable
// BoardGrid for their waters, ships remaining and shots fired on ONE GameHud, and ONE ResultCard when a fleet is
// sunk; the default catalog's `selection.json` routes "a board with clickable cells" to BoardGrid and "a settled
// game outcome" to ResultCard. The game start and every shot expect BoardGrid on their turn, a concession
// expects ResultCard.
//
// Every shot is a `--say`: a BoardGrid cell has no fixed button label to click.

import type { ProbeStep } from '../model.ts'
import type { RoundScenario } from './round.ts'

const say = (text: string, ...expect: string[]): ProbeStep => (expect.length ? { say: text, expect } : { say: text })
const fire = (cell: string): ProbeStep => say(`Fire at ${cell}.`, 'BoardGrid')

export const ADMIRAL_SCENARIOS: readonly RoundScenario[] = [
  {
    name: 'opening-salvo',
    steps: [say("Let's play Battleship.", 'BoardGrid'), fire('A1'), fire('C3'), fire('D4'), fire('F6')],
    expectComponents: ['BoardGrid', 'GameHud'],
  },
  {
    name: 'concede',
    steps: [say('New game of Battleship.', 'BoardGrid'), fire('B2'), fire('B3'), say('I surrender. Reveal your fleet.', 'ResultCard')],
    expectComponents: ['BoardGrid', 'GameHud', 'ResultCard'],
  },
  {
    name: 'row-sweep',
    steps: [say('Battleship, please.', 'BoardGrid'), fire('A1'), fire('A2'), fire('A3'), fire('A4'), fire('A5'), fire('A6'), say('How many of your ships are still afloat?')],
    expectComponents: ['BoardGrid', 'GameHud'],
  },
]

export const ADMIRAL_MODELS: ReadonlyArray<{ id: string; short: string }> = [
  { id: 'claude-haiku-5-5', short: 'haiku' },
  { id: 'claude-sonnet-5-5', short: 'sonnet' },
]
