// tab.ts — UITabElement, the interactive tab row of the `ui-tabs` compound (goals.md §G9 / decomp
// g9-containers s8). BEHAVIOUR + the `role=tab` ARIA + the parent-driven coordination API + self-define ONLY;
// geometry/colour live in tabs.css (the family's single sheet), the public contract in tabs.md.
//
// A `ui-tab` is NOT a standalone control — it is a component-native ChildList child the owning `ui-tabs`
// coordinates (the ratified "regions = sub-elements" model). It extends the plain `UIElement` (it needs the
// protected `internals` for `role=tab` + `aria-selected` + the `:state(selected)` hook + the `aria-controls`
// element-reflection — none of which a sibling can reach), but it owns no surface axes (it is not a
// `UIContainerElement`; the container.css surface seam lists only `ui-tabs`). The host carries NO `role`/`aria-*`
// attribute — every ARIA fact rides `this.internals` (the family discipline, CLAUDE.md). `render()` stays the
// inherited void: the tab's label is its light-DOM children, placed by tabs.css (host-as-content), never clobbered.
//
// The coordination API (`link`/`setSelected`) is PUBLIC but ui-tabs-driven: the parent owns selection + the
// roving tabindex, so it pushes each tab's selected state in (a sibling cannot set another element's protected
// internals). `controls → dom` is the allowed import direction.

import { UIElement, prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'

// Set an ARIA element-reflection relationship (`aria-controls`/`aria-labelledby` as ELEMENT refs, not IDREF
// strings) THROUGH internals — the only way to express an IDREF-style ARIA relation without a host attribute
// (the family bars host `aria-*`). Feature-detected: the reflection accessors landed in modern Chromium/WebKit
// but NOT jsdom, so this is a no-op under the jsdom inner loop (the relation is proven in tabs.browser.test.ts)
// and live in the real engines. Reused by tab-panel.ts (a 3-line peer copy — the folder ships no shared module).
function reflectAriaElements(internals: ElementInternals, name: 'ariaControlsElements' | 'ariaLabelledByElements', elements: Element[]): void {
  if (name in internals) (internals as unknown as Record<string, Element[]>)[name] = elements
}

const props = {
  // `key` — the tab's optional STABLE identity (the agent's tab id), OBSERVED (its initial attribute seeds the
  // prop) but not reflected. ui-tabs resolves `selected` against `key` first, then falls back to the DOM index,
  // so a `key`-less tab is addressed positionally. Mirrors the text-field `value` reflect:false precedent.
  key: prop.string(), // renamed from `value` (TKT-0069 item 1 ruling: `value` = the FACE form value, reserved)
} satisfies PropsSchema

export interface UITabElement extends ReactiveProps<typeof props> {}
export class UITabElement extends UIElement {
  static props = props

  protected connected(): void {
    this.internals.role = 'tab' // ARIA via internals — never a host role/aria-* attribute
    // Roving-tabindex default: a tab starts OUT of the tab order; the owning ui-tabs promotes exactly the
    // selected one to tabindex=0 (setSelected). Self-set so a tab is never tabbable before the parent wires it.
    if (!this.hasAttribute('tabindex')) this.tabIndex = -1
  }

  /**
   * Wire this tab to the panel it controls (called ONCE by the owning ui-tabs). Seeds a stable `id` (for the
   * reverse `aria-labelledby` on the panel) when the author gave none, and points `aria-controls` at the panel
   * via the internals element-reflection (no host attribute). Idempotent across reconnect.
   */
  link(panel: Element, ownId: string): void {
    if (!this.id) this.id = ownId
    reflectAriaElements(this.internals, 'ariaControlsElements', [panel])
  }

  /**
   * Reflect this tab's selection (called by the owning ui-tabs on every `selected` change). Drives THREE facts:
   * `aria-selected` (via internals), the roving tabindex (0 when selected, −1 otherwise — exactly one tab is in
   * the tab order), and the `:state(selected)` CSS hook the indicator/ink key off. `states` is optional-chained
   * — jsdom has no CustomStateSet (the real selected-indicator paint is tabs.browser.test.ts).
   */
  setSelected(selected: boolean): void {
    this.internals.ariaSelected = selected ? 'true' : 'false'
    this.tabIndex = selected ? 0 : -1 // roving: the selected tab is the single tab-order entry
    if (selected) this.internals.states?.add('selected')
    else this.internals.states?.delete('selected')
  }
}

if (!customElements.get('ui-tab')) customElements.define('ui-tab', UITabElement)
