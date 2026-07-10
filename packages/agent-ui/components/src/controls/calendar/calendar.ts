// calendar.ts — UICalendarElement, the Wave-5B standalone month-grid date picker control.
// (control-suite-wave5-input-codecs-pickers.decomp.md 5B-1 · ADR-0048; range mode: ADR-0093 /
// calendar-range.decomp-v2.json)
//
// A FACE form control (extends UIFormElement) that contributes a selected ISO date (YYYY-MM-DD)
// to a form AND will serve as the popup body for type=date on ui-text-field (lazily imported
// there in slice 5B-3 — this slice builds the standalone control only).
//
// MODE FLAG (ADR-0093) — `mode: 'single'|'range'`, default 'single'. ONE calendar, mode-flagged
// (Kim's F1 ruling; no sibling component, no `_base/` extraction — the machinery below stays
// #-private). The ONE-LIVE-VALUE-SURFACE rule (ADR-0093 clause 1) is the load-bearing safety net:
// in mode="single" `value` is live and `valueStart`/`valueEnd` are INERT (held + reflected,
// contribute NOTHING to render/formValue/formValidity/events); in mode="range" the pair is live
// and `value` is inert. The control NEVER writes an off-mode prop — every write site below is
// branched by `this.mode` so a mode switch never migrates data. Range interaction (clause 3):
// single grid, two picks, SWAP-COMPLETE — the second commit gesture always completes as
// `[min,max]` of {pick, pending start} (lexicographic ISO compare, zero Date construction), so a
// pick earlier than the pending start reorders rather than restarting (Kim's F2 ruling). The pick
// STATE ITSELF is derived from the props (idle = both '' · selecting-end = start set, end '' ·
// complete = both set, any order) — no extra private state field, so declarative markup
// (`<ui-calendar mode="range" value-start="…" value-end="…">`) is upgrade-order-safe by
// construction. Escape is NOT intercepted (ADR-0045 — dismissal stays the overlay's).
//
// ANATOMY (parts created ONCE — idempotent across disconnect/reconnect):
//   <ui-calendar>
//     <div data-part="panel" data-box>
//       <header data-part="nav">
//         <button data-part="prev" type="button" aria-label="Previous month"><svg>…caret-left…</svg></button>
//         <span   data-part="title" id="uid-N" aria-live="polite">July 2026</span>
//         <button data-part="next" type="button" aria-label="Next month"><svg>…caret-right…</svg></button>
//       </header>
//       <div data-part="grid" role="grid" aria-labelledby="uid-N">
//         <div role="row">  <!-- weekday column-header row -->
//           <span role="columnheader" aria-label="Sunday">Su</span>…7 cols…
//         </div>
//         <div role="row">  <!-- one week (6 such rows) -->
//           <button role="gridcell" type="button" tabindex="-1|0"
//                   data-date="YYYY-MM-DD" aria-label="Month D, YYYY"
//                   aria-selected="true|false" [aria-disabled="true"]
//                   [data-today] [data-outside]>D</button>
//         </div>
//       </div>
//     </div>
//   </ui-calendar>
//
// BESPOKE 2D GRID KEYBOARD (ADR-0048 decision 2 — NOT a roving-focus fork; model is distinct):
//   ←/→ ±1 day · ↑/↓ ±7 days · Home/End week-start/-end (Sun/Sat) ·
//   PageUp/Down ±1 month (REGENERATES the grid) · Shift+PageUp/Down ±1 year ·
//   Enter/Space commit (disabled / out-of-range = no-op, enters preventDefault regardless).
//   Roving tabindex=0: #focusIso cursor → selected day (if in month) → today (if in month)
//   → first day of month.  Adjacent-month cells shown as [data-outside]; navigating/clicking
//   them rebuilds the grid for that month (standard calendar UX).
//
// DATE MATH: all ISO parsing uses explicit y/m/d extraction to avoid new Date('YYYY-MM-DD')
// UTC-midnight parsing traps. Arithmetic uses new Date(y, m-1, d ± delta) LOCAL construction
// which handles month/year boundaries correctly without any string parsing.
//
// TOKENS CONSUMED (with sensible CSS fallbacks until the tokens-specialist delivers them):
//   --ui-calendar-cell-size · --ui-calendar-gap · --ui-calendar-selected-fill ·
//   --ui-calendar-selected-ink · --ui-calendar-today-ring · --ui-calendar-disabled-ink ·
//   --ui-calendar-outside-ink · --ui-calendar-range-fill · --ui-calendar-range-ink (ADR-0093,
//   realized as the --md-sys-color-primary-surface-highest / -primary-on-surface AA pair —
//   repointed off -primary-surface per the 2026-07-07 erratum, see ADR-0093).
//
// FORM SEAMS: mode="single" — formValue() = ISO string (null when none); formValidity() =
//   valueMissing + rangeUnderflow/Overflow; formReset() → initial value attribute;
//   formStateRestore(string). mode="range" (ADR-0093 clause 2) — formValue() = FormData with TWO
//   entries under `name` (start first) when the pair is complete AND not inverted, else null (a
//   range is atomic); formValidity() adds half-open + inverted (programmatic-only — interaction
//   always swap-completes) + per-endpoint min/max; formReset() → the initial value-start/value-end
//   attributes; formStateRestore(FormData) reads the two same-name entries.
//
// Layer: controls/ → dom + reactive (inward-only ✓). No overlay, roving-focus, or
// selectionCommit traits: this control owns its bespoke navigation model (ADR-0048 §2).
// erasableSyntaxOnly ✓ (no enum/namespace/decorators). verbatimModuleSyntax ✓ (import type).

import { UIFormElement } from '../../dom/index.ts'
import { prop } from '../../dom/index.ts'
import type { PropsSchema, ReactiveProps } from '../../dom/index.ts'
import type { FormValue, ValidityResult, FieldLabelling } from '../../dom/index.ts'
import { trackUserInvalid, type TrackUserInvalidController } from '../../traits/track-user-invalid.ts'
import { setIcon } from '@agent-ui/icons'

// ── Module-level stable-id counter (one per title/grid pair, never reused) ─────────────────

let _nextCalendarId = 0

// ── Static date-math helpers (pure functions — timezone-safe) ────────────────────────────────

