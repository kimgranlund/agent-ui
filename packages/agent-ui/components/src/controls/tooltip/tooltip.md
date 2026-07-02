---
# tooltip.md frontmatter — the attributes-as-API descriptor for ui-tooltip (ADR-0004 /
# overlay-controller.lld.md / ADR-0043). The machine-checkable public surface lives HERE
# (frontmatter); the prose below the fence is the /site doc. The `attributes[]` block MUST
# mirror UITooltipElement.props (open + placement + delay) — the contract↔props trip-wire
# (tooltip.test.ts) and the frontmatter schema (validateComponentDescriptor) both target this
# fence. Field set per .claude/docs/plan.md §10 / ADR-0004; overlay mechanism per the overlay-controller
# LLD-C1..C4; bindable `open` two-way per ADR-0019; ADR-0043 = the overlay controller gate.
tag: ui-tooltip
tier: pattern           # geometry size-class — the panel uses --ui-space padding (Container/surface, NOT a control height)
extends: UIElement      # NOT form-associated — the tooltip carries no value/validity; it is a disclosure surface
# marginal: tracked at the wave-4 integration slice (s12 barrel pass)

attributes:             # attributes-as-API — mirrors UITooltipElement.props (open, placement, delay)
  - name: open
    type: boolean
    default: false
    reflect: true       # reflects + BINDABLE — the catalog declares value:{prop:'open',event:'toggle'} so the renderer two-way-binds it (ADR-0019); drives the overlay handle via a scope-owned effect
  - name: placement
    type: enum
    values: [bottom-start, bottom-end, top-start, top-end, left-start, left-end, right-start, right-end]
    default: bottom-start
    reflect: true       # reflects so <ui-tooltip placement="top-start"> works declaratively; captured once per connection
  - name: delay
    type: number
    default: 600
    reflect: false      # NOT reflected — setting delay= is an input, not an inspectable output state

properties:             # IDL beyond attributes-as-API
  - name: open
    description: Whether the tooltip panel is shown (boolean). Setting true calls showPopover() on the panel (manual popover — no Popover API light-dismiss; the tooltip controls its own dismissal). Setting false calls hidePopover(). Reflected + bindable (two-way open, ADR-0019). User-driven closes (mouseleave/focusout/Escape) emit close+toggle before setting this false.
  - name: placement
    description: Preferred panel placement relative to the anchor (OverlayPlacement enum, default 'bottom-start'). The JS positioning controller (LLD-C3) flips to the opposite side when the preferred side lacks space and shifts within the viewport. Captured at connection time; a reconnect picks up a new value.
  - name: delay
    description: Milliseconds to wait before showing the tooltip on mouseenter (number|null, default 600). Keyboard focus (focusin) shows immediately regardless of this value. Removing the delay attribute resets to null, which the handler treats as 600 ms (the documented default).

events:
  - name: toggle
    detail: 'null'
    description: Fired when the tooltip is dismissed by a user interaction (mouseleave/focusout/Escape) — the value:{event:'toggle'} two-way signal the renderer binds to write `open` back into the data model (ADR-0019). Emitted BEFORE open is set to false (so the renderer sees the event mid-transition). NOT fired on programmatic close (open=false set externally).
  - name: close
    detail: 'null'
    description: Fired alongside `toggle` on a user-driven dismiss — the family close event. NOT fired when the agent programmatically sets open=false. Emitted before `toggle` (the close-before-toggle discriminator, same as popover). The overlay controller does NOT emit this for tooltip (no platform light-dismiss with popover=manual) — the control emits it directly.

slots:
  - name: anchor
    optional: false
    description: The element being described — provide an interactive element (e.g. <button>) as the FIRST child of ui-tooltip. The control marks it with data-part="anchor" and adds aria-describedby pointing to the panel. The anchor stays in the document flow; only the panel enters the top layer.
  - name: tooltip-content
    optional: true
    description: Remaining children (after the first anchor child) are moved into the control-created panel at connect time. Provide the tooltip text as subsequent children or text nodes.

