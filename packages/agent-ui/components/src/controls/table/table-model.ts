// table-model.ts — the pure, DOM-free table math (LLD-C1, report-family.lld.md §2; ADR-0163 the interactive
// widening). No DOM, no host, unit-testable in plain Node/Vitest. Owns (the bar-math/sparkline-math
// precedent — the in-folder pure-core split, ADR-0111 cl.8):
//
//   1. Input hardening (`cleanColumns`/`cleanRows`, SPEC-R3 rows 1/3/4/5): a non-array input is `[]`; a
//      column entry survives only as a plain object with a `string` `key` AND a `string` `label` — `type`
//      is NORMALIZED ('number' kept, anything else incl. an unknown string → 'string'), never dropping the
//      column over a bad `type`; `sortable`/`searchable` (ADR-0163 cl.5/cl.2, the column-schema widening)
//      are likewise NORMALIZED to real booleans (`sortable` default `false`, `searchable` default `true`),
//      never dropping the column. A row entry survives only as a plain object (non-null, non-array) — cell
//      VALUES are not judged here, that is `resolveCell`'s per-cell job (structural validity only, SPEC §2).
//      Both drop, never coerce; order is preserved (positional — SPEC-R3 row 12's duplicate-key case).
//   2. Cell resolution (`resolveCell`, SPEC-R3 rows 6-11): the pure mapping `(column, row) → rendered cell
//      text`, covering every value-degenerate case. NEVER throws. Alignment is NOT decided here — it is
//      COLUMN-driven (the `data-type='number'` attribute the element sets from `column.type`, LLD-C3) —
//      this function only decides the printed TEXT, which is VALUE-driven.
//   3. `formatNumber` — a module-memoized default-locale `Intl.NumberFormat` (the chart-family printed-value
//      precedent, bar-math.ts/sparkline-math.ts).
//   4. `tableColumnsProp`/`tableRowsProp`, the safe JSON codecs (SPEC-R1 AC3): `from(null)` (attribute
//      absent/removed) is `[]`, NEVER `null`; malformed attribute JSON is caught and also falls back to
//      `[]` — no throw ever reaches `attributeChangedCallback`. `dom/props.ts`'s generic `jsonType<T>()` is
//      deliberately NOT used — its bare `JSON.parse` throws on malformed attributes and maps a removed
//      attribute to `null`, both of which SPEC-R1 forbids reaching the render path (the exact reasoning
//      bar-math.ts's `barDataProp` states for its own codec — the chart-family construction, reused here).
//   5. ADR-0163 cl.4/cl.5/cl.2/cl.6 — selection identity, sort comparator, filter/search predicates, and the
//      cl.7 VIEW PIPELINE (`computeTableView`): rendered set → facet `filter` → `search` → `sort` (when
//      non-null) → page window (when `pageSize > 0`). Pure, DOM-free, unit-testable exactly like the rest of
//      this file — `table.ts` calls `computeTableView` once per relevant prop change and stamps its result.
//   6. `selectedProp`/`sortProp`/`filterProp`, the safe JSON codecs for the three new bindable state props —
//      the SAME never-throwing discipline as `tableColumnsProp`/`tableRowsProp` (`selected`/`filter` are
//      array-hardened; `sort` follows the sandbox-frame `cspConfigProp` shape: `from(null) → null`, a
//      malformed JSON string also falls back to `null`, and a well-formed-but-wrong-shaped JSON value is
//      hardened to `null` too, but ONLY after JSON.parse succeeds — kindOf's classification probe
//      (`component-descriptor.ts`) needs `from('"x"')` to pass a valid JSON STRING through unhardened for the
//      codec to classify as `json`; hardening a `sort`-shaped OBJECT still happens, just not a bare string).

import type { PropConfig, PropType } from '../../dom/props.ts'

