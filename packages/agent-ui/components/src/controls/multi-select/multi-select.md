---
# multi-select.md frontmatter — the attributes-as-API descriptor for ui-multi-select (ADR-0004 ·
# multi-select-field.lld.md · multi-select-field.spec.md · ADR-0175). The machine-checkable public
# surface lives HERE (frontmatter); the prose below the fence is the /site doc. The `attributes[]`
# block MUST mirror UIMultiSelectElement.props — the contract↔props trip-wire (multi-select.test.ts) and
# the frontmatter schema (validateComponentDescriptor) both target this fence. Field set per
# .claude/docs/plan.md §10 / ADR-0004; form-value per UIFormElement / ADR-0013; geometry per LLD-C5.
tag: ui-multi-select
tier: pattern           # geometry composite: no trigger — a virtual row-height lever; listbox = Container/surface; rows = legacy item-pad (LLD-C5)
extends: UIFormElement  # form-associated: formValue() = a FormData, one entry per selected value; formValidity() = valueMissing
# marginal: tracked at the integration slice (npm run size); ≤ ~3 kB tier budget (plan §10, the ui-select `tier: pattern` precedent)

attributes:             # attributes-as-API — mirrors UIMultiSelectElement.props (formProps spread first, then own)
  - name: name
    type: string
    default: ''
    reflect: true       # reflects for native form-submission keying (FACE form-control parity)
  - name: disabled
    type: boolean
    default: false
    reflect: true       # reflects so [disabled] attribute-selector styling applies to JS-set values
  - name: required
    type: boolean
    default: false
    reflect: true       # reflects so [required] styling applies; drives formValidity() valueMissing
  - name: value
    type: json
    default: ''         # the LIVE default is `[]` — String([])==='' (the table-model.ts tableSelectedProp precedent)
    reflect: false       # NOT reflected — bindable selection state, not an authored dimension; the attribute is still INBOUND-parsed
  - name: label
    type: string
    default: ''
    reflect: true       # the ADR-0085 bare-usage accessible-name source
  - name: size
    type: enum
    values: [sm, md, lg]
    default: md
    reflect: true       # reflects so the [size] attribute-selector repoint in multi-select.css (the virtual row-height lever) applies to JS-set values too
  - name: answered
    type: boolean
    default: false
    reflect: false      # ADR-0196 (GH #1065) — the answered/settled choice state; mirrored into :state(answered) on the host, never AX-reflected

properties:             # IDL beyond attributes-as-API
  - name: name
    description: The form-submission key (string). Reflects the `name` attribute.
  - name: disabled
    description: Whether the control is disabled (boolean). Reflects `disabled`. Every option is marked aria-disabled while the whole control is disabled (own || ancestor <fieldset disabled>, effectiveDisabled).
  - name: required
    description: Whether at least one selection is required (boolean). Reflects `required`. Drives formValidity() → valueMissing when value.length === 0.
  - name: value
    description: The selected option keys (string[]), NEVER null/undefined — [] when nothing is selected (SPEC-R4). Bindable (two-way via the `select` event). Setting it programmatically re-paints aria-selected on every matching option (SPEC-R5 AC2) — no page-side aggregation needed.
  - name: label
    description: The bare-usage accessible-name source (ADR-0085). '' = no label → the host's accessible name is content-only. When set (and the control is NOT inside a `ui-field`), it drives `internals.ariaLabel` directly (the host carries `internals.role`, so no visually-hidden span is needed — unlike ui-select's trigger button, this control has no distinct "current value" text an aria-label could erase). Inside a `ui-field`, the base UIFormElement's own guarded `applyFieldLabelling` default wires `ariaLabelledByElements` from the field's visible label instead.
  - name: size
    description: The dimensional-ramp step ('sm' | 'md' | 'lg', default 'md'). Reflects `size`. Repoints the virtual row-height lever (height/font/icon) via the [size] attribute-selector block in multi-select.css — the same axis as ui-select, minus a trigger.

