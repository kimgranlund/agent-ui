// workbench.browser.test.ts — the cross-engine (Chromium + WebKit, vitest.browser.config.ts) proofs for
// the SaaS Data Workbench (GH #461, M-A MA-3). Side-effect imports the REAL page module (the
// agent-admin-app.browser.test.ts precedent — its own file, its own document, so the full-viewport mount
// collides with nothing) and drives it exactly as a user would: real clicks, real keyboard, real focus.
//
// One shared page instance for the whole file (the module-level side-effect import runs once) — every
// stateful test below RESETS what it changed at its own end (a direct property write back to the default,
// or a real click undoing a real click), so file order never becomes a hidden dependency.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { userEvent } from 'vitest/browser'
import './workbench.ts'
import type { UITableElement, UIModalElement, UIFormPopoverElement, UITextFieldElement, UICheckboxElement, UIButtonElement, UISelectElement } from '@agent-ui/components/components'
import { FIXTURE_RECORDS, computeMatchingCount } from './workbench-data.ts'

const raf = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

function table(): UITableElement {
  return document.querySelector('ui-table') as UITableElement
}
function rowByRecordId(id: string): HTMLTableRowElement {
  const input = table().querySelector(`[data-part="select"][data-row-id="${id}"]`) as HTMLElement
  return input.closest('tr') as HTMLTableRowElement
}
function nameCellOf(row: HTMLTableRowElement): string {
  return (row.querySelectorAll('td')[1]?.textContent ?? '').trim() // index 0 = select-cell (selectable='multi')
}
function statusPopover(): UIFormPopoverElement {
  return document.querySelector('.wb-toolbar-row ui-form-popover') as UIFormPopoverElement
}
function statusCheckbox(status: 'Active' | 'Trial' | 'Churned'): UICheckboxElement {
  return document.querySelector(`ui-checkbox[value="${status}"]`) as UICheckboxElement
}
/** The status facet's `ui-checkbox` group lives inside `ui-form-popover`'s panel — a Popover-API top-layer
 *  surface, `display:none` (and un-clickable) until the trigger opens it (form-popover.md). Real
 *  interaction always opens it first, exactly as a user would. */
async function clickStatusFacet(status: 'Active' | 'Trial' | 'Churned'): Promise<void> {
  const popover = statusPopover()
  if (!popover.open) {
    await userEvent.click(popover.querySelector('[data-part="trigger"]') as HTMLElement)
    await raf()
  }
  await userEvent.click(statusCheckbox(status))
}
function searchField(): UITextFieldElement {
  return document.querySelector('.wb-toolbar-row ui-text-field') as UITextFieldElement
}
function resultsCount(): HTMLElement {
  return document.querySelector('.wb-results-count') as HTMLElement
}
function columnsPopover(): UIFormPopoverElement {
  return document.querySelector('.wb-columns-popover') as UIFormPopoverElement
}
function columnsList(): HTMLElement {
  return document.querySelector('.wb-columns-list') as HTMLElement
}
const COLUMN_KEY_BY_LABEL: Record<string, string> = { Account: 'name', Plan: 'plan', Status: 'status', Seats: 'seats', MRR: 'mrr', Renews: 'renewsOn' }
function columnsRow(label: string): HTMLElement {
  return columnsList().querySelector(`[data-column-key="${COLUMN_KEY_BY_LABEL[label]}"]`) as HTMLElement
}
async function openColumnsMenu(): Promise<void> {
  const popover = columnsPopover()
  if (!popover.open) {
    await userEvent.click(popover.querySelector('[data-part="trigger"]') as HTMLElement)
    await raf()
  }
}
function headerLabels(): string[] {
  return [...table().querySelectorAll('thead th')].map((th) => (th.textContent ?? '').trim()).filter((t) => t !== '')
}
function recordPicker(): UISelectElement {
  return document.querySelector('.wb-record-actions ui-select') as UISelectElement
}
function editButton(): UIButtonElement {
  return document.querySelector('.wb-record-actions ui-button') as UIButtonElement
}
function modal(): UIModalElement {
  return document.querySelector('ui-modal') as UIModalElement
}
function modalField(name: string): UITextFieldElement | UISelectElement {
  return modal().querySelector(`[name="${name}"]`) as UITextFieldElement | UISelectElement
}
async function clearAndType(field: UITextFieldElement, next: string): Promise<void> {
  const editor = field.querySelector('[data-part="editor"]') as HTMLElement
  editor.focus() // the command-palette.browser.test.ts precedent — a direct .focus() on the contenteditable
  // editor part, not userEvent.click (an empty/placeholder-only contenteditable can report a zero-area hit
  // box, making a click land nowhere) — userEvent.clear/.type both support [contenteditable] directly.
  await userEvent.clear(editor)
  if (next.length > 0) await userEvent.type(editor, next)
}

