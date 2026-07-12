---
# segmented-control.md frontmatter — the attributes-as-API descriptor for ui-segmented-control (ADR-0004).
# The machine-checkable public surface lives HERE (frontmatter); the prose below the fence is the /site doc.
# ADR-0095 (authored from ADR-0092 §Alternatives-1; supersedes ADR-0086's `ui-radio-group[variant=
# 'segmented']` — a hard cutover, no alias). `UISegmentedControlElement extends UIRadioGroupElement`
# directly, but `extends:` below names UIFormElement — the sanctioned base-ladder ANCESTOR
# (family-coherence.test.ts A3), the same convention radio-group.md/radio.md already follow (their
# `extends:` rows name UIFormElement/UIIndicatorElement, not their own immediate non-ladder parent).
# The `attributes[]` block MUST mirror segmented-control.ts's LIVE `static props` — inherited UNCHANGED from
# UIRadioGroupElement's `groupProps` (UIFormElement.formProps spread [name/disabled/required] PLUS
# `orientation`; this subclass adds NO new prop of its own) — the contract↔props trip-wire and the
# frontmatter schema both target this fence. Field set per .claude/docs/plan.md §10 / ADR-0004.
tag: ui-segmented-control
description: A joined-button single-select toggle with one shared, animated highlight sliding between segments.
tier: pattern           # geometry size-class — geometry.md's Pattern band names "segmented-control" as its own example (geometry.md:133): "interactive rows take the control height"
extends: UIFormElement  # FACE form-associated container (value/validity participation via ElementInternals; ADR-0013) — the base-ladder ancestor of the real parent, UIRadioGroupElement
# marginal: ui-segmented-control adds 62 B gz (measured via `npm run size`'s per-control leave-one-out leg, ADR-0080, 2026-07-07) to the self-defining ui-* family — almost all its real cost (UIRadioGroupElement's exclusivity/roving/value machinery, ui-segment's own graph) is already paid for by ui-radio-group/ui-segment; this control contributes only its own small class body + segmented-control.css — well within the per-control ≤ ~2 kB tier budget (plan §10)

attributes:            # attributes-as-API — mirrors segmented-control.ts's LIVE static props (inherited from UIRadioGroupElement.groupProps, unchanged)
  - name: name
    type: string
    default: ''
    reflect: true      # the form field name; FACE submission keys the entry by the name content attribute (ADR-0013)
  - name: disabled
    type: boolean
    default: 'false'
    reflect: true      # reflects; effectiveDisabled = own || form-disabled channel (ADR-0013)
  - name: required
    type: boolean
    default: 'false'
    reflect: true      # reflects; required + no selection → valueMissing validity verdict
  - name: orientation
    type: enum
    values: [horizontal, vertical]
    default: vertical
    reflect: true      # the roving-focus axis (Arrow keys) AND the grid main axis. RESOLVED ONCE at connect: an author-set attribute wins; otherwise the CLASS-derived default applies — this control overrides UIRadioGroupElement's own 'vertical' default to 'horizontal' (defaultOrientation(), ADR-0095 clause 1) — so the declared prop default stays 'vertical' (the inherited live prop, unchanged) while the EFFECTIVE resolved-and-reflected default a bare `<ui-segmented-control>` renders with is 'horizontal'

properties:            # IDL beyond attributes-as-API (FACE form IDL, delegates to ElementInternals; inherited from UIRadioGroupElement unchanged)
  - name: value
    description: The checked ui-segment child's `value`, or null when none is selected. Property-only (NOT a reflected attribute — the value is derived from child segment state). Getter reads the private #selectedValue signal (inherited). Setter selects the matching child ui-segment by its `value` (unchecking all others) WITHOUT emitting change — a silent programmatic write, matching UICheckboxElement.checked / UISelectElement.value. Setting null, or a value matching no child segment, CLEARS the selection (the HTMLSelectElement.value precedent: no match resolves to unselected, not a no-op).
  - name: form
    description: The owning <form>, or null (delegates to ElementInternals.form).
  - name: validity
    description: The live ValidityState (delegates to ElementInternals.validity).
  - name: validationMessage
    description: The current validation message (empty when valid; 'Please select one of these options.' when required + unselected).
  - name: willValidate
    description: Whether the control is a candidate for constraint validation.
  - name: checkValidity
    description: Method — runs constraint validation, firing an invalid event when invalid.
  - name: reportValidity
    description: Method — like checkValidity, additionally reporting the problem to the user.

