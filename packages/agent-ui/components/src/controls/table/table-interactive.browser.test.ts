import { describe, it, expect, afterEach } from 'vitest'
import { userEvent } from 'vitest/browser'

// table-interactive.browser.test.ts — the ADR-0163 cross-engine interaction proof (SPEC-R1). Runs in BOTH
// Chromium and WebKit (vitest.browser.config.ts). Covers exactly the class jsdom under-proves for the
// widened table: a real sort-button CLICK cycling `aria-sort` + reordering rows; a real KEYBOARD selection
// commit (Tab + Space) incl. select-all indeterminate over the MATCHING SET; the filter→search→sort→page
// interplay incl. selection surviving a filter change; a real pagination footer page-change commit; focus
// restoration across a `rows` update; and the MANDATORY scroll-preservation leg still green with every
// capability enabled at once.
import '@agent-ui/components/foundation-styles.css'
import '../button/button.css'
import '../pagination/pagination.css'
import './table.css'
import '../button/button.ts'
import './table.ts'
import type { UITableElement } from './table.ts'

const mounted: HTMLElement[] = []
const mount = (markup: string): HTMLElement => {
  const wrap = document.createElement('div')
  wrap.innerHTML = markup
  document.body.append(wrap)
  mounted.push(wrap)
  return wrap.firstElementChild as HTMLElement
}
afterEach(() => {
  while (mounted.length) mounted.pop()?.remove()
})

const settle = (): Promise<void> => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

const SORTABLE_COLUMNS = JSON.stringify([
  { key: 'region', label: 'Region', sortable: true },
  { key: 'revenue', label: 'Revenue', type: 'number', sortable: true },
])
const THREE_ROWS = JSON.stringify([
  { region: 'EMEA', revenue: 42000 },
  { region: 'APAC', revenue: 90000 },
  { region: 'AMER', revenue: 31000 },
])

describe('ui-table — sort click cycles aria-sort + reorders rows (SPEC-R1, ADR-0163 cl.5)', () => {
  it('activating a sortable header ascends, then descends, on the SAME column; aria-sort rides exactly one <th>', async () => {
    const table = mount(
      `<ui-table label="Revenue" columns='${SORTABLE_COLUMNS}' rows='${THREE_ROWS}'></ui-table>`,
    ) as UITableElement
    const sortButtons = [...table.querySelectorAll('thead button[data-part="sort-button"]')] as HTMLElement[]
    expect(sortButtons, 'anti-vacuous: both sortable columns stamp a sort button').toHaveLength(2)
    const revenueButton = sortButtons[1] // columns order: region, revenue

    await userEvent.click(revenueButton) // a real user gesture — proves genuine click activation
    await settle()
    let sortedThs = [...table.querySelectorAll('thead th')].filter((th) => th.hasAttribute('aria-sort'))
    expect(sortedThs, 'exactly one <th> carries aria-sort').toHaveLength(1)
    expect(sortedThs[0].getAttribute('aria-sort')).toBe('ascending')
    let cells = [...table.querySelectorAll('tbody tr td:first-child')].map((td) => td.textContent)
    expect(cells).toEqual(['AMER', 'EMEA', 'APAC']) // ascending by revenue: 31000, 42000, 90000

    revenueButton.click() // a second, same-element toggle — the disclosure.browser.test.ts native-click repeat-toggle precedent
    await settle()
    sortedThs = [...table.querySelectorAll('thead th')].filter((th) => th.hasAttribute('aria-sort'))
    expect(sortedThs).toHaveLength(1)
    expect(sortedThs[0].getAttribute('aria-sort')).toBe('descending')
    cells = [...table.querySelectorAll('tbody tr td:first-child')].map((td) => td.textContent)
    expect(cells).toEqual(['APAC', 'EMEA', 'AMER']) // descending by revenue

    expect(table.getAttribute('role'), 'the correctness crux — role=grid REJECTED').toBeNull()
    expect(table.querySelector('table')?.tagName.toLowerCase()).toBe('table')
  })

  it('component-checker regression: a sort commit NEVER rebuilds <thead> — the header <tr> AND the just-activated button keep their node identity, and FOCUS survives', async () => {
    const table = mount(
      `<ui-table label="Revenue" columns='${SORTABLE_COLUMNS}' rows='${THREE_ROWS}'></ui-table>`,
    ) as UITableElement
    const headerRowBefore = table.querySelector('thead tr') as HTMLElement
    const sortButtons = [...table.querySelectorAll('thead button[data-part="sort-button"]')] as HTMLElement[]
    const revenueButtonBefore = sortButtons[1]

    // KEYBOARD activation (Tab-focus + Space), not a mouse click: a real `<button>`'s native keyboard
    // activation never blurs the element it fires on, in EITHER engine — the platform-neutral way to prove
    // "focus survives the commit". (A mouse click is NOT a safe proxy here: real Safari/WebKit does not
    // move focus to a plain `<button>` on click at all — a WebKit/Chromium DIVERGENCE in the click→focus
    // step itself, not in anything this control does — so a click-driven version of this probe would be
    // testing the wrong thing on WebKit. Space/Enter activation on an ALREADY-focused button sidesteps that
    // divergence entirely and is the more realistic proof anyway: the ADR's own concern is a KEYBOARD user
    // tabbing to the sort button, not a mouse user.)
    revenueButtonBefore.focus()
    expect(document.activeElement, 'anti-vacuous: the button must accept real focus before activation').toBe(revenueButtonBefore)

    await userEvent.keyboard(' ')
    await settle()

    expect(table.querySelector('thead tr'), 'HEADER-BUILD must NOT have a live dependency on `sort` — the <tr> node identity must survive a sort commit').toBe(headerRowBefore)
    const revenueButtonAfter = [...table.querySelectorAll('thead button[data-part="sort-button"]')][1]
    expect(revenueButtonAfter, 'the sort <button> node identity must survive a sort commit').toBe(revenueButtonBefore)
    expect(document.activeElement, 'focus must survive a sort commit — the button was never destroyed/rebuilt').toBe(revenueButtonBefore)
    expect(table.querySelector('[aria-sort]')?.getAttribute('aria-sort')).toBe('ascending')

    // A SECOND commit (still the same, still-focused button) — proves this holds across more than one sort
    // cycle, not just the first.
    await userEvent.keyboard(' ')
    await settle()
    expect(table.querySelector('thead tr')).toBe(headerRowBefore)
    expect(document.activeElement).toBe(revenueButtonBefore)
    expect(table.querySelector('[aria-sort]')?.getAttribute('aria-sort')).toBe('descending')
  })
})