// ════════════════ SPEC-R10 — zero network requests (spy installed for the WHOLE file; asserted last, over
// the complete interaction sequence every other describe below drives) ════════════════════════════════
let fetchCalls = 0
let xhrOpens = 0
let originalFetch: typeof fetch
let originalXhrOpen: typeof XMLHttpRequest.prototype.open
beforeAll(() => {
  originalFetch = window.fetch
  window.fetch = ((...args: Parameters<typeof fetch>) => {
    fetchCalls += 1
    return originalFetch(...args)
  }) as typeof fetch
  originalXhrOpen = XMLHttpRequest.prototype.open
  XMLHttpRequest.prototype.open = function (this: XMLHttpRequest, ...args: Parameters<typeof XMLHttpRequest.prototype.open>) {
    xhrOpens += 1
    return originalXhrOpen.apply(this, args)
  } as typeof XMLHttpRequest.prototype.open
})
afterAll(() => {
  window.fetch = originalFetch
  XMLHttpRequest.prototype.open = originalXhrOpen
})

describe('workbench — SPEC-R7: the toolbar drives table STATE, never table DATA', () => {
  it('the bound array identity never changes across a search + facet-filter interaction; the visible results count tracks the matching set', async () => {
    await raf()
    const t = table()
    const rowsRef = t.rows

    const field = searchField()
    await clearAndType(field, 'Enterprise')
    await raf()
    expect(t.rows, 'the toolbar reassigned table.rows on a SEARCH interaction').toBe(rowsRef)
    const searchOnlyExpected = computeMatchingCount(FIXTURE_RECORDS, [], 'Enterprise')
    expect(resultsCount().textContent).toBe(`Showing ${searchOnlyExpected} of ${FIXTURE_RECORDS.length} accounts`)

    await clearAndType(field, '')
    await raf()
    expect(t.rows, 'the toolbar reassigned table.rows clearing SEARCH').toBe(rowsRef)

    await clickStatusFacet('Trial')
    await raf()
    expect(t.rows, 'the toolbar reassigned table.rows on a FACET-FILTER interaction').toBe(rowsRef)
    const filterOnlyExpected = computeMatchingCount(FIXTURE_RECORDS, [{ key: 'status', values: ['Trial'] }], '')
    expect(resultsCount().textContent).toBe(`Showing ${filterOnlyExpected} of ${FIXTURE_RECORDS.length} accounts`)

    // reset
    await clickStatusFacet('Trial')
    await raf()
    expect(t.rows).toBe(rowsRef)
    expect(resultsCount().textContent).toBe(`Showing ${FIXTURE_RECORDS.length} of ${FIXTURE_RECORDS.length} accounts`)
  })
})

