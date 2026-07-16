---
# select.md frontmatter — the attributes-as-API descriptor for ui-select (ADR-0004 /
# control-suite-wave4-overlay.decomp.md S4 / ADR-0043). The machine-checkable public
# surface lives HERE (frontmatter); the prose below the fence is the /site doc. The
# `attributes[]` block MUST mirror UISelectElement.props — the contract↔props trip-wire
# (select.test.ts) and the frontmatter schema (validateComponentDescriptor) both target
# this fence. Field set per .claude/docs/plan.md §10 / ADR-0004; overlay mechanism per the
# overlay-controller LLD-C1..C4; bindable `open` two-way per ADR-0019; form-value
# per UIFormElement / ADR-0013; ADR-0043 = the overlay + listbox select gate (S4).
tag: ui-select
tier: pattern           # geometry composite: trigger = Control class; panel = Container/surface; rows = legacy item-pad
extends: UIFormElement  # form-associated: formValue() = selected key; formValidity() = valueMissing
# marginal: tracked at the wave-4 integration slice (s12 barrel pass); ≤ ~3 kB tier budget (plan §10)

attributes:             # attributes-as-API — mirrors UISelectElement.props (formProps spread first, then own)
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
    type: string
    default: ''
    reflect: true       # reflects + BINDABLE — value:{prop:'value',event:'select'} two-way bind; '' = nothing selected
  - name: label
    type: string
    default: ''
    reflect: true       # TKT-0069 item 2 ruling: label reflects fleet-wide
  - name: open
    type: boolean
    default: false
    reflect: true       # reflects + BINDABLE — value:{prop:'open',event:'toggle'} two-way bind (ADR-0019); drives the overlay handle
  - name: placeholder
    type: string
    default: ''
    reflect: false      # not reflected — placeholder is a runtime display hint, not a structural attribute
  - name: size
    type: enum
    values: [sm, md, lg]
    default: md
    reflect: true       # reflects so the [size] attribute-selector repoint in select.css (trigger height/font/icon/gap) applies to JS-set values (T7 coherence fix, ADR-0081 doc-tail)

properties:             # IDL beyond attributes-as-API
  - name: name
    description: The form-submission key (string). Reflects the `name` attribute.
  - name: disabled
    description: Whether the control is disabled (boolean). Reflects `disabled`. The trigger is pointer-inert when disabled.
  - name: required
    description: Whether a selection is required (boolean). Reflects `required`. Drives formValidity() → valueMissing when nothing selected.
  - name: value
    description: The selected option key (the `value` attribute of the committed [role=option] child). '' = nothing selected. Reflected + bindable (two-way via `select` event). Setting it programmatically updates the trigger label via a scope-owned effect.
  - name: label
    description: The bare-usage accessible-name source (ADR-0085). '' = no label → the trigger's accessible name is content-only (the value text, back-compat). When set (and the control is NOT inside a `ui-field`), the trigger's `aria-labelledby` concatenates a control-created, visually-hidden `[data-part=aria-label]` span (holding this text) with the value span, e.g. "Scheme light". Inside a `ui-field`, the field's own visible label is merged in instead (`applyFieldLabelling`) and this prop is not consumed for naming.
  - name: open
    description: Whether the listbox panel is shown (boolean). Setting true calls showPopover() on the panel (top layer + light-dismiss via Escape + outside-click); false calls hidePopover(). Reflected + bindable (two-way `open`, ADR-0019). The overlay trait emits `close` + `toggle` on every ACTUAL open-state transition (ADR-0101) — light-dismiss, a selection commit's programmatic close, or a model-driven write alike.
  - name: placeholder
    description: The text shown on the trigger when nothing is selected (no option key committed). Not reflected. Updated reactively by a scope-owned effect reading `value` + `placeholder` signals.
  - name: size
    description: The trigger's dimensional-ramp step ('sm' | 'md' | 'lg', default 'md'). Reflects `size`. Repoints the trigger's height/font/icon/gap via the [size] attribute-selector block in select.css (the same axis as ui-text-field).

