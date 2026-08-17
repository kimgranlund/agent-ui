import"./super-shell-D76CLu9A.js";import{n as e,r as t}from"./_page-DIBN49D1.js";import{a as n,d as r,o as i,s as a}from"./doc-page-H_CmxYv1.js";import{Ct as o}from"./frontmatter-D6AIzGjv.js";import"./chat-shell-D8g2YHIe.js";var s=`---
# chat-shell.md frontmatter — the attributes-as-API descriptor for ui-chat-shell (ADR-0004;
# shell-archetypes-m5.lld.md LLD-C6). No attributes of its own — see chat-shell.ts's own header comment
# for why (a thin \`ui-super-shell\` preset, zero new API surface beyond the composed element's).
tag: ui-chat-shell
tier: layout            # geometry size-class (Container/layout band — a composition over the shipped layout family, no control height of its own; the ui-workspace-shell/ui-master-detail precedent)
extends: UIElement      # a plain structural base — composes ui-super-shell rather than extending it (LLD-C6)
# marginal: measured at the @agent-ui/app integration slice (scripts/measure-size.mjs), same slice as ui-workspace-shell/ui-master-detail/ui-app-shell

attributes: []           # no API surface of its own — every attribute a consumer sets belongs to the composed ui-super-shell (data-slot children + the inner element's own collapsed-*/narrow-* props, unaffected by this wrapper)

properties: []

events: []                # behavior-only composition — no event vocabulary of its own (ADR-0151 rule 2)

slots: []                 # docking is data-slot children on the SAME vocabulary ui-super-shell itself defines — no named slots of this element's own

parts:                    # NOT shadow-DOM ::part() (light-DOM only) — documented for completeness (compareDescriptorToSource does not mechanically check \`parts:\`, the split.md/master-detail.md/workspace-shell.md precedent)
  - name: (none)
    description: This element creates exactly one part — the composed \`<ui-super-shell>\` child itself — and adds no parts of its own; every part a consumer sees (bar/rail/pane/canvas/side-toggle) is the inner shell's own (super-shell.md).

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

\`ui-chat-shell\` is a **thin \`ui-super-shell\` preset** (\`@agent-ui/app\`, LLD-C6) for the chat archetype's
narrower slice: header, \`nav-pane\` (a conversation/session list), \`content\` (the active thread) — no
options side. It composes rather than reimplements: **0 bespoke layout code** (the \`ui-workspace-shell\`/
\`ui-master-detail\` precedent) — every geometry, collapse, and landmark behavior is \`ui-super-shell\`'s own,
inherited wholesale. The one thing this element adds is the same sensible default \`ui-workspace-shell\`
uses: \`narrow-start="stack"\`, so the nav side's own content owns its narrow anatomy rather than vanishing
behind an overlay toggle.

**SPEC-R6/R7/R8 forwarding (LLD-C3, ADR-0154/ADR-0155).** A consumer sets \`resizable-start\`/\`resizable-end\`,
\`size-start\`/\`size-end\`, \`narrow-start\`/\`narrow-end\`, or \`collapse-band\` on THIS element exactly as if it
were the composed inner shell — they are copied at compose time (an authored \`narrow-start\`/\`narrow-end\`
overrides the \`stack\` default above; \`collapse-band\` is UNSET by default so agent-admin's pinned 640px
narrow-tabs parity holds — the negative control), and \`size-start\`/\`size-end\` relay live if changed post-connect
(the one pair a consumer plausibly sets after an async persistence restore). This is attribute
forwarding, not a new typed property of \`ui-chat-shell\`'s own — \`attributes: []\` below stays accurate;
the API surface a consumer programs against is still \`ui-super-shell\`'s.

\`\`\`html
<ui-chat-shell>
  <div data-slot="header">…</div>
  <nav data-slot="nav-pane">…</nav>              <!-- a conversation/session list — optional, absent today (see below) -->
  <ui-conversation data-slot="content">…</ui-conversation>
</ui-chat-shell>
\`\`\`

**Extraction note (round 4, GH #98).** Neither existing chat surface in this repo hand-rolled a
conversation-list pane to extract — \`ui-conversation\` is pure message-feed + composer, with no header/nav
concept of its own. What ships here IS a real extraction: \`site/pages/a2ui-chat.ts\`'s own hand-rolled
\`.chat-shell\` (a flex-column div) and \`.chat-head\` (its page header bar) are genuinely deleted in the same
PR that ships this element, migrating that page onto \`ui-chat-shell\` — with \`nav-pane\` unauthored there
(the absence law: it contributes no box) until a real conversation-list consumer exists. The grammar itself
doesn't enforce "no options side" as a hard rule — it's the archetype's intended shape, not a validation.
`,{content:c}=e({title:`Composing a ui-chat-shell`,intro:`ui-chat-shell is a thin ui-super-shell preset (@agent-ui/app, LLD-C6) for the chat archetype’s narrower slice — header, nav-pane (a conversation/session list), content — no options side. 0 bespoke layout code: it composes one inner ui-super-shell and relocates your children into it, unchanged.`});c.append(t(`This element adds no grammar of its own — every data-slot you author is ui-super-shell’s own vocabulary. What it adds is the reduced authoring ceremony of not composing that inner shell by hand, plus the same sensible default ui-workspace-shell uses: narrow-start="stack".`));function l(e,t,n){let r=document.createElement(e);return r.className=t,n!==void 0&&(r.textContent=n),r}function u(e){return n(2,e)}function d(e){return l(`code`,`cs-code`,e)}var f=`data-slot`;c.append(u(`1 · What this preset removes`)),c.append(t(`Before ui-chat-shell existed, a2ui-chat.ts hand-rolled its own chrome: a plain `,d(`<div class="chat-shell">`),` wrapping a `,d(`<header class="chat-head">`),` and the conversation — page-owned layout CSS, no shared grammar, nothing reusable by the next chat surface. That page migrated onto ui-chat-shell in the SAME change that shipped this element (round 4, GH #98):`)),c.append(l(`pre`,`cs-snippet`,`// BEFORE — page-owned chrome, no shared grammar
const shell = document.createElement('div')
shell.classList.add('chat-shell')
const header = document.createElement('header')
header.classList.add('chat-head')
shell.append(header, conv)

// AFTER — the shell itself understands header/nav-pane/content/footer
const shell = document.createElement('ui-chat-shell')
const header = document.createElement('header')
header.setAttribute('data-slot', 'header')
shell.append(header, conv) // an unmarked child folds into content, same as ui-super-shell`)),c.append(t(`The relocation happens at connect time (`,d(`this.children`),` moved into the inner shell verbatim), so — same hazard as ui-workspace-shell/ui-master-detail — every child must be APPENDED before the ui-chat-shell element itself joins the live DOM, or it composes permanently empty (its own #compose() guard never re-runs).`)),c.append(u(`2 · The fixed slot intent`)),c.append(t(`The intended shape — not enforced — is `,d(`header | nav-pane | content | footer`),`: a session list down the start side, the active thread as content, no options side. Nothing stops you authoring one (the grammar itself doesn’t know "chat" from any other shell), it just isn’t this archetype’s shape. A real, dogfooded `,d(`<ui-chat-shell>`),` below — a session-list-shaped nav-pane and a chat-log-shaped content area, standing in for real data:`));function p(e,t,n=!1){let r=l(`div`,n?`cs-session cs-session--active`:`cs-session`);return r.append(l(`span`,`cs-session-title`,e),l(`span`,`cs-session-meta`,t)),r}function m(e,t){let n=l(`div`,`cs-bubble cs-bubble--${e}`);return n.append(l(`span`,`cs-bubble-role`,e===`user`?`You`:`Agent`),l(`p`,`cs-bubble-text`,t)),n}function h(){let e=document.createElement(`ui-chat-shell`);e.className=`cs-demo`;let t=document.createElement(`header`);t.setAttribute(f,`header`),t.className=`cs-header`,t.append(l(`span`,`cs-header-title`,`Support inbox`),l(`span`,`cs-header-note`,`demo scaffold — not a real agent`));let n=document.createElement(`nav`);n.setAttribute(f,`nav-pane`),n.className=`cs-nav`,n.append(p(`Refund status`,`2m ago`,!0),p(`Shipping delay`,`1h ago`),p(`Password reset`,`Yesterday`));let r=document.createElement(`div`);r.setAttribute(f,`content`),r.className=`cs-content`,r.append(m(`user`,`My order hasn’t arrived yet — can you check on it?`),m(`agent`,`Looking it up now… it’s still in transit, about a day behind schedule.`),m(`user`,`Thanks, that’s all I needed.`));let i=document.createElement(`footer`);return i.setAttribute(f,`footer`),i.className=`cs-footer`,i.append(l(`span`,`cs-footer-hint`,`a real composer goes here — ui-conversation, not part of this demo`)),e.append(t,n,r,i),e}c.append(h()),c.append(t(`The ABSENCE law is inherited unchanged from the composed shell (super-shell.html §1): delete nav-pane from your own markup and its band simply disappears, no override needed — this element enforces nothing about which slots you fill.`)),c.append(u(`3 · Configuration lives on the inner ui-super-shell`)),c.append(t(`ui-chat-shell has NO API of its own — its descriptor declares attributes, properties, events, and slots all empty (see the derived reference below). Everything you can configure — the collapse toggles, the per-side `,d(`narrow-start`),`/`,d(`narrow-end`),` story, the header-hosted collapse contract, the `,d(f),` vocabulary itself — is the composed `,(()=>{let e=document.createElement(`a`);return e.href=`./super-shell.html`,e.textContent=`ui-super-shell`,e})(),`’s own, inherited wholesale. The one exception is a default, not a setting: ui-chat-shell sets `,d(`narrow-start="stack"`),` on the inner shell for you (the same default ui-workspace-shell chooses), so a consumer never has to remember it.`)),c.append(u(`4 · The real thing`)),c.append(t(`This page’s demo is a scaffold — realistic shapes, no live wiring. The production surface this simplifies from is `,(()=>{let e=document.createElement(`a`);return e.href=`./a2ui-chat.html`,e.textContent=`A2UI Chat`,e})(),`: a real `,d(`<ui-chat-shell>`),` wrapping a header and a live `,d(`<ui-conversation>`),` driven by an agent transport (recorded by default, a live provider under a dev/prod key) — the header slot is authored, content holds the conversation, and nav-pane is unauthored today (the absence law again: it contributes no box until a real session-list consumer exists).`)),c.append(u(`API reference`)),c.append(t(`Read straight from the shipped descriptor (chat-shell.md) through the same parser the package’s contract trip-wire validates. Every table below is genuinely empty — attributes, properties, events, and slots all resolve to zero entries, because chat-shell.md declares all five sequences `,d(`[]`),`. This table cannot silently claim an API surface this element doesn’t have.`));var g=o(s);c.append(l(`h3`,`cs-api-tag`,`ui-chat-shell`)),g.descriptor.attributes.length>0&&c.append(i(g.descriptor.attributes,4));{let e=r(g.descriptor,4);e&&c.append(e)}var _=a([{date:`2026-07-19`,type:`Feature`,id:`GH #98`,summary:`ui-chat-shell ships (LLD-C6): a thin ui-super-shell preset for header/nav-pane/content; a2ui-chat.ts’s hand-rolled .chat-shell/.chat-head chrome migrates onto it in the same change.`},{date:`2026-07-19`,type:`Decision`,id:`ADR-0151`,summary:`Named shell archetypes join agent-app-surfaces as M5 (rule 2: behavior-only composition, zero data/transport/navigation ownership) — the decision ui-chat-shell realizes.`},{date:`2026-07-20`,type:`Change`,id:`ADR-0151`,summary:`Append-only amendment: corrects the extraction-source claim — a2ui-chat.ts’s own hand-rolled page chrome was the real extraction, not a2ui-live.ts or ui-agent-admin.`}]);_&&c.append(_);