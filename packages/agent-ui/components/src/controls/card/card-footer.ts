// card-footer.ts — UICardFooterElement, the card's footer region (decomp g9-containers slice s7; one folder,
// one writer with card.ts). BEHAVIOUR + self-define ONLY; the host-as-grid anatomy lives in card.css.
//
// The footer is `ui-card-header`'s sibling — the SAME leading/label/trailing host-as-grid anatomy (anatomy.md),
// in the card grid's bottom `auto` row. A region SUB-ELEMENT extending `UIContainerElement` (NOT
// form-associated), carrying NO props — the anatomy is presence-driven CSS (`:has()`), no observedAttributes,
// no JS. Common content: actions (a `slot="trailing"` button row) or a metadata line; decorative adornment
// glyphs are `aria-hidden`. A footer that paints a fill clips to the card's INNER radius (card.css).
//
// `render()` stays the inherited void (light-DOM children are the content). No connected() — pure layout.
// `controls → dom` is the allowed import direction.

import { UIContainerElement } from '../../dom/container.ts'

export class UICardFooterElement extends UIContainerElement {}

if (!customElements.get('ui-card-footer')) customElements.define('ui-card-footer', UICardFooterElement)
