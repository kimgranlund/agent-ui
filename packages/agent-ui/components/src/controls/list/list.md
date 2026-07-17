---
# list.md frontmatter — the attributes-as-API descriptor for ui-list (ADR-0004). The machine-checkable
# public surface lives HERE (frontmatter); the prose below the fence is the /site doc. The `attributes[]`
# block MUST mirror list.ts `static props` — the two SPREAD sets: UIContainerElement.surfaceProps
# (elevation/brightness) + UIContainerElement.flexProps (align/justify/gap/wrap) — the contract↔props
# trip-wire (list-descriptor.test.ts) and the frontmatter schema both target this fence. Field set per
# .claude/docs/plan.md §10 / ADR-0004; the surface axes per ADR-0015, the flex layout grammar per ADR-0016.
tag: ui-list
tier: layout            # geometry size-class (Container/layout band — gaps/padding off --md-sys-space × density; NO control height; geometry.md "five size-classes")
extends: UIContainerElement  # the FACE container surface base (NOT form-associated — no value/validity; ADR-0015). NOTE: UIContainerElement joins the descriptor schema's BASE_CLASSES in s12 (the integration barrel slice)
# marginal: ui-list adds 34 B gz (257 B min) to the self-defining ui-* family (the delta of `npm run size`'s components barrel with vs. without this control's export, tree-shaken) — within the per-control ≤ ~2 kB tier budget (plan §10); the family total stays gated each run by `npm run size` (scripts/measure-size.mjs)

attributes:            # attributes-as-API — mirrors list.ts `static props` (the surfaceProps spread, then the flexProps spread)
  - name: elevation
    type: enum
    values: [0, 1, 2, 3, -1, -2, -3]
    default: 0
    reflect: true      # reflects so the [elevation] surface-plane repoint in controls/_surface/container.css applies to JS-set values; 0 = the neutral base (ADR-0015)
  - name: brightness
    type: enum
    values: [0, 1, 2, 3, -1, -2, -3]
    default: 0
    reflect: true      # reflects so the [brightness] tonal repoint applies to JS-set values; 0 = no wash (ADR-0015)
  - name: align
    type: enum
    values: [start, center, end, stretch, baseline]
    default: stretch
    reflect: true      # reflects → align-items (cross-axis) repoint in list.css (ADR-0016); default changed start→stretch per ADR-0030
  - name: justify
    type: enum
    values: [start, center, end, between, around, evenly]
    default: start
    reflect: true      # reflects → justify-content (main-axis distribution) repoint; between/around/evenly → space-* keywords
  - name: gap
    type: enum
    values: [none, xs, sm, md, lg, xl, 2xl]
    default: none
    reflect: true      # reflects → gap: var(--md-sys-space-{step}) — the density-responsive layout-spacing ladder (ADR-0015 cl.4), the one [density]-bearing quantity
  - name: wrap
    type: boolean
    default: false
    reflect: true      # reflects → flex-wrap: wrap (boolean presence)

properties: []         # no manual accessors beyond the attributes-as-API (a structural container has no value property)

events: []             # a structural layout container fires no events of its own

slots:                 # the list ITEMS are the default/unnamed light-DOM children (the ChildList child model) — no item element is imposed
  - name: items
    optional: false
    description: The list items — the default/unnamed light-DOM children (no `slot` attribute needed). The list imposes no item element; the agent composes ui-* item children as a ChildList. They flow through untouched (render() stays void) and stack vertically (flex column).

parts: []              # light-DOM, no shadow parts exposed (the surface + layout are host-level CSS)
customStates: []       # no interaction states — a structural container has no hover/active/focus treatment of its own

face:
  formAssociated: false  # NOT a FACE form control — extends UIContainerElement (a surface base), no value/validity participation

aria:
  role: list           # set via the host's ElementInternals — never a host role/aria-* attribute (the family discipline, ADR-0010)
  roleSource: internals  # internals.role='list' on the host (set in connected()); the host carries NO `role` attribute
  labelSource: none    # no built-in accessible name; an author names the list via aria-label/aria-labelledby on the host through ElementInternals if needed
  childRole: listitem  # the children are the list items — an item carries its own listitem semantics (the list does not impose them)

keyboard: []           # no keyboard interaction — a list is a structural container; its items handle their own keys

