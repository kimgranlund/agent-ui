---
# slider-multi.md frontmatter — the attributes-as-API descriptor for ui-slider-multi (ADR-0004). The
# machine-checkable public surface lives HERE (frontmatter); the prose below the fence is the /site doc.
# The `attributes[]` block MUST mirror UISliderMultiElement.props — the contract↔props trip-wire in
# slider-multi.test.ts and the frontmatter schema (validateComponentDescriptor) both target this fence.
# Field set per .claude/docs/plan.md §10 / ADR-0004; form participation per ADR-0013; base per ADR-0042/0041.
tag: ui-slider-multi
tier: range           # geometry size-class (Range band — widget box + fill + dual thumbs; geometry.md)
extends: UIRangeElement   # the Range base (ADR-0042); UISliderMultiElement → UIRangeElement → UIFormElement
# marginal: ui-slider-multi adds 893 B gz (5183 B min) to the self-defining ui-* family above ui-slider (the delta of `npm run size`'s components barrel with vs. without this control's export, tree-shaken — UIRangeElement is already in the bundle via ui-slider; this leaf adds the dual-thumb thumb builder + lo/hi normaliser + nearer-thumb-grabs logic) — within the per-control ≤ ~2 kB tier budget (plan §10); the family total stays gated each run by `npm run size` (scripts/measure-size.mjs)

attributes:           # attributes-as-API — mirrors UISliderMultiElement.props (range params first, then formProps)
  - name: min
    type: number
    default: 0
    reflect: true     # reflects so the [min] attribute stays observable and drives CSS via attribute presence
  - name: max
    type: number
    default: 100
    reflect: true     # reflects; the range upper boundary (inclusive)
  - name: step
    type: number
    default: 1
    reflect: true     # reflects; ≤ 0 = continuous (no snap)
  - name: value
    type: number
    default: 0
    reflect: true     # inherited from UIRangeElement.props (base single-value seam); slider-multi does not
                      # activate the base's value normaliser/ARIA/keyboard — it uses valueLo/valueHi instead.
                      # Present here so the contract↔props trip-wire (compareDescriptorToProps) does not flag DRIFT.
  - name: size
    type: enum
    values: [sm, md, lg]
    default: md
    reflect: true     # reflects so the [size] compact-widget-ramp repoint in slider-multi.css applies to JS-set values
  - name: name
    type: string
    default: ''
    reflect: true     # the form field name (FACE; UIFormElement.formProps); reflects (native parity)
  - name: disabled
    type: boolean
    default: false
    reflect: true     # reflects; pointer-inert via CSS [disabled]; effectiveDisabled = own || form-disabled channel
  - name: required
    type: boolean
    default: false
    reflect: true     # reflects; carried from formProps (range sliders are always value-bearing so required is informational)
  - name: valueLo
    type: number
    default: 0
    reflect: true     # reflects so attribute-driven initial lo values round-trip to JS
  - name: valueHi
    type: number
    default: 100
    reflect: true     # reflects; attribute-driven hi round-trips; lo ≤ hi is enforced by the normalization effect

properties:           # IDL beyond attributes-as-API
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
    description: Fired on each live change to valueLo or valueHi during a pointer drag or keyboard step. The pair is already updated when the event fires.
  - name: change
    detail: 'null'
    description: Fired on focusout when either valueLo or valueHi changed since the last focusin baseline. Matches native range-input change semantics (commit on blur).

slots:
  - name: default
    optional: true
    description: Optional label content — slotted children after the rail in light DOM. Absent by default; the rail + thumbs are the primary visual anatomy.

parts: []             # light-DOM host; the rail/fill/thumbs are JS-managed light-DOM children (not declared parts)

customStates: []      # no custom states; disabled is a reflected attribute (CSS [disabled] covers it)

face:
  formAssociated: true   # FACE form-associated control — value pair + validity participate via ElementInternals (ADR-0013)
  value: valueLo,valueHi # submitted as FormData with two entries named by `name` (the [lo, hi] pair)
  validity: always valid  # range sliders are always value-bearing; no constraint validation (override formValidity() for custom)

aria:
  role: group          # host internals.role='group' — a composite of two slider foci; NEVER a host role= attribute (FACE)
  roleSource: internals
  labelSource: aria-label or associated <label>  # no default accessible name; consumers must provide
  children:
    - element: .thumb[data-thumb=lo]
      role: slider      # each thumb carries role='slider' as a direct HTML attribute (light-DOM child, not host internals)
      aria-valuenow: valueLo (clamped)
      aria-valuemin: min
      aria-valuemax: valueHi (current hi — the lo thumb cannot exceed hi)
      aria-valuetext: valueLo (clamped, stringified — mirrors aria-valuenow as a human-readable label)
      aria-label: Low value
    - element: .thumb[data-thumb=hi]
      role: slider
      aria-valuenow: valueHi (clamped)
      aria-valuemin: valueLo (current lo — the hi thumb cannot go below lo)
      aria-valuemax: max
      aria-valuetext: valueHi (clamped, stringified — mirrors aria-valuenow as a human-readable label)
      aria-label: High value

