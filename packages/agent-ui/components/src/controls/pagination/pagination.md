---
# pagination.md frontmatter — the attributes-as-API descriptor for ui-pagination (ADR-0004; ADR-0163 cl.6,
# SPEC-R3). The machine-checkable public surface lives HERE (frontmatter); the prose below the fence is the
# /site doc. The `attributes[]` block MUST mirror pagination.ts `static props` (page/pages/label) — the
# contract↔props trip-wire (pagination-descriptor.test.ts) targets this fence.
tag: ui-pagination
description: A standalone page navigator — previous/next plus a windowed page-number list with ellipsis, composing ui-button for every stop.
tier: pattern          # geometry.md Pattern band — NO control-height row of its own (ADR-0163 cl.6): the composed ui-button stops carry their own §1 geometry
extends: UIElement     # NOT form-associated (face below) — transient navigation state, not a submittable value

attributes:             # attributes-as-API — mirrors pagination.ts `static props` (page, pages, label)
  - name: page
    type: number
    default: 1          # 1-based current page — bindable; commit (a stop click) writes this AND emits `change`
    reflect: true
  - name: pages
    type: number
    default: 0           # 0 (default) ⇒ renders NOTHING (the honest empty state) — also true for pages=1 (SPEC-R3)
    reflect: true
  - name: label
    type: string
    default: ''
    reflect: true        # the accessible NAVIGATION-LANDMARK name → internals.ariaLabel (never a raw host aria-label)

properties: []          # no manual accessors beyond the three typed props

events:
  - name: change
    detail: '{page:number}'
    description: Fired when a stop (previous/next/a page number) commits a new page — never fired by a programmatic `page`/`pages` write, and never fired by clicking the already-active page's button (a no-op — nothing changed).

slots: []               # no light-DOM content model — every stop is component-built (replaceChildren), never author-slotted

parts:
  - name: prev
    description: The composed `ui-button` (text "Previous") that commits `page - 1`. `disabled` when `page <= 1`. `aria-label="Previous page"` (a plain attribute set from OUTSIDE the button's own FACE internals — the swiper-paddles.ts precedent, not a violation of the "ARIA via internals" rule, which governs a control's OWN self-applied state).
  - name: next
    description: The composed `ui-button` (text "Next") that commits `page + 1`. `disabled` when `page >= pages`. `aria-label="Next page"`.
  - name: page
    description: One composed `ui-button` per windowed page number (`computePageWindow`, pagination-model.ts — a fixed window, no configurable knob in v1) — text is the page number itself. The CURRENT page's button carries `aria-current="page"` and `variant="soft"`; every other page's button is `variant="ghost"` and commits that page on click.
  - name: ellipsis
    description: A non-interactive `<span data-part="ellipsis" aria-hidden="true">…</span>` marking a collapsed run of page numbers (never more than one per gap). Carries no click handler and is hidden from assistive technology — it conveys no operable information.

customStates: []        # no interaction/motion state of its own — every visual state (active/disabled) rides the composed ui-buttons' own states

face:
  formAssociated: false  # transient view state (the current page), not a submittable value — the ADR-0163 cl.8 F5 ruling extends here too (no name/value pair makes sense)

aria:
  role: navigation                # via ElementInternals — the host carries NO role/aria-* attribute
  roleSource: internals
  labelSource: internals.ariaLabel (the `label` prop, when non-empty — never a raw host aria-label)

keyboard:
  - note: "Every stop is a real, independently-focusable ui-button in the NORMAL tab order — no roving tabindex, no composite-widget keyboard contract (this control is N independent buttons, not one widget with N states; the ADR-0163 cl.3 'no role=grid, no roving focus' posture, though ui-pagination itself is not a table). Each button's own Space/Enter activation (ui-button's pressActivation trait) is the whole keyboard story."

geometry:
  sizeClass: pattern
  stopHeight: the composed ui-buttons' own control height (size=sm) — ui-pagination owns no [size]/[scale] geometry row of its own (ADR-0163 cl.6 — "the novelty is zero")
  gap: var(--ui-pagination-gap)   # off --md-sys-space (density-responsive)

forcedColors: No dedicated `@media (forced-colors: active)` block — every visible affordance is a composed `ui-button` (which already carries its own forced-colors handling) or real text (the ellipsis marker); this file paints no background-only mark of its own.
---

# ui-pagination

`ui-pagination` is a **Pattern**-class standalone page navigator (ADR-0163 cl.6) — the fleet's first
reusable pagination control, usable on its own (a list, a feed) or consumed internally by `ui-table` (its
`page-size` capability). Previous/next plus a fixed-window page-number list with an ellipsis marker,
composing a real `ui-button` for every stop.

```html
<ui-pagination label="Search results" page="3" pages="12"></ui-pagination>
```

## The honest empty state

`pages < 2` renders **nothing at all** — no host children, not even a single lone "page 1" button. A list
with zero or one page has nothing to navigate; `ui-pagination` does not manufacture chrome for it.

## The window

The page list is a **fixed, non-configurable window** (`pagination-model.ts`'s `computePageWindow`, no v1
knob): always page `1` and the last page, plus `page − 1 … page + 1` (clamped to the valid range). Any gap
greater than one page between two consecutive shown numbers collapses to a single, non-interactive `…`
marker (`aria-hidden`) — never more than one ellipsis per gap. The current page's button carries
`aria-current="page"`.

## Accessibility

The host is a labelled `navigation` landmark (`role="navigation"` via `ElementInternals`, named by the
`label` prop through `internals.ariaLabel`). Every stop is a real, independently-focusable `ui-button` in the
**normal tab order** — no roving tabindex, no composite-widget keyboard contract. `disabled` on `prev`/`next`
at the range's ends rides `ui-button`'s own disabled/`aria-disabled` handling.

## Commit

Clicking a stop (previous/next/an inactive page number) writes `page` and emits `change` with
`{ page: number }`. A programmatic `page`/`pages` write never emits — only a real click commits (the fleet's
commit law). Clicking the already-active page's button is a no-op: nothing changed, nothing emits.

## Composing with `ui-table`

`ui-table`'s `page-size > 0` capability stamps a `ui-pagination` in its own `data-part="footer"` region
(outside the scroll container) and wires its `change` event straight back to the table's own bindable `page`
prop — see `table.md`'s pagination section. A standalone `ui-pagination` composes the same way with any
consumer-owned list: bind `pages` to the list's own page count and listen for `change`.

## Sizing

No `[size]`/`[scale]` attribute and no geometry row of its own — every composed `ui-button` stop is stamped
at `size="sm"` and carries its own §1 control-height geometry (`geometry.md`); `ui-pagination` contributes
only the inter-stop `gap` (off the `--md-sys-space` ladder, responding to an ancestor `[density]` for free).
