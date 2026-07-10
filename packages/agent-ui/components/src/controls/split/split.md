---
# split.md frontmatter — the attributes-as-API descriptor for ui-split (ADR-0004; app-surfaces-m4.lld.md
# LLD-C6). The machine-checkable public surface lives HERE (frontmatter); the prose below the fence is the
# /site doc. The `attributes[]` block MUST mirror split.ts `static props` (axis + sizes) — the
# contract↔props trip-wire (split-descriptor.test.ts) targets this fence.
tag: ui-split
tier: layout           # geometry size-class (Container/layout band — NO control height; geometry.md §"five size-classes")
extends: UIContainerElement   # structural surface container, NOT form-associated (face below)
# marginal: measured at build (npm run size, LLD-C9) — the per-control ≤ ~2 kB tier budget (plan §10); the
# family total is re-based measured-at-build in the same wave (scripts/measure-size.mjs)

attributes:            # attributes-as-API — mirrors split.ts `static props` (axis, sizes)
  - name: axis
    type: enum
    values: [horizontal, vertical]
    default: horizontal
    reflect: true      # → flex-direction (split.css [axis=vertical]); also selects clientX vs clientY in traits/pane-resize.ts
  - name: sizes
    type: json          # closest ATTR_TYPES member to "array of ratios" (the bar-chart `data` / sparkline `values` array-codec precedent — component-descriptor.ts's `kindOf` classifies an array-returning codec as json)
    default: undefined  # String(undefined) = 'undefined' — the LIVE default; undefined ⇒ UNCONTROLLED (internal ratios drive the render)
    reflect: false      # NEVER reflected — `attribute: false` in source (a JS property only, too structured for markup; SPEC-R2 §2 prop-as-source-of-truth, ADR-0102). present ⇒ CONTROLLED: the control renders `sizes` and emits the proposed ratios on resize but never self-mutates it.

properties: []         # no manual accessors beyond the attributes-as-API

events:                 # both carry the PROPOSED ratio vector (number[]) as detail — the consumer reads it to write `sizes` back in controlled mode
  - name: input
    detail: 'number[]'
    description: Fired on every LIVE resize step — each pointermove during a drag, or once per keyboard Arrow/Home/End/Enter step. Detail is the full proposed ratio vector (sums to 1).
  - name: change
    detail: 'number[]'
    description: Fired on drag-END (pointerup/lostpointercapture/pointercancel) and, redundantly with `input`, on every keyboard step (a discrete key press is both the live update and the commit in one action — the native `<input type=range>` per-keystep parity). Detail is the full proposed ratio vector.

slots: []               # host-as-flex: the light-DOM `ui-split-pane` children ARE the flex items — no NAMED slots (the ui-row precedent)

parts:                   # NOT shadow-DOM ::part() (agent-ui is light-DOM only) — the light-DOM `[data-separator]`
                          # marker CSS/JS use to identify the control-rendered separator divs; documented here for
                          # completeness (compareDescriptorToSource does not mechanically check `parts:` — no
                          # `collectStyledParts` extractor exists, matching bar-chart's `[data-part]` convention)
  - name: separator
    description: One control-rendered `<div data-separator role="separator" tabindex="0">` per adjacent pane pair (N panes ⇒ N−1). Never authored — the slider-thumb precedent.

customStates:            # TKT-0015 — an internal, non-authorable interaction-state marker (the button `:state(ready)`/combo-box `:state(user-invalid)` precedent)
  - dragging             # set on the host at a drag's first live pointermove, cleared on commit/abort (SPEC-R2 AC6); split.css suspends `user-select` on `:scope` while it holds

face:
  formAssociated: false  # NOT a FACE form control — extends UIContainerElement (a plain UIElement), no value/validity participation

aria:
  role: none              # ui-split itself carries no host role (a pure layout container, the ui-row precedent) — semantics live on the separators
  roleSource: none        # the host carries no role attribute and internals sets none; each SEPARATOR sets role="separator" + aria-orientation/-controls/-valuenow/-valuemin/-valuemax/-label directly as HTML attributes (control-rendered light-DOM elements, not internals-backed — there is no ElementInternals per separator)

keyboard:                 # per FOCUSED SEPARATOR (tabindex=0), not the host itself
  - key: ArrowRight/ArrowLeft (horizontal) or ArrowUp/ArrowDown (vertical)
    action: Step the leading pane by --ui-split-key-step (5%), clamped to the two-neighbor pair's bounds. RTL-logical on the horizontal axis (SPEC-R3/R4 AC3 — ArrowRight shrinks the inline-start pane under dir=rtl).
  - key: Home
    action: Drive the leading pane to its minimum within the pair (redistribute clamps it there).
  - key: End
    action: Drive the leading pane to its maximum within the pair (redistribute clamps it there).
  - key: Enter
    action: Toggle collapse-to-last when the leading pane is `collapsible` (a no-op otherwise, documented).

