// factories.ts — the `croupier` persona's factory table (SPEC-R1, GH #497). One promoted type,
// `PlayingCard` — closes the unconstrained rank/suit string the `card-layout` mini-skill used to teach
// as prose (glyph formatting, face-down handling) into a real, enum-constrained catalog row (the decomp
// note's §1 argument: a malformed card is now a `CATALOG` validation failure, not a silent formatting
// defect). No composite-binding complexity here (unlike concierge's `BookingForm`) — `rank`/`suit`/
// `faceDown` are three ORDINARY top-level bindable props, each resolved independently by the renderer's
// normal per-prop reactive bind-effect (widget.ts); nothing nested, nothing needing surface access
// inside the factory.
//
// `targetCatalogs` (both shipped bases): this factory builds DIRECTLY against `@agent-ui/components`
// (`ui-card`/`ui-text`), never through either base's OWN dialect — the same "no dialect-fit question"
// reasoning as `concierge/index.ts`.

import '@agent-ui/components/components' // self-defines ui-card/ui-text on import
import type { WidgetFactory } from '../../types.ts'

const SUIT_GLYPH: Record<string, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
}

interface PlayingCardState {
  rank: string | null
  suit: string | null
  faceDown: boolean
}

const cardState = new WeakMap<HTMLElement, PlayingCardState>()

/** Re-derive the card's visible glyph text + brightness from its current rank/suit/faceDown state. */
function render(el: HTMLElement, textEl: HTMLElement): void {
  const state = cardState.get(el)
  if (state === undefined) return
  if (state.faceDown) {
    ;(el as unknown as { brightness: string }).brightness = '-1'
    textEl.textContent = '🂠'
    return
  }
  ;(el as unknown as { brightness: string }).brightness = '0'
  const glyph = state.suit === null ? '' : (SUIT_GLYPH[state.suit] ?? '')
  textEl.textContent = state.rank === null ? '' : `${state.rank}${glyph}`
}

/**
 * `PlayingCard` → `ui-card` (brightness "-1" when face-down) holding one `ui-text` (variant "h3",
 * emphasis true) whose content is the derived rank+suit glyph pair, or "🂠" when face-down (catalog
 * LLD-C5, GH #497).
 */
export const playingCardFactory: WidgetFactory = {
  tag: 'ui-card',
  create: () => {
    const el = document.createElement('ui-card')
    const textEl = document.createElement('ui-text')
    ;(textEl as unknown as { as: string; variant: string; size: string; emphasis: boolean }).as = 'h3'
    ;(textEl as unknown as { as: string; variant: string; size: string; emphasis: boolean }).variant = 'title'
    ;(textEl as unknown as { as: string; variant: string; size: string; emphasis: boolean }).size = 'lg'
    ;(textEl as unknown as { as: string; variant: string; size: string; emphasis: boolean }).emphasis = true
    el.appendChild(textEl)
    cardState.set(el, { rank: null, suit: null, faceDown: false })
    return el
  },
  applyProp: (el, prop, value) => {
    const state = cardState.get(el)
    if (state === undefined) return
    switch (prop) {
      case 'rank':
        state.rank = value == null ? null : String(value)
        break
      case 'suit':
        state.suit = value == null ? null : String(value)
        break
      case 'faceDown':
        state.faceDown = Boolean(value)
        break
      default:
        return
    }
    const textEl = el.querySelector('ui-text')
    if (textEl instanceof HTMLElement) render(el, textEl)
  },
}

/** Every component the fragment's `catalog.json` declares MUST appear here (the FACTORY_MISSING
 *  precondition, mirroring `fixture-demo/factories.ts`). */
export const croupierFactories: Record<string, WidgetFactory> = {
  PlayingCard: playingCardFactory,
}