keyboard:
  - keys: ArrowRight, ArrowUp
    action: Focused thumb increments by step. Lo clamps at hi; hi can reach max.
  - keys: ArrowLeft, ArrowDown
    action: Focused thumb decrements by step. Lo can reach min; hi clamps at lo.
  - keys: PageUp
    action: Focused thumb increments by 10×step (large step), clamped at sibling.
  - keys: PageDown
    action: Focused thumb decrements by 10×step, clamped at sibling.
  - keys: Home
    action: Lo thumb → min; Hi thumb → current lo value (hi cannot go below lo).
  - keys: End
    action: Lo thumb → current hi value (lo cannot exceed hi); Hi thumb → max.
  - note: Each thumb is independently focusable (tabindex=0). Disabled removes both thumbs from the tab order. Clicking the rail or a thumb focuses the nearer thumb (the nearer-thumb-grabs rule).

geometry:
  sizeClass: range
  inlineSize: 100%    # fills the available inline width (the rail flex:1 within the host's flex row)
  blockSize: var(--ui-slider-multi-box)   # the compact widget-box ramp step (ADR-0041)
  thumbSize: calc(--ui-slider-multi-box - 4px)    # box − 2×--ui-widget-inset (ADR-0041 cl.3: 2px-inset law)
  boxRamp: --ui-compact-{size}           # 14/16/18 px at ui-md scale for sm/md/lg (ADR-0041 clause 2)

forcedColors: A `@media (forced-colors: active)` block maps the rail to a Canvas fill + ButtonText border; the fill to Highlight; the thumbs to ButtonFace + ButtonText border. forced-color-adjust:none on all three elements preserves the explicit system-colour assignments so the browser cannot re-override them. The :focus-visible ring resolves to Highlight via --md-sys-color-focus-ring from the token layer (ADR-0009).
---

# ui-slider-multi

`ui-slider-multi` is a FACE **form-associated** Range-class control (`extends UIRangeElement` →
`UIFormElement`, ADR-0042). It carries a `[valueLo, valueHi]` pair — a dual-thumb range selector —
participates in form submission through `ElementInternals`, and renders its rail, fill, and two thumb
elements entirely in light DOM (no native `<input>`, no shadow DOM).

```html
<ui-slider-multi></ui-slider-multi>
<ui-slider-multi value-lo="20" value-hi="80"></ui-slider-multi>
<ui-slider-multi min="0" max="200" step="10" size="lg"></ui-slider-multi>
<ui-slider-multi disabled></ui-slider-multi>
```

## Value + form participation

`valueLo` and `valueHi` are the form value pair. On submission, both values are appended to a `FormData`
entry keyed by the control's `name` (the standard multi-value form-data shape). Both values are reflected
attributes. The **lo ≤ hi invariant** is enforced in all write paths: a dragged thumb clamps at the
sibling and never swaps identity mid-drag.

## Anatomy

The host is a block-level `flex` row: the `.rail` (thin horizontal bar) is the `flex:1` item. The `.fill`
(the lo→hi active range) is absolutely positioned within the rail using `--value-pct-lo` and
`--value-pct-hi` custom properties set by the JS geometry seam. Each `.thumb` is an absolutely-positioned
circle (`box − 4px`) on the rail. The **nearer-thumb-grabs** rule: a pointerdown anywhere on the rail
selects the closer thumb and focuses it.

## Sizes

`size` selects from the widget-box ramp (`sm` · `md` (default) · `lg`), sourcing `--ui-compact-{size}`
(ADR-0041: 14 · 16 · 18 px at the default `ui-md` scale). The thumb is always `box − 4px` (the
ADR-0041 2px-inset law). An ancestor `[scale]` attribute re-tables the ramp for its subtree.

## Accessibility

The host carries `role="group"` through `ElementInternals` (never a host attribute). Each thumb div
carries `role="slider"` with its own `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, and `aria-label`
("Low value" / "High value"). The lo thumb's `aria-valuemax` is constrained to `valueHi`; the hi
thumb's `aria-valuemin` is constrained to `valueLo`. Both thumbs are keyboard-focusable (tabindex=0,
disabled removes both from the tab order). The focus ring (`:focus-visible`, ADR-0009) appears on
the focused thumb.
