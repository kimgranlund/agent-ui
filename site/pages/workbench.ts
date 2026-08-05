// workbench.ts — the SaaS Data Workbench (GH #461, M-A MA-3). A site-hosted demo page composed ENTIRELY
// from already-published fleet primitives — zero new controls minted (SPEC-R1..R14). Structural precedent:
// agent-admin-app.ts (site/agent-admin-app.html) — a STANDALONE full-viewport surface with NO docs-site
// container shell (no nav rail, no prose column): the foundation CSS cascade is imported directly, in the
// SAME [1]→[3b] order that file documents, because this page's own reason to exist is showing the four
// composed parts exactly as they would ship, not a docs-wrapped preview of them.
//
// ── FIRST ACT (SPEC-N10 / SPEC-R6 / PRD assumption A1) ──────────────────────────────────────────────────
// A1 — "ui-workspace-shell hosts a content = data table + toolbar region with no new shell-side work" —
// is RE-VERIFIED here, not assumed: this page's own `data-slot="content"` region below holds nothing but
// this page's OWN content (a toolbar, a table, a record-edit affordance, a summary card) — no shell-side
// code, no shell-facing CSS beyond a single content-agnostic BLOCK-SIZE dimension on the host in
// workbench.css (no display:flex/grid, no --ui-super-shell-* pane-size override: SPEC-N6's fence). It
// mounted and rendered correctly on the first real pass with zero shell-side changes — A1 CONFIRMED, not a
// fork. (Recorded here per the dispatch; the mechanical proof is this page's own green browser suite,
// workbench.browser.test.ts, which drives real content through this exact shell composition.)
//
// ── the four parts (PRD §5 / SPEC §2) ───────────────────────────────────────────────────────────────────
// Data table + pagination: ui-table (ADR-0163 widened) + its own composed ui-pagination footer, driven by
//   this page's fixture (workbench-data.ts). Filter toolbar: ui-toolbar + ui-text-field (search) +
//   ui-form-popover + a ui-checkbox group (PRD-D3 ratified facet vehicle) — the page aggregates the checked
//   set into ONE `{key,values[]}` filter entry; the toolbar NEVER reassigns `table.rows` (only `table.search`/
//   `table.filter`) — the identity is captured and asserted in workbench.browser.test.ts. Record-edit flow:
//   ui-modal + ui-form-provider + ui-field + FACE controls (PRD-D6 ruled: ui-modal, SPEC §3) over the current
//   record's SCALAR fields (SPEC-N4) — the open affordance is a persistent, real, keyboard-focusable
//   ui-button OUTSIDE the table's stamped anatomy and never selection-contextual (SPEC-N8). Agent summary:
//   ui-surface-host (PRD-D4 ruled candidate (a)) replaying a RECORDED (PRD-D5 ruled), validator-passing A2UI
//   fixture (workbench-summary.ts) keyed to the current view state.
//
// The workbench frame is never agent-emittable (SPEC-N5): the agent's payload composes catalog rows INSIDE
// the one ui-surface-host mount and nothing outside it. No fetch layer (SPEC-N1/N10) — every import below
// names only published `@agent-ui/*` subpaths, none of them a transport.

import '@agent-ui/components/foundation-styles.css' // [1] foundation: tokens.css → dimensions.css (FIRST)
import '@agent-ui/components/base-styles.css' // [1b] the DOCUMENT BASE layer: typeface/leading/ink/rendering (shell-less pages need this or they render in the UA serif)
import '@agent-ui/components/component-styles.css' // [2] per-control CSS (table/pagination/toolbar/form-popover/checkbox/select/field/form-provider/modal/button — one bundle)
import '@agent-ui/components/components' // [3] self-defining ui-* controls (the whole default-catalog fleet)
import '@agent-ui/icons/phosphor' // [3b] the Phosphor default pack — ui-form-popover's own caret glyph renders a real SVG
import '@agent-ui/app/workspace-shell.css'
import '@agent-ui/app/super-shell.css' // ui-workspace-shell composes ui-super-shell (LLD-C5) — the composed child's own sheet, the agent-admin-app.ts precedent
import '@agent-ui/app/surface-host.css'
import '@agent-ui/app/workspace-shell' // self-defines ui-workspace-shell
import '@agent-ui/app/surface-host' // self-defines ui-surface-host
import './workbench.css' // page-local: full-viewport sizing (a plain dimension, no shell frame rules) + content-region layout only

