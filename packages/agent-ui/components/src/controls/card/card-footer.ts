// card-footer.ts — UICardFooterElement, the card's footer region (decomp g9-containers slice s7; one folder,
// one writer with card.ts). BEHAVIOUR + self-define ONLY; the host-as-grid anatomy lives in card.css.
//
// The footer is `ui-card-header`'s sibling — the SAME leading/label/trailing host-as-grid anatomy (anatomy.md),
// in the card grid's bottom `auto` row. A region SUB-ELEMENT extending `UIContainerElement` (NOT
// form-associated) — the anatomy is presence-driven CSS (`:has()`), no JS. Common content: actions (a
// `slot="trailing"` button row) or a metadata line; decorative adornment glyphs are `aria-hidden`. A footer
// that paints a fill clips to the card's INNER radius (card.css).
//
// ADR-0186: carries the SAME reflected `format` enum prop as `ui-card-header` (symmetry — both consume the
// SAME `:where(ui-card-header, ui-card-footer)` rule block in card.css), though the structured-container
// look is a header-only use case in practice; see card-header.ts for the full rationale.
//
// `render()` stays the inherited void (light-DOM children are the content). No other behaviour to wire — pure
// layout. `controls → dom` is the allowed import direction.

import { UIContainerElement } from '../../dom/container.ts'
import { prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'

const props = {
  format: { ...prop.enum(['default', 'structured'] as const, 'default'), reflect: true },
} satisfies PropsSchema

export interface UICardFooterElement extends ReactiveProps<typeof props> {}
export class UICardFooterElement extends UIContainerElement {
  static props = props
}

if (!customElements.get('ui-card-footer')) customElements.define('ui-card-footer', UICardFooterElement)
