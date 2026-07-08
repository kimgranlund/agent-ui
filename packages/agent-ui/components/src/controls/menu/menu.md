---
# menu.md frontmatter — the attributes-as-API descriptor for ui-menu (ADR-0004 /
# overlay-controller.lld.md / ADR-0043 / control-suite-wave4-overlay.decomp.md S3). The
# machine-checkable public surface lives HERE (frontmatter); the prose below the fence is the
# /site doc. The `attributes[]` block MUST mirror UIMenuElement.props (open + placement) — the
# contract↔props trip-wire (menu.test.ts) and the frontmatter schema (validateComponentDescriptor)
# both target this fence. Field set per .claude/docs/plan.md §10 / ADR-0004; overlay mechanism per
# the overlay-controller LLD-C1..C4; bindable `open` two-way per ADR-0019.
tag: ui-menu
tier: pattern           # geometry size-class — panel uses Container/surface geometry; items use the legacy item-pad (NOT a control height)
extends: UIElement      # NOT form-associated — the menu carries no form value; it emits an action (`select`)
# marginal: tracked at the wave-4 integration slice (s12 barrel pass); ≤ ~2 kB tier budget (plan §10)

attributes:             # attributes-as-API — mirrors UIMenuElement.props (open first, then placement)
  - name: open
    type: boolean
    default: false
    reflect: true       # reflects + BINDABLE — the catalog declares value:{prop:'open',event:'toggle'} so the renderer two-way-binds it (ADR-0019); drives the overlay handle via a scope-owned effect
  - name: placement
    type: enum
    values: [bottom-start, bottom-end, top-start, top-end, left-start, left-end, right-start, right-end]
    default: bottom-start
    reflect: true       # reflects so <ui-menu placement="top-end"> works declaratively; captured once per connection (changing after connect takes effect on the next reconnect)

properties:             # IDL beyond attributes-as-API
  - name: open
    description: Whether the menu panel is shown (boolean). Setting true calls showPopover() (top layer + light-dismiss via Escape + outside-click); false calls hidePopover(). Reflected + bindable (two-way `open`, ADR-0019). The overlay trait emits `close` + `toggle` on the host for every ACTUAL open-state transition — platform dismissal (Escape / outside-click), a commit's programmatic close, or a model-driven write alike (ADR-0101) — after `open` has settled to its new value.
  - name: placement
    description: Preferred panel placement relative to the trigger (OverlayPlacement enum, default 'bottom-start'). The JS positioning controller (LLD-C3) flips to the opposite side when the preferred side lacks space and shifts within the viewport. Captured at connection time; a reconnect picks up a new value.

events:
  - name: select
    detail: '{ value: string; index: number }'
    description: Fired when the user commits a menu item selection — via Enter/Space keydown (on non-button items) or click. `value` is the item's `data-value` attribute, or its trimmed textContent as a fallback. `index` is the item's 0-based position in the [role=menuitem] list. The menu closes immediately after this event fires (open is set to false programmatically). NOT fired when the menu closes without a selection (Escape / outside-click).
  - name: toggle
    detail: 'null'
    description: Fired on EVERY actual open-state transition — platform-driven (Escape / outside-click), component-driven (a commit or trigger action), or model-driven (a programmatic `open` write) — the two-way bind signal (ADR-0019, value:{prop:'open',event:'toggle'}). Emitted after `el.open` has settled to its new value (ADR-0101), so a two-way bind reads the correct value at listener time on every path.
  - name: close
    detail: 'null'
    description: Fired alongside `toggle` on every actual hide (never on a show) — the family close event, whatever drove the hide (platform light-dismiss, an item commit, or a programmatic `open=false`). Fires BEFORE `toggle` (ADR-0101 mechanic 3 — the ordering invariant).

slots:
  - name: trigger
    optional: false
    description: The menu trigger — provide an interactive element (e.g. <button>) as the FIRST child of ui-menu. The control marks it with data-part="trigger", wires aria-expanded + aria-controls + aria-haspopup="menu", and listens for clicks to toggle the panel. The trigger stays in document flow; only the panel enters the top layer.
  - name: items
    optional: false
    description: Remaining children (after the first trigger child) are moved into the control-created panel at connect time. Provide the menu items as subsequent children; they auto-receive role=menuitem and tabindex=-1 if absent. Add `data-value="…"` to set the emitted select value; without it, the item's textContent is used. Add `disabled` or `aria-disabled="true"` to make an item inert (skipped by roving focus + commit).