geometry:
  sizeClass: layout
  blockSize: auto                       # NO control height — a container has no frame; height is content-driven (geometry.md Container/layout)
  paddingBlock: 0                       # layout primitives add no padding
  gap: none                             # no gap — panes touch the divider itself, not a flex gap
  radius: none                          # no corner radius — a splitter is not a surfaced/rounded plane
  divider: var(--ui-split-divider)      # the 1px visible divider thickness
  hitSlop: var(--ui-split-hit-slop)     # the ≥24px invisible pointer/touch target (WCAG 2.5.8, SPEC-R5 AC1), centred on the divider, never displacing the pane tracks
  keyStep: var(--ui-split-key-step)     # 5% of the two-neighbor pair per Arrow key press

forcedColors: A `@media (forced-colors: active)` block maps the separator divider to `ButtonText` with `forced-color-adjust: none` so it survives high-contrast mode (SPEC-R5 AC2); the focus ring is free via `--md-sys-color-focus-ring`'s own `→ Highlight` token-layer mapping (ADR-0009).
---

# ui-split

`ui-split` is a **multi-pane (N-slot), user-resizable split container** — a light-DOM custom element that
lays its `ui-split-pane` children out along one `axis`, separated by control-rendered, draggable +
keyboard-resizable ARIA `separator` elements (one per adjacent pane pair). It is **structural**, not a form
control: it carries no value and does not participate in form validation.

```html
<ui-split>
  <ui-split-pane><ui-text>Sidebar</ui-text></ui-split-pane>
  <ui-split-pane min="200px"><ui-text>Main content</ui-text></ui-split-pane>
</ui-split>
```

## Sizing

`ui-split` supports both **controlled** and **uncontrolled** sizing:

- **Uncontrolled** (the default — `sizes` unset): the control holds its own internal ratio vector, seeded
  from each `ui-split-pane`'s `initial` prop (or equally split when none declare one), and mutates it
  directly on every resize.
- **Controlled** (`sizes` set to a `number[]`, one ratio per pane, summing to 1): the control **renders**
  `sizes` and **emits** the proposed ratios (as the `input`/`change` event's `detail`) on user resize, but
  **never self-mutates it** — the consumer writes `el.sizes` back to move the rendered layout (the
  prop-as-source-of-truth law). `sizes` is a JS **property**, not an HTML attribute (too structured to
  reflect).

A `sizes` length mismatch against the current pane count reconciles automatically (extra entries dropped,
missing entries equal-filled, renormalized to sum 1) and warns once — it never throws.

## Resize — two-neighbor local redistribution

Dragging or keyboard-stepping separator *i* transfers extent between its **two immediately-adjacent panes
only** (pane *i* grows, pane *i+1* shrinks, sum-invariant), clamped so neither pane crosses its own `min`/
`max`. Non-adjacent panes are never touched. Each `ui-split-pane` MAY declare `min`/`max` as CSS length
strings (default `min` = a small floor, default `max` = unbounded).

## Dynamic panes

`ui-split-pane` children MAY be added or removed after connect — the separator set and ratio vector
re-derive automatically (a removed pane's share is redistributed to the survivors; an added pane seeds from
its own `initial` or an equal share taken proportionally from the others). A pane-count change **during** an
in-flight drag aborts that drag and settles at the pre-mutation ratios before re-deriving.

## Accessibility

Each separator is a focusable (`tabindex="0"`) `role="separator"` with `aria-orientation` (matching `axis`),
`aria-controls` (the leading pane's id), an `aria-label` (default `"Resize panel"`), and
`aria-valuenow`/`-valuemin`/`-valuemax` describing the leading pane's extent as an **integer percentage of
the two-neighbor pair's combined extent** — recomputed on every resize. Keyboard: Arrow keys (RTL-logical on
the horizontal axis) step by `--ui-split-key-step`; Home/End snap to the pair's bounds; Enter toggles
collapse-to-last when the leading pane is `collapsible`.

## Touch targets + forced-colors

The separator's pointer-interactive hit area is always **≥ 24×24 CSS px** (an invisible `::before` centred
on the visible 1px divider, WCAG 2.5.8), and the divider stays visible under `forced-colors: active`.

## Drag behavior

A pointer drag tracks the cursor **1:1** (no easing/lag) and never selects pane content underneath the
sweep: while a drag is active, the host carries the internal `:state(dragging)` state, which suspends
`user-select` across the whole split (restored on release or an aborted mid-drag pane mutation).
