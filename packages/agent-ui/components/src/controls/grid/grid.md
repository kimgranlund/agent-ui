---
# grid.md frontmatter — the attributes-as-API descriptor for ui-grid (ADR-0004). The machine-checkable public
# surface lives HERE (frontmatter); the prose below the fence is the /site doc. The `attributes[]` block MUST
# mirror grid.ts `static props` (the ...UIContainerElement.surfaceProps spread — elevation/brightness — plus
# the single `gap` flexProps entry and `min`) — the contract↔props trip-wire (grid-descriptor.test.ts) and the
# frontmatter schema both target this fence. Field set per docs/plan.md §10 / ADR-0004; the container surface +
# auto-fit/minmax layout per ADR-0015 / ADR-0016.
tag: ui-grid
tier: layout            # geometry size-class (Container/layout band — gaps off --ui-space × density, no control height; geometry.md "five size-classes")
extends: UIContainerElement  # the shared surface base — NOT form-associated (no value/validity); the descriptor schema's BASE_CLASSES gains UIContainerElement at the s12 integration slice
# marginal: ui-grid adds 79 B gz (340 B min) to the self-defining ui-* family (the delta of `npm run size`'s components barrel with vs. without this control's export, tree-shaken) — within the per-control ≤ ~2 kB tier budget (plan §10); the family total stays gated each run by `npm run size` (scripts/measure-size.mjs)

attributes:            # attributes-as-API — mirrors grid.ts `static props` (the surfaceProps spread first, then gap, then min)
  - name: elevation
    type: enum
    values: [0, 1, 2, 3, -1, -2, -3]
    default: 0
    reflect: true      # the scheme-INVERTING surface plane (--c-neutral-surface-{lowest…highest}); 0 = the neutral base. Reflects so the shared [elevation=n] repoint (controls/_surface/container.css) applies to JS-set values (ADR-0015)
  - name: brightness
    type: enum
    values: [0, 1, 2, 3, -1, -2, -3]
    default: 0
    reflect: true      # the scheme-CONSISTENT tonal shift; 0 = no wash. Reflects so the shared [brightness=m] repoint applies to JS-set values (ADR-0015)
  - name: gap
    type: enum
    values: [none, xs, sm, md, lg, xl, 2xl]
    default: none
    reflect: true      # the inter-track gap off the --ui-space density-responsive ladder (ADR-0015 cl.4); reflects so the [gap=step] repoint in grid.css applies to JS-set values. The one flexProps grammar prop a track grid consumes
  - name: min
    type: string
    default: ''
    reflect: true      # the minmax() track FLOOR — an arbitrary CSS <length>. Threaded into the role-pure --ui-grid-min token by grid.ts (unset ⇒ the grid.css default floor); reflects to a `min` attribute as the inspectable public API

properties: []         # no IDL beyond the attributes-as-API (a structural layout primitive)

events: []             # ui-grid emits no events — it is a passive layout container

slots:                 # children are arbitrary light-DOM GRID ITEMS placed in the auto-fit track flow (the default cell); there are no NAMED slots
  - name: default
    description: The grid items — arbitrary light-DOM children, each flowing into an auto-fit `minmax(min, 1fr)` track. No named slots; the grid does not render a wrapper (children are never clobbered).

parts: []              # no control-created parts (the host IS the grid; children are the user's)

customStates: []       # no interaction states — a structural layout primitive has no hover/focus/pressed motion

face:
  formAssociated: false  # a structural container — NOT form-associated (no value/validity; extends UIContainerElement, not UIFormElement)

aria:
  role: none             # a presentational layout grid — the host carries NO role/aria-* attribute; children carry their own semantics (compose ui-list / ARIA-bearing children when meaning is needed)

keyboard: []           # no keyboard interaction (a layout container)

geometry:
  sizeClass: layout      # Container/layout — gaps off --ui-space × [density], NO control height (geometry.md)
  trackFloor: var(--ui-grid-min)   # the minmax() track floor (default 16rem; the `min` prop repoints it per-instance)
  gap: var(--ui-grid-gap)          # the inter-track gap off the --ui-space ladder (density-bearing); [scale] does NOT touch it (layout rhythm, not frame)

forcedColors: The surface survives forced-colors via the SHARED controls/_surface/container.css `@media (forced-colors: active)` block (surface → Canvas, the tonal wash dropped); grid.css owns layout only, which forced-colors does not affect.
---

# ui-grid

`ui-grid` is a **track-grid layout primitive** (`extends UIContainerElement`, ADR-0016): a `display: grid`
container whose columns are an **intrinsic** `auto-fit` / `minmax` track model. It reflows by its **own**
rendered width — more columns when wide, fewer when narrow — with **no** breakpoint or column-count prop
and **no** `@container` rule. It is **not** form-associated and has **no** control height (the
*Container/layout* size-class: spacing rides `--ui-space` × density, never `--ui-height-*`).

```html
<ui-grid gap="md">
  <ui-card>…</ui-card>
  <ui-card>…</ui-card>
  <ui-card>…</ui-card>
</ui-grid>

<ui-grid gap="lg" min="12rem" elevation="1">…</ui-grid>
```

## Intrinsic responsiveness (auto-fit / minmax)

The columns are `repeat(auto-fit, minmax(var(--ui-grid-min), 1fr))`: the grid packs as many tracks as its
width fits at the `min` floor, then flexes each track between that floor and an even `1fr` share. As the
grid's container narrows, the track count drops; as it widens, it grows — the responsiveness is the
**element's own width**, not a viewport breakpoint, so a `ui-grid` composes anywhere an agent drops it
(ADR-0016 clause 3/4). There is deliberately **no** `columns` integer prop — a fixed count re-introduces the
breakpoint problem; an explicit track override stays available as plain CSS on the element (the escape hatch).

## The `min` track floor

`min` sets the `minmax()` floor — the narrowest a track may be before the grid drops to fewer columns. It
accepts any CSS `<length>` (`12rem`, `200px`, …) and is threaded into the role-pure `--ui-grid-min` token, so
setting `min` lowers it for denser grids or raises it for roomier cards. Unset, the floor is the sheet
default (`16rem`). It reflects to a `min` attribute as the inspectable public API; the dimension itself rides
the token, not an attribute selector.

## Gap & surface

`gap` selects a step on the `--ui-space` layout-spacing ladder (`none` (default) · `xs` · `sm` · `md` · `lg`
· `xl` · `2xl`) for the inter-track gap; an ancestor `[density]` re-multiplies it (it is layout **rhythm**,
so an ancestor `[scale]` leaves it untouched). The shared **surface** axes — `elevation` (the
scheme-inverting plane) and `brightness` (the scheme-consistent tonal shift) — come from `UIContainerElement`
(ADR-0015): a bare grid is transparent (it passes its parent's surface through), and `[elevation]` /
`[brightness]` repoint the shared `--ui-container-bg` / `-tint` seam in `controls/_surface/container.css`,
which also keeps the surface visible under forced-colors. The host carries **no** `role`/`aria-*` attribute —
a grid is presentational; compose ARIA-bearing children (e.g. `ui-list`) when the layout needs meaning.

## Not an A2UI catalog type

`ui-grid` ships as a direct `ui-*` primitive usable on its own. It is **not** part of the A2UI catalog's
reserved §5.2 set (Row/Column/Image/Video/Card/Tabs/Modal), so the default catalog does not declare a `Grid`
type — an agent reaches for `ui-row` / `ui-column` (the catalog layout types) or composes `ui-grid` directly.