parts:
  - name: panel
    description: The control-created light-DOM `<div data-part="panel" role="menu" popover="auto">` that enters the Popover API top layer when open. Created ONCE (idempotent guard — the same node persists across disconnect/reconnect). Has tabindex="-1" so programmatic focus (moveFocusIn, overlay LLD-C4) can land on it when no enabled items exist. The overlay controller sets position:fixed + inset on open (LLD-C3); the JS positioning controller manages placement.
  - name: trigger
    description: The first element child, marked with `data-part="trigger"`. The control adds aria-expanded (synced via the model→overlay effect), aria-controls (pointing to the panel's stable id), and aria-haspopup="menu". The author owns the trigger's visual styling and accessible name.

customStates: []        # no :state() hooks — open/closed state is the panel's popover top-layer presence

face:
  formAssociated: false # NOT a FACE form control — a menu is a command surface; it emits an action (select), not a form value

aria:
  role: none            # the host has no explicit role (a logical disclosure wrapper); internals.role is not set
  roleSource: none      # ARIA is provided by the trigger (aria-expanded/aria-controls/aria-haspopup set as child attributes) and the panel (role=menu on the div part; items get role=menuitem auto-assigned)
  labelSource: aria-label on the trigger element

keyboard:
  - keys: Enter / Space
    action: Activates the trigger to toggle the panel (native button behaviour). When focus is on a menuitem (non-button), Enter/Space commits the item, emits `select`, and closes the menu.
  - keys: ArrowDown / ArrowUp
    action: Move roving focus to the next/previous enabled menuitem (wrapping at the ends). Disabled items are skipped.
  - keys: Home / End
    action: Move roving focus to the first / last enabled menuitem.
  - keys: Escape
    action: Closes the open menu panel via the Popover API `popover=auto` light-dismiss; emits `close` + `toggle`; restores focus to the trigger.
  - keys: Printable character
    action: Type-ahead — focuses the next menuitem whose label starts with the typed character (200 ms reset between bursts; wraps; skips disabled items).

geometry:
  sizeClass: pattern            # Container/surface for the panel; item-pad rows for the menuitems (NOT a control height)
  panelPadding: var(--ui-menu-padding)             # = var(--ui-space-xs) — shell spacing
  panelRadius: var(--ui-menu-radius)               # = var(--ui-radius-base), the shared fleet radius
  panelMinInlineSize: var(--ui-menu-min-inline-size)  # 10rem floor (ADR-0021 lesson)
  panelMaxBlockSize: 40vh (scrolls) # bounds an unbounded item list (matches ui-select); gets the shared edge-aware scroll-fade by default (traits/scroll-fade.ts, container-box.css)
  panelSurface: var(--ui-menu-bg)                  # opaque neutral-surface plane
  itemPadBlock: var(--ui-menu-item-pad-block)      # = var(--ui-space-xs) — legacy item-pad block axis
  itemPadInline: var(--ui-menu-item-pad-inline)    # = var(--ui-space-md) — legacy item-pad inline axis
  itemRadius: var(--ui-menu-item-radius)           # nested-radius from panel corner = panelRadius − --ui-box-inset (FIXED 2026-07-06: was subtracting the unrelated --ui-space-xs, an ADR-0018 inset-inconsistency)
  note: ui-menu has NO `[size]` attribute and renders no trigger geometry (the trigger is fully author-owned) — the select/combo-box family's size-carrying derivation (panel inset + option pad off the trigger's own height/font) does not apply here; flagged as a structural divergence, not forced (2026-07-06 pass)

forcedColors: A `@media (forced-colors: active)` block keeps the panel surface (Canvas/CanvasText), frame (CanvasText border), and hovered/focused items (Highlight/HighlightText) visible. `forced-color-adjust: none` on hover/focus items commits to the system Highlight pair rather than letting the solid fill be discarded.
---

