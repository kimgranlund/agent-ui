---
# combo-box.md frontmatter — the attributes-as-API descriptor for ui-combo-box (ADR-0004 /
# control-suite-wave4-overlay.decomp.md S5 / ADR-0043). The machine-checkable public surface
# lives HERE (frontmatter); the prose below the fence is the /site doc. The `attributes[]`
# block MUST mirror UIComboBoxElement.props — the contract↔props trip-wire (combo-box.test.ts)
# and the frontmatter schema (validateComponentDescriptor) both target this fence. Field set per
# .claude/docs/plan.md §10 / ADR-0004; form participation per ADR-0013; overlay per ADR-0043.
tag: ui-combo-box
tier: pattern          # geometry size-class — the editor is Control-class; the panel is Container/surface; the options are item-pad rows (the Geometry-by-part three-class pattern from the decomp)
extends: UIFormElement # form-associated: value + validity participate via ElementInternals (ADR-0013)
# marginal: tracked at the wave-4 integration slice (s12 barrel pass); ≤ ~2 kB tier budget (plan §10)

attributes:            # attributes-as-API — mirrors UIComboBoxElement.props (form-specific first, then formProps)
  - name: value
    type: string
    default: ''
    reflect: false     # NOT reflected — the live committed value is not a host attribute; the attribute seeds the reset baseline (native parity for value-carrying form controls)
  - name: label
    type: string
    default: ''
    reflect: true       # TKT-0069 item 2 ruling: label reflects fleet-wide
  - name: open
    type: boolean
    default: false
    reflect: true      # reflects; drives the overlay handle via a scope-owned effect. NOT the A2UI catalog's two-way mark (corrected 2026-07-06, ADR-0087 Wave B) — the default catalog's ONE value:{prop,event} slot on ComboBox binds the FORM value (value:{prop:'value',event:'change'}, see catalog.json), not `open`; this comment previously claimed value:{prop:'open',event:'toggle'} (copied from the overlay family) before ComboBox's own form value was catalogued
  - name: strict
    type: boolean
    default: false
    reflect: true      # reflects so [strict] drives CSS and is declaratively settable; strict=true opts into constrained mode (committed value must match an option; default-off = free text)
  - name: placeholder
    type: string
    default: ''
    reflect: false     # not reflected (content-only, no CSS hook needed — the TS sets attr(data-placeholder) directly)
  - name: name
    type: string
    default: ''
    reflect: true      # form submission key (FACE; UIFormElement.formProps; reflects for native parity — the FACE submission keys the entry by the name content attribute)
  - name: disabled
    type: boolean
    default: false
    reflect: true      # reflects; pointer-inert + contenteditable=false via CSS/TS; effectiveDisabled = own || form-disabled channel
  - name: required
    type: boolean
    default: false
    reflect: true      # reflects; required && value==='' → valueMissing validity flag

