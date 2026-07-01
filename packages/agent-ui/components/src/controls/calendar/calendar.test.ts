import { describe, it, expect } from 'vitest'
import { UICalendarElement } from './calendar.ts'
import type { FormValue, ValidityResult } from '../../dom/index.ts'
import {
  splitFrontmatter,
  parseDescriptor,
  validateComponentDescriptor,
  compareDescriptorToProps,
  type ParsedAttribute,
} from '../../descriptor/component-descriptor.ts'
// @ts-expect-error - node:fs is untyped without @types/node; vitest/node resolves it at runtime
import { readFileSync } from 'node:fs'
declare const process: { cwd(): string }

// Wave-5B jsdom probes — ui-calendar (decomp 5B-1 · ADR-0048).
//
// jsdom reality: `ElementInternals` form-association (setFormValue / setValidity) is absent in
// jsdom. We stub it per-instance BEFORE connect (the sanctioned pattern; see checkbox/select tests).
// Real focus mechanics, CSS geometry, forced-colors, and the full roving-focus-across-month proof
// are in calendar.browser.test.ts (Chromium + WebKit). Keyboard tests below rely on jsdom honouring
// `element.focus()` updating `document.activeElement`, which it does for connected focusable elements.
//
// Named probes:
//   cal-upgrade · cal-typed · cal-define-guard · cal-parts-created · cal-parts-idempotent ·
//   cal-month-render · cal-leap-feb · cal-arrow-right · cal-arrow-left · cal-arrow-down ·
//   cal-arrow-up · cal-home · cal-end · cal-pageup · cal-pagedown · cal-commit-enter ·
//   cal-commit-space · cal-commit-click · cal-commit-no-change · cal-disabled-enter-noop ·
//   cal-min-max-cells · cal-form-value · cal-form-validity · cal-form-reset ·
//   cal-form-state-restore · cal-c10-residue · cal-descriptor-schema · cal-descriptor-bijection ·
//   cal-descriptor-negative

// ── Form-association stub (jsdom lacks setFormValue / setValidity) ────────────────────────────

function stubFormAssoc(internals: ElementInternals): void {
  const i = internals as unknown as Record<string, unknown>
  if (typeof i['setFormValue'] !== 'function') {
    i['setFormValue'] = (): void => {}
    i['setValidity'] = (): void => {}
  }
}

// ── Probe subclass ────────────────────────────────────────────────────────────────────────────

class ProbeCalendar extends UICalendarElement {
  get probeInternals(): ElementInternals {
    return this.internals
  }
  formValueProbe(): FormValue {
    return (this as unknown as { formValue(): FormValue }).formValue.call(this)
  }
  formValidityProbe(): ValidityResult {
    return (this as unknown as { formValidity(): ValidityResult }).formValidity.call(this)
  }
  formResetProbe(): void {
    ;(this as unknown as { formReset(): void }).formReset.call(this)
  }
  formStateRestoreProbe(state: string): void {
    ;(this as unknown as { formStateRestore(s: unknown): void }).formStateRestore.call(this, state)
  }
}
customElements.define('ui-calendar-probe', ProbeCalendar)

// ── Helpers ───────────────────────────────────────────────────────────────────────────────────

/**
 * Build, stub, connect, and return a ProbeCalendar.
 * Props can be set before connect by passing an init object; the `value` prop
 * seeds the displayed month and focus cursor.
 */
function makeCalendar(
  init: { value?: string; min?: string; max?: string; disabled?: boolean; required?: boolean } = {},
): ProbeCalendar {
  const el = new ProbeCalendar()
  if (init.value    !== undefined) el.value    = init.value
  if (init.min      !== undefined) el.min      = init.min
  if (init.max      !== undefined) el.max      = init.max
  if (init.disabled !== undefined) el.disabled = init.disabled
  if (init.required !== undefined) el.required = init.required
  stubFormAssoc(el.probeInternals) // stub BEFORE connect — form effects run synchronously on connectedCallback
  document.body.append(el)        // connect fires here; shell + grid built synchronously
  return el
}

/** Fire a keydown on an element with bubbles + cancelable. Returns the event (to check defaultPrevented). */
function key(target: Element, k: string, opts: KeyboardEventInit = {}): KeyboardEvent {
  const ev = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...opts })
  target.dispatchEvent(ev)
  return ev
}

/** All [role=gridcell] buttons in the calendar's grid. */
function gridCells(el: ProbeCalendar): HTMLElement[] {
  return [...el.querySelectorAll<HTMLElement>('[data-part="grid"] [role="gridcell"]')]
}

/** The cell with a given ISO date. */
function cellFor(el: ProbeCalendar, iso: string): HTMLElement | null {
  return el.querySelector<HTMLElement>(`[data-date="${iso}"]`)
}

/** The ISO date of the cell that holds tabindex="0". */
function focusedIso(el: ProbeCalendar): string | null {
  const cell = el.querySelector<HTMLElement>('[role="gridcell"][tabindex="0"]')
  return cell?.dataset['date'] ?? null
}

