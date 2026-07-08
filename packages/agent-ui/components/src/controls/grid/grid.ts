// grid.ts — UIGridElement, the auto-fit/minmax track-grid layout primitive (goals.md §G9 / ADR-0016 cl.3;
// decomp g9-containers slice s6). BEHAVIOUR + props + self-define ONLY; the layout/surface live in grid.css
// (the @scope block), the public contract in grid.md.
//
// `ui-grid` is a STRUCTURAL container — it extends `UIContainerElement` (the shared surface base, ADR-0015),
// is NOT form-associated (no value/validity), and has NO control height (geometry.md Container/layout class —
// spacing rides `--ui-space` × density, never `--ui-height-*`). Its children are arbitrary light-DOM grid
// items (the default cell); it `render()`s nothing (the inherited void), so the user's children are never
// clobbered (the host-as-grid pattern — the CSS lays them out).
//
// The RESPONSIVENESS is INTRINSIC (ADR-0016 cl.3/4): `grid-template-columns: repeat(auto-fit, minmax(min,
// 1fr))` reflows by the grid's OWN rendered width — more tracks when wide, fewer when narrow — with NO
// explicit column-count prop and NO `@container` rule. The one author lever is `min`, the minmax() track
// floor: an arbitrary CSS `<length>` that cannot ride an attribute selector (and `attr()` typed is not
// WebKit-safe), so it is threaded into the role-pure `--ui-grid-min` token via the values-API (the effect
// below) — the same token-repoint the CSS does, but with a runtime value. Unset ⇒ the grid.css default floor.
//
// `ui-grid` IS an A2UI catalog type — `Grid` (ADR-0087 Fork A, Wave C; supersedes ADR-0016's earlier
// non-catalog exclusion) renders to `ui-grid`. Reach for `Grid` when the layout should reflow its column count
// responsively with available width; prefer `Row`/`Column` (with an explicit `wrap`) for an author-controlled
// arrangement, and `List` when the children are an itemized collection needing list semantics (a2ui-catalog.
// spec.md §5.2). Imports the dom layer only (`controls → dom`); `UIContainerElement` is pulled from
// container.ts directly (the dom barrel re-exports it at s12, the integration slice).

import { prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'
import { UIContainerElement } from '../../dom/container.ts'

const props = {
  // The two surface axes (elevation/brightness), spread from the shared base — props.ts has no static-props
  // prototype merge, so the base exposes a SPREADABLE bag the subclass folds in (the ADR-0013 formProps pattern).
  ...UIContainerElement.surfaceProps,
  // `gap` — the ONE flex-grammar prop a track grid consumes (the `--ui-space` density-responsive ladder,
  // ADR-0016 cl.1). Pulled as a single entry from the shared flexProps (a grid has no align/justify/wrap).
  gap: UIContainerElement.flexProps.gap,
  // `min` — the minmax() track FLOOR, an arbitrary CSS `<length>`. Threaded into the role-pure `--ui-grid-min`
  // token (the connected() effect); unset ⇒ the grid.css default floor. Reflects so the attribute is the
  // inspectable public API (the dimension itself rides the inline token, not an attribute selector).
  min: { ...prop.string(), reflect: true },
} satisfies PropsSchema

export interface UIGridElement extends ReactiveProps<typeof props> {}
export class UIGridElement extends UIContainerElement {
  static props = props

  protected connected(): void {
    // Thread the `min` `<length>` into the role-pure `--ui-grid-min` token seam — the one value the grid.css
    // template's `minmax()` floor reads. An inline custom property outranks the `:where()` default, so a set
    // `min` overrides the floor; unset ⇒ removeProperty ⇒ the grid.css default applies. Scope-owned: re-runs on
    // `min` and re-applies on reconnect; disposed with the connection scope (zero LIVE residue — the inline
    // token persists on the detached host like any light-DOM state, but the effect itself is torn down).
    this.effect(() => {
      const min = this.min
      if (min) this.style.setProperty('--ui-grid-min', min)
      else this.style.removeProperty('--ui-grid-min')
    })
  }
}

if (!customElements.get('ui-grid')) customElements.define('ui-grid', UIGridElement)
