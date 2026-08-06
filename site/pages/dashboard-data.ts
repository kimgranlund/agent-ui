// dashboard-data.ts — the Support Dashboard's seeded, in-repo fixture (GH #499, M-F). Mirrors
// workbench-data.ts's shape (the M-A MA-3 precedent this page's whole fixture discipline follows): the
// page's ONLY data source, no fetch, no backend, every field SCALAR (SPEC-N4's workbench rule, carried
// over — a dashboard record needs no to-many field any more than a workbench one did).
//
// ONE deliberate departure from workbench-data.ts, worth stating rather than silently copying: this page
// is READ-ONLY (no record-edit flow, no field ever gets written back), so it owns NO `createMemoryStore` —
// `FIXTURE_RECORDS` below is read directly, never copied into a mutable store. A page earns the store
// machinery only when it genuinely mutates; a passive dashboard doesn't, and reaching for one anyway would
// be exactly the kind of decorative infrastructure the KISS law rules out. The segmented-control priority
// filter (dashboard.ts) is real interactive state, but it lives in a plain module-scope variable, in-memory
// and session-only by construction (no persistence API touched at all) — SPEC-N2's "gone on reload" contract
// holds trivially here, not by a store's explicit no-persistKey configuration.
//
// Every summary number on the page (the four ui-stat tiles + the ui-bar-chart category breakdown) is
// COMPUTED from this one fixture below, never hand-typed twice — the "derive every derivable fact" law
// applied at the page-authoring level: there is no canonical descriptor a demo dashboard's numbers could
// derive from, so the fixture itself is the one hand-authored source, and everything downstream reads it.

export type TicketCategory = 'Billing' | 'Bug' | 'Feature Request' | 'Account' | 'Onboarding'
export type TicketPriority = 'Urgent' | 'High' | 'Normal' | 'Low'
export type TicketStatus = 'Open' | 'Pending' | 'Resolved'

export interface TicketRecord {
  readonly id: string
  subject: string
  category: TicketCategory
  priority: TicketPriority
  status: TicketStatus
  opened: string // ISO date string (YYYY-MM-DD) — a plain scalar, not a Date object (SPEC-N4 precedent)
  assignee: string
  firstResponseMinutes: number
  csat: number // 1-5; 0 = not yet rated (no ticket is left `undefined` — every field stays scalar+present)
}

/** The local mirror of `ui-table`'s `columns` JSON shape — same structural-mirror reasoning as
 *  `workbench-data.ts`'s `WorkbenchColumn` (the type lives inside `@agent-ui/components/controls/table`'s
 *  own internals, not published, so a page needing the shape re-declares it rather than deep-importing). */
export interface TicketColumn {
  key: string
  label: string
  type?: 'string' | 'number'
  sortable?: boolean
  searchable?: boolean
}

/** `ui-table`'s `filter` JSON shape (ADR-0163 cl.2's bounded FACET shape) — same structural mirror as
 *  `workbench-data.ts`'s `WorkbenchFilterEntry`. */
export interface TicketFilterEntry {
  key: string
  values: (string | number)[]
}

// `id` is deliberately NOT a rendered column (the workbench-data.ts WORKBENCH_COLUMNS precedent — rowKey
// names a column whose cell values identify rows; it need not be one of the RENDERED columns).
export const TICKET_COLUMNS: TicketColumn[] = [
  { key: 'subject', label: 'Subject', sortable: true },
  { key: 'category', label: 'Category', sortable: true },
  { key: 'priority', label: 'Priority', sortable: true },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'opened', label: 'Opened', sortable: true },
  { key: 'assignee', label: 'Assignee', sortable: true },
]

export const TICKET_ROW_KEY = 'id'

// The facet column the priority filter drives (dashboard.ts's ui-segmented-control — a DIFFERENT filter
// vehicle from the workbench's ui-form-popover + checkbox group, deliberately: this page's filter is
// single-select-of-three, the shape a joined-segment toggle expresses natively, never a multi-value facet
// aggregation — so it needs none of the workbench's N-commits-into-one-array glue, PRD-D3's residual).
export const PRIORITY_FACET_KEY = 'priority'