// ── Upgrade + typed prop surface ──────────────────────────────────────────────────────────────

describe('ui-calendar — upgrade + typed prop surface (cal-upgrade)', () => {
  it('cal-upgrade: upgrades to UICalendarElement with correct default prop values (no connect needed)', () => {
    const el = document.createElement('ui-calendar') as UICalendarElement
    expect(el).toBeInstanceOf(UICalendarElement)
    expect(el.value).toBe('')
    expect(el.min).toBe('')
    expect(el.max).toBe('')
    expect(el.name).toBe('')
    expect(el.disabled).toBe(false)
    expect(el.required).toBe(false)
    expect(el.size).toBe('md') // fleet [size] prop; default = 'md' (ADR-0041 / BLOCKER-2)
  })

  it('cal-typed: props have the correct types (compile-time NCs)', () => {
    const fn = (): void => {
      const el = new UICalendarElement()
      el.value   = '2026-07-15'
      el.min     = '2026-01-01'
      el.max     = '2026-12-31'
      el.name    = 'date'
      el.disabled = false
      el.required = true
      el.size     = 'sm'
      el.size     = 'lg'
      // @ts-expect-error — disabled is boolean, not string
      el.disabled = 'yes'
      // @ts-expect-error — required is boolean, not number
      el.required = 1
      // @ts-expect-error — size is a 'sm'|'md'|'lg' literal union, not an arbitrary string
      el.size = 'xl'
    }
    expect(typeof fn).toBe('function')
  })

  it('cal-define-guard: self-defines ui-calendar, guarded against a double-define', () => {
    expect(customElements.get('ui-calendar')).toBe(UICalendarElement)
    expect(() => {
      if (!customElements.get('ui-calendar')) customElements.define('ui-calendar', UICalendarElement)
    }).not.toThrow()
  })
})

// ── Control-created parts ─────────────────────────────────────────────────────────────────────

describe('ui-calendar — control-created parts (cal-parts-created · cal-parts-idempotent)', () => {
  it('cal-parts-created: creates panel / nav / title / prev / next / grid on first connect', () => {
    const el = makeCalendar({ value: '2026-07-15' })
    expect(el.querySelector('[data-part="panel"]'), 'panel missing').not.toBeNull()
    expect(el.querySelector('[data-part="nav"]'),   'nav missing').not.toBeNull()
    expect(el.querySelector('[data-part="title"]'), 'title missing').not.toBeNull()
    expect(el.querySelector('[data-part="prev"]'),  'prev missing').not.toBeNull()
    expect(el.querySelector('[data-part="next"]'),  'next missing').not.toBeNull()
    expect(el.querySelector('[data-part="grid"]'),  'grid missing').not.toBeNull()
    el.remove()
  })

  it('cal-parts-created: exactly ONE of each part is created', () => {
    const el = makeCalendar({ value: '2026-07-15' })
    for (const part of ['panel', 'nav', 'title', 'prev', 'next', 'grid']) {
      expect(
        el.querySelectorAll(`[data-part="${part}"]`).length,
        `${part}: expected exactly 1`,
      ).toBe(1)
    }
    el.remove()
  })

  it('cal-parts-created: [data-part=panel] has [data-box] (opts into the shared container box-model)', () => {
    const el = makeCalendar({ value: '2026-07-15' })
    const panel = el.querySelector('[data-part="panel"]')!
    expect(panel.hasAttribute('data-box')).toBe(true)
    el.remove()
  })

  it('cal-parts-created: [data-part=grid] has role=grid and aria-labelledby matching the title id', () => {
    const el = makeCalendar({ value: '2026-07-15' })
    const grid  = el.querySelector('[data-part="grid"]')!
    const title = el.querySelector('[data-part="title"]')!
    expect(grid.getAttribute('role')).toBe('grid')
    expect(title.id).toBeTruthy()
    expect(grid.getAttribute('aria-labelledby')).toBe(title.id)
    el.remove()
  })

  it('cal-parts-created: nav buttons have correct type, aria-label, and text content', () => {
    const el   = makeCalendar({ value: '2026-07-15' })
    const prev = el.querySelector<HTMLButtonElement>('[data-part="prev"]')!
    const next = el.querySelector<HTMLButtonElement>('[data-part="next"]')!
    expect(prev.getAttribute('type')).toBe('button')
    expect(prev.getAttribute('aria-label')).toBe('Previous month')
    expect(next.getAttribute('type')).toBe('button')
    expect(next.getAttribute('aria-label')).toBe('Next month')
    el.remove()
  })

  it('cal-parts-idempotent: parts are NOT re-created on disconnect + reconnect (same references)', () => {
    const el = makeCalendar({ value: '2026-07-15' })
    const panelBefore = el.querySelector('[data-part="panel"]')
    const gridBefore  = el.querySelector('[data-part="grid"]')
    el.remove()
    document.body.append(el)
    // After reconnect, stubs need to be re-applied (form effects re-run)
    stubFormAssoc(el.probeInternals)
    expect(el.querySelector('[data-part="panel"]')).toBe(panelBefore)
    expect(el.querySelector('[data-part="grid"]')).toBe(gridBefore)
    expect(el.querySelectorAll('[data-part="panel"]').length).toBe(1)
    el.remove()
  })
})

