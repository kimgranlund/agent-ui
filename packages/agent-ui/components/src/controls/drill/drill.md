---
# drill.md frontmatter — the attributes-as-API descriptor for the drill compound (ADR-0004 / ADR-0195). The
# machine-checkable PRIMARY-element surface lives HERE (frontmatter for ui-drill); the prose below the fence is
# the /site doc and documents BOTH elements (ui-drill · ui-drill-panel — one folder, one writer, the ui-tabs/
# ui-tab-panel compound precedent — ui-drill-panel ships no descriptor of its own). The `attributes[]` block
# MUST mirror drill.ts `static props` (the ...UIContainerElement.surfaceProps spread — elevation/brightness —
# plus the bindable `path`, plus `view-transitions`, plus the ADR-0195 Amendment's `layout`/`chrome`) — the
# contract↔props trip-wire (drill-descriptor.test.ts) targets this fence. Field set per .claude/docs/plan.md
# §10 / ADR-0004; the surface axes per ADR-0015; the controlled/uncontrolled `path` duality per ADR-0102 (the
# ui-split.sizes precedent); the ADR-0183/GH#958 view-transition opt-in; `layout`/`chrome` per the ADR-0195
# Amendment (GH #1510) — S1 (this build) implements only their defaults ('stack'/'backbar').
tag: ui-drill
description: A contained, card-like container that drills down an N-level selection tree — the active level slides in over its dimmed, inert ancestor by default (stack presentation), with a Back affordance and a bindable path.
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
  - name: layout
    type: enum
    values: [stack, columns]
    default: stack        # ADR-0195 Amendment cl.A2. 'columns' (Miller columns, S3, GH #1510) auto-degrades to the 'stack' render mapping whenever the HOST's own inline size falls below ADR-0150's compact-body line (52.5rem/840px, cl.A8) — the attribute value itself never changes, only which render mapping it resolves to
    reflect: true
  - name: chrome
    type: enum
    values: [backbar, crumbs]
    default: backbar       # ADR-0195 Amendment cl.A2/cl.A3. 'backbar' (default, S1) = the Back button + heading pair; 'crumbs' (S2, GH #1510) = a clickable breadcrumb trail replacing that pair — orthogonal to `layout`
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
    description: The control-created `<h2 data-part="heading" tabindex="-1">` — a REAL heading element (not a generic div), textContent mirrors the active panel's `heading` prop. Receives programmatic focus on every NON-INITIAL path change (a #primed guard prevents focus theft on mount). aria-labelledby target for the active ui-drill-panel's region role. Under `chrome="crumbs"` this SAME node (never recreated) is moved to be the last entry of the `crumbs` trail, carrying `aria-current="location"` (ADR-0195 Amendment cl.A3/cl.A6, GH #1510).
  - name: crumbs
    description: 'chrome="crumbs" ONLY: the control-created `<nav data-part="crumbs" aria-label="Breadcrumb">`, created once (hidden whenever chrome !== "crumbs"). Holds one `<button data-part="crumb">` per ANCESTOR entry of the resolved path plus the `heading` part (moved in) as the trail''s last entry. Rebuilt wholesale on every render (ADR-0195 Amendment cl.A3, GH #1510).'
  - name: crumb
    description: 'chrome="crumbs" ONLY: one real `<button type="button" data-part="crumb">` per ancestor path entry, text = that panel''s `heading` (falling back to its `key`). Clicking commits `path.slice(0, i+1)` (direction back) — the same `change`-emitting commit the Back button uses, never a new event (ADR-0195 Amendment cl.A1/A3, GH #1510). Carries NO `aria-current` — that lives on the trail''s last (heading) entry only.

customStates: []          # none — visibility rides the plain `hidden` attribute (the ui-tab-panel precedent), not a :state() hook

face:
  formAssociated: false   # NOT a FACE form control — a navigation container contributes nothing to a form (the ui-split/ui-drawer/ui-tabs reasoning)

aria:
  role: group             # this.internals.role = 'group' on the host — a labelled navigation region (the ui-modal internals.role precedent, never a host attribute)
  roleSource: internals (this.internals.role)
  labelSource: none on the host itself — the active ui-drill-panel's own role=region is aria-labelledby-linked to the [data-part="heading"] element (element-reflection, the ui-tab-panel precedent)

keyboard:
  - keys: Tab / Shift+Tab
    action: Native document Tab order — the Back button (or, under chrome="crumbs", each [data-part="crumb"] link) and any interactive content inside the active panel are ordinary Tab stops. No roving focus, no type-ahead (a container, not a listbox/tablist).
  - keys: Enter / Space
    action: Activates the focused [data-part="back"] button, or (chrome="crumbs") the focused [data-part="crumb"] button — both real native buttons, Enter/Space free — OR, when focus sits on a non-native data-role="drill-trigger" element inside the active panel, drills forward into the key it names (a delegated keydown covers the non-native case; a real <button>/<a href> trigger needs no extra wiring).
  - keys: Escape
    action: A convenience alias for Back (not required by the component's own contract, zero cost — the standard drill-down UX expectation). No-op when already at the root. Unaffected by chrome — a crumbs trail truncates via the SAME #commit path, but Escape itself still pops exactly one level.

geometry:
  sizeClass: pattern       # container + control-height header row (geometry.md Pattern class, the ui-tabs/ui-toolbar example); the panel viewport uses the space-scale ladder, no control height
  headerHeight: var(--ui-drill-header-height)   # = var(--md-sys-height-md) — the interactive back+heading row
  padding: var(--ui-drill-padding)              # panel viewport padding, space-scale
  outline: var(--ui-drill-outline)              # the card border + the header's bottom hairline
  radius: var(--ui-drill-radius)                # ADR-0195 Amendment cl.A5 — the contained card's own corner radius
  scrim: var(--ui-drill-scrim)                  # ADR-0195 Amendment cl.A5 — the non-blocking dim wash on a painted ancestor pane, STACK mapping only
  columnSize: var(--ui-drill-column-size)       # ADR-0195 Amendment cl.A5 (S3) — the layout="columns" per-column track floor

forcedColors: A `@media (forced-colors: active)` block keeps the card border, the header hairline, and the Back button's ink visible as system colours (CanvasText) — the tabs/modal/drawer precedent (component-checker peer-parity fix); the ancestor scrim is not a blocking backdrop (no `::backdrop`/top-layer involved — a plain in-flow overlay), so it carries no forced-colors override of its own. Under `layout="columns"` the column divider (`border-inline-end`) joins the same precedent (ADR-0195 Amendment S3, GH #1510).
---

# ui-drill

`ui-drill` is a **contained, card-like container that drills down an N-level selection tree** — by default
(the `stack` presentation) the active level slides in over its dimmed, inert ancestor inside a single clipped
card surface, with a Back affordance and a bindable path (ADR-0195, GH #954; contained/stack default per the
ADR-0195 Amendment, GH #1510). It extends `UIContainerElement` and is **not** form-associated. The fleet's
only prior drill-down shape, `ui-nav-rail collapse="drill-in"` (SPEC-R7), is a 2-pane master↔detail flip with
no path-array state — `ui-drill` is the generic N-level primitive that shape lacked.

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
header — they are never moved (the `ui-tabs` precedent, not the `ui-modal` child-move precedent). The host is
a 2-row grid: the header takes the auto first row; every panel whose key is in the resolved path — the active
panel AND its painted ancestors — shares the SAME second-row grid cell (same-cell stacking, no DOM move),
clipped to the card's own rounded, bordered edge (`overflow: clip`). Every off-path panel carries `hidden`
(staying in the DOM).

## Presentation: stack (default) — painted ancestors, dimmed + inert

`layout="stack"` (the default) paints every panel in the resolved path, z-ordered so the active panel — always
`path.at(-1)` — sits on top. Painted ancestors are visible but dimmed under a non-blocking `--ui-drill-scrim`
wash and carry the real `inert` attribute (visible pixels, no interaction surface — the swiper clone shape):
no focus, no clicks, and no drill-trigger inside an ancestor panel can ever fire.

## Presentation: columns (Miller columns)

`layout="columns"` (ADR-0195 Amendment cl.A1/A4, GH #1510) paints every panel in the resolved path
**side by side**, in path order, sharing the host's ONE horizontal scroll region (`overflow-x: auto`) — every
column stays **fully interactive**: no `inert`, no dim wash. A `data-role="drill-trigger"` inside a
non-rightmost (ancestor) column still drills forward — it **truncates the resolved path at its own hosting
column, then appends** (`path.slice(0, i+1).concat(key)`), reusing the same `change`-emitting commit every
other mode uses (a new sibling method, `#drillTo`/`#back`/`#commit`/`#resolve` stay untouched). The row the
reader actually drilled into carries a bare `data-drill-active` attribute (a styling hook only — no default
paint ships; an author's own trigger markup owns the selected-row look) on the ONE trigger inside its column
whose key names the next path entry. The active (rightmost) column keeps the `aria-labelledby` reflection onto
the shared `[data-part="heading"]`; every ancestor column instead gets a plain `internals.ariaLabel` (its own
`heading` prop value — no shared node to point at). **Columns never moves focus on drill-forward** — the
clicked trigger keeps it, the child column opens beside it (the one deliberate narrowing of the Focus section
below, scoped to this layout only).

### Narrow-host auto-degrade (cl.A8)

`layout="columns"` silently resolves to the `stack` render mapping above whenever the **host's own inline
size** — not the viewport — falls below ADR-0150's compact-body line (52.5rem/840px), via a real
`@container (inline-size < 52.5rem)` query scoped to the host itself (the nav-rail `@container` threshold
shape). The `layout` attribute value itself never changes; only which render mapping it resolves to does. A
`ui-drill` nested inside a narrow pane degrades independently of window width.

## Chrome: backbar (default) vs. crumbs

`chrome` selects the header's anatomy, orthogonal to `layout` (a crumbs trail is legal under `stack`, and will
be under `columns` too). `chrome="backbar"` (default) is the Back button + heading pair described above.
`chrome="crumbs"` (ADR-0195 Amendment cl.A2/A3, GH #1510) replaces that pair with a clickable breadcrumb
trail: a real `<nav data-part="crumbs" aria-label="Breadcrumb">` holding one real
`<button data-part="crumb">` per ANCESTOR entry of the resolved path (label = that panel's `heading`), then
the SAME `[data-part="heading"]` element — never recreated — as the trail's last, non-interactive entry,
carrying `aria-current="location"` (cl.A6: a drill level is a position within a UI, not a page — the named
alternative, `aria-current="page"`, was considered and NOT chosen; ancestor crumbs carry no `aria-current` of
their own — the APG current-item semantic names exactly one entry, the trail's last). Clicking crumb *i*
commits `path.slice(0, i+1)` (direction `back`) through the SAME `change`-emitting commit path the Back button
uses — no new event, and the byte-unchanged `#drillTo`/`#back`/`#commit`/`#resolve` state machine is
untouched (a new, purpose-built method reuses `#commit`, it does not replace it). Reusing the one heading node
across chrome modes is what keeps its focus target, `aria-labelledby` element-reflection, and heading
semantics unchanged regardless of which chrome renders it.

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
AFTER the initial mount — a primed guard prevents focus theft on first paint. **Exception:** under
`layout="columns"` (ADR-0195 Amendment cl.A6, GH #1510) drilling forward never moves focus — the clicked
trigger keeps it, the child column opens beside it.

## Motion

The CSS-transform base (`@starting-style` + `allow-discrete`, sliding a FULL pane-width — `--ui-drill-
slide-distance` defaults to `100%`, ADR-0195 Amendment cl.A5) and the ADR-0183 View Transitions layer are
mutually exclusive per swap: `viewTransitions` (opt-in, default off) enables the VT layer for a swap only when
the platform actually supports it (`viewTransitionAvailable()`). The shared `view-transition-name` sits on the
RESOLVED-ACTIVE panel only, cleared elsewhere (the GH#958 named-morph pairing law corrected for the contained
presentation, cl.A7 — with ancestors now painted alongside the active panel, naming every panel would put more
than one named element in a single snapshot). `prefers-reduced-motion` suppresses the sliding transition; the
ancestor dim wash is static state, never motion, and is unaffected either way.

## Catalog posture

**TEMPORARY exclusion** (the `ui-toggle`/ADR-0179 shape) — `ui-drill` ships ahead of any A2UI catalog row.
Whether it earns one, and what wire-mark its `path`/children should carry, is a separate, later a2ui-owned
decision (ADR-0195 cl.8).
