// row.ts — UIRowElement, the CANONICAL layout primitive (ADR-0016; decomp g9-containers slice s3). The
// reference template the other flex primitives copy (ui-column flips the axis; ui-list adds list semantics).
// BEHAVIOUR is deliberately MINIMAL — the whole component is `static props` + a self-define. Every visual
// decision lives in row.css (the flex mapping) and the shared controls/_surface/container.css (the surface
// plane + the container-query seam); the `.ts` holds zero layout/colour/runtime-style opinion (plan §2).
//
// Content model — host-as-flex (the ADR-0006 host-as-grid pattern, flex flavour): the user's light-DOM
// children ARE the flex items, laid out directly by row.css's `@scope` block. ui-row does NOT `render()` a
// wrapper over them, so `render()` stays the inherited no-op (returns nothing → the host render effect
// commits nothing → the children are never clobbered).
//
// Props — the two SPREADABLE prop sets the container family shares (ADR-0013 no-prototype-merge precedent):
// `UIContainerElement.surfaceProps` (elevation/brightness, ADR-0015) + `UIContainerElement.flexProps`
// (align/justify/gap/wrap, ADR-0016). All six reflect, so the `[elevation]`/`[align]`/… attribute selectors
// in the CSS apply to JS-set values too. No new prop is declared here — a layout primitive is exactly the
// shared grammar (DRY: one grammar, four consumers).
//
// ARIA — NONE. ui-row is a pure layout container (a generic wrapper, like a `<div>`): it carries NO role
// and no host aria-* attribute. Semantics ride the children; the row contributes none. (Contrast ui-list,
// which sets `internals.role='list'`; row/column are non-semantic — direction is layout, not meaning.)
//
// Imports — `UIContainerElement` from the same dom layer (`controls → dom`, the allowed inward direction).
// It is imported from `../../dom/container.ts` directly: the `dom/index.ts` barrel re-export of the
// container base is the integration slice's job (decomp s12), so this slice does not depend on it.

import { UIContainerElement } from '../../dom/container.ts'
import type { PropsSchema, ReactiveProps } from '../../dom/index.ts'

// The layout primitive IS the shared grammar — surface axes + flex grammar, nothing more. Spread (not
// inherited): props.ts has no static-props prototype merge, so the base hands these down as spreadable
// schemas the subclass folds into its OWN `static props` (the order is surfaceProps then flexProps).
const props = {
  ...UIContainerElement.surfaceProps,
  ...UIContainerElement.flexProps,
} satisfies PropsSchema

export interface UIRowElement extends ReactiveProps<typeof props> {}
export class UIRowElement extends UIContainerElement {
  static props = props
}

if (!customElements.get('ui-row')) customElements.define('ui-row', UIRowElement)
