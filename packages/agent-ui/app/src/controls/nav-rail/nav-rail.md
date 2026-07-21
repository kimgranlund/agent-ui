---
# nav-rail.md frontmatter — the attributes-as-API descriptor for ui-nav-rail (ADR-0004; ADR-0130; SPEC
# nav-rail-family.spec.md SPEC-R1..R8; LLD nav-rail-family.lld.md LLD-C7). The `attributes[]` block MUST
# mirror nav-rail.ts `static props` — the contract↔props trip-wire (nav-rail.test.ts) targets this fence.
# This is the PRIMARY descriptor for the family folder (naming.md §9 "one folder per family, sub-elements
# nest"); nav-rail-group.md / nav-rail-item.md are the two sibling sub-element descriptors.
tag: ui-nav-rail
tier: pattern           # geometry size-class (Pattern — interactive rows take the control height, the ui-tabs precedent)
extends: UIElement      # structural — NOT form-associated; the rail carries no value, only its items commit selections upward as events
# marginal: measured at the @agent-ui/app integration slice (Phase 3, LLD-C12; scripts/measure-size.mjs)

attributes:              # attributes-as-API — mirrors nav-rail.ts `static props`
  - name: collapse
    type: enum
    values: [menu, drill-in, icon-popover, none]
    default: menu
    reflect: true         # the [collapse=…] CSS branches (nav-rail.css) + the CONSUMER's own narrow-behavior choice; out-of-set/unset coerces to `menu` (values[0] fallback, SPEC-R1 AC2). `none` (GH #170/ADR-0155) = a plain never-collapsing vertical rail, for a consumer whose SHELL owns the narrow hide/overlay (the docs site).
  - name: collapseContainer
    type: enum
    values: [self, ancestor]
    default: self
    reflect: true         # TKT-0035 — WHICH box the collapse="menu" 40rem @container query measures. self (default): the rail's own box (unchanged). ancestor: the rail relinquishes its own containment so the NAMED `@container ui-nav-rail-collapse` query resolves against the nearest ancestor the consumer opts in via `container-type: inline-size; container-name: ui-nav-rail-collapse` — the narrow-sidebar seam (a rail in a ~15rem column tracks the shell/viewport instead of its own always-narrow box). HTML attribute is `collapse-container` (an explicit `attribute:` override in nav-rail.ts — same as button.ts's `icon-only`).

properties: []           # no manual accessors beyond the attributes-as-API

