# ADR-0048 — Date/time picker architecture: `ui-calendar` (standalone + popup body), the date/time codecs, and lazy overlay composition

> Source: agent-ui ADR log. Log + lifecycle: [`README.md`](./README.md). · 2026-07-01
>
> | Field | Value |
> |---|---|
> | **Status** | proposed |
> | **Date** | 2026-07-01 |
> | **Proposed by** | planning-lead — the design seat, on the Wave-5 brief (#49 / #99): "calendars, date-pickers" (Kim). |
> | **Ratified by** | orchestration-lead — on the green G6/G7 gate (the `ui-calendar` grid + the cross-engine `type=date` overlay smoke) |
> | **Repairs** | **NEW** `controls/calendar/calendar.{ts,css,md}` (`UICalendarElement`) · `traits/value-codec.ts` (`dateCodecOptions`/`timeCodecOptions` + stretch compound) · `controls/text-field/text-field.{ts,css,md}` (`type=date`/`time` rows + the lazy-calendar overlay) · `docs/decompositions/control-suite-wave5-input-codecs-pickers.decomp.md` (Wave 5B) · goals §G6/§G7 · **composes ADR-0043/0045** (overlay + dismissal) + **ADR-0046** (`[data-box]` panel) + **ADR-0042** (`UIFormElement` base) + **extends ADR-0044/0047** (the `type`-resolver + codec seam) · relates ADR-0023 (the tree-shake proof the lazy import protects). |
> | **Supersedes / Superseded by** | None. **Extends ADR-0047** (the numeric family) into the date/time family; composes the Wave-4 overlay. |

## Context

Kim's Wave-5 directive names **calendars + date-pickers** as the coverage gap. A date field is
editor + trailing button + a popup **month grid** — the same trigger+overlay shape as `ui-select`, but the popup
body is a 2D day grid, not a listbox. `roving-focus` is **1D linear** (it can't express ±1-day/±7-day movement
across DOM rows, month-boundary regeneration, or disabled dates). And a naive `type=date` that statically
imports the calendar would drag the whole grid into **every** text-field's bundle, breaking the G8 tree-shake
proof (importing a plain field must not pull the calendar).

## Decision

We will add a **standalone `ui-calendar` control** that is ALSO the popup body for `type=date`, plus date/time
codecs, composing the shipped overlay + box-model.

1. **`UICalendarElement` (`controls/calendar/`, `extends UIFormElement`, tag `ui-calendar`).** It contributes a
   form value (canonical ISO `YYYY-MM-DD`) — so it is a FACE form control, not a plain `UIElement`. The host
   carries **no** role; ARIA rides parts (`[data-part=grid]` = `role=grid`, weekday `role=columnheader`, weeks
   `role=row`, days `role=gridcell` buttons). The panel opts into **`[data-box]`** (ADR-0046) — the nav bar is a
   `header` region, the grid is content.
2. **A BESPOKE 2D grid handler on `ui-calendar` — not a 2D fork of `roving-focus`.** The handler keeps a roving
   `tabindex` (selected day → today → the 1st) and REUSES the *learned semantics* — `selectionCommit`'s
   **`preventDefault` on the committing Enter** (so a calendar-in-an-overlay doesn't re-trigger the anchor) +
   `aria-selected` reflection + internals ARIA — but owns the navigation: ←/→ ∓1 day, ↑/↓ ∓7, Home/End
   week-ends, PageUp/Down ∓month (**regenerating** the grid), Shift+PageUp/Down ∓year, Enter/Space commit. Nav
   may land on a disabled/out-of-range day; Enter/click on it is a **no-op**. A `roving-grid` trait is extracted
   **only when a second grid control appears** (YAGNI — one consumer).
3. **`type=date` lazily `import()`s the calendar module.** The date type's trailing calendar button opens an
   `overlay(this, { popup: panel, anchor: button, focusOnOpen:true, auto:true })` whose `[data-box]` panel body
   is a `<ui-calendar>` — created eagerly (an unknown element that **upgrades** when a first-activation dynamic
   `import('../calendar/calendar.ts')` defines it). The calendar stays **code-split out of the base field**; a
   calendar `select`/`change` sets `value` + `open=false` (overlay closes → focus restores to the button,
   ADR-0045); typing parses on blur.
4. **The codecs.** `dateCodecOptions(locale)` — canonical ISO `YYYY-MM-DD`, localized display; parse accepts ISO
   always + a best-effort locale heuristic. `timeCodecOptions(locale)` — canonical `HH:MM` 24h, localized
   display, typed-primary. **Scope:** `date` + `time` are **IN**; a **time-list overlay**, `datetime-local`
   (compound codec `YYYY-MM-DDTHH:MM`, calendar sets the date half), and `month` (`YYYY-MM`, month-grid mode) are
   **STRETCH** (built only if `date`+`time` land clean; else documented follow-ups — no half-built control).

## Consequences

- **`type=date` gains an overlay dependency the base field never loads.** The lazy import keeps the tree-shake
  proof green (ADR-0023/0040) at the cost of a first-open async tick before the calendar upgrades — acceptable
  (a click-to-open affordance, not a render-critical path). The dynamic import must not leak a listener (C10).
- **Free-form localized-date PARSING is best-effort** — Intl has no parser; the codec accepts ISO reliably and
  falls back to a heuristic + `new Date()`. **The calendar is the authoritative entry path; typing is lenient.**
  Documented in `text-field.md`.
- **A new grid navigation model enters the fleet** (bespoke, un-extracted). If a second grid consumer appears,
  the extraction trigger is recorded — do not pre-abstract.
- **`ui-calendar` is a new self-defining control** — barrel + `BASE_CLASSES` + gz marginal + a site page
  (docs-site-steward) + the `--ui-calendar-*` tokens (tokens-specialist; range tokens **reserved/future**).
- **Stale → re-verify:** the new calendar files + tests + barrel · `value-codec.ts` + its test · `text-field.*`
  + its descriptor trip-wire · goals §G6/§G7 · the date-overlay smoke (top-layer + light-dismiss + focus-restore,
  **Chromium + WebKit** — the ADR-0045 lesson).

## Acceptance

`ui-calendar` (jsdom): renders the current month (day-of-week offset, 28/30/31 + leap-Feb); Arrow ±1/±7,
PageUp/Down ±month (grid regenerates), Home/End; Enter/Space + click commit → ISO `value` + `change`+`select`;
`min`/`max` disable days (commit no-op); `required` → `valueMissing`; `formReset`; contract↔props trip-wire; C10
zero-residue. Browser (Chromium + WebKit): real roving focus across the grid + month boundary; today/selected/
disabled render; forced-colors keeps the selected fill + today ring. `type=date` (browser): the calendar opens
in the **top layer** above an `overflow/transform` ancestor, flips at the edge, a keyboard pick commits +
**restores focus to the button**, light-dismiss syncs `open`; the ISO value round-trips; C10 zero-residue.
`type=time`: codec round-trip + `typeMismatch` on invalid.

## Alternatives considered

- **A 2D extension of `roving-focus`** — rejected: a day grid's month-boundary regeneration + disabled dates +
  ±7 movement is a distinct model; bending the 1D linear trait to fit would complicate every existing consumer
  (listbox/menu/select/radio). A bespoke handler is clearer; extract a `roving-grid` trait on the second grid.
- **`type=date` statically imports `ui-calendar`** — rejected: it drags the calendar into every text-field's
  graph, breaking the "import one control drags only it + real deps" tree-shake proof (G8). The lazy import
  keeps them separable.
- **A native `<input type=date>` editor** — rejected: breaks the uniform no-native-input contenteditable model
  (ADR-0014) and forfeits control over the calendar UX/theming; the whole point is a themed FACE picker.
- **`ui-calendar` as a plain `UIElement`** — rejected: a calendar contributes a selected date to a form; it is a
  value control, so `UIFormElement` (value/validity via internals) is its correct base, exactly like the other
  selection controls.
- **Build the full date/time family in one wave** (`datetime-local`/`month`/range/time-list) — rejected:
  `date`+`time`+`ui-calendar` prove the pattern; the rest are the same shape applied later. Scoped as stretch/
  future so the wave ships a clean core, not a set of half-controls.
