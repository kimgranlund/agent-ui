---
# segment.md frontmatter — the attributes-as-API descriptor for ui-segment (ADR-0004). The machine-checkable
# public surface lives HERE (frontmatter); the prose below the fence is the /site doc. ADR-0095 clause 3:
# `UISegmentElement extends UIRadioElement` directly, adding NO new prop of its own — the `attributes[]`
# block below is therefore IDENTICAL in shape to radio.md's (the live static props are the SAME inherited
# UIIndicatorElement.indicatorProps table). `extends:` names UIIndicatorElement — the sanctioned base-ladder
# ancestor (family-coherence.test.ts A3), not the immediate non-ladder parent UIRadioElement (the
# radio.md/radio-group.md convention). Field set per .claude/docs/plan.md §10 / ADR-0004.
tag: ui-segment
description: The child button of ui-segmented-control, rendering only its label while the host supplies all geometry.
tier: indicator        # geometry size-class — the SAME tier as ui-radio (its real ancestor); the Control-height SIZING it actually renders at is applied by the HOST ui-segmented-control via a descendant compound selector, not this leaf's own tier classification
extends: UIIndicatorElement  # Indicator-class base (ADR-0042) — boolean form value + checked-state machine + pressActivation toggle (inherited via UIRadioElement)
# marginal: ui-segment adds 0 B gz (measured via `npm run size`'s per-control leave-one-out leg, ADR-0080, 2026-07-07) to the self-defining ui-* family — its whole graph (UIIndicatorElement + traits) is already paid for by ui-radio/ui-checkbox/ui-switch; the tag itself contributes only its own tiny class body — well within the per-control ≤ ~2 kB tier budget (plan §10)

attributes:            # attributes-as-API — mirrors segment.ts's LIVE static props (inherited from UIRadioElement/UIIndicatorElement.indicatorProps, unchanged)
  - name: checked
    type: boolean
    default: false
    reflect: true      # reflects so [checked] CSS attribute selector + JS-set values drive the checked ink + ariaChecked
  - name: value
    type: string
    default: on
    reflect: true      # reflects (HTML checkbox semantics: the submitted string when checked; default 'on')
  - name: size
    type: enum
    values: [sm, md, lg]
    default: md
    reflect: true      # reflects (inherited from UIIndicatorElement); UNCONSUMED by segmented-control.css in v1 — the segment reads the HOST's Control-height ramp instead (geometry.md's Pattern band), exactly as a segmented ui-radio's own [size] went unconsumed under ADR-0086
  - name: name
    type: string
    default: ''
    reflect: true      # the form field name (FACE; UIFormElement.formProps) — reflects for native form-submission parity
  - name: disabled
    type: boolean
    default: false
    reflect: true      # reflects; pointer-inert + removed from tab order; effectiveDisabled = own || form-disabled
  - name: required
    type: boolean
    default: false
    reflect: true      # reflects; drives valueMissing on the individual segment (group-owned validity is preferred)

properties:            # IDL beyond attributes-as-API (inherited from UIIndicatorElement)
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
    description: Fired on each toggle (unchecked → checked) via click or Space. Same-tick as change. Suppressed when the checked segment guard prevents deselection (radios/segments can only be replaced, never toggled off).
  - name: change
    detail: 'null'
    description: Fired on commit (click or Space toggle; unchecked → checked). Bubbles to the parent ui-segmented-control, where it is consumed and re-emitted as the control's own change event.

slots:
  - name: default
    optional: true
    description: The segment's label — the default/unnamed children (the accessible text centered in the segment cell). A bare segment with no slot content renders an empty cell.

parts: []              # light-DOM, no shadow parts

customStates:          # :state() hooks — set via internals.states, never host attributes (FACE); inherited from UIIndicatorElement
  - checked            # set when checked=true; drives the selected ink via :state(checked) + the [checked] attribute mirror (segmented-control.css)

