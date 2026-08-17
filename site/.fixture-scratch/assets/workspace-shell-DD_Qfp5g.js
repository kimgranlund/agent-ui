import"./super-shell-D76CLu9A.js";import{n as e,r as t}from"./_page-DIBN49D1.js";import{a as n,d as r,o as i,s as a}from"./doc-page-H_CmxYv1.js";import{Ct as o}from"./frontmatter-D6AIzGjv.js";import"./workspace-shell-CwkeBIU2.js";var s=`---
# workspace-shell.md frontmatter — the attributes-as-API descriptor for ui-workspace-shell (ADR-0004;
# shell-archetypes-m5.lld.md LLD-C5). No attributes of its own — see workspace-shell.ts's own header
# comment for why (a thin \`ui-super-shell\` preset, zero new API surface beyond the composed element's).
tag: ui-workspace-shell
tier: layout            # geometry size-class (Container/layout band — a composition over the shipped layout family, no control height of its own; the ui-master-detail precedent)
extends: UIElement      # a plain structural base — composes ui-super-shell rather than extending it (LLD-C5)
# marginal: measured at the @agent-ui/app integration slice (scripts/measure-size.mjs), same slice as ui-master-detail/ui-app-shell

attributes: []           # no API surface of its own — every attribute a consumer sets belongs to the composed ui-super-shell (data-slot children + the inner element's own collapsed-*/narrow-* props, unaffected by this wrapper)

properties: []

events: []                # behavior-only composition — no event vocabulary of its own (ADR-0151 rule 2)

slots: []                 # docking is data-slot children on the SAME vocabulary ui-super-shell itself defines — no named slots of this element's own

parts:                    # NOT shadow-DOM ::part() (light-DOM only) — documented for completeness (compareDescriptorToSource does not mechanically check \`parts:\`, the split.md/master-detail.md precedent)
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
  blockSize: auto             # fills its flex parent (flex:1 1 auto on the host is the CONSUMER's job, the ui-master-detail precedent — a bare instance is content-driven)
  paddingBlock: 0             # no padding of its own — the composed ui-super-shell owns any inset

forcedColors: Composes wholesale over ui-super-shell's own forced-colors handling (super-shell.md) — this element paints nothing of its own.
---

# ui-workspace-shell

\`ui-workspace-shell\` is a **thin \`ui-super-shell\` preset** (\`@agent-ui/app\`, LLD-C5) for the full outer-level
grammar shape Kim's \`app-shell-layout-single-nav\` / \`app-shell-layout-dual-sidebar\` Figma frames specify:
header, global-nav rail, nav-pane, section-nav, content, options-section, options-pane, global-options rail,
footer. It composes rather than reimplements: **0 bespoke layout code** (the \`ui-master-detail\`/\`ui-split\`
precedent) — every geometry, collapse, and landmark behavior is \`ui-super-shell\`'s own, inherited wholesale.
The one thing this element adds is a sensible default: \`narrow-start="collapse"\` + \`collapse-band="compact"\`
(ADR-0155 F3), so the nav side hides below the 52.5rem compact-window line and toggle-restores as an
overlay (X in the header, scrim/Escape dismiss) — flipping WITH the docs site, whose own narrow story
moved from \`stack\` to overlay in the same wave (\`site/pages/_page.ts\`).

**\`app-shell-layout-single-nav\` (Figma node 39:1629)** — one rail, one nav pane, no options side:

\`\`\`html
<ui-workspace-shell>
  <div data-slot="header">…</div>
  <ui-nav-rail data-slot="global-nav">…</ui-nav-rail>
  <nav data-slot="nav-pane">…</nav>
  <main data-slot="content">…</main>
</ui-workspace-shell>
\`\`\`

**\`app-shell-layout-dual-sidebar\` (Figma node 39:1596)** — the SPEC-R5 asymmetric shape: the start side
stacks a rail plus TWO panes (\`nav-pane\` + \`section-nav\`), the end side stacks one pane plus a rail:

\`\`\`html
<ui-workspace-shell>
  <div data-slot="header">…</div>
  <ui-nav-rail data-slot="global-nav">…</ui-nav-rail>
  <nav data-slot="nav-pane">…</nav>
  <nav data-slot="section-nav">…</nav>          <!-- the extra stacked register, SPEC-R5/GH #96 -->
  <main data-slot="content">…</main>
  <aside data-slot="options-pane">…</aside>
  <aside data-slot="global-options">…</aside>
  <div data-slot="footer">…</div>
</ui-workspace-shell>
\`\`\`

Consumers use the **exact same \`data-slot\` vocabulary** \`ui-super-shell\` itself defines (SPEC-R1/R5) — this
element adds no new slot names, only the reduced ceremony of not hand-composing the inner shell. Unfilled
slots are absent, exactly as \`ui-super-shell\` itself specifies (the absence law) — the two examples above
differ ONLY in which slots are authored, not in any workspace-shell-specific configuration.
`,{content:c}=e({title:`Composing a ui-workspace-shell`,intro:`ui-workspace-shell is a thin ui-super-shell preset (@agent-ui/app, LLD-C5) for the FULL outer-level workspace grammar — header, global-nav rail, nav-pane, section-nav, content, options-pane, options-section, global-options rail, footer. 0 bespoke layout code: it composes one inner ui-super-shell and relocates your children into it, unchanged, the same shape ui-chat-shell takes for the narrower chat archetype.`});c.append(t(`This element adds no grammar of its own — every data-slot you author is ui-super-shell’s own vocabulary. What it adds is the reduced authoring ceremony of not composing that inner shell by hand, plus a workspace-appropriate default: narrow-start="collapse" + collapse-band="compact" (ADR-0155 F3), so the nav side hides below the compact-window line and toggle-restores as an overlay, rather than the stack default ui-chat-shell chooses.`));function l(e,t,n){let r=document.createElement(e);return r.className=t,n!==void 0&&(r.textContent=n),r}function u(e){return n(2,e)}function d(e){return l(`code`,`ws-code`,e)}function f(e,t){let n=document.createElement(`a`);return n.href=e,n.textContent=t,n}var p=`data-slot`;function m(e,t,n,r){let i=document.createElement(e);return i.setAttribute(p,t),i.append(l(`span`,r,n)),i}c.append(u(`1 · The two Figma frames`)),c.append(t(`Kim’s two newest Figma frames name this preset’s shape. `,d(`app-shell-layout-single-nav`),` (node 39:1629) — one rail, one nav pane, no options side:`));var h=document.createElement(`ui-workspace-shell`);h.className=`ws-demo`,h.append(m(`div`,`header`,`header`,`ws-header`),m(`nav`,`global-nav`,`global-nav`,`ws-rail`),m(`nav`,`nav-pane`,`nav-pane`,`ws-pane`),m(`main`,`content`,`content`,`ws-content`)),c.append(h),c.append(t(d(`app-shell-layout-dual-sidebar`),` (node 39:1596) — the SPEC-R5 asymmetric shape: the start side stacks a rail plus TWO panes (`,d(`nav-pane`),` + `,d(`section-nav`),`), the end side stacks one pane plus a rail:`));var g=document.createElement(`ui-workspace-shell`);g.className=`ws-demo`,g.append(m(`div`,`header`,`header`,`ws-header`),m(`nav`,`global-nav`,`global-nav`,`ws-rail`),m(`nav`,`nav-pane`,`nav-pane`,`ws-pane`),m(`nav`,`section-nav`,`section-nav — the extra stacked register (SPEC-R5/GH #96)`,`ws-pane`),m(`main`,`content`,`content`,`ws-content`),m(`aside`,`options-pane`,`options-pane`,`ws-pane`),m(`nav`,`global-options`,`global-options`,`ws-rail`),m(`div`,`footer`,`footer`,`ws-header`)),c.append(g),c.append(t(`The two examples differ ONLY in which slots are authored, not in any workspace-shell-specific configuration — consumers use the EXACT SAME `,d(`data-slot`),` vocabulary `,f(`./super-shell.html`,`ui-super-shell`),` itself defines (SPEC-R1/R5); this element adds no new slot names of its own. Delete a slot from your own markup and its band simply disappears — the absence law, inherited unchanged (`,f(`./super-shell.html`,`super-shell.html §1`),`).`)),c.append(u(`2 · The one default this preset adds`)),c.append(t(`ui-workspace-shell has NO API of its own — its descriptor declares attributes, properties, events, and slots all empty (see the derived reference below), the same shape `,d(`ui-chat-shell`),` takes for the chat archetype. Everything you can configure — the collapse toggles, the per-side `,d(`narrow-start`),`/`,d(`narrow-end`),` story, the header-hosted collapse contract, the `,d(p),` vocabulary itself — is the composed `,f(`./super-shell.html`,`ui-super-shell`),`’s own, inherited wholesale. The one exception is a default, not a setting: this element sets `,d(`narrow-start="collapse"`),` + `,d(`collapse-band="compact"`),` on the inner shell for you (ADR-0155 F3) — below the 52.5rem compact-window line, the nav side hides and toggle-restores as an OVERLAY (an X in the header, scrim/Escape dismiss), unlike `,d(`ui-chat-shell`),`’s `,d(`narrow-start="stack"`),` default. Resize the frame below (or your own viewport) past that line to see it:`));var _=document.createElement(`ui-workspace-shell`);_.className=`ws-demo`,_.append(m(`div`,`header`,`header — click the toggle at narrow to overlay-restore`,`ws-header`),m(`nav`,`global-nav`,`global-nav`,`ws-rail`),m(`nav`,`nav-pane`,`nav-pane`,`ws-pane`),m(`main`,`content`,`content — never squeezed, the side floats above it`,`ws-content`));var v=l(`div`,`ws-resize`);v.append(_),c.append(v,l(`p`,`ws-caption`,`↑ Drag the resize handle (bottom-right) below 52.5rem, then click a header toggle to overlay-restore that side.`)),c.append(u(`3 · Configuration lives on the inner ui-super-shell`)),c.append(t(`Reach for `,f(`./super-shell.html`,`ui-super-shell’s own guide`),` for the full grammar, the collapse contract, recursion, the narrow reflow, and the landmarks — everything documented there applies unchanged to a `,d(`<ui-workspace-shell>`),` instance, minus the one default above.`)),c.append(u(`4 · The real thing`)),c.append(t(`This page’s demos are scaffolds — realistic shapes, no live wiring. The production surfaces this preset hosts are the fleet’s SaaS-composition proofs: `,f(`./workbench.html`,`ui-workbench`),` (GH #461 — a data table + filter toolbar + record-edit modal + agent-summary card, ONE authored content slot) and `,f(`./dashboard.html`,`ui-dashboard`),` (GH #499 — stat cards + a bar chart + a read-only table + an agent-summary card, proving the same data-app posture generalizes) — both compose `,d(`<ui-workspace-shell>`),` with exactly one authored `,d(`content`),` slot, no shell-side work of their own (PRD-A1).`)),c.append(u(`API reference`)),c.append(t(`Read straight from the shipped descriptor (workspace-shell.md) through the same parser the package’s contract trip-wire validates. Every table below is genuinely empty — attributes, properties, events, and slots all resolve to zero entries, because workspace-shell.md declares all five sequences `,d(`[]`),`. This table cannot silently claim an API surface this element doesn’t have.`));var y=o(s);c.append(l(`h3`,`ws-api-tag`,`ui-workspace-shell`)),y.descriptor.attributes.length>0&&c.append(i(y.descriptor.attributes,4));{let e=r(y.descriptor,4);e&&c.append(e)}var b=a([{date:`2026-08-10`,type:`Feature`,id:`GH #97`,summary:`ui-workspace-shell ships (LLD-C5): a thin ui-super-shell preset for the full outer-level workspace grammar (header/global-nav/nav-pane/section-nav/content/options-pane/options-section/global-options/footer).`},{date:`2026-08-10`,type:`Decision`,id:`ADR-0151`,summary:`Named shell archetypes join agent-app-surfaces as M5 (rule 2: behavior-only composition, zero data/transport/navigation ownership) — the decision ui-workspace-shell realizes, alongside ui-chat-shell and ui-super-shell itself.`}]);b&&c.append(b);