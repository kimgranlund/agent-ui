---
# toolbar.md frontmatter — the attributes-as-API descriptor for ui-toolbar (ADR-0004; ADR-0121). The
# machine-checkable public surface lives HERE (frontmatter); the prose below the fence is the /site doc. The
# `attributes[]` block MUST mirror toolbar.ts `static props` (the ...UIContainerElement.surfaceProps spread —
# elevation/brightness — plus orientation/align/justify/gap/overflow/label) — the contract↔props trip-wire
# (toolbar-descriptor.test.ts) targets this fence.
tag: ui-toolbar
description: A flex action bar that arranges the consumer's own controls with role=toolbar and arrow-key roving focus.
tier: pattern          # geometry.md names toolbar explicitly as a Pattern-class example (container + control-height item rows)
extends: UIContainerElement   # the first non-form family — surface axes + reused internals (ARIA); NOT form-associated (face below)
# marginal: measured at integration time via `npm run size` (the delta of the components barrel with vs.
# without this control's export, tree-shaken) — within the per-control tier budget (plan §10); the family
# total stays gated each run by `npm run size` (scripts/measure-size.mjs)

attributes:            # attributes-as-API — mirrors toolbar.ts `static props` (the surfaceProps spread, then the toolbar-own props)
  - name: elevation
    type: enum
    values: [0, 1, 2, 3, -1, -2, -3]
    default: 0
    reflect: true      # the scheme-inverting surface plane (ADR-0015) — the F1 posture lever; ≥1 = floating (raised), 0/unset = embedded (transparent/flush)
  - name: brightness
    type: enum
    values: [0, 1, 2, 3, -1, -2, -3]
    default: 0
    reflect: true      # the scheme-consistent tonal shift (ADR-0015); 0 = no wash
  - name: orientation
    type: enum
    values: [horizontal, vertical]
    default: horizontal
    reflect: true      # flex-direction + the roving key-axis (resolved once at connect) + internals.ariaOrientation on the vertical case
  - name: align
    type: enum
    values: [start, center, end, stretch, baseline]
    default: center
    reflect: true      # cross-axis → align-items (ADR-0039); NOTE default 'center' — the bar look, differs from ui-row's 'start'
  - name: justify
    type: enum
    values: [start, center, end, between, around, evenly]
    default: start
    reflect: true      # main-axis distribution → justify-content (between/around/evenly → space-*)
  - name: gap
    type: enum
    values: [none, xs, sm, md, lg, xl, 2xl]
    default: sm
    reflect: true      # → gap: var(--md-sys-space-{step}); NOTE default 'sm' — toolbars are tight, differs from ui-row's 'none'
  - name: overflow
    type: enum
    values: [wrap, scroll]
    default: wrap
    reflect: true      # CSS-only (F4): wrap (default, never hides an action) or a single scroll line; the overflow-*menu* spillover is a fenced v2
  - name: label
    type: string
    default: ''
    reflect: true      # author accessible name → internals.ariaLabel when non-empty (never a raw host aria-label)

properties: []         # no manual accessors beyond the attributes-as-API

events: []             # the toolbar emits nothing (SPEC-R5) — it arranges + roves focus, it is not a command bus; items emit their own events

slots: []              # host-as-flex — the light-DOM children ARE the flex items / roving set (the ui-row precedent) — no NAMED slots

parts: []              # light-DOM, host-as-flex — no control-created part (unlike tabs' tablist strip)

customStates: []       # no interaction/motion state of its own in v1

face:
  formAssociated: false  # NOT a FACE form control — extends UIContainerElement (a plain UIElement), no value/validity participation

aria:
  role: toolbar                    # via ElementInternals — the host carries NO role/aria-* attribute
  roleSource: internals
  orientationSource: internals.ariaOrientation (set only when orientation=vertical; horizontal is the default and is left unannounced)
  labelSource: internals.ariaLabel (author-supplied via the `label` prop, when non-empty)

keyboard:
  - keys: ArrowRight
    action: "(horizontal) move roving focus to the next non-disabled item; STOPS at the end (no wrap)."
  - keys: ArrowLeft
    action: "(horizontal) move roving focus to the previous non-disabled item; STOPS at the start (no wrap)."
  - keys: ArrowDown
    action: "(vertical) move roving focus to the next non-disabled item; stops at the end."
  - keys: ArrowUp
    action: "(vertical) move roving focus to the previous non-disabled item; stops at the start."
  - keys: Home
    action: "move roving focus to the first non-disabled item."
  - keys: End
    action: "move roving focus to the last non-disabled item."
  - note: "ROVING TABINDEX — exactly one item carries tabindex=0, the rest tabindex=-1 (one Tab stop). NO wrap, NO type-ahead, NO selection/commit (focus-only — decoupled from selection, unlike ui-tabs). Item discovery is a live descendant query in DOM order, excluding disabled, tolerant of ui-row grouping nesting. Re-armed on reconnect."
  - note: "A real ui-button item's own focusability (traits/tabbable.ts) yields tab-stop ownership to this control's roving-focus trait via the data-roving marker contract (ADR-0121 amendment) — the roving item, and only it, is ever tabindex=0, even across a disabled↔enabled toggle mid-session."

