// drill-panel.ts — UIDrillPanelElement, the content region of the `ui-drill` compound (ADR-0195, GH #954).
// BEHAVIOUR + props + the `role=region` ARIA + parent-driven labelling + self-define ONLY; anatomy/layout live
// in drill.css, the public contract in drill.md (the `ui-tabs`/`ui-tab-panel` compound-file precedent — ONE
// folder, ONE writer, no separate drill-panel.md descriptor, exactly as `ui-tab-panel` ships none of its own).
//
// A `ui-drill-panel` is a component-native ChildList child the owning `ui-drill` shows/hides by path resolution
// (only the ACTIVE panel is visible — the rest carry the `hidden` attribute, staying in the DOM; the
// `ui-tab-panel` precedent verbatim). It extends `UIContainerElement` (the surface base, container-tier — no
// control height of its own); it is NOT form-associated. `render()` stays the inherited void — the panel's body
// is its light-DOM children.
//
// `key`/`parent`/`heading` are plain reflected strings the OWNING `ui-drill` reads to resolve the flat
// parent-chain (drill.intake.md §4's Path resolution row) and drive the host-owned header's heading text — this
// element does no resolution of its own, it only carries the data + the labelled `role=region` semantics.

import { UIContainerElement, prop, type PropsSchema, type ReactiveProps } from '../../dom/index.ts'

// Set an ARIA element-reflection relationship through internals (the only host-attribute-free path for an
// IDREF-style relation); feature-detected — present in modern Chromium/WebKit, absent in jsdom (a no-op there,
// the tabs/tab-panel.ts precedent verbatim, peer-copied since the folder ships no shared module).
function reflectAriaElements(internals: ElementInternals, name: 'ariaLabelledByElements', elements: Element[]): void {
  if (name in internals) (internals as unknown as Record<string, Element[]>)[name] = elements
}

const panelProps = {
  // The panel's identity within its `ui-drill` instance — unique among ALL panels in that instance (the flat
  // parent-chain grain, ADR-0195 cl.2). Required in practice (an empty key never resolves as an active target);
  // not enum-typed (open, author-assigned identifiers, the `ui-tab`/`key` precedent shape).
  key: { ...prop.string(''), reflect: true },
  // '' (default) = ROOT panel — exactly one root panel per `ui-drill` instance (drill.intake.md fork sheet).
  // Any other value names the PARENT panel's `key` this panel drills FROM — consulted by the host ONLY for the
  // Back button's label, never for active-panel resolution (ADR-0195 cl.2).
  parent: { ...prop.string(''), reflect: true },
  // The panel's level title — drives the host's `[data-part="heading"]` text AND this panel's own
  // `aria-labelledby` element-reflection onto that heading (the `ui-tab-panel` labelling precedent) once it is
  // the resolved-active panel.
  heading: { ...prop.string(''), reflect: true },
} satisfies PropsSchema

export interface UIDrillPanelElement extends ReactiveProps<typeof panelProps> {}
export class UIDrillPanelElement extends UIContainerElement {
  static props = panelProps

  protected connected(): void {
    this.internals.role = 'region' // ARIA via internals — never a host role/aria-* attribute
    // NO default-hidden-at-connect here (a real bug this file once carried): the CUSTOM ELEMENT connection
    // order is HOST-then-CHILDREN (spec: connectedCallback fires in tree/pre-order), so the owning ui-drill's
    // `connected()` — and its first `#render()` pass, which already sets `hidden` correctly on EVERY panel,
    // active and inactive alike — runs BEFORE this panel's own `connected()`. A default-hide-at-connect here
    // would fire AFTER that render and silently re-hide whichever panel the host just correctly UNhid — the
    // exact defect a jsdom probe caught (drill.test.ts). The host's render is authoritative and comprehensive;
    // this element carries no visibility opinion of its own.
  }

  /** Link (or clear, `null`) this panel's accessible name to an external heading element — called by the OWNING
   *  `ui-drill` only, once per render pass, for the panel it resolves as active (the `ui-tab-panel`
   *  `aria-labelledby` element-reflection precedent, `tab-panel.ts`). `#`-private `internals` stays untouched
   *  from outside this class — this is the one sanctioned cross-element write the host needs. */
  linkHeading(heading: Element | null): void {
    reflectAriaElements(this.internals, 'ariaLabelledByElements', heading ? [heading] : [])
  }
}

if (!customElements.get('ui-drill-panel')) customElements.define('ui-drill-panel', UIDrillPanelElement)
