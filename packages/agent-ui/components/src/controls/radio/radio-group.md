---
# radio-group.md frontmatter — the attributes-as-API descriptor for ui-radio-group (ADR-0004). The
# machine-checkable public surface lives HERE (frontmatter); the prose below the fence is the /site doc.
# The `attributes[]` block MUST mirror radio-group.ts `static props` (the groupProps = UIFormElement.formProps
# spread: name/disabled/required) — the contract↔props trip-wire and the frontmatter schema both target
# this fence. Field set per .claude/docs/plan.md §10 / ADR-0004.
tag: ui-radio-group
tier: container        # geometry size-class (not a sized control — a container that holds ui-radio children)
extends: UIFormElement  # FACE form-associated container (value/validity participation via ElementInternals; ADR-0013)
# marginal: ui-radio-group adds 255 B gz (1098 B min) to the self-defining ui-* family above the other three Wave-1 Indicator controls (UIRadioGroupElement owns rovingFocus group wiring, single-selection exclusivity, and the group form value — the largest Wave-1 leaf) — within the per-control ≤ ~2 kB tier budget (plan §10)

attributes:            # attributes-as-API — mirrors radio-group.ts static props (UIFormElement.formProps spread)
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

properties:            # IDL beyond attributes-as-API (FACE form IDL, delegates to ElementInternals)
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
    description: Fired when the committed selection changes (a new radio is selected via click, Space, or Arrow key navigation). Emitted by the GROUP, not the individual radio. The individual radio's own change event is consumed (stopPropagation) and re-emitted here at the group level.

slots:
  - name: default
    optional: false
    description: The ui-radio children (and any other light-DOM content). The group selects direct children via `[...this.children].filter(el => el instanceof UIRadioElement)` for roving-focus and selection management; non-radio children are ignored for selection but lay out normally in the container's block flow.

parts: []              # light-DOM container — no shadow parts

customStates: []       # no custom states on the group; state is on the ui-radio children (checked / ready)

face:
  formAssociated: true   # a FACE form-associated container — the GROUP owns the form value + validity (ADR-0013)
  value: selectedValue   # the form value = the checked ui-radio's `value` string, or null when nothing is checked
  validity: valueMissing # raised when required=true and no radio is checked

aria:
  role: radiogroup       # set via internals.role in connected() — never a host role attribute (FACE)
  roleSource: internals
  labelSource: aria-label / aria-labelledby  # the group's accessible name is provided by the page author
  disabledState: effectiveDisabled (own disabled || form-disabled channel; ADR-0013)

keyboard:
  - keys: ArrowDown / ArrowRight
    action: Move focus + selection to the next ui-radio in the group (wraps; selection-follows-focus). The rovingFocus trait handles the tabindex management; the onMove callback commits the selection.
  - keys: ArrowUp / ArrowLeft
    action: Move focus + selection to the previous ui-radio (wraps).
  - keys: Home
    action: Move focus + selection to the first ui-radio.
  - keys: End
    action: Move focus + selection to the last ui-radio.
  - keys: Space
    action: Selects the currently focused (tabindex=0) radio if not already selected. Handled by the individual ui-radio's pressActivation → click → base toggle → group change delegation.
  - note: Tab moves focus into the group (lands on the tabindex=0 radio — the checked one, or the first if none). Tab again moves OUT of the group (rovingFocus ensures exactly one radio is tabindex=0). This is the standard ARIA APG radio-group roving-tabindex keyboard contract.

geometry:
  sizeClass: container   # no fixed block-size; the group sizes to its content (ui-radio children)
  display: block         # the group is a block container; radios stack in block flow by default
  note: Layout (stack direction, gap, wrapping) is the page author's responsibility; the group provides no layout-opinionated CSS of its own.

forcedColors: No per-group forced-colors rules needed; the ui-radio children carry their own WHCM treatment. The group's internals.role='radiogroup' is AX-only (no visual surface).
---

# ui-radio-group

`ui-radio-group` is the **container** for the radio-button family — a FACE form-associated element that
extends `UIFormElement` and owns **single-selection exclusivity**, **roving-focus keyboard navigation**, the
**group form value**, and the **required → valueMissing** validity verdict.

```html
<ui-radio-group name="theme" required>
  <ui-radio value="light">Light</ui-radio>
  <ui-radio value="dark">Dark</ui-radio>
  <ui-radio value="system">System</ui-radio>
</ui-radio-group>
```

## Selection model

The group enforces the radio-button invariant: **exactly one radio may be checked** at a time (or none,
until required forces a selection). Two commit paths:

- **Arrow keys (Up/Down, Home/End):** `rovingFocus` moves focus **and** selection simultaneously —
  selection-follows-focus, the ARIA APG radio-group pattern. The `onMove` callback calls `#commit(index)`,
  which checks the target radio, unchecks all others, and emits `change` on the group.
- **Click / Space:** the individual radio's base toggle fires (unchecked → checked), emitting `change` on the
  radio (bubbling). The group's delegated `change` listener intercepts it, calls `#commit(index)` for
  exclusivity, and re-emits `change` at the group level. The group's capture-phase guard in
  `UIRadioElement.grouped()` prevents click/Space from deselecting an already-checked radio (radios can only
  be replaced, not toggled off).

## Form value

The group's form value is the selected radio's `value` string, or `null` when nothing is checked. This is
tracked in a private signal (`#selectedValue`), which the `UIFormElement` base's reactive effects publish to
`internals.setFormValue` / `internals.setValidity` automatically on every change. The group — not the
individual radios — is the form participant the `<form>` sees.

## Keyboard

The group uses `rovingFocus` (vertical orientation, looping): exactly **one** radio holds `tabindex=0` (the
checked one, or the first if none), all others hold `tabindex=-1`. A Tab moves INTO the group landing on the
roving radio, and Tab OUT skips the rest of the group.

## ARIA

`role="radiogroup"` is set via `internals.role` (FACE — never a host attribute). The accessible name must
be provided by the page author via `aria-label` or `aria-labelledby` on the group element. Each child
`ui-radio` carries `role="radio"` and `ariaChecked` via its own internals (managed by `UIIndicatorElement`).

## Required + validity

`required` raises `valueMissing` when no radio is checked. The verdict is published reactively: after any
selection commit, `#selectedValue` updates, the `formValidity()` effect re-runs, and `internals.setValidity`
is re-published. A pre-selected radio (from markup `checked` attribute) is detected at connect time and seeds
`#selectedValue` so the initial validity state is correct.
