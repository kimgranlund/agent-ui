---
# rating.md frontmatter — the attributes-as-API descriptor for ui-rating (ADR-0004; ADR-0216; GH #1395).
# The machine-checkable public surface lives HERE (frontmatter); the prose below the fence is the /site doc.
# The `attributes[]` block MUST mirror UIRatingElement.props (the ...UIRangeElement.props spread —
# name/disabled/required from formProps, min/max/step/value/size/label/layout from Range-specific props,
# with `max` re-defaulted to 5 — plus the NEW leaf prop `readonly`) — the contract↔props trip-wire in
# rating.test.ts and the frontmatter schema (validateComponentDescriptor) both target this fence. Field set
# per .claude/docs/plan.md §10 / ADR-0004; form participation per ADR-0013; geometry per ADR-0042 / ADR-0041;
# Range-class base per range-element.lld.md; the star-value codec + owned-mark craft + readonly write-path
# gate per ADR-0216.
tag: ui-rating
tier: indicator        # geometry size-class (Indicator band — widget box, the checkbox/switch/slider ramp; geometry.md)
extends: UIRangeElement  # the Range base (range-element.lld.md); UIRatingElement → UIRangeElement → UIFormElement

attributes:            # attributes-as-API — mirrors UIRatingElement.props
  - name: value
    type: number
    default: 0         # String(0) = '0'; the current numeric rating, a float in [min,max] for DISPLAY —
                        # fraction-accurate (a bound 4.3 paints a 4.3-star fill regardless of step, ADR-0216 cl.2)
    reflect: true      # reflects so [value] is observable as an attribute; prop↔attribute round-trip
  - name: min
    type: number
    default: 0         # String(0) = '0'; inherited from UIRangeElement — a rating scale always starts at 0
                        # in practice, but the prop stays a real, settable axis (structural inheritance, the
                        # slider-multi valueLo/valueHi precedent for an inherited-but-narrowly-used prop)
    reflect: true
  - name: max
    type: number
    default: 5         # String(5) = '5'; ADR-0216 cl.2 — re-defaults the base's 100 (a percentage scale) to
                        # 5 (a star scale); the number of stars rendered (rating.ts's #fillRow)
    reflect: true
  - name: step
    type: number
    default: 1         # String(1) = '1'; snap increment for the WRITE path only (keyboard/pointer commit);
                        # `0.5` opts a consumer into half-star input (ADR-0216 cl.2) — display always renders
                        # the fraction-accurate `value`, independent of `step`
    reflect: true
  - name: size
    type: enum
    values: [sm, md, lg]
    default: md        # String('md') = 'md'; selects --md-sys-compact-{size} via [size] in rating.css (each star's box)
    reflect: true
  - name: name
    type: string
    default: ''        # String('') = ''; the form field name (FACE; UIFormElement.formProps); reflects (native parity)
    reflect: true
  - name: disabled
    type: boolean
    default: false     # String(false) = 'false'; reflects; pointer-inert via CSS [disabled], out of tab order
    reflect: true
  - name: required
    type: boolean
    default: false     # String(false) = 'false'; reflects (inherited from UIFormElement.formProps); INFORMATIONAL
                        # ONLY — raises no constraint (a rating's value is never "missing", native <input type=range>
                        # parity, matching slider.md's identical ruling)
    reflect: true
  - name: readonly
    type: boolean
    default: false     # String(false) = 'false'; ADR-0216 cl.4/cl.5 — a NEW leaf prop (the base declares none;
                        # per-leaf today, text-field.ts/textarea.ts's precedent). Default false is INPUT-PARITY
                        # with every shipped form row (Slider/Checkbox default interactive); the display-case
                        # idiom is `readonly: true` + a bound/literal `value` (ADR-0216 cl.5). Inerts BOTH the
                        # keyboard step AND the pointer-drag write path (rating.ts) — not only an announced
                        # aria-readonly (internals.ariaReadOnly)
    reflect: true
  - name: label
    type: string
    default: ''        # String('') = ''; empty ⇒ no visible label part, no internals.ariaLabel (falls back to
                        # author aria-label/aria-labelledby); non-empty ⇒ BOTH the accessible name AND the
                        # visible, layout-positioned [data-part='label'] text (the slider.ts/GH #1141 precedent)
    reflect: true      # reflects (TKT-0069 item 2 ruling: label reflects fleet-wide)
  - name: layout
    type: enum
    values: [standard, inline, block]
    default: standard  # label above the star row (no separate value-readout row — the stars ARE the readout)
    reflect: true      # reflects so the [layout] grid-template selector in rating.css applies to JS-set values too

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
    description: Fired on each live value change — keyboard step (ArrowLeft/Right/Up/Down, PageUp/Down, Home/End) or pointer pick/drag along the star row (each pointermove that changes the snapped value). Never fires while readonly or disabled (both inert the write path, ADR-0216 cl.4).
  - name: change
    detail: 'null'
    description: Fired on blur when value has moved since focus (the base's commit-on-blur contract, unchanged from Slider — ADR-0216 Consequences; no LLD overrides pointer-pick-as-commit for this control today). The Fork-T1/D1 probe (rating.test.ts) proves `value` is already final by the time `change` fires — the precondition ADR-0216 cl.6 sets for the catalog `value:{prop:'value',event:'change'}` mark (the catalog row itself is the integration lane's work, not this control's).

slots: []              # light-DOM host-as-grid; no author-projection <slot> — label/stars are all control-created parts

parts:                 # two control-created light-DOM children, built once idempotently in connected()
  - name: label
    description: The visible label (`<span data-part="label" aria-hidden="true">`) — a DUPLICATE of `internals.ariaLabel` (the `label` prop; range-element.ts), `aria-hidden` so it never doubles that announcement. `[hidden]` when `label` is empty. Positioned per the `layout` prop.
  - name: stars
    description: The interactive star track (`<span data-part="stars">`, class `.stars`) — valueDrag's pointer-pick target (ADR-0216 cl.4). Contains two stacked full-width rows, both built once with `max` owned inline `<svg>` stars each (ADR-0216 cl.3, no icons-pack dependency) — `.stars-base` (every star at a low-alpha `currentColor` wash, the "unfilled" register) under `.stars-fill` (the identical `max` stars at full `currentColor` ink, `clip-path: inset()`-ed to the `value/max` fraction of its own width via the `--value-pct` geometry seam). Fraction-accurate at any `step`; the star COUNT rebuilds reactively when `max` changes.

customStates: []       # ui-rating does not arm any :state() hooks (no binary checked/selected state — Slider's own precedent)

face:
  formAssociated: true   # FACE form-associated control — value participates via ElementInternals (ADR-0013)
  value: value           # submitted as String(normalised value) (formValue() in rating.ts, the base's algorithm re-implemented per-leaf — ownsValueModel()=false)
  validity: '' # ui-rating raises no constraint (formValidity() is the UIFormElement default, always-valid); a rating's value is never "missing" — it is always a number in [min,max] (native <input type=range> parity, matching slider.md's identical ruling; UIRangeElement's own base never raises one either).

aria:
  role: slider         # set via ElementInternals.role = 'slider' in UIRangeElement.connected() (super.connected(), still called); never a host attribute
  roleSource: internals
  labelSource: label prop  # internals.ariaLabel = label || null (range-element.ts's shared, model-agnostic effect); empty ⇒ no accessible name minted, falling back to an author aria-label/aria-labelledby
  valueNow: internals.ariaValueNow           # tracks the normalised current value as a string (rating.ts's own ARIA effect — ownsValueModel()=false means this is a per-leaf copy, not the base's)
  valueMin: internals.ariaValueMin           # tracks min as a string
  valueMax: internals.ariaValueMax           # tracks max as a string
  readOnly: internals.ariaReadOnly           # ADR-0216 cl.4 — 'true' while `readonly`, else null; announced in ADDITION to inerting the write path (never announcement-only)

keyboard:
  - keys: ArrowRight / ArrowUp
    action: Increment value by step (clamped to max). Emits input. focus → arrow → blur emits change. No-op while readonly or disabled.
  - keys: ArrowLeft / ArrowDown
    action: Decrement value by step (clamped to min). Emits input. No-op while readonly or disabled.
  - keys: PageUp
    action: Increment value by largeStep (10×step, clamped to max). Emits input. No-op while readonly or disabled.
  - keys: PageDown
    action: Decrement value by largeStep (10×step, clamped to min). Emits input. No-op while readonly or disabled.
  - keys: Home
    action: Set value to min exactly. Emits input. No-op while readonly or disabled.
  - keys: End
    action: Set value to max exactly. Emits input. No-op while readonly or disabled.
  - note: Focusable by default (tabindex=0 from the tabbable trait, ADR-0010) whether or not readonly — only `disabled` removes the host from the tab order (the text-field/textarea readonly precedent: readonly stays focusable/announced, only the write path inerts).

geometry:
  sizeClass: indicator
  blockSize: var(--ui-rating-box)     # .stars's block-size = --md-sys-compact-{size} (ADR-0041); the host's own block-size is grid-content-sized (label/stars rows)
  inlineSize: auto                    # .stars sizes to its `max` stars × box + gaps; the host has no inline-size floor beyond its content
  starSize: var(--ui-rating-box)      # each star svg = the widget box (no thumb/inset law — a rating star is not a thumbed widget)
  starGap: --ui-rating-gap            # the star-to-star rhythm, off --md-sys-space-xs
  layoutGap: --ui-rating-layout-gap   # the label↔stars row/column rhythm, off --md-sys-space-xs

forcedColors: A `@media (forced-colors: active)` block re-points the base row's `color` to GrayText (a muted system tone, full opacity) and the fill row's `color` to CanvasText (the full-strength system ink) — both svgs keep `fill: currentColor` unconditionally, so this single re-point is the whole fix. `forced-color-adjust: none` preserves the explicit mappings. The :focus-visible ring is free via --md-sys-color-focus-ring → Highlight from the token layer (ADR-0009).
---

# ui-rating

`ui-rating` is a FACE **form-associated** Indicator-class Range control (`extends UIRangeElement` →
`UIFormElement`, ADR-0042/ADR-0216) that carries a numeric `value` within `[min, max]` (default `[0, 5]`)
rendered as a fraction-accurate star row. It participates in form submission through `ElementInternals`,
paints its mark entirely in owned inline SVG (no icons-pack dependency), and serves BOTH display
(`readonly: true` + a bound/literal `value`) and input (bound `value`, keyboard/pointer commit) on the
same row — one type, one contract (ADR-0216 cl.1).

```html
<ui-rating></ui-rating>
<ui-rating value="4.3" readonly label="Average rating"></ui-rating>
<ui-rating value="3" max="5" label="Rate this"></ui-rating>
<ui-rating value="2.5" step="0.5" label="Rate this (halves)"></ui-rating>
<ui-rating disabled value="4"></ui-rating>
<ui-rating label="Quality" layout="inline" value="4"></ui-rating>
```

## Value codec (ADR-0216 cl.2)

Canonical = the typed number, a float in `[0, max]`. **Display renders fraction-accurately regardless of
`step`** — `value: 4.3` paints a 4.3-star fill (an aggregate score is a float; rounding it to the input
granularity would lie). **Input commits clamp/snapped to `step`** — pointer and keyboard interaction produce
`step` multiples in `[0, max]`. The two uses share one codec; only the WRITE path quantizes.

## Anatomy — the owned star mark (ADR-0216 cl.3)

The host is a small `grid` container (the `layout` prop selects the label/star-row template, see "Layout"
below). The **stars track** (`[data-part='stars']`, `.stars`) stacks two identical rows of `max` owned
inline `<svg>` stars (a hand-rolled 24×24 path, no icons-pack dependency — `resolveIcon`'s missing-pack
degradation is an EMPTY svg, unacceptable for a control whose mark IS its entire information content):
- **`.stars-base`** — every star at a low-alpha wash of `currentColor` (the "unfilled" register, the
  sparkline `area`-alpha precedent).
- **`.stars-fill`** — the identical `max` stars at full `currentColor` ink, `clip-path: inset()`-ed to the
  `value/max` fraction of its own width.

One glyph, fraction-accurate at any size — no separate `star-half` variant needed. The star COUNT rebuilds
whenever `max` changes.

## Layout

`layout` selects one of three label/star-row placements (`standard | inline | block`, default `standard`),
the Slider `layout` precedent minus its separate value-readout row (the stars themselves ARE the readout):

- **`standard`** (default) — two rows, one column: the label above the star row.
- **`inline`** — one row: label beside the star row, the row flexing to fill the remaining width.
- **`block`** — two rows, one column, both CENTRED.

## `readonly` (ADR-0216 cl.4/cl.5)

A NEW leaf prop (the base declares none). Default `false` — input-parity with every shipped form row; the
display-case idiom is `readonly: true` + a bound/literal `value`. `readonly` INERTS the write path
(keyboard stepping AND pointer pick/drag) — not only an announced `aria-readonly`: an announced-but-still-
writable readonly would be the lie the attribute exists to prevent. Unlike `disabled`, `readonly` does not
remove the host from the tab order and does not mute the mark's ink (the text-field/textarea precedent —
still focusable, still reads as "normal", just not writable).

## Interaction

Pointer pick: a press on `.stars` maps the pointer's X coordinate along the track to a snapped `value`
exactly as a slider rail does (clicking near star *k* lands near `k·step`) — the same `valueDrag` trait
Slider uses, unmodified. Keyboard: Arrow ±`step`, Page ±10×`step`, Home/End → exact min/max. Both paths are
inert while `readonly` or `disabled`. Each live change emits `input`; `change` fires on blur when the value
moved since focus (the base's commit-on-blur contract, unchanged from Slider).

## Sizes

`size` selects from the widget-box ramp (`sm` · `md` (default) · `lg`), sourcing `--md-sys-compact-{size}`
(ADR-0041) — each star's own box. An ancestor `[scale]` attribute re-tables the ramp for its subtree.

## Accessibility

`role="slider"` is applied through `ElementInternals` (never a host attribute). `ariaValueNow/Min/Max/Text`
track the live normalised value, min, max, and a scale-aware text ("4.3 out of 5"). `ariaReadOnly` announces
`readonly` in ADDITION to inerting the write path. `label` (non-empty) IS the accessible name
(`internals.ariaLabel`) — an empty `label` falls back to an author-supplied `aria-label`/`aria-labelledby`.
