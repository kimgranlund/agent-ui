---
# radio.md frontmatter — the attributes-as-API descriptor for ui-radio (ADR-0004). The machine-checkable
# public surface lives HERE (frontmatter); the prose below the fence is the /site doc. The `attributes[]`
# block MUST mirror radio.ts `static props` (the UIIndicatorElement.indicatorProps — the ...UIFormElement.formProps
# spread: name/disabled/required — plus checked/value) — the contract↔props trip-wire and the frontmatter
# schema both target this fence. Field set per .claude/docs/plan.md §10 / ADR-0004.
tag: ui-radio
tier: indicator        # geometry size-class (Indicator band — widget box, not full control height; geometry.md)
extends: UIIndicatorElement  # Indicator-class base (ADR-0042) — boolean form value + checked-state machine + pressActivation toggle
# marginal: ui-radio adds 129 B gz (423 B min) to the self-defining ui-* family above ui-checkbox+switch (UIIndicatorElement shared from checkbox; UIRadioElement contributes the grouped() hook + static role='radio') — within the per-control ≤ ~2 kB tier budget (plan §10)

attributes:            # attributes-as-API — mirrors radio.ts static props (UIIndicatorElement.indicatorProps)
  - name: checked
    type: boolean
    default: 'false'
    reflect: true      # reflects so [checked] CSS attribute selector + JS-set values drive the dot glyph + ariaChecked
  - name: value
    type: string
    default: 'on'
    reflect: true      # reflects (HTML checkbox semantics: the submitted string when checked; default 'on')
  - name: size
    type: enum
    values: [sm, md, lg]
    default: md
    reflect: true      # reflects so [size] CSS selectors drive --ui-radio-box tier (ADR-0041); inherited from UIIndicatorElement
  - name: name
    type: string
    default: ''
    reflect: true      # the form field name (FACE; UIFormElement.formProps) — reflects for native form-submission parity
  - name: disabled
    type: boolean
    default: 'false'
    reflect: true      # reflects; pointer-inert + removed from tab order; effectiveDisabled = own || form-disabled
  - name: required
    type: boolean
    default: 'false'
    reflect: true      # reflects; drives valueMissing on the individual radio (group-owned validity is preferred)

properties:            # IDL beyond attributes-as-API
  - name: form
    description: The owning <form>, or null (delegates to ElementInternals.form).
  - name: validity
    description: The live ValidityState (delegates to ElementInternals.validity).
  - name: validationMessage
    description: The current validation message (empty when valid).
  - name: willValidate
    description: Whether the control is a candidate for constraint validation.
  - name: checkValidity
    description: Method — runs constraint validation.
  - name: reportValidity
    description: Method — like checkValidity, additionally reporting the problem to the user.

events:
  - name: input
    detail: 'null'
    description: Fired on each toggle (unchecked → checked) via click or Space. Same-tick as change. Suppressed when inside a ui-radio-group and the radio is already checked (the group guard prevents deselection clicks from firing).
  - name: change
    detail: 'null'
    description: Fired on commit (click or Space toggle; unchecked → checked). Bubbles to the parent ui-radio-group, where it is consumed and re-emitted as the group's own change event.

slots:
  - name: default
    optional: true
    description: Optional label — the default/unnamed children (the accessible text that follows the indicator circle in the inline-flex row). A bare radio with no slot content renders just the circle.

parts: []              # light-DOM, no shadow parts

customStates:          # :state() hooks — set via internals.states, never host attributes (FACE)
  - checked            # set when checked=true; drives the dot glyph via :state(checked) + the [checked] attribute mirror

face:
  formAssociated: true   # a FACE form-associated control (ADR-0013); each radio is form-associated individually
  value: checked         # the form value is checked ? this.value : null (platform checkbox semantics, UIIndicatorElement.formValue)
  validity: valueMissing # individual radio raises valueMissing only when required && !checked (group-level validity is preferred)

