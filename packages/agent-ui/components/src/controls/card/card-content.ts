// card-content.ts — UICardContentElement, the card's body region (decomp g9-containers slice s7; one folder,
// one writer with card.ts). BEHAVIOUR + props + self-define ONLY; the layout + the scroll/fade CSS live in
// card.css.
//
// The body region SUB-ELEMENT of `ui-card` — the default-children container (NO leading/label/trailing
// anatomy; it is plain flow content), in the card grid's `1fr` row so it takes the slack. It extends
// `UIContainerElement` (NOT form-associated). Unlike the header/footer it carries TWO reflected boolean props
// that flip pure-CSS scroll behaviour ([scrollable]/[scroll-fade] selectors in card.css):
//   • `scrollable`  — a scrolling viewport: `overflow:auto` + `min-block-size:0` (so the `1fr` track may
//     SHRINK below its content and actually scroll). It requires a CONSTRAINED card block-size to bite
//     (a `max-block-size`/`height` on the card, or a flex/grid parent) — documented in card.md. Named
//     `scrollable` (NOT `scroll`) deliberately: a `scroll` prop would shadow the inherited native
//     `Element.prototype.scroll()` method — a `scroll: boolean` accessor collides with the method type
//     (TS 2320/2416). `scrollable` has no native collision, so it is a fully-typed reflecting prop.
//   • `scrollFade`  → `scroll-fade` — a `mask-image` edge fade keyed to the scroll position (a
//     scroll-driven-animation primary with a static gradient fallback for engines without it).
// Both REFLECT so the attribute selectors apply to JS-set values too. No connected() — the props are pure CSS
// hooks (no behaviour to wire). `render()` stays the inherited void. `controls → dom` is the allowed direction.

import { prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import { UIContainerElement } from '../../dom/container.ts'

const props = {
  // presence semantics: `<ui-card-content scrollable>` → the scrolling viewport (overflow:auto; min-block-size:0).
  scrollable: { ...prop.boolean(false), reflect: true },
  // `scrollFade` reflects to the kebab `scroll-fade` attribute (the JS property is camelCase; the CSS hook +
  // public attribute stay the hyphenated DOM convention) → the mask-image edge fade in card.css.
  scrollFade: { ...prop.boolean(false), reflect: true, attribute: 'scroll-fade' },
} satisfies PropsSchema

export interface UICardContentElement extends ReactiveProps<typeof props> {}
export class UICardContentElement extends UIContainerElement {
  static props = props
}

if (!customElements.get('ui-card-content')) customElements.define('ui-card-content', UICardContentElement)
