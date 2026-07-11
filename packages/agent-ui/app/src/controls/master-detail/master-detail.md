---
# master-detail.md frontmatter — the attributes-as-API descriptor for ui-master-detail (ADR-0004;
# app-surfaces-m4.lld.md LLD-C10, SPEC-R7). The `attributes[]` block MUST mirror master-detail.ts
# `masterDetailProps` — the contract↔props trip-wire (master-detail.test.ts) targets this fence.
tag: ui-master-detail
tier: layout            # geometry size-class (Container/layout band, the ui-app-shell precedent — a composition over the shipped layout family, no control height of its own)
extends: UIElement      # a plain structural base — composes ui-split rather than extending it (LLD-C10)
# marginal: measured at the @agent-ui/app integration slice (scripts/measure-size.mjs, LLD-C9/C16)

attributes:              # attributes-as-API — mirrors master-detail.ts `masterDetailProps`
  - name: selected
    type: string
    default: ''
    reflect: true         # reflects so a JS-set value applies identically to an author-set attribute; '' ⇒ no selection

properties:
  - name: selected
    description: The current selection (an item key), a plain reflected prop the CONSUMER writes — this element owns no item-picking UI of its own (SPEC-R7). A reactive effect derives the narrow drill-in view from it (a selection present ⇒ `detail`, absent ⇒ `list`) and, on every run AFTER the first, emits `select`/`change`. Empty string (the default) means no selection.

events:
  - name: select
    detail: 'string'
    description: Fired after `selected` changes to a new value (post-connect only — the initial/deep-link state at connect does not fire). Detail is the new `selected` value (possibly '').
  - name: change
    detail: 'string'
    description: Fired alongside `select`, same timing, same detail — the fleet's input/change-pair convention applied to a discrete, non-live selection (mirrors ui-split's keyboard-step "both events, one action" shape).

slots: []                 # docking is composition via ui-master-detail-pane children (master-detail-pane.md), not attribute-slotting — no NAMED slots

parts:                    # NOT shadow-DOM ::part() (light-DOM only) — light-DOM markers this element's own JS creates; documented for completeness (compareDescriptorToSource does not mechanically check `parts:`, the split.md precedent)
  - name: back
    description: A control-rendered `<button data-part="back" type="button">` inside the detail `ui-split-pane`, visible only when narrow AND drilled into the detail view. Flips the view back to `list` WITHOUT touching `selected`.

customStates: []          # no :state() hooks — the narrow/drilled-in view rides a plain `data-view` host attribute, not a custom state (it is JS-owned presentation state a CSS attribute selector reads, the ui-split `data-axis-vertical` precedent)

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
  narrowThreshold: 40rem      # the @container inline-size threshold below which the view drills in (mirrors ui-app-shell's own starting value)

forcedColors: The "back" affordance's bottom divider is a real `border-block-end` (currentColor-derived via the role-pure ink token), not a fill-only affordance — it survives forced-colors the same way the composed ui-split's separator does (inherited, split.md).
---

# ui-master-detail

`ui-master-detail` is the **app-tier master-detail composition** (`@agent-ui/app`) — a docked list | detail
arrangement over the shipped `ui-split`, drilling into a single view below a narrow container-width
threshold. It composes rather than reimplements: **0 bespoke split/resize code** (SPEC-R7).

```html
<ui-master-detail selected="item-2">
  <ui-master-detail-pane pane="list">
    <!-- your own list content; click handlers set `.selected` -->
  </ui-master-detail-pane>
  <ui-master-detail-pane pane="detail">
    <!-- your own detail content, kept in sync with `selected` by the consumer -->
  </ui-master-detail-pane>
</ui-master-detail>
```

## Composition — docking, then relocation into a real `ui-split`

Docking uses **`ui-master-detail-pane`** children (`pane="list"` / `pane="detail"`, the
`ui-app-shell-region` generic-region model — see `master-detail-pane.md`). At connect, `ui-master-detail`
relocates each **whole** pane element into a freshly created `ui-split-pane`, wraps both in a freshly
created `ui-split`, and appends that one composed child. The split's own resize/keyboard/ARIA contract is
inherited wholesale — this element adds no split code of its own, only the narrow drill-in behaviour below.
**Static composition at M1**: only pane children present at connect are discovered (the `ui-app-shell`
isolation precedent for the identical limitation).

## Selection — a plain reflected prop, consumer-owned

`ui-master-detail` has no item-picking UI: the **consumer's** own list content sets `.selected = key` (a
click handler, a router binding — "3 lines of consumer wiring," ADR-0115). A reactive effect over `selected`
derives the narrow-drill-in view and emits `select`/`change` on every change after the first (the initial/
deep-link state at connect does not fire — it is not "an item chosen").

## Narrow drill-in

Below `40rem` inline-size (the element's **own** container width, never the viewport — the `ui-app-shell`
precedent), only one pane shows at a time: `list` when nothing is selected, `detail` once a selection is
present. A control-rendered **"back"** button appears inside the detail pane, narrow only, to return to the
list view without clearing the selection. Wide, both panes show side-by-side via the composed `ui-split`,
fully resizable.

## Accessibility

This element carries no ARIA of its own. The composed `ui-split`'s separators keep their own `role="separator"`
+ keyboard contract (inherited, unchanged); the "back" button is a native `<button>` (natively focusable and
keyboard-activatable, Enter/Space).
