---
# slider.md frontmatter — the attributes-as-API descriptor for ui-slider (ADR-0004). The
# machine-checkable public surface lives HERE (frontmatter); the prose below the fence is the /site doc.
# The `attributes[]` block MUST mirror UISliderElement.props (the ...UIRangeElement.props spread:
# name/disabled/required from formProps, plus min/max/step/value/size from Range-specific props) —
# the contract↔props trip-wire in slider.test.ts and the frontmatter schema (validateComponentDescriptor)
# both target this fence. Field set per .claude/docs/plan.md §10 / ADR-0004; form participation per ADR-0013;
# geometry per ADR-0042 / ADR-0041; Range-class base per range-element.lld.md.
tag: ui-slider
tier: indicator        # geometry size-class (Indicator band — widget box, same ramp as checkbox/switch; geometry.md)
extends: UIRangeElement  # the Range base (range-element.lld.md); UISliderElement → UIRangeElement → UIFormElement
# marginal: ui-slider adds 770 B gz (3119 B min) to the self-defining ui-* family (the delta of `npm run size`'s components barrel with vs. without this control's export, tree-shaken — it + UIRangeElement + the pointer/keyboard interaction) — within the per-control ≤ ~2 kB tier budget (plan §10); the family total stays gated each run by `npm run size` (scripts/measure-size.mjs)

attributes:            # attributes-as-API — mirrors UISliderElement.props (range-specific first, then formProps)
  - name: value
    type: number
    default: 0         # String(0) = '0'; the current numeric value, clamped to [min,max] and snapped to step
    reflect: true      # reflects so [value] is observable as an attribute; prop↔attribute round-trip
  - name: min
    type: number
    default: 0         # String(0) = '0'; lower bound of the range
    reflect: true      # reflects; attribute-driven construction sets the lower bound
  - name: max
    type: number
    default: 100       # String(100) = '100'; upper bound of the range
    reflect: true      # reflects; attribute-driven construction sets the upper bound
  - name: step
    type: number
    default: 1         # String(1) = '1'; snap increment (≤ 0 = continuous, no snap)
    reflect: true      # reflects; attribute-driven construction sets the step
  - name: size
    type: enum
    values: [sm, md, lg]
    default: md        # String('md') = 'md'; selects --ui-compact-{size} via [size] in slider.css
    reflect: true      # reflects so the [size] widget-box repoint in slider.css applies to JS-set values too
  - name: name
    type: string
    default: ''        # String('') = ''; the form field name (FACE; UIFormElement.formProps); reflects (native parity)
    reflect: true      # reflects; FACE submission keys the entry by the name CONTENT attribute
  - name: disabled
    type: boolean
    default: false     # String(false) = 'false'; reflects; pointer-inert via CSS [disabled]
    reflect: true      # reflects; effectiveDisabled = own || fieldset/form-disabled channel
  - name: required
    type: boolean
    default: false     # String(false) = 'false'; reflects (inherited from UIFormElement.formProps)
    reflect: true      # reflects; INFORMATIONAL ONLY — raises no constraint (see face.validity below; matches native <input type=range>, which the HTML spec exempts from `required`)