// ── Month grid rendering ──────────────────────────────────────────────────────────────────────

describe('ui-calendar — month grid rendering (cal-month-render · cal-leap-feb)', () => {
  it('cal-month-render: renders title "July 2026" for value=2026-07-15', () => {
    const el = makeCalendar({ value: '2026-07-15' })
    const title = el.querySelector('[data-part="title"]')!
    expect(title.textContent).toBe('July 2026')
    el.remove()
  })

  it('cal-month-render: renders exactly 42 day cells (6 rows × 7 cols, flat CSS grid)', () => {
    const el    = makeCalendar({ value: '2026-07-15' })
    const cells = gridCells(el)
    expect(cells.length).toBe(42)
    el.remove()
  })

  it('cal-month-render: first cell is June 28 2026 (DOW offset — July 1 is a Wednesday)', () => {
    // July 1, 2026 is a Wednesday (DOW=3). The grid starts 3 days earlier: June 28 (Sun).
    const el = makeCalendar({ value: '2026-07-15' })
    const first = gridCells(el)[0]
    expect(first?.dataset['date']).toBe('2026-06-28')
    el.remove()
  })

  it('cal-month-render: first cell carries [data-outside] (adjacent-month overflow)', () => {
    const el    = makeCalendar({ value: '2026-07-15' })
    const cells = gridCells(el)
    // June 28 and June 29 are outside July
    expect(cells[0]?.hasAttribute('data-outside')).toBe(true)
    el.remove()
  })

  it('cal-month-render: July 1 is the 4th cell (index 3, no [data-outside])', () => {
    const el    = makeCalendar({ value: '2026-07-15' })
    const cells = gridCells(el)
    const july1 = cells[3]!
    expect(july1.dataset['date']).toBe('2026-07-01')
    expect(july1.hasAttribute('data-outside')).toBe(false)
    el.remove()
  })

  it('cal-month-render: weekday column headers are Su…Sa with aria-labels for each full name', () => {
    const el      = makeCalendar({ value: '2026-07-15' })
    const headers = [...el.querySelectorAll('[role="columnheader"]')]
    expect(headers.length).toBe(7)
    const abbrs = headers.map((h) => h.textContent?.trim())
    expect(abbrs).toEqual(['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'])
    const labels = headers.map((h) => h.getAttribute('aria-label'))
    expect(labels).toEqual(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'])
    el.remove()
  })

  it('cal-month-render: 7 [role=row] children inside the grid (1 header + 6 week rows)', () => {
    const el   = makeCalendar({ value: '2026-07-15' })
    const grid = el.querySelector('[data-part="grid"]')!
    const rows = [...grid.querySelectorAll(':scope > [role="row"]')]
    expect(rows.length).toBe(7)
    el.remove()
  })

  it('cal-month-render: the selected cell (July 15) has aria-selected="true"; others have "false"', () => {
    const el      = makeCalendar({ value: '2026-07-15' })
    const cells   = gridCells(el)
    const selected = cells.filter((c) => c.getAttribute('aria-selected') === 'true')
    expect(selected.length).toBe(1)
    expect(selected[0]!.dataset['date']).toBe('2026-07-15')
    el.remove()
  })

  it('cal-leap-feb: February 2024 (leap year) has 29 day cells in the month; "2024-02-29" exists', () => {
    const el    = makeCalendar({ value: '2024-02-01' })
    const cells = gridCells(el)
    // All cells in Feb 2024 (not [data-outside])
    const feb   = cells.filter((c) => !c.hasAttribute('data-outside') && c.dataset['date']?.startsWith('2024-02-'))
    expect(feb.length, 'Feb 2024 must have 29 days').toBe(29)
    const feb29 = cellFor(el, '2024-02-29')
    expect(feb29, '"2024-02-29" cell must exist').not.toBeNull()
    el.remove()
  })

  it('cal-month-render: February 2025 (non-leap) ends on the 28th — "2025-02-29" cell is absent', () => {
    const el = makeCalendar({ value: '2025-02-01' })
    const feb = gridCells(el).filter(
      (c) => !c.hasAttribute('data-outside') && c.dataset['date']?.startsWith('2025-02-'),
    )
    expect(feb.length).toBe(28)
    expect(cellFor(el, '2025-02-29')).toBeNull()
    el.remove()
  })
})

// ── Arrow key navigation (within month) ──────────────────────────────────────────────────────

describe('ui-calendar — arrow key navigation (cal-arrow-right · cal-arrow-left · cal-arrow-down · cal-arrow-up)', () => {
  // July 15, 2026 (Wed). ArrowRight → July 16; ArrowLeft → July 14; ArrowDown → July 22; ArrowUp → July 8.

  it('cal-arrow-right: ArrowRight from July 15 moves focus to July 16', () => {
    const el = makeCalendar({ value: '2026-07-15' })
    const c15 = cellFor(el, '2026-07-15')!
    c15.focus()
    key(c15, 'ArrowRight')
    expect(focusedIso(el)).toBe('2026-07-16')
    el.remove()
  })

  it('cal-arrow-left: ArrowLeft from July 15 moves focus to July 14', () => {
    const el = makeCalendar({ value: '2026-07-15' })
    const c15 = cellFor(el, '2026-07-15')!
    c15.focus()
    key(c15, 'ArrowLeft')
    expect(focusedIso(el)).toBe('2026-07-14')
    el.remove()
  })

  it('cal-arrow-down: ArrowDown from July 15 moves focus to July 22 (+7 days)', () => {
    const el = makeCalendar({ value: '2026-07-15' })
    const c15 = cellFor(el, '2026-07-15')!
    c15.focus()
    key(c15, 'ArrowDown')
    expect(focusedIso(el)).toBe('2026-07-22')
    el.remove()
  })

  it('cal-arrow-up: ArrowUp from July 15 moves focus to July 8 (−7 days)', () => {
    const el = makeCalendar({ value: '2026-07-15' })
    const c15 = cellFor(el, '2026-07-15')!
    c15.focus()
    key(c15, 'ArrowUp')
    expect(focusedIso(el)).toBe('2026-07-08')
    el.remove()
  })

  it('cal-arrow-right: ArrowRight from July 31 crosses into August (month boundary rebuild)', () => {
    const el   = makeCalendar({ value: '2026-07-31' })
    const c31  = cellFor(el, '2026-07-31')!
    c31.focus()
    key(c31, 'ArrowRight')
    // Grid should now display August 2026
    const title = el.querySelector('[data-part="title"]')!
    expect(title.textContent).toBe('August 2026')
    expect(focusedIso(el)).toBe('2026-08-01')
    el.remove()
  })

  it('cal-arrow-left: ArrowLeft from July 1 crosses into June (month boundary rebuild)', () => {
    const el  = makeCalendar({ value: '2026-07-01' })
    const c1  = cellFor(el, '2026-07-01')!
    c1.focus()
    key(c1, 'ArrowLeft')
    const title = el.querySelector('[data-part="title"]')!
    expect(title.textContent).toBe('June 2026')
    expect(focusedIso(el)).toBe('2026-06-30')
    el.remove()
  })

  it('cal-arrow-*: navigation keys call preventDefault (suppress scroll + overlay re-trigger)', () => {
    // Re-query the tabindex=0 cell before EACH key dispatch: after PageUp/Down the grid rebuilds,
    // making old cell references detached nodes. A detached node doesn't bubble to the grid listener,
    // so dispatching on a stale reference would give a false-negative (no preventDefault fired).
    const el = makeCalendar({ value: '2026-07-15' })
    for (const k of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown']) {
      const active = el.querySelector<HTMLElement>('[role="gridcell"][tabindex="0"]')!
      active.focus()
      const ev = key(active, k)
      expect(ev.defaultPrevented, `${k} must call preventDefault`).toBe(true)
    }
    el.remove()
  })
})

// ── Home / End ────────────────────────────────────────────────────────────────────────────────

describe('ui-calendar — Home and End keys (cal-home · cal-end)', () => {
  // July 15 2026 is a Wednesday (DOW=3). Home → Sunday July 12; End → Saturday July 18.

  it('cal-home: Home from July 15 (Wed) moves focus to July 12 (Sunday of that week)', () => {
    const el  = makeCalendar({ value: '2026-07-15' })
    const c15 = cellFor(el, '2026-07-15')!
    c15.focus()
    key(c15, 'Home')
    expect(focusedIso(el)).toBe('2026-07-12')
    el.remove()
  })

  it('cal-end: End from July 15 (Wed) moves focus to July 18 (Saturday of that week)', () => {
    const el  = makeCalendar({ value: '2026-07-15' })
    const c15 = cellFor(el, '2026-07-15')!
    c15.focus()
    key(c15, 'End')
    expect(focusedIso(el)).toBe('2026-07-18')
    el.remove()
  })
})

// ── PageUp / PageDown ─────────────────────────────────────────────────────────────────────────

describe('ui-calendar — PageUp / PageDown navigation (cal-pageup · cal-pagedown)', () => {
  it('cal-pageup: PageUp from July 15 displays June 2026 (−1 month, grid regenerates)', () => {
    const el  = makeCalendar({ value: '2026-07-15' })
    const c15 = cellFor(el, '2026-07-15')!
    c15.focus()
    key(c15, 'PageUp')
    const title = el.querySelector('[data-part="title"]')!
    expect(title.textContent).toBe('June 2026')
    expect(focusedIso(el)).toBe('2026-06-15')
    el.remove()
  })

  it('cal-pagedown: PageDown from July 15 displays August 2026 (+1 month, grid regenerates)', () => {
    const el  = makeCalendar({ value: '2026-07-15' })
    const c15 = cellFor(el, '2026-07-15')!
    c15.focus()
    key(c15, 'PageDown')
    const title = el.querySelector('[data-part="title"]')!
    expect(title.textContent).toBe('August 2026')
    expect(focusedIso(el)).toBe('2026-08-15')
    el.remove()
  })

  it('cal-pageup: PageUp clamps the day to the new month (July 31 → June 30)', () => {
    const el  = makeCalendar({ value: '2026-07-31' })
    const c31 = cellFor(el, '2026-07-31')!
    c31.focus()
    key(c31, 'PageUp')
    // June has 30 days — day is clamped
    expect(focusedIso(el)).toBe('2026-06-30')
    el.remove()
  })

  it('cal-pageup+shift: Shift+PageUp from July 15 displays July 2025 (−1 year, grid regenerates)', () => {
    const el  = makeCalendar({ value: '2026-07-15' })
    const c15 = cellFor(el, '2026-07-15')!
    c15.focus()
    key(c15, 'PageUp', { shiftKey: true })
    const title = el.querySelector('[data-part="title"]')!
    expect(title.textContent).toBe('July 2025')
    expect(focusedIso(el)).toBe('2025-07-15')
    el.remove()
  })

  it('cal-pagedown+shift: Shift+PageDown from July 15 displays July 2027 (+1 year)', () => {
    const el  = makeCalendar({ value: '2026-07-15' })
    const c15 = cellFor(el, '2026-07-15')!
    c15.focus()
    key(c15, 'PageDown', { shiftKey: true })
    const title = el.querySelector('[data-part="title"]')!
    expect(title.textContent).toBe('July 2027')
    expect(focusedIso(el)).toBe('2027-07-15')
    el.remove()
  })

  it('cal-pageup/down: the grid re-renders 42 cells for the new month', () => {
    const el  = makeCalendar({ value: '2026-07-15' })
    const c15 = cellFor(el, '2026-07-15')!
    c15.focus()
    key(c15, 'PageDown')
    expect(gridCells(el).length).toBe(42)
    el.remove()
  })
})

// ── Commit via Enter / Space / click ─────────────────────────────────────────────────────────

describe('ui-calendar — commit (cal-commit-enter · cal-commit-space · cal-commit-click · cal-commit-no-change)', () => {
  it('cal-commit-enter: Enter on a focused cell sets value + emits change + select', () => {
    const el = makeCalendar({ value: '2026-07-15' })
    // Focus a DIFFERENT cell so commit produces a value change
    const c20 = cellFor(el, '2026-07-20')!
    c20.focus()

    let changes = 0
    let selects = 0
    let selectDetail: string | null = null
    el.addEventListener('change', () => changes++)
    el.addEventListener('select', (e) => { selects++; selectDetail = (e as CustomEvent<string>).detail })

    const ev = key(c20, 'Enter')

    expect(ev.defaultPrevented, 'Enter must call preventDefault (overlay re-trigger guard)').toBe(true)
    expect(el.value).toBe('2026-07-20')
    expect(changes).toBe(1)
    expect(selects).toBe(1)
    expect(selectDetail).toBe('2026-07-20')
    el.remove()
  })

  it('cal-commit-space: Space on a focused cell commits the date', () => {
    const el  = makeCalendar({ value: '2026-07-15' })
    const c22 = cellFor(el, '2026-07-22')!
    c22.focus()

    let changes = 0
    el.addEventListener('change', () => changes++)

    key(c22, ' ')

    expect(el.value).toBe('2026-07-22')
    expect(changes).toBe(1)
    el.remove()
  })

  it('cal-commit-click: clicking a cell sets value + emits change + select', () => {
    const el = makeCalendar({ value: '2026-07-15' })
    const c10 = cellFor(el, '2026-07-10')!

    let changes = 0
    let selectDetail: string | null = null
    el.addEventListener('change', () => changes++)
    el.addEventListener('select', (e) => { selectDetail = (e as CustomEvent<string>).detail })

    c10.click()

    expect(el.value).toBe('2026-07-10')
    expect(changes).toBe(1)
    expect(selectDetail).toBe('2026-07-10')
    el.remove()
  })

  it('cal-commit-no-change: committing the already-selected date does NOT emit change/select (unchanged)', () => {
    // #commitDate guards with `iso !== this.value` before emitting (unchanged commit is a no-op)
    const el = makeCalendar({ value: '2026-07-15' })
    const c15 = cellFor(el, '2026-07-15')!
    c15.focus()

    let changes = 0
    el.addEventListener('change', () => changes++)

    key(c15, 'Enter') // value is already '2026-07-15' — no change event
    expect(changes).toBe(0)
    el.remove()
  })

  it('cal-commit-click: clicking an outside-month cell navigates + commits (adjacent-month standard UX)', () => {
    const el   = makeCalendar({ value: '2026-07-15' })
    // First cell is June 28 (outside July)
    const june28 = cellFor(el, '2026-06-28')!
    expect(june28.hasAttribute('data-outside')).toBe(true)

    let selectDetail: string | null = null
    el.addEventListener('select', (e) => { selectDetail = (e as CustomEvent<string>).detail })

    june28.click()

    // Grid should now display June 2026
    const title = el.querySelector('[data-part="title"]')!
    expect(title.textContent).toBe('June 2026')
    expect(el.value).toBe('2026-06-28')
    expect(selectDetail).toBe('2026-06-28')
    el.remove()
  })
})

// ── Disabled cells — commit is a no-op ───────────────────────────────────────────────────────

describe('ui-calendar — disabled cells (cal-disabled-enter-noop · cal-min-max-cells)', () => {
  it('cal-disabled-enter-noop: Enter on an aria-disabled cell is a no-op (value unchanged)', () => {
    // min='2026-07-10' → days before July 10 are disabled
    const el = makeCalendar({ value: '2026-07-15', min: '2026-07-10' })
    const c5 = cellFor(el, '2026-07-05')!
    expect(c5.getAttribute('aria-disabled')).toBe('true')
    c5.focus()

    let changes = 0
    el.addEventListener('change', () => changes++)
    key(c5, 'Enter')

    expect(el.value).toBe('2026-07-15') // unchanged
    expect(changes).toBe(0)
    el.remove()
  })

  it('cal-disabled-enter-noop: Space on an aria-disabled cell is a no-op', () => {
    const el = makeCalendar({ value: '2026-07-15', max: '2026-07-20' })
    const c25 = cellFor(el, '2026-07-25')!
    expect(c25.getAttribute('aria-disabled')).toBe('true')
    c25.focus()

    let changes = 0
    el.addEventListener('change', () => changes++)
    key(c25, ' ')

    expect(el.value).toBe('2026-07-15')
    expect(changes).toBe(0)
    el.remove()
  })

  it('cal-min-max-cells: cells before min have aria-disabled="true"; cells on/after do not', () => {
    const el = makeCalendar({ value: '2026-07-15', min: '2026-07-10' })
    // July 5 (before min) → disabled
    expect(cellFor(el, '2026-07-05')?.getAttribute('aria-disabled')).toBe('true')
    // July 10 (== min) → NOT disabled
    expect(cellFor(el, '2026-07-10')?.getAttribute('aria-disabled')).toBeNull()
    // July 15 → NOT disabled
    expect(cellFor(el, '2026-07-15')?.getAttribute('aria-disabled')).toBeNull()
    el.remove()
  })

  it('cal-min-max-cells: cells after max have aria-disabled="true"; cells on/before do not', () => {
    const el = makeCalendar({ value: '2026-07-15', max: '2026-07-20' })
    // July 20 (== max) → NOT disabled
    expect(cellFor(el, '2026-07-20')?.getAttribute('aria-disabled')).toBeNull()
    // July 25 (after max) → disabled
    expect(cellFor(el, '2026-07-25')?.getAttribute('aria-disabled')).toBe('true')
    el.remove()
  })

  it('cal-min-max-cells: click on an aria-disabled cell is a no-op (no commit)', () => {
    const el  = makeCalendar({ value: '2026-07-15', min: '2026-07-10' })
    const c5  = cellFor(el, '2026-07-05')!

    let changes = 0
    el.addEventListener('change', () => changes++)
    c5.click()

    expect(el.value).toBe('2026-07-15')
    expect(changes).toBe(0)
    el.remove()
  })

  it('cal-min-max-cells: [disabled] makes ALL cells aria-disabled (commit is always no-op)', () => {
    const el = makeCalendar({ value: '2026-07-15', disabled: true })
    const cells = gridCells(el)
    // Every in-month cell should be aria-disabled
    const inMonth = cells.filter((c) => !c.hasAttribute('data-outside'))
    const allDisabled = inMonth.every((c) => c.getAttribute('aria-disabled') === 'true')
    expect(allDisabled, 'all in-month cells must be aria-disabled when the calendar is disabled').toBe(true)
    el.remove()
  })
})

// ── Form seams ────────────────────────────────────────────────────────────────────────────────

describe('ui-calendar — form seams (cal-form-value · cal-form-validity · cal-form-reset · cal-form-state-restore)', () => {
  it('cal-form-value: formValue() returns null when nothing is selected (value="")', () => {
    const el = makeCalendar({ value: '' })
    expect(el.formValueProbe()).toBeNull()
    el.remove()
  })

  it('cal-form-value: formValue() returns the ISO string when a date is selected', () => {
    const el = makeCalendar({ value: '2026-07-15' })
    expect(el.formValueProbe()).toBe('2026-07-15')
    el.remove()
  })

  it('cal-form-validity: formValidity() → valid when not required + no value', () => {
    const el = makeCalendar({ value: '', required: false })
    expect(el.formValidityProbe().valid).toBe(true)
    el.remove()
  })

  it('cal-form-validity: formValidity() → valueMissing when required + no value', () => {
    const el = makeCalendar({ value: '', required: true })
    const result = el.formValidityProbe()
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.flags.valueMissing).toBe(true)
    }
    el.remove()
  })

  it('cal-form-validity: formValidity() → valid when required + a date is selected', () => {
    const el = makeCalendar({ value: '2026-07-15', required: true })
    expect(el.formValidityProbe().valid).toBe(true)
    el.remove()
  })

  it('cal-form-validity: formValidity() → rangeUnderflow when value < min', () => {
    const el = makeCalendar({ value: '2026-07-05', min: '2026-07-10' })
    const result = el.formValidityProbe()
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.flags.rangeUnderflow).toBe(true)
    }
    el.remove()
  })

  it('cal-form-validity: formValidity() → rangeOverflow when value > max', () => {
    const el = makeCalendar({ value: '2026-07-25', max: '2026-07-20' })
    const result = el.formValidityProbe()
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.flags.rangeOverflow).toBe(true)
    }
    el.remove()
  })

  it('cal-form-validity: formValidity() → valid when value is exactly at min or max bound', () => {
    const el1 = makeCalendar({ value: '2026-07-10', min: '2026-07-10' })
    expect(el1.formValidityProbe().valid).toBe(true)
    el1.remove()

    const el2 = makeCalendar({ value: '2026-07-20', max: '2026-07-20' })
    expect(el2.formValidityProbe().valid).toBe(true)
    el2.remove()
  })

  it('cal-form-reset: formReset() restores value to the HTML-authored initial value', () => {
    // Simulate <ui-calendar value="2026-07-10"> by setting value BEFORE connect (via makeCalendar init).
    // Since reflect:true means el.value = x synchronously sets the content attribute, the value prop
    // must be set before connect so #initialValue is captured correctly at connect time.
    const el = makeCalendar({ value: '2026-07-10' })
    el.value = '2026-07-25'
    expect(el.value).toBe('2026-07-25')

    el.formResetProbe()
    expect(el.value).toBe('2026-07-10')
    el.remove()
  })

  it('cal-form-reset: formReset() restores to "" when no initial value attribute is present', () => {
    const el = makeCalendar({})
    el.value = '2026-07-15'
    el.formResetProbe()
    expect(el.value).toBe('')
    el.remove()
  })

  it('cal-form-state-restore: formStateRestore() sets value AND navigates the grid to the restored month', () => {
    // Calendar starts with no value (shows today's month = July 2026). Restore to August.
    const el = makeCalendar({ value: '' })
    el.formStateRestoreProbe('2026-08-10')
    expect(el.value).toBe('2026-08-10')
    // Grid must now display August 2026 (not July), so the restored selection is visible.
    const title = el.querySelector('[data-part="title"]')
    expect(title?.textContent).toBe('August 2026')
    // The restored cell must carry aria-selected="true".
    const restoredCell = cellFor(el, '2026-08-10')
    expect(restoredCell?.getAttribute('aria-selected')).toBe('true')
    el.remove()
  })

  it('cal-form-state-restore: formStateRestore() ignores non-ISO strings (no crash, value unchanged)', () => {
    const el = makeCalendar({ value: '2026-07-10' })
    el.formStateRestoreProbe('not-a-date')
    expect(el.value).toBe('2026-07-10')
    el.remove()
  })
})