/** One table column — the SAME shape serves both the public input contract (SPEC-R1: `type` is optional,
 *  defaulting to `'string'`) and the rendered-set (post-`cleanColumns`, `type`/`sortable`/`searchable` are
 *  always POPULATED — a runtime invariant `cleanColumns` guarantees, not one TS enforces, so a caller may
 *  omit any of the three and still satisfy this interface). A valid `key`/`label` string pair; `type`
 *  NORMALIZED to a member of the closed set when present. `sortable` (ADR-0163 cl.5, default `false`) opts
 *  the column into a stamped sort-header `<button>`. `searchable` (ADR-0163 cl.2, default `true`) opts the
 *  column INTO the `search` prop's rendered-text scan — the one column-schema field whose ABSENT state is
 *  "included", not "excluded" (an opt-OUT, unlike `sortable`'s opt-in). */
export interface TableColumn {
  key: string
  label: string
  type?: 'string' | 'number'
  sortable?: boolean
  searchable?: boolean
}

/** One row's SORT state (ADR-0163 cl.5): the sorted column's key + the `aria-sort` vocabulary direction
 *  (deliberately reused verbatim — no translation table). `null` ⇒ no sort applied (the default, off). */
export interface TableSort {
  key: string
  direction: 'ascending' | 'descending'
}

/** One FACET filter entry (ADR-0163 cl.2): a row survives when its raw cell value for `key` String-coerced-
 *  equals one of `values` — AND across entries, OR within one entry's `values`. */
export interface TableFilterEntry {
  key: string
  values: (string | number)[]
}

/** A row paired with its SELECTION IDENTITY (ADR-0163 cl.4): the `row-key` column's String-coerced cell
 *  value when present on that row, else the row's DATA-ORDER index (also String-coerced) — computed against
 *  the WHOLE, unfiltered `rows` array, so identity is stable across a view transform (filter/search/sort/
 *  page) but NOT across a `rows` swap (the documented residual; `row-key` is the recommended posture). */
export interface IdentifiedRow {
  row: TableRow
  id: string
}

/** One table row — a structurally valid record (SPEC §2): a plain, non-null, non-array object. Cell
 *  VALUES are unconstrained here (`string | number | null | undefined | unknown`) — `resolveCell` is the
 *  only place a value is judged. Never positional (fork F1) — cells resolve by `column.key` lookup. */
export type TableRow = Record<string, unknown>

/** A plain, non-null, non-array object — the structural test both `cleanColumns` and `cleanRows` share. */
function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

/**
 * Harden an arbitrary input into the rendered column set (SPEC-R3 rows 1/3/4; ADR-0163 cl.5/cl.2's schema
 * widening): a non-array input yields `[]`; each entry survives only as a plain object with a `string` `key`
 * AND a `string` `label` — dropped, never coerced (SPEC-R3 row 3). `type` is NORMALIZED, never a drop
 * reason: `'number'` is kept as-is, anything else (absent, or an unknown string — SPEC-R3 row 4) becomes
 * `'string'`. `sortable` NORMALIZES to a real boolean (`true` only when the input is literally `true`, else
 * `false` — the opt-IN default). `searchable` NORMALIZES to a real boolean the OTHER way (`false` only when
 * the input is literally `false`, else `true` — the opt-OUT default, ADR-0163 cl.2's "a column opts out via
 * `searchable?: boolean` (default `true`)"). Order preserved (positional — duplicate keys both survive,
 * SPEC-R3 row 12).
 */
export function cleanColumns(input: unknown): TableColumn[] {
  if (!Array.isArray(input)) return []
  const out: TableColumn[] = []
  for (const entry of input) {
    if (!isPlainObject(entry)) continue
    const key = entry.key
    const label = entry.label
    if (typeof key !== 'string' || typeof label !== 'string') continue
    out.push({
      key,
      label,
      type: entry.type === 'number' ? 'number' : 'string',
      sortable: entry.sortable === true,
      searchable: entry.searchable !== false,
    })
  }
  return out
}

/**
 * Harden an arbitrary input into the rendered row set (SPEC-R3 row 5): a non-array input yields `[]`; each
 * entry survives only as a plain object (non-null, non-array) — dropped, never coerced. Cell values are
 * NOT inspected here (structural validity only, SPEC §2) — `resolveCell` judges each cell at render time.
 * Order preserved (positional).
 */