describe('workbench — SPEC-R1: the widened table over the workbench fixture (all four capabilities enabled)', () => {
  it('a sortable header cycles ascending→descending, reorders rows, and aria-sort lands on exactly one <th> — the native table role never changes', async () => {
    const t = table()
    const nativeTable = t.querySelector('table') as HTMLTableElement
    expect(nativeTable.getAttribute('role'), 'role=grid is REJECTED (ADR-0163 cl.3) — must stay absent').toBeNull()

    const nameSortButton = t.querySelectorAll('[data-part="sort-button"]')[0] as HTMLElement // columns[0] = name
    await userEvent.click(nameSortButton)
    await raf()

    const sortedThs = [...t.querySelectorAll('th[aria-sort]')]
    expect(sortedThs, 'exactly one <th> carries aria-sort').toHaveLength(1)
    expect(sortedThs[0]!.getAttribute('aria-sort')).toBe('ascending')
    expect(nativeTable.getAttribute('role'), 'role stays absent with sort enabled').toBeNull()

    const namesAsc = [...t.querySelectorAll('tbody tr')].map((tr) => (tr.querySelectorAll('td')[1]?.textContent ?? '').trim())
    const expectedAsc = [...FIXTURE_RECORDS].sort((a, b) => a.name.localeCompare(b.name)).slice(0, 10).map((r) => r.name)
    expect(namesAsc).toEqual(expectedAsc)

    await userEvent.click(nameSortButton)
    await raf()
    const sortedThs2 = [...t.querySelectorAll('th[aria-sort]')]
    expect(sortedThs2).toHaveLength(1)
    expect(sortedThs2[0]!.getAttribute('aria-sort')).toBe('descending')
    expect(nativeTable.getAttribute('role'), 'role stays absent with sort enabled').toBeNull()

    // reset — no-sort is a direct property write (the control's own click cycles asc/desc forever, never
    // back to null; SPEC's assertion is about the CLICK cycle, this is test-fixture cleanup, not a probe).
    t.sort = null
    await raf()
  })

  it('select-all under the Trial facet checks EXACTLY the matching set and reads indeterminate when partial; selection SURVIVES clearing the filter (SPEC-R6)', async () => {
    const t = table()
    const trialRecords = FIXTURE_RECORDS.filter((r) => r.status === 'Trial')
    expect(trialRecords.length, 'fixture sanity — the Trial facet must be a genuine sub-page').toBeGreaterThan(0)

    await clickStatusFacet('Trial')
    await raf()

    const rowCheckboxes = [...t.querySelectorAll('[data-part="select"]')] as HTMLInputElement[]
    expect(rowCheckboxes, 'the rendered tbody is the Trial matching set only').toHaveLength(trialRecords.length)

    await userEvent.click(rowCheckboxes[0]!)
    await raf()
    const selectAll = t.querySelector('[data-part="select-all"]') as HTMLInputElement
    expect(selectAll.indeterminate, 'a partial selection under the filter must read indeterminate').toBe(true)
    expect(selectAll.checked).toBe(false)

    await userEvent.click(selectAll)
    await raf()
    expect(selectAll.indeterminate).toBe(false)
    expect(selectAll.checked).toBe(true)
    const selectedIds = new Set(t.selected as unknown as string[])
    expect(selectedIds).toEqual(new Set(trialRecords.map((r) => r.id)))

    // clear the filter — selection is held against the WHOLE rendered set (ADR-0163 cl.7)
    await clickStatusFacet('Trial')
    await raf()
    const selectedAfterClear = new Set(t.selected as unknown as string[])
    expect(selectedAfterClear, 'selection must SURVIVE the filter change').toEqual(new Set(trialRecords.map((r) => r.id)))

    // reset
    t.selected = []
    await raf()
  })

  it('page-size=10 over 25 rows renders 10 <tr> plus a footer navigator reading 3 pages', async () => {
    const t = table()
    expect(FIXTURE_RECORDS.length).toBe(25)
    const rows = t.querySelectorAll('tbody tr')
    expect(rows).toHaveLength(10)
    const pagination = t.querySelector('[data-part="footer"] ui-pagination') as HTMLElement & { pages: number; page: number }
    expect(pagination, 'the composed ui-pagination footer must exist').not.toBeNull()
    expect(pagination.pages).toBe(3)
    expect(pagination.page).toBe(1)
    const nativeTable = t.querySelector('table') as HTMLTableElement
    expect(nativeTable.getAttribute('role'), 'role stays absent with pagination enabled').toBeNull()
  })
})

