---
# form-popover.md frontmatter — the attributes-as-API descriptor for ui-form-popover (ADR-0004 ·
# GH #294 F4 · form-popover.spec.md SPEC-R1..R11 · form-popover.lld.md LLD-C1..C7). The
# machine-checkable public surface lives HERE (frontmatter); the prose below the fence is the
# /site doc. The `attributes[]` block MUST mirror UIFormPopoverElement.props (open, placement,
# label, size) — the contract↔props trip-wire (form-popover.test.ts) and the frontmatter schema
# (validateComponentDescriptor) both target this fence. Field set per .claude/docs/plan.md §10 /
# ADR-0004; overlay mechanism per the overlay-controller LLD-C1..C4; bindable `open` two-way per
# ADR-0019; bindable `label` (one-way) per SPEC-R9/LLD-C6 — the catalog conformance validator
# rejects a `{path}` binding on a non-bindable prop.
tag: ui-form-popover
tier: pattern      # geometry composite: trigger = Control class; panel = Container/surface (select's trigger + popover's panel, by part)
extends: UIElement # NOT form-associated — the panel's children each own their own value/validity; live-apply (F2) leaves no aggregate draft value on the host
# marginal: tracked at the integration slice; ≤ ~2 kB tier budget (plan §10)

attributes:             # attributes-as-API — mirrors UIFormPopoverElement.props exactly
  - name: open
    type: boolean
    default: false
    reflect: true       # reflects + BINDABLE — the catalog declares value:{prop:'open',event:'toggle'} so the renderer two-way-binds it (ADR-0019); drives the overlay handle
  - name: placement
    type: enum
    values: [bottom-start, bottom-end, top-start, top-end, left-start, left-end, right-start, right-end]
    default: bottom-start
    reflect: true       # reflects so <ui-form-popover placement="top-end"> works declaratively; captured once per connection (changing after connect takes effect on the next reconnect)
  - name: label
    type: string
    default: ''
    reflect: true       # fleet label-reflects law (TKT-0069). The trigger's VISIBLE text AND accessible name — the consumer/agent-authored summary state (e.g. "Options · 3 selected", F1). BINDABLE one-way (SPEC-R9) — a non-bindable prop rejects a `{path}` data-model binding under the shipped conformance rules
  - name: size
    type: enum
    values: [sm, md, lg]
    default: md
    reflect: true       # reflects so the [size] attribute-selector repoint in form-popover.css (trigger height/font/icon/gap) applies to JS-set values too (the select/text-field precedent)

properties:             # IDL beyond attributes-as-API
  - name: open
    description: Whether the panel is shown (boolean). Setting true calls showPopover() on the panel (top layer + light-dismiss via Escape + outside-click); false calls hidePopover(). Reflected + bindable (two-way `open`, ADR-0019). The overlay trait emits `close` + `toggle` on the host for every ACTUAL open-state transition (ADR-0101) — platform dismissal, a trigger-click close, or a model-driven write alike.
  - name: placement
    description: Preferred panel placement relative to the trigger (OverlayPlacement enum, default 'bottom-start'). The JS positioning controller flips to the opposite side when the preferred side lacks space and shifts within the viewport. Captured at connection time; a reconnect picks up a new value.
  - name: label
    description: The trigger's visible text and accessible name — a consumer-authored (or agent-bound) summary of the panel's state, e.g. "Options · 3 selected". The control never computes this itself (F1 — the content model is general form content, not a fixed anatomy the control could count). '' renders an empty trigger; a non-empty label is effectively required for an accessible name (consumer contract, not validator-enforced).
  - name: size
    description: The trigger's dimensional-ramp step ('sm' | 'md' | 'lg', default 'md'). Reflects `size`. Repoints the trigger's height/font/icon/gap via the [size] attribute-selector block in form-popover.css (the select/text-field axis).

events:
  - name: toggle
    detail: 'null'
    description: Fired on EVERY actual open-state transition — platform-driven (Escape / outside-click), component-driven (a trigger-click close), or model-driven (a programmatic `open` write) — the value:{event:'toggle'} two-way signal the renderer binds to write `open` back into the data model (ADR-0019). Emitted after `el.open` has settled to its new value (ADR-0101).
  - name: close
    detail: 'null'
    description: Fired alongside `toggle` on every actual hide (never on a show) — the family close event, whatever drove the hide. Fires BEFORE `toggle` (ADR-0101 mechanic 3).

