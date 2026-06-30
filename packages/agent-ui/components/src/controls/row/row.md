---
# row.md frontmatter — the attributes-as-API descriptor for ui-row (ADR-0004). The machine-checkable public
# surface lives HERE (frontmatter); the prose below the fence is the /site doc. The `attributes[]` block
# MUST mirror row.ts `static props` (the spread `...surfaceProps, ...flexProps` = elevation/brightness/
# align/justify/gap/wrap) — the contract↔props trip-wire (row-descriptor.test.ts) targets this fence.
#
# NOTE `extends: UIContainerElement` — the FIRST non-form base. The descriptor schema's BASE_CLASSES gains
# UIContainerElement at the integration slice (decomp s12); until then the structural schema flags it
# BAD_EXTENDS, which row-descriptor.test.ts filters as the one deferred code (the contract↔props bijection
# is unaffected).
tag: ui-row
tier: layout           # geometry size-class (Container/layout band — NO control height; spacing off --ui-space × density; geometry.md §"five size-classes")
extends: UIContainerElement   # structural surface container, NOT form-associated (face below)
# marginal: ui-row adds 30 B gz (167 B min) to the self-defining ui-* family (the delta of `npm run size`'s components barrel with vs. without this control's export, tree-shaken) — within the per-control ≤ ~2 kB tier budget (plan §10); the family total stays gated each run by `npm run size` (scripts/measure-size.mjs)

attributes:            # attributes-as-API — mirrors row.ts `static props` (the surfaceProps + flexProps spread)
  - name: elevation
    type: enum
    values: [0, 1, 2, 3, -1, -2, -3]
    default: 0
    reflect: true      # the scheme-INVERTING surface plane (ADR-0015); [elevation=n] repoints --ui-container-bg in the shared seam. 0 = the neutral base
  - name: brightness
    type: enum
    values: [0, 1, 2, 3, -1, -2, -3]
    default: 0
    reflect: true      # the scheme-CONSISTENT tonal shift (ADR-0015); solo = a solid ladder step, composed-with-elevation = a translucent wash. 0 = no wash
  - name: align
    type: enum
    values: [start, center, end, stretch, baseline]
    default: start
    reflect: true      # cross-axis → align-items (ADR-0016); [align] repoints --ui-row-align in row.css
  - name: justify
    type: enum
    values: [start, center, end, between, around, evenly]
    default: start
    reflect: true      # main-axis distribution → justify-content (between/around/evenly → space-*); [justify] repoints --ui-row-justify
  - name: gap
    type: enum
    values: [none, xs, sm, md, lg, xl, 2xl]
    default: none
    reflect: true      # → gap: var(--ui-space-{step}) — the density-responsive layout-spacing ladder (rides [density], not [scale])
  - name: wrap
    type: boolean
    default: false
    reflect: true      # → flex-wrap (boolean presence: present ⇒ wrap)

properties: []         # no manual accessors beyond the attributes-as-API

events: []             # a layout container emits no events (no interaction, no value)

slots: []              # host-as-flex: the light-DOM children ARE the flex items (the default content) — no NAMED slots

parts: []              # light-DOM, host-as-flex — no shadow parts exposed
customStates: []       # no interaction states — a layout primitive has no hover/active/motion gate

face:
  formAssociated: false  # NOT a FACE form control — extends UIContainerElement (a plain UIElement), no value/validity participation

aria:
  role: none           # ui-row is a pure layout container (a generic wrapper, like a <div>) — it exposes NO ARIA role; semantics ride the children
  roleSource: none     # the host carries no role attribute and internals sets none (contrast ui-list, which sets internals.role='list')

keyboard: []           # no keyboard interaction — a layout primitive is not focusable and handles no keys

geometry:
  sizeClass: layout
  blockSize: auto                  # NO control height — a container has no frame; height is content-driven (geometry.md Container/layout)
  paddingBlock: 0                  # layout primitives add no padding; the gap is the spacing lever
  gap: var(--ui-row-gap)           # → var(--ui-space-{step}) — the one density-bearing quantity (rides [density], never [scale])
  radius: var(--ui-row-radius)     # → var(--ui-radius-base) — the shared fleet corner radius (rounds a surfaced row)

