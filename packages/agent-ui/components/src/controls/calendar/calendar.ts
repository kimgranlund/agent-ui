// calendar.ts — UICalendarElement, the Wave-5B standalone month-grid date picker control.
// (control-suite-wave5-input-codecs-pickers.decomp.md 5B-1 · ADR-0048)
//
// A FACE form control (extends UIFormElement) that contributes a selected ISO date (YYYY-MM-DD)
// to a form AND will serve as the popup body for type=date on ui-text-field (lazily imported
// there in slice 5B-3 — this slice builds the standalone control only).
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
//   --ui-calendar-outside-ink.
//
// FORM SEAMS: formValue() = ISO string (null when none); formValidity() = valueMissing +
//   rangeUnderflow/Overflow; formReset() → initial value attribute; formStateRestore().
//
// Layer: controls/ → dom + reactive (inward-only ✓). No overlay, roving-focus, or
// selectionCommit traits: this control owns its bespoke navigation model (ADR-0048 §2).
// erasableSyntaxOnly ✓ (no enum/namespace/decorators). verbatimModuleSyntax ✓ (import type).

import { UIFormElement } from '../../dom/index.ts'
import { prop } from '../../dom/index.ts'
import type { PropsSchema, ReactiveProps } from '../../dom/index.ts'
import type { FormValue, ValidityResult } from '../../dom/index.ts'
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

  // `value` — the selected date as an ISO 'YYYY-MM-DD' string. '' = nothing selected.
  // Reflected so `<ui-calendar value="2026-07-01">` works declaratively AND the renderer
  // two-way-binds it (value:{prop:'value', event:'change'}).
  value: { ...prop.string(''), reflect: true },

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
  #panelEl: HTMLElement | null = null
  #gridEl:  HTMLElement | null = null
  #titleEl: HTMLElement | null = null
  #prevBtn: HTMLElement | null = null
  #nextBtn: HTMLElement | null = null

  // The HTML-authored initial value captured at FIRST connect (before any reactive updates). Since
  // `value` has `reflect: true`, setting `el.value = x` synchronously updates the content attribute —
  // so `getAttribute('value')` at formReset time always returns the CURRENT value, not the original.
  // Capturing here gives us the `<ui-calendar value="…">` default for form-reset parity.
  #initialValue = ''

  // The currently displayed month (1-based). Updated only by navigation actions, which call
  // #rebuildGrid() directly. Not reactive signals — the effect handles prop-change updates.
  #displayYear  = 0
  #displayMonth = 0

  // ISO date of the cell that currently holds tabindex=0 (the roving keyboard cursor).
  // '' = unset; on first connect it is computed from value/today/first (see #computeFocusTarget).
  #focusIso = ''

  // ── Form seams (UIFormElement hooks) ─────────────────────────────────────────────────────

  protected override formValue(): FormValue {
    // Null when nothing is selected — no form-data entry contributed.
    return this.value !== '' ? this.value : null
  }

  protected override formValidity(): ValidityResult {
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
    // Restore to the HTML-authored initial value captured at first connect (see #initialValue).
    this.value = this.#initialValue
  }

  protected override formStateRestore(state: File | string | FormData | null): void {
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

    // Capture the HTML-authored initial value BEFORE any reactive updates (first connect only).
    // `reflect: true` means el.value = x updates the attribute synchronously, so we cannot read
    // getAttribute later and expect the original HTML value. Capture once here instead.
    if (this.#initialValue === '' && this.getAttribute('value')) {
      this.#initialValue = this.getAttribute('value')!
    }

    // Seed the displayed month from the current value (or today if none set).
    const today = this.#today()
    const seeded = parseDateStr(this.value) ?? today
    this.#displayYear  = seeded.y
    this.#displayMonth = seeded.m

    // Seed the keyboard cursor: selected date → today (if in month) → first day of month.
    if (this.value !== '') {
      this.#focusIso = this.value
    } else if (seeded.y === today.y && seeded.m === today.m) {
      this.#focusIso = dateStr(today.y, today.m, today.d)
    } else {
      this.#focusIso = dateStr(seeded.y, seeded.m, 1)
    }

    // Build the initial grid.
    this.#rebuildGrid()

    // Reactive effect: when value/min/max/disabled change, update existing cells' ARIA
    // attributes without rebuilding the DOM. Reading these signals here registers them as
    // dependencies — the effect re-runs whenever any of them change.
    this.effect(() => {
      const v   = this.value
      const min = this.min
      const max = this.max
      const dis = this.effectiveDisabled()
      this.#updateCellStates(v, min, max, dis)
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

    // Bespoke 2D grid keyboard handler (ADR-0048 decision 2).
    this.listen(grid, 'keydown', (event) => {
      this.#handleGridKey(event as KeyboardEvent)
    })

    // Grid click handler — commit via event delegation, navigate adjacent-month cells.
    this.listen(grid, 'click', (event) => {
      this.#handleGridClick(event as MouseEvent)
    })
  }

  // ── Shell creation (idempotent) ───────────────────────────────────────────────────────────

  #ensureShell(): { grid: HTMLElement; prev: HTMLElement; next: HTMLElement } {
    if (this.#panelEl && this.#gridEl && this.#prevBtn && this.#nextBtn && this.#titleEl) {
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

    panel.appendChild(nav)
    panel.appendChild(grid)
    this.appendChild(panel)

    this.#panelEl = panel
    this.#gridEl  = grid
    this.#titleEl = title
    this.#prevBtn = prev
    this.#nextBtn = next

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

        const isOutside  = (cy !== y || cm !== m)
        const isToday    = (cy === today.y && cm === today.m && cd === today.d)
        const isSelected = (iso === v && v !== '')
        const isDisabled = dis || isOutOfRange(iso, min, max)

        const cell = document.createElement('button')
        cell.setAttribute('role', 'gridcell')
        cell.setAttribute('type', 'button')
        cell.setAttribute('tabindex', iso === focusTarget ? '0' : '-1')
        cell.setAttribute('aria-label', `${MONTH_NAMES[cm - 1]} ${cd}, ${cy}`)
        cell.setAttribute('aria-selected', isSelected ? 'true' : 'false')
        if (isDisabled) cell.setAttribute('aria-disabled', 'true')
        if (isToday)   cell.dataset['today'] = ''
        if (isOutside) cell.dataset['outside'] = ''
        cell.dataset['date'] = iso
        cell.textContent = String(cd)

        rowEl.appendChild(cell)
      }

      grid.appendChild(rowEl)
    }
  }

  /**
   * Update ARIA attributes (aria-selected / aria-disabled / data-today) on the existing cells
   * in the current grid when a prop changes. No DOM rebuild — pure attribute mutation. Also
   * re-syncs tabindex=0 to the computed focus target.
   *
   * Called exclusively from the scope-owned reactive effect that tracks value/min/max/disabled.
   */
  #updateCellStates(v: string, min: string, max: string, disabled: boolean): void {
    const grid = this.#gridEl
    if (!grid) return

    const today = this.#today()
    const cells = grid.querySelectorAll<HTMLElement>('[role="gridcell"]')
    const focusTarget = this.#computeFocusTarget()

    for (const cell of cells) {
      const iso = cell.dataset['date']
      if (!iso) continue

      const isSelected = (iso === v && v !== '')
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
      cell.setAttribute('tabindex', iso === focusTarget ? '0' : '-1')
    }
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

    if (target.y === this.#displayYear && target.m === this.#displayMonth) {
      // Target is in the current displayed month — move tabindex within the existing grid.
      const cells = this.#gridEl?.querySelectorAll<HTMLElement>('[role="gridcell"]')
      if (cells) {
        for (const cell of cells) {
          cell.setAttribute('tabindex', cell.dataset['date'] === this.#focusIso ? '0' : '-1')
        }
      }
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
   * Commit a date selection: update the `value` prop (which triggers the base class's reactive
   * setFormValue + setValidity effects and our own cell-state effect) and emit change + select.
   *
   * Emit semantics (ADR-0048 decision 2, reusing selectionCommit's learned semantics):
   *   · `change` — the value-binding event (value:{prop:'value', event:'change'} contract).
   *   · `select` — the selection event (detail = ISO string; usable for type=date overlay wiring).
   *   · Enter already called preventDefault() in #handleGridKey, so a calendar-in-an-overlay
   *     does not re-trigger the anchor button (the ADR-0045 / ADR-0048 commit semantics).
   */
  #commitDate(y: number, m: number, d: number): void {
    const iso     = dateStr(y, m, d)
    const changed = iso !== this.value
    this.value    = iso
    if (changed) {
      this.emit('change')
      this.emit('select', iso)
    }
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
