---
# chat-shell.md frontmatter — the attributes-as-API descriptor for ui-chat-shell (ADR-0004;
# shell-archetypes-m5.lld.md LLD-C6). No attributes of its own — see chat-shell.ts's own header comment
# for why (a thin `ui-super-shell` preset, zero new API surface beyond the composed element's).
tag: ui-chat-shell
tier: layout            # geometry size-class (Container/layout band — a composition over the shipped layout family, no control height of its own; the ui-workspace-shell/ui-master-detail precedent)
extends: UIElement      # a plain structural base — composes ui-super-shell rather than extending it (LLD-C6)
# marginal: measured at the @agent-ui/app integration slice (scripts/measure-size.mjs), same slice as ui-workspace-shell/ui-master-detail/ui-app-shell

attributes: []           # no API surface of its own — every attribute a consumer sets belongs to the composed ui-super-shell (data-slot children + the inner element's own collapsed-*/narrow-* props, unaffected by this wrapper)

properties: []

events: []                # behavior-only composition — no event vocabulary of its own (ADR-0151 rule 2)

slots: []                 # docking is data-slot children on the SAME vocabulary ui-super-shell itself defines — no named slots of this element's own

parts:                    # NOT shadow-DOM ::part() (light-DOM only) — documented for completeness (compareDescriptorToSource does not mechanically check `parts:`, the split.md/master-detail.md/workspace-shell.md precedent)
  - name: (none)
    description: This element creates exactly one part — the composed `<ui-super-shell>` child itself — and adds no parts of its own; every part a consumer sees (bar/rail/pane/canvas/side-toggle) is the inner shell's own (super-shell.md).

customStates: []          # no :state() hooks of its own

face:
  formAssociated: false    # NOT a FACE form control — a layout composition contributes nothing to a form

aria:
  role: none               # this element carries no ARIA of its own — every landmark lives on the composed ui-super-shell's own parts (LLD-C1), inherited unchanged
  roleSource: none

keyboard: []                # no keyboard interaction of this element's own — the composed ui-super-shell's side-toggles carry their OWN keyboard contract (real ui-buttons), inherited unchanged

geometry:
  sizeClass: layout          # Container/layout — NO control height
  blockSize: auto             # fills its flex parent (flex:1 1 auto on the host is the CONSUMER's job, the ui-master-detail/ui-workspace-shell precedent — a bare instance is content-driven)
  paddingBlock: 0             # no padding of its own — the composed ui-super-shell owns any inset

forcedColors: Composes wholesale over ui-super-shell's own forced-colors handling (super-shell.md) — this element paints nothing of its own.
---

# ui-chat-shell

`ui-chat-shell` is a **thin `ui-super-shell` preset** (`@agent-ui/app`, LLD-C6) for the chat archetype's
narrower slice: header, `nav-pane` (a conversation/session list), `content` (the active thread) — no
options side. It composes rather than reimplements: **0 bespoke layout code** (the `ui-workspace-shell`/
`ui-master-detail` precedent) — every geometry, collapse, and landmark behavior is `ui-super-shell`'s own,
inherited wholesale. The one thing this element adds is the same sensible default `ui-workspace-shell`
uses: `narrow-start="stack"`, so the nav side's own content owns its narrow anatomy rather than vanishing
behind an overlay toggle.

**SPEC-R6/R7/R8 forwarding (LLD-C3, ADR-0154/ADR-0155).** A consumer sets `resizable-start`/`resizable-end`,
`size-start`/`size-end`, `narrow-start`/`narrow-end`, or `collapse-band` on THIS element exactly as if it
were the composed inner shell — they are copied at compose time (an authored `narrow-start`/`narrow-end`
overrides the `stack` default above; `collapse-band` is UNSET by default so agent-admin's pinned 640px
narrow-tabs parity holds — the negative control), and `size-start`/`size-end` relay live if changed post-connect
(the one pair a consumer plausibly sets after an async persistence restore). This is attribute
forwarding, not a new typed property of `ui-chat-shell`'s own — `attributes: []` below stays accurate;
the API surface a consumer programs against is still `ui-super-shell`'s.

```html
<ui-chat-shell>
  <div data-slot="header">…</div>
  <nav data-slot="nav-pane">…</nav>              <!-- a conversation/session list — optional, absent today (see below) -->
  <ui-conversation data-slot="content">…</ui-conversation>
</ui-chat-shell>
```

**Extraction note (round 4, GH #98).** Neither existing chat surface in this repo hand-rolled a
conversation-list pane to extract — `ui-conversation` is pure message-feed + composer, with no header/nav
concept of its own. What ships here IS a real extraction: `site/pages/a2ui-chat.ts`'s own hand-rolled
`.chat-shell` (a flex-column div) and `.chat-head` (its page header bar) are genuinely deleted in the same
PR that ships this element, migrating that page onto `ui-chat-shell` — with `nav-pane` unauthored there
(the absence law: it contributes no box) until a real conversation-list consumer exists. The grammar itself
doesn't enforce "no options side" as a hard rule — it's the archetype's intended shape, not a validation.
