---
# switch.md frontmatter — the attributes-as-API descriptor for ui-switch (ADR-0004). The machine-checkable
# public surface lives HERE (frontmatter); the prose below the fence is the /site doc.
# The `attributes[]` block MUST mirror indicator-element.ts `indicatorProps` (the ...UIFormElement.formProps
# spread — name/disabled/required — plus checked/value/size) — the contract↔props trip-wire and the frontmatter
# schema both target this fence. Field set per docs/plan.md §10 / ADR-0004.
# Indicator-class geometry: the box rides `--ui-compact-{size}` (ADR-0041); the thumb insets
# `--ui-widget-inset` (2px) so thumb = box − 4px (LLD-C4 / ADR-0041 cl.3 — proven by switch.browser.test.ts,
# which RATIFIES ADR-0041 as the S2 green gate).
tag: ui-switch
tier: indicator          # geometry size-class (Indicator widget box — compact ramp, not full control height; geometry.md "five size-classes")
extends: UIIndicatorElement   # the Indicator base (ADR-0042); UISwitchElement → UIIndicatorElement → UIFormElement
# marginal: ui-switch adds 55 B gz (263 B min) to the self-defining ui-* family above ui-checkbox (UIIndicatorElement is already in the bundle via checkbox — UISwitchElement adds only its role assignment; the dominant shared cost is on checkbox's marginal) — within the per-control ≤ ~2 kB tier budget (plan §10)

attributes:              # attributes-as-API — mirrors indicator-element.ts `indicatorProps` (indicator-specific first, then spread formProps)
  - name: checked
    type: boolean
    default: false
    reflect: true        # reflects so `[checked]` drives CSS paint + is observable as an attribute; the form value when true
  - name: value
    type: string
    default: 'on'
    reflect: true        # reflects (platform checkbox semantics: the submitted string when checked); default 'on'
  - name: size
    type: enum
    values: [sm, md, lg]
    default: md
    reflect: true        # reflects so the [size] widget-box repoint in switch.css applies to JS-set values too
  - name: name
    type: string
    default: ''
    reflect: true        # the form field name (FACE; UIFormElement.formProps) — reflects (native parity; submission keys by the `name` content attribute)
  - name: disabled
    type: boolean
    default: false
    reflect: true        # reflects so the [disabled] CSS hook applies to JS-set values; effectiveDisabled = own || form-disabled channel (ADR-0013)
  - name: required
    type: boolean
    default: false
    reflect: true        # reflects to a `required` attribute; drives valueMissing validity verdict

properties: []           # no manual accessors beyond the attributes-as-API

events:
  - name: change
    detail: 'null'
    description: Fired on toggle — a click or Space activation (UIIndicatorElement click handler). Matches native-parity event naming.
  - name: input
    detail: 'null'
    description: Fired on the same tick as change (same-tick pair; UIIndicatorElement emits both). Platform parity for listeners that prefer input.

slots:
  - name: default
    optional: true
    description: Optional label — light-DOM text/nodes placed next to the pill track (the unnamed/default slot). Absent ⇒ bare pill. `<ui-switch>Wi-Fi</ui-switch>` is the ergonomic pattern; the label is associated with the switch via element proximity, not a `for` link.

parts: []                # light-DOM host — no shadow parts

customStates:            # :state() hooks the stylesheet keys off — set via internals.states by UIIndicatorElement.connected()
  - checked              # the ON state: `internals.states.add('checked')` when checked=true; drives the track colour + thumb slide in switch.css

face:
  formAssociated: true   # a FACE form-associated control — value + validity participate via ElementInternals (ADR-0013)
  value: checked         # the prop whose boolean drives the form submission (formValue() = checked ? value : null)
  validity: ''           # no constraint raised by the switch itself (a required switch is edge-case; no valueMissing in UIIndicatorElement base)

