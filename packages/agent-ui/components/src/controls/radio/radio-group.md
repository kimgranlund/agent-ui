---
# radio-group.md frontmatter — the attributes-as-API descriptor for ui-radio-group (ADR-0004). The
# machine-checkable public surface lives HERE (frontmatter); the prose below the fence is the /site doc.
# The `attributes[]` block MUST mirror radio-group.ts `static props` (groupProps = UIFormElement.formProps
# spread [name/disabled/required] PLUS `orientation`) — the contract↔props trip-wire and the frontmatter
# schema both target this fence. Field set per .claude/docs/plan.md §10 / ADR-0004.
#
# ADR-0095 (supersedes ADR-0086): `variant` RETIRED — the segmented presentation is now the standalone
# `ui-segmented-control` (see segmented-control.md), not a variant of this group. `orientation` STAYS (ADR-0095
# clause 1: "orientation stays on the group") — the roving-focus axis is a group-level concern regardless of
# presentation.
tag: ui-radio-group
tier: container        # geometry size-class (not a sized control — a container that holds ui-radio children)
extends: UIFormElement  # FACE form-associated container (value/validity participation via ElementInternals; ADR-0013)
# marginal: ui-radio-group adds 1 B gz (re-measured via `npm run size`, ADR-0080, 2026-07-08, after ADR-0103 gave the group its own owned-layout CSS — the --ui-radio-group-gap token + the @scope flex/orientation rules cost is negligible, still effectively zero marginal) to the self-defining ui-* family above the other three Wave-1 Indicator controls (UIRadioGroupElement owns rovingFocus group wiring, single-selection exclusivity, and the group form value — the largest Wave-1 leaf) — within the per-control ≤ ~2 kB tier budget (plan §10)

attributes:            # attributes-as-API — mirrors radio-group.ts static props (UIFormElement.formProps spread + orientation)
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
    reflect: true      # the roving-focus axis (Arrow keys). RESOLVED ONCE at connect: an author-set attribute wins; otherwise the class-derived default applies (this base: vertical; ui-segmented-control overrides its own default to horizontal), reflected back so CSS and the roving trait read one source

properties:            # IDL beyond attributes-as-API (FACE form IDL, delegates to ElementInternals)
  - name: value
    description: The checked ui-radio child's `value`, or null when none is selected. Property-only (NOT a reflected attribute — the value is derived from child radio state, not an independent attribute; the UICheckboxElement `indeterminate` precedent). Getter reads the private #selectedValue signal. Setter selects the matching child ui-radio by its `value` (unchecking all others) WITHOUT emitting change — a silent programmatic write, matching UICheckboxElement.checked / UISelectElement.value. Setting null, or a value matching no child radio, CLEARS the selection (the HTMLSelectElement.value precedent: no match resolves to unselected, not a no-op).
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
    description: The ui-radio children (and any other light-DOM content). The group selects direct children via `[...this.children].filter(el => el instanceof UIRadioElement)` for roving-focus and selection management; non-radio children are ignored for selection but lay out as flex items in the group's own column/row stack (ADR-0103 — the group owns its interior layout, not block flow).

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

keyboard:              # the roving axis is PER-ORIENTATION (the resolved `orientation`); a pre-ADR-0086 table
                       # once falsely claimed ArrowLeft/Right navigated under the shipped vertical roving,
                       # which they do not — the per-orientation split below is the (still-standing) fix
  - keys: ArrowDown / ArrowUp
    action: (orientation=vertical, the default) Move focus + selection to the next/previous ui-radio (wraps; selection-follows-focus). The rovingFocus trait handles the tabindex management; the onMove callback commits the selection.
  - keys: ArrowRight / ArrowLeft
    action: (orientation=horizontal) Move focus + selection to the next/previous ui-radio (wraps; selection-follows-focus).
  - keys: Home
    action: Move focus + selection to the first ui-radio (either orientation).
  - keys: End
    action: Move focus + selection to the last ui-radio (either orientation).
  - keys: Space
    action: Selects the currently focused (tabindex=0) radio if not already selected. Handled by the individual ui-radio's pressActivation → click → base toggle → group change delegation.
  - note: Tab moves focus into the group (lands on the tabindex=0 radio — the checked one, or the first if none). Tab again moves OUT of the group (rovingFocus ensures exactly one radio is tabindex=0). This is the standard ARIA APG radio-group roving-tabindex keyboard contract.

