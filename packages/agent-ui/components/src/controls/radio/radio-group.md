---
# radio-group.md frontmatter — the attributes-as-API descriptor for ui-radio-group (ADR-0004). The
# machine-checkable public surface lives HERE (frontmatter); the prose below the fence is the /site doc.
# The `attributes[]` block MUST mirror radio-group.ts `static props` (groupProps = UIFormElement.formProps
# spread [name/disabled/required] PLUS the ADR-0086 segmented-variant pair [variant/orientation]) — the
# contract↔props trip-wire and the frontmatter schema both target this fence. Field set per
# .claude/docs/plan.md §10 / ADR-0004.
tag: ui-radio-group
tier: container        # geometry size-class (not a sized control — a container that holds ui-radio children)
extends: UIFormElement  # FACE form-associated container (value/validity participation via ElementInternals; ADR-0013)
# marginal: ui-radio-group adds 255 B gz (1098 B min) to the self-defining ui-* family above the other three Wave-1 Indicator controls (UIRadioGroupElement owns rovingFocus group wiring, single-selection exclusivity, and the group form value — the largest Wave-1 leaf) — within the per-control ≤ ~2 kB tier budget (plan §10)

attributes:            # attributes-as-API — mirrors radio-group.ts static props (UIFormElement.formProps spread + ADR-0086)
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
  - name: variant
    type: enum
    values: [default, segmented]
    default: default
    reflect: true      # ADR-0086 — 'segmented' restyles the ui-radio children as joined segments with one shared moving indicator (radio-group.css); 'default' stays today's layout-neutral dots-in-a-row
  - name: orientation
    type: enum
    values: [horizontal, vertical]
    default: vertical
    reflect: true      # ADR-0086 — the roving-focus axis (Arrow keys) AND, for variant=segmented, the grid main axis. RESOLVED ONCE at connect: an author-set attribute wins; otherwise variant supplies the default (segmented ⇒ horizontal, default ⇒ vertical), reflected back so CSS and the roving trait read one source

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

keyboard:              # ADR-0086 — the roving axis is PER-ORIENTATION (the resolved `orientation`, clause 1); the
                       # pre-ADR-0086 table falsely claimed ArrowLeft/Right navigated under the shipped vertical
                       # roving, which they do not — this is the drift correction (ADR-0086 §Repairs)
  - keys: ArrowDown / ArrowUp
    action: (orientation=vertical, the default) Move focus + selection to the next/previous ui-radio (wraps; selection-follows-focus). The rovingFocus trait handles the tabindex management; the onMove callback commits the selection.
  - keys: ArrowRight / ArrowLeft
    action: (orientation=horizontal) Move focus + selection to the next/previous ui-radio (wraps; selection-follows-focus). variant=segmented resolves to horizontal by default (ADR-0086 clause 1) when no explicit orientation is set.
  - keys: Home
    action: Move focus + selection to the first ui-radio (either orientation).
  - keys: End
    action: Move focus + selection to the last ui-radio (either orientation).
  - keys: Space
    action: Selects the currently focused (tabindex=0) radio if not already selected. Handled by the individual ui-radio's pressActivation → click → base toggle → group change delegation.
  - note: Tab moves focus into the group (lands on the tabindex=0 radio — the checked one, or the first if none). Tab again moves OUT of the group (rovingFocus ensures exactly one radio is tabindex=0). This is the standard ARIA APG radio-group roving-tabindex keyboard contract.

geometry:
  sizeClass: container   # no fixed block-size for the DEFAULT variant; the group sizes to its content (ui-radio children). variant=segmented is a geometry.md Pattern (geometry.md:133) — see note.
  display: block         # the DEFAULT variant is a block container; radios stack in block flow. variant=segmented repoints display:grid (radio-group.css, ADR-0086)
  note: For the DEFAULT variant, layout (stack direction, gap, wrapping) is the page author's responsibility — no layout-opinionated CSS. variant=segmented (ADR-0086) is the one exception — the group itself owns a real layout (display:grid, equal 1fr cells, an outer --ui-radius-base track, and one shared moving ::before indicator), a Pattern-class control-height ramp (--ui-height-md), not the page author's concern.

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

The group uses `rovingFocus` (looping): exactly **one** radio holds `tabindex=0` (the checked one, or the
first if none), all others hold `tabindex=-1`. A Tab moves INTO the group landing on the roving radio, and Tab
OUT skips the rest of the group. **Per orientation** (ADR-0086): a `vertical` group (the default) roves with
ArrowUp/Down; a `horizontal` group roves with ArrowLeft/Right. Home/End jump to the first/last radio in either
orientation. `orientation` is resolved once at connect — an explicit `orientation` attribute wins; otherwise
`variant="segmented"` defaults to `horizontal` and the default variant stays `vertical`.

## ARIA

`role="radiogroup"` is set via `internals.role` (FACE — never a host attribute). The accessible name must
be provided by the page author via `aria-label` or `aria-labelledby` on the group element. Each child
`ui-radio` carries `role="radio"` and `ariaChecked` via its own internals (managed by `UIIndicatorElement`).

## Segmented variant (ADR-0086)

`variant="segmented"` restyles the `ui-radio` children as a joined-button toggle — one shared, animated
highlight slides between segments instead of a per-radio dot:

```html
<ui-radio-group variant="segmented" name="density">
  <ui-radio value="compact">Compact</ui-radio>
  <ui-radio value="comfortable">Comfortable</ui-radio>
  <ui-radio value="spacious">Spacious</ui-radio>
</ui-radio-group>
```

Defaults to a **horizontal** row (`orientation="horizontal"` is resolved automatically); add
`orientation="vertical"` for a stacked segmented control. Single-selection exclusivity, roving focus, the
group form value, and required→valueMissing validity are **all unchanged** — the variant is presentation +
the orientation/selection wiring it needs (radio-group.css), not a new behavior.

## Required + validity

`required` raises `valueMissing` when no radio is checked. The verdict is published reactively: after any
selection commit, `#selectedValue` updates, the `formValidity()` effect re-runs, and `internals.setValidity`
is re-published. A pre-selected radio (from markup `checked` attribute) is detected at connect time and seeds
`#selectedValue` so the initial validity state is correct.