// ── the seed — 14 records, deterministic, hand-authored (never randomized, so every gate run computes the
// identical derived stats/breakdown/filtered sets). 2 Urgent + 3 High + 6 Normal + 3 Low — Urgent is the
// dashboard.browser.test.ts narrow-filter exemplar (a genuine, small, real sub-page). ─────────────────────
export const FIXTURE_RECORDS: TicketRecord[] = [
  { id: 'tkt-01', subject: 'Invoice total mismatch after plan change', category: 'Billing', priority: 'Urgent', status: 'Open', opened: '2026-08-01', assignee: 'Priya N.', firstResponseMinutes: 9, csat: 0 },
  { id: 'tkt-02', subject: 'Dashboard chart fails to render on load', category: 'Bug', priority: 'Urgent', status: 'Open', opened: '2026-08-02', assignee: 'Marcus O.', firstResponseMinutes: 6, csat: 0 },
  { id: 'tkt-03', subject: 'Export button unresponsive in Safari', category: 'Bug', priority: 'High', status: 'Pending', opened: '2026-07-30', assignee: 'Priya N.', firstResponseMinutes: 22, csat: 0 },
  { id: 'tkt-04', subject: 'Request: bulk CSV import for accounts', category: 'Feature Request', priority: 'High', status: 'Open', opened: '2026-07-29', assignee: 'Dana W.', firstResponseMinutes: 41, csat: 0 },
  { id: 'tkt-05', subject: 'Cannot remove a seat from Enterprise plan', category: 'Account', priority: 'High', status: 'Resolved', opened: '2026-07-22', assignee: 'Marcus O.', firstResponseMinutes: 18, csat: 5 },
  { id: 'tkt-06', subject: 'Welcome email never arrived after signup', category: 'Onboarding', priority: 'Normal', status: 'Resolved', opened: '2026-07-18', assignee: 'Dana W.', firstResponseMinutes: 35, csat: 4 },
  { id: 'tkt-07', subject: 'Clarify proration on mid-cycle downgrade', category: 'Billing', priority: 'Normal', status: 'Resolved', opened: '2026-07-15', assignee: 'Priya N.', firstResponseMinutes: 47, csat: 5 },
  { id: 'tkt-08', subject: 'Typo in the onboarding checklist copy', category: 'Onboarding', priority: 'Normal', status: 'Resolved', opened: '2026-07-12', assignee: 'Dana W.', firstResponseMinutes: 60, csat: 4 },
  { id: 'tkt-09', subject: 'Sort order resets after page refresh', category: 'Bug', priority: 'Normal', status: 'Pending', opened: '2026-07-28', assignee: 'Marcus O.', firstResponseMinutes: 29, csat: 0 },
  { id: 'tkt-10', subject: 'Request: dark theme for the report view', category: 'Feature Request', priority: 'Normal', status: 'Open', opened: '2026-07-31', assignee: 'Dana W.', firstResponseMinutes: 53, csat: 0 },
  { id: 'tkt-11', subject: 'Second admin seat shows wrong role', category: 'Account', priority: 'Normal', status: 'Resolved', opened: '2026-07-09', assignee: 'Priya N.', firstResponseMinutes: 31, csat: 3 },
  { id: 'tkt-12', subject: 'Confirm data retention policy wording', category: 'Account', priority: 'Low', status: 'Resolved', opened: '2026-07-05', assignee: 'Marcus O.', firstResponseMinutes: 74, csat: 5 },
  { id: 'tkt-13', subject: 'Suggest an in-app keyboard shortcut list', category: 'Feature Request', priority: 'Low', status: 'Open', opened: '2026-08-03', assignee: 'Dana W.', firstResponseMinutes: 88, csat: 0 },
  { id: 'tkt-14', subject: 'Onboarding tour skips the billing step', category: 'Onboarding', priority: 'Low', status: 'Pending', opened: '2026-07-27', assignee: 'Priya N.', firstResponseMinutes: 65, csat: 0 },
]

// ── derived stats (the four ui-stat tiles) — every number computed from FIXTURE_RECORDS, never re-typed ──

export interface DashboardStats {
  readonly openCount: number
  readonly avgFirstResponseMinutes: number
  readonly avgCsat: number
  readonly ratedCount: number
  readonly activeAgentCount: number
}

/** "Open" here means "still in the queue" — Open OR Pending, never Resolved (the same posture a real
 *  support-queue KPI tile reports: work not yet closed out, regardless of whether anyone has touched it). */
export function computeDashboardStats(records: readonly TicketRecord[]): DashboardStats {
  const openCount = records.filter((r) => r.status !== 'Resolved').length
  const avgFirstResponseMinutes = Math.round(records.reduce((sum, r) => sum + r.firstResponseMinutes, 0) / records.length)
  const rated = records.filter((r) => r.csat > 0)
  const avgCsat = rated.length === 0 ? 0 : Math.round((rated.reduce((sum, r) => sum + r.csat, 0) / rated.length) * 10) / 10
  const activeAgentCount = new Set(records.map((r) => r.assignee)).size
  return { openCount, avgFirstResponseMinutes, avgCsat, ratedCount: rated.length, activeAgentCount }
}

// ── derived chart data (the ui-bar-chart category breakdown) — an all-positive magnitude comparison (the
// bar-chart-doc.ts REVENUE_BY_REGION model: every bar measures from one zero-baseline at the inline-start
// edge — no mixed-sign diverging series here, ADR-0107's simpler admitted shape), computed by counting
// FIXTURE_RECORDS per category, in the category's own declared order (never sorted by count — the same
// "a breakdown reads by category identity, not by rank" posture the doc page's own exemplar uses). ────────

export interface CategoryCount {
  readonly label: string
  readonly value: number
}

const CATEGORY_ORDER: readonly TicketCategory[] = ['Billing', 'Bug', 'Feature Request', 'Account', 'Onboarding']

export function computeCategoryBreakdown(records: readonly TicketRecord[]): CategoryCount[] {
  return CATEGORY_ORDER.map((category) => ({
    label: category,
    value: records.filter((r) => r.category === category).length,
  }))
}