import type {
  UITableElement,
  UIModalElement,
  UIFormPopoverElement,
  UICheckboxElement,
  UISelectElement,
  UITextFieldElement,
  UIFormProviderElement,
  UIButtonElement,
} from '@agent-ui/components/components'
import type { UISurfaceHostElement } from '@agent-ui/app'

import {
  WORKBENCH_COLUMNS,
  WORKBENCH_ROW_KEY,
  STATUS_FACET_KEY,
  STATUS_FACET_VALUES,
  computeMatchingCount,
  createWorkbenchStore,
  readWorkbenchRecords,
  writeWorkbenchRecords,
  type AccountPlan,
  type AccountStatus,
  type WorkbenchFilterEntry,
  type WorkbenchRecord,
} from './workbench-data.ts'
import { summaryLines, summaryViewKey, type SummaryViewKey } from './workbench-summary.ts'

const root = document.querySelector('#app') ?? document.body

// ── small light-DOM chrome helpers (page chrome only — never restyle a ui-* control's internals) ─────────
function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (className) node.className = className
  return node
}

// ════════════════ the shell — one ui-workspace-shell, ONE authored slot (SPEC-R6/A1) ════════════════════
const shell = document.createElement('ui-workspace-shell')

const header = document.createElement('div')
header.setAttribute('data-slot', 'header')
header.className = 'wb-header'
const title = document.createElement('h1')
title.className = 'wb-title'
title.textContent = 'SaaS Data Workbench'
const persistenceNote = document.createElement('p')
persistenceNote.className = 'wb-persistence-note'
// PRD-D2/SPEC-N2 — stated visibly on the page, not hidden behind fake durability.
persistenceNote.textContent = 'Demo data — edits are real for this session and reset on reload.'
header.append(title, persistenceNote)

const content = document.createElement('main')
content.setAttribute('data-slot', 'content')
const wbContent = el('div', 'wb-content')
content.append(wbContent)

shell.append(header, content)
root.append(shell)

// ════════════════ the store + the ONE `table.rows` write site (the toolbar never reassigns it) ═══════════
const store = createWorkbenchStore()

// ════════════════ the data table + its composed pagination footer (SPEC-R1) ═══════════════════════════
const table = document.createElement('ui-table') as UITableElement
table.label = 'Accounts'
table.columns = WORKBENCH_COLUMNS
table.rowKey = WORKBENCH_ROW_KEY
table.selectable = 'multi'
table.pageSize = 10
table.rows = readWorkbenchRecords(store) as unknown as UITableElement['rows']

const tableWrap = el('div', 'wb-table-wrap')
tableWrap.append(table)

// ════════════════ the filter toolbar (SPEC-R7 · PRD-D3 ratified) ══════════════════════════════════════
const toolbarRow = el('div', 'wb-toolbar-row')
const toolbar = document.createElement('ui-toolbar')
toolbar.setAttribute('label', 'Filter accounts')

const searchFieldWrap = document.createElement('ui-field')
searchFieldWrap.setAttribute('label', 'Search')
const searchField = document.createElement('ui-text-field') as UITextFieldElement
searchField.type = 'search'
searchField.placeholder = 'Search accounts'
searchFieldWrap.append(searchField)

