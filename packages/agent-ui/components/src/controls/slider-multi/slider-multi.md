---
# slider-multi.md frontmatter — the attributes-as-API descriptor for ui-slider-multi (ADR-0004). The
# machine-checkable public surface lives HERE (frontmatter); the prose below the fence is the /site doc.
# The `attributes[]` block MUST mirror UISliderMultiElement.props — the contract↔props trip-wire in
# slider-multi.test.ts and the frontmatter schema (validateComponentDescriptor) both target this fence.
# Field set per .claude/docs/plan.md §10 / ADR-0004; form participation per ADR-0013; base per ADR-0042/0041
# (GH #1141 amendment: label/layout land on the shared UIRangeElement base — range-element.lld.md).
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
  - name: readoutHidden
    type: boolean
    default: false    # String(false) = 'false'; the value readout stays default-ON (byte-identical prior behavior)
    reflect: true     # reflects; GH #1136 — set true to suppress the value readout entirely, incl. at rest (GH #1141 widens this from "never arms on either thumb's input/drag/keyboard" to "never visible, period")
  - name: label
    type: string
    default: ''        # String('') = ''; empty ⇒ no visible label part, no internals.ariaLabel (falls back to author aria-label/aria-labelledby)
    reflect: true      # reflects (TKT-0069 item 2 ruling; matches ui-slider's own label prop, GH #1141 shared base)
  - name: layout
    type: enum
    values: [standard, inline, block]
    default: standard  # label top-left / value top-right ("lo – hi"), one row above the rail
    reflect: true      # reflects so the [layout] grid-template selector in slider-multi.css applies to JS-set values too

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

slots: []             # light-DOM host-as-grid (GH #1141); the pre-#1141 speculative "default" label slot
                      # was never implemented (no real <slot> in slider-multi.ts) — corrected here to match
                      # source; the label is now the real, control-created `label` prop + part below, mirroring
                      # ui-slider exactly (drift found + fixed during the GH #1141 survey, not a new deviation)

parts:                # GH #1141: two control-created light-DOM children (label/value); rail/fill/thumbs
                      # stay JS-managed light-DOM children too (unchanged, not declared `data-part`s)
  - name: label
    description: The visible label (`<span data-part="label" aria-hidden="true">`) — a DUPLICATE of `internals.ariaLabel` (the `label` prop), `aria-hidden` so it never doubles that announcement. `[hidden]` when `label` is empty — its `auto`-sized grid row/column then collapses to zero (slider-multi.css). Positioned per the `layout` prop, matching ui-slider's own three templates.
  - name: value
    description: The live value readout (`<span data-part="value" aria-hidden="true">`) — shows BOTH clamped values as "{lo} – {hi}" (each formatted via the inherited `valueText()` hook). Built once in #buildDOM (idempotent across reconnect). ALWAYS visible at rest (GH #1141 Ruling 2/4 — supersedes the GH #1126 transient fade-after-scrub design) and updates live during either thumb's drag/keyboard step; `readoutHidden` (GH #1136) hides it unconditionally, at rest and during scrub alike. `aria-hidden` — a SIGHTED-ONLY convenience; each thumb's own `aria-valuetext` already carries the AT-facing announcement (never doubled). Positioned per `layout`, matching ui-slider's own three templates.

customStates: []      # no custom states; disabled is a reflected attribute (CSS [disabled] covers it)

face:
  formAssociated: true   # FACE form-associated control — value pair + validity participate via ElementInternals (ADR-0013)
  value: valueLo,valueHi # submitted as FormData with two entries named by `name` (the [lo, hi] pair)
  validity: always valid  # range sliders are always value-bearing; no constraint validation (override formValidity() for custom)