// ── C10 zero-residue ──────────────────────────────────────────────────────────────────────────

describe('ui-calendar — C10 zero-residue (cal-c10-residue)', () => {
  it('cal-c10-residue: after disconnect, clicking a cell does NOT fire change (listener removed)', () => {
    const el = makeCalendar({ value: '2026-07-15' })
    const c20 = cellFor(el, '2026-07-20')!

    let changes = 0
    el.addEventListener('change', () => changes++)

    el.remove() // disconnect → scope.dispose() → AC aborts → click listener dead

    c20.click() // listener is dead — must not propagate
    expect(changes).toBe(0)
  })

  it('cal-c10-residue: after disconnect, keydown on a cell does NOT change value (listener removed)', () => {
    const el = makeCalendar({ value: '2026-07-15' })
    const c20 = cellFor(el, '2026-07-20')!
    c20.focus()

    el.remove()

    key(c20, 'Enter')
    expect(el.value).toBe('2026-07-15') // still the original — handler is dead
  })

  it('cal-c10-residue: prev/next button click does NOT rebuild the grid after disconnect', () => {
    const el   = makeCalendar({ value: '2026-07-15' })
    const prev = el.querySelector<HTMLElement>('[data-part="prev"]')!
    const titleBefore = el.querySelector('[data-part="title"]')!.textContent

    el.remove()

    prev.click() // listener is dead
    const titleAfter = el.querySelector('[data-part="title"]')!.textContent
    expect(titleAfter).toBe(titleBefore) // unchanged — nav listener is dead
  })

  it('cal-c10-residue: reconnect does NOT stack listeners (change fires exactly ONCE per commit)', () => {
    const el = makeCalendar({ value: '2026-07-15' })

    let changes = 0
    el.addEventListener('change', () => changes++)

    // Disconnect + reconnect (each connect installs fresh listeners via a new AC)
    el.remove()
    document.body.append(el)
    stubFormAssoc(el.probeInternals)

    const c20 = cellFor(el, '2026-07-20')!
    c20.click()
    expect(changes).toBe(1) // exactly one change — not doubled by stacked listeners
    el.remove()
  })
})

