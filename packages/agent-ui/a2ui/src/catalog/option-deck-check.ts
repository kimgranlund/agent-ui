// option-deck-check.ts: an OptionDeck sized outside its job (T-0193), run on every catalog that holds OptionDeck.
//
// An OptionDeck is a pick of one of a few things to start (a game, an experience, a plan, an onboarding path). The
// control renders any number of cards, so the validator passes a deck of one (nothing to pick) or of twenty (a wall
// no one scans). This check sends such a round back: a static `options` array with fewer than 2 or more than 8
// entries gets OPTION_DECK_COUNT. A bound `options` (`{path}`) is skipped: its length is the data model's, not the
// payload's. The key `random` is reserved for the Surprise me card (`allowRandom`), and the control drops an authored
// option that claims it, so a static option with value `random` gets OPTION_DECK_RANDOM_VALUE.
// It reads only OptionDeck, so it `requires` that.
// DOM-less and node-free, like `semantic-check.ts`: both server hosts import it.

import type { SemanticCheck, SemanticFinding } from './semantic-check.ts'

/** The fewest and most options a deck may hold. */
export const OPTION_DECK_MIN = 2
export const OPTION_DECK_MAX = 8

/** The key the Surprise me card commits (`RANDOM_KEY` in option-deck-model.ts; a catalog module never imports a control). */
const RANDOM_KEY = 'random'

export const optionDeckCountCheck: SemanticCheck = {
  id: 'option-deck-count',
  requires: ['OptionDeck'],
  check({ surfaces }): readonly SemanticFinding[] {
    const findings: SemanticFinding[] = []
    for (const view of surfaces) {
      for (const deck of view.components.values()) {
        if (deck.component !== 'OptionDeck' || !Array.isArray(deck['options'])) continue
        const options = deck['options'] as unknown[]
        const path = `${view.surfaceId}:${deck.id}`
        const n = options.length
        if (n < OPTION_DECK_MIN) {
          findings.push({
            code: 'OPTION_DECK_COUNT',
            path,
            message:
              `OptionDeck ${deck.id} on ${view.surfaceId} holds ${n} option${n === 1 ? '' : 's'}, so there is nothing to pick. ` +
              `Give it ${OPTION_DECK_MIN} to ${OPTION_DECK_MAX} options, each a concrete thing to start, or drop the deck and offer the one action as a Button.`,
          })
        } else if (n > OPTION_DECK_MAX) {
          findings.push({
            code: 'OPTION_DECK_COUNT',
            path,
            message:
              `OptionDeck ${deck.id} on ${view.surfaceId} holds ${n} options, more than the ${OPTION_DECK_MAX} a deck shows at a glance. ` +
              `Keep the ${OPTION_DECK_MAX} strongest options, or offer the long list as a Select.`,
          })
        }
        const reserved = options.some((o) => typeof o === 'object' && o !== null && String((o as { value?: unknown }).value ?? '').trim() === RANDOM_KEY)
        if (reserved) {
          findings.push({
            code: 'OPTION_DECK_RANDOM_VALUE',
            path,
            message:
              `OptionDeck ${deck.id} on ${view.surfaceId} has an option whose value is "${RANDOM_KEY}", the key the random card commits, so the deck drops it. ` +
              `Give that option a concrete value, and set allowRandom true for a random pick.`,
          })
        }
      }
    }
    return findings
  },
}