/**
 * Parse an ISO 'YYYY-MM-DD' string into { y, m, d } integers. Returns null on any malformed
 * input. Does NOT use new Date('YYYY-MM-DD'), which parses as UTC midnight and can shift the
 * calendar day by ±1 in negative-offset timezones.
 */
function parseDateStr(s: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!match) return null
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) }
}

/** Format integer y/m/d as ISO 'YYYY-MM-DD'. */
function dateStr(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/**
 * Advance a LOCAL date by `delta` days. Uses `new Date(y, m-1, d + delta)` (LOCAL month/day
 * construction — no string parsing) so month/year rollovers are handled by the Date engine.
 */
function advanceDate(
  y: number,
  m: number,
  d: number,
  delta: number,
): { y: number; m: number; d: number } {
  const dt = new Date(y, m - 1, d + delta)
  return { y: dt.getFullYear(), m: dt.getMonth() + 1, d: dt.getDate() }
}

/**
 * Add `n` months to a (y, m) pair (1-based month). Handles year rollovers via LOCAL Date.
 * Result is always normalized: no month < 1 or > 12.
 */
function addMonths(y: number, m: number, n: number): { y: number; m: number } {
  const dt = new Date(y, m - 1 + n, 1)
  return { y: dt.getFullYear(), m: dt.getMonth() + 1 }
}

/**
 * The number of days in (y, m) (1-based month). Correctly handles leap February.
 * `new Date(y, m, 0)` — month `m` is 0-based, so this is day 0 of the NEXT month = last day
 * of month m (1-based). Example: m=2 (Feb) → `new Date(y, 2, 0)` = Feb's last day.
 */
function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate()
}

/**
 * True when `iso` is outside the [min, max] range. ISO 'YYYY-MM-DD' strings are
 * lexicographically ordered when zero-padded, so string comparison IS chronological.
 * Empty min/max = unbounded.
 */
function isOutOfRange(iso: string, min: string, max: string): boolean {
  if (min !== '' && iso < min) return true
  if (max !== '' && iso > max) return true
  return false
}

/**
 * ADR-0093 clause 5 — the range in-range/normalize mechanism, reusing `isOutOfRange`'s proof that
 * zero-padded ISO strings compare chronologically: lexicographic min/max of two NON-empty ISO
 * strings. Used for both the swap-complete commit and the normalized preview — the same function,
 * so the committed band is provably identical to what was previewed (ADR-0093 clause 3).
 */
function normalizeRange(a: string, b: string): [lo: string, hi: string] {
  return a <= b ? [a, b] : [b, a]
}

/** Format an ISO date long-form for AT announcements ("July 15, 2026"); `iso` unchanged if malformed. */
function formatIsoLong(iso: string): string {
  const p = parseDateStr(iso)
  return p ? `${MONTH_NAMES[p.m - 1]} ${p.d}, ${p.y}` : iso
}

/** One cell's range-selection facts (ADR-0093 clause 4) — a pure function of the pair + the preview
 *  candidate, ZERO Date construction (grep-provable). Single mode never calls this.
 *
 *  `a` is always the anchor (`valueStart`, whenever it is set); `b` is the completed `valueEnd`
 *  when the pair is complete, else the live preview candidate (hover/keyboard-focus) while
 *  selecting-end. `a` keeps ITS OWN endpoint mark regardless of chronological order (ADR-0093
 *  clause 3: "the pending start keeping its endpoint mark") — the interior wash alone is
 *  normalized via `normalizeRange`. */
function rangeSelectionFor(
  iso: string,
  valueStart: string,
  valueEnd: string,
  previewIso: string,
): { selected: boolean; rangeStart: boolean; rangeEnd: boolean; inRange: boolean } {
  const a = valueStart
  const b = valueEnd !== '' ? valueEnd : previewIso
  if (a === '') return { selected: false, rangeStart: false, rangeEnd: false, inRange: false }

  const rangeStart = iso === a
  const rangeEnd = b !== '' && iso === b
  let inBand = rangeStart
  if (b !== '') {
    const [lo, hi] = normalizeRange(a, b)
    inBand = iso >= lo && iso <= hi
  }
  return { selected: rangeStart || rangeEnd || inBand, rangeStart, rangeEnd, inRange: inBand && !rangeStart && !rangeEnd }
}

// ── Label data (English, static — calendar spec doesn't require Intl localization) ──────────

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const

const WEEKDAY_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const
const WEEKDAY_FULL  = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const

// ── Props ────────────────────────────────────────────────────────────────────────────────────

const props = {
  // Universal form attributes from the spreadable formProps (name / disabled / required).
  // All three reflect: name for submission keying, disabled/required for attribute-selector styling.
  ...UIFormElement.formProps,

  // `mode` — ADR-0093: 'single' (default) keeps `value` live; 'range' keeps `valueStart`/
  // `valueEnd` live instead (the ONE-LIVE-VALUE-SURFACE rule — clause 1). An enum, not a bare
  // boolean, leaving room for foreseeable future modes (matches the fleet's `size` enum pattern).
  mode: { ...prop.enum(['single', 'range'] as const, 'single'), reflect: true },

  // `value` — the selected date as an ISO 'YYYY-MM-DD' string. '' = nothing selected.
  // Reflected so `<ui-calendar value="2026-07-01">` works declaratively AND the renderer
  // two-way-binds it (value:{prop:'value', event:'change'}). INERT in mode="range" (ADR-0093
  // clause 1) — held + reflected, but contributes nothing to render/formValue/formValidity/events.
  value: { ...prop.string(''), reflect: true },

  // `valueStart` / `valueEnd` — ADR-0093 clause 1: the range-mode value pair, mirroring
  // ui-slider-multi's `valueLo`/`valueHi` shape exactly (kebab attrs via explicit `attribute:`
  // overrides; '' = unset). INERT in mode="single" — held + reflected, contribute nothing.
  valueStart: { ...prop.string(''), reflect: true, attribute: 'value-start' },
  valueEnd: { ...prop.string(''), reflect: true, attribute: 'value-end' },

  // `min`/`max` — ISO date bounds ('' = unbounded). Drive formValidity() range checks and
  // aria-disabled on out-of-range day cells. Reflected for native attribute-IDL parity with
  // text-field min/max (ADR-0047 fleet consistency ruling).
  min: { ...prop.string(''), reflect: true },
  max: { ...prop.string(''), reflect: true },

  // `size` — presentational cell-size tier. Reflected so [size=sm/lg] CSS rules engage on
  // both JS-set and HTML-authored values (fleet standard; same pattern as UIIndicatorElement.props).
  size: { ...prop.enum(['sm', 'md', 'lg'] as const, 'md'), reflect: true },
} satisfies PropsSchema