properties:            # IDL beyond attributes-as-API (no static-props row)
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
    description: Fired on each live value change — keyboard step (ArrowLeft/Right/Up/Down, PageUp/Down, Home/End) or pointer drag (each pointermove that changes the snapped value). Matches native <input type=range> input semantics.
  - name: change
    detail: 'null'
    description: Fired on blur when value has moved since focus (the base's commit-on-blur contract). Matches native <input type=range> change semantics — commit on release/blur, not on every live change.

slots: []              # light-DOM host-as-block; no child slot (slider is a bare value widget — no label slot)

parts: []              # no parts — rail and thumb paint via ::before/::after on the host

customStates: []       # ui-slider does not arm any :state() hooks (no binary checked/selected state)

face:
  formAssociated: true   # FACE form-associated control — value participates via ElementInternals (ADR-0013)
  value: value           # submitted as String(normalised value) (formValue() in UIRangeElement)
  validity: '' # UIRangeElement raises no constraint (formValidity() is the UIFormElement default, always-valid); a range's value is never "missing" — it is always a number in [min,max] (native <input type=range> parity, whose spec explicitly exempts `required`). DRIFT CORRECTION 2026-07-10: a prior revision of this fence claimed "required slider with value=0 may raise valueMissing", a contract that was never implemented and does not match native range-input semantics — corrected, not implemented (see the CHANGELOG/ADR trail for the G7 labelling/error-leg sweep this was caught in).

aria:
  role: slider         # set via ElementInternals.role = 'slider' in UIRangeElement.connected(); never a host attribute
  roleSource: internals
  labelSource: aria-label / aria-labelledby  # no label slot; the host page wires the accessible name
  valueNow: internals.ariaValueNow           # tracks the normalised current value as a string
  valueMin: internals.ariaValueMin           # tracks min as a string
  valueMax: internals.ariaValueMax           # tracks max as a string

keyboard:
  - keys: ArrowRight / ArrowUp
    action: Increment value by step (clamped to max). Emits input. focus → arrow → blur emits change.
  - keys: ArrowLeft / ArrowDown
    action: Decrement value by step (clamped to min). Emits input.
  - keys: PageUp
    action: Increment value by largeStep (10×step, clamped to max). Emits input.
  - keys: PageDown
    action: Decrement value by largeStep (10×step, clamped to min). Emits input.
  - keys: Home
    action: Set value to min exactly. Emits input.
  - keys: End
    action: Set value to max exactly (always reachable regardless of step). Emits input.
  - note: Focusable by default (tabindex=0 from the tabbable trait, ADR-0010). Disabled removes the host from the tab order and ignores all keyboard input.

geometry:
  sizeClass: indicator
  blockSize: var(--ui-slider-box)     # widget box height = --ui-compact-{size} (ADR-0041)
  inlineSize: 100%                    # stretches to its container (block element, no intrinsic inline-size)
  thumbSize: box − 4px                # circle thumb = --ui-slider-box − 2×--ui-widget-inset (ADR-0041 cl.3)
  railHeight: --ui-slider-rail-height # 3px constant, not derived from the widget box

forcedColors: A `@media (forced-colors: active)` block maps the rail to a Highlight/ButtonText gradient (fill/track) and the thumb to a Canvas circle with a Highlight border. Both pseudo-elements carry `forced-color-adjust: none` to preserve the explicit system-colour mappings. The :focus-visible ring is free via --md-sys-color-focus-ring → Highlight from the token layer (ADR-0009).
---

# ui-slider

`ui-slider` is a FACE **form-associated** Indicator-class Range control (`extends UIRangeElement` →
`UIFormElement`, ADR-0042). It carries a numeric `value` within `[min, max]` snapped to `step`, participates
in form submission through `ElementInternals`, and paints its rail and thumb entirely in CSS (no native
`<input>`, no shadow DOM). Pointer drag and keyboard navigation both update `value`.

```html
<ui-slider></ui-slider>
<ui-slider min="0" max="100" value="50"></ui-slider>
<ui-slider step="10" size="sm" aria-label="Volume"></ui-slider>
<ui-slider disabled></ui-slider>
```

## Value + form participation

`value` is a reflected numeric prop, clamped to `[min, max]` and snapped to `step` on every set. The form
submission value is `String(normalised_value)`. `required` is inherited but raises no validity constraint —
a range's value is always a number (never "missing"), matching native `<input type="range">`, which the
HTML spec exempts from `required` entirely.

## Anatomy

The host is a `block` container with `block-size = --ui-compact-{size}` (the widget-box ramp). The **rail**
(`::before`) is a thin horizontal bar; its `linear-gradient` background paints the fill (primary) from the
left up to `--value-pct%` and the neutral track beyond. The **thumb** (`::after`) is a circle `box − 4px`
(the 2px-inset law, ADR-0041 cl.3) centred on the `--value-pct%` position along the host, painted in **two
layers**: a 2px **ring** border (`--ui-slider-thumb-ring`, `box-sizing: border-box` — the ring eats into
the interior fill, so the outer diameter stays `box − 4px`) around the interior **fill**
(`--ui-slider-thumb`). The ring covers the thumb-vs-page-surface contrast dimension the fill alone can't
(ADR-0094, extending ADR-0059).

## Colour

Four slider-scoped colour custom properties theme the paint (declared in `slider.css`'s token block,
overridable per subtree): `--ui-slider-rail` (→ `--md-sys-color-neutral-track`, the solid state-bearing
track role, ADR-0059) · `--ui-slider-fill` (→ `--md-sys-color-primary`) · `--ui-slider-thumb` (the thumb's
interior fill, → `--md-sys-color-neutral-surface-brightest`) · `--ui-slider-thumb-ring` (the thumb's 2px
ring border, → `--md-sys-color-neutral-on-surface`, the page-ink role covering the thumb-vs-page-surface
SC 1.4.11 dimension; ADR-0094). `[disabled]` mutes all four to inactive neutral roles (SC 1.4.11-exempt).
The thumb's contrast contract is three-dimensional — fill, rail, and page surface, in both schemes
(ADR-0094): a repoint of any of these tokens must clear all three; the slider browser legs are the
standing gate.

## Interaction

Pointer drag: `pointerdown` on the host starts a drag; `pointermove` maps the pointer's X coordinate along
the track rect to a snapped `value`; `pointerup`/`lostpointercapture` commits. Each value change emits
`input`; `change` fires on blur when value moved since focus (the commit-on-blur contract).

Keyboard: Arrow ±`step`, Page ±10×`step`, Home/End → exact min/max. All keyboard steps emit `input`; blur
after a net move emits `change`.

## Sizes

`size` selects from the widget-box ramp (`sm` · `md` (default) · `lg`), sourcing `--ui-compact-{size}`
(ADR-0041: 14 · 16 · 18 px at the default `ui-md` scale). An ancestor `[scale]` attribute re-tables the
ramp for its subtree.

## Accessibility

`role="slider"` is applied through `ElementInternals` (never a host attribute). `ariaValueNow/Min/Max`
track the live normalised value, min, and max. No label slot — wire `aria-label` or `aria-labelledby`
from the host page.
