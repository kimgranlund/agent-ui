---
# amount-picker.md frontmatter: the attributes-as-API descriptor for ui-amount-picker (ADR-0004; T-0196 Design, the
# fork sheet Kim approved 2026-10-20). The machine-checkable public surface lives here; the prose below the fence is
# the /site doc. `attributes[]` is the generation source for amount-picker.props.gen.ts (ADR-0173) and its order is
# pinned by the dogfood fleet row. The contract<->props trip-wire (amount-picker-descriptor.test.ts) targets this fence.
tag: ui-amount-picker
description: Picks one bounded number with minus and plus, optional preset chips and an optional slider, shows it as a number, a currency amount or a unit amount, and commits it once.
tier: pattern           # geometry size-class: the Pattern band, control-height rows (T-0196 Design, Three axes)
extends: UIFormElement  # value-bearing (FACE) but not a Range: UIRangeElement would force role=slider on the host
uses:
  - ui-glyph
  - ui-slider
# marginal: not yet measured; measured at the fleet size gate (npm run size)

attributes:             # attributes-as-API, the generation source for amount-picker.props.gen.ts
  - name: value
    type: number
    default: 0
    reflect: true       # the FACE value, clamped to [min, max] and snapped to step on every write (normalizeRangeValue)
    description: The picked number. Clamped to min and max and snapped to step on every write; the form value is its string.
  - name: min
    type: number
    default: 0
    reflect: true
    description: The lowest value. At min the decrease button is disabled.
  - name: max
    type: number
    default: 100
    reflect: true
    description: The highest value, always reachable exactly. At max the increase button is disabled.
  - name: step
    type: number
    default: 1
    reflect: true       # <= 0 is continuous (clamp only); minus and plus then move by 1
    description: The step minus, plus and the arrow keys move by, and the grid the value snaps to.
  - name: presets
    type: json          # number[], JSON-string attribute form
    default: ''         # the LIVE default is `[]`; `String([])===''` is the bijection form (the result-card.md stats row precedent)
    reflect: false      # NOT reflected; a JSON-string attribute round-trips through the codec, not setAttribute
    codec: { import: './amount-picker-model.ts', name: 'presetsProp' }  # malformed JSON falls back to [], never throws; non-finite entries dropped, sorted, deduped; out-of-bounds entries are dropped at render
    description: Preset values drawn as chips under the stepper. A chip reads selected only while the value equals it.
  - name: slider
    type: boolean
    default: false
    reflect: true
    description: Shows a composed ui-slider under the stepper, for ranges of more than about 20 steps.
  - name: currency
    type: string
    default: ''
    reflect: true       # ui-text-field's exact meaning: an ISO 4217 code
    description: An ISO 4217 code. Non-empty formats the readout and the chips as a currency amount; wins over unit.
  - name: unit
    type: string
    default: ''
    reflect: true       # ui-text-field's exact meaning: a CLDR unit id
    description: A CLDR unit id. Non-empty, with no currency, formats the readout and the chips with the short unit label.
  - name: label
    type: string
    default: ''
    reflect: true       # label reflects fleet-wide (TKT-0069 item 2)
    description: The visible label above the stepper and the accessible name of the group.
  - name: actionName
    type: string
    default: ''
    reflect: false
    attribute: action-name  # the BoardGrid and service-card kebab precedent
    description: The action the commit button fires. Empty renders no commit button.
  - name: actionLabel
    type: string
    default: ''
    reflect: false
    attribute: action-label
    description: The commit button text. Empty reads Confirm.
  - name: size
    type: enum
    values: [sm, md, lg]
    default: md
    reflect: true       # reflected so the [size] foundation step applies to JS-set values too
    description: A step on the control ramp (sm, md default, lg); every row of the picker takes it.
  - name: inline
    type: boolean
    default: false
    reflect: true       # ADR-0223 R2: the one sizing opt-out; the host hugs its content under [inline]
    description: The one sizing opt-out (ADR-0223). Absent, the picker fills its block container.
  - name: name
    type: string
    default: ''
    reflect: true       # FACE submission keys the entry by the name content attribute (UIFormElement.formProps)
    description: The form field name.
  - name: disabled
    type: boolean
    default: false
    reflect: true       # effectiveDisabled = own || fieldset/form disabled; disables every part
    description: Disables every part of the picker.
  - name: required
    type: boolean
    default: false
    reflect: true       # informational only: the value is always a number in range (the slider parity)
    description: Informational only; the value is always a number in range, so it raises no constraint.