aria:
  role: radio            # set via internals.role in UIIndicatorElement.connected() — never a host role attribute (FACE)
  roleSource: internals
  labelSource: textContent  # the default slot label text is the accessible name
  disabledState: internals.ariaDisabled  # effectiveDisabled (own || form-disabled); ADR-0010 channel via UIIndicatorElement

keyboard:
  - keys: Space
    action: Toggle checked (unchecked → checked). In a ui-radio-group, only unchecked → checked is allowed (the group guard blocks clicking an already-checked radio); the group selection commit runs after.
  - keys: Enter
    action: Does NOT toggle (platform checkbox parity — Enter is suppressed by the UIIndicatorElement Enter guard). In a radio group, arrow keys handle navigation.
  - note: Inside a ui-radio-group, Arrow keys (Up/Down) + Home/End rove focus AND selection (selection-follows-focus; ARIA APG radio-group pattern). Tab moves out of the group. Only the focused (checked) radio is tabindex=0; others are tabindex=-1 (managed by rovingFocus on the group).

geometry:
  sizeClass: indicator
  blockSize: var(--ui-compact-md)   # the indicator box height = --ui-compact-{size} (widget ramp, ADR-0041)
  inlineSize: var(--ui-compact-md)  # the indicator box width = same (square circle)
  dotInset: 22% of box (box-shadow inset = 22% of diameter → dot fills ~44% of circle)
  labelGap: var(--ui-radio-gap)     # gap between circle and label slot (font/2 × density)

forcedColors: A `@media (forced-colors: active)` block keeps the idle border (ButtonText) and the checked dot (forced-color-adjust on ::before preserves the inset box-shadow as ButtonText ink on Canvas). The focus ring survives via --md-sys-color-focus-ring → Highlight.
---

# ui-radio

`ui-radio` is the radio-button leaf of the **Indicator** class — a FACE form-associated control that extends
`UIIndicatorElement` with `role='radio'` and a **circular dot glyph**. It is designed to be used inside a
`ui-radio-group` container, which owns single-selection exclusivity, roving-focus keyboard navigation, and
the group's form value.

```html
<ui-radio-group name="size" required>
  <ui-radio value="sm">Small</ui-radio>
  <ui-radio value="md">Medium</ui-radio>
  <ui-radio value="lg">Large</ui-radio>
</ui-radio-group>
```

## Anatomy

The host is an **inline-flex row**: a circular `::before` pseudo-element (the indicator box, sized to
`--ui-compact-{size}`) followed by any default-slot content (the optional label text). The **dot** appears as
an **inset `box-shadow`** on `::before` when checked — no extra element needed, and the glyph tracks the box
size automatically via the 22%-inset law (`dot = 44% of the diameter`).

## Group coordination

Inside a `ui-radio-group`, `grouped()` registers a **capture-phase click guard**: if the radio is already
checked, the click is stopped before it reaches the base toggle — radio buttons cannot deselect themselves,
only be replaced. For unchecked radios, the base toggle runs normally (sets `checked=true`, emits `input` +
`change`); the group's delegated `change` listener then enforces exclusivity and updates the group form value.

Arrow keys (delegated to the group) move focus AND selection simultaneously (selection-follows-focus, ARIA APG
radio-group pattern): `rovingFocus` on the group handles the `onMove → #commit` path.

## Standalone use

Without a `ui-radio-group`, `ui-radio` behaves like a boolean checkbox (click toggles `checked`). This is
valid for single-item "accept" patterns, but lacks a form-value owner for multi-choice forms; prefer the group.

## Sizes

`size` repoints the box from the `--ui-compact-{sm/md/lg}` widget ramp (ADR-0041). An ancestor `[scale]`
automatically re-tables the compact tokens (ADR-0038 — explicit per-scale lookup in `dimensions.css`), so the
radio box tracks scale without any per-control `[scale]` rule.