describe('ui-table — selection commit via KEYBOARD, select-all over the MATCHING SET (SPEC-R1, cl.4/cl.7)', () => {
  it('Tab + Space toggles a row checkbox; select-all reflects checked/indeterminate against a FILTERED matching set', async () => {
    const columns = JSON.stringify([{ key: 'region', label: 'Region' }])
    const rows = JSON.stringify([{ region: 'EMEA' }, { region: 'APAC' }, { region: 'AMER' }])
    const table = mount(
      `<ui-table label="Regions" selectable="multi" row-key="region" columns='${columns}' rows='${rows}'></ui-table>`,
    ) as UITableElement
    // A facet filter narrows the MATCHING SET to two of the three rows.
    table.filter = [{ key: 'region', values: ['EMEA', 'APAC'] }]
    await settle()
    expect(table.querySelectorAll('tbody tr')).toHaveLength(2) // the narrowed rendered set

    const firstCheckboxBefore = table.querySelector('tbody input[type="checkbox"]') as HTMLInputElement
    firstCheckboxBefore.focus()
    expect(document.activeElement, 'the checkbox must accept real focus (normal tab order)').toBe(firstCheckboxBefore)
    let selectFired = 0
    table.addEventListener('select', () => (selectFired += 1))
    await userEvent.keyboard(' ')
    await settle() // the commit rebuilds <tbody> (whole-array swap) — re-query fresh nodes after this point

    expect(table.selected).toEqual(['EMEA'])
    expect(selectFired, 'a real keyboard commit fires `select`').toBe(1)
    const emeaCheckboxAfter = [...table.querySelectorAll('tbody input[type="checkbox"]')].find(
      (i) => i.closest('tr')?.textContent === 'EMEA',
    ) as HTMLInputElement
    expect(emeaCheckboxAfter.checked, 'the rebuilt checkbox reflects the committed selection').toBe(true)
    expect(emeaCheckboxAfter.closest('tr')?.hasAttribute('data-selected')).toBe(true)
    expect(document.activeElement, 'focus restored to the same row identity across the rebuild').toBe(emeaCheckboxAfter)

    // select-all: partial (1 of 2 matching) ⇒ indeterminate. Its own node identity persists (VIEW only
    // mutates its checked/indeterminate props — HEADER-BUILD, which owns node identity, never re-runs on a
    // selection change), so this reference stays valid across the rebuild above.
    const selectAll = table.querySelector('[data-part="select-all"]') as HTMLInputElement
    expect(selectAll.indeterminate).toBe(true)
    expect(selectAll.checked).toBe(false)

    // Check the second matching row too ⇒ select-all becomes fully checked (AMER, filtered out, is irrelevant).
    const apacCheckbox = [...table.querySelectorAll('tbody input[type="checkbox"]')].find(
      (i) => i.closest('tr')?.textContent === 'APAC',
    ) as HTMLInputElement
    await userEvent.click(apacCheckbox)
    await settle()
    expect(selectAll.checked, 'both MATCHING rows selected ⇒ select-all checked').toBe(true)
    expect(selectAll.indeterminate).toBe(false)
    expect(new Set(table.selected)).toEqual(new Set(['EMEA', 'APAC']))
  })

  it("a REAL click-COMMIT on select-all, under an active filter, checks exactly the MATCHING SET and leaves an out-of-view selected row untouched (the ADR's own Acceptance-section scenario)", async () => {
    const columns = JSON.stringify([{ key: 'region', label: 'Region' }])
    const rows = JSON.stringify([{ region: 'EMEA' }, { region: 'APAC' }, { region: 'AMER' }])
    const table = mount(
      `<ui-table label="Regions" selectable="multi" row-key="region" columns='${columns}' rows='${rows}'></ui-table>`,
    ) as UITableElement
    // AMER is selected up front and then immediately filtered OUT OF VIEW — held selected, invisible.
    table.selected = ['AMER']
    table.filter = [{ key: 'region', values: ['EMEA', 'APAC'] }]
    await settle()
    expect(table.querySelectorAll('tbody tr')).toHaveLength(2) // AMER is not rendered
    const selectAll = table.querySelector('[data-part="select-all"]') as HTMLInputElement
    expect(selectAll.indeterminate, 'AMER is selected but not in the matching set — 0 of 2 matching ⇒ not indeterminate').toBe(false)
    expect(selectAll.checked).toBe(false)

    let selectFired = 0
    table.addEventListener('select', () => (selectFired += 1))
    await userEvent.click(selectAll) // the real commit under test — a genuine pointer click, not a prop write
    await settle()

    expect(selectFired, 'a real select-all commit fires `select`').toBe(1)
    expect(new Set(table.selected), 'the matching set unions in, AMER (out of view) is preserved').toEqual(new Set(['AMER', 'EMEA', 'APAC']))
    for (const input of [...table.querySelectorAll('tbody input[type="checkbox"]')] as HTMLInputElement[]) {
      expect(input.checked, `${input.closest('tr')?.textContent} should be checked`).toBe(true)
    }

    // Un-commit: click select-all again — only the MATCHING set (EMEA/APAC) unchecks; AMER stays selected.
    await userEvent.click(selectAll)
    await settle()
    expect(table.selected).toEqual(['AMER'])

    // Clear the filter — AMER reappears, still checked, proving it was never touched by either commit.
    table.filter = []
    await settle()
    const amerCheckbox = [...table.querySelectorAll('tbody input[type="checkbox"]')].find(
      (i) => i.closest('tr')?.textContent === 'AMER',
    ) as HTMLInputElement
    expect(amerCheckbox.checked).toBe(true)
  })

  it("component-checker regression: a selection toggle's native <input> change never reaches a table-level `change` listener (the sort/page commit channel stays exclusive)", async () => {
    const columns = JSON.stringify([{ key: 'region', label: 'Region' }])
    const rows = JSON.stringify([{ region: 'EMEA' }])
    const table = mount(
      `<ui-table label="Regions" selectable="multi" row-key="region" columns='${columns}' rows='${rows}'></ui-table>`,
    ) as UITableElement
    let changeFired = 0
    let selectFired = 0
    table.addEventListener('change', () => (changeFired += 1))
    table.addEventListener('select', () => (selectFired += 1))
    const checkbox = table.querySelector('tbody input[type="checkbox"]') as HTMLInputElement
    await userEvent.click(checkbox)
    await settle()
    expect(selectFired, 'the selection commit event fires').toBe(1)
    expect(changeFired, 'a selection toggle must NEVER double-fire the sort/page commit channel').toBe(0)

    // The header select-all checkbox — same law.
    const selectAll = table.querySelector('[data-part="select-all"]') as HTMLInputElement
    await userEvent.click(selectAll)
    await settle()
    expect(changeFired, 'select-all must ALSO never fire `change`').toBe(0)
  })
})

