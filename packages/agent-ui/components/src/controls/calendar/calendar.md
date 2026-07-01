---
# calendar.md frontmatter — the attributes-as-API descriptor for ui-calendar (ADR-0004 /
# control-suite-wave5-input-codecs-pickers.decomp.md 5B-1 / ADR-0048). The machine-checkable
# public surface lives HERE (frontmatter); the prose below the fence is the /site doc. The
# `attributes[]` block MUST mirror UICalendarElement.props — the contract↔props trip-wire
# (calendar.test.ts) and the frontmatter schema (validateComponentDescriptor) both target this
# fence. Field set per docs/plan.md §10 / ADR-0004; grid navigation per ADR-0048 decision 2;
# form-value per UIFormElement / ADR-0013; [data-box] panel per ADR-0046.
tag: ui-calendar
tier: pattern           # a composite picker: nav + 2D grid + form-associated selection
extends: UIFormElement  # form-associated: formValue() = ISO string; formValidity() = valueMissing + range
# marginal: tracked at the wave-5 integration slice (s12 barrel pass); ≤ ~3 kB tier budget (plan §10)

attributes:             # attributes-as-API — mirrors UICalendarElement.props (formProps spread first, then own)
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
    reflect: true       # reflects + BINDABLE — value:{prop:'value',event:'change'} two-way bind; '' = no date
  - name: min
    type: string
    default: ''
    reflect: true       # reflected for native attribute-IDL parity with text-field min/max (ADR-0047 fleet consistency)
  - name: max
    type: string
    default: ''
    reflect: true       # reflected symmetrically with min (ADR-0047)
  - name: size
    type: enum
    values: [sm, md, lg]
    default: md
    reflect: true       # reflected so [size=sm/lg] CSS rules engage on both JS-set and HTML-authored values (fleet standard)

properties:             # IDL beyond attributes-as-API
  - name: name
    description: The form-submission key (string). Reflects the `name` attribute.
  - name: disabled
    description: Whether the control is disabled (boolean). Reflects `disabled`. Nav buttons + day cells become pointer-inert when disabled. effectiveDisabled() also responds to ancestor <fieldset disabled>.
  - name: required
    description: Whether a selection is required (boolean). Reflects `required`. Drives formValidity() → valueMissing when value=''.
  - name: value
    description: The selected date as an ISO 'YYYY-MM-DD' string ('' = nothing selected). Reflected + bindable (two-way via `change` event). Setting it programmatically updates aria-selected on cells via the reactive effect.
  - name: min
    description: The earliest selectable date, ISO 'YYYY-MM-DD' ('' = unbounded). Out-of-range cells get aria-disabled='true' and commit is a no-op. Drives formValidity() → rangeUnderflow.
  - name: max
    description: The latest selectable date, ISO 'YYYY-MM-DD' ('' = unbounded). Out-of-range cells get aria-disabled='true' and commit is a no-op. Drives formValidity() → rangeOverflow.

events:
  - name: change
    detail: 'null'
    description: Fired when the user commits a new date (Enter / Space / click on an enabled cell). No custom detail — callers read `el.value` for the ISO date. Also drives the value two-way bind (value:{prop:'value',event:'change'}).
  - name: select
    detail: 'string'
    description: Fired alongside `change` on commit. Detail = the committed ISO 'YYYY-MM-DD' string. Used by the type=date overlay wiring in slice 5B-3 to set the text-field value + close the overlay.

