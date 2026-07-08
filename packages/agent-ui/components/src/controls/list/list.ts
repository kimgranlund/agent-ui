// list.ts — UIListElement, the semantic vertical-stack layout primitive (goals.md §G9 / ADR-0016 cl.3;
// decomp g9-containers slice s5). BEHAVIOUR + props + the list role + self-define ONLY; the flex layout +
// surface seam live in list.css.
//
// `ui-list` is a `ui-column` SPECIALIZATION that adds LIST SEMANTICS: it is a `display:flex` vertical stack
// (the surface base `UIContainerElement`, ADR-0015 — NOT form-associated) whose host carries the ARIA
// `role="list"`. The role is set THROUGH the protected `internals` (the family discipline, ADR-0010 /
// element.ts) — NEVER a host `role` attribute, so the host stays free of `role`/`aria-*`. The list imposes
// NO item element: its children are the list items, composed by the agent as a ChildList (the A2UI child
// model) — so `render()` stays the inherited VOID (returning nothing → the host render effect commits
// nothing → the user's light-DOM children are never clobbered).
//
// It consumes the two shared spreadable prop sets the container family declares (no static-props prototype
// merge — the ADR-0013 `formProps` precedent): `surfaceProps` (elevation/brightness, the surface axes) and
// `flexProps` (align/justify/gap/wrap, the A2UI-faithful layout grammar). The literal-union → CSS-keyword
// mapping is a role-pure repoint in list.css's `@scope` block; the base owns no flex/surface CSS.
//
// IS an A2UI catalog type — `List` (ADR-0087 Fork A, Wave C; supersedes ADR-0016's earlier non-catalog
// exclusion) renders to `ui-list`. Reach for `List` over `Column` for a homogeneous, itemized collection where
// list semantics matter to assistive tech; reach for `Row`/`Column` for a heterogeneous arrangement, and
// `Grid` when the layout should reflow its column count responsively (a2ui-catalog.spec.md §5.2).
//
// Imports the surface base from the same-layer dom `../../dom/container.ts` (not re-exported from the dom
// barrel until s12) + the typed-prop authoring types from the dom barrel. `controls → dom` is the allowed
// import direction (the layering law: reactive ← dom ← controls).

import type { PropsSchema, ReactiveProps } from '../../dom/index.ts'
import { UIContainerElement } from '../../dom/container.ts'

// The full prop surface = the two shared spreadable sets folded into this control's own `static props` (each
// already carries `reflect: true` from the base, so the `[elevation]`/`[align]`/etc. attribute selectors in
// list.css apply to JS-set values too). No re-declaration of the surface/flex grammar — one home, ADR-0016.
// ADR-0030: `align` default overridden from `start` to `stretch` (parity with ui-column — a ui-list IS a
// ui-column specialization; its cross axis is inline/width; children should fill the width by default).
const props = {
  ...UIContainerElement.surfaceProps, // elevation / brightness (ADR-0015)
  ...UIContainerElement.flexProps, // align / justify / gap / wrap (ADR-0016) — a vertical stack
  align: { ...UIContainerElement.flexProps.align, default: 'stretch' as const }, // ADR-0030: override default ONLY; `as const` preserves the literal-union type (prevents string widening)
} satisfies PropsSchema

export interface UIListElement extends ReactiveProps<typeof props> {}
export class UIListElement extends UIContainerElement {
  static props = props

  protected connected(): void {
    // LIST SEMANTICS — `role=list` rides the host's ElementInternals, never a host `role` attribute (the
    // family discipline). A constant semantic role, so it is set DIRECTLY (not in an effect); re-set on each
    // connect (idempotent). The children are the list items — no item element is imposed, and `render()`
    // stays void so the ChildList children flow through untouched.
    this.internals.role = 'list'
  }
}

if (!customElements.get('ui-list')) customElements.define('ui-list', UIListElement)