export function cleanRows(input: unknown): TableRow[] {
  if (!Array.isArray(input)) return []
  const out: TableRow[] = []
  for (const entry of input) {
    if (isPlainObject(entry)) out.push(entry)
  }
  return out
}

/** Module-memoized default-locale formatter — the exact text every finite-number cell prints (SPEC-R3 row 10). */
const numberFormat = new Intl.NumberFormat()

/** Format a finite number via the shared, memoized `Intl.NumberFormat` (default locale). */
export function formatNumber(v: number): string {
  return numberFormat.format(v)
}

/** The defined "present but unrepresentable" placeholder (SPEC §2) — U+2014 EM DASH, never the strings
 *  `NaN`/`Infinity`/`-Infinity`. */
const PLACEHOLDER = '—'

/**
 * The SPEC-R3 cell-resolution table (rows 6-11), as one pure, NEVER-throwing function: absent/missing key/
 * `undefined`/`null` → `''` (the empty cell, rows 6/7) · a finite `number` (ANY column type — row 10, value-
 * driven, never column-gated) → `formatNumber` · a non-finite `number` (`NaN`/`±Infinity`, row 8) → the `—`
 * placeholder · a `string` (row 9, incl. a type-mismatched string in a `type:'number'` column) → verbatim,
 * uncoerced · anything else — `boolean`/`object`/`array` (row 11, a foreign-typed cell) → `''`, the value
 * dropped, the row survives. Alignment is NEVER decided here — it is column-driven (LLD-C2/C3).
 */
export function resolveCell(column: TableColumn, row: TableRow): string {
  const value = row[column.key]
  if (value === undefined || value === null) return ''
  if (typeof value === 'number') return Number.isFinite(value) ? formatNumber(value) : PLACEHOLDER
  if (typeof value === 'string') return value
  return '' // boolean / object / array — a foreign-typed cell value, dropped (the row survives)
}

// ── ADR-0163 cl.4 — selection identity ─────────────────────────────────────────────────────────────────

/** The data-order-index fallback identity's namespace prefix (component-checker low-priority finding): a
 *  BARE `String(i)` risks colliding with an explicitly-keyed row's own string value (e.g. a keyed row-key
 *  `"3"` vs. an unrelated unkeyed row that happens to sit at index 3) — both would carry the identity `"3"`
 *  and become indistinguishable in `selected`. `#` can never be the START of a real `row[rowKey]` cell value
 *  once `String()`-coerced from JSON's own primitive set (numbers/strings/booleans never begin with `#`),
 *  so this namesplits the two identity SOURCES without touching the `row-key` posture the ADR documents
 *  (still fallback-to-index, just spelled unambiguously). */
const INDEX_ID_PREFIX = '#'

/**
 * Pair every row in `rows` (the WHOLE, unfiltered array — identity is computed against data order, never
 * the view-transformed order) with its selection identity (cl.4): the `rowKey` column's String-coerced cell
 * value when `rowKey` is non-empty AND the row actually carries that key (own or inherited property look-up,
 * matching `resolveCell`'s plain `row[key]` read), else the row's own array INDEX, String-coerced and
 * `INDEX_ID_PREFIX`-namespaced (never colliding with a real keyed value). Never throws — `String()` on any
 * value succeeds.
 */
export function computeRowIdentities(rows: TableRow[], rowKey: string): IdentifiedRow[] {
  return rows.map((row, i) => {
    const keyed = rowKey !== '' ? row[rowKey] : undefined
    const id = keyed !== undefined && keyed !== null ? String(keyed) : `${INDEX_ID_PREFIX}${i}`
    return { row, id }
  })
}

/**
 * Harden an arbitrary `selected` input into a string array (the `selected` prop's property-write guard,
 * the `cleanColumns`/`cleanRows` sibling rule): a non-array input yields `[]`; a non-string entry is
 * dropped, never coerced. Order preserved; duplicates are NOT deduped here (a defensive read, not a
 * normalizer — `table.ts`'s own toggle/select-all logic never introduces one).
 */
