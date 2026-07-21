// workspace-shell.ts — UIWorkspaceShellElement (LLD-C5, GH #97): a THIN `ui-super-shell` preset for the
// full outer-level grammar Kim's two newest Figma frames specify (`app-shell-layout-single-nav` node
// 39:1629, `app-shell-layout-dual-sidebar` node 39:1596) — header, global-nav rail, nav-pane, section-nav,
// content, options-pane, options-section, global-options rail, footer — so a consumer authoring the
// workspace archetype doesn't hand-wire the narrow behavior for the nav side themselves (ADR-0151 rule 2:
// behavior-only, zero data/transport/navigation ownership; SPEC-R7's own "0 bespoke code" bar, mirrored
// from ui-master-detail's composition over ui-split).
//
// Composition (the master-detail.ts precedent — relocate real children into a freshly created inner
// control, then let THAT control's own connectedCallback do its own internal sorting): at connect, this
// element creates ONE inner `<ui-super-shell>`, sets a sensible workspace DEFAULT — `narrow-start="collapse"`
// + `collapse-band="compact"` (ADR-0155 F3): the workspace nav side hides below the 52.5rem compact line
// and toggle-restores as an overlay, flipping WITH the docs site (whose own narrow story moved from `stack`
// to overlay in the SAME wave — the preset's charter is "the docs site's own shipped UX"), then relocates
// every authored light-DOM child verbatim. Consumers use the EXACT SAME `data-slot` vocabulary ui-super-shell
// itself defines (header/global-nav/nav-pane/section-nav/content/options-section/options-pane/
// global-options/footer, SPEC-R1/R5) — this element adds no new slot vocabulary of its own, only the
// default + the reduced authoring ceremony of not having to compose the inner shell by hand.
//
// `controls → @agent-ui/components` + `./super-shell` only — never router/a2a (layering.test.ts).

import { UIElement } from '@agent-ui/components'
import { UISuperShellElement } from '../super-shell/super-shell.ts'

export class UIWorkspaceShellElement extends UIElement {
  // No API surface of its own (workspace-shell.md) — declared explicitly (rather than omitted) so the
  // descriptor's contract↔props trip-wire (compareDescriptorToProps) has a real `{}` to compare against
  // instead of `undefined` (`Object.keys(undefined)` throws).
  static props = {}

  #shell: UISuperShellElement | null = null

  protected connected(): void {
    this.#compose()
  }

  /** Idempotent (the fleet's #compose law, master-detail.ts's own guard): relocate ONCE. A later reconnect
   *  with no DOM change of its own (e.g. an ancestor's isolation toggle re-parenting this whole subtree)
   *  finds `#shell` already set and no longer finds real children on `this` to move a second time. */
  #compose(): void {
    if (this.#shell) return
    const shell = document.createElement('ui-super-shell') as UISuperShellElement
    shell.setAttribute('narrow-start', 'collapse') // ADR-0155 F3 — the nav side overlays below the band line
    shell.setAttribute('collapse-band', 'compact') // …at 52.5rem (the compact-window line), flipping with the site
    shell.append(...this.children)
    this.append(shell)
    this.#shell = shell
  }
}

if (!customElements.get('ui-workspace-shell')) customElements.define('ui-workspace-shell', UIWorkspaceShellElement)
