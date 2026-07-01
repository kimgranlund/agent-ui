---
# popover.md frontmatter — the attributes-as-API descriptor for ui-popover (ADR-0004 /
# overlay-controller.lld.md / ADR-0043). The machine-checkable public surface lives HERE
# (frontmatter); the prose below the fence is the /site doc. The `attributes[]` block MUST
# mirror UIPopoverElement.props (open + placement) — the contract↔props trip-wire
# (popover.test.ts) and the frontmatter schema (validateComponentDescriptor) both target this
# fence. Field set per docs/plan.md §10 / ADR-0004; overlay mechanism per the overlay-controller
# LLD-C1..C4; bindable `open` two-way per ADR-0019; ADR-0043 = the overlay controller gate.
tag: ui-popover
tier: pattern           # geometry size-class — the panel uses --ui-space padding (Container/surface, NOT a control height)
extends: UIElement      # NOT form-associated — the popover carries no value/validity; it is a disclosure surface
# marginal: tracked at the wave-4 integration slice (s12 barrel pass); ≤ ~2 kB tier budget (plan §10)

attributes:             # attributes-as-API — mirrors UIPopoverElement.props (open first, then placement)
  - name: open
    type: boolean
    default: false
    reflect: true       # reflects + BINDABLE — the catalog declares value:{prop:'open',event:'toggle'} so the renderer two-way-binds it (ADR-0019); drives the overlay handle via a scope-owned effect
  - name: placement
    type: enum
    values: [bottom-start, bottom-end, top-start, top-end, left-start, left-end, right-start, right-end]
    default: bottom-start
    reflect: true       # reflects so <ui-popover placement="top-end"> works declaratively; captured once per connection (changing after connect takes effect on the next reconnect)

properties:             # IDL beyond attributes-as-API
  - name: open
    description: Whether the popover panel is shown (boolean). Setting true calls showPopover() on the panel (top layer + light-dismiss via Escape + outside-click); false calls hidePopover(). Reflected + bindable (two-way `open`, ADR-0019). The overlay controller emits `close` + `toggle` on the host when the platform dismisses.
  - name: placement
    description: Preferred panel placement relative to the trigger (OverlayPlacement enum, default 'bottom-start'). The JS positioning controller (LLD-C3) flips to the opposite side when the preferred side lacks space and shifts within the viewport. Captured at connection time; a reconnect picks up a new value.

events:
  - name: toggle
    detail: 'null'
    description: Fired when the popover is light-dismissed by the platform (Escape / outside-click) — the value:{event:'toggle'} two-way signal the renderer binds to write `open` back into the data model (ADR-0019). Emitted by the overlay controller on the host only on platform-driven state changes, not on programmatic open/close.
  - name: close
    detail: 'null'
    description: Fired alongside `toggle` on a platform light-dismiss — the family close event. NOT fired when the agent programmatically sets open=false. By the time `toggle` reaches a renderer, `open` is already false (the control syncs the prop in its `close` listener before `toggle` fires).

slots:
  - name: trigger
    optional: false
    description: The disclosure trigger — provide an interactive element (e.g. <button>) as the FIRST child of ui-popover. The control marks it with data-part="trigger", wires aria-expanded + aria-controls, and listens for clicks to toggle the panel. The trigger stays in the document flow; only the panel enters the top layer.
  - name: panel-content
    optional: true
    description: Remaining children (after the first trigger child) are moved into the control-created panel at connect time (the modal child-move pattern). Provide the popover panel content as subsequent children.