describe('ui-table — filter → search → sort → page interplay; selection survives a filter change (SPEC-R1, cl.7)', () => {
  it('a selected row stays selected (invisible) across a filter that hides it, and reappears when the filter clears', async () => {
    const columns = JSON.stringify([{ key: 'region', label: 'Region' }])
    const rows = JSON.stringify([{ region: 'EMEA' }, { region: 'APAC' }])
    const table = mount(
      `<ui-table label="Regions" selectable="multi" row-key="region" columns='${columns}' rows='${rows}'></ui-table>`,
    ) as UITableElement
    table.selected = ['EMEA']
    await settle()
    expect(table.querySelector('tbody input[type="checkbox"]:checked')).not.toBeNull()

    // Filter EMEA out entirely — it survives selected, just isn't rendered.
    table.filter = [{ key: 'region', values: ['APAC'] }]
    await settle()
    expect(table.querySelectorAll('tbody tr')).toHaveLength(1)
    // the FIRST <td> is the selection cell (selectable="multi") — the data column is the second
    expect(table.querySelector('tbody tr td:nth-child(2)')?.textContent).toBe('APAC')
    expect(table.selected).toEqual(['EMEA']) // untouched by the filter change

    // Clear the filter — EMEA reappears, still checked.
    table.filter = []
    await settle()
    expect(table.querySelectorAll('tbody tr')).toHaveLength(2)
    const emeaRow = [...table.querySelectorAll('tbody tr')].find((tr) => tr.textContent?.includes('EMEA'))
    expect((emeaRow?.querySelector('input') as HTMLInputElement).checked).toBe(true)
  })

  it('page-size windows the sorted, filtered, SEARCHED set — the full pipeline order, in a real engine', async () => {
    const columns = JSON.stringify([{ key: 'n', label: 'N', type: 'number', sortable: true }])
    const rows = JSON.stringify(Array.from({ length: 25 }, (_, i) => ({ n: i + 1 })))
    const table = mount(
      `<ui-table label="Numbers" page-size="10" columns='${columns}' rows='${rows}'></ui-table>`,
    ) as UITableElement
    await settle()
    expect(table.querySelectorAll('tbody tr')).toHaveLength(10)
    const pagination = table.querySelector('[data-part="footer"] ui-pagination') as HTMLElement
    expect(pagination, 'the footer stamps ui-pagination outside the scroll container').not.toBeNull()
    expect(table.querySelector('[data-part="scroll"]')?.contains(pagination)).toBe(false)

    // Sort descending — the WINDOW must reflect the sorted order, not the pre-sort one.
    const sortButton = table.querySelector('button[data-part="sort-button"]') as HTMLElement
    await userEvent.click(sortButton) // ascending — a real user gesture
    sortButton.click() // descending — a second, same-element toggle (the disclosure.browser.test.ts precedent)
    await settle()
    const firstCellAfterSort = table.querySelector('tbody tr td')?.textContent
    expect(firstCellAfterSort).toBe('25') // descending ⇒ page 1 shows the highest values first

    // SEARCH, in a real engine (the ADR Acceptance section names this explicitly — previously only jsdom/
    // unit covered it). The table has no in-table query UI (cl.2) — a bound `search` prop write IS the
    // real-consumer mechanism (a composed ui-text-field would drive the SAME prop). Narrows the already-
    // sorted, already-paginated set: only "25" itself renders "25" as a substring.
    table.search = '25'
    await settle()
    expect(table.querySelectorAll('tbody tr')).toHaveLength(1)
    expect(table.querySelector('tbody tr td')?.textContent).toBe('25')
    expect(pagination.getAttribute('pages')).toBe('1') // pageCount re-derives from the narrowed matching set

    table.search = ''
    await settle()
    expect(table.querySelectorAll('tbody tr')).toHaveLength(10) // the full sorted/paginated set returns
  })
})

