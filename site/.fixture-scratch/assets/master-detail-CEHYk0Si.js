import"./super-shell-D76CLu9A.js";import{n as e,r as t}from"./_page-DIBN49D1.js";import{a as n,d as r,o as i}from"./doc-page-H_CmxYv1.js";import{Ct as a}from"./frontmatter-D6AIzGjv.js";import"./master-detail-88sC5suq.js";/* empty css                      */var o=`---
# master-detail.md frontmatter — the attributes-as-API descriptor for ui-master-detail (ADR-0004;
# app-surfaces-m4.lld.md LLD-C10, SPEC-R7). The \`attributes[]\` block MUST mirror master-detail.ts
# \`masterDetailProps\` — the contract↔props trip-wire (master-detail.test.ts) targets this fence.
tag: ui-master-detail
tier: layout            # geometry size-class (Container/layout band — a composition over the shipped layout family, no control height of its own; the shell-family shape ui-super-shell also carries)
extends: UIElement      # a plain structural base — composes ui-split rather than extending it (LLD-C10)
# marginal: measured at the @agent-ui/app integration slice (scripts/measure-size.mjs, LLD-C9/C16)

attributes:              # attributes-as-API — mirrors master-detail.ts \`masterDetailProps\`
  - name: selected
    type: string
    default: ''
    reflect: true         # reflects so a JS-set value applies identically to an author-set attribute; '' ⇒ no selection

properties:
  - name: selected
    description: The current selection (an item key), a plain reflected prop the CONSUMER writes — this element owns no item-picking UI of its own (SPEC-R7). A reactive effect derives the narrow drill-in view from it (a selection present ⇒ \`detail\`, absent ⇒ \`list\`) and, on every run AFTER the first, emits \`select\`/\`change\`. Empty string (the default) means no selection.

events:
  - name: select
    detail: 'string'
    description: Fired after \`selected\` changes to a new value (post-connect only — the initial/deep-link state at connect does not fire). Detail is the new \`selected\` value (possibly '').
  - name: change
    detail: 'string'
    description: Fired alongside \`select\`, same timing, same detail — the fleet's input/change-pair convention applied to a discrete, non-live selection (mirrors ui-split's keyboard-step "both events, one action" shape).

slots: []                 # docking is composition via ui-master-detail-pane children (master-detail-pane.md), not attribute-slotting — no NAMED slots

parts:                    # NOT shadow-DOM ::part() (light-DOM only) — light-DOM markers this element's own JS creates; documented for completeness (compareDescriptorToSource does not mechanically check \`parts:\`, the split.md precedent)
  - name: back
    description: A control-rendered \`<button data-part="back" type="button">\` inside the detail \`ui-split-pane\`, visible only when narrow AND drilled into the detail view. Flips the view back to \`list\` WITHOUT touching \`selected\`.

customStates: []          # no :state() hooks — the narrow/drilled-in view rides a plain \`data-view\` host attribute, not a custom state (it is JS-owned presentation state a CSS attribute selector reads, the ui-split \`data-axis-vertical\` precedent)

face:
  formAssociated: false    # NOT a FACE form control — a layout composition contributes nothing to a form

aria:
  role: none               # this element carries no ARIA of its own — semantics live on whatever the author composes inside each pane (and on ui-split's own separators, inherited)
  roleSource: none

keyboard: []                # no keyboard interaction of this element's own — the composed ui-split's separators carry their OWN keyboard contract (split.md), inherited unchanged; the "back" button is a native <button> (Enter/Space activate it natively, no bespoke handling)

geometry:
  sizeClass: layout          # Container/layout — NO control height
  blockSize: auto             # fills its flex parent (flex:1 1 auto on the host is the CONSUMER's job — a bare instance is content-driven)
  paddingBlock: 0             # no padding of its own — the composed ui-split/panes own any inset
  narrowThreshold: 40rem      # the @container inline-size threshold below which the view drills in — the shared 40rem line \`shell-breakpoint.ts\` names (\`SHELL_NARROW_BREAKPOINT_REM\`, ADR-0155)

forcedColors: The "back" affordance's bottom divider is a real \`border-block-end\` (currentColor-derived via the role-pure ink token), not a fill-only affordance — it survives forced-colors the same way the composed ui-split's separator does (inherited, split.md).
---

# ui-master-detail

\`ui-master-detail\` is the **app-tier master-detail composition** (\`@agent-ui/app\`) — a docked list | detail
arrangement over the shipped \`ui-split\`, drilling into a single view below a narrow container-width
threshold. It composes rather than reimplements: **0 bespoke split/resize code** (SPEC-R7).

\`\`\`html
<ui-master-detail selected="item-2">
  <ui-master-detail-pane pane="list">
    <!-- your own list content; click handlers set \`.selected\` -->
  </ui-master-detail-pane>
  <ui-master-detail-pane pane="detail">
    <!-- your own detail content, kept in sync with \`selected\` by the consumer -->
  </ui-master-detail-pane>
</ui-master-detail>
\`\`\`

## Composition — docking, then relocation into a real \`ui-split\`

Docking uses **\`ui-master-detail-pane\`** children (\`pane="list"\` / \`pane="detail"\`, the generic-region
model ported from the retired \`ui-app-shell-region\`, ADR-0156 — see \`master-detail-pane.md\`). At connect, \`ui-master-detail\`
relocates each **whole** pane element into a freshly created \`ui-split-pane\`, wraps both in a freshly
created \`ui-split\`, and appends that one composed child. The split's own resize/keyboard/ARIA contract is
inherited wholesale — this element adds no split code of its own, only the narrow drill-in behaviour below.
**Static composition at M1**: only pane children present at connect are discovered (the same limitation
the retired \`ui-app-shell\`'s isolation mode documented, ADR-0156).

## Selection — a plain reflected prop, consumer-owned

\`ui-master-detail\` has no item-picking UI: the **consumer's** own list content sets \`.selected = key\` (a
click handler, a router binding — "3 lines of consumer wiring," ADR-0115). A reactive effect over \`selected\`
derives the narrow-drill-in view and emits \`select\`/\`change\` on every change after the first (the initial/
deep-link state at connect does not fire — it is not "an item chosen").

## Narrow drill-in

Below \`40rem\` inline-size (the element's **own** container width, never the viewport — the shell family's
own-container-width law, \`shell-breakpoint.ts\`), only one pane shows at a time: \`list\` when nothing is selected, \`detail\` once a selection is
present. A control-rendered **"back"** button appears inside the detail pane, narrow only, to return to the
list view without clearing the selection. Wide, both panes show side-by-side via the composed \`ui-split\`,
fully resizable.

## Accessibility

This element carries no ARIA of its own. The composed \`ui-split\`'s separators keep their own \`role="separator"\`
+ keyboard contract (inherited, unchanged); the "back" button is a native \`<button>\` (natively focusable and
keyboard-activatable, Enter/Space).
`,s=`---
# master-detail-pane.md frontmatter — the attributes-as-API descriptor for ui-master-detail-pane (ADR-0004;
# app-surfaces-m4.lld.md LLD-C10). The \`attributes[]\` block MUST mirror master-detail-pane.ts
# \`masterDetailPaneProps\` — the contract↔props trip-wire (master-detail.test.ts) targets this fence.
tag: ui-master-detail-pane
tier: container         # geometry size-class (Container band — a passive docking region, no control height, no flex/grid distribution of its own children)
extends: UIContainerElement   # the ui-split-pane/generic-region family base — NOT form-associated
# marginal: measured at the @agent-ui/app integration slice (scripts/measure-size.mjs)

attributes:             # attributes-as-API — mirrors master-detail-pane.ts \`masterDetailPaneProps\`
  - name: pane
    type: enum
    values: [list, detail]   # ORDER-SIGNIFICANT: \`list\` LEADS — an out-of-set value snaps back to it (the REGION_VALUES/props.ts enumType.from precedent)
    default: list
    reflect: true      # reflects so the parent ui-master-detail's connect-time discovery (a plain [pane=…] querySelector) also works from markup written directly

properties:
  - name: pane
    description: Which position this pane docks into (\`list\` or \`detail\`, default \`list\`). Read ONCE by the parent \`ui-master-detail\` at connect (static composition, master-detail.md's documented limitation) — a runtime reassignment after connect is not re-derived (documented M1 limitation). An out-of-set value coerces to \`list\` (order-significant codec fallback) rather than throwing.

events: []              # a passive docking marker fires no events of its own

slots: []                # plain default/unnamed light-DOM children — no NAMED slots

parts: []                 # light-DOM, host-as-block — no shadow parts exposed (render() stays void)
customStates: []          # no interaction states — a passive region has no hover/active/motion gate

face:
  formAssociated: false    # NOT a FACE form control — a container contributes nothing to a form

aria:
  role: none               # this element carries no ARIA of its own — it is a pure docking marker, relocated wholesale into a ui-split-pane by the parent
  roleSource: none

keyboard: []               # no keyboard interaction — a docking marker is not itself focusable

geometry:
  sizeClass: container      # Container — NO control height
  blockSize: auto            # content-driven
  paddingBlock: 0            # no padding of its own — the composed content's job
  display: block                     # this element's OWN base rule

forcedColors: This element carries no CSS of its own beyond \`display: block\` — nothing to keep legible under forced-colors independently of whatever content the author composes inside it.
---

# ui-master-detail-pane

\`ui-master-detail-pane\` is the **generic docking marker** \`ui-master-detail\` composes (the generic-region
model ported from the retired \`ui-app-shell-region\`, ADR-0156). It is a structural, **non-form-associated** \`UIContainerElement\` carrying one
reflected prop: **\`pane\`** (\`list\` · \`detail\`, default \`list\`).

\`\`\`html
<ui-master-detail>
  <ui-master-detail-pane pane="list">…the item list…</ui-master-detail-pane>
  <ui-master-detail-pane pane="detail">…the selected item's detail…</ui-master-detail-pane>
</ui-master-detail>
\`\`\`

## Docking — composition, not an attribute-on-arbitrary-child

A \`ui-master-detail-pane\` is how a developer docks a surface into the list or detail position (SPEC-R7):
compose the element as a child of \`ui-master-detail\` and set its \`pane\` prop. The parent relocates each
whole pane element into a \`ui-split-pane\` it creates — this element itself carries no split/resize code.

## Static composition (M1 limitation)

Only pane children present at the moment \`ui-master-detail\` connects are discovered and relocated — a
\`ui-master-detail-pane\` appended afterward is not picked up (documented, the same limitation the retired
\`ui-app-shell\`'s isolation mode carried, ADR-0156).
`,{content:c}=e({title:`Composing a ui-master-detail`,intro:`ui-master-detail is a docked list | detail arrangement over the shipped ui-split, drilling into a single view below a narrow container width. 0 bespoke split/resize code — the composed ui-split carries its own resize/keyboard/ARIA contract unchanged.`});c.append(t('Dock content with two ui-master-detail-pane children (pane="list" / pane="detail"). At connect, ui-master-detail relocates each whole pane element into a real ui-split-pane inside a real ui-split. Selection is a plain reflected `selected` prop your OWN list content sets — this element owns no item-picking UI of its own.'));function l(e,t,n){let r=document.createElement(e);return r.className=t,n!==void 0&&(r.textContent=n),r}function u(e){return n(2,e)}function d(e){return l(`code`,`as-code`,e)}var f=[`Alpha`,`Bravo`,`Charlie`,`Delta`,`Echo`];function p(){let e=document.createElement(`ui-master-detail`);e.className=`md-demo`;let t=document.createElement(`ui-master-detail-pane`);t.setAttribute(`pane`,`list`);let n=[];for(let r of f){let i=l(`button`,`md-row`,r);i.setAttribute(`type`,`button`),i.addEventListener(`click`,()=>{e.selected=r}),n.push(i),t.append(i)}let r=document.createElement(`ui-master-detail-pane`);r.setAttribute(`pane`,`detail`);let i=l(`div`,`md-detail-body`,`Select an item from the list.`);return r.append(i),e.addEventListener(`select`,e=>{let t=e.detail;i.textContent=t?`Detail for “${t}”.`:`Select an item from the list.`;for(let e of n)e.classList.toggle(`is-active`,e.textContent===t)}),e.append(t,r),e}c.append(u(`1 · Composition`)),c.append(t(`Two `,d(`ui-master-detail-pane`),` children dock the list and detail content — a generic-region model. Resize the frame below narrower than 40rem (the element's OWN container width, never the viewport) to see the drill-in.`));var m=l(`div`,`md-resize`);m.append(p()),c.append(m,l(`p`,`as-caption`,`↑ Drag the resize handle (bottom-right) below 40rem to drill in.`)),c.append(u(`2 · Selection is consumer-owned`)),c.append(t(`ui-master-detail has no item-picking UI: the click handler above sets `,d(`.selected`),` directly — that write is what drives the narrow drill-in view AND fires `,d(`select`),`/`,d(`change`),`. Going back (the affordance inside the detail pane, narrow only) never clears the selection — only the VIEW changes.`)),c.append(l(`pre`,`as-snippet`,`<ui-master-detail>
  <ui-master-detail-pane pane="list">
    <button type="button" onclick="this.closest('ui-master-detail').selected = 'item-1'">Item 1</button>
    …
  </ui-master-detail-pane>
  <ui-master-detail-pane pane="detail">
    <!-- kept in sync with .selected by YOUR OWN 'select' listener -->
  </ui-master-detail-pane>
</ui-master-detail>`)),c.append(u(`API reference`)),c.append(t(`Read straight from the shipped descriptors (master-detail.md · master-detail-pane.md) through the same parser the package's contract trip-wire validates.`));var h=a(o),g=a(s);c.append(l(`h3`,`as-api-tag`,`ui-master-detail`)),h.descriptor.attributes.length>0&&c.append(i(h.descriptor.attributes,4));{let e=r(h.descriptor,4);e&&c.append(e)}c.append(l(`h3`,`as-api-tag`,`ui-master-detail-pane`)),g.descriptor.attributes.length>0&&c.append(i(g.descriptor.attributes,4));{let e=r(g.descriptor,4);e&&c.append(e)}