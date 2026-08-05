// workbench-data.ts — the SaaS Data Workbench's seeded, in-repo fixture (PRD-D2 ratified · SPEC-R10 ·
// SPEC-N1/N4). The workbench's ONLY data source: no fetch layer, no backend. Every record field is
// SCALAR (SPEC-N4 — no arrays/objects as field values), which is what makes SPEC-N3's "no new
// multi-select control" coherent (no workbench record ever needs a to-many field).
//
// Persistence is IN-SESSION ONLY (PRD-D2/SPEC-N2): `createMemoryStore` (ADR-0120/ADR-0158's store
// family — NOT ADR-0164, whose cl.3 names the `mountEntryList` interface this page never uses; GH
// #465) holds the mutable working copy under ONE key, with NO `persistKey`
// — a plain in-process Map that dies with the page, exactly the "gone on reload" contract PRD-D2 requires.
// `FIXTURE_RECORDS` itself is the immutable SEED; the store's copy is what the page reads/writes.

import { createMemoryStore } from '@agent-ui/app/settings-memory-store'
import type { SettingsStore } from '@agent-ui/app'

// ── the record shape (SPEC-N4 — every field scalar) ─────────────────────────────────────────────────────

export type AccountPlan = 'Starter' | 'Growth' | 'Scale' | 'Enterprise'
export type AccountStatus = 'Active' | 'Trial' | 'Churned'

export interface WorkbenchRecord {
  readonly id: string
  name: string
  plan: AccountPlan
  status: AccountStatus
  seats: number
  mrr: number
  renewsOn: string // ISO date string (YYYY-MM-DD) — a plain scalar, not a Date object (SPEC-N4)
}

/** The local mirror of `ui-table`'s `columns` JSON shape (`table.md`'s `TableColumn` — not published
 *  outside `@agent-ui/components/controls/table`'s own internals, so this is a structurally-matching
 *  local type, never a deep import). */
export interface WorkbenchColumn {
  key: string
  label: string
  type?: 'string' | 'number'
  sortable?: boolean
  searchable?: boolean
}

/** `ui-table`'s `sort` JSON shape (ADR-0163 cl.5) — a local structural mirror, same reasoning as
 *  `WorkbenchColumn` above. */
export interface WorkbenchSort {
  key: string
  direction: 'ascending' | 'descending'
}

/** `ui-table`'s `filter` JSON shape (ADR-0163 cl.2's bounded FACET shape) — a local structural mirror. */
export interface WorkbenchFilterEntry {
  key: string
  values: (string | number)[]
}

// ── columns (SPEC-R1's fixture-driven probe: `name` is the sort exemplar, every column searchable by
// default) ───────────────────────────────────────────────────────────────────────────────────────────────
export const WORKBENCH_COLUMNS: WorkbenchColumn[] = [
  { key: 'name', label: 'Account', sortable: true },
  { key: 'plan', label: 'Plan', sortable: true },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'seats', label: 'Seats', type: 'number', sortable: true },
  { key: 'mrr', label: 'MRR', type: 'number', sortable: true },
  { key: 'renewsOn', label: 'Renews', sortable: true },
]

export const WORKBENCH_ROW_KEY = 'id'

// The facet column the filter toolbar drives (SPEC-R7 · PRD-D3 ratified vehicle).
export const STATUS_FACET_KEY = 'status'
export const STATUS_FACET_VALUES: readonly AccountStatus[] = ['Active', 'Trial', 'Churned']