events:
  - name: select
    detail: 'string'
    description: Fired when the user commits a selection (click or Enter on an option). Detail is the committed option key string. Also drives the value two-way bind (value:{prop:'value',event:'select'}).
  - name: toggle
    detail: 'null'
    description: Fired on EVERY actual open-state transition — platform-driven (Escape / outside-click), component-driven (a selection commit), or model-driven (a programmatic `open` write) — the value:{event:'toggle'} two-way signal for the `open` bind (ADR-0019). Emitted after `el.open` has settled to its new value (ADR-0101). NOTE: the default A2UI catalog does not bind Select's `open` today (ADR-0053) — this event is fired for any consumer (e.g. the docs-site gallery read-back) that listens directly.
  - name: close
    detail: 'null'
    description: Fired alongside `toggle` on every actual hide (never on a show) — the family close event, whatever drove the hide. Fires BEFORE `toggle` (ADR-0101 mechanic 3).

slots:
  - name: options
    optional: false
    description: Provide [role=option] children as direct children of ui-select. They are adopted into the control-created listbox panel at first connect AND on every later light-DOM mutation (TKT-0026, 2026-07-12) — a MutationObserver on the host's own childList (the ui-split dynamic-panes precedent) adopts a newly-appended Option or [role=group] the moment it lands, in the order it was added. Each option must have a `value` attribute (the option key) and text content (the visible label). GROUPS (optgroup parity) — wrap options in a `<div role="group" label="…">`; the control renders a non-interactive group header from `label` (or `aria-label`), moves the group with its nested options, and names the group for AT via aria-labelledby → the header. rovingFocus + selectionCommit already read the live DOM on every event (select.ts's own "dynamic option sets" contract), so a late-adopted option is immediately selectable — no extra wiring needed. DYNAMIC OPTIONS — adding an Option/group after connect adopts it at the panel's tail (the only position a native DOM mutation can ever legally target once earlier options have relocated into the panel); removing an already-adopted option (`optionEl.remove()`) leaves the panel immediately, with no automatic `value` clearing if the removed option was the current selection (the author's call, matching the ui-split precedent's own "decide and name it" latitude). No disconnect/reconnect is required to add or remove options anymore — the prior "rebuild the element" workaround (the docs-site provider-switcher dogfood gap, 2026-07-04) is superseded.