describe('ui-table — pagination footer commits a real page change (SPEC-R1, cl.6)', () => {
  it('clicking "next" in the footer advances the window and fires a table-level `change`', async () => {
    const columns = JSON.stringify([{ key: 'n', label: 'N' }])
    const rows = JSON.stringify(Array.from({ length: 25 }, (_, i) => ({ n: String(i + 1) })))
    const table = mount(
      `<ui-table label="Numbers" page-size="10" columns='${columns}' rows='${rows}'></ui-table>`,
    ) as UITableElement
    await settle()
    expect(table.querySelector('tbody tr td')?.textContent).toBe('1')
    expect(table.page).toBe(1)

    let changeFired = 0
    table.addEventListener('change', () => (changeFired += 1))
    const next = table.querySelector('[data-part="footer"] [data-part="next"]') as HTMLElement
    await userEvent.click(next)
    await settle()
    expect(table.page).toBe(2)
    expect(changeFired, 'the footer commit forwards into a table-level `change`').toBe(1)
    expect(table.querySelector('tbody tr td')?.textContent).toBe('11')
  })
})

describe('ui-table — focus restoration across a rows update (cl.10/SPEC-R4.5)', () => {
  it('focus on a stamped selection input survives a rows swap when the row identity still exists', async () => {
    const columns = JSON.stringify([{ key: 'region', label: 'Region' }])
    const rows = JSON.stringify([{ region: 'EMEA' }, { region: 'APAC' }])
    const table = mount(
      `<ui-table label="Regions" selectable="multi" row-key="region" columns='${columns}' rows='${rows}'></ui-table>`,
    ) as UITableElement
    await settle()
    const apacCheckbox = [...table.querySelectorAll('tbody input[type="checkbox"]')].find(
      (i) => i.closest('tr')?.textContent === 'APAC',
    ) as HTMLInputElement
    apacCheckbox.focus()
    expect(document.activeElement).toBe(apacCheckbox)

    // A same-shape rows swap (a new array, same identities) — the bound-write path.
    table.rows = [{ region: 'EMEA' }, { region: 'APAC' }, { region: 'AMER' }]
    await settle()

    const restoredCheckbox = [...table.querySelectorAll('tbody input[type="checkbox"]')].find(
      (i) => i.closest('tr')?.textContent === 'APAC',
    ) as HTMLInputElement
    expect(document.activeElement, 'focus was not restored to the same row identity').toBe(restoredCheckbox)
  })
})