const statusPopover = document.createElement('ui-form-popover') as UIFormPopoverElement
statusPopover.setAttribute('placement', 'bottom-start')
const statusFieldset = document.createElement('fieldset')
statusFieldset.setAttribute('role', 'group')
statusFieldset.setAttribute('aria-label', 'Status')
const statusCheckboxes = new Map<AccountStatus, UICheckboxElement>()
for (const status of STATUS_FACET_VALUES) {
  const checkbox = document.createElement('ui-checkbox') as UICheckboxElement
  checkbox.value = status
  checkbox.textContent = status
  statusCheckboxes.set(status, checkbox)
  statusFieldset.append(checkbox)
}
statusPopover.append(statusFieldset)

toolbar.append(searchFieldWrap, statusPopover)

const resultsCount = document.createElement('p')
resultsCount.className = 'wb-results-count'
resultsCount.setAttribute('role', 'status')

toolbarRow.append(toolbar, resultsCount)

/** Recompute the results count + the agent-summary view key from the CURRENT search/filter state — the
 *  one place both the visible count (SPEC-R7's zero-result mitigation) and the summary swap (SPEC-R9) read
 *  from, so the two can never independently drift on what "the current view" means. */
function refreshDerivedView(): void {
  const records = readWorkbenchRecords(store)
  const filter = table.filter as unknown as WorkbenchFilterEntry[]
  const search = table.search
  const matching = computeMatchingCount(records, filter, search)
  resultsCount.textContent = `Showing ${matching} of ${records.length} accounts`
  applySummaryKey(summaryViewKey({ filterActive: filter.length > 0, searchActive: search.trim() !== '' }))
}

searchField.addEventListener('input', () => {
  table.search = searchField.value
  refreshDerivedView()
})

function updateStatusFilter(): void {
  const checked = STATUS_FACET_VALUES.filter((status) => statusCheckboxes.get(status)!.checked)
  table.filter = (checked.length > 0 ? [{ key: STATUS_FACET_KEY, values: checked }] : []) as unknown as UITableElement['filter']
  statusPopover.label = checked.length > 0 ? `Status · ${checked.length} selected` : 'Status'
  refreshDerivedView()
}
for (const checkbox of statusCheckboxes.values()) checkbox.addEventListener('change', updateStatusFilter)
statusPopover.label = 'Status'

// ════════════════ the record-edit flow (SPEC-R8 · PRD-D6 ruled: ui-modal) ═════════════════════════════
const recordActions = el('div', 'wb-record-actions')
const pickerFieldWrap = document.createElement('ui-field')
pickerFieldWrap.setAttribute('label', 'Record to edit')
const recordPicker = document.createElement('ui-select') as UISelectElement
pickerFieldWrap.append(recordPicker)

function renderRecordPickerOptions(records: readonly WorkbenchRecord[]): void {
  const previous = recordPicker.value
  recordPicker.replaceChildren()
  for (const record of records) {
    const option = document.createElement('div')
    option.setAttribute('role', 'option')
    option.setAttribute('value', record.id)
    option.textContent = record.name
    recordPicker.append(option)
  }
  const stillExists = records.some((r) => r.id === previous)
  recordPicker.value = stillExists ? previous : (records[0]?.id ?? '')
}
renderRecordPickerOptions(readWorkbenchRecords(store))

/** The picker → table row visual echo (layout-checker B3): scroll the picked record's row into view and
 *  flash-highlight it (workbench.css's `.wb-row-flash`, a TRANSIENT class, never a persistent attribute on
 *  the table's own stamped `<tr>` — see that sheet's own comment for why durability there is the wrong
 *  layer). A no-op when the row isn't currently rendered (filtered/paginated out) — nothing to echo to. */