parts:
  - name: panel
    description: The control-created light-DOM <div data-part="panel" role="tooltip" popover="manual"> that enters the Popover API top layer when open. Created ONCE (idempotent guard — the same node persists across disconnect/reconnect). The overlay controller sets position:fixed + the inset on open via the JS positioning controller (LLD-C3).
  - name: anchor
    description: The first element child, marked with data-part="anchor". The control adds aria-describedby (pointing to the panel's stable id) once at part creation. The author owns the anchor's visual styling, accessible name, and interactive behavior.

customStates: []        # no :state() hooks — open/closed state is the panel's popover top-layer presence

face:
  formAssociated: false # NOT a FACE form control — a tooltip is a descriptive surface; it submits nothing

aria:
  role: none            # the host has no explicit role (a logical tooltip wrapper); the panel carries role=tooltip
  roleSource: panel     # the panel (data-part="panel") has role=tooltip set directly as a child element attribute
  labelSource: aria-describedby on the anchor points to the panel id (the panel IS the tooltip description)

keyboard:
  - keys: Tab / Shift+Tab
    action: Moves focus to/from the anchor element. When the anchor receives focus (focusin), the tooltip shows immediately (no delay — keyboard users cannot hover). When focus leaves (focusout), the tooltip hides.
  - keys: Escape
    action: Hides the open tooltip (a document-level keydown listener closes and emits close+toggle). The tooltip does NOT take focus (focusOnOpen=false), so Escape is processed wherever focus currently lives.

geometry:
  sizeClass: pattern    # Container/surface geometry — the panel uses --ui-space-sm padding; NO control height
  padding: var(--ui-tooltip-padding)          # = var(--ui-space-sm) — compact tooltip spacing
  radius: var(--ui-tooltip-radius)            # = var(--ui-radius-base), the shared fleet radius
  minInlineSize: var(--ui-tooltip-min-inline-size)  # floor to prevent collapse (ADR-0021 lesson)
  surface: var(--ui-tooltip-bg)              # neutral-variant surface (elevated contrast for tooltip readability)

forcedColors: A `@media (forced-colors: active)` block keeps the panel surface, frame, and ink as system Canvas/CanvasText. The Popover API popover=manual carries no ::backdrop, so no backdrop rule is needed.
---

# ui-tooltip

`ui-tooltip` is a **non-modal tooltip** built on the Overlay controller
(overlay-controller.lld.md · ADR-0043) and the native **Popover API** (`popover=manual`).
It extends `UIElement` and is **not** form-associated — a tooltip is a descriptive surface
that carries no form value. It uses `auto: false` (manual popover — no Popover API
light-dismiss) and `focusOnOpen: false` (the tooltip NEVER steals focus).

```html
<!-- Basic tooltip — button is the anchor, text content is the tooltip -->
<ui-tooltip>
  <button>Save</button>
  Save your changes (Ctrl+S)
</ui-tooltip>

<!-- With explicit placement and custom delay -->
<ui-tooltip placement="top-start" delay="300">
  <button aria-label="Delete item">🗑</button>
  Delete this item permanently
</ui-tooltip>

<!-- Bindable two-way open -->
<ui-tooltip open>
  <span tabindex="0">Hover or focus me</span>
  This tooltip is pre-opened.
</ui-tooltip>
```

## Anatomy

The host is `display: contents` — a logical wrapper that generates no box. The first element
child is the **anchor** (marked internally with `data-part="anchor"`); it stays in the
document flow. Remaining children are moved into the control-created **panel**
(`<div data-part="panel" role="tooltip" popover="manual">`) at connect time. The panel
enters the Popover API **top layer** via `showPopover()` — above any `overflow`/`transform`
ancestor, positioned by the JS controller.

## Open / close

`open` is a reflected boolean driven by a scope-owned effect. A **show-delay** (`delay` prop,
default 600 ms) is applied on **mouseenter**. **Keyboard focus** (`focusin`) shows immediately
— no delay — so keyboard users always see the tooltip. Dismiss triggers: **mouseleave**,
**focusout**, or **Escape** (a document-level listener).

User-driven closes emit **`close`** then **`toggle`** (the ADR-0019 two-way bind signal)
BEFORE setting `open = false`, so a bound renderer writes the model before the next render.
Programmatic closes (setting `open = false` externally) do NOT emit — the overlay controller's
discriminator (isOpen false before `hidePopover` fires its echo toggle) prevents re-emission.

## Placement

`placement` (default `'bottom-start'`) is the preferred position relative to the anchor. The
JS positioning controller (LLD-C3) **flips** to the opposite side when the preferred side
lacks space and **shifts** within the viewport edges. `data-placement` on the panel reflects
the resolved placement for CSS arrow/caret styling. Placement is captured at connection time.

## Accessibility

The **anchor** gets `aria-describedby` pointing to the panel's stable `id` (the ARIA tooltip
pattern). The **panel** carries `role="tooltip"`. The host carries no explicit role (a logical
wrapper). The tooltip NEVER moves focus (`focusOnOpen: false`) — keyboard users trigger it
via `focusin` and dismiss via `focusout` or `Escape`, remaining on the anchor throughout.

## Forced colors

A `@media (forced-colors: active)` block keeps the panel surface, frame, and ink as system
`Canvas`/`CanvasText`. No `::backdrop` is needed for `popover=manual` (no platform scrim).
