// tab-panel.ts — UITabPanelElement, the content region of the `ui-tabs` compound (goals.md §G9 / decomp
// g9-containers s8). BEHAVIOUR + the `role=tabpanel` ARIA + the parent-driven labelling + self-define ONLY;
// layout/colour live in tabs.css, the public contract in tabs.md.
//
// A `ui-tab-panel` is a component-native ChildList child the owning `ui-tabs` shows/hides by selection (only the
// selected panel is visible — the rest carry the `hidden` attribute, staying in the DOM). It extends the plain
// `UIElement` for the protected `internals` (`role=tabpanel` + the `aria-labelledby` element-reflection); it is
// not a `UIContainerElement` (no surface axes — the container.css seam lists only `ui-tabs`). The host carries NO
// `role`/`aria-*` attribute. `render()` stays the inherited void — the panel's body is its light-DOM children.
//
// Visibility rides the standard `hidden` attribute (a global attribute, NOT ARIA — set directly by ui-tabs), so
// the family "no host aria-* attribute" rule is untouched. `controls → dom` is the allowed import direction.

import { UIElement } from '../../dom/index.ts'

// Set an ARIA element-reflection relationship through internals (the only host-attribute-free path for an
// IDREF-style relation); feature-detected — present in modern Chromium/WebKit, absent in jsdom (a no-op there,
// proven live in tabs.browser.test.ts). Peer copy of tab.ts's helper (the folder ships no shared module).
function reflectAriaElements(internals: ElementInternals, name: 'ariaLabelledByElements', elements: Element[]): void {
  if (name in internals) (internals as unknown as Record<string, Element[]>)[name] = elements
}

export class UITabPanelElement extends UIElement {
  protected connected(): void {
    this.internals.role = 'tabpanel' // ARIA via internals — never a host role/aria-* attribute
    // A tabpanel is focusable (APG: the panel takes tabindex=0 so a keyboard user can reach its content/scroll
    // it). Self-set; the hidden panels are not reachable regardless (a `hidden` element is not focusable).
    if (!this.hasAttribute('tabindex')) this.tabIndex = 0
  }

  /**
   * Label this panel by the tab that controls it (called ONCE by the owning ui-tabs). Seeds a stable `id` when
   * the author gave none (so `aria-controls` on the tab can resolve back), and points `aria-labelledby` at the
   * tab via the internals element-reflection (no host attribute). Idempotent across reconnect.
   */
  link(tab: Element, ownId: string): void {
    if (!this.id) this.id = ownId
    reflectAriaElements(this.internals, 'ariaLabelledByElements', [tab])
  }
}

if (!customElements.get('ui-tab-panel')) customElements.define('ui-tab-panel', UITabPanelElement)