properties:            # IDL beyond attributes-as-API (no static-props row)
  - name: form
    description: The owning <form>, or null (delegates to ElementInternals.form).
  - name: validity
    description: The live ValidityState (delegates to ElementInternals.validity).
  - name: validationMessage
    description: The current validation message (always empty).
  - name: willValidate
    description: Whether the control is a candidate for constraint validation.
  - name: checkValidity
    description: Method, runs constraint validation (always valid).
  - name: reportValidity
    description: Method, like checkValidity, additionally reporting the problem to the user.

events:
  - name: input
    detail: 'null'
    description: Fired on every live value change by the person (a preset, minus or plus press, an arrow key on the readout, a slider drag step). Never from a programmatic write.
  - name: change
    detail: 'null'
    description: Fired once per settled value change by the person (a preset, minus or plus press, a key step on blur, a slider release). Never from a programmatic write.
  - name: action
    detail: '{ action: string, context: { value: number } }'
    description: Fired once per commit press (the commit button, or Enter on the readout) when actionName is non-empty, after the value is written and any pending change has fired. The value in context is the number, unformatted.

slots: []              # no named slots and no author children: every part is control-created

parts:                 # control-created light-DOM children, built once in connected()
  - name: label
    description: The visible label (`<span data-part="label" aria-hidden="true">`), a duplicate of the group's accessible name. Hidden when `label` is empty or a ui-field owns the label.
  - name: stepper
    description: The control-height row holding decrease, readout and increase.
  - name: decrease
    description: The minus button (`<button data-part="decrease" tabindex="-1" aria-label="Decrease">` with a ui-glyph minus), a sanctioned internal non-value activation. Disabled at min.
  - name: readout
    description: The formatted value (`role="spinbutton"`, `tabindex="0"`), with aria-valuenow, -valuemin, -valuemax and aria-valuetext set to the formatted string. Display only, never a typing surface; it owns the keyboard.
  - name: increase
    description: The plus button (`<button data-part="increase" tabindex="-1" aria-label="Increase">` with a ui-glyph plus). Disabled at max.
  - name: presets
    description: The wrapping row of preset chips. Absent when no preset survives the bounds.
  - name: preset
    description: One preset chip (`<button data-part="preset">`) with `aria-pressed`. The selected chip carries a check glyph before its formatted label.
  - name: glyph
    description: The decorative `<ui-glyph data-part="glyph">` inside a step button or the selected chip, drawn at the glyph box n + 6.
  - name: slider
    description: A composed `<ui-slider data-part="slider" readout-hidden>` named by `label` (aria-label), kept in sync with the value. Absent unless `slider`.
  - name: commit
    description: The commit button (`<button data-part="commit">`), text `actionLabel` or Confirm. Absent when `actionName` is empty.

customStates: []        # no custom state

face:
  formAssociated: true  # FACE form-associated control (ADR-0013)
  value: value          # submitted as String(normalised value)
  validity: ''          # raises no constraint; the value is always a number in [min, max] (the slider parity)

aria:
  role: group             # set via ElementInternals in connected(), never a host attribute
  roleSource: internals
  labelSource: label prop # internals.ariaLabel = label || null
  valueNow: the readout part's aria-valuenow (spinbutton on a control-created part, the ui-text-field editor precedent)
  valueText: the readout part's aria-valuetext, the formatted string ("$25.00", "3 guests")
  nonColorSignifier: The selected chip carries aria-pressed and a check glyph; a bound-side step button is disabled and drops its fill for an outline, so neither state rests on color alone (ADR-0057).