// ── the seed — 25 records (SPEC-R1's own acceptance text: "page-size=10 over 25 rows renders 10 <tr>
// plus a footer navigator reading 3 pages"). Deterministic, hand-authored — never randomized, so every
// gate run computes the identical matching/paged sets. 15 Active + 6 Trial + 4 Churned = 25 — the Trial
// facet (6 rows, a genuine sub-page) is the workbench.browser.test.ts select-all/indeterminate exemplar. ──
export const FIXTURE_RECORDS: WorkbenchRecord[] = [
  { id: 'acc-01', name: 'Acme Robotics', plan: 'Scale', status: 'Active', seats: 42, mrr: 3200, renewsOn: '2026-09-01' },
  { id: 'acc-02', name: 'Blue Harbor Freight', plan: 'Growth', status: 'Active', seats: 18, mrr: 1450, renewsOn: '2026-08-14' },
  { id: 'acc-03', name: 'Cobalt Analytics', plan: 'Enterprise', status: 'Active', seats: 120, mrr: 9800, renewsOn: '2026-11-02' },
  { id: 'acc-04', name: 'Driftwood Studio', plan: 'Starter', status: 'Trial', seats: 3, mrr: 0, renewsOn: '2026-08-20' },
  { id: 'acc-05', name: 'Ember & Co', plan: 'Growth', status: 'Active', seats: 27, mrr: 2100, renewsOn: '2026-09-18' },
  { id: 'acc-06', name: 'Fernwood Labs', plan: 'Scale', status: 'Trial', seats: 15, mrr: 0, renewsOn: '2026-08-05' },
  { id: 'acc-07', name: 'Granite Systems', plan: 'Enterprise', status: 'Active', seats: 210, mrr: 15400, renewsOn: '2026-12-01' },
  { id: 'acc-08', name: 'Harborlight Media', plan: 'Starter', status: 'Churned', seats: 4, mrr: 0, renewsOn: '2026-07-30' },
  { id: 'acc-09', name: 'Indigo Freight', plan: 'Growth', status: 'Active', seats: 33, mrr: 2600, renewsOn: '2026-10-11' },
  { id: 'acc-10', name: 'Juniper Health', plan: 'Scale', status: 'Active', seats: 61, mrr: 4900, renewsOn: '2026-09-27' },
  { id: 'acc-11', name: 'Kestrel Robotics', plan: 'Enterprise', status: 'Trial', seats: 8, mrr: 0, renewsOn: '2026-08-09' },
  { id: 'acc-12', name: 'Lighthouse Retail', plan: 'Starter', status: 'Active', seats: 6, mrr: 380, renewsOn: '2026-08-22' },
  { id: 'acc-13', name: 'Marigold Foods', plan: 'Growth', status: 'Churned', seats: 22, mrr: 0, renewsOn: '2026-07-19' },
  { id: 'acc-14', name: 'Nightingale Care', plan: 'Scale', status: 'Active', seats: 54, mrr: 4300, renewsOn: '2026-10-30' },
  { id: 'acc-15', name: 'Onyx Manufacturing', plan: 'Enterprise', status: 'Active', seats: 175, mrr: 12800, renewsOn: '2026-11-15' },
  { id: 'acc-16', name: 'Pinecrest Realty', plan: 'Starter', status: 'Trial', seats: 2, mrr: 0, renewsOn: '2026-08-03' },
  { id: 'acc-17', name: 'Quarrystone Bank', plan: 'Growth', status: 'Active', seats: 31, mrr: 2450, renewsOn: '2026-09-09' },
  { id: 'acc-18', name: 'Redwood Transit', plan: 'Scale', status: 'Churned', seats: 40, mrr: 0, renewsOn: '2026-07-25' },
  { id: 'acc-19', name: 'Saltmarsh Energy', plan: 'Enterprise', status: 'Active', seats: 260, mrr: 19200, renewsOn: '2026-12-20' },
  { id: 'acc-20', name: 'Thistledown Farms', plan: 'Starter', status: 'Active', seats: 5, mrr: 320, renewsOn: '2026-08-28' },
  { id: 'acc-21', name: 'Umberglen Legal', plan: 'Growth', status: 'Trial', seats: 12, mrr: 0, renewsOn: '2026-08-16' },
  { id: 'acc-22', name: 'Vantage Point Co', plan: 'Scale', status: 'Active', seats: 47, mrr: 3700, renewsOn: '2026-10-05' },
  { id: 'acc-23', name: 'Willowmere Clinics', plan: 'Enterprise', status: 'Churned', seats: 95, mrr: 0, renewsOn: '2026-07-12' },
  { id: 'acc-24', name: 'Xylo Instruments', plan: 'Growth', status: 'Active', seats: 19, mrr: 1550, renewsOn: '2026-09-22' },
  { id: 'acc-25', name: 'Yellowfin Logistics', plan: 'Scale', status: 'Trial', seats: 10, mrr: 0, renewsOn: '2026-08-11' },
]

// ── the in-session store (PRD-D2/SPEC-N2 — createMemoryStore, no persistKey ⇒ dies with the page) ─────────
export const WORKBENCH_STORE_KEY = 'workbench-accounts'

export function createWorkbenchStore(): SettingsStore {
  return createMemoryStore({ initial: { [WORKBENCH_STORE_KEY]: FIXTURE_RECORDS.map((r) => ({ ...r })) } })
}

export function readWorkbenchRecords(store: SettingsStore): WorkbenchRecord[] {
  const raw = store.get(WORKBENCH_STORE_KEY)
  return Array.isArray(raw) ? (raw as WorkbenchRecord[]) : []
}

export function writeWorkbenchRecords(store: SettingsStore, records: readonly WorkbenchRecord[]): void {
  store.set(
    WORKBENCH_STORE_KEY,
    records.map((r) => ({ ...r })),
  )
}

// ── the matching-set predicate (SPEC-R7's taught "visible results count" mitigation) — mirrors
// ui-table's own filter+search semantics (table.md: filter is bounded-facet AND-across-entries/OR-within-
// values, String-coerced; search is a case-/diacritic-insensitive scan over every `searchable` column's
// rendered text) so the page's own count reads the SAME universe the table renders, computed independently
// (the table exposes no `matchingCount` prop of its own). ──────────────────────────────────────────────
function normalizeSearchText(value: unknown): string {
  return String(value)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLocaleLowerCase()
}

export function computeMatchingCount(records: readonly WorkbenchRecord[], filter: readonly WorkbenchFilterEntry[], search: string): number {
  const needle = normalizeSearchText(search.trim())
  const searchableKeys = WORKBENCH_COLUMNS.filter((c) => c.searchable !== false).map((c) => c.key)
  let count = 0
  for (const record of records) {
    const row = record as unknown as Record<string, unknown>
    const matchesFilter = filter.every((entry) => entry.values.some((v) => String(v) === String(row[entry.key])))
    if (!matchesFilter) continue
    const matchesSearch = needle === '' || searchableKeys.some((key) => normalizeSearchText(row[key]).includes(needle))
    if (!matchesSearch) continue
    count += 1
  }
  return count
}