properties:            # IDL beyond attributes-as-API
  - name: label
    description: The bare-usage accessible-name source (ADR-0085). '' = no label → the editor keeps its ADR-0014-style unnamed behaviour (unchanged). When set (and the control is NOT inside a `ui-field`), the editor's `aria-label` is set to this text — the editor's text content stays the DISTINCT accessible value, so nothing is erased. Inside a `ui-field`, the field's own visible label names the editor instead (`applyFieldLabelling`) and the bare `aria-label` yields.
  - name: open
    description: Whether the listbox panel is shown (boolean). Setting true calls showPopover() on the listbox panel (top layer + light-dismiss via Escape + outside-click); false calls hidePopover(). Reflected (NOT the catalog's two-way mark for this control — see the `open` attribute row / the `open` state + form value section below). The overlay trait emits `close` + `toggle` on the host for every ACTUAL open-state transition (ADR-0101) — platform light-dismiss, a commit's/free-text commit's programmatic close, or a model-driven write alike.
  - name: strict
    description: When true, the committed value must match the `value` attribute of a [role=option] child. A non-matching value produces a typeMismatch validity flag. Default false — free text is allowed.
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
  - name: change
    detail: 'null'
    description: Fired on commit — either option-commit (Enter with an active option, or click on an option) or free-text commit (Enter with no active option, strict=false). The committed value is already reflected in `this.value` when the event fires.
  - name: select
    detail: string          # the committed option key (opt.getAttribute('value') ?? opt.textContent ?? '')
    description: Fired on option-commit (when a [role=option] is committed via Enter or click), alongside `change`. Carries the committed option key as detail. NOT fired on free-text commit (no specific option was selected).
  - name: input
    detail: 'null'
    description: NOT currently emitted (the editor's raw input events are suppressed; the filter runs internally). Reserved for future use when a live-value API is added.
  - name: toggle
    detail: 'null'
    description: Fired on EVERY actual open-state transition — platform-driven (Escape / outside-click), component-driven (an option/free-text commit), or model-driven (a programmatic `open` write) — the two-way signal a direct listener (e.g. the docs-site gallery read-back) uses to track `open`; ComboBox's own A2UI catalog two-way slot binds `value`/`change` instead, not `open` (ADR-0087 Wave B). Emitted after `el.open` has settled to its new value (ADR-0101).
  - name: close
    detail: 'null'
    description: Fired alongside `toggle` on every actual hide (never on a show) — the family close event, whatever drove the hide. Fires BEFORE `toggle` (ADR-0101 mechanic 3).

slots:
  - name: options
    optional: false
    description: Provide [role=option] children (e.g. <div role="option" value="apple">Apple</div>) as direct children of ui-combo-box. These are adopted into the control-created listbox panel at connect time AND on every later light-DOM mutation (TKT-0026, 2026-07-12 — the select.ts precedent, a MutationObserver on the host's own childList) — the child-move pattern, ADR-0017 — and serve as the filterable option set. A late-adopted option is re-filtered against whatever text is already typed (it never bypasses an active filter) and gets a stable id lazily, the moment it becomes the active-descendant. Each option must have a `value` attribute (the key submitted to the form) and textContent (the display label). Options without a `value` attribute use their textContent as the key.

parts:
  - name: editor
    description: The control-created `<div data-part="editor" contenteditable="plaintext-only" role="combobox">`. Carries the combobox ARIA role (never on the host — FACE pattern), aria-haspopup="listbox", aria-autocomplete="list", aria-expanded (synced via the scope-owned effect), aria-controls (pointing to the listbox's id), and aria-activedescendant (updated on Arrow navigation). DOM focus lives HERE throughout keyboard navigation — it never moves to the listbox or options (the active-descendant pattern, OVL/ROV-C1).
  - name: listbox
    description: The control-created `<div data-part="listbox" role="listbox" popover="auto" id="...">` that enters the Popover API top layer when open. Author-provided [role=option] children are adopted into this part at connect time AND on every later light-DOM mutation (TKT-0026). Created ONCE (idempotent guard — the same node persists across disconnect/reconnect). The overlay controller sets position:fixed + inset on open.
  - name: empty
    description: The control-created `<div data-part="empty" role="presentation">No matches</div>`, appended LAST inside the listbox (2026-07-07 fix). Hidden by default; `#syncEmptyState()` reveals it exactly when zero `[role=option]` children are visible (the filter matched nothing, or no options were provided at all). Not an option — never navigable, never commit-able. Root-cause fix for a filtered-to-zero panel collapsing to a stray border-only line (no min-block-size, no content): this row gives the panel real, deliberate height and an explicit "no matches" affordance instead.

customStates:           # open/closed state lives on the panel's popover top-layer presence; the active-descendant highlight is [data-active] (a CSS attribute selector, not a custom state)
  - user-invalid        # ADR-0051 — set only AFTER the first interaction (blur/change) via the trackUserInvalid controller, gating the editor's danger border

face:
  formAssociated: true   # FACE form-associated control — value + validity participate via ElementInternals (ADR-0013)
  value: value           # submitted value = the committed option key (or free text if strict=false); null when value==='' (nothing committed — formValue() returns null)
  validity: valueMissing # required && value==='' → valueMissing; strict && no matching option → typeMismatch

aria:
  role: none             # the host has no explicit role; the editor child carries role="combobox" (FACE pattern — ARIA via the part, not the host)
  roleSource: editor-part  # role="combobox" is set on [data-part=editor] via TS, never on the host
  invalidState: aria-invalid on the editor (the role-carrying part), mirrors :state(user-invalid) (ADR-0051)
  labelSource: ADR-0085 drift correction (this clause previously described a `label` slot / `<label for>` path the code never had) — bare usage = the `label` prop → the editor aria-label (text-field ADR-0014 parity, editor text stays the distinct value); fielded usage (inside ui-field) = the field's visible label → the editor aria-labelledby (applyFieldLabelling), the bare aria-label yields.
  activedescendant: the editor's aria-activedescendant attribute points to the id of the [data-active] option (the highlighted option); never moves DOM focus

keyboard:
  - keys: Type characters
    action: Filters the visible options to those whose label contains the typed text (case-insensitive). Opens the listbox panel if not already open. Clears the active-descendant (filter reset).
  - keys: ArrowDown
    action: Opens the panel if closed. Moves the active-descendant DOWN through the visible options (wrapping). Sets aria-activedescendant on the editor to the highlighted option's id and [data-active] on that option. DOM focus stays on the editor.
  - keys: ArrowUp
    action: Opens the panel if closed. Moves the active-descendant UP through the visible options (wrapping). Same ARIA + CSS update as ArrowDown. DOM focus stays on the editor.
  - keys: Enter
    action: If an option is highlighted (active-descendant), commits that option (sets value = option key, editor shows option label, panel closes, emits select + change). If no option is highlighted and strict=false, commits the typed text as a free-text value (emits change). If strict=true and no option highlighted, no commit.
  - keys: Escape
    action: Closes the open panel (the Popover API popover=auto light-dismiss fires; the overlay controller emits close + toggle; the control syncs open=false).
  - keys: Click on an option
    action: Commits the clicked option (same as Enter on that option). The option must not be hidden (filtered out).

geometry:
  sizeClass: pattern     # three-class composite: editor = Control-class; panel = Container/surface; options = item-pad rows
  editor:
    blockSize: var(--ui-combo-box-height)  # = var(--md-sys-height-md) — Control-class height (the trigger field)
    font: var(--ui-combo-box-font)         # = var(--md-sys-font-md) — matches the control tier font
    paddingInline: var(--ui-combo-box-padding-inline)  # = h/2 (calc(var(--ui-combo-box-height) / 2)) — the fleet Control-class value-edge standard (2026-07-06, was --md-sys-space-sm)
    radius: var(--ui-combo-box-radius)     # = var(--md-sys-shape-corner-base) — shared fleet radius
    minInlineSize: var(--ui-combo-box-min-inline-size) # 20ch floor — ADR-0021 entry-control law
  panel:
    surface: var(--ui-combo-box-panel-bg)  # = var(--md-sys-color-neutral-surface) — opaque neutral surface
    radius: var(--ui-combo-box-panel-radius)  # = var(--md-sys-shape-corner-base)
    minInlineSize: var(--ui-combo-box-panel-min-inline-size)  # 12rem panel collapse floor
    maxBlockSize: var(--ui-combo-box-panel-max-block-size) (scrolls) # PUBLIC dial (TKT-0027), default min(50vh, calc(12 * var(--ui-combo-box-height) + 13 * var(--ui-combo-box-listbox-padding) + 2px)) — 12 real option rows (the row-height law makes a row == --ui-combo-box-height exactly) + their insets + the panel's own 2px border (box-sizing: border-box) or half the viewport, whichever is smaller; was a flat 40vh (REVISED 2026-07-04: before that, `overflow: hidden`, unbounded/unscrollable) — gets the shared edge-aware scroll-fade by default (traits/scroll-fade.ts, container-box.css)
    padding: var(--ui-combo-box-listbox-padding)  # = editor-padding-inline/2 = h/4 — DERIVED off the editor ramp (2026-07-06), same mechanism as ui-select
  options:
    sizeClass: legacy item-pad (ROV-C5 / §4.6/5.1) — numbers DERIVED off the editor ramp (2026-07-06), superseding the fixed --md-sys-space-xs/sm px
    paddingBlock: var(--ui-combo-box-option-padding-block)    # = (editor height − option font)/2 — row height == editor height
    paddingInline: var(--ui-combo-box-option-padding-inline)  # = editor-padding-inline/2 = h/4 — pairs with panel padding to total h/2 exactly (the alignment law), same as ui-select (2026-07-06 follow-up: the editor's own padding-inline is now h/2, was --md-sys-space-sm)
    font: var(--ui-combo-box-option-font)  # = --ui-combo-box-font (was size-blind; bug fix)
    note: ui-combo-box has NO `[size]` attribute today (structural divergence from ui-select, flagged not forced) — these tokens are ramp-DERIVED so a future `[size]` addition (its own ADR/decomp) would repoint them for free

forcedColors: A `@media (forced-colors: active)` block maps the editor to Field/FieldText/FieldText border and the panel to Canvas/CanvasText. The active-descendant highlight paints Highlight/HighlightText (with forced-color-adjust:none to preserve it). The focus ring inherits the Highlight system colour via --md-sys-color-focus-ring.
---

# ui-combo-box

`ui-combo-box` is a FACE **form-associated** combo-box: a **contenteditable text input** + a
**top-layer listbox panel** (Popover API). It extends `UIFormElement` and composes the `overlay`
controller (ADR-0043). It is the Wave-4 S5 control — the heaviest overlay; built last because it
composes the proven overlay (S1 ui-popover) and the listbox pattern (S4 ui-select).

```html
<!-- Basic combo-box with options -->
<ui-combo-box placeholder="Search…">
  <div role="option" value="apple">Apple</div>
  <div role="option" value="banana">Banana</div>
  <div role="option" value="cherry">Cherry</div>
</ui-combo-box>

<!-- Strict mode — committed value must match an option -->
<ui-combo-box strict placeholder="Select a fruit…">
  <div role="option" value="apple">Apple</div>
  <div role="option" value="banana">Banana</div>
</ui-combo-box>

<!-- Required, pre-selected -->
<ui-combo-box required value="apple" name="fruit">
  <div role="option" value="apple">Apple</div>
  <div role="option" value="banana">Banana</div>
</ui-combo-box>
```

## Architecture

The host is a `display: inline-grid` shell with a `min-inline-size: 20ch` floor (the ADR-0021
entry-control law — prevents collapse in a flex row). The **editor part** is the visible text
input (`role="combobox"`, `contenteditable="plaintext-only"`); the **listbox panel** is the
control-created `<div role="listbox" popover="auto">` that enters the top layer on open.

Author-provided `[role=option]` children are adopted into the listbox at connect time AND on
every later light-DOM mutation (TKT-0026 — the child-move pattern, ADR-0017, made dynamic). Each
option needs a `value` attribute (the form key) and `textContent` (the display label).

## Active-descendant navigation

This is the **key distinction from `ui-select`**: `ui-combo-box` uses the **active-descendant**
pattern — DOM focus **never leaves the editor**. Arrow keys move a highlighted index; the editor's
`aria-activedescendant` points to the highlighted option's `id`; CSS `[data-active]` paints the
highlight. Screen readers announce the active option without moving focus.

## Filter

Typing in the editor filters the visible options (options whose label does not match the typed
text get `hidden=true`). The panel opens automatically on the first keystroke. The filter clears
on commit. When the filter matches zero options, the panel shows a "No matches" row (the `empty`
part) instead of collapsing to an empty, contentless panel.

## Strict mode

`strict=false` (default): Enter with no active option commits the typed text as a free-text value.
`strict=true`: only option-commits are valid; a non-matching committed value raises `typeMismatch`.

## `open` state + form value

`open` is reflected and directly settable (drives the overlay panel via a scope-owned effect), but it is
NOT the A2UI catalog's two-way mark — the default catalog's ONE `value:{prop,event}` slot on `ComboBox`
binds the FORM value (`value:{prop:'value',event:'change'}`, ADR-0087 Wave B), not `open` (correcting an
earlier stale comment here that named `open`/`toggle`, copied from the overlay family before ComboBox's
own form value was catalogued). `value` holds the **last committed** value — unchanged while the user is
typing. `formValue()` returns `null` when `value` is empty (no form entry submitted, matching native
`<select>` convention).

## The panel scroll cap (TKT-0027)

`--ui-combo-box-panel-max-block-size` is a public dial capping the panel's height, defaulting to
`min(50vh, calc(12 * var(--ui-combo-box-height) + 13 * var(--ui-combo-box-listbox-padding) + 2px))`
— the smaller of half the viewport or twelve real option rows (plus their box-model insets, plus a
2px border-box compensation — the panel is `box-sizing: border-box` with a 1px border, so without
this term the 12th row would overflow its own cap by exactly the border width, FIXED 2026-07-12),
replacing the old flat 40vh. An option row renders at exactly `--ui-combo-box-height` (the
row-height law above), the same shape as `ui-select`'s listbox dial.
