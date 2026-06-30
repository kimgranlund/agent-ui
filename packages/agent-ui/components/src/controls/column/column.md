---
# column.md frontmatter — the attributes-as-API descriptor for ui-column (ADR-0004). The machine-checkable
# public surface lives HERE (frontmatter); the prose below the fence is the /site doc. The `attributes[]` block
# MUST mirror column.ts `static props` (the spread surfaceProps + flexProps) — the contract↔props trip-wire
# (column-descriptor.test.ts) targets this fence. Field set per docs/plan.md §10 / ADR-0004.
#
# NOTE `extends: UIContainerElement` is the new G9 surface base; the descriptor-schema BASE_CLASSES gains it in
# the s12 packaging slice. Until then the schema flags only `extends` (BAD_EXTENDS); every other rule is clean
# (asserted in column-descriptor.test.ts by filtering that one transient code).
tag: ui-column
tier: layout           # geometry size-class (Container/layout band — NO control height; geometry.md "size-classes")
extends: UIContainerElement  # the surface base (ADR-0015/0016) — a structural container, NOT form-associated (face below)

attributes:            # attributes-as-API — mirrors column.ts `static props` (surfaceProps then flexProps)
  - name: elevation    # surface axis (ADR-0015) — the scheme-inverting plane; 0 = the neutral base
    type: enum
    values: [0, 1, 2, 3, -1, -2, -3]   # '0' LEADS so an out-of-range value snaps to the neutral base
    default: 0
    reflect: true      # reflects so the [elevation=n] surface repoint (shared container.css) applies to JS-set values
  - name: brightness   # surface axis (ADR-0015) — the scheme-consistent tonal shift; 0 = the neutral base
    type: enum
    values: [0, 1, 2, 3, -1, -2, -3]
    default: 0
    reflect: true
  - name: align        # cross-axis (inline) alignment → align-items (ADR-0030: default changed start→stretch)
    type: enum
    values: [start, center, end, stretch, baseline]
    default: stretch
    reflect: true      # reflects so the [align] flex repoint in column.css applies to JS-set values
  - name: justify      # main-axis (block) distribution → justify-content (between/around/evenly → space-*)
    type: enum
    values: [start, center, end, between, around, evenly]
    default: start
    reflect: true
  - name: gap          # child gap → gap: var(--ui-space-{step}) (the density-responsive ladder, never a control dim)
    type: enum
    values: [none, xs, sm, md, lg, xl, 2xl]
    default: none
    reflect: true
  - name: wrap         # → flex-wrap (boolean presence: present ⇒ wrap)
    type: boolean
    default: false
    reflect: true

properties: []         # no manual accessors beyond the attributes-as-API
events: []             # a layout primitive emits no events
slots: []              # light-DOM, host-as-flex — children are laid out directly, no named slots
parts: []              # no shadow parts exposed
customStates: []       # no interaction state — a layout box has none
face:
  formAssociated: false  # a structural container — extends UIContainerElement, no value/validity participation

aria:
  role: none           # a layout primitive contributes no semantics — no role is set (like a <div>)
  roleSource: none     # neither a host role attribute nor internals.role
  labelSource: none    # the laid-out children carry their own accessible names

keyboard: []           # not interactive — no keyboard contract

geometry:
  sizeClass: layout
  blockSize: content   # NO control height (geometry.md Container/layout) — the block-size is content-driven
  gap: var(--ui-column-gap)   # the child gap off --ui-space × [density] — the one density-bearing quantity
  containerQuery: 'inline-size: spreads children to a row under a wide container (ADR-0016 cl.4)'

forcedColors: A `@media (forced-colors: active)` block drops the tonal wash; the surface survives as a system colour via the shared container.css role layer.
---

# ui-column

`ui-column` is the vertical A2UI layout primitive — `ui-row`'s sibling with the main axis flipped to the
block axis (`flex-direction: column`). It is a **structural container**: it extends the `UIContainerElement`
surface base, is **not** form-associated, and contributes **no** ARIA semantics (like a `<div>`, it sets no
`role`). It styles its host and lets the user's light-DOM children flow through a flex column. Direction is
the element's **identity** (the tag names the main axis, A2UI-faithfully) — not a prop.

```html
<ui-column gap="md">
  <ui-card>…</ui-card>
  <ui-card>…</ui-card>
</ui-column>
<ui-column align="center" justify="between" gap="lg">…</ui-column>
```

## Layout grammar

`ui-column` consumes the shared, spreadable `flexProps` — the same one grammar four layout primitives share
(ADR-0016 cl.1), each reflected attribute mapping 1:1 onto a CSS flex property in column.css:

- **`align`** (cross axis = inline) → `align-items`: `stretch` (default — children fill the column's width; use `start` to shrink-wrap to content width) · `center` · `end` · `start` · `baseline`. (ADR-0030: default changed from `start` to `stretch`.)
- **`justify`** (main axis = block) → `justify-content`: `start` (default) · `center` · `end` · `between` · `around` · `evenly` (the `between`/`around`/`evenly` keywords map to `space-*`).
- **`gap`** → `gap: var(--ui-space-{step})`: `none` (default) · `xs` · `sm` · `md` · `lg` · `xl` · `2xl` — the density-responsive layout-spacing ladder (ADR-0015 cl.4), **never** a control dimension. An ancestor `[density]` (`compact/comfortable/spacious`) re-multiplies the gap; `[scale]` (the `ui-sm…content-lg` tier, ADR-0032) does not touch it (spacing is rhythm, not frame).
- **`wrap`** → `flex-wrap` (boolean presence): present ⇒ children wrap onto multiple lines.

## Surface

`ui-column` carries the two signed surface axes from the shared base (ADR-0015): **`elevation`** (the
scheme-inverting plane) and **`brightness`** (the scheme-consistent tonal shift), each `-3…3` with `0` the
neutral base. An unset column is transparent (it passes its parent's surface through). The surface is painted
by the shared `controls/_surface/container.css` (the `--ui-container-bg`/`-tint` seam); column.css holds zero
colour opinion.

## Responsiveness

`ui-column` is **intrinsically responsive** with **no breakpoint props** (ADR-0016 cl.4). It mirrors `ui-row`
(which stacks to a column under a narrow container) with the axis flipped: under a **wide** query container it
spreads its children into a row — the canonical "switcher" — reflowing on the container's width rather than the
viewport. There is no `ResizeObserver` fallback; `@container inline-size` is the mechanism.

## Geometry

A layout primitive has **no control height** (`geometry.md`'s Container/layout class): the block-size is
content-driven and spacing rides `--ui-space` × `[density]`, never `--ui-height-*`. A `forced-colors` block
drops the tonal wash so a column never paints over system text.
