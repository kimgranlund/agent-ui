// conversation-header.ts — UIConversationHeaderElement, the fully author-composed non-scrolling band
// `ui-conversation` recognizes as an optional light-DOM child (ADR-0180 clause 3 · GH #688 ·
// conversation-declarative-composition.lld.md §2). There is NO behaviour here beyond self-define — this
// is the family's ONE fully author-composed member: its light-DOM children are the CONSUMER'S OWN DOM
// (title, avatar, actions…), rendered as-authored (host-as-block; `render()` stays the inherited no-op,
// the ui-card-header.ts / master-detail-pane.ts precedent for a passive structural sub-element).
// `ui-conversation` never creates one, never touches its content, and never runs any behaviour of its own
// on it beyond recognizing + seating it in canonical band order (ADR-0180 clauses 3/4) — absent means
// today's shape minus nothing; the imperative API never touches it.
//
// Pinned by CONSTRUCTION: a plain non-scrolling flex band (`flex: 0 0 auto`, conversation-header.css),
// sited BEFORE the scrolling `ui-conversation-dialog` in document order — never `position: sticky` in a
// shared scroll region (ADR-0180's rejected alternative: sticky would re-home the scroll owner for no
// additional capability the plain-band-outside-the-scroller shape doesn't already have).
//
// Standalone posture: legal only as a `ui-conversation` child BY CONTRACT (conversation-header.md states
// it) — outside one it renders as an inert band, no error, no warning (the fleet's degrade posture, the
// same posture ui-conversation-dialog documents for itself).
//
// `controls → dom` only (no traits) — a leaf with no behaviour of its own.

import { UIElement, type PropsSchema } from '@agent-ui/components'

export class UIConversationHeaderElement extends UIElement {
  // EMPTY by design (v1, LLD §2 "Props: none") — chrome the author fills; nothing to configure yet (a
  // props surface, e.g. a kicker-text convention, is a deliberate FUTURE additive intake if real
  // consumers ask, LLD §8 — never speculative). Present (not omitted) for the fleet convention + the
  // descriptor trip-wire's empty bijection (the ui-toast-region/ui-form-provider precedent).
  static props = {} satisfies PropsSchema
}

if (!customElements.get('ui-conversation-header')) customElements.define('ui-conversation-header', UIConversationHeaderElement)