function highlightPickedRow(): void {
  const input = table.querySelector(`[data-part="select"][data-row-id="${recordPicker.value}"]`)
  const row = input?.closest('tr')
  if (!row) return
  row.scrollIntoView({ block: 'nearest' })
  row.classList.remove('wb-row-flash')
  void row.offsetWidth // force a reflow so re-adding the class re-triggers the animation on a repeat pick
  row.classList.add('wb-row-flash')
  row.addEventListener('animationend', () => row.classList.remove('wb-row-flash'), { once: true })
}
recordPicker.addEventListener('select', highlightPickedRow)
// NOT called here yet — `table` isn't connected to the document until the tree mounts below (its own
// tbody hasn't rendered a single row to find), so the initial echo runs once mounting completes (this
// file's own tail, alongside refreshDerivedView()).

// SPEC-N8 / SPEC-R8(a) — a REAL, persistent, keyboard-focusable control OUTSIDE the table's stamped
// anatomy: never a fenced interactive cell, never selection-contextual (it reads no `table.selected` at
// all — the picker above, not the table's own selection state, names WHICH record this opens).
const editButton = document.createElement('ui-button') as UIButtonElement
editButton.textContent = 'Edit record'
editButton.setAttribute('variant', 'soft')
recordActions.append(pickerFieldWrap, editButton)

const modal = document.createElement('ui-modal') as UIModalElement
modal.elevation = '1'
modal.setAttribute('aria-labelledby', 'wb-edit-title')
const modalTitle = document.createElement('h2')
modalTitle.id = 'wb-edit-title'
modalTitle.textContent = 'Edit account'

const provider = document.createElement('ui-form-provider') as UIFormProviderElement
const modalFields = el('div', 'wb-modal-fields')

function fieldWrap(label: string, control: HTMLElement): HTMLElement {
  const wrap = document.createElement('ui-field')
  wrap.setAttribute('label', label)
  wrap.append(control)
  return wrap
}

const nameField = document.createElement('ui-text-field') as UITextFieldElement
nameField.name = 'name'
nameField.required = true

const planSelect = document.createElement('ui-select') as UISelectElement
planSelect.name = 'plan'
planSelect.required = true
const planValues: readonly AccountPlan[] = ['Starter', 'Growth', 'Scale', 'Enterprise']
for (const plan of planValues) {
  const option = document.createElement('div')
  option.setAttribute('role', 'option')
  option.setAttribute('value', plan)
  option.textContent = plan
  planSelect.append(option)
}

const statusSelect = document.createElement('ui-select') as UISelectElement
statusSelect.name = 'status'
statusSelect.required = true
for (const status of STATUS_FACET_VALUES) {
  const option = document.createElement('div')
  option.setAttribute('role', 'option')
  option.setAttribute('value', status)
  option.textContent = status
  statusSelect.append(option)
}

const seatsField = document.createElement('ui-text-field') as UITextFieldElement
seatsField.name = 'seats'
seatsField.type = 'number'
seatsField.min = '0'
seatsField.required = true

const mrrField = document.createElement('ui-text-field') as UITextFieldElement
mrrField.name = 'mrr'
mrrField.type = 'number'
mrrField.min = '0'
mrrField.required = true

const renewsField = document.createElement('ui-text-field') as UITextFieldElement
renewsField.name = 'renewsOn'
renewsField.required = true

modalFields.append(
  fieldWrap('Account name', nameField),
  fieldWrap('Plan', planSelect),
  fieldWrap('Status', statusSelect),
  fieldWrap('Seats', seatsField),
  fieldWrap('MRR', mrrField),
  fieldWrap('Renews on', renewsField),
)
provider.append(modalFields)

const modalActions = el('div', 'wb-modal-actions')
const cancelButton = document.createElement('ui-button') as UIButtonElement
cancelButton.textContent = 'Cancel'
cancelButton.setAttribute('variant', 'ghost')
const saveButton = document.createElement('ui-button') as UIButtonElement
saveButton.textContent = 'Save'
saveButton.setAttribute('variant', 'solid')
modalActions.append(cancelButton, saveButton)

modal.append(modalTitle, provider, modalActions)

