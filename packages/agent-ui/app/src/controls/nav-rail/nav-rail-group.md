---
# nav-rail-group.md frontmatter — the attributes-as-API descriptor for ui-nav-rail-group (ADR-0004;
# ADR-0130 cl.3/cl.6; SPEC nav-rail-family.spec.md SPEC-R2/R6/R8). The `attributes[]` block MUST mirror
# nav-rail-group.ts `static props` — the contract↔props trip-wire (nav-rail.test.ts) targets this fence.
# Nests in the `ui-nav-rail` family folder (naming.md §9).
tag: ui-nav-rail-group
tier: pattern           # geometry size-class — a sub-element of the Pattern-class family; contributes no control height of its own
extends: UIElement      # a generic sub-element (the ui-app-shell-region precedent) — docking is composition, not a data-prop
# marginal: measured at the @agent-ui/app integration slice (Phase 3, LLD-C12; scripts/measure-size.mjs)

attributes:
  - name: label
    type: string
    default: ''
    reflect: true       # TKT-0069 item 2 ruling: label reflects fleet-wide

properties:
  - name: label
    description: The group's context-label — rendered as a `<span data-part="context-label">` heading above its items (menu/drill-in modes) and, in `collapse="icon-popover"` mode, the composed `ui-menu` trigger's `aria-label` (the SAME prop, two renderings, never diverging).

events: []                # a group emits none of its own — the composed ui-menu (icon-popover mode) emits its own select/toggle/close, listened to internally and forwarded (see ui-nav-rail.md)

slots:
  - name: leading
    optional: true
    description: An optional leading icon — used as the `collapse="icon-popover"` composed `ui-menu` trigger's visual icon (moved in). Unused in menu/drill-in modes.

parts:
  - name: context-label
    description: A control-created `<span data-part="context-label">` heading, rendered above the group's items when `label` is non-empty.
  - name: items
    description: A control-created `<div data-part="items">` wrapper around the group's `ui-nav-rail-item` children — menu/drill-in modes, or a degenerate icon-popover group with < 2 items (a lone item needs no popover).

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

`ui-nav-rail-group` is an optional cluster inside `ui-nav-rail` — a context-label heading over a set of
`ui-nav-rail-item` children, composed one of two ways depending on the ancestor rail's `collapse` mode
(read once, at connect): a plain items wrapper (`menu`/`drill-in`, or a < 2-item `icon-popover` group), or an
internally-composed `ui-menu` flyout (`icon-popover`, 2+ items) whose trigger is this group's own icon/label.

```html
<ui-nav-rail-group label="Components">
  <ui-nav-rail-item href="/button">Button</ui-nav-rail-item>
  <ui-nav-rail-item href="/select">Select</ui-nav-rail-item>
</ui-nav-rail-group>
```

## `collapse="icon-popover"` composition

Each item's state (`href`/`selected`/text/leading icon) is read ONCE, before any item builds its own
activator, and re-expressed as a fresh `<a>`/`<button>` appended directly into one composed `ui-menu` (the
group's icon becomes the menu's trigger; the original items are removed, their content fully re-expressed).
`ui-menu`'s own roving-focus, commit-and-close, and dismissal contract (ADR-0043/0045) is inherited
wholesale — never re-derived. A bare (selection-commit) synthetic item's commit forwards the SAME
`select`/`change` pair `ui-nav-rail` emits for a top-level item.