events:
  - name: select
    detail: 'ReadonlySet<string>'
    description: Fired when the user toggles an option's membership (click or Enter/Space on an option — no modifier keys, ever). Detail is the committed Set of selected keys. Also drives the value two-way bind (value:{prop:'value',event:'select'}).

slots:
  - name: options
    optional: false
    description: Provide [role=option] children as direct children of ui-multi-select — they stay direct children (the host itself IS the listbox; there is no separate control-created panel to move them into, unlike ui-select). Each option needs a `value` attribute (the selection key) and text content (the label). A MutationObserver re-syncs aria-selected/aria-disabled paint on every later light-DOM mutation, so a late-appended option is immediately correctly painted (matching its membership in the CURRENT `value` array) and immediately selectable (rovingFocus/selectionCommit already read the live DOM on every event). Removing a selected option leaves it in `value` until the next user toggle (the ui-select "no automatic clearing" precedent).

parts: []               # light-DOM host-as-listbox; the checkmark paints via ::before on each [role=option], no control-created DOM parts

customStates:
  - user-invalid        # ADR-0051 — set only AFTER the first interaction (blur; this control never emits a native `change` event), via the trackUserInvalid controller, gating the danger outline
  - disabled             # mirrors the effective-disabled channel (own `disabled` OR ancestor <fieldset disabled>) for the CSS `:is([disabled], :state(disabled))` selector

face:
  formAssociated: true  # form-associated FACE control — submits MULTIPLE entries under `name`, one per selected value
  formValue: A FormData with one `.append(name, v)` per selected value (SPEC-R5) — matches native <select multiple>/checkbox-group FormData semantics. Zero selections → an empty FormData() (submits nothing).
  formValidity: required + value.length === 0 → valueMissing. Default: valid.
  formReset: Restores `value` to the array the `value` ATTRIBUTE held at connect time (the combo-box.md "the attribute seeds the reset baseline" convention).

aria:
  role: listbox                      # set via internals.role in connected() — never a host role attribute (FACE)
  roleSource: internals
  multiSelectable: internals.ariaMultiSelectable = 'true' — a real ARIAMixin IDL member (SPEC-R8), never a bespoke ARIA invention
  invalidState: internals.ariaInvalid — 'true' / null, mirrors :state(user-invalid) (ADR-0051)
  labelSource: 'Bare usage — internals.ariaLabel from the `label` prop (the base UIFormElement default no-ops while role-less; this control HAS internals.role, so it wires directly, no visually-hidden span needed). Fielded usage (inside ui-field) — the base UIFormElement''s own guarded applyFieldLabelling default (ariaLabelledByElements from the field''s visible label), unmodified by this control.'

keyboard:
  - keys: ArrowDown / ArrowUp
    action: Moves roving focus to the next/previous non-disabled option (vertical, looping) — rovingFocus.
  - keys: Home / End
    action: Moves roving focus to the first/last non-disabled option.
  - keys: Space
    action: Toggles the currently roving-focused option's membership (selectionCommit 'multi-toggle' mode). Type-ahead is OFF for this control specifically so Space is never captured by the type-ahead buffer instead.
  - keys: Enter
    action: Toggles the currently roving-focused option's membership — identical outcome to Space.
  - keys: Click on an option
    action: Toggles that option's membership — no modifier required, ever (LLD-C4).
  - keys: Tab
    action: Moves focus out of the control in normal document order — no popup to escape, no light-dismiss.

