// card-content.ts — UICardContentElement, the card's body region (decomp g9-containers slice s7; one folder,
// one writer with card.ts). BEHAVIOUR + props + self-define ONLY; the layout + the scroll/fade CSS live in
// card.css.
//
// The body region SUB-ELEMENT of `ui-card` — the default-children container (NO leading/label/trailing
// anatomy; it is plain flow content), in the card grid's `1fr` row so it takes the slack. It extends
// `UIContainerElement` (NOT form-associated). Unlike the header/footer it carries TWO reflected boolean props
// that flip pure-CSS scroll behaviour ([scroll]/[scroll-fade] selectors in card.css):
//   • `scroll`      — a scrolling viewport: `overflow:auto` + `min-block-size:0` (so the `1fr` track may
//     SHRINK below its content and actually scroll). It requires a CONSTRAINED card block-size to bite
//     (a `max-block-size`/`height` on the card, or a flex/grid parent) — documented in card.md.
//   • `scrollFade`  → `scroll-fade` — a `mask-image` edge fade keyed to the scroll position (a
//     scroll-driven-animation primary with a static gradient fallback for engines without it).
// Both REFLECT so the attribute selectors apply to JS-set values too. No connected() — the props are pure CSS
// hooks (no behaviour to wire). `render()` stays the inherited void. `controls → dom` is the allowed direction.

import { prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import { UIContainerElement } from '../../dom/container.ts'

const props = {
  // presence semantics: `<ui-card-content scroll>` → the scrolling viewport (overflow:auto; min-block-size:0).
  scroll: { ...prop.boolean(false), reflect: true },
  // `scrollFade` reflects to the kebab `scroll-fade` attribute (the JS property is camelCase; the CSS hook +
  // public attribute stay the hyphenated DOM convention) → the mask-image edge fade in card.css.
  scrollFade: { ...prop.boolean(false), reflect: true, attribute: 'scroll-fade' },
} satisfies PropsSchema

// `scroll` is a REFLECTING runtime accessor (finalize installs it from `static props`; setting `el.scroll = true`
// reflects to the `[scroll]` CSS hook — the contract the A2UI catalog's accessorFactory drives, `mapsTo: scroll`).
// It is NOT declare-merged into the instance TYPE: the name shadows the legacy `Element.prototype.scroll()`
// method, so a `scroll: boolean` interface member collides with the inherited method type (TS 2320/2416). Only
// `scrollFade` is typed here; `scroll` is set as a property (the catalog casts) or via the `[scroll]` attribute.
export interface UICardContentElement extends ReactiveProps<Pick<typeof props, 'scrollFade'>> {}
export class UICardContentElement extends UIContainerElement {
  static props = props
}

if (!customElements.get('ui-card-content')) customElements.define('ui-card-content', UICardContentElement)