// ── Element ──────────────────────────────────────────────────────────────────────────────────

export interface UICalendarElement extends ReactiveProps<typeof props> {}
export class UICalendarElement extends UIFormElement {
  static props = props

  // Shell parts created ONCE (idempotent across disconnect/reconnect).
  #panelEl:  HTMLElement | null = null
  #gridEl:   HTMLElement | null = null
  #titleEl:  HTMLElement | null = null
  #prevBtn:  HTMLElement | null = null
  #nextBtn:  HTMLElement | null = null
  #statusEl: HTMLElement | null = null // ADR-0093 — visually-hidden aria-live status (range mode only)

  // The HTML-authored initial value captured at FIRST connect (before any reactive updates). Since
  // `value` has `reflect: true`, setting `el.value = x` synchronously updates the content attribute —
  // so `getAttribute('value')` at formReset time always returns the CURRENT value, not the original.
  // Capturing here gives us the `<ui-calendar value="…">` default for form-reset parity.
  #initialValue = ''

  // ADR-0093 — the range pair's own HTML-authored initial values, captured the same way (and
  // independently of #initialValue — mode-aware formReset() restores only the currently-live surface).
  #initialValueStart = ''
  #initialValueEnd   = ''

  // ADR-0093 clause 3 — the live hover/keyboard-focus PREVIEW candidate while selecting-end
  // (valueStart set, valueEnd ''). NOT a reactive prop (purely ephemeral UI state); rendering reads
  // it directly. '' = no candidate (nothing hovered/focused since the anchor was picked).
  #previewIso = ''

  // The currently displayed month (1-based). Updated only by navigation actions, which call
  // #rebuildGrid() directly. Not reactive signals — the effect handles prop-change updates.
  #displayYear  = 0
  #displayMonth = 0

  // ISO date of the cell that currently holds tabindex=0 (the roving keyboard cursor).
  // '' = unset; on first connect it is computed from value/today/first (see #computeFocusTarget).
  #focusIso = ''

  // The user-invalid TIMING controller (ADR-0051), created per connection (re-arms on reconnect;
  // released on disconnect) — the text-field/select precedent.
  #userInvalid: TrackUserInvalidController | null = null

  // ── Form seams (UIFormElement hooks) ─────────────────────────────────────────────────────

  protected override formValue(): FormValue {
    if (this.mode === 'range') {
      // ADR-0093 clause 2: a range is ATOMIC — a half-open or inverted pair contributes nothing.
      const start = this.valueStart
      const end   = this.valueEnd
      if (start === '' || end === '' || start > end) return null
      const fd = new FormData()
      const name = this.name || ''
      fd.append(name, start) // start FIRST — the ui-slider-multi formValue() precedent
      fd.append(name, end)
      return fd
    }
    // Null when nothing is selected — no form-data entry contributed. `value` is INERT in
    // mode="range" (never read here — the branch above never falls through to it).
    return this.value !== '' ? this.value : null
  }

  protected override formValidity(): ValidityResult {
    if (this.mode === 'range') {
      const start = this.valueStart
      const end   = this.valueEnd
      const hasStart = start !== ''
      const hasEnd   = end !== ''

      if (!hasStart && !hasEnd) {
        if (this.required) {
          return { valid: false, flags: { valueMissing: true }, message: 'Please select a date range.' }
        }
        return { valid: true }
      }
      if (hasStart !== hasEnd) {
        // Half-open (clause 2) — a range's value is atomic; exactly one endpoint is never a valid
        // submission, `required` or not (there is nothing coherent to submit yet).
        return { valid: false, flags: { valueMissing: true }, message: 'Please select an end date.' }
      }
      // Both endpoints set.
      if (start > end) {
        // Inverted (clause 2) — reachable ONLY by a programmatic set; interaction always
        // swap-completes (clause 3). The platform's ValidityStateFlags has no "inverted" flag;
        // rangeUnderflow (start "underflows" past end) is the closest structural fit — the
        // MESSAGE, not the flag, carries the real diagnosis.
        return { valid: false, flags: { rangeUnderflow: true }, message: 'The start date must be on or before the end date.' }
      }
      if (this.min !== '' && start < this.min) {
        return { valid: false, flags: { rangeUnderflow: true }, message: `Value must be on or after ${this.min}.` }
      }
      if (this.max !== '' && end > this.max) {
        return { valid: false, flags: { rangeOverflow: true }, message: `Value must be on or before ${this.max}.` }
      }
      return { valid: true }
    }

    if (this.required && this.value === '') {
      return { valid: false, flags: { valueMissing: true }, message: 'Please select a date.' }
    }
    if (this.value !== '') {
      if (this.min !== '' && this.value < this.min) {
        return {
          valid: false,
          flags: { rangeUnderflow: true },
          message: `Value must be on or after ${this.min}.`,
        }
      }
      if (this.max !== '' && this.value > this.max) {
        return {
          valid: false,
          flags: { rangeOverflow: true },
          message: `Value must be on or before ${this.max}.`,
        }
      }
    }
    return { valid: true }
  }

  protected override formReset(): void {
    // ADR-0093 clause 1: reset acts on the CURRENTLY-LIVE surface only — never writes the
    // off-mode prop. Restore to the HTML-authored initial value(s) captured at first connect.
    if (this.mode === 'range') {
      this.valueStart = this.#initialValueStart
      this.valueEnd   = this.#initialValueEnd
    } else {
      this.value = this.#initialValue
    }
    // ADR-0051 — a reset must not leave a required-empty calendar showing :state(user-invalid)
    // until the user re-interacts (the text-field formReset() precedent).
    this.#userInvalid?.reset()
  }