events:
  - name: change
    detail: 'null'
    description: Fired when the committed selection changes (a new segment is selected via click, Space, or Arrow key navigation). Emitted by the CONTROL, not the individual segment. The individual segment's own change event is consumed (stopPropagation) and re-emitted here.

slots:
  - name: default
    optional: false
    description: The ui-segment children (and any other light-DOM content). The control selects direct children via `[...this.children].filter(el => el instanceof UIRadioElement)` (inherited from UIRadioGroupElement — ui-segment satisfies it by construction) for roving-focus and selection management; non-segment children are ignored for selection but lay out normally inside the grid track.

parts: []              # light-DOM container — no shadow parts

customStates:           # checked/ready live on the ui-segment children; user-invalid is the control's OWN (inherited from UIRadioGroupElement, ADR-0051)
  - user-invalid        # ADR-0051 — set only AFTER the first interaction (blur/change), via the trackUserInvalid controller UIRadioGroupElement.connected() wires; this control owns its own track border directly (unlike ui-radio-group, which has no visual surface of its own)

face:
  formAssociated: true   # a FACE form-associated container — the control owns the form value + validity (ADR-0013, inherited from UIRadioGroupElement)
  value: selectedValue   # the form value = the checked ui-segment's `value` string, or null when nothing is checked
  validity: valueMissing # raised when required=true and no segment is checked

aria:
  role: radiogroup       # set via internals.role in UIRadioGroupElement.connected() (inherited) — never a host role attribute (FACE)
  roleSource: internals
  labelSource: aria-label / aria-labelledby  # the control's accessible name is provided by the page author
  disabledState: effectiveDisabled (own disabled || form-disabled channel; ADR-0013)
  invalidState: internals.ariaInvalid — 'true' / null, mirrors :state(user-invalid) (ADR-0051, inherited)

keyboard:              # the roving axis is PER-ORIENTATION (the resolved `orientation`) — identical mechanism to ui-radio-group, defaulting horizontal here instead of vertical
  - keys: ArrowRight / ArrowLeft
    action: (orientation=horizontal, the default) Move focus + selection to the next/previous ui-segment (wraps; selection-follows-focus). The rovingFocus trait handles the tabindex management; the onMove callback commits the selection.
  - keys: ArrowDown / ArrowUp
    action: (orientation=vertical) Move focus + selection to the next/previous ui-segment (wraps; selection-follows-focus).
  - keys: Home
    action: Move focus + selection to the first ui-segment (either orientation).
  - keys: End
    action: Move focus + selection to the last ui-segment (either orientation).
  - keys: Space
    action: Selects the currently focused (tabindex=0) segment if not already selected. Handled by the individual ui-segment's pressActivation → click → base toggle → control change delegation.
  - note: Tab moves focus into the control (lands on the tabindex=0 segment — the checked one, or the first if none). Tab again moves OUT of the control (rovingFocus ensures exactly one segment is tabindex=0). This is the standard ARIA APG radio-group roving-tabindex keyboard contract.

