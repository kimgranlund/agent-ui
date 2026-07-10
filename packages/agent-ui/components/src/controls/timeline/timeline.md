---
# timeline.md frontmatter — the attributes-as-API descriptor for ui-timeline (ADR-0004;
# timeline-family.lld.md §3 · SPEC-R6/R7 · ADR-0122 F1/F2/F6). The machine-checkable public surface lives
# HERE (frontmatter); the prose below the fence is the /site doc. The `attributes[]` block MUST mirror
# timeline.ts `static props` (size/label) — the contract↔props trip-wire (timeline-descriptor.test.ts) and
# the frontmatter schema both target this fence.
tag: ui-timeline
tier: pattern            # geometry.md's Pattern band does not literally fit (no interactive control-height
                         # row) — the marker-system family (ADR-0122 F2) generalizes it, mirroring timeline-item
extends: UIContainerElement  # NOT form-associated — a structural container hosting authored children (ADR-0015)
# marginal: measured at the family barrel integration slice (npm run size, ADR-0040 §3)

attributes:               # attributes-as-API — mirrors timeline.ts static props
  - name: size
    type: enum
    values: [sm, md, lg]
    default: md
    reflect: true        # first-class geometry (ADR-0122 F2); a structural container itself has no CSS [size] repoint — author items with a matching size for rail alignment
  - name: label
    type: string
    default: ''
    reflect: true        # author accessible name → internals.ariaLabel, cleared to null on '' (the toolbar.ts precedent)

properties: []           # no manual accessors beyond the attributes-as-API

events: []                # a static, display-first host — no event of its own (SPEC-R7 AC2)

slots:
  - name: items
    optional: false
    description: The chronology — authored light-DOM `ui-timeline-item` children, read back in DOM order (no auto-sort, the adia rule). The host imposes no other item element.

parts: []                 # light-DOM, no control-built parts of its own

customStates: []          # no :state() hooks — a static host has no interaction state of its own

face:
  formAssociated: false   # NOT a FACE form control — extends UIContainerElement, no value/validity

aria:
  role: list               # set via ElementInternals in the CONSTRUCTOR (the ui-list precedent, list.ts:50/list.ts:42) — never a host role attribute
  roleSource: internals
  labelSource: label-prop  # a non-empty `label` sets internals.ariaLabel; cleared to null on ''
  childRole: listitem      # each authored ui-timeline-item child carries its own listitem semantics

keyboard: []              # no keyboard interaction of its own — a static host; items handle their own (the composed detail's disclosure)

geometry:
  sizeClass: pattern
  minInlineSize: var(--ui-timeline-min-inline-size)   # the bare-host floor (the ui-slider whole-shape lesson)
  note: A structural container — the marker/row-gap geometry belongs entirely to the authored ui-timeline-item children (ADR-0122 F1); this host owns no rail geometry of its own.

forcedColors: No forced-colors block — ui-timeline paints no colour of its own (a bare flex column; the ui-list precedent, list.md — "list.css carries no colour of its own, so it adds no forced-colors block"). Every visible signifier (the marker shapes, the connector) lives on the authored ui-timeline-item children, which carry their own forced-colors block.
---

# ui-timeline

`ui-timeline` is the timeline family's **durable host** (ADR-0122 F1) — a static, authored-children
chronology (an order-tracking card, an audit log, a reasoning recap). It extends `UIContainerElement`,
is **not** form-associated, and hosts `ui-timeline-item` children the consumer authors directly as
light-DOM markup, read back in DOM order (no auto-sort).

```html
<ui-timeline label="Order status" size="md">
  <ui-timeline-item status="done"    label="Order placed" timestamp="Apr 15, 2:30 PM"></ui-timeline-item>
  <ui-timeline-item status="done"    label="Processing"   timestamp="Apr 16, 9:00 AM"></ui-timeline-item>
  <ui-timeline-item status="active"  label="Shipped"      timestamp="Apr 17, 11:45 AM"></ui-timeline-item>
  <ui-timeline-item status="pending" label="Delivered"    timestamp="Expected Apr 20"></ui-timeline-item>
</ui-timeline>
```

## Props

- **`size`** (`sm`/`md`/`lg`, default `md`) — first-class geometry (ADR-0122 F2) for family/catalog
  symmetry. The host itself has no rail geometry to repoint (a structural container); author matching
  `size` values on the `ui-timeline-item` children for the shared vertical marker axis.
- **`label`** (string, default `''`) — the list's accessible name, set on `internals.ariaLabel` (cleared
  to `null` on empty).

## Why static

`ui-timeline` and `ui-status-stream` share the visual rail (`ui-timeline-item`) but diverge on **five
mechanical axes** (ADR-0122 F1): data ingress, completion, scroll, ARIA role, and motion. `ui-timeline` is
the durable half — every item is resolved by construction, the host is `internals.role = 'list'` (never a
host `role` attribute — the `ui-list` precedent), and it carries **no** imperative `append`/`update`/
`finalize` API, no tail-follow scroll, and no live-region role. A grep of `timeline.ts` finds none of
those — the standing negative control separating it from its live sibling.

## Terminal-connector suppression

The host observes its own child list (`MutationObserver({ childList: true })`, the `ui-toast-region`
observer precedent) and marks the LAST authored `ui-timeline-item` with `data-last` — the item's own CSS
suppresses that one connector, so the rail never dangles a trailing line past its final entry. Re-marked
on every childList change, so a late-appended durable item re-marks the terminal correctly.

## Accessibility

`internals.role = 'list'` (never a host `role` attribute); each item is `role="listitem"`. Give the
timeline an accessible name via `label` when the surrounding context does not already supply one.