events:
  - name: select
    detail: 'string'
    description: Fired on a genuine user activation of a BARE (button-shaped, no `href`) item — never on a link-shaped item's native navigation, never on a programmatic `selected` write (binding hygiene, the `ui-master-detail`/`ui-tabs` precedent). Detail is the activated item's `id` (or trimmed textContent if unset).
  - name: change
    detail: 'string'
    description: Fired alongside `select`, same timing, same detail (the fleet's select/change-pair convention).

slots: []                # authored light-DOM ChildList of ui-nav-rail-group / ui-nav-rail-item — component-native children (the ui-tabs precedent), not attribute-slotting; both shipped consumers construct these programmatically (SPEC-R2, ADR-0130 cl.3)

parts:                   # control-created, `collapse="menu"` mode only (LLD-C4) — NOT shadow-DOM ::part()
  - name: disclosure
    description: A control-created `<details data-part="disclosure">` wrapping the whole rendered tree, built once when `collapse="menu"` (LLD-C4) — ported from the docs site's own zero-JS `<details>`/`<summary>` mechanism, now owned by the component.
  - name: trigger
    description: The `<summary data-part="trigger">` inside the disclosure — hidden wide (inert chrome); narrow, it names the current/selected item and discloses `list` as a dropdown on activation.
  - name: list
    description: A `<div data-part="list">` wrapping the original group/item tree — always visible wide (overriding the UA closed-`<details>` hiding rule); narrow, shown only while the disclosure is open, absolutely positioned to overlay rather than reflow the page.

customStates: []          # the rail itself carries no interaction state of its own — states live on the item child (ui-app-shell.md "shared-file, states live on the child" precedent); ui-nav-rail-item carries none either (a plain reflected `selected` attribute already drives its CSS, no :state() needed)

face:
  formAssociated: false   # NOT a FACE form control — a coordinating container; items commit selections as events, never a form value

aria:
  role: navigation | tablist   # DERIVED from item SHAPE, never from `collapse` (ADR-0130 cl.4): every descendant item link-shaped (non-empty href) ⇒ navigation; every one bare ⇒ tablist. A mixed/empty rail defaults to navigation (SPEC §7 non-goal, never throws).
  roleSource: internals        # set via ElementInternals, never a host role attribute; re-derived on every subtree mutation (a MutationObserver, so later-added children re-derive too, SPEC-R2 AC2)

keyboard:
  - keys: Escape
    action: 'collapse="menu" only — closes the open narrow disclosure and returns focus to the trigger (SPEC-R5 AC2, a small JS enhancement over the site''s current zero-JS markup, which has no built-in Escape/outside-click close).'
  - note: Outside-click also closes the open `collapse="menu"` narrow disclosure (SPEC-R5 AC2). Every other keyboard contract (item activation, `ui-menu`'s roving focus in `collapse="icon-popover"`) is each composed part's OWN, inherited unchanged.

geometry:
  sizeClass: pattern
  blockSize: auto            # fills its layout parent; each item ROW takes --ui-nav-rail-height (the Pattern law)
  paddingBlock: 0
  narrowThreshold: 40rem     # the NAMED `@container ui-nav-rail-collapse` threshold (collapse="menu"); mirrors ui-app-shell/ui-master-detail's own starting value. Measured against the rail's own box under collapse-container="self" (default), or a consumer-opted ancestor under collapse-container="ancestor" (TKT-0035)

forcedColors: The active item's indicator border (ui-nav-rail-item's own signifier) repaints to `Highlight` under `forced-colors: active` (SPEC-R4), never vanishing — the `ui-app-shell` divider precedent.
---

# ui-nav-rail

`ui-nav-rail` is the **unified nav-rail family** (`@agent-ui/app`) — ONE element with a closed `collapse`
enum (`menu` · `drill-in` · `icon-popover`) governing its own narrow-width disposition, replacing two
independent hand-rolled implementations (the docs site's primary nav, `ui-settings`' sections rail) with one
shared primitive (ADR-0130). This folder ships the family itself (Phase 1); the two consumer migrations are
a later wave.

```html
<ui-nav-rail collapse="menu">
  <ui-nav-rail-group label="Components">
    <ui-nav-rail-item href="/button">Button<span slot="trailing" data-role="tag">new</span></ui-nav-rail-item>
    <ui-nav-rail-item href="/select">Select</ui-nav-rail-item>
  </ui-nav-rail-group>
</ui-nav-rail>
```

## Content model

An authored light-DOM `ChildList` of `ui-nav-rail-group` (optional; carries a context-label) and/or bare
`ui-nav-rail-item` — the `ui-app-shell-region` generic-sub-element precedent, not a `schema`/`store`
data-prop pair (ADR-0130 cl.3). Both shipped consumers construct this programmatically from their own data
source. No children ⇒ an empty rail, never a throw; children appended after connect are picked up by the
role-derivation `MutationObserver` (SPEC-R2 AC2).

## `collapse` — the four dispositions

- **`menu`** (default) — wide: the full grouped list. Narrow (below the rail's own `40rem` container-width
  threshold): collapses into a `<details>` disclosure naming the current item, opening a dropdown overlay on
  activation (Escape/outside-click dismissible).
- **`drill-in`** — the rail renders identically at every width; it contributes anatomy ONLY. The CONSUMER
  composes it as the `list`-pane content inside its own `ui-master-detail`, whose shipped narrow drill-in/
  back mechanism is unchanged and untouched by this family (ADR-0130 cl.5).
- **`icon-popover`** — items render icon-only; a `ui-nav-rail-group` with 2+ items discloses them via an
  internally-composed `ui-menu` (roving focus, commit-and-close, dismissal — inherited wholesale). At most
  one group's menu is open at a time (ADR-0130 cl.6).
- **`none`** (GH #170/ADR-0155) — the plain grouped vertical list at EVERY band: no `<details>` disclosure,
  no icon-popover, no drill-in anatomy. For a consumer whose OWN container owns the narrow behavior — e.g.
  the docs site, where `ui-super-shell` (`collapse-band="compact"` + `narrow-start="collapse"`) hides the
  whole nav pane below the compact line and toggle-restores it as an overlay; the rail just renders its
  vertical anatomy inside that pane/overlay.

## `collapse-container` — WHICH box `collapse="menu"` measures (TKT-0035)

`collapse="menu"`'s narrow disclosure is gated by a **NAMED** `@container ui-nav-rail-collapse (inline-size
< 40rem)` query. `collapse-container` picks which box that named container resolves against:

- **`self`** (default) — the rail establishes the named container itself; the query reads its own
  inline-size, unchanged from the primitive's original behaviour. Right for a rail that fills its layout
  region (a full-width top bar, a wide panel).
- **`ancestor`** — the rail relinquishes its own containment (`container-type: normal`); the query walks up
  to the nearest ancestor the CONSUMER opts in:

  ```css
  .app-shell {
    container-type: inline-size;
    container-name: ui-nav-rail-collapse;
  }
  ```

  ```html
  <div class="app-shell">
    <ui-nav-rail collapse="menu" collapse-container="ancestor">…</ui-nav-rail>
  </div>
  ```

  This is the seam for a narrow-sidebar rail (e.g. a ~15rem docs nav column, which would otherwise always
  read below 40rem and never show a desktop vertical rail) whose collapse should track an ancestor's width
  (the app shell, effectively the viewport) instead of its own box. No consumer override of the rail's own
  `container-type` is needed — `collapse-container="ancestor"` is the supported seam, not a CSS workaround.
  If no ancestor names the container, the query never matches and the rail simply never collapses (a safe
  failure — never the opposite, always-collapsed, failure the unnamed-container coupling risked).

## Accessibility — role derives from item SHAPE, not `collapse`

A rail whose items are all real links (`href` set) exposes `role="navigation"`; a rail whose items are all
bare (in-page selection commits) exposes `role="tablist"` with each item `role="tab"` + `aria-selected` —
mirroring `ui-tabs`' own contract, and correcting `ui-settings`' current `aria-current` misuse (a settings
section-select is not page navigation, ADR-0130 cl.4). A mixed rail is undefined (not a shipped shape).

## Selection commit

A genuine user activation of a bare item sets its `selected`, clears its siblings, and emits `select`/
`change` on the rail (the item's `id`, or its trimmed text). A link-shaped item's native navigation is never
intercepted. A `collapse="icon-popover"` group's synthetic menu item forwards the same pair on commit.
