---
# checkbox.md frontmatter — the attributes-as-API descriptor for ui-checkbox (ADR-0004). The
# machine-checkable public surface lives HERE (frontmatter); the prose below the fence is the /site doc.
# The `attributes[]` block MUST mirror UICheckboxElement.props (the ...UIIndicatorElement.props spread:
# name/disabled/required/checked/value, plus size) — the contract↔props trip-wire in checkbox.test.ts
# and the frontmatter schema (validateComponentDescriptor) both target this fence. Field set per
# .claude/docs/plan.md §10 / ADR-0004; form participation per ADR-0013; base behaviour per ADR-0042 / ADR-0041.
tag: ui-checkbox
tier: indicator        # geometry size-class (Indicator band — widget box, not full control height; geometry.md)
extends: UIIndicatorElement  # the Indicator base (ADR-0042); UICheckboxElement → UIIndicatorElement → UIFormElement
# marginal: ui-checkbox adds 286 B gz (1405 B min) to the self-defining ui-* family as the FIRST Wave-1 Indicator control (the delta of `npm run size`'s components barrel with vs. without the Wave-1 Indicator family's first entry — includes UIIndicatorElement + the pressActivation trait; the remaining three Indicator controls pay incremental-only marginals above this shared base) — within the per-control ≤ ~2 kB tier budget (plan §10); the family total stays gated each run by `npm run size` (scripts/measure-size.mjs)

attributes:            # attributes-as-API — mirrors UICheckboxElement.props (indicator-specific first, then formProps)
  - name: checked
    type: boolean
    default: false
    reflect: true      # reflects so [checked] drives CSS and is observable as an attribute; attribute ↔ prop round-trip
  - name: value
    type: string
    default: on        # HTML checkbox semantics: 'on' when absent; submitted only when checked (formValue())
    reflect: true      # reflects (native checkbox parity — the value attribute stays observable)
  - name: size
    type: enum
    values: [sm, md, lg]
    default: md
    reflect: true      # reflects so the [size] widget-box repoint in checkbox.css applies to JS-set values too
  - name: name
    type: string
    default: ''
    reflect: true      # the form field name (FACE; UIFormElement.formProps); reflects (native parity)
  - name: disabled
    type: boolean
    default: false
    reflect: true      # reflects; pointer-inert via CSS [disabled]; effectiveDisabled = own || form-disabled channel
  - name: required
    type: boolean
    default: false
    reflect: true      # reflects; a required unchecked checkbox → valueMissing validity flag

properties:            # IDL beyond attributes-as-API (no static-props row)
  - name: indeterminate
    description: Property-only (NOT reflected, NOT submitted). When true, ariaChecked="mixed" and :state(indeterminate) paints the dash glyph; `checked` retains its boolean and still drives formValue(). Clears on the next click/Space toggle (platform checkbox parity). Backed by a private signal so the checked-state effect (LLD-C2) re-runs on every change.
  - name: form
    description: The owning <form>, or null (delegates to ElementInternals.form).
  - name: validity
    description: The live ValidityState (delegates to ElementInternals.validity).
  - name: validationMessage
    description: The current validation message (empty when valid).
  - name: willValidate
    description: Whether the control is a candidate for constraint validation.
  - name: checkValidity
    description: Method — runs constraint validation, firing an invalid event when invalid.
  - name: reportValidity
    description: Method — like checkValidity, additionally reporting the problem to the user.

events:
  - name: input
    detail: 'null'
    description: Fired on toggle (click or Space keyup) after checked is flipped. The form value is already updated when the event fires. Matches native <input type=checkbox> input semantics.
  - name: change
    detail: 'null'
    description: Fired on the same tick as input, immediately after it (platform checkbox change-on-toggle semantics).

