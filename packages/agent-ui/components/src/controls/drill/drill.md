---
# drill.md frontmatter — the attributes-as-API descriptor for the drill compound (ADR-0004 / ADR-0195). The
# machine-checkable PRIMARY-element surface lives HERE (frontmatter for ui-drill); the prose below the fence is
# the /site doc and documents BOTH elements (ui-drill · ui-drill-panel — one folder, one writer, the ui-tabs/
# ui-tab-panel compound precedent — ui-drill-panel ships no descriptor of its own). The `attributes[]` block
# MUST mirror drill.ts `static props` (the ...UIContainerElement.surfaceProps spread — elevation/brightness —
# plus the bindable `path`, plus `view-transitions`) — the contract↔props trip-wire (drill-descriptor.test.ts)
# targets this fence. Field set per .claude/docs/plan.md §10 / ADR-0004; the surface axes per ADR-0015; the
# controlled/uncontrolled `path` duality per ADR-0102 (the ui-split.sizes precedent); the ADR-0183/GH#958
# view-transition opt-in.
tag: ui-drill
description: A one-panel container that drills down an N-level selection tree, showing exactly one level at a time with a Back affordance and a bindable path.
tier: pattern          # geometry size-class — geometry.md "Pattern" (container + control-height rows): the header row (Back + heading) takes the CONTROL height, the panel viewport uses the --md-sys-space ladder
extends: UIContainerElement  # the FIRST non-form family — surface axes + reused internals (ARIA); NOT form-associated (face below)
# marginal: measured by `npm run size`'s components-barrel LEAVE-ONE-OUT delta (manual by Kim's ruling) — within the per-control ≤ ~2 kB tier budget (plan §10)

attributes:               # attributes-as-API — mirrors drill.ts `static props` (the surface axes first, then path, then view-transitions)
  - name: elevation
    type: enum
    values: [0, 1, 2, 3, -1, -2, -3]
    default: 0
    reflect: true         # the scheme-INVERTING surface plane (ADR-0015 cl.1); 0 = the neutral base
  - name: brightness
    type: enum
    values: [0, 1, 2, 3, -1, -2, -3]
    default: 0
    reflect: true         # the scheme-CONSISTENT tonal wash (ADR-0015 cl.1); 0 = no wash
  - name: path
    type: json
    default: undefined    # String(undefined) = 'undefined' — the LIVE default; undefined ⇒ UNCONTROLLED (an internal signal drives + self-mutates); present ⇒ CONTROLLED (renders the prop, emits proposed values on `change`, never self-mutates) — the ui-split `sizes` precedent verbatim
    reflect: false         # NEVER reflected — `attribute: false` in source (a JS property only, too structured for markup; ADR-0102 prop-as-source-of-truth)
  - name: viewTransitions
    type: boolean
    default: false        # ADR-0183 opt-in — the ui-super-shell naming precedent. HTML attribute is `view-transitions` (an explicit `attribute:` override in drill.ts — the nav-rail `collapse-container`/`collapseContainer` precedent). Off ⇒ byte-identical CSS-transform-only motion (progressive enhancement)
    reflect: true

properties:               # IDL beyond attributes-as-API
  - name: path
    description: The FULL chain from the root panel's key through the current leaf (string[]), INCLUSIVE of the root — never empty once resolved. UNCONTROLLED (undefined) — the control tracks position internally and self-mutates on Back/drill-forward. CONTROLLED (an array) — the control renders it and only EMITS the proposed value on `change`; the consumer/agent owns the write-back (the ui-split.sizes precedent, ADR-0102).

events:
  - name: change
    detail: 'string[]'
    description: Fired with the proposed/new path on every Back click and every drill-forward activation (a click or Enter/Space on a descendant of the active panel carrying data-role="drill-trigger" + data-drill-key). In UNCONTROLLED mode (path undefined) the internal position also self-mutates to this value before the event fires.

slots: []                 # NO named slots — panels are component-native ChildList elements (ui-drill-panel), not slotted adornments; a panel's content is its own light-DOM children

parts:                    # the control-created header strip is a PART (ADR-0195 cl.1) — panels stay as author-owned SIBLINGS, never moved
  - name: header
    description: The control-created `<div data-part="header" data-box>` strip holding the Back button and the level heading. Created ONCE (idempotent guard) and never re-rendered as a whole — its children's text/visibility update per render pass. The host carries no role/aria-* attribute; the header itself carries none either (a plain layout row).
  - name: back
    description: The control-created `<button data-part="back" type="button">` — hidden when the resolved path has only the root (nothing to go back to). aria-label reads "Back" or "Back to {parent heading}" when the parent panel's heading is resolvable. Real button semantics — native Tab/Enter/Space, no bespoke keyboard wiring needed for it.
  - name: heading
    description: The control-created `<h2 data-part="heading" tabindex="-1">` — a REAL heading element (not a generic div), textContent mirrors the active panel's `heading` prop. Receives programmatic focus on every NON-INITIAL path change (a #primed guard prevents focus theft on mount). aria-labelledby target for the active ui-drill-panel's region role.

customStates: []          # none — visibility rides the plain `hidden` attribute (the ui-tab-panel precedent), not a :state() hook

face:
  formAssociated: false   # NOT a FACE form control — a navigation container contributes nothing to a form (the ui-split/ui-drawer/ui-tabs reasoning)

aria:
  role: group             # this.internals.role = 'group' on the host — a labelled navigation region (the ui-modal internals.role precedent, never a host attribute)
  roleSource: internals (this.internals.role)
  labelSource: none on the host itself — the active ui-drill-panel's own role=region is aria-labelledby-linked to the [data-part="heading"] element (element-reflection, the ui-tab-panel precedent)

