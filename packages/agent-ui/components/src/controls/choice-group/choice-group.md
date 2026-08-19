---
# choice-group.md frontmatter — the attributes-as-API descriptor for ui-choice-group (ADR-0004 /
# ADR-0220). The `attributes[]` block MUST mirror choice-group.ts `static props` (UIFormElement.formProps
# spread [name/disabled/required] PLUS multiple/value/values/min/gap/label) — the contract↔props
# trip-wire (choice-group-descriptor.test.ts) targets this fence. LLD posture: none new — this control
# composes the shipped listbox-roving LLD-C2/C3 (selectionCommit/rovingFocus) + multi-select-field LLD-C4
# (multi-toggle); per-slice gates live in choice-group.decomp.json, not a new LLD.
tag: ui-choice-group
description: A form-associated rich-card selection container — a committed choice over agent-composed ui-choice-card option cards, single or multi.
tier: container         # geometry size-class (a value-owning container that sizes to its ui-choice-card children — the radio-group.md precedent)
extends: UIFormElement  # FACE form-associated container (value/validity via ElementInternals, ADR-0013); composes rovingFocus + selectionCommit directly (ADR-0220 cl.1) — NOT a UIListboxElement subclass
# marginal: measured at integration (npm run size, ADR-0040 §3)

attributes:             # attributes-as-API — mirrors choice-group.ts static props (formProps spread + own)
  - name: name
    type: string
    default: ''
    reflect: true       # the form field name; FACE submission keys the entry by the name content attribute (ADR-0013)
  - name: disabled
    type: boolean
    default: false
    reflect: true       # reflects; effectiveDisabled = own || form-disabled channel; cascades onto non-individually-disabled ui-choice-card children (ADR-0220 cl.8)
  - name: required
    type: boolean
    default: false
    reflect: true       # reflects; required + empty selection → valueMissing validity verdict
  - name: multiple
    type: boolean
    default: false
    reflect: true       # structural mode flip (ADR-0220 cl.2), resolved ONCE at connect: single (exclusive, selectionCommit 'single') vs multi (toggle, 'multi-toggle')
  - name: value
    type: string
    default: ''
    reflect: true       # the single-mode committed key (ADR-0161 array-form per-slot opt-in — the string slot)
  - name: values
    type: json
    default: ''         # the LIVE default is `[]` — String([])==='' (the multi-select.ts valueProp precedent)
    reflect: false       # NOT reflected — bindable multi-mode selection state, not an authored dimension
  - name: min
    type: string
    default: ''
    reflect: true       # the auto-fit grid's minmax() track floor (ADR-0220 cl.6, the ui-grid `min` precedent) — threaded into --ui-choice-group-min inline; '' ⇒ the CSS default floor applies
  - name: gap
    type: enum
    values: [none, xs, sm, md, lg, xl, 2xl]
    default: md
    reflect: true       # the --md-sys-space ladder (ADR-0220 cl.6, the ui-grid/flexProps.gap precedent); default md (a card gallery reads as intentionally spaced)
  - name: label
    type: string
    default: ''
    reflect: true       # the bare-usage accessible-name source (ADR-0085, the Toolbar.label precedent)

properties:             # IDL beyond attributes-as-API (FACE form IDL, delegates to ElementInternals)
  - name: form
    description: The owning <form>, or null (delegates to ElementInternals.form).
  - name: validity
    description: The live ValidityState (delegates to ElementInternals.validity).
  - name: validationMessage
    description: The current validation message (empty when valid; 'Please select an option.' when required + empty).
  - name: willValidate
    description: Whether the control is a candidate for constraint validation.
  - name: checkValidity
    description: Method — runs constraint validation, firing an invalid event when invalid.
  - name: reportValidity
    description: Method — like checkValidity, additionally reporting the problem to the user.

events:
  - name: select
    detail: 'string | ReadonlySet<string>'
    description: Fired when the committed selection changes (click, Enter, or the synthesized Space→click on a ui-choice-card). Single mode detail is the committed string key (or '' when cleared); multi mode detail is the committed ReadonlySet<string>. Also drives the two-way binds (value:{prop:'value',event:'select'} and values:{prop:'values',event:'select'} — distinct props, one shared commit event, the Table sort/page shape, ADR-0220 cl.3).

slots:
  - name: default
    optional: false
    description: Provide ui-choice-card children (any nesting depth — discovery is nearest-group-scoped descendants from birth, ADR-0220 cl.7). A card whose nearest ui-choice-group ancestor is a DIFFERENT (inner) group is never roved or committed by this group — the inner-group ownership boundary.

parts: []               # light-DOM container — no shadow parts; the ui-choice-card children carry all visible affordances

customStates:
  - user-invalid         # ADR-0051 — set only AFTER the first interaction (blur) via the trackUserInvalid controller; the group has no visual surface of its own, so the CSS leg reaches into each unselected ui-choice-card child's own frame border

face:
  formAssociated: true   # a FACE form-associated container — the GROUP owns the form value + validity (ADR-0013)
  formValue: 'Single mode: the committed `value` string, or null when empty. Multi mode: a FormData with one .append(name, v) per selected value (the multi-select.ts LLD-C6 precedent) — zero selections → an empty FormData(), submitting nothing.'
  formValidity: required + empty selection (value === '' in single mode; values.length === 0 in multi mode) → valueMissing. Default: valid.
  formReset: Restores value/values to whichever attribute each held at connect time (the multi-select.ts "the attribute seeds the reset baseline" convention).

