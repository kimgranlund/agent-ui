---
# calendar.md frontmatter — the attributes-as-API descriptor for ui-calendar (ADR-0004 /
# control-suite-wave5-input-codecs-pickers.decomp.md 5B-1 / ADR-0048; range mode: ADR-0093 /
# calendar-range.decomp-v2.json). The machine-checkable public surface lives HERE (frontmatter);
# the prose below the fence is the /site doc. The `attributes[]` block MUST mirror
# UICalendarElement.props — the contract↔props trip-wire (calendar.test.ts) and the frontmatter
# schema (validateComponentDescriptor) both target this fence. Field set per .claude/docs/plan.md
# §10 / ADR-0004; grid navigation per ADR-0048 decision 2; form-value per UIFormElement / ADR-0013;
# [data-box] panel per ADR-0046; mode/range value contract per ADR-0093.
tag: ui-calendar
tier: pattern           # a composite picker: nav + 2D grid + form-associated selection
extends: UIFormElement  # form-associated: formValue() = ISO string (or FormData pair in mode=range); formValidity() = valueMissing + range
# marginal: tracked at the wave-5 integration slice (s12 barrel pass) + the ADR-0093 range-mode re-base; ≤ ~3 kB tier budget (plan §10)

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
  - name: mode
    type: enum
    values: [single, range]
    default: single
    reflect: true       # ADR-0093 clause 1 — selects which value surface is LIVE (see properties below); reflected (DOM/CSS-inspectable)
  - name: value
    type: string
    default: ''
    reflect: true       # reflects + BINDABLE — value:{prop:'value',event:'change'} two-way bind; '' = no date. LIVE only in mode=single; INERT (held+reflected, contributes nothing) in mode=range.
  - name: valueStart
    type: string
    default: ''
    reflect: true       # attribute `value-start` (ADR-0093 clause 1, mirrors ui-slider-multi's valueLo). LIVE only in mode=range; INERT in mode=single.
  - name: valueEnd
    type: string
    default: ''
    reflect: true       # attribute `value-end` (ADR-0093 clause 1, mirrors ui-slider-multi's valueHi). LIVE only in mode=range; INERT in mode=single.
  - name: min
    type: string
    default: ''
    reflect: true       # reflected for native attribute-IDL parity with text-field min/max (ADR-0047 fleet consistency); applies to EVERY pickable date regardless of mode
  - name: max
    type: string
    default: ''
    reflect: true       # reflected symmetrically with min (ADR-0047); applies regardless of mode
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
    description: Whether a selection is required (boolean). Reflects `required`. Drives formValidity() → valueMissing when the live surface is empty.
  - name: mode
    description: "'single' (default) or 'range' (ADR-0093). ONE-LIVE-VALUE-SURFACE rule — exactly one value surface is live per mode: mode=single → `value` live, `valueStart`/`valueEnd` inert; mode=range → the pair live, `value` inert. Inert = held + reflected but contributes NOTHING to render/formValue/formValidity/events. The control never writes an off-mode prop on a mode switch (no destructive clearing) — declarative markup (`<ui-calendar mode=\"range\" value-start=\"…\" value-end=\"…\">`) is upgrade-order-safe."
  - name: value
    description: The selected date as an ISO 'YYYY-MM-DD' string ('' = nothing selected). Reflected + bindable (two-way via `change` event). LIVE only in mode=single. Setting it programmatically updates aria-selected on cells via the reactive effect.
  - name: valueStart
    description: The range start date, ISO 'YYYY-MM-DD' ('' = unset). Reflects the `value-start` attribute. LIVE only in mode=range — the anchor set by the first pick; keeps its own endpoint mark even when a later, earlier pick swap-completes the range (ADR-0093 clause 3).
  - name: valueEnd
    description: The range end date, ISO 'YYYY-MM-DD' ('' = unset, i.e. selecting-end / half-open). Reflects the `value-end` attribute. LIVE only in mode=range. `valueStart`/`valueEnd` are NEVER auto-swapped by the control if set programmatically out of order — they stay inverted and formValidity() reports it (ADR-0093 clause 2).
  - name: min
    description: The earliest selectable date, ISO 'YYYY-MM-DD' ('' = unbounded). Out-of-range cells get aria-disabled='true' and commit is a no-op. Drives formValidity() → rangeUnderflow (checked against the live surface's date(s)).
  - name: max
    description: The latest selectable date, ISO 'YYYY-MM-DD' ('' = unbounded). Out-of-range cells get aria-disabled='true' and commit is a no-op. Drives formValidity() → rangeOverflow (checked against the live surface's date(s)).

events:
  - name: change
    detail: 'null'
    description: 'mode=single — fired when the user commits a new date (Enter / Space / click on an enabled cell); callers read `el.value`. mode=range — fired ONLY when a pick COMPLETES the pair (the second commit gesture); callers read `el.valueStart`/`el.valueEnd`. Also drives the value two-way bind (value:{prop:''value'',event:''change''}) in mode=single.'
  - name: select
    detail: 'string'
    description: 'mode=single — fired alongside `change` on commit; detail = the committed ISO date. mode=range — fired on EVERY commit gesture (both the anchor pick and the completing pick); detail = the RAW picked ISO date (not necessarily the normalized start/end after a swap). Used by the type=date overlay wiring in slice 5B-3 to set the text-field value + close the overlay.'

slots:
  - name: default
    optional: true
    description: ui-calendar has no slotted content — all anatomy is control-created (the panel + nav header + 7-column grid are built once in #ensureShell() and populated by #rebuildGrid()). Authors do not slot day cells or header rows.

parts:
  - name: panel
    description: The `<div data-part="panel" data-box>` that wraps the nav, grid, and status region. Opts into the shared container box-model (inset margins + sticky header). Gets the panel surface paint (bg/border/radius from --ui-calendar-panel-* tokens).
  - name: nav
    description: The `<header data-part="nav">` sticky navigation bar. Contains the prev button, title span, and next button. container-box.css gives it display:flex + padding + gap; calendar.css adds justify-content:space-between.
  - name: prev
    description: The `<button data-part="prev" type="button" aria-label="Previous month">` nav button, injected with the Phosphor `caret-left` glyph via `setIcon` (@agent-ui/icons). Clicking navigates to the previous month; focus cursor moves to the same day (clamped).
  - name: title
    description: The `<span data-part="title" aria-live="polite">Month YYYY</span>` month/year label. aria-live=polite announces month changes to AT. ID is stable per instance (used by [data-part=grid]'s aria-labelledby).
  - name: next
    description: The `<button data-part="next" type="button" aria-label="Next month">` nav button, injected with the Phosphor `caret-right` glyph via `setIcon` (@agent-ui/icons). Clicking navigates to the next month; focus cursor moves to the same day (clamped).
  - name: grid
    description: The `<div data-part="grid" role="grid" aria-labelledby="…title-id">` container for the weekday header row and 6 week rows. A 7-column CSS grid; [role=row] children use display:contents. The bespoke 2D keyboard handler (ADR-0048 decision 2) is attached here. Rebuilt on month navigation.
  - name: status
    description: "ADR-0093 clause 3 — a visually-hidden `<div data-part=\"status\" aria-live=\"polite\">` (clip technique, position:absolute — out of flow). Always created (idempotent-parts precedent); text is written ONLY by the range-mode commit path ('Start date set — choose an end date.' / '{start} to {end} selected.') — stays empty and silent in mode=single."

customStates: []        # no :state() internals — selection/range state rides aria-selected + data-range-*/data-in-range attributes (gridcell), not the host

face:
  formAssociated: true  # UIFormElement: formValue/formValidity/formReset/formStateRestore seams active
  value: mode=single → value; mode=range → valueStart,valueEnd (submitted as FormData, two entries under `name`, start first, ONLY when the pair is complete and not inverted — ADR-0093 clause 2)

aria:
  role: none            # host carries NO explicit role (ARIA rides the parts: grid, row, columnheader, gridcell)
  grid: role=grid on [data-part=grid], aria-labelledby → title id
  rows: role=row on each [div] row wrapper inside the grid
  columnheader: role=columnheader on each weekday-header <span> (+ aria-label=full name + abbr)
  gridcell: role=gridcell on each day <button> (overrides implicit button role)
  aria-selected: mode=single — true on the committed value cell, false on all others. mode=range — true on BOTH endpoints AND every interior cell of the current band (committed or in-progress preview) — "the whole run is the selection" (ADR-0093 clause 4); false elsewhere.
  aria-disabled: true on out-of-range / disabled cells (commit is a no-op even if clicked)
  aria-live: polite on [data-part=title] (month/year change) AND on [data-part=status] (range mode pick-state transitions, ADR-0093 clause 3; silent in mode=single)
  tabindex: roving (one cell = 0, others = -1); priority = #focusIso cursor → live-surface date(s) → today → 1st
  data-range-start: (range mode only) stamped on the cell equal to `valueStart` — the anchor keeps this mark even after a swap-completing pick lands chronologically after it (ADR-0093 clause 3)
  data-range-end: (range mode only) stamped on the cell equal to `valueEnd` when complete, or the live hover/keyboard-focus preview candidate while selecting-end
  data-in-range: (range mode only) stamped on every cell strictly between the normalized [start,end] band, excluding the two endpoints — includes [data-outside] cells and spans month boundaries (ADR-0093 clause 5)

keyboard:
  - key: ArrowLeft
    description: Move focus −1 day. Crosses month boundaries (rebuilds grid for new month). Range mode — also updates the in-progress preview band while selecting-end.
  - key: ArrowRight
    description: Move focus +1 day. Crosses month boundaries (rebuilds grid for new month). Range mode — also updates the in-progress preview band while selecting-end.
  - key: ArrowUp
    description: Move focus −7 days (one week back). May cross month boundary. Range mode preview as above.
  - key: ArrowDown
    description: Move focus +7 days (one week forward). May cross month boundary. Range mode preview as above.
  - key: Home
    description: Move focus to Sunday of the current week. Range mode preview as above.
  - key: End
    description: Move focus to Saturday of the current week. Range mode preview as above.
  - key: PageUp
    description: Move focus −1 month (rebuilds the grid). Day clamped to new month's last day.
  - key: Shift+PageUp
    description: Move focus −1 year (rebuilds the grid). Day clamped to new month's last day.
  - key: PageDown
    description: Move focus +1 month (rebuilds the grid). Day clamped to new month's last day.
  - key: Shift+PageDown
    description: Move focus +1 year (rebuilds the grid). Day clamped to new month's last day.
  - key: Enter
    description: 'mode=single — commit the focused date (emits change + select). mode=range — first commit sets valueStart (emits select); second commit swap-completes the pair (emits select + change). No-op if aria-disabled. preventDefault so a calendar-inside-an-overlay doesn''t re-trigger its anchor button (ADR-0048 / ADR-0045 semantics).'
  - key: Space
    description: Same as Enter — commit the focused date (both modes). No-op if aria-disabled.
  - key: Escape
    description: NOT intercepted by ui-calendar in either mode (ADR-0045) — dismissal (e.g. closing an overlay this control is the popup body of) stays the platform/overlay's. An abandoned pending range start is simply superseded by the next pick.

geometry:
  tier: pattern                         # composite control; panel is Container/surface, cells are square targets
  cellSize: --ui-calendar-cell-size     # the square side of each day cell (default 2rem / 32px; [size=sm/lg] repoints)
  gap: --ui-calendar-gap                # inter-cell gap (default 0.125rem / 2px)
  panel: Container/surface              # bg + outline + radius from --ui-calendar-panel-* tokens (NOT a control height)
  navButtons: inline affordance = font  # caret-left/caret-right (Phosphor) are font-sized glyphs (§4.6 law; no icon cell)
  weekdayHeader: 0.75 × cell-size tall  # slightly shorter than day cells; 85% font size
  rangeInterior: square (radius:0)      # ADR-0093 — [data-in-range] cells are square-cornered (vs. the circular endpoint fill), a non-color signifier distinguishing interior from endpoint (ADR-0057)

forcedColors: 'selected-fill (Highlight/HighlightText) + today-ring (ButtonText inset ring) are preserved via forced-color-adjust:none on the relevant cells; panel maps to Canvas/CanvasText; nav buttons to ButtonText; disabled cells to GrayText. Three-state distinctness: focus=Highlight-outside, selected=Highlight-fill, today=ButtonText-inset. Range mode (ADR-0093): the whole band (endpoints + interior) carries aria-selected=true and so maps to the SAME Highlight/HighlightText pair — self-delimiting (a contiguous Highlight run), with the circle-vs-square shape (unaffected by forced-colors) keeping endpoint and interior visually distinct without a third system color.'
---

# ui-calendar

A standalone month-grid date picker that is a FACE form control (contributes a selected ISO
`YYYY-MM-DD` date to a form) and will also serve as the popup body for `<ui-text-field type=date>`
(lazily imported there in Wave 5B-3). `mode="range"` (ADR-0093) turns it into a date-**range**
picker on the SAME control — one grid, two picks, a `[valueStart, valueEnd]` pair.

## Anatomy

The control creates a `[data-box]` panel (adopting the shared container box-model from ADR-0046)
that holds a `<header>` navigation bar (prev caret · month-year title · next caret) and a 7-column CSS
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

## Mode (ADR-0093)

`mode` is `'single'` (default) or `'range'`. The **one-live-value-surface rule** is the load-bearing
safety net: in `mode="single"`, `value` is live and `valueStart`/`valueEnd` are *inert* (held +
reflected, contributing nothing); in `mode="range"`, the pair is live and `value` is inert. A mode
switch is a **reconfiguration, not a data migration** — the control never writes the off-mode
prop, so `<ui-calendar mode="range" value-start="2026-07-05" value-end="2026-07-20">` behaves
identically regardless of attribute order.

```html
<ui-calendar></ui-calendar>                                          <!-- mode=single, default -->
<ui-calendar mode="range" value-start="2026-07-05" value-end="2026-07-20"></ui-calendar>
```

## Range selection — single grid, two picks, swap-complete

In `mode="range"`, the FIRST commit gesture (click / Enter / Space) sets `valueStart` and enters
*selecting-end*; hovering or moving keyboard focus previews the in-progress band between the
pending start and the candidate. The SECOND commit gesture always completes the range as
`[min, max]` of {pick, pending start} by ISO string comparison — a pick **earlier** than the
pending start reorders the pair (swap-complete) rather than restarting, so `valueStart <= valueEnd`
always holds after an interactive completion. The preview already shows the normalized band while
selecting, so the committed result is never a surprise. Same-day second pick makes a valid
single-day range; a pick on an already-complete range starts a new one. `select` fires on every
pick (detail = the raw picked ISO); `change` fires only when the pair completes. Escape is **not**
intercepted (ADR-0045) — an abandoned pending start is simply superseded by the next pick.

Endpoints (`[data-range-start]`/`[data-range-end]`) reuse the circular selected-fill; interior
cells (`[data-in-range]`) get a square wash from `--ui-calendar-range-fill`/`-range-ink`. A
visually-hidden `aria-live="polite"` status region (the `status` part) announces each transition,
naming both dates on completion — so a swap is audible as the resulting range.

A `valueStart`/`valueEnd` pair set **programmatically** out of order is never auto-swapped: it
stays inverted and `formValidity()` reports it invalid (swap is a pick-gesture semantic, not a
prop normalization).

## Form

`UICalendarElement extends UIFormElement`. In `mode="single"`, the base class's reactive effects
publish `formValue()` (the ISO string, null when none) and `formValidity()` (valueMissing when
`required` + empty; rangeUnderflow/Overflow when outside `[min,max]`) to the platform via
`internals.setFormValue`/`setValidity` automatically. `formReset()` restores the initial `value`
attribute; `formStateRestore()` accepts an ISO string.

In `mode="range"`, `formValue()` submits the pair as **two `FormData` entries under one `name`**
(start first) when it is complete and not inverted — a half-open or inverted pair contributes
nothing (a range is atomic). `formValidity()` adds `valueMissing` for a half-open pair,
`rangeUnderflow` for an inverted pair (`valueStart > valueEnd`, reachable only by a programmatic
set), and per-endpoint `rangeUnderflow`/`rangeOverflow` against `min`/`max`. `formReset()` restores
the initial `value-start`/`value-end` attributes; `formStateRestore()` accepts the two-entry
`FormData` shape.