export function cleanSelected(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  return input.filter((v): v is string => typeof v === 'string')
}

// ── ADR-0163 cl.2 — filter (facet) + search ────────────────────────────────────────────────────────────

/**
 * Harden an arbitrary `filter` input into the rendered facet-entry set: a non-array input yields `[]`; an
 * entry survives only as a plain object with a `string` `key` and an ARRAY `values` whose members are all
 * `string`/`number` (a non-conforming `values` member drops the WHOLE entry, never partially coerced — the
 * facet shape is bounded by construction, cl.1/cl.2). Order preserved.
 */
export function cleanFilter(input: unknown): TableFilterEntry[] {
  if (!Array.isArray(input)) return []
  const out: TableFilterEntry[] = []
  for (const entry of input) {
    if (!isPlainObject(entry)) continue
    const key = entry.key
    const values = entry.values
    if (typeof key !== 'string' || !Array.isArray(values)) continue
    if (!values.every((v) => typeof v === 'string' || typeof v === 'number')) continue
    out.push({ key, values: values as (string | number)[] })
  }
  return out
}

/** A row survives a facet `filter` when, for EVERY entry, its raw cell value for `entry.key` String-coerced-
 *  equals one of `entry.values` (AND across entries, OR within one entry — ADR-0163 cl.2). An empty `filter`
 *  array is the identity function (every row survives) — zero stamped anatomy, SPEC-R2/cl.10. */
export function matchesFilter(row: TableRow, filter: TableFilterEntry[]): boolean {
  return filter.every((entry) => entry.values.some((v) => String(row[entry.key]) === String(v)))
}

/** The `search` fold (ADR-0163 cl.2): `normalize('NFKD')` + strip combining marks (U+0300–U+036F) +
 *  `toLocaleLowerCase` — case- AND diacritic-insensitive, applied to BOTH the needle and every haystack
 *  (`resolveCell` output — "search what you see"). */
const COMBINING_MARKS = /[̀-ͯ]/g // Unicode "Combining Diacritical Marks" block — stripped post-NFKD

export function foldSearchText(s: string): string {
  return s.normalize('NFKD').replace(COMBINING_MARKS, '').toLocaleLowerCase()
}

/** A row survives `search` when the folded needle is a substring of AT LEAST ONE searchable column's folded,
 *  RENDERED cell text (`resolveCell` — the Intl-formatted `42,000` matches `42,0`, ADR-0163 cl.2). An empty
 *  `search` string is the identity function (every row survives, no fold work performed — SPEC-R2/cl.10). A
 *  column opts out via `searchable: false` (post-`cleanColumns`, default `true`). */
export function matchesSearch(row: TableRow, columns: TableColumn[], search: string): boolean {
  if (search === '') return true
  const needle = foldSearchText(search)
  return columns.some((col) => col.searchable !== false && foldSearchText(resolveCell(col, row)).includes(needle))
}

// ── ADR-0163 cl.5 — sort ────────────────────────────────────────────────────────────────────────────────

/** Harden an arbitrary `sort` input into the live shape or `null` (the property-write guard — the codec
 *  below deliberately does NOT do this, see its own comment): anything that is not a plain object with a
 *  `string` `key` and `direction` ∈ `'ascending'|'descending'` becomes `null` (no sort applied). */
export function cleanSort(input: unknown): TableSort | null {
  if (!isPlainObject(input)) return null
  const key = input.key
  const direction = input.direction
  if (typeof key !== 'string' || (direction !== 'ascending' && direction !== 'descending')) return null
  return { key, direction }
}

/** A cell counts as SORT-degenerate (sorts last, both directions — ADR-0163 cl.5) when: the column is
 *  `type:'number'` and the raw value is not a finite number (covers missing/null/NaN/±Infinity AND a
 *  type-mismatched non-number value, which cannot be compared numerically); or the column is NOT `number`
 *  and its `resolveCell` text is the empty string (covers missing/null/foreign-typed AND a genuinely empty
 *  string cell — "empty" per the ADR text). */