geometry:
  sizeClass: container   # no fixed block-size — the group sizes to its content (ui-radio children).
  display: flex          # ADR-0103: the group owns its interior layout — flex-direction:column by default (a ui-radio host is inline-flex, so unstyled children would butt together with zero gap)
  gap: var(--ui-radio-group-gap)   # = var(--ui-space-sm) — density-responsive; page authors retune per-instance with one custom property
  orientationEffect: '[orientation=horizontal] switches flex-direction:row + flex-wrap:wrap + align-items:center — the roving-focus axis (radio-group.ts) and the visual axis are now one source of truth (ADR-0103)'
  note: The joined-button segmented presentation (a real display:grid layout, one shared moving indicator) is the standalone ui-segmented-control (ADR-0095), not this group.

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

The same selection is also exposed as a public `value` property (getter/setter, not a reflected attribute —
mirrors `UICheckboxElement.indeterminate`). Reading it returns the checked radio's `value` (or `null`).
Setting it programmatically selects the matching `ui-radio` child (unchecking the rest) **without** emitting
`change` — a silent write, the same convention `UICheckboxElement.checked` / `UISelectElement.value` follow
for programmatic sets; only a real click/keyboard commit emits `change`. Setting `null`, or a value that
matches no child radio, clears the selection (the `HTMLSelectElement.value` precedent for an unmatched
value).

## Keyboard

The group uses `rovingFocus` (looping): exactly **one** radio holds `tabindex=0` (the checked one, or the
first if none), all others hold `tabindex=-1`. A Tab moves INTO the group landing on the roving radio, and Tab
OUT skips the rest of the group. **Per orientation**: a `vertical` group (the default) roves with
ArrowUp/Down; a `horizontal` group roves with ArrowLeft/Right. Home/End jump to the first/last radio in either
orientation. `orientation` is resolved once at connect — an explicit `orientation` attribute wins; otherwise
the class-derived default applies (`vertical` on this base class).

## ARIA

`role="radiogroup"` is set via `internals.role` (FACE — never a host attribute). The accessible name must
be provided by the page author via `aria-label` or `aria-labelledby` on the group element. Each child
`ui-radio` carries `role="radio"` and `ariaChecked` via its own internals (managed by `UIIndicatorElement`).

## Layout

`ui-radio-group` **owns its interior layout** (ADR-0103): a `column` flex stack by default, with the gap
re-based to the layout ladder's `--ui-space-sm` (density-responsive for free) — `[orientation="horizontal"]`
switches to a wrapping row (`flex-wrap: wrap; align-items: center`), so the visual axis never desyncs from the
roving-focus keyboard axis the group itself resolves. This is the same structure the group cannot leave to
composition: its child discovery is direct children only (`[...this.children].filter(el => el instanceof
UIRadioElement)`), so a page author cannot fix a missing gap by wrapping the radios in a `ui-column` — doing
so would sever selection/roving. Retune the gap per instance with the `--ui-radio-group-gap` custom property
(the override freedom every component keeps).

`orientation` is resolved **once at connect** — there is no post-connect dynamic re-resolution contract
(the ui-select dynamic-options precedent): an imperative `group.orientation = …` after connect flips the
visual axis via the reflected attribute but the roving-focus key axis stays at its connect-time value.
Set orientation declaratively (markup or catalog prop) before connection.

## The joined-button "segmented control" presentation lives elsewhere

A `ui-radio-group` renders as dots-in-a-row (or dots-in-a-column) only — the joined-button single-select
toggle (one shared, animated highlight sliding between adjoining segments) used to be a `variant="segmented"`
on this group (ADR-0086); ADR-0095 promoted it to its own standalone tag, **`ui-segmented-control`** (with
`ui-segment` children, not `ui-radio`, and its own `display:grid` layout) — see that control's own doc page.
This group carries no `variant` attribute at all.

## Required + validity

`required` raises `valueMissing` when no radio is checked. The verdict is published reactively: after any
selection commit, `#selectedValue` updates, the `formValidity()` effect re-runs, and `internals.setValidity`
is re-published. A pre-selected radio (from markup `checked` attribute) is detected at connect time and seeds
`#selectedValue` so the initial validity state is correct.
