// table-model.ts — the pure, DOM-free table math (LLD-C1, report-family.lld.md §2). No DOM, no host,
// unit-testable in plain Node/Vitest. Owns four things (the bar-math/sparkline-math precedent — the
// in-folder pure-core split, ADR-0111 cl.8):
//
//   1. Input hardening (`cleanColumns`/`cleanRows`, SPEC-R3 rows 1/3/4/5): a non-array input is `[]`; a
//      column entry survives only as a plain object with a `string` `key` AND a `string` `label` — `type`
//      is NORMALIZED ('number' kept, anything else incl. an unknown string → 'string'), never dropping the
//      column over a bad `type`. A row entry survives only as a plain object (non-null, non-array) — cell
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

import type { PropConfig, PropType } from '../../dom/props.ts'

/** One table column — the SAME shape serves both the public input contract (SPEC-R1: `type` is optional,
 *  defaulting to `'string'`) and the rendered-set (post-`cleanColumns`, `type` is always POPULATED — a
 *  runtime invariant `cleanColumns` guarantees, not one TS enforces, so a caller may omit `type` and still
 *  satisfy this interface). A valid `key`/`label` string pair; `type` NORMALIZED to a member of the closed
 *  set when present. */
export interface TableColumn {
  key: string
  label: string
  type?: 'string' | 'number'
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
 * Harden an arbitrary input into the rendered column set (SPEC-R3 rows 1/3/4): a non-array input yields
 * `[]`; each entry survives only as a plain object with a `string` `key` AND a `string` `label` — dropped,
 * never coerced (SPEC-R3 row 3). `type` is NORMALIZED, never a drop reason: `'number'` is kept as-is,
 * anything else (absent, or an unknown string — SPEC-R3 row 4) becomes `'string'`. Order preserved
 * (positional — duplicate keys both survive, SPEC-R3 row 12).
 */
export function cleanColumns(input: unknown): TableColumn[] {
  if (!Array.isArray(input)) return []
  const out: TableColumn[] = []
  for (const entry of input) {
    if (!isPlainObject(entry)) continue
    const key = entry.key
    const label = entry.label
    if (typeof key !== 'string' || typeof label !== 'string') continue
    out.push({ key, label, type: entry.type === 'number' ? 'number' : 'string' })
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