keyboard:
  - keys: Tab / Shift+Tab
    action: Native document Tab order — the Back button and any interactive content inside the active panel are ordinary Tab stops. No roving focus, no type-ahead (a container, not a listbox/tablist).
  - keys: Enter / Space
    action: Activates the focused [data-part="back"] button (native) OR, when focus sits on a non-native data-role="drill-trigger" element inside the active panel, drills forward into the key it names (a delegated keydown covers the non-native case; a real <button>/<a href> trigger needs no extra wiring).
  - keys: Escape
    action: A convenience alias for Back (not required by the component's own contract, zero cost — the standard drill-down UX expectation). No-op when already at the root.

geometry:
  sizeClass: pattern       # container + control-height header row (geometry.md Pattern class, the ui-tabs/ui-toolbar example); the panel viewport uses the space-scale ladder, no control height
  headerHeight: var(--ui-drill-header-height)   # = var(--md-sys-height-md) — the interactive back+heading row
  padding: var(--ui-drill-padding)              # panel viewport padding, space-scale
  outline: var(--ui-drill-outline)              # the header's bottom hairline

forcedColors: A `@media (forced-colors: active)` block keeps the header hairline and the Back button's ink visible as system colours (CanvasText) — the tabs/modal/drawer precedent (component-checker peer-parity fix); no scrim/backdrop exists on this control (it is not an overlay).
---

# ui-drill

`ui-drill` is a **one-panel container that drills down an N-level selection tree** — exactly one level's
content is visible at a time, sliding the next level in on a forward selection and the previous level back on
Back (ADR-0195, GH #954). It extends `UIContainerElement` and is **not** form-associated. The fleet's only
prior drill-down shape, `ui-nav-rail collapse="drill-in"` (SPEC-R7), is a 2-pane master↔detail flip with no
path-array state — `ui-drill` is the generic N-level primitive that shape lacked.

```html
<ui-drill aria-label="Settings">
  <ui-drill-panel key="root" heading="Settings">
    <ul>
      <li><button data-role="drill-trigger" data-drill-key="appearance">Appearance</button></li>
      <li><button data-role="drill-trigger" data-drill-key="notifications">Notifications</button></li>
    </ul>
  </ui-drill-panel>
  <ui-drill-panel key="appearance" parent="root" heading="Appearance">
    <!-- appearance controls -->
  </ui-drill-panel>
  <ui-drill-panel key="notifications" parent="root" heading="Notifications">
    <!-- notification controls -->
  </ui-drill-panel>
</ui-drill>
```

## Anatomy

The control creates ONE header part at connect (`[data-part="header"]`, holding `[data-part="back"]` +
`[data-part="heading"]`) and prepends it to the host. Author `ui-drill-panel` children stay SIBLINGS of that
header — they are never moved (the `ui-tabs` precedent, not the `ui-modal` child-move precedent). Exactly one
panel is visible at a time (`hidden` on the rest, staying in the DOM).

## Panels — the flat parent-chain

Every `ui-drill-panel` carries `key` (unique per `ui-drill` instance) and `parent` (default `''` = root —
exactly ONE root panel per instance). `path` is the full chain from the root key to the current leaf,
INCLUSIVE of the root, and is never empty once resolved. Depth is expressed entirely through the `parent`
chain, not DOM nesting — panels stay flat siblings regardless of how deep the tree goes.

## Drilling forward

Any descendant of the ACTIVE panel carrying `data-role="drill-trigger"` + `data-drill-key="<key>"` drills into
that key on click (native `<button>`/`<a href>` triggers get Enter/Space for free; a delegated `keydown`
covers a non-native trigger element). This is a declarative authoring convention — no imperative JS is
required to wire a drill-down menu.

## Back

`[data-part="back"]` is a real `<button>` — hidden when the resolved path has only the root (nothing to go
back to). Its `aria-label` reads "Back" or "Back to {parent heading}" when resolvable. `Escape` is wired as a
convenience alias.

## `path` — controlled vs uncontrolled

`path` (`string[] | undefined`) follows the SAME controlled/uncontrolled duality as `ui-split`'s `sizes`
(ADR-0102 prop-as-source-of-truth). Leave it unset and `ui-drill` tracks position internally, self-mutating on
every Back/drill-forward — it works with zero consumer wiring. Set it and the control becomes CONTROLLED: it
renders exactly what `path` says and only **emits** the proposed value on `change` — the consumer (or an
agent's two-way bind) owns writing it back.

## Focus

`[data-part="heading"]` (a real `<h2>`, `tabindex="-1"`) receives programmatic focus on every path change
AFTER the initial mount — a primed guard prevents focus theft on first paint.

## Motion

The CSS-transform base (`@starting-style` + `allow-discrete`) and the ADR-0183 View Transitions layer are
mutually exclusive per swap: `viewTransitions` (opt-in, default off) enables the VT layer for a swap only when
the platform actually supports it (`viewTransitionAvailable()`); every panel shares one `view-transition-name`
per instance (the GH#958 named-morph pairing law — only one panel is ever painted). `prefers-reduced-motion`
suppresses both layers.

## Catalog posture

**TEMPORARY exclusion** (the `ui-toggle`/ADR-0179 shape) — `ui-drill` ships ahead of any A2UI catalog row.
Whether it earns one, and what wire-mark its `path`/children should carry, is a separate, later a2ui-owned
decision (ADR-0195 cl.8).