geometry:
  sizeClass: pattern
  itemHeight: the items' own control height (the toolbar owns no size prop of its own)
  gap: var(--ui-toolbar-gap)                     # off --md-sys-space (density-responsive)
  padInline: var(--ui-toolbar-pad-inline)        # off --md-sys-space
  minBlockSize: var(--ui-toolbar-min-block-size) # the whole-shape bar floor — the control-height register (--md-sys-height-md), NOT a --md-sys-space quantity
  surface: --ui-container-bg                     # the ADR-0015 seam; transparent at elevation 0/unset (embedded), a raised plane at ≥1 (floating)

forcedColors: A `@media (forced-colors: active)` block keeps a surfaced toolbar's plane a system colour (Canvas) and drops the tonal wash (belt-and-braces with the shared container.css surface block); the toolbar paints no intent surface of its own in v1, so there is no additional indicator/cue to protect.
---

# ui-toolbar

`ui-toolbar` is a **Pattern**-class `UIContainerElement` — a light-DOM, host-as-flex action bar that arranges
the consumer's own interactive controls (`ui-button`, native `button`, `a[href]`, `[role="button"]`, or any
element carrying `data-toolbar-item`), gives them `role="toolbar"` plus arrow-key roving focus, and reads as a
**floating** or **embedded** bar purely through the existing `elevation`/`brightness` surface axis. It is
arrangement and focus semantics only — it emits **no events** and owns **no value**; it is not a command bus.

```html
<ui-toolbar label="Document actions" justify="between">
  <ui-row gap="xs">
    <ui-button variant="ghost" aria-label="Bold">…</ui-button>
    <ui-button variant="ghost" aria-label="Italic">…</ui-button>
  </ui-row>
  <ui-button variant="ghost">Share</ui-button>
</ui-toolbar>
```

## Layout

`ui-toolbar` is **host-as-flex**: its light-DOM children ARE the flex items (the `ui-row` precedent) — it
declares no named slots. `orientation` sets the flex axis (`horizontal`, default, → a row; `vertical` → a
column). `align`/`justify` reuse the ADR-0039 box-alignment dialect (`align` defaults `center` — the bar look,
unlike `ui-row`'s `start`; `justify` defaults `start`). `gap` is a step on the `--md-sys-space` layout ladder
(default `sm` — toolbars are tighter than a bare `ui-row`). `overflow` is CSS-only: `wrap` (default — every
item stays reachable, never hides an action) or `scroll` (a single line with its own scroll region). A
spillover overflow *menu* is a fenced, additive v2 — not built in v1.

`ui-toolbar` owns **no `size` prop** — the Pattern-class geometry (`geometry.md`): its items take their own
control height, and the toolbar's own contribution is padding + gap off the `--md-sys-space` ladder plus a
**min-block-size floor** tied to the control-height register, so an empty or short bar still reads as a bar.
`[scale]`/`[density]` ride ambiently (inherited), never as toolbar props.

## Posture — floating vs embedded

There is **no `posture` prop**. The floating/embedded distinction is entirely the existing surface axis
(ADR-0015): `elevation="0"`/unset is **embedded** (transparent, flush into a header or any container);
`elevation ≥ 1` is **floating** (a raised, shadowed plane, positioned by its consumer). `ui-toolbar` owns no
`position`, anchoring, or overlay/dismissal machinery — placement and width are the layout's job (the
`ui-text-field` `min-inline-size` precedent). A raised toolbar establishes the ADR-0052 `[data-box]` isolation
z-scope like every other surfaced container.

## Keyboard & roving focus

`ui-toolbar` reuses the shared `roving-focus` trait, **decoupled from selection** — the load-bearing difference
from `ui-tabs`: focus moves, nothing is selected, and no event is emitted. Exactly one item carries
`tabindex=0` (the rest `-1`), so `Tab` enters/leaves the whole bar as **one stop**. Arrow keys along the
orientation move focus to the next/previous non-disabled item and **stop at the ends** (no wrap, unlike
`ui-tabs`); `Home`/`End` jump to the first/last item. Item discovery is a live descendant query in DOM order
(tolerant of `ui-row` grouping), excluding disabled items. An arrow-consuming child (a slider, a text editor)
is out of v1's roving scope — a named follow-up, not a v1 guarantee.

## Accessibility

- `role="toolbar"` is set via `ElementInternals` — never a host `role` attribute.
- `internals.ariaOrientation` is set to `"vertical"` only when `orientation="vertical"` (horizontal is the
  default and is left unannounced).
- The accessible name is author-supplied via the `label` prop, written to `internals.ariaLabel` when non-empty
  (never a raw host `aria-label`).
- A `forced-colors` block keeps a surfaced toolbar's plane a system colour and drops the tonal wash.

## Non-goals (v1)

`ui-toolbar-group` (a `role="group"` cluster sub-tag), the overflow-*menu* spillover, and a `ui-divider`
vertical separator are all fenced, additive v2 extensions — v1 groups visually with `ui-row` children or gap
alone. Command/state management is the consumer's own controls; `ui-toolbar` arranges and roves focus only.