  protected override formStateRestore(state: File | string | FormData | null): void {
    if (this.mode === 'range') {
      if (!(state instanceof FormData)) return
      const name = this.name || ''
      const vals = state.getAll(name).filter((v): v is string => typeof v === 'string')
      const ISO = /^\d{4}-\d{2}-\d{2}$/
      if (vals.length !== 2 || !ISO.test(vals[0]!) || !ISO.test(vals[1]!)) return
      const [start, end] = vals as [string, string]
      const p = parseDateStr(start)
      if (!p) return
      this.valueStart    = start
      this.valueEnd      = end
      this.#displayYear  = p.y
      this.#displayMonth = p.m
      this.#focusIso     = start
      this.#rebuildGrid()
      return
    }
    if (typeof state === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(state)) {
      const p = parseDateStr(state)
      if (!p) return
      this.value        = state
      // Navigate the displayed grid to the restored value's month so the selection is visible.
      // (Setting `this.value` alone only updates aria-selected on the existing cells, which may be
      // a different month entirely.) Does NOT steal focus — no #focusCurrentCell() call here.
      this.#displayYear  = p.y
      this.#displayMonth = p.m
      this.#focusIso     = state
      this.#rebuildGrid()
    }
  }

  // ── Connection lifecycle ──────────────────────────────────────────────────────────────────

