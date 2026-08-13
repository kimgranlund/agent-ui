// card-header.ts — UICardHeaderElement, the card's header region (decomp g9-containers slice s7; one folder,
// one writer with card.ts). BEHAVIOUR + self-define ONLY; the host-as-grid anatomy lives in card.css.
//
// A region SUB-ELEMENT of `ui-card` (the ratified "regions = sub-elements"). It extends `UIContainerElement`
// for the family base (NOT form-associated; the shared `internals` for any opt-in ARIA). The leading/label/
// trailing anatomy (anatomy.md host-as-grid) is purely presence-driven CSS (`:has()`), exactly like `ui-button`:
// position places (the `slot`), no JS. The header sits in the card grid's top `auto` row; its accessible
// content is the default/label children, with optional `slot="leading"` / `slot="trailing"` adornments (mark
// decorative glyphs `aria-hidden`). A header that paints a fill clips to the card's INNER radius (card.css
// publishes `--ui-card-inner-radius`).
//
// ADR-0186: ONE reflected enum prop, `format` (`'default' | 'structured'`, default `'default'`) — the
// structured-container title treatment (letterspaced-uppercase-mono metrics + a header/body divider,
// card.css's `[format='structured']` STYLES leg). Defined here AND on `ui-card-footer` (both consume the
// SAME `:where(ui-card-header, ui-card-footer)` rule block in card.css — symmetry, ADR-0186's Decision), even
// though the structured-container use case is header-only. Plain enum (the `ui-text` `variant`/`size`/`as`
// precedent, text.ts) — `prop.enum`'s own codec already snaps an out-of-enum ATTRIBUTE string back to
// `values[0]` ('default') for free; `format` is a one-way structural mode switch, not bindable status data
// (ADR-0186's own Consequences), so no ui-badge-style self-correcting effect is needed for the property-write
// path either (the enum's TS literal union already restricts a typed write at compile time).
//
// `render()` stays the inherited void (the agent's light-DOM children are the content). No other behaviour to
// wire; the region is otherwise all layout. `controls → dom` is the allowed import direction.

import { UIContainerElement } from '../../dom/container.ts'
import { prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'

const props = {
  format: { ...prop.enum(['default', 'structured'] as const, 'default'), reflect: true },
} satisfies PropsSchema

export interface UICardHeaderElement extends ReactiveProps<typeof props> {}
export class UICardHeaderElement extends UIContainerElement {
  static props = props
}

if (!customElements.get('ui-card-header')) customElements.define('ui-card-header', UICardHeaderElement)