// ── Descriptor trip-wire ──────────────────────────────────────────────────────────────────────

const CALENDAR_DIR = `${process.cwd()}/packages/agent-ui/components/src/controls/calendar`
const md = readFileSync(`${CALENDAR_DIR}/calendar.md`, 'utf8') as string
const { fence, body } = splitFrontmatter(md)
const parsed = parseDescriptor(fence)

const ATTR_NAMES = ['name', 'disabled', 'required', 'value', 'min', 'max', 'size']

describe('calendar.md descriptor — frontmatter parses + schema-valid (cal-descriptor-schema)', () => {
  it('cal-descriptor-schema: has a leading frontmatter fence and a prose body', () => {
    expect(fence.length).toBeGreaterThan(0)
    expect(body.trim().length).toBeGreaterThan(0)
    expect(body).toContain('# ui-calendar')
  })

  it('cal-descriptor-schema: carries the ADR-0004 / plan §10 descriptor field set', () => {
    const required = [
      'tag', 'tier', 'extends', 'attributes', 'properties', 'events', 'slots',
      'parts', 'customStates', 'face', 'aria', 'keyboard', 'geometry', 'forcedColors',
    ]
    for (const field of required) {
      expect(parsed.topLevelKeys.has(field), `missing field: ${field}`).toBe(true)
    }
  })

  it('cal-descriptor-schema: tag=ui-calendar, tier=pattern, extends=UIFormElement, formAssociated=true', () => {
    expect(/^tag:\s*ui-calendar\s*$/m.test(fence)).toBe(true)
    expect(/^tier:\s*pattern\b/m.test(fence)).toBe(true)
    expect(/^extends:\s*UIFormElement\b/m.test(fence)).toBe(true)
    expect(/formAssociated:\s*true/.test(fence)).toBe(true)
  })

  it('cal-descriptor-schema: records the bindable `value` (reflected string) + change and select events', () => {
    const value = parsed.attributes.find((a) => a.name === 'value')
    expect(value?.type).toBe('string')
    expect(value?.reflect).toBe(true)
    const events = (parsed.sequences.get('events') ?? []).map((i) => i.get('name'))
    expect(events).toContain('change')
    expect(events).toContain('select')
  })

  it('cal-descriptor-schema: validates with zero structural failures beyond the s12-pending BAD_EXTENDS for UIFormElement', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES) // anti-vacuous anchor
    const failures = validateComponentDescriptor(parsed)
    const pendingBaseClass = failures.filter((f) => f.code === 'BAD_EXTENDS' && f.path === 'extends')
    const otherFailures   = failures.filter((f) => !(f.code === 'BAD_EXTENDS' && f.path === 'extends'))
    expect(otherFailures).toEqual([])
    expect(pendingBaseClass.length).toBeLessThanOrEqual(1)
  })
})

