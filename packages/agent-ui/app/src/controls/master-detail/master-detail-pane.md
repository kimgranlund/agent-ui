---
# master-detail-pane.md frontmatter — the attributes-as-API descriptor for ui-master-detail-pane (ADR-0004;
# app-surfaces-m4.lld.md LLD-C10). The `attributes[]` block MUST mirror master-detail-pane.ts
# `masterDetailPaneProps` — the contract↔props trip-wire (master-detail.test.ts) targets this fence.
tag: ui-master-detail-pane
tier: container         # geometry size-class (Container band — a passive docking region, no control height, no flex/grid distribution of its own children)
extends: UIContainerElement   # the ui-split-pane/generic-region family base — NOT form-associated
# marginal: measured at the @agent-ui/app integration slice (scripts/measure-size.mjs)

attributes:             # attributes-as-API — mirrors master-detail-pane.ts `masterDetailPaneProps`
  - name: pane
    type: enum
    values: [list, detail]   # ORDER-SIGNIFICANT: `list` LEADS — an out-of-set value snaps back to it (the REGION_VALUES/props.ts enumType.from precedent)
    default: list
    reflect: true      # reflects so the parent ui-master-detail's connect-time discovery (a plain [pane=…] querySelector) also works from markup written directly

properties:
  - name: pane
    description: Which position this pane docks into (`list` or `detail`, default `list`). Read ONCE by the parent `ui-master-detail` at connect (static composition, the ui-app-shell isolation precedent) — a runtime reassignment after connect is not re-derived (documented M1 limitation). An out-of-set value coerces to `list` (order-significant codec fallback) rather than throwing.

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

forcedColors: This element carries no CSS of its own beyond `display: block` — nothing to keep legible under forced-colors independently of whatever content the author composes inside it.
---

# ui-master-detail-pane

`ui-master-detail-pane` is the **generic docking marker** `ui-master-detail` composes (the `ui-app-shell-region`
generic-region model, ported). It is a structural, **non-form-associated** `UIContainerElement` carrying one
reflected prop: **`pane`** (`list` · `detail`, default `list`).

```html
<ui-master-detail>
  <ui-master-detail-pane pane="list">…the item list…</ui-master-detail-pane>
  <ui-master-detail-pane pane="detail">…the selected item's detail…</ui-master-detail-pane>
</ui-master-detail>
```

## Docking — composition, not an attribute-on-arbitrary-child

A `ui-master-detail-pane` is how a developer docks a surface into the list or detail position (SPEC-R7):
compose the element as a child of `ui-master-detail` and set its `pane` prop. The parent relocates each
whole pane element into a `ui-split-pane` it creates — this element itself carries no split/resize code.

## Static composition (M1 limitation)

Only pane children present at the moment `ui-master-detail` connects are discovered and relocated — a
`ui-master-detail-pane` appended afterward is not picked up (documented, the `ui-app-shell` isolation
precedent for the same limitation).