face:
  formAssociated: true   # a FACE form-associated control (ADR-0013); each segment is form-associated individually
  value: checked         # the form value is checked ? this.value : null (platform checkbox semantics, UIIndicatorElement.formValue)
  validity: valueMissing # individual segment raises valueMissing only when required && !checked (group-level validity is preferred)

aria:
  role: radio            # set via internals.role in UIIndicatorElement.connected() — never a host role attribute (FACE)
  roleSource: internals
  labelSource: textContent  # the default slot label text is the accessible name
  disabledState: internals.ariaDisabled  # effectiveDisabled (own || form-disabled); ADR-0010 channel via UIIndicatorElement

keyboard:
  - keys: Space
    action: Toggle checked (unchecked → checked). Inside a ui-segmented-control, only unchecked → checked is allowed (the group guard blocks clicking an already-checked segment); the group selection commit runs after.
  - keys: Enter
    action: Does NOT toggle (platform checkbox parity — Enter is suppressed by the UIIndicatorElement Enter guard). Arrow keys handle navigation inside a group.
  - note: Inside a ui-segmented-control, Arrow keys (per orientation) + Home/End rove focus AND selection (selection-follows-focus; ARIA APG radio-group pattern). Tab moves out of the group. Only the focused (checked) segment is tabindex=0; others are tabindex=-1 (managed by rovingFocus on the host control).

geometry:
  sizeClass: indicator
  note: A standalone `ui-segment` renders no visible glyph of its own — a plain centered, full-cell flex box (segment.css). Its ACTUAL rendered geometry (block-size/padding/font/line-height) is applied by the HOST `ui-segmented-control` via a descendant compound selector (segmented-control.css's Pattern-class Control-height ramp), not by this leaf's own [size] axis, which stays unconsumed in v1 (the same "inherited but unconsumed" shape ADR-0086's segmented ui-radio already had).

forcedColors: No segment-owned forced-colors inversion — nothing to invert at this leaf (segment.css only asserts forced-color-adjust:none for the host cascade). The selected-segment ink → HighlightText / unselected → ButtonText / the moving fill → Highlight inversion is entirely the HOST ui-segmented-control's concern (segmented-control.css).
---

# ui-segment

`ui-segment` is the child leaf of **`ui-segmented-control`** — a FACE form-associated control that extends
`UIRadioElement`/`UIIndicatorElement` with `role="radio"`, adding **no new prop or behavior of its own**.
The entire point of this tag (ADR-0095's T3 naming win) is identity: `<ui-segment>` reads as a segmented
control's own vocabulary, never leaking "radio" into consumer markup.

```html
<ui-segmented-control name="size">
  <ui-segment value="sm">Small</ui-segment>
  <ui-segment value="md">Medium</ui-segment>
  <ui-segment value="lg">Large</ui-segment>
</ui-segmented-control>
```

## Anatomy

The host is a **centered, full-cell flex box** (segment.css) — no dot glyph, no leading affordance, just
the default-slot label text centered in the cell. The Control-height sizing (block-size, padding, font,
line-height), the ink colour (selected vs. unselected), the hover/active washes,
and the shared moving selected-fill indicator are all applied by the **host** `ui-segmented-control` through
a descendant compound selector — `ui-segment` itself stays ignorant of any of that, exactly as `ui-radio`
stayed ignorant of `ui-radio-group[variant='segmented']`'s presentation under the now-superseded ADR-0086.

## Group coordination

Identical mechanism to `ui-radio` inside `ui-radio-group`: `grouped()` (inherited) registers a
capture-phase click guard — a checked segment cannot be deselected by clicking it, only replaced by
selecting another. Arrow keys (delegated to the host `ui-segmented-control`) move focus **and** selection
simultaneously.

## Standalone use

Without a `ui-segmented-control` (or `ui-radio-group`) ancestor, `ui-segment` behaves like a boolean
checkbox — valid for a single-item "accept" pattern, but not the intended use.
