// single-pick-check.ts: a single pick asked as a radio list, or an OptionDeck framed in a Card (T-0419), run on every
// catalog that holds OptionDeck.
//
// Kim's ruling (2026-10-22): every persona asks a single pick among two to eight options as ONE OptionDeck whose
// press commits the answer, with the question on the deck's heading and no Card around it (grammar.md, the feed-ask
// archetypes). A RadioGroup or SegmentedControl stays legal only as one field of a larger form. Prose alone is a hint
// (skill a2ui-prompt-authoring, triage item 5), so this check sends the round back:
// - SINGLE_PICK_DECK: an ask surface (`ask-<n>`) whose only input is one RadioGroup or SegmentedControl listing 2 to 8
//   explicit children. A templated list (an object `children`) has no fixed count and is skipped, as is a surface
//   with any other input beside it (a form).
// - OPTION_DECK_WRAPPED: an OptionDeck with a Card ancestor, through `child` or explicit `children` ids, on any surface.
// It reads OptionDeck (the repair names it), so it `requires` that.
// DOM-less and node-free, like `semantic-check.ts`: both server hosts import it.

import type { A2uiComponent } from '../protocol.ts'
import type { SemanticCheck, SemanticFinding, SurfaceView } from './semantic-check.ts'
import { OPTION_DECK_MAX, OPTION_DECK_MIN } from './option-deck-check.ts'

/** The feed ask surface id the grammar mints (`ask-1`, `ask-2`, ...). */
const ASK_SURFACE = /^ask-\d+$/

/** The two one-of controls a single pick used to wear. */
const PICK_TYPES = new Set(['RadioGroup', 'SegmentedControl'])

/** Every other input type: one of these beside the pick makes the surface a form, where the pick is a field. */
const OTHER_INPUTS = new Set([
  'TextField', 'Textarea', 'Calendar', 'Select', 'ComboBox', 'MultiSelect', 'Slider', 'SliderMulti', 'Checkbox',
  'Switch', 'AmountPicker', 'ChoiceGroup', 'FileDrop', 'Rating', 'OptionDeck', 'OptionCompare',
])

/** The ids a component lists as `child` or explicit `children` (a template ChildList names no fixed ids). */
const childIds = (c: A2uiComponent): string[] => [
  ...(typeof c.child === 'string' ? [c.child] : []),
  ...(Array.isArray(c.children) ? c.children.filter((id): id is string => typeof id === 'string') : []),
]

/** The Card that holds `id`, walking parent edges up (cycle-safe), or undefined. */
function cardAncestor(view: SurfaceView, id: string): A2uiComponent | undefined {
  const parentOf = new Map<string, A2uiComponent>()
  for (const c of view.components.values()) for (const kid of childIds(c)) if (!parentOf.has(kid)) parentOf.set(kid, c)
  const seen = new Set<string>([id])
  for (let p = parentOf.get(id); p !== undefined && !seen.has(p.id); p = parentOf.get(p.id)) {
    if (p.component === 'Card') return p
    seen.add(p.id)
  }
  return undefined
}

export const singlePickCheck: SemanticCheck = {
  id: 'single-pick',
  requires: ['OptionDeck'],
  check({ surfaces }): readonly SemanticFinding[] {
    const findings: SemanticFinding[] = []
    for (const view of surfaces) {
      const all = [...view.components.values()]
      if (ASK_SURFACE.test(view.surfaceId)) {
        const picks = all.filter((c) => PICK_TYPES.has(c.component))
        const pick = picks.length === 1 ? picks[0]! : undefined
        const n = pick !== undefined && Array.isArray(pick.children) ? pick.children.length : 0
        if (pick !== undefined && n >= OPTION_DECK_MIN && n <= OPTION_DECK_MAX && !all.some((c) => OTHER_INPUTS.has(c.component))) {
          findings.push({
            code: 'SINGLE_PICK_DECK',
            path: `${view.surfaceId}:${pick.id}`,
            message:
              `${view.surfaceId} asks a single pick as ${pick.component} ${pick.id} of ${n} options with nothing else to fill in. ` +
              `Ask it as ONE OptionDeck with "actionName":"choose", the question as its "heading" and one option per choice (a "value", a "title", a one-line "description" and an "icon"), ` +
              `and drop ${pick.id}, its options, the commit Button and any Card around them: the deck's press is the answer.`,
          })
        }
      }
      for (const deck of all) {
        if (deck.component !== 'OptionDeck') continue
        const card = cardAncestor(view, deck.id)
        if (card === undefined) continue
        findings.push({
          code: 'OPTION_DECK_WRAPPED',
          path: `${view.surfaceId}:${deck.id}`,
          message:
            `${view.surfaceId} frames OptionDeck ${deck.id} in Card ${card.id}, a box around a control whose cards are already the choice. ` +
            `Put ${deck.id} directly in the surface's flow where ${card.id} sits, its question on the deck's "heading", and drop ${card.id} and its parts.`,
        })
      }
    }
    return findings
  },
}