geometry:
  sizeClass: layout                    # Container/layout — NO control height (never reads --md-sys-height-*)
  gap: var(--md-sys-space-{step})          # the inter-item row-gap, off the density-responsive layout ladder — the one [density]-bearing quantity (gap = base px × density)
  flexDirection: column                # the vertical stack — the tag's identity (ADR-0016)

forcedColors: Owned by the shared controls/_surface/container.css — its `@media (forced-colors: active)` block keeps any container surface as a system colour (Canvas) and drops the tonal wash. list.css carries no colour of its own, so it adds no forced-colors block.
---

# ui-list

`ui-list` is a **semantic vertical stack** — a `ui-column` specialization that adds **list semantics**. It is
a structural container (`extends UIContainerElement`, ADR-0015): a `display:flex` column whose host carries
the ARIA `role="list"`, set through `ElementInternals` (never a host `role`/`aria-*` attribute). It is **not**
form-associated; it contributes no value or validity. Its children are the **list items** — composed directly
as light-DOM children (the ChildList child model); `ui-list` imposes no item element and never re-renders the
children (`render()` stays void).

```html
<ui-list gap="sm">
  <ui-row>First item</ui-row>
  <ui-row>Second item</ui-row>
  <ui-row>Third item</ui-row>
</ui-list>

<ui-list gap="md" align="stretch" elevation="1"> … </ui-list>
```

> **An A2UI catalog type.** `ui-list` renders the catalog's `List` type (ADR-0087 Fork A — supersedes ADR-0016's
> earlier non-catalog exclusion). Reach for `List` (not `Column`) for a **homogeneous, itemized collection**
> where list semantics matter to assistive tech (search results, a feed, a to-do list) — `List` carries
> `role=list` for free; plain `Column` does not and should not fake it. Reach for `Row`/`Column` instead when
> the children are a deliberate, heterogeneous arrangement (a toolbar, a form's field stack) where no single
> semantic role unifies them; reach for `Grid` instead when the arrangement should reflow its column count
> responsively with available width.

## Layout

`ui-list` consumes the shared **`flexProps`** layout grammar (ADR-0016), each prop mapping 1:1 onto a CSS flex
property (a role-pure repoint in CSS, never an inline style):

- **`align`** (cross-axis) → `align-items`: `stretch` (default — items fill the list's width; use `start` to shrink-wrap) · `center` · `end` · `start` · `baseline`. (ADR-0030: default changed from `start` to `stretch`.)
- **`justify`** (main-axis distribution) → `justify-content`: `start` · `center` · `end` · `between` · `around` · `evenly`.
- **`gap`** → `gap: var(--md-sys-space-{step})` — the density-responsive layout-spacing ladder (`none` · `xs` · `sm`
  · `md` · `lg` · `xl` · `2xl`). The inter-item gap is the one quantity that rides `[density]` (an ancestor
  `[density]` re-multiplies it); the list has **no control height** (`geometry.md`'s Container/layout class).
- **`wrap`** → `flex-wrap` (boolean presence).

The direction is fixed — a list is always a **column** (the vertical stack is its identity, A2UI-faithful);
pick a row by component type (`ui-row`) instead.

## Surface

`ui-list` also consumes the shared **`surfaceProps`** (ADR-0015) — `elevation` (`-3`…`3`, the scheme-inverting
base plane) and `brightness` (`-3`…`3`, the scheme-consistent tonal shift), `0` being the neutral base (an
unset list adds no plane and passes its parent's surface through). The surface seam, the `[elevation]`/
`[brightness]` mapping, and forced-colors survival all live in the shared `controls/_surface/container.css`;
list.css owns only the flex layout. **`ui-list` establishes NO `container-type` of its own** (ADR-0100 — a
layout primitive is intrinsically sized, and an intrinsically-sized box can never safely be a query container);
an externally-sized ancestor boundary provides query context for any descendant that needs one.

## Accessibility

`role="list"` is set via the host's `ElementInternals` (no host `role`/`aria-*` attribute), so assistive
technology reads the host as a list and its children as the list items. Give the list an accessible name with
`aria-label`/`aria-labelledby` through `ElementInternals` when one is warranted. Because the list carries no
colour of its own, high-contrast (forced-colors) survival is handled by the shared container surface sheet.
