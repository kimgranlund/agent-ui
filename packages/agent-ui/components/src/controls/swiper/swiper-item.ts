// swiper-item.ts — UISwiperItemElement, the slide of the ui-swiper family (swiper-family.lld.md LLD-C4 ·
// swiper-family.spec.md SPEC-R9 · ADR-0124). BEHAVIOUR + the coordinator-applied `labelAs` seam + self-define
// ONLY; geometry lives in swiper.css (the family's single sheet), the public contract in swiper-item.md.
//
// A `ui-swiper-item` is NOT a standalone control — it is a component-native ChildList child the owning
// `ui-swiper` coordinates (the `ui-tab` "regions = sub-elements" precedent). It extends the plain `UIElement`
// (it needs the protected `internals` for `role=group` + `aria-roledescription='slide'` + `aria-label`, none
// of which a sibling can reach), and owns no surface axes (not a `UIContainerElement` — swiper.css lists only
// `ui-swiper` in the surface seam). The host carries NO `role`/`aria-*` attribute — every ARIA fact rides
// `this.internals`. `render()` stays the inherited void: a slide's content is its light-DOM children, placed
// by swiper.css (host-as-content), never clobbered.
//
// `labelAs` is PUBLIC but coordinator-driven (the `ui-tab.setSelected` precedent): the owning `ui-swiper` holds
// the real/clone/count truth (a sibling cannot set another element's protected internals), so it pushes each
// REAL item's position label in. A clone (an inert, id-stripped `cloneNode` copy the coordinator creates in
// loop mode) is never labelled this way — it is marked `aria-hidden`/`inert` directly on the cloned node by
// the coordinator, not through this method. `controls → dom` is the allowed import direction.

import { UIElement } from '../../dom/element.ts'
import { prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'

const props = {
  // `key` — the slide's optional STABLE identity (the agent's slide id), REFLECTED so the attribute mirrors
  // it. ui-swiper resolves `active` against `key` first, then falls back to the real DOM index, so a
  // `key`-less item is addressed positionally (the ui-tab `key` precedent, though ui-tab does not reflect —
  // swiper-family.lld.md §3.1 is explicit that THIS one does).
  key: { ...prop.string(), reflect: true }, // renamed from `value` (TKT-0069 item 1 ruling: `value` = the FACE form value, reserved)
} satisfies PropsSchema

export interface UISwiperItemElement extends ReactiveProps<typeof props> {}
export class UISwiperItemElement extends UIElement {
  static props = props

  // No self-driven ARIA on connect — the coordinator (which alone knows the real/clone/count truth) applies
  // role/roledescription/label via `labelAs` once it has captured this item. Overridden only to document the
  // deliberate no-op (matches the LLD's "no self-driven ARIA on connect" contract, probed by descriptor/source
  // trip-wires expecting zero customStates and no host role/aria-* attribute here).
  protected connected(): void {}

  /**
   * Label this REAL slide (called by the owning `ui-swiper`, never a sibling — `internals` is protected).
   * Sets `role=group`, `aria-roledescription='slide'`, and `aria-label` to the supplied position string
   * (`"{n} of {realCount}"`, SPEC-R9/R11) — all via `ElementInternals`, never a host attribute. Idempotent:
   * safe to call again with a new position string as the real-slide set shifts (resize/mutation rebuilds).
   */
  labelAs(position: string): void {
    this.internals.role = 'group'
    this.internals.ariaRoleDescription = 'slide'
    this.internals.ariaLabel = position
  }
}

if (!customElements.get('ui-swiper-item')) customElements.define('ui-swiper-item', UISwiperItemElement)