slots:
  - name: panel-content
    optional: true
    description: ALL author children are moved into the control-created panel at connect time (ADR-0017) — there is no separate trigger slot (unlike ui-popover, the trigger is CONTROL-CREATED). One default slot, general form content (F1) — check group · radio group · text field · any real FACE form control, live-apply (F2, no draft/commit model).

parts:
  - name: trigger
    description: The control-created `<button data-part="trigger" type="button">`. Control-class height from --ui-form-popover-height. Contains [data-part=label] (the visible `label` text) and [data-part=caret] (the caret-down Phosphor glyph, aria-hidden, sized = font per the §4.1 caret law). Always lays out as [label | caret] (1fr + auto grid). Gets aria-expanded (synced via scope-owned effect) and aria-controls pointing to the panel id — NO aria-haspopup (SPEC-R6 — a generic disclosure surface, not a menu/listbox/dialog).
  - name: label
    description: A `<span data-part="label">` inside the trigger. Shows the `label` prop's text, updated by a scope-owned reactive effect. Also the trigger's accessible name (content-only — no hidden-span concatenation, unlike select, since there is no separate selection-value text to preserve).
  - name: caret
    description: A `<span data-part="caret" aria-hidden="true">` inside the trigger, injected with the Phosphor `caret-down` glyph via `setIcon` (@agent-ui/icons). An inline affordance sized = font (the §4.1 caret law). CSS centres it in an icon-sized cell by padding = ½(icon−glyph).
  - name: panel
    description: The control-created `<div data-part="panel" data-box tabindex="-1">`. Container/surface in the Popover API top layer when open. ALL author children are moved here at connect time. The overlay controller sets popover="auto" + position:fixed + inset; `[data-box]` (ADR-0046) provides the inner spacing + z-scope (ADR-0052) — this control's CSS adds bg/border/radius + a min/max inline-size floor+clamp only. tabindex="-1" allows fallback focus when the panel has no interactive descendants.

customStates: []        # open/closed state is the panel's popover top-layer presence, not a custom state — matches ui-popover

face:
  formAssociated: false # NOT a FACE form control — a disclosure surface; children own their own value/validity individually (F2 live-apply leaves no aggregate)

aria:
  role: none            # the host has no explicit role (a logical disclosure wrapper, matching ui-popover)
  roleSource: none      # ARIA is provided by the trigger (aria-expanded/aria-controls) and the panel content (author's responsibility — ui-field/ui-form-provider work unchanged inside the moved children)
  labelSource: The trigger's accessible name is its visible `label` prop text (content-only — no aria-labelledby concatenation needed).