forcedColors: A `@media (forced-colors: active)` block keeps a surfaced row's plane a system colour (Canvas) and drops the tonal wash, so an elevation/brightness row survives high-contrast mode (belt-and-braces with the shared container.css surface block).
---

# ui-row

`ui-row` is the canonical **layout primitive** — a light-DOM custom element that lays its children out as a
horizontal flex row. It is **structural**, not a form control: it carries no value and does not participate
in form validation. Its children flow through the flex layout directly (host-as-flex); `ui-row` never wraps
them in shadow DOM. Direction is the element's **identity** (ADR-0016): pick `ui-row` for a horizontal axis
and `ui-column` for a vertical one — there is no `direction` prop.

```html
<ui-row gap="md" align="center">
  <ui-button>Save</ui-button>
  <ui-button variant="soft">Cancel</ui-button>
</ui-row>
```

## Layout

`ui-row` consumes the shared **flex grammar** (the `flexProps` set, identical across `ui-row` / `ui-column` /
`ui-list` / `ui-grid`):

- **`align`** (cross-axis) → `align-items`: `start` (default) · `center` · `end` · `stretch` · `baseline`.
- **`justify`** (main-axis distribution) → `justify-content`: `start` (default) · `center` · `end` ·
  `between` · `around` · `evenly` (the last three map to `space-between` / `space-around` / `space-evenly`).
- **`gap`** → a step on the `--ui-space` layout-spacing ladder: `none` (default) · `xs` · `sm` · `md` · `lg` ·
  `xl` · `2xl`. The gap is the one quantity that rides `[density]` (a `[density="spacious"]` ancestor widens
  it); `[scale]` does **not** touch it — layout rhythm is not control-frame size (ADR-0015 / geometry.md).
- **`wrap`** → `flex-wrap` (boolean presence): set `wrap` to allow children to flow onto multiple lines.

A `ui-row` has **no control height** (the `Container/layout` size-class, geometry.md): it never reads
`--ui-height-*`. Its height is content-driven; the gap is its only spacing lever.

## Surface

`ui-row` is a `UIContainerElement`, so it carries the two shared **surface axes** (ADR-0015), both signed
literal unions `-3…3` defaulting to `0` (the neutral, transparent base — an unset row adds no plane):

- **`elevation`** → the scheme-**inverting** plane (`--c-neutral-surface-{lowest…highest}`).
- **`brightness`** → the scheme-**consistent** tonal shift (a solid ladder step solo; a translucent wash when
  composed with an elevation).

The surface paint lives once in the shared `controls/_surface/container.css` (the `UIContainerElement` base
sheet) via the role-pure `--ui-container-bg` / `--ui-container-tint` seam — `ui-row` holds **zero** colour
opinion. A surfaced row takes the shared `--ui-radius-base` corner radius.

## Responsiveness

`ui-row` is **intrinsically responsive** with no breakpoint props (ADR-0016 cl.4). Each layout primitive
establishes a query container (`container-type: inline-size`, in the shared base sheet), and `ui-row` reflows
on its **own** container width: under a narrow container it **wraps to a column** (a `@container` rule flips
`flex-direction`). Because the trigger is the container — not the viewport — a `ui-row` reflows wherever it is
dropped, with no app-level media-query context. There are no `sm`/`md`/`lg` props.

## Accessibility

- `ui-row` exposes **no ARIA role** — it is a generic layout wrapper (like a `<div>`), and it carries no host
  `role` or `aria-*` attribute. The accessible semantics belong to the children, not the container. (For a
  semantic vertical stack, use `ui-list`, which sets `role="list"` via `ElementInternals`.)
- A `forced-colors` block keeps a surfaced row's plane a system colour and drops the tonal wash, so an
  `elevation`/`brightness` row survives high-contrast mode.