parts:
  - name: trigger
    description: The control-created `<button data-part="trigger" type="button">`. Control-class height from --ui-select-height. Contains [data-part=label] (the visible label / placeholder) and [data-part=caret] (the caret-down Phosphor glyph, aria-hidden, sized = font per the §4.1 caret law). Always lays out as [label | caret] (1fr + auto grid). Gets aria-haspopup="listbox", aria-expanded (synced via scope-owned effect), aria-controls pointing to the listbox id.
  - name: label
    description: A `<span data-part="label">` inside the trigger, with a stable id. Shows the text content of the selected [role=option], or the placeholder text when nothing is selected. Updated by a scope-owned reactive effect reading the `value` + `placeholder` signals. Also the SECOND id in the trigger's `aria-labelledby` concatenation (ADR-0085) — the value stays in the accessible name and recomputes live as the selection changes.
  - name: caret
    description: A `<span data-part="caret" aria-hidden="true">` inside the trigger, injected with the Phosphor `caret-down` glyph via `setIcon` (@agent-ui/icons). An inline affordance sized = font (the §4.1 caret law). CSS centres it in an icon-sized cell by padding = ½(icon−glyph).
  - name: aria-label
    description: A control-created, visually-hidden `<span data-part="aria-label">` (ADR-0085), a host-level sibling of the trigger — always present (idempotent-parts), CSS-clipped (not `hidden`/`display:none`). Holds the `label` prop's text and is the FIRST id in the trigger's bare-usage `aria-labelledby` concatenation. Inert (unreferenced) when `label` is empty or the control is inside a `ui-field` (the field's own visible label is used instead).
  - name: listbox
    description: The control-created `<div data-part="listbox" role="listbox">`. Container/surface in the Popover API top layer when open. Author's [role=option] children (and [role=group] containers) are moved here at first connect. The overlay controller sets popover="auto" + position:fixed + inset; CSS adds bg/border/radius/padding. tabindex="-1" allows fallback focus when no option has tabindex=0.
  - name: group-label
    description: A control-created `<div data-part="group-label">` prepended inside each author `<div role="group" label="…">` (optgroup parity). Renders the group's `label` (or `aria-label`) as a non-interactive, muted header; the group's aria-labelledby points to it. NOT a [role=option] — rovingFocus + selectionCommit skip it, so it never receives focus or commits.

customStates:           # open/closed is the panel's popover top-layer presence, not a custom state
  - user-invalid        # ADR-0051 — set only AFTER the trigger has been focused and blurred (selectionCommit never emits a native `change` event, so blur is the sole interaction signal here), via the trackUserInvalid controller, gating the trigger's danger border

face:
  formAssociated: true  # form-associated FACE control — submits the selected option key under `name`
  formValue: The selected option's `value` attribute string. null (no FormData entry) when nothing is selected.
  formValidity: required + nothing selected → valueMissing. Default: valid.
  formReset: Restores `value` to '' (nothing selected) on HTMLFormElement reset.

aria:
  role: none                # the host has no explicit ARIA role (a logical select wrapper)
  roleSource: none          # role is on the trigger (aria-haspopup) and the panel (role=listbox attribute)
  invalidState: aria-invalid on the trigger (the role-carrying part), mirrors :state(user-invalid) (ADR-0051)
  labelSource: The trigger's aria-labelledby CONCATENATES a name source with the visible [data-part=label] value span (never aria-label, which would erase the value on a button) — bare usage = the `label` prop via a hidden [data-part=aria-label] span + the value span; fielded usage (inside ui-field) = the field's visible label + the value span (merge, not clobber); no label and no field = content-only (back-compat, today's default).

keyboard:
  - keys: Enter / Space
    action: Activates the trigger button (native button behaviour handles Space/Enter — the button's click fires, flipping the `open` prop, which the model→overlay effect drives to `handle.open()`).
  - keys: ArrowDown / ArrowUp (on closed trigger)
    action: Opens the listbox panel. Focus moves to the current selection (or first option) via the overlay controller's moveFocusIn, which targets the tabindex=0 option maintained by rovingFocus.
  - keys: ArrowDown / ArrowUp (in open panel)
    action: Moves roving focus to the next/previous non-disabled option (vertical rovingFocus with looping). The type-ahead buffer (200ms) also activates.
  - keys: Home / End (in open panel)
    action: Moves roving focus to the first/last non-disabled option.
  - keys: Enter (on focused option)
    action: Commits the focused option (selectionCommit Enter handler). Sets value to the option key, closes the panel, restores focus to the trigger, emits `select`.
  - keys: Escape
    action: Closes the open panel (Popover API popover=auto light-dismiss; emits `close` + `toggle` on the host; syncs open=false).
  - keys: Tab
    action: When the panel is open, Tab moves focus outside the panel and closes it via outside-click/focus-loss (popover=auto behaviour).

geometry:
  sizeClass: composite
  trigger:
    height: var(--ui-select-height)           # Control class — off the §1-row ramp (ADR-0038)
    font: var(--ui-select-font)
    icon: var(--ui-select-icon)               # the caret CELL is icon-wide
    glyph: var(--ui-select-glyph)             # = font, the §4.1 caret law
    radius: var(--ui-select-radius)           # = --ui-radius-base (shared fleet radius)
    minInlineSize: var(--ui-select-min-inline-size)  # the 10ch host floor (ADR-0021 lesson)
  listbox:
    sizeClass: Container/surface
    bg: var(--ui-select-listbox-bg)
    radius: var(--ui-select-listbox-radius)
    padding: var(--ui-select-listbox-padding)  # = h/4 (h = --ui-select-height) — DERIVED off the trigger ramp (2026-07-06), scales with [size]
    minInlineSize: var(--ui-select-listbox-min-inline-size)
    maxBlockSize: var(--ui-select-listbox-max-block-size) (scrolls) # PUBLIC dial (TKT-0027), default min(50vh, calc(12 * var(--ui-select-height) + 13 * var(--ui-select-listbox-padding) + 2px)) — 12 real option rows (the row-height law makes a row == --ui-select-height exactly) + their insets + the panel's own 2px border (box-sizing: border-box) or half the viewport, whichever is smaller; was a flat 40vh
  options:
    sizeClass: legacy item-pad (ROV-C5 / §5.1) — numbers DERIVED off the trigger ramp (2026-07-06), not the fixed px this superseded
    paddingBlock: var(--ui-select-option-block)    # = (h − font)/2 — row height == trigger height
    paddingInline: var(--ui-select-option-inline)  # = h/4 — pairs with listbox padding to total h/2 (option text aligns under the trigger label)
    font: var(--ui-select-option-font)             # = --ui-select-font (was size-blind; bug fix)

forcedColors: A `@media (forced-colors: active)` block keeps the trigger (ButtonText/ButtonBorder/ButtonFace), the listbox panel (Canvas/CanvasText), and the option hover/selected/focus states (Highlight/HighlightText) visible in Windows High Contrast Mode.
---

# ui-select

`ui-select` is a **single-select form control** built on the Overlay controller
(overlay-controller.lld.md · ADR-0043), `rovingFocus`, and `selectionCommit`. It extends
`UIFormElement` and is **form-associated** — the selected option key submits under `name`.
It **proves** overlay + listbox together: Wave-4 S4's green smoke (Chromium + WebKit) is
the ⭐ **ADR-0043 select gate**.

```html
<!-- Basic single-select -->
<ui-select name="fruit" placeholder="Choose a fruit">
  <div role="option" value="apple">Apple</div>
  <div role="option" value="banana">Banana</div>
  <div role="option" value="cherry">Cherry</div>
</ui-select>

<!-- Required, with a pre-selected value -->
<ui-select name="tier" value="pro" required>
  <div role="option" value="free">Free</div>
  <div role="option" value="pro">Pro</div>
  <div role="option" value="enterprise">Enterprise</div>
</ui-select>

<!-- Disabled -->
<ui-select name="region" disabled>
  <div role="option" value="us">United States</div>
  <div role="option" value="eu">Europe</div>
</ui-select>
```

## Anatomy

The control creates two internal parts on first connect:

- **trigger** — a `<button type="button">` with `aria-haspopup="listbox"` + `aria-expanded` + `aria-controls`. Contains a **label span** (the selected option's text or the placeholder) and a **caret span** (a Phosphor `caret-down` glyph, sized = font).
- **listbox** — a `<div role="listbox">` panel in the Popover API top layer when open. The author's `[role=option]` children are adopted into this panel at first connect AND on every later light-DOM mutation (TKT-0026) — an Option appended after connect adopts too, in the order it was added.

## Selection

Set or read the selected option key via the `value` property (or `value` attribute). The
trigger label updates reactively. `formValue()` submits the key under `name`. When nothing
is selected (`value = ''`), the placeholder is shown and the form entry is absent (`null`).

## Keyboard

- **Closed trigger**: Enter/Space opens the panel (native button). ArrowDown/ArrowUp also opens it, landing focus on the current selection.
- **Open panel**: Arrow keys rove focus through options; Home/End jump to first/last; Enter commits; Escape closes.

## Accessibility

The trigger has `aria-haspopup="listbox"` + `aria-expanded` (synced to `open`). The panel carries `role="listbox"`. Each option carries `aria-selected` (driven by `selectionCommit`). Focus is restored to the trigger on close. The host has no explicit role.

## The panel scroll cap (TKT-0027)

`--ui-select-listbox-max-block-size` is a public dial capping the listbox's height, defaulting to
`min(50vh, calc(12 * var(--ui-select-height) + 13 * var(--ui-select-listbox-padding) + 2px))` — the
smaller of half the viewport or twelve real option rows (plus their box-model insets, plus a 2px
border-box compensation — the listbox is `box-sizing: border-box` with a 1px border, so without
this term the 12th row would overflow its own cap by exactly the border width, FIXED 2026-07-12),
replacing the old flat 40vh. An option row renders at exactly `--ui-select-height` (the row-height
law above), so the cap tracks `[size]` for free — a `size="lg"` select's listbox scrolls at twelve
*taller* rows, not the same fixed pixel count.
