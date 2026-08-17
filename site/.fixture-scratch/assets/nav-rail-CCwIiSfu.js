import"./super-shell-D76CLu9A.js";import"./nav-rail-sXDz1Xz6.js";import{n as e,r as t}from"./_page-DIBN49D1.js";import{a as n,d as r,o as i}from"./doc-page-H_CmxYv1.js";import{Ct as a}from"./frontmatter-D6AIzGjv.js";var o='---\n# nav-rail.md frontmatter — the attributes-as-API descriptor for ui-nav-rail (ADR-0004; ADR-0130; SPEC\n# nav-rail-family.spec.md SPEC-R1..R8; LLD nav-rail-family.lld.md LLD-C7). The `attributes[]` block MUST\n# mirror nav-rail.ts `static props` — the contract↔props trip-wire (nav-rail.test.ts) targets this fence.\n# This is the PRIMARY descriptor for the family folder (naming.md §9 "one folder per family, sub-elements\n# nest"); nav-rail-group.md / nav-rail-item.md are the two sibling sub-element descriptors.\ntag: ui-nav-rail\ntier: pattern           # geometry size-class (Pattern — interactive rows take the control height, the ui-tabs precedent)\nextends: UIElement      # structural — NOT form-associated; the rail carries no value, only its items commit selections upward as events\n# marginal: measured at the @agent-ui/app integration slice (Phase 3, LLD-C12; scripts/measure-size.mjs)\n\nattributes:              # attributes-as-API — mirrors nav-rail.ts `static props`\n  - name: collapse\n    type: enum\n    values: [menu, drill-in, icon-popover, none]\n    default: menu\n    reflect: true         # the [collapse=…] CSS branches (nav-rail.css) + the CONSUMER\'s own narrow-behavior choice; out-of-set/unset coerces to `menu` (values[0] fallback, SPEC-R1 AC2). `none` (GH #170/ADR-0155) = a plain never-collapsing vertical rail, for a consumer whose SHELL owns the narrow hide/overlay (the docs site).\n  - name: collapseContainer\n    type: enum\n    values: [self, ancestor]\n    default: self\n    reflect: true         # TKT-0035 — WHICH box the collapse="menu" 40rem @container query measures. self (default): the rail\'s own box (unchanged). ancestor: the rail relinquishes its own containment so the NAMED `@container ui-nav-rail-collapse` query resolves against the nearest ancestor the consumer opts in via `container-type: inline-size; container-name: ui-nav-rail-collapse` — the narrow-sidebar seam (a rail in a ~15rem column tracks the shell/viewport instead of its own always-narrow box). HTML attribute is `collapse-container` (an explicit `attribute:` override in nav-rail.ts — same as button.ts\'s `icon-only`).\n\nproperties: []           # no manual accessors beyond the attributes-as-API\n\nevents:\n  - name: select\n    detail: \'string\'\n    description: Fired on a genuine user activation of a BARE (button-shaped, no `href`) item — never on a link-shaped item\'s native navigation, never on a programmatic `selected` write (binding hygiene, the `ui-master-detail`/`ui-tabs` precedent). Detail is the activated item\'s `id` (or trimmed textContent if unset).\n  - name: change\n    detail: \'string\'\n    description: Fired alongside `select`, same timing, same detail (the fleet\'s select/change-pair convention).\n\nslots: []                # authored light-DOM ChildList of ui-nav-rail-group / ui-nav-rail-item — component-native children (the ui-tabs precedent), not attribute-slotting; both shipped consumers construct these programmatically (SPEC-R2, ADR-0130 cl.3)\n\nparts:                   # control-created, `collapse="menu"` mode only (LLD-C4) — NOT shadow-DOM ::part()\n  - name: trigger\n    description: A control-created `<button type="button" data-part="trigger">`, built once when `collapse="menu"` (LLD-C4, GH #368). Hidden wide (inert chrome); narrow, it names the current/selected item, carries `aria-expanded` + `aria-controls`, and opens `list` on activation — pointer click, Enter and Space alike, since it is a real button.\n  - name: list\n    description: A control-created `<div data-part="list">` wrapping the original group/item tree. Wide, it is the in-flow vertical list. Narrow, `ui-nav-rail` arms it as a `popover="auto"` panel and `overlay()` renders it in the TOP LAYER, anchor-positioned to `trigger` (flip + shift at viewport edges) — so no clipping or stacking ancestor can trap it (GH #368; the GH #260 class) — as a content-sized card between a `min-inline-size` floor and a `max-inline-size` ceiling, never stretched to the rail\'s own width. The wrapping is LIVE, not a one-time move (GH #378): a child appended to the rail after first build is relocated into `list` too, so SPEC-R2 AC2\'s later-added children reach the flyout the same way they reach role derivation. NAMED `list`, not `panel` as the fleet\'s other direct `overlay()` consumers name theirs (`ui-popover`, `ui-form-popover`, `ui-calendar`) — deliberately, because this box is DUAL-ROLE and only one of its two roles is a panel (GH #377): wide it is the rail\'s ordinary in-flow vertical list, with no overlay involved at all, and it holds that shape at every band a consumer never collapses. `panel` would name the narrow half and mis-name the default one; `list` is true in both. So the "ui-popover anatomy" precedent this arm cites is about the OVERLAY MECHANISM — a real button trigger plus a top-layer `popover=auto` box, wired through the one shared trait — never about part naming.\n\ncustomStates: []          # the rail itself carries no interaction state of its own — states live on the item child (the family-folder law first recorded by the retired ui-app-shell.md — ADR-0156; the pattern is now the family descriptors\' own convention); ui-nav-rail-item carries none either (a plain reflected `selected` attribute already drives its CSS, no :state() needed)\n\nface:\n  formAssociated: false   # NOT a FACE form control — a coordinating container; items commit selections as events, never a form value\n\naria:\n  role: navigation | tablist   # DERIVED from item SHAPE, never from `collapse` (ADR-0130 cl.4): every descendant item link-shaped (non-empty href) ⇒ navigation; every one bare ⇒ tablist. A mixed/empty rail defaults to navigation (SPEC §7 non-goal, never throws).\n  roleSource: internals        # set via ElementInternals, never a host role attribute; re-derived on every subtree mutation (a MutationObserver, so later-added children re-derive too, SPEC-R2 AC2)\n\nkeyboard:\n  - keys: Enter or Space\n    action: \'collapse="menu" only — with the narrow `trigger` focused, opens the flyout panel and moves focus to its first focusable row (SPEC-R5 AC2). Both keys come free from the real `<button>` trigger, which delivers each as one `click`.\'\n  - keys: Escape\n    action: \'collapse="menu" only — closes the open narrow flyout and returns focus to the trigger (SPEC-R5 AC2). PLATFORM-owned via `popover="auto"` light-dismiss (GH #368), not a hand-rolled key handler; the focus return is `overlay()`\'\'s own contract.\'\n  - note: Outside-click also closes the open `collapse="menu"` narrow flyout, by the same platform light-dismiss (SPEC-R5 AC2). Every other keyboard contract (item activation, `ui-menu`\'s roving focus in `collapse="icon-popover"`) is each composed part\'s OWN, inherited unchanged.\n\ngeometry:\n  sizeClass: pattern\n  blockSize: auto            # fills its layout parent; each item ROW takes --ui-nav-rail-height (the Pattern law)\n  paddingBlock: 0\n  narrowThreshold: 40rem     # the NAMED `@container ui-nav-rail-collapse` threshold (collapse="menu"); mirrors ui-master-detail\'s own starting value — the shared 40rem line `shell-breakpoint.ts` names (`SHELL_NARROW_BREAKPOINT_REM`, ADR-0155). Measured against the rail\'s own box under collapse-container="self" (default), or a consumer-opted ancestor under collapse-container="ancestor" (TKT-0035)\n\nforcedColors: The active item\'s indicator border (ui-nav-rail-item\'s own signifier) repaints to `Highlight` under `forced-colors: active` (SPEC-R4), never vanishing — a border, not a fill-only affordance, survives forced colors (the same law master-detail.md\'s divider states; first proven on the retired `ui-app-shell`\'s dividers, ADR-0156).\n---\n\n# ui-nav-rail\n\n`ui-nav-rail` is the **unified nav-rail family** (`@agent-ui/app`) — ONE element with a closed `collapse`\nenum (`menu` · `drill-in` · `icon-popover`) governing its own narrow-width disposition, replacing two\nindependent hand-rolled implementations (the docs site\'s primary nav, `ui-settings`\' sections rail) with one\nshared primitive (ADR-0130). This folder ships the family itself (Phase 1); the two consumer migrations are\na later wave.\n\n```html\n<ui-nav-rail collapse="menu">\n  <ui-nav-rail-group label="Components">\n    <ui-nav-rail-item href="/button">Button<span slot="trailing" data-role="tag">new</span></ui-nav-rail-item>\n    <ui-nav-rail-item href="/select">Select</ui-nav-rail-item>\n  </ui-nav-rail-group>\n</ui-nav-rail>\n```\n\n## Content model\n\nAn authored light-DOM `ChildList` of `ui-nav-rail-group` (optional; carries a context-label) and/or bare\n`ui-nav-rail-item` — component-native sub-elements (the `ui-tabs` precedent, ADR-0130 cl.3), not a\n`schema`/`store` data-prop pair. Both shipped consumers construct this programmatically from their own data\nsource. No children ⇒ an empty rail, never a throw; children appended after connect are picked up by the\nrole-derivation `MutationObserver` (SPEC-R2 AC2).\n\n## `collapse` — the four dispositions\n\n- **`menu`** (default) — wide: the full grouped list, in flow. Narrow (below the rail\'s own `40rem`\n  container-width threshold): collapses into a single button naming the current item, which opens the list as\n  a **top-layer flyout card** anchored to that button (GH #368) — Escape/outside-click dismissible via the\n  platform\'s own `popover="auto"` light-dismiss, and immune to clipping or stacking ancestors.\n- **`drill-in`** — the rail renders identically at every width; it contributes anatomy ONLY. The CONSUMER\n  composes it as the `list`-pane content inside its own `ui-master-detail`, whose shipped narrow drill-in/\n  back mechanism is unchanged and untouched by this family (ADR-0130 cl.5).\n- **`icon-popover`** — items render icon-only; a `ui-nav-rail-group` with 2+ items discloses them via an\n  internally-composed `ui-menu` (roving focus, commit-and-close, dismissal — inherited wholesale). At most\n  one group\'s menu is open at a time (ADR-0130 cl.6).\n- **`none`** (GH #170/ADR-0155) — the plain grouped vertical list at EVERY band: no trigger, no flyout,\n  no icon-popover, no drill-in anatomy. For a consumer whose OWN container owns the narrow behavior — e.g.\n  the docs site, where `ui-super-shell` (`collapse-band="compact"` + `narrow-start="collapse"`) hides the\n  whole nav pane below the compact line and toggle-restores it as an overlay; the rail just renders its\n  vertical anatomy inside that pane/overlay.\n\n## `collapse-container` — WHICH box `collapse="menu"` measures (TKT-0035)\n\n`collapse="menu"`\'s narrow disclosure is gated by a **NAMED** `@container ui-nav-rail-collapse (inline-size\n< 40rem)` query. `collapse-container` picks which box that named container resolves against:\n\n- **`self`** (default) — the rail establishes the named container itself; the query reads its own\n  inline-size, unchanged from the primitive\'s original behaviour. Right for a rail that fills its layout\n  region (a full-width top bar, a wide panel).\n- **`ancestor`** — the rail relinquishes its own containment (`container-type: normal`); the query walks up\n  to the nearest ancestor the CONSUMER opts in:\n\n  ```css\n  .app-shell {\n    container-type: inline-size;\n    container-name: ui-nav-rail-collapse;\n  }\n  ```\n\n  ```html\n  <div class="app-shell">\n    <ui-nav-rail collapse="menu" collapse-container="ancestor">…</ui-nav-rail>\n  </div>\n  ```\n\n  This is the seam for a narrow-sidebar rail (e.g. a ~15rem docs nav column, which would otherwise always\n  read below 40rem and never show a desktop vertical rail) whose collapse should track an ancestor\'s width\n  (the app shell, effectively the viewport) instead of its own box. No consumer override of the rail\'s own\n  `container-type` is needed — `collapse-container="ancestor"` is the supported seam, not a CSS workaround.\n  If no ancestor names the container, the query never matches and the rail simply never collapses (a safe\n  failure — never the opposite, always-collapsed, failure the unnamed-container coupling risked).\n\n## Accessibility — role derives from item SHAPE, not `collapse`\n\nA rail whose items are all real links (`href` set) exposes `role="navigation"`; a rail whose items are all\nbare (in-page selection commits) exposes `role="tablist"` with each item `role="tab"` + `aria-selected` —\nmirroring `ui-tabs`\' own contract, and correcting `ui-settings`\' current `aria-current` misuse (a settings\nsection-select is not page navigation, ADR-0130 cl.4). A mixed rail is undefined (not a shipped shape).\n\n## Selection commit\n\nA genuine user activation of a bare item sets its `selected`, clears its siblings, and emits `select`/\n`change` on the rail (the item\'s `id`, or its trimmed text). A link-shaped item\'s native navigation is never\nintercepted. A `collapse="icon-popover"` group\'s synthetic menu item forwards the same pair on commit.\n',s=`---
# nav-rail-group.md frontmatter — the attributes-as-API descriptor for ui-nav-rail-group (ADR-0004;
# ADR-0130 cl.3/cl.6; SPEC nav-rail-family.spec.md SPEC-R2/R6/R8). The \`attributes[]\` block MUST mirror
# nav-rail-group.ts \`static props\` — the contract↔props trip-wire (nav-rail.test.ts) targets this fence.
# Nests in the \`ui-nav-rail\` family folder (naming.md §9).
tag: ui-nav-rail-group
tier: pattern           # geometry size-class — a sub-element of the Pattern-class family; contributes no control height of its own
extends: UIElement      # a generic sub-element (the ui-tabs sub-element precedent, ADR-0130 clause 3) — docking is composition, not a data-prop
# marginal: measured at the @agent-ui/app integration slice (Phase 3, LLD-C12; scripts/measure-size.mjs)

attributes:
  - name: label
    type: string
    default: ''
    reflect: true       # TKT-0069 item 2 ruling: label reflects fleet-wide

properties:
  - name: label
    description: The group's context-label — rendered as a \`<span data-part="context-label">\` heading above its items (menu/drill-in modes) and, in \`collapse="icon-popover"\` mode, the composed \`ui-menu\` trigger's \`aria-label\` (the SAME prop, two renderings, never diverging).

events: []                # a group emits none of its own — the composed ui-menu (icon-popover mode) emits its own select/toggle/close, listened to internally and forwarded (see ui-nav-rail.md)

slots:
  - name: leading
    optional: true
    description: An optional leading icon — used as the \`collapse="icon-popover"\` composed \`ui-menu\` trigger's visual icon (moved in). Unused in menu/drill-in modes.

parts:
  - name: context-label
    description: A control-created \`<span data-part="context-label">\` heading, rendered above the group's items when \`label\` is non-empty.
  - name: items
    description: A control-created \`<div data-part="items">\` wrapper around the group's \`ui-nav-rail-item\` children — menu/drill-in modes, or a degenerate icon-popover group with < 2 items (a lone item needs no popover).

customStates: []          # no interaction state of its own

face:
  formAssociated: false

aria:
  role: none               # the group carries no ARIA role of its own — a context-label is a plain heading-shaped span, not a landmark; the composed ui-menu's own ARIA (icon-popover mode) is its own, inherited unchanged
  roleSource: none

keyboard: []               # no keyboard handling of its own — a composed ui-menu's roving-focus/commit/dismissal contract (icon-popover mode) is entirely its own, inherited unchanged

geometry:
  sizeClass: pattern
  blockSize: auto
  paddingBlock: 0
  narrowThreshold: inherited   # the icon-popover flyout's own anchor/positioning is entirely ui-menu's

forcedColors: Carries none of its own — the composed ui-menu's forced-colors contract (icon-popover mode) and the item rows' active-indicator repaint (nav-rail-item.md) cover this element's whole rendered surface.
---

# ui-nav-rail-group

\`ui-nav-rail-group\` is an optional cluster inside \`ui-nav-rail\` — a context-label heading over a set of
\`ui-nav-rail-item\` children, composed one of two ways depending on the ancestor rail's \`collapse\` mode
(read once, at connect): a plain items wrapper (\`menu\`/\`drill-in\`, or a < 2-item \`icon-popover\` group), or an
internally-composed \`ui-menu\` flyout (\`icon-popover\`, 2+ items) whose trigger is this group's own icon/label.

\`\`\`html
<ui-nav-rail-group label="Components">
  <ui-nav-rail-item href="/button">Button</ui-nav-rail-item>
  <ui-nav-rail-item href="/select">Select</ui-nav-rail-item>
</ui-nav-rail-group>
\`\`\`

## \`collapse="icon-popover"\` composition

Each item's state (\`href\`/\`selected\`/text/leading icon) is read ONCE, before any item builds its own
activator, and re-expressed as a fresh \`<a>\`/\`<button>\` appended directly into one composed \`ui-menu\` (the
group's icon becomes the menu's trigger; the original items are removed, their content fully re-expressed).
\`ui-menu\`'s own roving-focus, commit-and-close, and dismissal contract (ADR-0043/0045) is inherited
wholesale — never re-derived. A bare (selection-commit) synthetic item's commit forwards the SAME
\`select\`/\`change\` pair \`ui-nav-rail\` emits for a top-level item.
`,c=`---
# nav-rail-item.md frontmatter — the attributes-as-API descriptor for ui-nav-rail-item (ADR-0004;
# ADR-0130 cl.4/cl.7; SPEC nav-rail-family.spec.md SPEC-R3/R6). The \`attributes[]\` block MUST mirror
# nav-rail-item.ts \`static props\` — the contract↔props trip-wire (nav-rail.test.ts) targets this fence.
# Nests in the \`ui-nav-rail\` family folder (naming.md §9).
tag: ui-nav-rail-item
tier: pattern           # geometry size-class — Pattern (the interactive row IS the control-height unit the family's Pattern tier describes)
extends: UIElement      # NOT form-associated (face below) — carries no value; href present renders a real <a>, absent a real <button> (SPEC-R3)

attributes:
  - name: href
    type: string
    default: ''
    reflect: true         # '' ⇒ renders a real <button type="button"> (an in-page selection commit); non-empty ⇒ a real <a href> (real navigation)
  - name: selected
    type: boolean
    default: false
    reflect: true          # the active/current item — drives the non-color-alone border-inline-start indicator + the activator's aria-current/aria-selected

properties: []           # no manual accessors beyond the attributes-as-API

events: []                # this element emits none of its own — a genuine activation is observed + acted on by the owning ui-nav-rail (delegated click listener), which is the SOLE emitter of select/change

slots:
  - name: leading
    optional: true
    description: Optional leading adornment — a light-DOM \`[slot="leading"]\` child (typically \`data-role="icon"\`), placed in the start cell of the created activator part (anatomy.md's position/role axes, one level down from \`ui-button\`'s own pattern).
  - name: label
    optional: true
    description: The label — the default/unnamed children; the accessible name. Re-expressed internally into one synthetic \`[data-part="label"]\` span (inside the activator) so \`collapse="icon-popover"\` can visually-hide JUST the label while it remains the accessible name.
  - name: trailing
    optional: true
    description: Optional trailing adornment — a light-DOM \`[slot="trailing"]\` child, commonly \`data-role="tag"\` (REALIZES anatomy.md's reserved \`tag\` role, SPEC-R6's wide name|tag row; truncates via ellipsis narrow, never wraps).

parts:
  - name: activator
    description: The control-created \`<a href>\` (href non-empty) or \`<button type="button">\` (href empty) wrapping the item's slotted content — the ONE interactive/AX-bearing node this element renders. Swapped (never left coexisting) when \`href\` flips empty↔non-empty shape post-connect.
  - name: label
    description: A control-created \`<span data-part="label">\` inside the activator, wrapping the item's default/unnamed (label) content — re-expressed so \`collapse="icon-popover"\` mode can visually-hide it independently of any leading/trailing adornment.

customStates: []          # no :state() hooks — \`selected\` is a plain reflected attribute (\`ui-nav-rail-item[selected]\`) already driving the CSS indicator; no ElementInternals custom state needed on top of it

face:
  formAssociated: false

aria:
  role: tab | none          # href empty ⇒ the activator's role is overridden to \`tab\` (SPEC-R3 AC2, mirroring ui-tabs); href non-empty ⇒ the activator is a real \`<a>\`, its native implicit "link" role stands, no override
  roleSource: 'the activator PART''s own attributes (setAttribute) — NOT ElementInternals: attachInternals() throws on a plain, non-custom <a>/<button>, so internals is mechanically unavailable to a created part. The HOST itself carries no ARIA of its own (a transparent display:contents wrapper).'
  selectionSource: "the activator's aria-selected (bare/button shape) or aria-current='page' (href/link shape) — never both on one item (SPEC-R3 AC1 vs AC2)"
  labelSource: the item's light-DOM children (re-expressed into the activator's [data-part=label] span)

keyboard:
  - note: The activator IS a real \`<a>\`/\`<button>\` — native Tab/Enter/Space/click all work natively, no bespoke trait needed.

geometry:
  sizeClass: pattern
  blockSize: var(--ui-nav-rail-height)   # the Pattern law — the row takes the control height
  paddingBlock: 0
  inlinePad: h/2 (slotless label) · presence-driven leading/trailing cells (anatomy.md, one level down from ui-button)

forcedColors: The active item's \`border-inline-start\` indicator repaints to \`Highlight\` under \`forced-colors: active\` (SPEC-R4), never vanishing — a border, not a fill-only affordance, survives forced colors (the same law master-detail.md's divider states; first proven on the retired \`ui-app-shell\`'s dividers, ADR-0156).
---

# ui-nav-rail-item

\`ui-nav-rail-item\` is one row of \`ui-nav-rail\` — either a real link (\`href\` set) or an in-page selection
commit (\`href\` empty). It renders a control-created **activator** part — a real \`<a href>\` or \`<button
type="button">\` — wrapping its slotted content, so native navigation/activation/focus all work for free.

\`\`\`html
<ui-nav-rail-item href="/components/button">Button</ui-nav-rail-item>
<ui-nav-rail-item selected>Overview</ui-nav-rail-item>  <!-- href empty ⇒ a real <button>, role="tab" -->
<ui-nav-rail-item href="/x">Name<span slot="trailing" data-role="tag">v2</span></ui-nav-rail-item>
\`\`\`

## Shape (SPEC-R3)

\`href\` non-empty renders a real \`<a href="…">\` — genuine navigation, none of which ARIA alone can replicate
(status-bar preview, ctrl/cmd-click-new-tab, crawlability). \`href\` empty renders a real \`<button
type="button">\` with its role overridden to \`tab\` (a single well-formed node — \`role\` replaces the native
implicit role, it does not stack a second role on top of it). Toggling \`href\` post-connect reactively swaps
the activator's shape (never a one-shot).

## Accessibility

\`aria-current="page"\` (link shape) or \`role="tab"\` + \`aria-selected\` (button shape) rides the activator
part's own attributes, never \`ElementInternals\` (mechanically unavailable on a plain created \`<a>\`/
\`<button>\` — the same "a created part uses setAttribute" convention \`ui-menu\`'s panel and \`ui-tabs\`' tablist
strip already establish). The active item's \`border-inline-start\` indicator is non-color-alone and survives
\`forced-colors\`.
`,{content:l}=e({title:`Composing a ui-nav-rail`,intro:"ui-nav-rail is ONE navigation-rail primitive with a closed `collapse` enum choosing its own narrow-width disposition — a grouped vertical list wide, and below the line either a top-layer flyout, nothing at all, icon-only popovers, or a drill-in the consumer composes. Three elements, no bespoke rail markup, active indication and ARIA role derived rather than declared."});l.append(t("Author a plain ChildList of ui-nav-rail-group and ui-nav-rail-item children. An item with an `href` renders a real <a> (native navigation, never intercepted); a bare item renders a <button> and commits a selection as `select`/`change` on the rail. The rail derives its own ARIA role from that item SHAPE — all-link ⇒ navigation, all-bare ⇒ tablist — so you never declare it."));function u(e,t,n){let r=document.createElement(e);return r.className=t,n!==void 0&&(r.textContent=n),r}function d(e){return n(2,e)}function f(e){return u(`code`,`as-code`,e)}function p(e){return u(`p`,`as-caption`,e)}function m(e,t={}){let n=document.createElement(`ui-nav-rail`);n.className=`nr-demo`,n.setAttribute(`collapse`,e),n.setAttribute(`aria-label`,`${e} demo`),t.container&&n.setAttribute(`collapse-container`,t.container);for(let[e,r]of[[`Components`,[[`Button`,`#button`,!0],[`Select`,`#select`,!1],[`Text Field`,`#text-field`,!1]]],[`Guides`,[[`Theming`,`#theming`,!1],[`Sizing`,`#sizing`,!1]]]]){let i=document.createElement(`ui-nav-rail-group`);i.setAttribute(`label`,e);for(let[e,n,a]of r){let r=document.createElement(`ui-nav-rail-item`);if(r.setAttribute(`href`,n),a&&r.setAttribute(`selected`,``),r.textContent=e,t.tagged&&e===`Select`){let e=document.createElement(`span`);e.slot=`trailing`,e.setAttribute(`data-role`,`tag`),e.textContent=`new`,r.append(e)}i.append(r)}n.append(i)}return n}l.append(d(`1 · Composition — three elements, no rail CSS of your own`)),l.append(t(`A `,f(`ui-nav-rail-group`),` carries a context-label heading; each `,f(`ui-nav-rail-item`),` is one row. A trailing `,f(`data-role="tag"`),` cell right-justifies a badge and truncates with an ellipsis rather than wrapping the row (SPEC-R6). The active item gets a real border indicator, not a colour-only one, so it survives forced-colors.`)),l.append(u(`pre`,`as-snippet`,`<ui-nav-rail collapse="menu">
  <ui-nav-rail-group label="Components">
    <ui-nav-rail-item href="/button" selected>
      Button<span slot="trailing" data-role="tag">new</span>
    </ui-nav-rail-item>
    <ui-nav-rail-item href="/select">Select</ui-nav-rail-item>
  </ui-nav-rail-group>
</ui-nav-rail>`));{let e=u(`div`,`nr-resize`);e.append(m(`menu`,{tagged:!0})),l.append(e),l.append(p(`↑ collapse="menu", wide. Drag the resize handle (bottom-right) below 40rem to watch it collapse.`))}l.append(d("2 · `collapse` — the four narrow dispositions")),l.append(t(`One closed enum picks what the rail does below its own container-width threshold. It is measured against the RAIL’S OWN box by default, never the viewport — so a rail in a narrow column behaves the same wherever the window is.`));var h=[[`menu`,`the default — collapses into one trigger that opens the list as a top-layer flyout card`],[`none`,`never collapses; the plain grouped vertical list at every band, for a consumer whose own shell owns narrow`],[`icon-popover`,`items render icon-only; a group of 2+ discloses its items through a composed ui-menu`],[`drill-in`,`the rail never reflows at all — it contributes anatomy only, and YOU compose ui-master-detail around it`]];{let e=document.createElement(`ul`);e.className=`as-prose`;for(let[t,n]of h){let r=document.createElement(`li`);r.append(f(`collapse="${t}"`),document.createTextNode(` — ${n}`)),e.append(r)}l.append(e)}l.append(d(`3 · collapse="menu" narrow — a top-layer flyout card`)),l.append(t(`Below the line the rail becomes a single button naming the current item. Activating it — click, `,f(`Enter`),` or `,f(`Space`),` — opens the whole grouped list as a card anchored under that button, in the browser’s TOP LAYER. It is the fleet’s one overlay mechanism, so dismissal is the platform’s: `,f(`Escape`),` or a click outside, with focus moving into the panel on open and back to the button on close. The card is sized by its CONTENT between a floor and a ceiling — never stretched to the rail’s own width, which would read as the shell’s edge rather than the menu’s.`));{let e=u(`div`,`nr-narrow`);e.append(m(`menu`,{tagged:!0})),l.append(e),l.append(p(`↑ A fixed 18rem frame — already below the 40rem line. Open the trigger to see the card.`))}l.append(d(`4 · Why the top layer — a clipping ancestor cannot trap it`)),l.append(t(`The frame below is only `,f(`3.5rem`),` tall with `,f(`overflow: hidden`),` — far too short to contain the open panel, and it really does clip its own content. Open the trigger anyway: the flyout renders in the top layer, so it escapes the clip entirely. An `,f(`position: absolute`),` panel could not, and would be cut off at the dashed edge — the failure this arm used to have, and the reason the fix was to adopt the overlay controller rather than to nudge a z-index.`));{let e=u(`div`,`nr-clipper`);e.append(m(`menu`)),l.append(e),l.append(p(`↑ A deliberately clipping ancestor. The open flyout is unaffected by it.`))}l.append(d("5 · `collapse-container` — WHICH box the threshold measures")),l.append(t(`A rail in a genuinely narrow sidebar (say a 15rem docs nav column) is ALWAYS below 40rem against its own box, so it would collapse forever. `,f(`collapse-container="ancestor"`),` relinquishes the rail’s own containment so the threshold resolves against the nearest ancestor that opts in:`)),l.append(u(`pre`,`as-snippet`,`.app-shell {
  container-type: inline-size;
  container-name: ui-nav-rail-collapse;
}

<div class="app-shell">
  <ui-nav-rail collapse="menu" collapse-container="ancestor">…</ui-nav-rail>
</div>`)),l.append(t(`If no ancestor names the container the query simply never matches and the rail never collapses — a safe failure, never the opposite. The JS that arms the flyout watches that SAME resolved box, so the CSS threshold and the overlay can never disagree about which band the rail is in.`));{let e=u(`div`,`nr-named-ancestor`),t=u(`div`,`nr-column`);t.append(m(`menu`,{container:`ancestor`})),e.append(t),l.append(e),l.append(p(`↑ A 15rem column inside a WIDE named ancestor: the vertical rail stays, even though the rail’s own box is far below 40rem. Drag the outer frame narrow and it collapses — tracking the ancestor, not itself.`))}l.append(d(`6 · icon-popover and drill-in`)),l.append(t(f(`collapse="icon-popover"`),` renders items icon-only, keeping each label as the accessible name (visually clipped, never removed), and a group of 2+ items discloses them through an internally composed `,f(`ui-menu`),` — roving focus, commit-and-close and dismissal inherited wholesale, with at most one group open at a time. `,f(`collapse="drill-in"`),` is the anatomy-only mode: the rail renders identically at every width and the CONSUMER composes it as the list pane of its own `,f(`ui-master-detail`),`, whose shipped narrow drill-in is untouched by this family.`));{let e=u(`div`,`nr-narrow`);e.append(m(`drill-in`,{tagged:!0})),l.append(e),l.append(p(`↑ collapse="drill-in" in the same 18rem frame: no collapse, no trigger — anatomy only.`))}l.append(d(`API reference`)),l.append(t(`Read straight from the three shipped descriptors (nav-rail.md · nav-rail-group.md · nav-rail-item.md) through the same parser the package's contract trip-wire validates.`));for(let[e,t]of[[`ui-nav-rail`,o],[`ui-nav-rail-group`,s],[`ui-nav-rail-item`,c]]){let n=a(t);l.append(u(`h3`,`as-api-tag`,e)),n.descriptor.attributes.length>0&&l.append(i(n.descriptor.attributes,4));let o=r(n.descriptor,4);o&&l.append(o)}