geometry:
  sizeClass: pattern     # geometry.md's Pattern band (geometry.md:133) — "interactive rows take the control height; the shell uses the space scale"
  display: grid          # display:grid, equal 1fr cells, orientation-driven main axis (segmented-control.css)
  note: The control owns a real layout — display:grid, equal 1fr cells, an outer --ui-radius-base track, and one shared moving ::before indicator sized to `100% / segment-count` and positioned via `transform` (never grid-track placement). Each ui-segment reads the Pattern-class CONTROL-height ramp (--ui-height-md), not the Indicator compact/widget ramp — block-size off the ramp, padding-block:0, padding-inline = height/2 (the slotless-edge pad, geometry.md), line-height:1 (ADR-0036). v1 ships the single md register; an ancestor [scale] re-tables the row for free (ADR-0038).

forcedColors: Under forced-colors, the moving indicator inverts to Highlight (fill) with the selected segment's ink → HighlightText; unselected ink + the outer frame hold at ButtonText (segments carry no divider borders — removed by ruling, 2026-07-09). The indicator's `transform` still applies (only its fill/ink invert) — the fill PRESENCE (exactly one segment backed) is the ADR-0057 non-color signifier, alongside the already-exposed aria-checked on each ui-segment.
---

# ui-segmented-control

`ui-segmented-control` is the fleet's **segmented control** — a joined-button single-select toggle with one
shared, animated highlight that slides between adjoining segments. It `extends UIRadioGroupElement`
directly: single-selection exclusivity, roving-focus keyboard navigation, the group form value, and the
required → valueMissing validity verdict are **100% inherited, unchanged**. Only the tag identity, the
default orientation, and the moving-indicator state seam are this control's own.

```html
<ui-segmented-control name="density">
  <ui-segment value="compact">Compact</ui-segment>
  <ui-segment value="comfortable">Comfortable</ui-segment>
  <ui-segment value="spacious">Spacious</ui-segment>
</ui-segmented-control>
```

Defaults to a **horizontal** row; set `orientation="vertical"` for a stacked segmented control.

## History — ADR-0095 supersedes ADR-0086

Until this ADR, the exact same joined-button presentation shipped as `ui-radio-group[variant="segmented"]`
with `ui-radio` children. Kim ruled the tag itself is the requirement (T3, ADR-0092 clause 4) — a findable
first-class name, not a variant spelling. This is a **hard cutover**: `ui-radio-group` no longer carries a
`variant` attribute at all, and every consumer re-keys to `ui-segmented-control` + `ui-segment`. The
rendering, interaction, geometry, motion, and a11y design carries over **byte-equivalent** — only the host
tag, child tag, and `--ui-{name}-*` token names changed.

## Selection model

Identical to `ui-radio-group` (see that page for the full mechanism): Arrow keys move focus **and**
selection simultaneously (selection-follows-focus); Click/Space check the targeted segment; a segment that
is already checked cannot be deselected by clicking it — only replaced by selecting another.

## The shared moving indicator

One artifact — the control's own `::before` pseudo-element — slides between segments via `transform`
(`translateX`/`translateY`, never grid-track placement, which cannot animate). It is sized to exactly one
cell (`100% / segment-count`) and hidden entirely while nothing is selected, appearing instantly on the
first selection and only sliding between subsequent ones. The selected segment's ink sits on the fill
(`--md-sys-color-primary-on-primary`); unselected ink is the text-channel neutral.

## Keyboard

Per orientation: a `horizontal` control (the default) roves with ArrowLeft/Right; a `vertical` one roves
with ArrowUp/Down. Home/End jump to the first/last segment in either orientation. `orientation` is resolved
once at connect — an explicit `orientation` attribute wins; otherwise this control's own class-derived
default (`horizontal`) applies (`ui-radio-group`'s own default stays `vertical`).

## ARIA

`role="radiogroup"` is set via `internals.role` (FACE — never a host attribute, inherited from
`UIRadioGroupElement`). The accessible name must be provided by the page author via `aria-label` or
`aria-labelledby`. Each child `ui-segment` carries `role="radio"` and `ariaChecked` via its own internals.

## Required + validity

`required` raises `valueMissing` when no segment is checked — identical mechanism to `ui-radio-group`.
