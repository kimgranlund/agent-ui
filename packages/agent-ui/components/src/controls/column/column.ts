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
import { prop } from '../../dom/index.ts'
import type { PropsSchema, ReactiveProps } from '../../dom/index.ts'

// The whole public surface = the two shared spreadable sets, folded into this element's own `static props`
// (surfaceProps then flexProps — the canonical consumer order; no re-declaration of the grammar, ADR-0016 cl.1).
//   • surfaceProps — elevation/brightness (the two signed surface axes, ADR-0015)
//   • flexProps    — align/justify/gap/wrap (the shared A2UI layout grammar, ADR-0016)
// ADR-0030: the cross-axis `align` default is `stretch` (direction-appropriate — column's cross axis is
// inline/width; children should fill the width by default). Kim's directive: `center` is NOT allowed on
// ui-column — a column can only center children by shrink-wrapping them, which defeats the fill-width
// default and is an anti-pattern for the stacked-content the tag exists to lay out. So the shared 5-member
// `flexProps.align` enum is NARROWED here to the 4-member `[stretch, start, end, baseline]` (center dropped)
// — a COLUMN-LOCAL restriction; ui-row/ui-grid/ui-list keep the full grammar. `stretch` LEADS the array so
// it is both the default AND the invalid-value snap target (enumType.from falls to values[0]) — an
// `align="center"` attribute snaps the prop back to `stretch`, and column.css drops its `[align='center']`
// repoint so even a raw attribute cannot center.
const props = {
  ...UIContainerElement.surfaceProps,
  ...UIContainerElement.flexProps,
  align: { ...prop.enum(['stretch', 'start', 'end', 'baseline'] as const, 'stretch'), reflect: true }, // narrowed: center removed (Kim); stretch-first = default + snap target
  // stretch → the host fills its parent's available inline size (`width: stretch`). A column shrink-wraps to
  // content by default; as a ROOT layout box it should FILL its parent instead. Column-LOCAL sizing opt-in
  // (deliberately NOT folded into the shared `flexProps` grammar — row/grid/list are unaffected): the A2UI
  // canvas sets it on a root `ui-column` so the surface fills the artboard. Boolean presence, default off.
  stretch: { ...prop.boolean(false), reflect: true },
  // reflow → gates the ADR-0016 cl.4 container-query direction switch (ADR-0096). Element-local, deliberately
  // NOT folded into the shared `flexProps` (the ADR-0075 `stretch` precedent — `ui-list` has no `@container`
  // rule and `ui-grid`'s auto-fit IS its own responsiveness, so both stay untouched). `locked` LEADS the array
  // so it is both ui-column's default AND the invalid-value snap target — the column default FLIPS to `locked`
  // (ADR-0096 cl.2): the wide→row switch fired unconditionally and unpreventably for the catalog's prop-only
  // consumer, contradicting the tag's own cl.2 identity. `auto` opts back into the ADR-0016 cl.4 switch.
  reflow: { ...prop.enum(['locked', 'auto'] as const, 'locked'), reflect: true },
} satisfies PropsSchema

export interface UIColumnElement extends ReactiveProps<typeof props> {}
export class UIColumnElement extends UIContainerElement {
  static props = props
  // No connected(): a layout primitive has no role, no internals state, no listeners — the inherited VOID
  // render() and the connection lifecycle are all it needs (zero residue is the base's, proven in s2).
}

if (!customElements.get('ui-column')) customElements.define('ui-column', UIColumnElement)