describe('calendar.md descriptor — contract↔props trip-wire (cal-descriptor-bijection · cal-descriptor-negative)', () => {
  it('cal-descriptor-bijection: attributes[] is a faithful bijection with UICalendarElement.props (0 drift)', () => {
    expect(parsed.attributes.map((a) => a.name)).toEqual(ATTR_NAMES) // anti-vacuous anchor
    expect(compareDescriptorToProps(parsed.attributes, UICalendarElement.props)).toEqual([])
  })

  it('cal-descriptor-negative: a drifted reflect FAILS the trip-wire', () => {
    const flipReflect: ParsedAttribute[] = parsed.attributes.map((a) =>
      a.name === 'value' ? { ...a, reflect: false } : { ...a },
    )
    expect(compareDescriptorToProps(flipReflect, UICalendarElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_REFLECT', path: 'attributes.value.reflect' }),
    )
  })

  it('cal-descriptor-negative: a removed attribute FAILS the trip-wire (bijection both ways)', () => {
    const dropValue: ParsedAttribute[] = parsed.attributes.filter((a) => a.name !== 'value')
    expect(compareDescriptorToProps(dropValue, UICalendarElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_MISSING', path: 'attributes.value' }),
    )
  })

  it('cal-descriptor-negative: an added attribute FAILS the trip-wire (extra in descriptor)', () => {
    const addBogus: ParsedAttribute[] = [
      ...parsed.attributes,
      { name: 'bogus', type: 'string', default: '', reflect: false },
    ]
    expect(compareDescriptorToProps(addBogus, UICalendarElement.props)).toContainEqual(
      expect.objectContaining({ code: 'DRIFT_EXTRA', path: 'attributes.bogus' }),
    )
  })
})