keyboard:
  - keys: ArrowUp / ArrowRight
    action: On the readout, increase by step (clamped to max). Emits input; change on blur. Under dir=rtl ArrowLeft increases instead (T-0540).
  - keys: ArrowDown / ArrowLeft
    action: On the readout, decrease by step (clamped to min). Emits input; change on blur. Under dir=rtl ArrowRight decreases instead.
  - keys: PageUp / PageDown
    action: On the readout, move by 10 steps. Emits input; change on blur.
  - keys: Home / End
    action: On the readout, go to min or max. Emits input; change on blur.
  - keys: Enter
    action: On the readout, fires the commit (change first if the value moved, then action) when actionName is non-empty.
  - note: The readout is the one tab stop of the stepper; decrease and increase are tabindex -1 (the APG spinbutton pattern). Preset chips, the slider and the commit button stay in tab order.
  - note: Disabled is fully inert; the readout leaves the tab order.

geometry:
  sizeClass: pattern
  posture: fill (block-level grid host, ADR-0223 cl.1); `[inline]` = inline-grid and hug
  blockSize: each row is the control height 4n (--md-sys-height), 24px at widget md on an A2UI canvas; size sm and lg give 20 and 28
  stepButton: square 4n, the glyph box n + 6 centred (ADR-0245 cl.3)
  readout: 1fr between the step buttons, tabular numerals, a min inline size from the longest formatted bound
  pills: preset chips and commit are control-height pills (--md-sys-control-radius), label inset 2n - c
  rowGap: var(--ui-amount-picker-gap)   # = --md-sys-group-gutter
  note: No card chrome; the picker sits inside the producer's layout. The slider row is ui-slider's own box.

forcedColors: The step buttons, chips and commit keep a CanvasText border so their boxes survive; the selected chip repaints to Highlight and HighlightText, and a disabled part reads GrayText.
---

# ui-amount-picker

`ui-amount-picker` picks one bounded number with minus and plus, optional preset chips and an optional slider, and commits it once.

It replaces the loose Slider plus Button, the number field and the row of number chips with one node that holds
the value, the bounds, the presets, a formatted readout and one commit. The value stays a number on the wire; only
the readout formats it.

```html
<ui-amount-picker label="Quantity" min="1" max="20" value="4" presets="[1,2,4,8]"
  action-name="add_to_cart" action-label="Add to cart"></ui-amount-picker>
<ui-amount-picker label="Your offer" min="200" max="600" step="10" value="420" currency="USD" slider
  action-name="send_offer" action-label="Send offer"></ui-amount-picker>
```

## Anatomy

In DOM order: the label, the stepper row (decrease, readout, increase), the preset chips, the slider and the
commit button. A part is present only when it has something to show: no `presets` renders no chip row, `slider`
off renders no slider, and an empty `actionName` renders no commit button (a sibling Button can commit instead).

## Value and bounds

`value` is clamped to `min` and `max` and snapped to `step` on every write, the same law ui-slider uses. `max` is
always reachable. At a bound the step button on that side is disabled. A preset outside the bounds is dropped.

## Formatting

The readout, its `aria-valuetext` and the chip labels share one formatter: `currency` (an ISO 4217 code) formats
as a currency amount with that currency's fraction digits, else `unit` (a CLDR unit id) adds the short unit label,
else a plain grouped number. The value, the form value and the action context stay numeric.

## Events

`input` fires on every live change, `change` once per settled change (a press, a key step on blur, a slider
release), and `action` once per commit with `{action, context: {value}}`, after the value is written. None fires
from a programmatic write.

## Accessibility

The host is `role="group"` named by `label`, through `ElementInternals`. The readout is the spinbutton and the
one tab stop of the stepper; minus and plus are skipped by Tab, as in the APG spinbutton pattern.