  protected override connected(): void {
    const { grid, prev, next } = this.#ensureShell()

    // Capture the HTML-authored initial value(s) BEFORE any reactive updates (first connect
    // only). `reflect: true` means el.value = x updates the attribute synchronously, so we
    // cannot read getAttribute later and expect the original HTML value. Capture once here
    // instead — both surfaces, independently of `mode` (ADR-0093: attribute-processing order
    // must not matter, so BOTH captures always run regardless of which mode is authored).
    if (this.#initialValue === '' && this.getAttribute('value')) {
      this.#initialValue = this.getAttribute('value')!
    }
    if (this.#initialValueStart === '' && this.getAttribute('value-start')) {
      this.#initialValueStart = this.getAttribute('value-start')!
    }
    if (this.#initialValueEnd === '' && this.getAttribute('value-end')) {
      this.#initialValueEnd = this.getAttribute('value-end')!
    }

    // Seed the displayed month from the currently-LIVE value surface (or today if none set) —
    // mode-aware so `<ui-calendar mode="range" value-start="…">` shows the right month regardless
    // of attribute order (ADR-0093 clause 1).
    const today = this.#today()
    const seedIso = this.mode === 'range'
      ? (this.valueStart !== '' ? this.valueStart : this.valueEnd)
      : this.value
    const seeded = parseDateStr(seedIso) ?? today
    this.#displayYear  = seeded.y
    this.#displayMonth = seeded.m

    // Seed the keyboard cursor: selected date(s) → today (if in month) → first day of month.
    if (this.mode === 'range') {
      if (this.valueStart !== '') {
        this.#focusIso = this.valueStart
      } else if (this.valueEnd !== '') {
        this.#focusIso = this.valueEnd
      } else if (seeded.y === today.y && seeded.m === today.m) {
        this.#focusIso = dateStr(today.y, today.m, today.d)
      } else {
        this.#focusIso = dateStr(seeded.y, seeded.m, 1)
      }
    } else if (this.value !== '') {
      this.#focusIso = this.value
    } else if (seeded.y === today.y && seeded.m === today.m) {
      this.#focusIso = dateStr(today.y, today.m, today.d)
    } else {
      this.#focusIso = dateStr(seeded.y, seeded.m, 1)
    }

    // Build the initial grid.
    this.#rebuildGrid()

    // ── ADR-0051 — the user-invalid TIMING controller ─────────────────────────────────────
    // `blur` is captured at the host (never bubbles; the capture phase reaches this ancestor
    // before whichever gridcell button held focus — the track-user-invalid.ts precedent);
    // `change` is emitted directly on `this` by #commitDate/#commitRangeDate, so it lands here
    // regardless of which commit path fired. Reflects :state(user-invalid) + aria-invalid on the
    // grid part (the role-carrying part — role='grid' rides the part, not internals.role).
    const invalidController = trackUserInvalid(this, { invalid: () => !this.formValidity().valid })
    this.#userInvalid = invalidController
    this.effect(() => {
      if (invalidController.userInvalid()) {
        this.internals.states?.add('user-invalid')
        grid.setAttribute('aria-invalid', 'true')
      } else {
        this.internals.states?.delete('user-invalid')
        grid.removeAttribute('aria-invalid')
      }
    })

    // Reactive effect: when value/valueStart/valueEnd/mode/min/max/disabled change, update
    // existing cells' ARIA + range data attributes without rebuilding the DOM. Reading these
    // signals here registers them as dependencies — the effect re-runs whenever any changes.
    this.effect(() => {
      const v    = this.value
      const min  = this.min
      const max  = this.max
      const dis  = this.effectiveDisabled()
      const mode = this.mode
      const vs   = this.valueStart
      const ve   = this.valueEnd
      this.#updateCellStates(v, min, max, dis, mode, vs, ve, this.#previewIso)
    })

    // Prev/Next month navigation buttons.
    this.listen(prev, 'click', () => {
      const nm = addMonths(this.#displayYear, this.#displayMonth, -1)
      this.#navigateToMonth(nm.y, nm.m)
    })

    this.listen(next, 'click', () => {
      const nm = addMonths(this.#displayYear, this.#displayMonth, 1)
      this.#navigateToMonth(nm.y, nm.m)
    })

    // Bespoke 2D grid keyboard handler (ADR-0048 decision 2; range preview: ADR-0093 clause 3).
    this.listen(grid, 'keydown', (event) => {
      this.#handleGridKey(event as KeyboardEvent)
    })

    // Grid click handler — commit via event delegation, navigate adjacent-month cells.
    this.listen(grid, 'click', (event) => {
      this.#handleGridClick(event as MouseEvent)
    })

    // ADR-0093 clause 3 — hover preview while selecting-end. `pointerover` bubbles (delegation,
    // like click); `pointerleave` on the grid itself (does NOT bubble — fires only when the
    // pointer truly leaves the grid's box, not on cell-to-cell movement within it) clears the
    // candidate. Both are no-ops outside mode="range" and outside the selecting-end state.
    this.listen(grid, 'pointerover', (event) => {
      if (this.mode !== 'range') return
      if (this.valueStart === '' || this.valueEnd !== '') return // not selecting-end
      const hit = event.target as Element | null
      const cell = hit?.closest<HTMLElement>('[role="gridcell"]')
      if (!cell || !this.#gridEl?.contains(cell)) return
      const iso = cell.dataset['date']
      if (!iso || iso === this.#previewIso) return
      this.#previewIso = iso
      this.#refreshCellVisuals()
    })

    this.listen(grid, 'pointerleave', () => {
      if (this.#previewIso === '') return
      this.#previewIso = ''
      this.#refreshCellVisuals()
    })

    // Blur clears too — focus leaving the grid ENTIRELY (relatedTarget outside it) ends the
    // preview; focus moving BETWEEN cells inside the grid (arrow-key nav) keeps previewing (that
    // path already re-set #previewIso itself, above). No-op whenever previewIso is already ''
    // (i.e. always, in mode="single").
    this.listen(grid, 'focusout', (event) => {
      const to = (event as FocusEvent).relatedTarget as Node | null
      if (to && this.#gridEl?.contains(to)) return
      if (this.#previewIso === '') return
      this.#previewIso = ''
      this.#refreshCellVisuals()
    })
  }

  protected override disconnected(): void {
    this.#userInvalid?.release() // idempotent — the listeners already die with the connection scope
    this.#userInvalid = null
  }

  /** Feeds `FormConnectDetail.userInvalid` (ADR-0050) — the `trackUserInvalid` tracker IS the one
   *  timing source; this override just exposes its gate (the text-field/select precedent). */
  protected override formUserInvalid(): boolean {
    return this.#userInvalid?.userInvalid() ?? false
  }

  // ── ADR-0051 — the field-labelling seam wire (the calendar-merge override) ───────────────────

  /**
   * The part-role override (ADR-0051 cl.2/cl.Consequences "calendar is a follow-up too") — the
   * grid's `role='grid'` rides a light-DOM PART attribute, not `internals.role`, so the base's
   * guarded internals-reflection default (dom/form.ts) never fires for this control. UNLIKE
   * text-field/select, the grid ALREADY self-labels to its own month title
   * (`aria-labelledby=titleId`, set once at `#ensureShell()`) — this override must MERGE the
   * field's label ref into that existing relationship, never clobber it (the calendar always
   * needs its own month/year context alongside whatever name the field supplies).
   *
   * `aria-describedby` has no other owner (the grid carries no internal validity-message node,
   * unlike text-field's editor) — written from `[refs.description, refs.error]` when fielded,
   * cleared on dissociation, in both branches below (the combo-box precedent, which has the same
   * no-competing-owner shape).
   *
   * Guards a not-yet-created grid/title (the LLD-C2 override contract) — cannot happen in practice
   * (`#ensureShell()` runs synchronously at the top of `connected()`, before the base's forwarding
   * effect installs), but the guard costs nothing and documents the contract.
   */
  protected override applyFieldLabelling(refs: FieldLabelling | null): void {
    const grid = this.#gridEl
    const title = this.#titleEl
    if (!grid || !title) return
    grid.setAttribute('aria-labelledby', refs?.label ? `${refs.label.id} ${title.id}` : title.id)
    if (refs === null) {
      grid.removeAttribute('aria-describedby')
      return
    }
    const described = [refs.description, refs.error].filter((el): el is HTMLElement => el !== null)
    if (described.length > 0) grid.setAttribute('aria-describedby', described.map((el) => el.id).join(' '))
    else grid.removeAttribute('aria-describedby')
  }

  // ── Shell creation (idempotent) ───────────────────────────────────────────────────────────

  #ensureShell(): { grid: HTMLElement; prev: HTMLElement; next: HTMLElement } {
    if (this.#panelEl && this.#gridEl && this.#prevBtn && this.#nextBtn && this.#titleEl && this.#statusEl) {
      return { grid: this.#gridEl, prev: this.#prevBtn, next: this.#nextBtn }
    }

    // Panel — the [data-box] container (adopts the shared box-model: inset margins + sticky nav).
    const panel = document.createElement('div')
    panel.setAttribute('data-part', 'panel')
    panel.setAttribute('data-box', '')

    // Nav header — <header> is sticky + flex-row by container-box.css; we add `justify-content`.
    const nav = document.createElement('header')
    nav.setAttribute('data-part', 'nav')

    const prev = document.createElement('button')
    prev.setAttribute('data-part', 'prev')
    prev.setAttribute('type', 'button')
    prev.setAttribute('aria-label', 'Previous month')
    setIcon(prev, 'caret-left') // Phosphor, via @agent-ui/icons

    // Stable title id so [data-part=grid] can reference it via aria-labelledby.
    const titleId = `ui-calendar-title-${++_nextCalendarId}`
    const title = document.createElement('span')
    title.setAttribute('data-part', 'title')
    title.setAttribute('id', titleId)
    title.setAttribute('aria-live', 'polite')
    // textContent filled by #rebuildGrid() on each display-month change.

    const next = document.createElement('button')
    next.setAttribute('data-part', 'next')
    next.setAttribute('type', 'button')
    next.setAttribute('aria-label', 'Next month')
    setIcon(next, 'caret-right') // Phosphor, via @agent-ui/icons

    nav.appendChild(prev)
    nav.appendChild(title)
    nav.appendChild(next)

    // Grid container — host of the weekday header row + 6 week rows (all populated by #rebuildGrid).
    const grid = document.createElement('div')
    grid.setAttribute('data-part', 'grid')
    grid.setAttribute('role', 'grid')
    grid.setAttribute('aria-labelledby', titleId)

    // ADR-0093 clause 3 — visually-hidden aria-live status region (range mode only). Always
    // created (the idempotent-parts precedent — ui-select's aria-label span) so connected() never
    // conditionally mints DOM; text stays empty (never written by #announce) in mode="single".
    // Position:absolute (calendar.css) takes it out of flow — it does not disturb the [data-box]
    // direct-child inset the panel/nav/grid share.
    const status = document.createElement('div')
    status.setAttribute('data-part', 'status')
    status.setAttribute('aria-live', 'polite')

    panel.appendChild(nav)
    panel.appendChild(grid)
    panel.appendChild(status)
    this.appendChild(panel)

    this.#panelEl  = panel
    this.#gridEl   = grid
    this.#titleEl  = title
    this.#prevBtn  = prev
    this.#nextBtn  = next
    this.#statusEl = status

    return { grid, prev, next }
  }

  // ── Grid population ───────────────────────────────────────────────────────────────────────

  /**
   * Rebuild the entire grid for the currently-displayed month. Clears old rows and creates
   * fresh DOM (weekday header row + 6 week rows × 7 cells). The focus cursor (#focusIso) is
   * used to assign tabindex=0 via #computeFocusTarget.
   *
   * Called on: initial connect · prev/next nav · PageUp/Down · Arrow keys that cross month
   * boundaries · click on an adjacent-month cell.
   */
  #rebuildGrid(): void {
    const grid  = this.#gridEl
    const title = this.#titleEl
    if (!grid || !title) return

    const y   = this.#displayYear
    const m   = this.#displayMonth
    const today   = this.#today()
    const v       = this.value
    const min     = this.min
    const max     = this.max
    const dis     = this.effectiveDisabled()
    const mode    = this.mode
    const vs      = this.valueStart
    const ve      = this.valueEnd
    const preview = this.#previewIso
    const focusTarget = this.#computeFocusTarget()

    // Update the month/year title (aria-live=polite announces to AT on change).
    title.textContent = `${MONTH_NAMES[m - 1]} ${y}`

    // Clear existing content (idempotent: always rebuilds from scratch).
    while (grid.firstChild) grid.removeChild(grid.firstChild)

    // Weekday column-header row: Su Mo Tu We Th Fr Sa.
    const headerRow = document.createElement('div')
    headerRow.setAttribute('role', 'row')
    for (let i = 0; i < 7; i++) {
      const th = document.createElement('span')
      th.setAttribute('role', 'columnheader')
      th.setAttribute('aria-label', WEEKDAY_FULL[i])
      th.setAttribute('abbr', WEEKDAY_FULL[i])
      th.textContent = WEEKDAY_SHORT[i]
      headerRow.appendChild(th)
    }
    grid.appendChild(headerRow)

    // Compute the first cell in the 6×7 grid. `firstDow` = day-of-week of the month's 1st
    // (0=Sunday). `startDate` = that 1st minus its DOW offset (may be in the previous month).
    // LOCAL Date construction — no timezone pitfall here (m is 1-based, m-1 is 0-based).
    const firstDow = new Date(y, m - 1, 1).getDay()
    const startDate = advanceDate(y, m, 1, -firstDow)

    // 6 week rows × 7 day cells.
    for (let row = 0; row < 6; row++) {
      const rowEl = document.createElement('div')
      rowEl.setAttribute('role', 'row')

      for (let col = 0; col < 7; col++) {
        const idx = row * 7 + col
        const { y: cy, m: cm, d: cd } = advanceDate(startDate.y, startDate.m, startDate.d, idx)
        const iso = dateStr(cy, cm, cd)

        const isOutside = (cy !== y || cm !== m)
        const isToday   = (cy === today.y && cm === today.m && cd === today.d)
        const isDisabled = dis || isOutOfRange(iso, min, max)
        // ADR-0093 clause 4 — range mode computes selection from the pair (+ preview candidate);
        // single mode keeps the original single-value check. `range` is null in single mode —
        // its data attributes are then never set below (grep-provable: single mode stamps none).
        const range = mode === 'range' ? rangeSelectionFor(iso, vs, ve, preview) : null
        const isSelected = mode === 'range' ? range!.selected : (iso === v && v !== '')

        const cell = document.createElement('button')
        cell.setAttribute('role', 'gridcell')
        cell.setAttribute('type', 'button')
        cell.setAttribute('tabindex', iso === focusTarget ? '0' : '-1')
        cell.setAttribute('aria-label', `${MONTH_NAMES[cm - 1]} ${cd}, ${cy}`)
        cell.setAttribute('aria-selected', isSelected ? 'true' : 'false')
        if (isDisabled) cell.setAttribute('aria-disabled', 'true')
        if (isToday)   cell.dataset['today'] = ''
        if (isOutside) cell.dataset['outside'] = ''
        if (range?.rangeStart) cell.dataset['rangeStart'] = ''
        if (range?.rangeEnd)   cell.dataset['rangeEnd']   = ''
        if (range?.inRange)    cell.dataset['inRange']    = ''
        cell.dataset['date'] = iso
        cell.textContent = String(cd)

        rowEl.appendChild(cell)
      }

      grid.appendChild(rowEl)
    }
  }

  /**
   * Update ARIA + range data attributes (aria-selected / aria-disabled / data-today /
   * data-range-start / data-range-end / data-in-range) on the existing cells in the current grid
   * when a prop OR the preview candidate changes. No DOM rebuild — pure attribute mutation. Also
   * re-syncs tabindex=0 to the computed focus target.
   *
   * Called from the scope-owned reactive effect (value/valueStart/valueEnd/mode/min/max/disabled)
   * AND imperatively from the hover/keyboard preview paths (#refreshCellVisuals) — `mode`/
   * `valueStart`/`valueEnd`/`previewIso` are passed explicitly rather than re-read internally so
   * every call site is an honest snapshot of what it is rendering.
   */
  #updateCellStates(
    v: string, min: string, max: string, disabled: boolean,
    mode: 'single' | 'range', valueStart: string, valueEnd: string, previewIso: string,
  ): void {
    const grid = this.#gridEl
    if (!grid) return

    const today = this.#today()
    const cells = grid.querySelectorAll<HTMLElement>('[role="gridcell"]')
    const focusTarget = this.#computeFocusTarget()

    for (const cell of cells) {
      const iso = cell.dataset['date']
      if (!iso) continue

      // ADR-0093 clause 4 — `range` is null in single mode, so every data-range-*/data-in-range
      // branch below takes its `false` arm and the attribute is deleted (single mode stamps none).
      const range = mode === 'range' ? rangeSelectionFor(iso, valueStart, valueEnd, previewIso) : null
      const isSelected = mode === 'range' ? range!.selected : (iso === v && v !== '')
      const isDisabled = disabled || isOutOfRange(iso, min, max)
      const parsed     = parseDateStr(iso)
      const isToday    = parsed
        ? (parsed.y === today.y && parsed.m === today.m && parsed.d === today.d)
        : false

      cell.setAttribute('aria-selected', isSelected ? 'true' : 'false')
      if (isDisabled) {
        cell.setAttribute('aria-disabled', 'true')
      } else {
        cell.removeAttribute('aria-disabled')
      }
      if (isToday) {
        cell.dataset['today'] = ''
      } else {
        delete cell.dataset['today']
      }
      if (range?.rangeStart) cell.dataset['rangeStart'] = ''; else delete cell.dataset['rangeStart']
      if (range?.rangeEnd)   cell.dataset['rangeEnd']   = ''; else delete cell.dataset['rangeEnd']
      if (range?.inRange)    cell.dataset['inRange']    = ''; else delete cell.dataset['inRange']
      cell.setAttribute('tabindex', iso === focusTarget ? '0' : '-1')
    }
  }

  /** Recompute + apply cell visuals from the CURRENT prop/preview state (the hover/keyboard
   *  preview call site — outside the reactive effect, since `#previewIso` is not a signal). */
  #refreshCellVisuals(): void {
    this.#updateCellStates(
      this.value, this.min, this.max, this.effectiveDisabled(),
      this.mode, this.valueStart, this.valueEnd, this.#previewIso,
    )
  }

  // ── Month navigation ──────────────────────────────────────────────────────────────────────

  /**
   * Navigate to a different month: update display state, update the focus cursor to the same
   * day number (clamped to the new month's last day), rebuild the grid, restore DOM focus.
   *
   * Called by the prev/next buttons. Keyboard PageUp/Down navigates imperatively (they know
   * the exact target day and call #rebuildGrid + #focusCurrentCell directly).
   */
  #navigateToMonth(y: number, m: number): void {
    const prevFocus = parseDateStr(this.#focusIso)
    const day       = prevFocus ? prevFocus.d : 1
    const clamped   = Math.min(day, daysInMonth(y, m))
    this.#displayYear  = y
    this.#displayMonth = m
    this.#focusIso     = dateStr(y, m, clamped)
    this.#rebuildGrid()
    this.#focusCurrentCell()
  }

  /** DOM-focus the cell that holds tabindex=0. No-op when the grid isn't connected. */
  #focusCurrentCell(): void {
    const cell = this.#gridEl?.querySelector<HTMLElement>('[tabindex="0"]')
    cell?.focus()
  }

  // ── Bespoke 2D keyboard handler ───────────────────────────────────────────────────────────

  #handleGridKey(event: KeyboardEvent): void {
    // Only intercept grid-navigation / commit keys.
    const key = event.key
    const NAV = new Set([
      'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
      'Home', 'End', 'PageUp', 'PageDown', 'Enter', ' ',
    ])
    if (!NAV.has(key)) return

    // Active cell must be inside the grid with role=gridcell.
    const active = document.activeElement as HTMLElement | null
    if (!active || active.getAttribute('role') !== 'gridcell') return
    if (!this.#gridEl?.contains(active)) return

    const iso = active.dataset['date']
    if (!iso) return
    const cur = parseDateStr(iso)
    if (!cur) return

    // preventDefault for ALL navigation/commit keys (suppresses scroll, form-submit,
    // and — for Enter — the re-activation of an overlay anchor button, ADR-0048 §2).
    event.preventDefault()

    // ── Commit path (Enter / Space) ──────────────────────────────────────────────────────
    if (key === 'Enter' || key === ' ') {
      // No-op when the cell is disabled or out-of-range (aria-disabled is authoritative).
      if (active.getAttribute('aria-disabled') !== 'true') {
        this.#commitDate(cur.y, cur.m, cur.d)
      }
      return
    }

    // ── Navigation path — compute the target date ────────────────────────────────────────
    let target: { y: number; m: number; d: number }

    switch (key) {
      case 'ArrowLeft':
        target = advanceDate(cur.y, cur.m, cur.d, -1)
        break
      case 'ArrowRight':
        target = advanceDate(cur.y, cur.m, cur.d, 1)
        break
      case 'ArrowUp':
        target = advanceDate(cur.y, cur.m, cur.d, -7)
        break
      case 'ArrowDown':
        target = advanceDate(cur.y, cur.m, cur.d, 7)
        break
      case 'Home': {
        // Sunday of the current week.
        const dow = new Date(cur.y, cur.m - 1, cur.d).getDay()
        target = advanceDate(cur.y, cur.m, cur.d, -dow)
        break
      }
      case 'End': {
        // Saturday of the current week.
        const dow = new Date(cur.y, cur.m - 1, cur.d).getDay()
        target = advanceDate(cur.y, cur.m, cur.d, 6 - dow)
        break
      }
      case 'PageUp': {
        const delta = event.shiftKey ? -12 : -1
        const nm = addMonths(cur.y, cur.m, delta)
        target = { ...nm, d: Math.min(cur.d, daysInMonth(nm.y, nm.m)) }
        break
      }
      case 'PageDown': {
        const delta = event.shiftKey ? 12 : 1
        const nm = addMonths(cur.y, cur.m, delta)
        target = { ...nm, d: Math.min(cur.d, daysInMonth(nm.y, nm.m)) }
        break
      }
      default:
        return
    }

    // Update the keyboard cursor.
    this.#focusIso = dateStr(target.y, target.m, target.d)

    // ADR-0093 clause 3 — keyboard-focus ALSO previews the in-progress band while selecting-end
    // (the cursor IS the "which end am I editing" answer, same as hover). No-op outside
    // mode="range" / outside selecting-end.
    if (this.mode === 'range' && this.valueStart !== '' && this.valueEnd === '') {
      this.#previewIso = this.#focusIso
    }

    if (target.y === this.#displayYear && target.m === this.#displayMonth) {
      // Target is in the current displayed month — refresh cell attributes (tabindex sync +
      // aria-selected/range-preview) without a DOM rebuild.
      this.#refreshCellVisuals()
      this.#focusCurrentCell()
    } else {
      // Different month — rebuild the grid for the new month then restore focus.
      this.#displayYear  = target.y
      this.#displayMonth = target.m
      this.#rebuildGrid()
      this.#focusCurrentCell()
    }
  }

  // ── Click handler ─────────────────────────────────────────────────────────────────────────

  #handleGridClick(event: MouseEvent): void {
    // Resolve the clicked cell via delegation (the click target may be the button or a child).
    const hit  = event.target as Element | null
    const cell = hit?.closest<HTMLElement>('[role="gridcell"]')
    if (!cell || !this.#gridEl?.contains(cell)) return

    const iso = cell.dataset['date']
    if (!iso) return
    const parsed = parseDateStr(iso)
    if (!parsed) return

    // Update the keyboard cursor.
    this.#focusIso = iso

    if (parsed.y !== this.#displayYear || parsed.m !== this.#displayMonth) {
      // Adjacent-month cell: navigate to that month first (standard calendar UX).
      this.#displayYear  = parsed.y
      this.#displayMonth = parsed.m
      this.#rebuildGrid()
      // Re-query the live cell after rebuild (old reference is gone).
      const liveCell = this.#gridEl?.querySelector<HTMLElement>(`[data-date="${iso}"]`)
      if (liveCell && liveCell.getAttribute('aria-disabled') !== 'true') {
        this.#commitDate(parsed.y, parsed.m, parsed.d)
      }
    } else {
      // Same month: commit if not disabled.
      if (cell.getAttribute('aria-disabled') !== 'true') {
        this.#commitDate(parsed.y, parsed.m, parsed.d)
      }
    }
  }

  // ── Commit ────────────────────────────────────────────────────────────────────────────────

  /**
   * Commit a date selection — the ONE choke point both the click and Enter/Space paths call,
   * which is exactly what makes it mode-aware without touching either caller (ADR-0093 clause 6:
   * "`#commitDate` becomes mode-aware"). mode="single" runs the ORIGINAL, byte-identical path;
   * mode="range" delegates to `#commitRangeDate` and NEVER touches `this.value` (clause 1).
   *
   * Emit semantics (ADR-0048 decision 2, reusing selectionCommit's learned semantics):
   *   · `change` — the value-binding event (value:{prop:'value', event:'change'} contract).
   *   · `select` — the selection event (detail = ISO string; usable for type=date overlay wiring).
   *   · Enter already called preventDefault() in #handleGridKey, so a calendar-in-an-overlay
   *     does not re-trigger the anchor button (the ADR-0045 / ADR-0048 commit semantics).
   */
  #commitDate(y: number, m: number, d: number): void {
    const iso = dateStr(y, m, d)

    if (this.mode === 'range') {
      this.#commitRangeDate(iso)
      return
    }

    const changed = iso !== this.value
    this.value    = iso
    if (changed) {
      this.emit('change')
      this.emit('select', iso)
    }
  }

  /**
   * Range-mode commit (ADR-0093 clause 3 — swap-complete, single grid, two picks):
   *   · idle (both '') OR complete (both set, any order) → begin a FRESH anchor: valueStart=iso,
   *     valueEnd=''. A pick on an already-complete range starts a new one, discarding the old pair.
   *   · selecting-end (valueStart set, valueEnd '') → the SECOND commit ALWAYS completes as
   *     `[min,max]` of {iso, pendingStart} — a pick earlier than the pending start SWAP-completes
   *     (Kim's F2 ruling) via `normalizeRange` (lexicographic ISO compare, zero Date construction;
   *     the SAME function the preview uses, so the committed band is provably identical to what
   *     was previewed). Same-day second pick ⇒ lo===hi, a valid single-day range.
   *
   * `select` (detail = the raw picked iso) fires on EVERY commit; `change` fires ONLY on
   * completion (mirrors the single-date `value` two-way-binding contract — clause 2). NEVER
   * writes `this.value` — mode-inert by construction (clause 1).
   */
  #commitRangeDate(iso: string): void {
    const start = this.valueStart
    const end   = this.valueEnd
    const isComplete = start !== '' && end !== ''

    if (start === '' || isComplete) {
      this.valueStart  = iso
      this.valueEnd    = ''
      this.#previewIso = iso
      this.emit('select', iso)
      this.#announce('Start date set — choose an end date.')
      return
    }

    const [lo, hi]   = normalizeRange(iso, start)
    this.valueStart  = lo
    this.valueEnd    = hi
    this.#previewIso = ''
    this.emit('select', iso)
    this.emit('change')
    // Completion announcement names BOTH dates in order — a swapped completion is audible as the
    // resulting (already-normalized) range (ADR-0093 clause 3).
    this.#announce(`${formatIsoLong(lo)} to ${formatIsoLong(hi)} selected.`)
  }