let editingId: string | undefined

function openEditModal(): void {
  const records = readWorkbenchRecords(store)
  const record = records.find((r) => r.id === recordPicker.value)
  if (!record) return
  editingId = record.id
  nameField.value = record.name
  planSelect.value = record.plan
  statusSelect.value = record.status
  seatsField.value = String(record.seats)
  mrrField.value = String(record.mrr)
  renewsField.value = record.renewsOn
  modal.open = true
}
editButton.addEventListener('click', openEditModal)

cancelButton.addEventListener('click', () => {
  modal.open = false // dismissal without save — mutates nothing (SPEC-R8(d))
})

saveButton.addEventListener('click', () => {
  if (editingId === undefined) return
  const ok = provider.submit() // invalid ⇒ reportValidity() on the first invalid member, no store write (SPEC-R8(b))
  if (!ok) return
  const values = provider.values() as Record<string, string>
  const updated: WorkbenchRecord = {
    id: editingId,
    name: values.name ?? '',
    plan: (values.plan as AccountPlan) ?? 'Starter',
    status: (values.status as AccountStatus) ?? 'Active',
    seats: Number(values.seats) || 0,
    mrr: Number(values.mrr) || 0,
    renewsOn: values.renewsOn ?? '',
  }
  const nextRecords = readWorkbenchRecords(store).map((r) => (r.id === editingId ? updated : r))
  writeWorkbenchRecords(store, nextRecords)
  // A genuine data mutation — legitimate to reassign `rows` here (the toolbar itself never does).
  table.rows = nextRecords as unknown as UITableElement['rows']
  renderRecordPickerOptions(nextRecords)
  refreshDerivedView()
  modal.open = false // focus restores to the opener (editButton) — modal.md's ADR-0017 cl.4 contract
  highlightPickedRow() // re-echo the just-saved row — table.rows just rebuilt the tbody above
})

// ════════════════ the agent summary card (SPEC-R9 · PRD-D4 ruled (a) · PRD-D5 ruled "recorded") ═════════
const summarySection = document.createElement('section')
summarySection.className = 'wb-summary'
summarySection.setAttribute('aria-labelledby', 'wb-summary-title')
const summaryTitle = document.createElement('h2')
summaryTitle.id = 'wb-summary-title'
summaryTitle.className = 'wb-summary-title'
summaryTitle.textContent = 'Agent summary'
summarySection.append(summaryTitle)

let summaryHost: UISurfaceHostElement | undefined
let currentSummaryKey: SummaryViewKey | undefined

/** Swap the mounted `ui-surface-host` for the given key — `ingest()` is an append-only stream, not a
 *  rebuild-in-place setter (surface-host.md), so switching payloads mints a FRESH instance (its own
 *  `disconnected()` disposes the outgoing `RendererHost` cleanly) rather than re-ingesting into a disposed
 *  one. A no-op when the key is unchanged (never re-mounts for the same view state). */
function applySummaryKey(key: SummaryViewKey): void {
  if (key === currentSummaryKey) return
  currentSummaryKey = key
  summaryHost?.remove()
  const host = document.createElement('ui-surface-host') as UISurfaceHostElement
  host.wrap = true
  host.bare = true
  host.className = 'wb-summary-host'
  summarySection.append(host)
  summaryHost = host
  for (const line of summaryLines(key)) host.ingest(line)
  host.finalize()
}

// ════════════════ compose the content region — SPEC-R6: zero bespoke shell chrome, this page's own
// content only ════════════════════════════════════════════════════════════════════════════════════════
wbContent.append(toolbarRow, recordActions, tableWrap, summarySection)
document.body.append(modal) // top-layer element — DOM position doesn't affect rendering; kept out of the scroll region

refreshDerivedView() // the initial results count + the 'all' summary key, before any interaction
highlightPickedRow() // the initial default pick's echo, now that `table` is connected and has rendered rows