aria:
  role: listbox           # set via internals.role in connected() — never a host role attribute (FACE)
  roleSource: internals
  multiSelectable: 'internals.ariaMultiSelectable = ''true'' in multi mode — a real ARIAMixin IDL member, never a bespoke ARIA invention'
  invalidState: internals.ariaInvalid — 'true' / null, mirrors :state(user-invalid) (ADR-0051)
  labelSource: 'Bare usage — internals.ariaLabel from the `label` prop (the base UIFormElement default no-ops while role-less; this control HAS internals.role, so it wires directly). Fielded usage (inside ui-field) — the base UIFormElement''s own guarded applyFieldLabelling default (ariaLabelledByElements from the field''s visible label).'

keyboard:
  - keys: ArrowDown / ArrowUp / ArrowRight / ArrowLeft
    action: Moves roving focus to the next/previous non-disabled ui-choice-card in tree order (rovingFocus, looping; explicit activation — never selection-follows-focus, ADR-0220 cl.5).
  - keys: Home / End
    action: Moves roving focus to the first/last non-disabled ui-choice-card.
  - keys: Enter
    action: Commits the currently roving-focused card (selectionCommit, through the ADR-0220 cl.1 itemFromTarget seam).
  - keys: Space
    action: Toggles/commits the currently roving-focused card — synthesized as a .click() on the focused card (selectionCommit itself wires click + Enter only; the multi-select.ts LLD §5 precedent).
  - keys: Click on a card
    action: Commits that card (single mode replaces the selection; multi mode toggles membership) — resolved through the nearest-group-scoped itemFromTarget seam (ADR-0220 cl.7).

geometry:
  sizeClass: container     # Container/layout band — no fixed block-size, sizes to its ui-choice-card children's grid track (geometry.md)
  display: grid            # ADR-0220 cl.6 (ADR-0103's group-owns-interior-layout law, adopted at birth): a responsive auto-fit grid, the ui-grid mechanism ported directly
  gridTemplateColumns: repeat(auto-fit, minmax(var(--ui-choice-group-min), 1fr))
  gap: var(--ui-choice-group-gap)   # off the --md-sys-space ladder; [gap=step] repoints
  note: The stacked single-column list (ADR-0220 Alternatives variant A) is the degenerate case where `min` ≥ the container's rendered width; no orientation prop, no wrapper type, no carousel presentation (fenced, ADR-0220 cl.8).

forcedColors: No group-level forced-colors rules beyond forced-color-adjust:none — the ui-choice-card children carry their own WHCM treatment (the radio-group.css precedent). The group's internals.role='listbox' is AX-only (no visual surface).
---

# ui-choice-group

`ui-choice-group` is the **rich-card selection container** (ADR-0220) — a form-associated element that
extends `UIFormElement` and composes `rovingFocus` + `selectionCommit` directly (the `ui-select`/
`ui-multi-select` idiom), giving its `ui-choice-card` children exclusive (single) or toggle (multi)
selection, roving-focus keyboard navigation, the group form value, and the required → valueMissing
validity verdict.

```html
<!-- Single-select -->
<ui-choice-group name="room" required>
  <ui-choice-card value="standard">
    <ui-text as="strong">Standard</ui-text>
  </ui-choice-card>
  <ui-choice-card value="deluxe">
    <ui-text as="strong">Deluxe</ui-text>
  </ui-choice-card>
</ui-choice-group>

<!-- Multi-select -->
<ui-choice-group name="amenities" multiple values='["wifi"]'>
  <ui-choice-card value="wifi">Wi-Fi</ui-choice-card>
  <ui-choice-card value="parking">Parking</ui-choice-card>
</ui-choice-group>
```

## One control, two modes

`multiple` (structural, resolved once at connect) flips the group between **single** (exclusive,
`selectionCommit` mode `'single'`) and **multi** (toggle, mode `'multi-toggle'` — every commit path
unconditionally toggles the targeted card, no modifier keys ever consulted). The committed value rides
`value` (single) or `values` (multi) — distinct, mode-gated props (ADR-0161's per-slot opt-in), never one
always-array shape.

## Card-as-hit-target

Selection commits on the **whole card**, never a sub-element — clicking, Enter, or Space on the
roving-focused card. Cards are ADR-0220's `ui-choice-card`: agent-composed rich content whose entire
surface is the option unit. A card's own `disabled` is honoured (skipped by roving, never committable);
the whole group's effective-disabled state additionally cascades onto every non-individually-disabled
card.

## Discovery

`ui-choice-group` discovers its cards as **nearest-group-scoped descendants** from birth (ADR-0220 cl.7):
any `ui-choice-card` at any nesting depth belongs to the group whose `closest('ui-choice-group')` it
resolves to. A nested inner group is the ownership boundary — its own cards are never roved or committed
by the outer group.

## Layout

The group **owns its interior layout** (ADR-0103, adopted at birth for this family): a responsive
auto-fit card grid, `min` (a CSS length, the column floor) + `gap` (the space-ladder enum) — the exact
`ui-grid` mechanism. No `orientation` prop, no wrapper type, no carousel presentation.

## Keyboard & ARIA

`role="listbox"` (+ `aria-multiselectable` in multi mode) via `ElementInternals`. Arrow keys rove focus
in tree order over owned, non-disabled cards (looping); Home/End jump to first/last. Commit is always
**explicit activation** — click, Enter, or Space — never selection-follows-focus, so browsing rich cards
never accidentally commits a choice.

## Form participation

Single mode: `formValue()` returns the committed key string, or `null` when empty. Multi mode:
`formValue()` returns a `FormData` with one entry per selected value (native `<select multiple>`
parity) — zero selections submits nothing. `required` + an empty selection raises `valueMissing`.