slots:
  - name: label
    optional: true
    description: Optional label text — the default/unnamed children, placed after the box in the inline-flex row (the anatomy's label position, ADR-0006/0012). Absent ⇒ a bare box (icon-only pattern; add aria-label or associate a <label> for accessibility).

parts: []              # light-DOM host-as-flex; no parts created from TS (box and glyph paint via ::before/::after)

customStates:          # :state() hooks the checkbox.css keyed off — set via internals.states in UIIndicatorElement
  - checked            # armed when checked=true (and the control is NOT indeterminate)
  - indeterminate      # armed when indeterminate=true (overrides checked for ariaChecked="mixed")

face:
  formAssociated: true   # FACE form-associated control — value + validity participate via ElementInternals (ADR-0013)
  value: value           # submitted value when checked=true (the `value` prop string); null when unchecked (formValue())
  validity: valueMissing # required && !checked → valueMissing (UIFormElement constraint)

aria:
  role: checkbox       # set via ElementInternals.role from static role='checkbox'; never a host role/aria-* attribute
  roleSource: internals
  labelSource: slotted textContent / aria-label  # the label slot is the accessible name; bare-box usage needs aria-label
  checkedState: internals.ariaChecked — true / false / mixed  # 'mixed' when indeterminate, overrides checked

keyboard:
  - keys: Space
    action: Activates on keyup (pressActivation trait) — clears indeterminate if set, then toggles checked; emits input + change.
  - keys: Enter
    action: Does NOT toggle — platform checkbox parity. pressActivation fires host.click() on Enter keydown, but UIIndicatorElement's Enter-suppressor guard intercepts it.
  - note: Focusable by default (tabindex=0 from the tabbable trait, ADR-0010). Disabled removes the host from the tab order.

geometry:
  sizeClass: indicator
  inlineSize: var(--ui-checkbox-box)   # square widget box — the Indicator-class lever (ADR-0041)
  blockSize: var(--ui-checkbox-box)
  boxRamp: --ui-compact-{size}          # 14/16/18 px at ui-md scale for sm/md/lg (ADR-0041 clause 2)
  radius: calc(--ui-checkbox-box / 5)  # proportional slight rounding (~3px at 16px default)

forcedColors: A `@media (forced-colors: active)` block maps unchecked to ButtonText border on ButtonFace; checked/indeterminate to Highlight fill with HighlightText glyph. The :focus-visible ring is free via --md-sys-color-focus-ring → Highlight from the token layer (ADR-0009).
---

# ui-checkbox

`ui-checkbox` is a FACE **form-associated** Indicator-class control (`extends UIIndicatorElement` →
`UIFormElement`, ADR-0042). It carries a tri-state `checked`/`indeterminate` boolean value, participates
in form submission and constraint validation through `ElementInternals`, and paints its widget box and
glyph entirely in CSS (no native `<input>`, no shadow DOM).

```html
<ui-checkbox>Accept terms</ui-checkbox>
<ui-checkbox checked>Enabled by default</ui-checkbox>
<ui-checkbox size="sm" disabled>Unavailable</ui-checkbox>
<ui-checkbox value="newsletter">Subscribe</ui-checkbox>
```

## Value + form participation

`checked` drives the form value: `checked=true` submits `value` (default `"on"`); `checked=false`
submits nothing (HTML checkbox semantics, `formValue() → null`). Both `checked` and `value` are reflected
attributes. `required` + unchecked raises a `valueMissing` constraint.

The tri-state `indeterminate` is **property-only** — it never reflects, never submits, and clears on the
next click/Space toggle (platform parity). While `indeterminate=true`, `ariaChecked="mixed"` and the CSS
`:state(indeterminate)` paints the **dash glyph** instead of the tick.

## Anatomy

The host is an `inline-flex` row: the widget box (`::before`) is the first item; any slotted label text
follows in the default slot. A 2px border + slight corner rounding (~box/5) frame the box; clicking or
pressing Space keyup toggles `checked` (clearing `indeterminate` first if set).

## Sizes

`size` selects from the widget-box ramp (`sm` · `md` (default) · `lg`), sourcing `--ui-compact-{size}`
(ADR-0041: 14 · 16 · 18 px at the default `ui-md` scale). An ancestor `[scale]` attribute re-tables the
ramp for its subtree.

## Accessibility

`role="checkbox"` is applied through `ElementInternals` (never a host attribute). `ariaChecked` tracks
`"true"` / `"false"` / `"mixed"` (indeterminate). The label slot provides the accessible name; for a
bare-box pattern add `aria-label` directly or associate a `<label for=…>`. Keyboard focus draws the shared
fleet ring (`:focus-visible`, ADR-0009).