keyboard:
  - keys: Enter / Space
    action: Activates the trigger (native button behaviour). The panel opens via the trigger's click handler, which flips the `open` prop.
  - keys: Escape
    action: Closes the open panel (the Popover API popover=auto light-dismiss fires the toggle event with newState='closed', which the overlay controller catches and emits `close` + `toggle` on the host, syncing open=false).
  - keys: Tab
    action: NATIVE tab order inside the open panel — no roving focus, no type-ahead, no arrow-key interception (SPEC-R5, the anti-ui-menu constraint: an embedded text field must receive ordinary typing and Tab must walk the panel's real form controls in document order). Initial focus moves into the panel on open (focusOnOpen=true); focus is restored to the trigger on close.

geometry:
  sizeClass: composite
  trigger:
    height: var(--ui-form-popover-height)     # Control class — off the §1-row ramp (ADR-0038)
    font: var(--ui-form-popover-font)
    icon: var(--ui-form-popover-icon)         # the caret CELL is icon-wide
    glyph: var(--ui-form-popover-glyph)       # = font, the §4.1 caret law
    radius: var(--ui-form-popover-radius)     # = --md-sys-shape-corner-base (shared fleet radius)
    minInlineSize: var(--ui-form-popover-min-inline-size)  # the 10ch host floor (ADR-0021 lesson — an empty-label trigger needs a floor)
  panel:
    sizeClass: Container/surface
    bg: var(--ui-form-popover-panel-bg)
    radius: var(--ui-form-popover-panel-radius)
    minInlineSize: var(--ui-form-popover-panel-min-inline-size)  # the text-field 20ch-floor lesson — a panel of form fields needs an intrinsic floor
    maxInlineSize: var(--ui-form-popover-panel-max-inline-size)  # a panel of arbitrary form content must not run edge-to-edge

forcedColors: A `@media (forced-colors: active)` block keeps the trigger (ButtonText/ButtonBorder/ButtonFace) and the panel surface (Canvas/CanvasText) visible in Windows High Contrast Mode.
---

# ui-form-popover

`ui-form-popover` is a **pattern-tier control** that packages the `ui-popover` + form-spine
composition recipe (GH #294's first design leg) as one tag: a control-created trigger button whose
**visible label carries consumer-authored summary state** (e.g. "Options · 3 selected") opens a
floating, anchored, light-dismiss panel holding **arbitrary real form content** — check groups,
radio groups, text fields, any FACE control — edited **live-apply** (each child's own commit takes
effect immediately; the host holds no draft value). It extends `UIElement` and is **not**
form-associated — the moved children each own their own value/validity individually.

```html
<!-- Basic usage: an agent/consumer keeps `label` current as the panel's selections change -->
<ui-form-popover label="Options · 0 selected">
  <fieldset role="group" aria-label="Options">
    <label><input type="checkbox" name="opt" value="a"> Option A</label>
    <label><input type="checkbox" name="opt" value="b"> Option B</label>
  </fieldset>
</ui-form-popover>

<!-- Explicit placement -->
<ui-form-popover label="Filters" placement="bottom-end">
  <ui-text-field label="Search"></ui-text-field>
</ui-form-popover>

<!-- Bindable two-way open -->
<ui-form-popover open label="Advanced">
  <p>Opens on load.</p>
</ui-form-popover>
```

## Anatomy

The host is `display: contents` — a logical disclosure wrapper that generates no box (the
`ui-popover` precedent). Unlike `ui-popover`, the trigger is **control-created**, not
author-provided: ALL author children move into the control-created **panel**
(`<div data-part="panel" data-box tabindex="-1">`) at connect time. There is **one** content
model — general form content (F1) — with no named rows and no fixed anatomy.

## Trigger label — the summary-state carrier

`label` is a plain prop, not a slot and not control-computed. The control never counts its own
children (F1: content is general, not presumed-checkbox semantics) — the consumer (or, in A2UI, an
agent binding `label` to a `{path}` in the data model, SPEC-R9) is responsible for keeping the
visible summary current, e.g. by listening for `change` events bubbling from the panel's children.

## Open / close

`open` is a reflected boolean driven by a scope-owned effect: setting it **true** calls
`panel.showPopover()`; **false** calls `panel.hidePopover()`. The overlay trait announces every
ACTUAL open-state transition (ADR-0101): `toggle` on a real show, `close` + `toggle` on a real hide
— platform-driven (Escape, outside-click), component-driven (a trigger click), or model-driven
alike. `toggle` is the two-way bind signal (`value: { prop: 'open', event: 'toggle' }`, ADR-0019).

## Keyboard — native, not roving

Tab order inside the open panel is **native** — no roving focus, no type-ahead, no arrow-key
interception. This is the deliberate departure from `ui-menu`: a menu's roving/type-ahead
mechanics are hostile to an embedded text field (typing "O" would be stolen as type-ahead, not
land in the field). Enter/Space activate the trigger as an ordinary native button.

## No built-in close affordance

The panel ships no close button — light-dismiss, Escape, and trigger re-click are the close paths
(SPEC-R10). A consumer wanting an in-panel collapse affordance authors a `ui-button` that sets
`open = false` — a documented idiom, not anatomy.

## Accessibility

The trigger gets `aria-expanded` (synced to `open`) and `aria-controls` (pointing to the panel's
stable `id`) — **no** `aria-haspopup` (a generic disclosure surface, not a menu/listbox/dialog,
matching `ui-popover` and the APG disclosure pattern). The trigger's accessible name is its visible
`label` text (content-only). The host carries no explicit `role`. Group/label semantics inside the
panel belong to the consumer's own content (e.g. a `role="group"` wrapper) — the control adds none.

## Forced colors

A `@media (forced-colors: active)` block keeps the trigger frame/label/caret and the panel surface
visible as system colours.