describe('workbench — GH #963: the columns menu (show/hide + reorder), ZERO ui-table API change', () => {
  const ORIGINAL_ORDER = ['Account', 'Plan', 'Status', 'Seats', 'MRR', 'Renews']

  it('starts with all six columns in fixture order', () => {
    expect(headerLabels()).toEqual(ORIGINAL_ORDER)
  })

  it('hiding a column removes its header; showing it again restores the original order', async () => {
    await openColumnsMenu()
    const planCheckbox = columnsRow('Plan').querySelector('ui-checkbox') as UICheckboxElement
    await userEvent.click(planCheckbox)
    await raf()
    expect(headerLabels(), 'Plan must drop out of the rendered header').toEqual(['Account', 'Status', 'Seats', 'MRR', 'Renews'])
    expect(columnsPopover().label).toBe('Columns · 1 hidden')

    await userEvent.click(planCheckbox)
    await raf()
    expect(headerLabels(), 'Plan must return to its original position').toEqual(ORIGINAL_ORDER)
    expect(columnsPopover().label).toBe('Columns')
  })

  it('moving a column up/down reorders the rendered header, restores focus to the SAME row after the panel rebuilds, and moving back restores the original order', async () => {
    await openColumnsMenu()
    const upButton = columnsRow('Status').querySelector('ui-button[aria-label="Move Status up"]') as UIButtonElement
    await userEvent.click(upButton)
    await raf()
    expect(headerLabels()).toEqual(['Account', 'Status', 'Plan', 'Seats', 'MRR', 'Renews'])
    // renderColumnsList() replaces every row node wholesale on a reorder — focus must land back on
    // Status's OWN (fresh) up-button, not fall out to <body> (WCAG 2.4.3).
    expect(document.activeElement?.getAttribute('aria-label'), 'focus must stay on the moved row\'s own control').toBe('Move Status up')

    // the panel rebuilt again — re-query fresh (columnsRow() always re-queries by data-column-key)
    const downButton = columnsRow('Status').querySelector('ui-button[aria-label="Move Status down"]') as UIButtonElement
    await userEvent.click(downButton)
    await raf()
    expect(headerLabels(), 'must restore the original order for the tests after this one').toEqual(ORIGINAL_ORDER)
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Move Status down')
  })

  it('the last visible column cannot be hidden — the checkbox reverts rather than leaving zero columns', async () => {
    await openColumnsMenu()
    for (const label of ORIGINAL_ORDER.slice(1)) {
      const checkbox = columnsRow(label).querySelector('ui-checkbox') as UICheckboxElement
      await userEvent.click(checkbox)
      await raf()
    }
    expect(headerLabels()).toEqual(['Account'])

    const accountCheckbox = columnsRow('Account').querySelector('ui-checkbox') as UICheckboxElement
    await userEvent.click(accountCheckbox) // attempt to hide the last remaining column
    await raf()
    expect(headerLabels(), 'the guard must keep at least one column visible').toEqual(['Account'])
    expect(accountCheckbox.checked, 'the checkbox reverts to checked rather than actually hiding').toBe(true)

    // reset — restore all six for the tests after this one
    for (const label of ORIGINAL_ORDER.slice(1)) {
      const checkbox = columnsRow(label).querySelector('ui-checkbox') as UICheckboxElement
      await userEvent.click(checkbox)
      await raf()
    }
    expect(headerLabels()).toEqual(ORIGINAL_ORDER)
  })

  it('hiding a column narrows what `search` scans too — the visible results count tracks the CURRENT columns, never the full fixture set', async () => {
    // Regression: a hidden column must also stop being searchable ("search what you see", table.md) —
    // computeMatchingCount must be driven by table.columns (the recipe's own effective set), not the
    // page's full WORKBENCH_COLUMNS constant, or the count silently drifts from what the table renders.
    await openColumnsMenu()
    const planCheckbox = columnsRow('Plan').querySelector('ui-checkbox') as UICheckboxElement
    await userEvent.click(planCheckbox) // hide Plan — Plan values ('Growth' etc.) stop being searchable
    await raf()

    const field = searchField()
    await clearAndType(field, 'Growth') // matches ONLY the (now-hidden) plan column, no other column
    await raf()
    const renderedRows = table().querySelectorAll('tbody tr').length
    expect(renderedRows, 'the table itself must render zero matching rows once Plan is hidden').toBe(0)
    expect(resultsCount().textContent, 'the count must agree with what the table actually renders').toBe(`Showing 0 of ${FIXTURE_RECORDS.length} accounts`)

    // reset — restore Plan and clear the search for the tests after this one
    await clearAndType(field, '')
    await userEvent.click(planCheckbox)
    await raf()
    expect(headerLabels()).toEqual(ORIGINAL_ORDER)
  })

  it('a table.sort naming a column that then hides is cleared, never left pointing at a column no header can un-sort', async () => {
    await raf()
    const t = table()
    const seatsSortButton = [...t.querySelectorAll('[data-part="sort-button"]')].find((b) => b.closest('th')?.textContent?.includes('Seats')) as HTMLElement
    await userEvent.click(seatsSortButton) // table.sort = {key:'seats', direction:'ascending'}
    await raf()
    expect((t.sort as unknown as { key: string } | null)?.key).toBe('seats')

    await openColumnsMenu()
    const seatsCheckbox = columnsRow('Seats').querySelector('ui-checkbox') as UICheckboxElement
    await userEvent.click(seatsCheckbox) // hide the currently-sorted column
    await raf()
    expect(t.sort, 'hiding the sorted column must clear table.sort, not leave it pointing at a hidden key').toBeNull()

    // reset
    await userEvent.click(seatsCheckbox)
    await raf()
    expect(headerLabels()).toEqual(ORIGINAL_ORDER)
  })
})