aria:
  role: switch           # set on the HOST via internals.role = 'switch' (UIIndicatorElement.connected()); ARIA for the ON/OFF widget
  roleSource: internals  # FACE: via ElementInternals, never a host role/aria-* attribute
  labelSource: aria-label / aria-labelledby   # label the host externally; the default slot child is NOT an associated label
  disabledState: internals.ariaDisabled       # effectiveDisabled (own || form-disabled) mirrored to internals.ariaDisabled by UIIndicatorElement

keyboard:
  - keys: Space
    action: Toggles the checked state on keyup (pressActivation trait); emits change + input.
  - keys: Enter
    action: Does NOT toggle — Enter is suppressed by UIIndicatorElement (platform checkbox/switch parity; Enter activates forms, not toggles).

geometry:
  sizeClass: indicator
  blockSize: var(--ui-switch-box)                               # the widget box height = --ui-compact-{size} (ADR-0041 widget ramp)
  inlineSize: calc(var(--ui-switch-box) * 1.8)                 # the pill track ≈ 1.8× the box (density-invariant)
  radius: calc(var(--ui-switch-box) / 2)                       # pill radius = box/2 (the track border-radius)
  thumbSize: calc(var(--ui-switch-box) - 2 * var(--ui-widget-inset))   # ADR-0041 cl.3: thumb = box − 4px

forcedColors: A `@media (forced-colors: active)` block renders the track as Canvas + ButtonText border (unchecked) or Highlight + Highlight border (checked), and the thumb as ButtonText / HighlightText. The `:focus-visible` ring survives via `--c-focus-ring → Highlight` (the token layer's FC mapping) without a per-control rule.
---

# ui-switch

`ui-switch` is the FACE **switch** indicator control (`extends UIIndicatorElement`, ADR-0013): a pill
track + sliding thumb representing a boolean ON/OFF value. The control is form-associated (participates
in `<form>` submission via `ElementInternals`) and carries `role="switch"` through `internals`. The host
carries **no** `role`/`aria-*` attribute.

```html
<ui-switch></ui-switch>
<ui-switch checked></ui-switch>
<ui-switch size="sm">Wi-Fi</ui-switch>
```

## Anatomy

The host is an `inline-flex` row: the pill track (`::before`) is the first item; any slotted label text
follows in the default slot. The TRACK (`::before`) is a pill — `block-size = --ui-compact-{size}` (the
ADR-0041 widget-box ramp, `[size]×[scale]`), `inline-size ≈ 1.8×` the box, `border-radius = box/2`. The
THUMB (`::after`) is a circle inset `--ui-widget-inset` (2px) on all sides — **thumb = box − 4px**
(ADR-0041 cl.3, the 2px inset law). On `:state(checked)` the thumb translates `0.8×box` to the right,
landing with the identical 2px inset from the track end (the geometry is symmetric). Density-invariant:
neither the box nor the inset rides `--ui-density`.

## States + colour

Unchecked: muted `--c-neutral-outline-variant` track, near-white thumb. Checked: `--c-primary` track
(`--c-primary-on-primary` thumb). Disabled: `--c-neutral-surface-high` track, muted ink thumb — the
host is pointer-inert (`pointer-events: none`), so `:hover` never lifts the state. A `:focus-visible`
ring (keyboard-only, ADR-0009) uses the fleet `--c-focus-ring` / `--ui-focus-ring-*` tokens.

## Form participation

`checked` is the primary state. When `checked=true`, `formValue()` returns `value` (default `'on'`);
when `checked=false`, it returns `null` (unchecked contributes no entry). This matches the HTML checkbox
semantics (ADR-0013). `required` is inherited but raises no validity constraint in the current base
(edge-case: requiring a switch ON is not a common pattern).

## Forced-colors

Canvas + ButtonText border on the track unchecked; Highlight on the track checked; ButtonText thumb /
HighlightText thumb checked. The `:focus-visible` ring resolves to the system Highlight via the token
layer's FC mapping — no per-control forced-colors rule needed for the ring.
