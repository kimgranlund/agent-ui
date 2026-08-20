// factories.ts — the `croupier` persona's factory table (SPEC-R1, GH #497; ADR-0225 retarget, GH #1478).
// One promoted type, `PlayingCard` — closes the unconstrained rank/suit string the `card-layout`
// mini-skill used to teach as prose (glyph formatting, face-down handling) into a real, enum-constrained
// catalog row (the decomp note's §1 argument: a malformed card is now a `CATALOG` validation failure,
// not a silent formatting defect). No composite-binding complexity here (unlike concierge's
// `BookingForm`) — `rank`/`suit`/`faceDown` are three ORDINARY top-level bindable props, each resolved
// independently by the renderer's normal per-prop reactive bind-effect (widget.ts); nothing nested,
// nothing needing surface access inside the factory.
//
// ADR-0225 retarget: the factory is now a DIRECT pass-through onto the real fleet component
// `ui-playing-card` (the component owns all rank/suit/faceDown → face/back derivation) — `SUIT_GLYPH`,
// the `PlayingCardState` WeakMap, and the old `render()` glyph-composition helper are RETIRED (the old
// `ui-card` + `ui-text` + 🂠-glyph composition this factory used to build is gone). The wire contract
// (catalog.json — the enum shapes, `mapsTo`, bindability) is byte-untouched: only the RENDERING target
// changed, from a composed proxy to the real component.
//
// `targetCatalogs` (both shipped bases): this factory builds DIRECTLY against `@agent-ui/components`
// (`ui-playing-card`), never through either base's OWN dialect — the same "no dialect-fit question"
// reasoning as `concierge/index.ts`.

import '@agent-ui/components/components' // self-defines ui-playing-card (+ the rest of the fleet) on import
import type { WidgetFactory } from '../../types.ts'

export const playingCardFactory: WidgetFactory = {
  tag: 'ui-playing-card',
  create: () => document.createElement('ui-playing-card'),
  applyProp: (el, prop, value) => {
    switch (prop) {
      case 'rank':
        ;(el as unknown as { rank: string }).rank = value == null ? '' : String(value)
        break
      case 'suit':
        ;(el as unknown as { suit: string }).suit = value == null ? '' : String(value)
        break
      case 'faceDown':
        ;(el as unknown as { faceDown: boolean }).faceDown = Boolean(value)
        break
    }
  },
}

/** Every component the fragment's `catalog.json` declares MUST appear here (the FACTORY_MISSING
 *  precondition, mirroring `fixture-demo/factories.ts`). */
export const croupierFactories: Record<string, WidgetFactory> = {
  PlayingCard: playingCardFactory,
}