describe('workbench — SPEC-R9: the agent summary is keyed to view state, provably', () => {
  function summaryText(): string {
    return (document.querySelector('.wb-summary-host') as HTMLElement).textContent ?? ''
  }

  it('starts on the "all" key; a facet filter swaps it to "filtered"; clearing swaps it back', async () => {
    await raf()
    expect(summaryText()).toContain('All accounts')
    expect(summaryText()).not.toContain('Filtered view')

    await clickStatusFacet('Churned')
    await raf()
    expect(summaryText(), 'a filter must swap the rendered summary to the "filtered" key').toContain('Filtered view')
    expect(summaryText()).not.toContain('All accounts')

    await clickStatusFacet('Churned') // reset
    await raf()
    expect(summaryText()).toContain('All accounts')
  })
})

describe('workbench — SPEC-R8: the record-edit flow (list → open → validate → save)', () => {
  const EDIT_ID = FIXTURE_RECORDS[4]!.id // 'acc-05', Ember & Co — untouched by any earlier describe above
  const ORIGINAL_NAME = FIXTURE_RECORDS[4]!.name

  it('the open affordance is a real, keyboard-focusable ui-button, persistent page anatomy (never selection-contextual, never inside the table)', async () => {
    const btn = editButton()
    expect(table().contains(btn), 'the edit affordance must live OUTSIDE the table\'s stamped anatomy').toBe(false)
    btn.focus()
    expect(document.activeElement, 'the edit button must be a real, focusable control').toBe(btn)
  })

  it('an invalid value (a cleared required field) blocks save with a field-level error and writes nothing', async () => {
    recordPicker().value = EDIT_ID
    await userEvent.click(editButton())
    await raf()
    expect(modal().open).toBe(true)

    const nameField = modalField('name') as UITextFieldElement
    expect(nameField.value).toBe(ORIGINAL_NAME)
    await clearAndType(nameField, '')
    const saveBtn = document.querySelector('.wb-modal-actions ui-button:last-child') as UIButtonElement
    await userEvent.click(saveBtn) // blurs the empty name field AND attempts submit()
    await raf()

    expect(modal().open, 'an invalid submit must NOT close the modal').toBe(true)
    const fieldWrap = nameField.closest('ui-field') as HTMLElement
    const error = fieldWrap.querySelector('[data-part="error"]') as HTMLElement
    expect(error.hidden, 'the field-level error must be visible').toBe(false)
    expect(error.textContent, 'the field-level error must carry real text').not.toBe('')
    // no store write — the visible row is untouched
    expect(nameCellOf(rowByRecordId(EDIT_ID))).toBe(ORIGINAL_NAME)

    // recover for the next test — fix the field, leave the modal open
    await clearAndType(nameField, ORIGINAL_NAME)
  })

  it('a valid save writes the in-session store, closes the modal, restores focus to the opener, and the VISIBLE table row shows the new value', async () => {
    const nameField = modalField('name') as UITextFieldElement
    const NEW_NAME = 'Ember Holdings'
    await clearAndType(nameField, NEW_NAME)
    const saveBtn = document.querySelector('.wb-modal-actions ui-button:last-child') as UIButtonElement
    await userEvent.click(saveBtn)
    await raf()

    expect(modal().open, 'a valid save must close the modal').toBe(false)
    expect(document.activeElement, 'focus must restore to the opener').toBe(editButton())
    expect(nameCellOf(rowByRecordId(EDIT_ID)), 'the visible table row must show the new value').toBe(NEW_NAME)
  })

  it('dismissal without save via Escape mutates nothing', async () => {
    const OTHER_ID = FIXTURE_RECORDS[9]!.id // 'acc-10', untouched by the save above
    const otherOriginalName = FIXTURE_RECORDS[9]!.name
    recordPicker().value = OTHER_ID
    await userEvent.click(editButton())
    await raf()
    expect(modal().open).toBe(true)

    const nameField = modalField('name') as UITextFieldElement
    await clearAndType(nameField, 'Should never be saved')
    await userEvent.keyboard('{Escape}')
    await raf()

    expect(modal().open, 'Escape must dismiss the modal').toBe(false)
    expect(nameCellOf(rowByRecordId(OTHER_ID)), 'Escape dismissal must mutate nothing').toBe(otherOriginalName)
  })

  it('dismissal without save via a backdrop click mutates nothing', async () => {
    const THIRD_ID = FIXTURE_RECORDS[7]!.id // 'acc-08', untouched by either leg above, still on page 1 (rows 0-9)
    const thirdOriginalName = FIXTURE_RECORDS[7]!.name
    recordPicker().value = THIRD_ID
    await userEvent.click(editButton())
    await raf()
    expect(modal().open).toBe(true)

    const nameField = modalField('name') as UITextFieldElement
    await clearAndType(nameField, 'Should never be saved either')

    // modal.md's own contract: "a click whose target is the dialog box but lands OUTSIDE its content
    // rect is the ::backdrop" (modal.ts's rect-wise detection, `e.target === dialog` + a bounding-rect
    // check). A real automated mouse click has no reliable way to land OUTSIDE a top-layer <dialog>'s own
    // box while still targeting it across both engines (the backdrop covers the whole viewport natively,
    // but drivers differ on whether an "obscured" body counts as clickable) — dispatching a real
    // bubbling, cancelable MouseEvent AT the dialog element, with clientX/Y outside its own
    // getBoundingClientRect(), exercises the EXACT code path the control's own listener runs, the
    // deterministic equivalent of a real backdrop click.
    const dialog = modal().querySelector('[data-part="dialog"]') as HTMLElement
    const r = dialog.getBoundingClientRect()
    dialog.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: r.left - 10, clientY: r.top - 10 }))
    await raf()

    expect(modal().open, 'a backdrop click must dismiss the modal').toBe(false)
    expect(nameCellOf(rowByRecordId(THIRD_ID)), 'a backdrop-click dismissal must mutate nothing').toBe(thirdOriginalName)
  })
})

describe('workbench — SPEC-R10: zero network requests', () => {
  it('fetch and XHR were never called across the full interaction sequence above (search, filter, sort, select, paginate, edit, save, dismiss)', () => {
    expect(fetchCalls, 'window.fetch must never be called').toBe(0)
    expect(xhrOpens, 'XMLHttpRequest.open must never be called').toBe(0)
  })
})
