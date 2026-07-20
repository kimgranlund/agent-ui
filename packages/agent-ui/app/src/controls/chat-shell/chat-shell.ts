// chat-shell.ts — UIChatShellElement (LLD-C6, GH #98): a THIN `ui-super-shell` preset for the chat
// archetype's narrower slice — header, nav-pane (a conversation/session list), content (the active
// thread) — no options side, ADR-0151 rule 2 (behavior-only, zero data/transport/navigation ownership).
//
// Extraction note (round 4 finding, corrects the LLD-C6 sketch's premise): NEITHER existing chat surface
// in this repo (agent-admin.ts's `ui-split` canvas+tabs composition, or a2ui-chat.ts's own page chrome)
// actually hand-rolls a nav-pane/conversation-list today — `ui-conversation` (conversation.ts) is pure
// message-feed + composer, with no header/nav concept of its own. What IS real to extract is
// a2ui-chat.ts's own hand-rolled `.chat-shell` (a flex-column div) + `.chat-head` (the page header bar) —
// genuinely deleted from that page's own CSS/DOM construction in the SAME PR that ships this element
// (site/pages/a2ui-chat.ts/.css), proving the extraction wasn't cosmetic. `nav-pane` ships as part of the
// archetype's grammar (matching ui-workspace-shell's sibling shape) but has no content provider in THIS
// migration — the absence law (SPEC-R1) means it simply contributes no box, exactly as designed, not a
// gap to paper over.
//
// Composition (the ui-workspace-shell.ts / master-detail.ts precedent — relocate real children into a
// freshly created inner control, then let THAT control's own connectedCallback do its own internal
// sorting): at connect, this element creates ONE inner `<ui-super-shell>`, sets the same sensible default
// `ui-workspace-shell` uses (`narrow-start="stack"`), then relocates every authored light-DOM child
// verbatim. Consumers use the EXACT SAME `data-slot` vocabulary ui-super-shell itself defines — this
// element adds no new slot vocabulary, only the reduced authoring ceremony of not composing the inner
// shell by hand. Nothing here PREVENTS a consumer from also authoring an options side (the grammar
// doesn't enforce the archetype's "no options side" as a hard rule) — it is the intended shape, not a
// validated restriction (the same non-enforcement `ui-workspace-shell` already accepts for its own preset).
//
// `controls → @agent-ui/components` + `./super-shell` only — never router/a2a (layering.test.ts).

import { UIElement } from '@agent-ui/components'
import { UISuperShellElement } from '../super-shell/super-shell.ts'

// LLD-C3 (agent-admin-shell-rehost.lld.md §4, ADR-0154) — the SPEC-R6/R7 attributes ui-chat-shell
// forwards onto its composed ui-super-shell. Raw attribute forwarding, not new typed props of this
// element's own (chat-shell.md's "zero new API surface" stays true — a consumer sets these on the
// OUTER element exactly as if it were the inner shell; this element owns no reactive copy of them).
const FORWARD_ATTRS = ['resizable-end', 'size-end', 'narrow-end', 'narrow-start', 'resizable-start', 'size-start'] as const

export class UIChatShellElement extends UIElement {
  // No API surface of its own (chat-shell.md) — declared explicitly so the descriptor's contract↔props
  // trip-wire (compareDescriptorToProps) has a real `{}` to compare against instead of `undefined`.
  static props = {}

  // LLD-C3 — 'size-start'/'size-end' are the one pair that can change POST-connect (a consumer
  // restoring a persisted size after an async read); the rest are set once, up front, at author time.
  static get observedAttributes(): string[] {
    return ['size-start', 'size-end']
  }

  #shell: UISuperShellElement | null = null

  protected connected(): void {
    this.#compose()
  }

  /** Idempotent (the fleet's #compose law, ui-workspace-shell.ts's own guard): relocate ONCE. */
  #compose(): void {
    if (this.#shell) return
    const shell = document.createElement('ui-super-shell') as UISuperShellElement
    shell.setAttribute('narrow-start', 'stack') // the sensible default; FORWARD_ATTRS below may override it
    for (const attr of FORWARD_ATTRS) {
      const value = this.getAttribute(attr)
      if (value !== null) shell.setAttribute(attr, value)
    }
    shell.append(...this.children)
    this.append(shell)
    this.#shell = shell
  }

  /** The post-connect relay (LLD-C3): a `size-start`/`size-end` attribute change on THIS element after
   *  compose pushes straight onto the already-composed inner shell — the ONE pair a consumer may set
   *  after the fact (persistence restore), per `observedAttributes` above. */
  override attributeChangedCallback(attr: string, oldValue: string | null, newValue: string | null): void {
    super.attributeChangedCallback(attr, oldValue, newValue)
    if (!this.#shell || (attr !== 'size-start' && attr !== 'size-end')) return
    if (newValue === null) this.#shell.removeAttribute(attr)
    else this.#shell.setAttribute(attr, newValue)
  }
}

if (!customElements.get('ui-chat-shell')) customElements.define('ui-chat-shell', UIChatShellElement)