  /** Write to the visually-hidden aria-live status region (ADR-0093 clause 3; range mode only —
   *  single mode's #commitDate path never calls this, so the region stays silent there). */
  #announce(text: string): void {
    if (this.#statusEl) this.#statusEl.textContent = text
  }

  // ── Private helpers ───────────────────────────────────────────────────────────────────────

  /** Today's local date (y/m/d integers). New Date() uses local timezone — correct for a date calendar. */
  #today(): { y: number; m: number; d: number } {
    const t = new Date()
    return { y: t.getFullYear(), m: t.getMonth() + 1, d: t.getDate() }
  }

  /**
   * Compute the ISO date that should hold tabindex=0. Priority (spec §Grid-decision):
   *   1. #focusIso cursor, if it refers to a date in the currently displayed month.
   *   2. The selected value, if it is in the currently displayed month.
   *   3. Today, if today is in the currently displayed month.
   *   4. The first day of the displayed month (fallback).
   */
  #computeFocusTarget(): string {
    const y = this.#displayYear
    const m = this.#displayMonth

    const fp = parseDateStr(this.#focusIso)
    if (fp && fp.y === y && fp.m === m) return this.#focusIso

    if (this.value !== '') {
      const vp = parseDateStr(this.value)
      if (vp && vp.y === y && vp.m === m) return this.value
    }

    const today = this.#today()
    if (today.y === y && today.m === m) return dateStr(today.y, today.m, today.d)

    return dateStr(y, m, 1)
  }
}

if (!customElements.get('ui-calendar')) customElements.define('ui-calendar', UICalendarElement)
