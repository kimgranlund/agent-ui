// master-detail-pane.ts — UIMasterDetailPaneElement, the generic docking sub-element `ui-master-detail`
// composes (app-surfaces-m4.lld.md LLD-C10, SPEC-R7; the ui-app-shell-region generic-region precedent,
// LLD §3.1's fork recommendation). A structural, non-interactive content region — the author docks a
// surface into the list or detail position by composing this element and setting its OWN `pane` prop
// (`'list' | 'detail'`), exactly as `ui-app-shell-region`'s `region` prop docks into a named grid area.
// No attribute-on-arbitrary-child mechanism, no two named `ui-master-detail-{list,detail}` tags.
//
// `ui-master-detail` (master-detail.ts) discovers its `list`/`detail` pane children at connect and RELOCATES
// each whole element as the sole child of a freshly created `ui-split-pane` inside a freshly created
// `ui-split` — this element itself never renders `ui-split`/resize code (SPEC-R7 "0 bespoke split code");
// it is purely the author-facing docking marker. `render()` stays the inherited no-op (host-as-block over
// its own light-DOM children, the `ui-split-pane` precedent).
//
// `controls → dom` only (no traits) — a leaf with no behaviour of its own, the split-pane.ts precedent.

import { UIContainerElement, prop, type PropsSchema, type ReactiveProps } from '@agent-ui/components'

const PANE_VALUES = ['list', 'detail'] as const // `list` LEADS — an out-of-set value snaps back to it (the REGION_VALUES/props.ts enumType.from precedent)

const masterDetailPaneProps = {
  // Which position this pane docks into — read ONCE by the parent `ui-master-detail` at connect (LLD-C10,
  // static composition at M1, the ui-app-shell isolation precedent for "children present at connect only").
  pane: { ...prop.enum(PANE_VALUES, 'list'), reflect: true },
} satisfies PropsSchema

export interface UIMasterDetailPaneElement extends ReactiveProps<typeof masterDetailPaneProps> {}
export class UIMasterDetailPaneElement extends UIContainerElement {
  static props = masterDetailPaneProps
}

if (!customElements.get('ui-master-detail-pane')) customElements.define('ui-master-detail-pane', UIMasterDetailPaneElement)
