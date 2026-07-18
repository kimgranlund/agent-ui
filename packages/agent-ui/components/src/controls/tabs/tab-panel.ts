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
//
// ADR-0144 Q1 cl.4 — keyboard-scroll disposition for a `fill`-mode panel, MEASURED at build (not assumed): a
// focused, tabindex=0, `overflow-y:auto` region's platform default action for Arrow/Page/Home/End is NOT
// reliably keyboard-scrollable across engines — the identical shape already measured for `ui-card-content`
// (card-content.ts, ADR-0046 Amendment 6): Chromium moves it once trusted-focused, WebKit does not move it at
// all. tabs.browser.test.ts re-measures the SAME gap for a filled tab panel and confirms it; this panel
// therefore wires the SAME explicit keydown handler as `card-content.ts` rather than gamble on the default
// action, deterministic on every shipped engine. The handler only acts when `event.target === this` (never
// hijacks a focused DESCENDANT's own keys) and only when an ANCESTOR `ui-tabs` is in `fill` mode AND this
// panel is the visible one (`fill`-less tabs stay ordinary document flow with no added listener effect).

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

    // The EXPLICIT scroll (ADR-0144 Q1 cl.4, the card-content.ts precedent — see the file banner): the
    // platform's own default action for arrow/Page/Home/End on a focused, tabindex=0, overflow-y:auto region is
    // not reliable across engines, so a `fill`-mode panel scrolls itself deterministically instead of gambling
    // on that default. Guarded to a no-op outside fill mode / on a hidden panel / when a focused DESCENDANT
    // (not this panel itself) owns the key.
    this.listen(this, 'keydown', (event: Event) => {
      if (event.target !== this || this.hidden) return
      const tabs = this.closest('ui-tabs')
      if (!tabs || !tabs.hasAttribute('fill')) return
      const key = (event as KeyboardEvent).key
      const line = 40 // px per arrow press — an ordinary reading-line increment, density-invariant on purpose
      const page = this.clientHeight * 0.9 // near-full-page, a small overlap (the standard page-scroll convention)
      switch (key) {
        case 'ArrowDown':
          this.scrollTop += line
          break
        case 'ArrowUp':
          this.scrollTop -= line
          break
        case 'PageDown':
          this.scrollTop += page
          break
        case 'PageUp':
          this.scrollTop -= page
          break
        case 'Home':
          this.scrollTop = 0
          break
        case 'End':
          this.scrollTop = this.scrollHeight
          break
        default:
          return
      }
      event.preventDefault()
    })
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