parts:
  - name: panel
    description: The control-created light-DOM `<div data-part="panel" popover="auto">` that enters the Popover API top layer when open. Created ONCE (idempotent guard — the same node persists across disconnect/reconnect). The overlay controller sets position:fixed + the inset on open via the JS positioning controller (LLD-C3). Has tabindex="-1" so programmatic focus can land on it when no interactive descendants exist.
  - name: trigger
    description: The first element child, marked with `data-part="trigger"`. The control adds aria-expanded (synced via the scope-owned effect) and aria-controls (pointing to the panel's id). The author owns the trigger's visual styling and accessible name.

customStates: []        # no :state() hooks — open/closed state is the panel's popover top-layer presence, not a custom state

face:
  formAssociated: false # NOT a FACE form control — a popover is a disclosure surface; it submits nothing and carries no value

aria:
  role: none            # the host has no explicit role (a logical disclosure wrapper); internals.role is not set
  roleSource: none      # ARIA is provided by the trigger (aria-expanded/aria-controls set as child attributes) and the panel content (author's responsibility)
  labelSource: aria-label on the trigger element / panel content headings

keyboard:
  - keys: Enter / Space
    action: Activates the trigger element (the author-provided button handles this natively). The panel opens via the trigger's click handler.
  - keys: Escape
    action: Closes the open panel (the Popover API `popover=auto` light-dismiss fires the toggle event with newState='closed', which the overlay controller catches and emits `close` + `toggle` on the host, syncing open=false).
  - keys: Tab
    action: When the panel is open with focusOnOpen=true, initial focus moves into the panel (the first focusable descendant, or the panel itself via tabindex="-1"). Focus is restored to the trigger on close (LLD-C4, overlay controller).

geometry:
  sizeClass: pattern    # Container/surface geometry — the panel uses --ui-space padding; NO control height (--ui-height-* is never read)
  padding: var(--ui-popover-padding)    # = var(--ui-space-md) — density-responsive layout spacing
  radius: var(--ui-popover-radius)      # = var(--ui-radius-base), the shared fleet radius
  minInlineSize: var(--ui-popover-min-inline-size)  # floor to prevent collapse (ADR-0021 lesson)
  surface: var(--ui-popover-bg)         # opaque neutral-surface plane

forcedColors: A `@media (forced-colors: active)` block keeps the panel surface, frame, and ink as system Canvas/CanvasText. The Popover API `::backdrop` (if any) is left to the UA for `popover=auto` (no custom backdrop needed for a non-modal popover).
---

# ui-popover

`ui-popover` is a **disclosure popover** built on the Overlay controller (overlay-controller.lld.md ·
ADR-0043) and the native **Popover API**. It extends `UIElement` and is **not** form-associated — a
popover is a surface that reveals content, not a form widget. It **proves** the overlay controller:
S1's green browser smoke ratifies ADR-0043.

```html
<!-- Basic disclosure popover -->
<ui-popover>
  <button>Open settings</button>
  <section>
    <h3>Settings</h3>
    <p>Panel content here.</p>
  </section>
</ui-popover>

<!-- With explicit placement -->
<ui-popover placement="top-start">
  <button>Open menu</button>
  <ul>
    <li>Option A</li>
    <li>Option B</li>
  </ul>
</ui-popover>

<!-- Bindable two-way open -->
<ui-popover open>
  <button>Toggle</button>
  <p>Opens on load.</p>
</ui-popover>
```

## Anatomy

The host is `display: contents` — a logical wrapper that generates no box. The first element child
is the **trigger** (marked internally with `data-part="trigger"`); it stays in the document flow.
Remaining children are moved into the control-created **panel** (`<div data-part="panel" popover="auto">`)
at connect time. The panel enters the Popover API **top layer** via `showPopover()` — above any
`overflow`/`transform` ancestor, positioned by the JS controller.

## Open / close

`open` is a reflected boolean driven by a scope-owned effect: setting it **true** calls
`panel.showPopover()` (Popover API top layer + light-dismiss); **false** calls `panel.hidePopover()`.
When the **platform** dismisses the panel (Escape, outside-click), the overlay controller emits
`close` + `toggle` on the host. The control's `close` listener sets `open = false` (syncing the
prop), and `toggle` is the two-way bind signal the renderer writes back into the data model
(`value: { prop: 'open', event: 'toggle' }`, ADR-0019).

## Placement

`placement` (default `'bottom-start'`) is the preferred position relative to the trigger. The JS
positioning controller (LLD-C3) **flips** to the opposite side when the preferred side lacks space,
and **shifts** within the viewport edges. `data-placement` on the panel reflects the resolved
placement for CSS arrow/caret styling. Placement is captured at connection time; to change it
dynamically, update the prop and reconnect (remove + add) the element.

## Accessibility

The trigger gets `aria-expanded` (synced to `open`) and `aria-controls` (pointing to the panel's
stable `id`). The author-provided trigger element carries its own accessible name. Focus moves into
the panel on open (`focusOnOpen: true` — LLD-C4) and is restored to the trigger on close. The host
carries no explicit `role` (a logical wrapper).

## Forced colors

A `@media (forced-colors: active)` block keeps the panel surface, frame, and ink visible as system
`Canvas`/`CanvasText`. The Popover API handles `::backdrop` for `popover=auto` without a custom
scrim rule.