geometry:
  sizeClass: composite   # a two-part composite (LLD-C5): no trigger — a virtual row-height lever; listbox = Container/surface; rows = legacy item-pad
  lever:
    height: var(--ui-multi-select-height)          # virtual — off the §1-row ramp (ADR-0038), the SAME lookup ui-select's trigger uses
    font: var(--ui-multi-select-font)
    icon: var(--ui-multi-select-icon)               # the checkmark's leading cell size
    glyph: var(--ui-multi-select-glyph)             # = font, the §4.1 caret law, applied to the checkmark
  listbox:
    sizeClass: Container/surface
    bg: var(--ui-multi-select-bg)
    radius: var(--ui-multi-select-radius)
    padding: var(--ui-multi-select-padding)         # = h/4 — DERIVED off the lever (ui-select's listbox-token mechanism copied)
    minInlineSize: var(--ui-multi-select-min-inline-size)
    maxBlockSize: var(--ui-multi-select-max-block-size) (scrolls)  # min(50vh, 12 real option rows + insets + the 2px border compensation) — the ui-select TKT-0027 formula copied
  options:
    sizeClass: legacy item-pad (ROV-C5 / §5.1) — numbers DERIVED off the lever (ui-select's options-token mechanism copied)
    paddingBlock: var(--ui-multi-select-option-block)   # = (h − font)/2
    paddingInline: var(--ui-multi-select-option-inline) # = h/4
    font: var(--ui-multi-select-option-font)            # = --ui-multi-select-font

forcedColors: A `@media (forced-colors: active)` block keeps the listbox surface (Canvas/CanvasText), the option hover/selected/focus states (Highlight/HighlightText), and the checkmark glyph (HighlightText) visible in Windows High Contrast Mode.
---

# ui-multi-select

`ui-multi-select` is a **multi-select FIELD** — an always-visible, non-overlay listbox whose
`[role=option]` rows paint a CSS-only checkmark on selection, toggled by plain click/Space/Enter (no
modifier keys). It extends `UIFormElement` and is **form-associated**: every selected value submits as
its own `FormData` entry under `name`, matching native `<select multiple>`/checkbox-group semantics — and
the SAME selection is also the one bindable `value: string[]` array a consumer reads/binds directly
(`multi-select-field.spec.md` SPEC-R5, ADR-0175).

```html
<!-- Basic multi-select -->
<ui-multi-select name="tags">
  <div role="option" value="design">Design</div>
  <div role="option" value="engineering">Engineering</div>
  <div role="option" value="product">Product</div>
</ui-multi-select>

<!-- Required, with two pre-selected values -->
<ui-multi-select name="skills" value='["js","css"]' required>
  <div role="option" value="js">JavaScript</div>
  <div role="option" value="css">CSS</div>
  <div role="option" value="html">HTML</div>
</ui-multi-select>

<!-- Disabled -->
<ui-multi-select name="regions" disabled>
  <div role="option" value="us">United States</div>
  <div role="option" value="eu">Europe</div>
</ui-multi-select>
```

## Anatomy

No trigger, no popup, no overlay — the host itself carries `role="listbox"` (via `ElementInternals`) and
IS the always-visible surface. The author's `[role=option]` children stay direct light-DOM children (no
control-created panel to move them into, unlike `ui-select`). The checkmark is painted **entirely in
CSS** as `[role=option][aria-selected="true"]::before` — zero DOM injection, matching `ui-checkbox`'s own
"no shadow DOM, no per-node JS injection" precedent.

## Selection

Toggle an option's membership with a plain click, Space, or Enter — no modifier keys, ever (every commit
path is "toggle the one targeted item"). `value` reads/writes the whole array of selected keys and is
**never** `null`/`undefined` (`[]` when nothing is selected). Setting `value` programmatically re-paints
the checked options immediately — `el.value = ['a', 'b']` externally reflects the checked set with no
page-side aggregation code.

## Keyboard

Arrow keys rove focus through options (vertical, looping); Home/End jump to first/last. Space or Enter
toggles the currently-focused option. Type-ahead is off (a deliberate simplification for a small,
already-loaded option list).

## Accessibility

`role="listbox"` + `aria-multiselectable="true"` are set via `ElementInternals` (never host attributes).
Each option carries `aria-selected` (driven by the committed selection). Real DOM focus moves between
options (no active-descendant).

## Form participation

`formValue()` returns a `FormData` with one entry per selected value — a native `<form>` submission
carries **multiple** entries under `name`, exactly like `<select multiple>` or a group of same-named
checkboxes. `required` + zero selections raises `valueMissing`.