# ui-menu

`ui-menu` is a **keyboard-navigable overlay menu** built on the Overlay controller
(overlay-controller.lld.md · ADR-0043) and the `rovingFocus` trait (listbox-roving LLD-C1). It
extends `UIElement` and is **not** form-associated — a menu emits a commit action (`select` event),
not a form value. It composes `overlay()` with `rovingFocus()` over `[role=menuitem]` items:
Arrow keys rove focus; Enter/click commits; type-ahead finds items by label prefix.

```html
<!-- Basic menu with a button trigger -->
<ui-menu>
  <button>Open menu</button>
  <div>New file</div>
  <div>Open file</div>
  <div disabled>Save (disabled)</div>
  <div>Exit</div>
</ui-menu>

<!-- With explicit values and placement -->
<ui-menu placement="top-start">
  <button>Actions</button>
  <div data-value="copy">Copy</div>
  <div data-value="paste">Paste</div>
  <div data-value="delete" aria-disabled="true">Delete</div>
</ui-menu>

<!-- Two-way open binding -->
<ui-menu open>
  <button>Options</button>
  <div data-value="a">Option A</div>
  <div data-value="b">Option B</div>
</ui-menu>
```

## Anatomy

The host is `display: contents` — a logical wrapper that generates no box. The first element child
is the **trigger** (marked internally with `data-part="trigger"`); it stays in document flow.
Remaining children are moved into the control-created **panel** (`<div data-part="panel" role="menu"
popover="auto">`) at connect time. The panel enters the Popover API **top layer** via `showPopover()`
— above any `overflow`/`transform` ancestor, positioned by the JS controller. Item children
auto-receive `role=menuitem` and `tabindex=-1` if they don't already carry a role.

## Open / close

`open` is a reflected boolean driven by a scope-owned effect. Setting it **true** calls
`panel.showPopover()` (top layer + light-dismiss); **false** calls `panel.hidePopover()`. The overlay
trait announces every ACTUAL open-state transition (ADR-0101): `toggle` on a real show, `close` +
`toggle` on a real hide — whether **platform**-driven (Escape, outside-click), **component**-driven
(a commit), or **model**-driven (a programmatic `open` write). When the platform dismisses the panel,
the control's own `close` listener also sets `open = false` so the prop stays consistent. `toggle` is
the two-way bind signal (`value: { prop: 'open', event: 'toggle' }`, ADR-0019).

## Commit → select

When the user activates a menuitem (Enter/Space on a non-button item, or click), the control emits
`select` with `{ value, index }` — where `value` is the item's `data-value` attribute (or
`textContent` fallback) and `index` is its 0-based position — then closes the menu programmatically.
This programmatic close emits `close` + `toggle` like every other real hide (ADR-0101), with `open`
already `false` at listener time.

## Keyboard navigation

`rovingFocus` wires the panel as the keyboard container (`container: panel`): ArrowDown/Up move
focus between enabled items (wrapping); Home/End jump to the first/last enabled item. Disabled
items (carrying `disabled` or `aria-disabled="true"`) are skipped. Type-ahead (200 ms burst window)
finds the next item whose label starts with the typed buffer.

## Focus management

`focusOnOpen: true` in the overlay options: focus moves INTO the menu when it opens (the first
enabled item receives focus via the roving-focus tabindex=0 + `moveFocusIn()`), and is restored to
the trigger on close (the overlay handle's `restoreFocus()`). On close without a selection
(Escape/outside-click), focus returns to the trigger.

## Placement

`placement` (default `'bottom-start'`) is the preferred position relative to the trigger. The JS
positioning controller (LLD-C3) **flips** to the opposite side when the preferred side lacks space,
and **shifts** within the viewport edges. `data-placement` on the panel reflects the resolved
placement. Placement is captured at connection time.

## Forced colors

A `@media (forced-colors: active)` block keeps the panel surface and frame visible as system
`Canvas`/`CanvasText`. Hovered and focused items use `Highlight`/`HighlightText` with
`forced-color-adjust: none` (the solid fill would otherwise be discarded by the forced-colors engine).