function isDegenerateForSort(column: TableColumn, row: TableRow): boolean {
  if (column.type === 'number') {
    const value = row[column.key]
    return typeof value !== 'number' || !Number.isFinite(value)
  }
  return resolveCell(column, row) === ''
}

/**
 * Build the row comparator for the current `sort` state (ADR-0163 cl.5), or `null` when `sort` is absent,
 * names a column not in `columns`, OR names a column whose `sortable` is NOT `true` (component-checker
 * finding: a programmatically-bound `sort` naming a non-sortable column previously still reordered rows
 * while `#applyAriaSort` correctly refused to announce it — a silent, unannounced reorder; the affordance
 * and the effect must gate on the SAME condition, `sortable`). Number columns compare numerically; every
 * other column compares via a numeric-aware `Intl.Collator` (default locale). Degenerate cells (see
 * `isDegenerateForSort`) sort LAST in BOTH directions (a fixed post-direction tie-break, not flipped by
 * `direction`). `Array.prototype.sort` is STABLE (ES2019+) — ties among non-degenerate cells with equal
 * comparator output preserve relative input order.
 */
export function makeRowComparator(sort: TableSort | null, columns: TableColumn[]): ((a: IdentifiedRow, b: IdentifiedRow) => number) | null {
  if (sort === null) return null
  const column = columns.find((c) => c.key === sort.key)
  if (!column || !column.sortable) return null
  const dir = sort.direction === 'descending' ? -1 : 1
  const collator = new Intl.Collator(undefined, { numeric: true })
  return (a, b) => {
    const aDeg = isDegenerateForSort(column, a.row)
    const bDeg = isDegenerateForSort(column, b.row)
    if (aDeg && bDeg) return 0
    if (aDeg) return 1
    if (bDeg) return -1
    if (column.type === 'number') return dir * ((a.row[column.key] as number) - (b.row[column.key] as number))
    return dir * collator.compare(String(a.row[column.key]), String(b.row[column.key]))
  }
}

// ── ADR-0163 cl.6/cl.7 — pagination consumption + the view pipeline ───────────────────────────────────────

/** The inputs the cl.7 view pipeline reads — every one of `table.ts`'s state props, at their CURRENT
 *  (already-hardened, via the matching `clean*` function) value. */
export interface TableViewInput {
  rows: TableRow[]
  columns: TableColumn[]
  rowKey: string
  filter: TableFilterEntry[]
  search: string
  sort: TableSort | null
  pageSize: number
  page: number
}

/** The cl.7 pipeline's result: `matching` (the MATCHING SET — after filter AND search, before sort/page;
 *  the universe select-all / the header checkbox state / `pageCount` are all computed against, cl.7),
 *  `sorted` (`matching` after the sort comparator, or `matching` unchanged when `sort` is `null`), `paged`
 *  (`sorted` windowed by `pageSize`/`page`, or `sorted` unchanged when `pageSize <= 0`), and `pageCount`
 *  (`0` when pagination is off or the matching set is empty; else `ceil(matching.length / pageSize)`). */
export interface TableView {
  matching: IdentifiedRow[]
  sorted: IdentifiedRow[]
  paged: IdentifiedRow[]
  pageCount: number
}

/**
 * The ADR-0163 cl.7 view pipeline, as one pure function: rendered set (identity-tagged) → facet `filter` →
 * `search` → `sort` (when non-null) → page window (when `pageSize > 0`). Every stage is the identity
 * function at its capability's OFF default (empty `filter`, empty `search`, `null` sort, `pageSize <= 0`) —
 * SPEC-R2/cl.10's byte-identity proof composes from this pipeline being a true no-op at defaults, not a
 * special-cased bypass.
 */
