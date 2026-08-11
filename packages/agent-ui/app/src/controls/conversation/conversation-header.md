---
# conversation-header.md frontmatter — the attributes-as-API descriptor for ui-conversation-header
# (ADR-0004 · ADR-0180 · GH #688). The machine-checkable public surface lives HERE (frontmatter); the
# prose below the fence is the /site doc. `attributes: []` is the deliberate, verified-parseable empty
# sequence (the ui-toast-region/ui-form-provider precedent) — conversation-header.ts declares
# `static props = {} satisfies PropsSchema`; the contract↔props trip-wire (conversation-header.test.ts)
# targets the empty bijection. Field set per .claude/docs/plan.md §10 / ADR-0004. NOT catalogued —
# app-tier chrome, outside the catalog gate's scan scope (SPEC-R10, ADR-0180 §5's "no allowlist row").
tag: ui-conversation-header
tier: layout             # geometry size-class — a band distributing author content; no control height of its own (the ui-conversation precedent, conversation.md:10)
extends: UIElement       # a plain structural base — no value, no form role; the family's ONE fully author-composed member
# marginal: measured at the @agent-ui/app integration slice (scripts/measure-size.mjs), folded into ui-conversation's own family total (the TKT-0056 composer-extraction precedent — no new package)

attributes: []            # nothing to configure yet (LLD §2's own "KISS — chrome the author fills" ruling) — a props surface is a deliberate future additive intake, never speculative

properties: []             # no public IDL beyond the standard element surface — v1 is a bare band

events: []                 # nothing to announce; the consumer wires its own content's own events directly

slots:
  - name: default
    optional: false
    description: The consumer's OWN DOM — title, avatar, actions, whatever the app's own chrome needs. Rendered exactly as authored; this element never creates, touches, or reacts to any of it. The family's ONE fully author-composed member (every other part of `ui-conversation`'s anatomy is engine-built).

parts: []                  # host-as-block over the author's own light-DOM children — no control-created light-DOM parts of its own

customStates: []           # no :state() hooks — static chrome, no interaction states of its own

face:
  formAssociated: false    # NOT a FACE form control — a layout band contributes nothing to a form

aria:
  role: none                # this element carries no ARIA role of its own — the consumer's own content declares semantics (a heading, buttons…), the same posture ui-conversation itself takes (conversation.md's own role: none)
  roleSource: none
  childModel: none of this element's own — every child is the consumer's own authored DOM, its roles/labels are the consumer's to declare

keyboard: []                # no keyboard model of its own — the author's own content (buttons, links…) carries its own keyboard behaviour

geometry:
  sizeClass: layout                 # a non-scrolling flex band — no control height of its own
  blockSize: content-driven         # sized by its own authored content plus its own block padding; pinned by construction (flex: 0 0 auto, never inside the scroller, never sticky — ADR-0180 clause 3)
  paddingBlock: consumer-supplied   # `--ui-conversation-header-pad-block` (default the fleet's --md-sys-space-sm) — this element owns its own inset, unlike ui-conversation's host (paddingBlock: 0)

forcedColors: The band's own border/background stay legible under `forced-colors: active` (`CanvasText`-repointed, the conversation.css/app-shell.css precedent); the author's own content inside carries its own forced-colors handling — nothing here is engine-owned.
---

# ui-conversation-header

`ui-conversation-header` is a **plain, non-scrolling band** (`@agent-ui/app`) — a structural,
**non-form-associated** `UIElement`, light-DOM by default. It is `ui-conversation`'s family's **one fully
author-composed member**: its content is entirely the consumer's own DOM, rendered exactly as authored.

```html
<ui-conversation>
  <ui-conversation-header>
    <strong>Support Agent</strong>
  </ui-conversation-header>
</ui-conversation>
```

## Recognized, never created (ADR-0180 clause 3)

`ui-conversation` looks up an author-supplied `:scope > ui-conversation-header` at connect and, when
present, keeps it first in canonical band order (header → dialog → composer) — it never creates one, never
touches its content, and the imperative API never reaches into it. Absent means today's shape minus
nothing: a consumer that authors no header keeps the exact pre-ADR-0180 DOM.

## Pinned by construction, never `position: sticky` in a shared scroll region

This element is a plain flex-column sibling (`flex: 0 0 auto`), sited **before** the scrolling
`ui-conversation-dialog` — it stays visible while the dialog beneath it scrolls simply because it is
outside the scroller, not because of any sticky/positioning trick. The scroll owner (`ui-conversation-
dialog`) and its stick-to-bottom guard are completely untouched by this element's presence or absence.

## Legal standalone

Outside a `ui-conversation`, this element renders as an inert band — no error, no warning (the fleet's
degrade posture). `ui-conversation` is what recognizes and seats it; on its own it is simply a styled flex
row over whatever the consumer put inside.

## Nothing to configure yet

v1 carries **no props** — it is chrome the author fills, not a component with its own API surface. A
props convention (e.g. a kicker-text slot, a standard actions-row shape) is a deliberate future addition if
real consumers ask for one; it is not designed here (default-no on speculative API).