slots:
  - name: default
    optional: true
    description: ui-calendar has no slotted content — all anatomy is control-created (the panel + nav header + 7-column grid are built once in #ensureShell() and populated by #rebuildGrid()). Authors do not slot day cells or header rows.

parts:
  - name: panel
    description: The `<div data-part="panel" data-box>` that wraps the nav and grid. Opts into the shared container box-model (inset margins + sticky header). Gets the panel surface paint (bg/border/radius from --ui-calendar-panel-* tokens).
  - name: nav
    description: The `<header data-part="nav">` sticky navigation bar. Contains the prev button, title span, and next button. container-box.css gives it display:flex + padding + gap; calendar.css adds justify-content:space-between.
  - name: prev
    description: The `<button data-part="prev" type="button" aria-label="Previous month">‹</button>` nav button. Clicking navigates to the previous month; focus cursor moves to the same day (clamped).
  - name: title
    description: The `<span data-part="title" aria-live="polite">Month YYYY</span>` month/year label. aria-live=polite announces month changes to AT. ID is stable per instance (used by [data-part=grid]'s aria-labelledby).
  - name: next
    description: The `<button data-part="next" type="button" aria-label="Next month">›</button>` nav button. Clicking navigates to the next month; focus cursor moves to the same day (clamped).
  - name: grid
    description: The `<div data-part="grid" role="grid" aria-labelledby="…title-id">` container for the weekday header row and 6 week rows. A 7-column CSS grid; [role=row] children use display:contents. The bespoke 2D keyboard handler (ADR-0048 decision 2) is attached here. Rebuilt on month navigation.

customStates: []        # no :state() internals — selection state is on aria-selected (gridcell attribute), not the host

face:
  formAssociated: true  # UIFormElement: formValue/formValidity/formReset/formStateRestore seams active

aria:
  role: none            # host carries NO explicit role (ARIA rides the parts: grid, row, columnheader, gridcell)
  grid: role=grid on [data-part=grid], aria-labelledby → title id
  rows: role=row on each [div] row wrapper inside the grid
  columnheader: role=columnheader on each weekday-header <span> (+ aria-label=full name + abbr)
  gridcell: role=gridcell on each day <button> (overrides implicit button role)
  aria-selected: true on the committed value cell; false on all others
  aria-disabled: true on out-of-range / disabled cells (commit is a no-op even if clicked)
  aria-live: polite on [data-part=title] — announces month/year change to AT on navigation
  tabindex: roving (one cell = 0, others = -1); priority = #focusIso cursor → value → today → 1st

keyboard:
  - key: ArrowLeft
    description: Move focus −1 day. Crosses month boundaries (rebuilds grid for new month).
  - key: ArrowRight
    description: Move focus +1 day. Crosses month boundaries (rebuilds grid for new month).
  - key: ArrowUp
    description: Move focus −7 days (one week back). May cross month boundary.
  - key: ArrowDown
    description: Move focus +7 days (one week forward). May cross month boundary.
  - key: Home
    description: Move focus to Sunday of the current week.
  - key: End
    description: Move focus to Saturday of the current week.
  - key: PageUp
    description: Move focus −1 month (rebuilds the grid). Day clamped to new month's last day.
  - key: Shift+PageUp
    description: Move focus −1 year (rebuilds the grid). Day clamped to new month's last day.
  - key: PageDown
    description: Move focus +1 month (rebuilds the grid). Day clamped to new month's last day.
  - key: Shift+PageDown
    description: Move focus +1 year (rebuilds the grid). Day clamped to new month's last day.
  - key: Enter
    description: Commit the focused date (emits change + select). No-op if aria-disabled. preventDefault so a calendar-inside-an-overlay doesn't re-trigger its anchor button (ADR-0048 / ADR-0045 semantics).
  - key: Space
    description: Same as Enter — commit the focused date. No-op if aria-disabled.

geometry:
  tier: pattern                         # composite control; panel is Container/surface, cells are square targets
  cellSize: --ui-calendar-cell-size     # the square side of each day cell (default 2rem / 32px; [size=sm/lg] repoints)
  gap: --ui-calendar-gap                # inter-cell gap (default 0.125rem / 2px)
  panel: Container/surface              # bg + outline + radius from --ui-calendar-panel-* tokens (NOT a control height)
  navButtons: inline affordance = font  # ‹ › are font-sized glyphs (§4.6 law; no icon cell)
  weekdayHeader: 0.75 × cell-size tall  # slightly shorter than day cells; 85% font size

forcedColors: 'selected-fill (Highlight/HighlightText) + today-ring (ButtonText inset ring) are preserved via forced-color-adjust:none on the relevant cells; panel maps to Canvas/CanvasText; nav buttons to ButtonText; disabled cells to GrayText. Three-state distinctness: focus=Highlight-outside, selected=Highlight-fill, today=ButtonText-inset.'
---

# ui-calendar

A standalone month-grid date picker that is a FACE form control (contributes a selected ISO
`YYYY-MM-DD` date to a form) and will also serve as the popup body for `<ui-text-field type=date>`
(lazily imported there in Wave 5B-3).

## Anatomy

The control creates a `[data-box]` panel (adopting the shared container box-model from ADR-0046)
that holds a `<header>` navigation bar (‹ prev · month-year title · next ›) and a 7-column CSS
grid of day cells. The grid is rebuilt on month navigation; the shell (panel + header + grid
container) is created ONCE (idempotent across disconnect/reconnect).

## Selection

Clicking or pressing Enter/Space on an enabled day cell commits the date: sets `value` to the
ISO string, emits `change` + `select`. Disabled/out-of-range cells show `aria-disabled=true`
and ignore commit gestures (pointer-events:none + no-op in the keyboard handler).

Adjacent-month overflow cells (shown as `[data-outside]`) are dimmed but interactive: clicking
one navigates to that month and commits the date.

## Keyboard

The bespoke 2D handler (ADR-0048 decision 2; NOT a 2D fork of the roving-focus trait) keeps a
single roving `tabindex=0` and handles Arrow/Home/End/PageUp/PageDown. `preventDefault()` is
called on all grid keys so a calendar inside an overlay doesn't re-trigger the anchor button
when Enter commits (the ADR-0045/ADR-0048 commit semantics).

## Form

`UICalendarElement extends UIFormElement`. The base class's reactive effects publish
`formValue()` (the ISO string, null when none) and `formValidity()` (valueMissing when
`required` + empty; rangeUnderflow/Overflow when outside `[min,max]`) to the platform via
`internals.setFormValue`/`setValidity` automatically. `formReset()` restores the initial
`value` attribute; `formStateRestore()` accepts an ISO string.