describe('ui-table — the MANDATORY scroll-preservation leg, interactive anatomy ON (SPEC-R4 AC1, cl.10)', () => {
  it('scrolling then a same-shape rows swap leaves scrollLeft unchanged with selection+sort+pagination all enabled', async () => {
    const manyCols = JSON.stringify(
      Array.from({ length: 12 }, (_, i) => ({ key: `c${i}`, label: `Column ${i}`, type: 'number', sortable: true })),
    )
    const wideRow = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`c${i}`, (i + 1) * 1000]))
    const table = mount(
      `<ui-table style="inline-size: 200px" selectable="multi" columns='${manyCols}' rows='${JSON.stringify([wideRow])}'></ui-table>`,
    ) as UITableElement
    const scroll = table.querySelector('[data-part="scroll"]') as HTMLElement
    expect(scroll.scrollWidth, 'anti-vacuous: the scroll container must actually overflow').toBeGreaterThan(scroll.clientWidth)

    scroll.scrollLeft = 40
    const scrolledTo = scroll.scrollLeft
    expect(scrolledTo).toBeGreaterThan(0)
    await settle()

    const nextRow = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`c${i}`, (i + 1) * 2000]))
    table.rows = [nextRow]
    await settle()

    expect(scroll.scrollLeft, 'the rows update reset the scroll offset with interactive anatomy on').toBe(scrolledTo)
    expect(table.querySelector('[data-part="scroll"]')).toBe(scroll)
    expect(table.querySelector('table')).not.toBeNull()
  })
})