aria:
  role: group          # host internals.role='group' — a composite of two slider foci; NEVER a host role= attribute (FACE)
  roleSource: internals
  labelSource: label prop  # internals.ariaLabel = label || null (GH #1141, matches ui-slider); empty ⇒ falls back to an author aria-label/aria-labelledby
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
  inlineSize: 100%    # .rail stretches to its grid track's full inline-size (justify-self: stretch, GH #1141 — no longer flex:1)
  blockSize: var(--ui-slider-multi-box)   # the RAIL ROW's fixed grid-track size = the compact widget-box ramp step (ADR-0041); .rail's own thin bar is centred within it (align-self: center)
  thumbSize: calc(--ui-slider-multi-box - 4px)    # box − 2×--md-sys-widget-inset (ADR-0041 cl.3: 2px-inset law)
  boxRamp: --md-sys-compact-{size}           # 14/16/18 px at ui-md scale for sm/md/lg (ADR-0041 clause 2)
  layoutGap: --ui-slider-multi-layout-gap    # GH #1141 — the label↔rail↔value row/column rhythm, off --md-sys-space-xs

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
<ui-slider-multi min="0" max="200" step="10"></ui-slider-multi>
<ui-slider-multi disabled></ui-slider-multi>
<ui-slider-multi label="Price" value-lo="20" value-hi="80" min="0" max="200"></ui-slider-multi>
<ui-slider-multi label="Range" layout="inline"></ui-slider-multi>
<ui-slider-multi label="Range" layout="block"></ui-slider-multi>
```

## Value + form participation

`valueLo` and `valueHi` are the form value pair. On submission, both values are appended to a `FormData`
entry keyed by the control's `name` (the standard multi-value form-data shape). Both values are reflected
attributes. The **lo ≤ hi invariant** is enforced in all write paths: a dragged thumb clamps at the
sibling and never swaps identity mid-drag.

## Anatomy

The host is a `grid` container (GH #1141) whose `layout` prop selects the label/rail/value template (see
"Layout" below, matching `ui-slider`'s own three patterns). The RAIL ROW (or column, in `block`) is sized
to the FULL interactive box height (`--ui-slider-multi-box`) — the thumbs overflow `.rail`'s own thin bar,
so the track needs the same headroom the pre-#1141 host used to give via `flex` centering. `.rail` (the
thin horizontal bar) is `justify-self: stretch` (fills the track's inline-size) and `align-self: center`
(centred within the taller track). The `.fill` (the lo→hi active range) is absolutely positioned within
the rail using `--value-pct-lo` and `--value-pct-hi` custom properties set by the JS geometry seam. Each
`.thumb` is an absolutely-positioned circle (`box − 4px`) on the rail. The **nearer-thumb-grabs** rule: a
pointerdown anywhere on the rail selects the closer thumb and focuses it.

## Layout (GH #1141)

`layout` selects one of three label/value placements relative to `.rail` (`standard | inline | block`,
default `standard`) — identical semantics to `ui-slider`'s own three patterns (see slider.md's "Layout"
section), with the value slot showing the `"{lo} – {hi}"` pair (Ruling 4) instead of a single number.

## Value readout (GH #1126, superseded by GH #1141 Ruling 2/4)

The value part (`[data-part='value']`) is **always visible at rest** and updates live during either
thumb's drag/keyboard step — shows both clamped values as `"{lo} – {hi}"`. This supersedes the original
GH #1126 design (a transient label-end overlay that faded ~1.2s after the last live change): once
`layout` gained a resting value slot in every one of its three members, the fade timer had nothing left
to guard, and Ruling 2 retired it outright (see `slider.md`'s "Value readout" section for the shared
rationale).

**Opt-out (GH #1136):** `readoutHidden` (default `false` — value visible) suppresses the value part
entirely when `true` — at rest AND during scrub (GH #1141 widens the opt-out's scope, matching
`ui-slider`'s own widened contract).

## Sizes

`size` selects from the widget-box ramp (`sm` · `md` (default) · `lg`), sourcing `--md-sys-compact-{size}`
(ADR-0041: 14 · 16 · 18 px at the default `ui-md` scale). The thumb is always `box − 4px` (the
ADR-0041 2px-inset law). An ancestor `[scale]` attribute re-tables the ramp for its subtree.

## Accessibility

The host carries `role="group"` through `ElementInternals` (never a host attribute). `label` (non-empty)
IS the accessible name (`internals.ariaLabel`, GH #1141) — an empty `label` falls back to an author-supplied
`aria-label` or `aria-labelledby` on the host. Each thumb div carries `role="slider"` with its own
`aria-valuenow`, `aria-valuemin`, `aria-valuemax`, and `aria-label` ("Low value" / "High value"). The lo
thumb's `aria-valuemax` is constrained to `valueHi`; the hi thumb's `aria-valuemin` is constrained to
`valueLo`. Both thumbs are keyboard-focusable (tabindex=0, disabled removes both from the tab order). The
focus ring (`:focus-visible`, ADR-0009) appears on the focused thumb.
