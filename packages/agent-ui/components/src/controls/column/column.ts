// column.ts — UIColumnElement, the vertical A2UI layout primitive (goals.md §G9 / ADR-0016; decomp
// g9-containers slice s4). BEHAVIOUR + props + self-define ONLY.
//
// `ui-column` is `ui-row`'s SIBLING with the main axis flipped to the block axis (`flex-direction: column`).
// The direction is the element's IDENTITY — the tag names the main axis, A2UI-faithfully (ADR-0016 cl.2) — so
// it is NOT a prop; an agent picks a column vs. a row by component type. The element carries no flex CSS in
// TypeScript: it spreads the shared `surfaceProps`/`flexProps` (the one layout grammar, four consumers — the
// ADR-0013 no-prototype-merge spread the base exposes) into its own `static props`, and column.css maps the
// reflected attributes 1:1 onto the CSS flex properties with the column axis (the role-pure repoint).
//
// A pure STRUCTURAL container (ADR-0016): it extends `UIElement` via the `UIContainerElement` surface base, is
// NOT form-associated (no value/validity), and contributes NO ARIA semantics — like a `<div>`, it sets no
// `role` (neither a host attribute nor `internals.role`); meaning rides the children it lays out. `render()`
// stays the inherited VOID so the user's light-DOM children flow through untouched (host-as-grid / -as-flex).
// There is no interaction state, no keyboard, no motion gate — a layout box has none. The surface
// (elevation/brightness) is painted by the shared controls/_surface/container.css; column.css owns only layout.
//
// Imports inward only (`controls → dom`): the surface base from `../../dom/container.ts`, the prop-authoring
// TYPES from the `../../dom` barrel. `UIContainerElement` is not re-exported by the dom barrel until the s12
// packaging slice, so it is imported from its module path directly.

import { UIContainerElement } from '../../dom/container.ts'
import type { PropsSchema, ReactiveProps } from '../../dom/index.ts'

// The whole public surface = the two shared spreadable sets, folded into this element's own `static props`
// (surfaceProps then flexProps — the canonical consumer order; no re-declaration of the grammar, ADR-0016 cl.1).
//   • surfaceProps — elevation/brightness (the two signed surface axes, ADR-0015)
//   • flexProps    — align/justify/gap/wrap (the shared A2UI layout grammar, ADR-0016)
// ADR-0030: the cross-axis `align` default is OVERRIDDEN from `start` to `stretch` here (direction-appropriate
// — column's cross axis is inline/width; children should fill the width by default). Only the `default` field
// is replaced; the shared `type` (the 5-member enum) is REUSED via spread so any future grammar change
// propagates automatically. The shared `flexProps.align` default stays `start` (ui-row is unchanged).
const props = {
  ...UIContainerElement.surfaceProps,
  ...UIContainerElement.flexProps,
  align: { ...UIContainerElement.flexProps.align, default: 'stretch' as const }, // ADR-0030: override default ONLY; `as const` preserves the literal-union type (prevents string widening)
} satisfies PropsSchema

export interface UIColumnElement extends ReactiveProps<typeof props> {}
export class UIColumnElement extends UIContainerElement {
  static props = props
  // No connected(): a layout primitive has no role, no internals state, no listeners — the inherited VOID
  // render() and the connection lifecycle are all it needs (zero residue is the base's, proven in s2).
}

if (!customElements.get('ui-column')) customElements.define('ui-column', UIColumnElement)