export function computeTableView(input: TableViewInput): TableView {
  const identified = computeRowIdentities(input.rows, input.rowKey)
  const matching = identified.filter((ir) => matchesFilter(ir.row, input.filter) && matchesSearch(ir.row, input.columns, input.search))
  const comparator = makeRowComparator(input.sort, input.columns)
  const sorted = comparator ? [...matching].sort(comparator) : matching
  const pageCount = input.pageSize > 0 && matching.length > 0 ? Math.ceil(matching.length / input.pageSize) : 0
  if (input.pageSize <= 0) return { matching, sorted, paged: sorted, pageCount: 0 }
  const effectivePage = Math.min(Math.max(1, Math.trunc(input.page) || 1), Math.max(1, pageCount))
  const start = (effectivePage - 1) * input.pageSize
  return { matching, sorted, paged: sorted.slice(start, start + input.pageSize), pageCount }
}

/**
 * The safe `columns`/`rows` codec (SPEC-R1 AC3): `from(null)` (the attribute absent/removed) → `[]`, never
 * `null`; malformed attribute JSON is caught and also falls back to `[]` — no throw ever reaches
 * `attributeChangedCallback`. Every parsed value (well-formed or not) is run through the matching hardening
 * function, so the property never carries a raw, un-hardened array (the codec and the SPEC-R3 case-3
 * property-write guard — table.ts's effects call `cleanColumns`/`cleanRows` again — share the one hardening
 * function each).
 */
function safeJsonCodec<T>(clean: (input: unknown) => T[]): PropType<T[]> {
  return {
    from(attr) {
      if (attr === null) return []
      try {
        return clean(JSON.parse(attr))
      } catch {
        return []
      }
    },
    to(value) {
      return JSON.stringify(value)
    },
  }
}

export const tableColumnsProp: PropConfig<TableColumn[]> = {
  type: safeJsonCodec(cleanColumns),
  default: [],
}

export const tableRowsProp: PropConfig<TableRow[]> = {
  type: safeJsonCodec(cleanRows),
  default: [],
}

/** The `selected`/`filter` array-hardened codec (ADR-0163 cl.4/cl.2) — the SAME `safeJsonCodec` shape as
 *  `tableColumnsProp`/`tableRowsProp`: `from(null) → []`, malformed JSON → `[]`, never throws. NOT reflected
 *  (bindable view/selection state, not an authored dimension). */
export const tableSelectedProp: PropConfig<string[]> = {
  type: safeJsonCodec(cleanSelected),
  default: [],
}

export const tableFilterProp: PropConfig<TableFilterEntry[]> = {
  type: safeJsonCodec(cleanFilter),
  default: [],
}

/**
 * The `sort` codec (ADR-0163 cl.5) — the sandbox-frame `cspConfigProp` shape (`sandbox-frame.ts`), NOT the
 * array-hardened shape above: `from(null) → null` (the real "no sort" default, attribute absent/removed); a
 * WELL-FORMED JSON value — of ANY shape, incl. the wrong one — passes through UNHARDENED (load-bearing for
 * the descriptor↔props trip-wire's `kindOf` classification, `component-descriptor.ts`: its `json`-detection
 * probe calls `from('"x"')` and requires the codec to return `'x'` UNCHANGED). A malformed/unparseable
 * attribute string falls back to `undefined` — deliberately NOT `null` (a second `from(null)`-shaped
 * sentinel would falsely satisfy `kindOf`'s NUMBER-codec probe, which checks `from('') === null`; the exact
 * bug the sandbox-frame precedent's own comment names — "clamping...broke kindOf's classification"). Shape
 * hardening (rejecting anything that isn't really `{key, direction}`) happens ONCE, downstream, at the point
 * of use (`cleanSort`, called by every `table.ts` effect that reads `this.sort` — the SAME codec/effect
 * division of labour `cleanColumns`/`cleanRows` already establish for `columns`/`rows`). NOT reflected
 * (bindable sort state).
 */
export const tableSortProp: PropConfig<TableSort | null> = {
  type: {
    from(attr) {
      if (attr === null) return null
      try {
        return JSON.parse(attr) as TableSort
      } catch {
        return undefined as unknown as TableSort
      }
    },
    to(value) {
      return JSON.stringify(value)
    },
  },
  default: null,
}
