// card-header.ts — UICardHeaderElement, the card's header region (decomp g9-containers slice s7; one folder,
// one writer with card.ts). BEHAVIOUR + self-define ONLY; the host-as-grid anatomy lives in card.css.
//
// A region SUB-ELEMENT of `ui-card` (the ratified "regions = sub-elements"). It extends `UIContainerElement`
// for the family base (NOT form-associated; the shared `internals` for any opt-in ARIA), but carries NO props
// of its own — the leading/label/trailing anatomy (anatomy.md host-as-grid) is purely presence-driven CSS
// (`:has()`), exactly like `ui-button`: position places (the `slot`), no observedAttributes, no JS. The header
// sits in the card grid's top `auto` row; its accessible content is the default/label children, with optional
// `slot="leading"` / `slot="trailing"` adornments (mark decorative glyphs `aria-hidden`). A header that paints
// a fill clips to the card's INNER radius (card.css publishes `--ui-card-inner-radius`).
//
// `render()` stays the inherited void (the agent's light-DOM children are the content). No connected() — there
// is no behaviour to wire; the region is all layout. `controls → dom` is the allowed import direction.

import { UIContainerElement } from '../../dom/container.ts'

export class UICardHeaderElement extends UIContainerElement {}

if (!customElements.get('ui-card-header')) customElements.define('ui-card-header', UICardHeaderElement)
