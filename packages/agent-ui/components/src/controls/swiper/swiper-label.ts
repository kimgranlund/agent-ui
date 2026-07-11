// swiper-label.ts — UISwiperLabelElement, the accessible-name anchor of the ui-swiper family
// (swiper-family.lld.md LLD-C11 · swiper-family.spec.md SPEC-R12/R15 · ADR-0124 F3). EMPTY by design — the
// same posture as `ui-toast-region` (present for the fleet convention + the descriptor trip-wire's empty
// bijection), because ALL of its behaviour lives on the owning `ui-swiper`, never on this element itself:
//
//   - the author's light-DOM text IS the carousel's accessible name (no re-rendering, no own ARIA);
//   - the coordinator (`ui-swiper`) reads this element's `id` (assigning one if absent) and points its OWN
//     region `aria-labelledby` at it via the internals element-reflection (`reflectAriaElements`,
//     `ariaLabelledByElements`) — a sibling cannot set another element's protected internals, so the
//     coordinator drives that wiring, not this class;
//   - absent a `ui-swiper-label` anchor, the region falls back to `internals.ariaLabel = 'Carousel'`
//     (swiper.ts's own concern, not this element's).
//
// `controls → dom` is the allowed import direction.

import { UIElement } from '../../dom/element.ts'
import type { PropsSchema } from '../../dom/props.ts'

export class UISwiperLabelElement extends UIElement {
  static props = {} satisfies PropsSchema
}

if (!customElements.get('ui-swiper-label')) customElements.define('ui-swiper-label', UISwiperLabelElement)
