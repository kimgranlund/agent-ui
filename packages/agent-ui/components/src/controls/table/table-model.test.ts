import { describe, it, expect } from 'vitest'
import {
  cleanColumns,
  cleanRows,
  resolveCell,
  formatNumber,
  tableColumnsProp,
  tableRowsProp,
  computeRowIdentities,
  makeRowComparator,
  computeTableView,
  type TableColumn,
  type TableRow,
} from './table-model.ts'

// table-model.test.ts — the pure-math unit probes (LLD-C1, report-family.lld.md §2/§8/§9; ADR-0163). DOM-
// free: every SPEC-R3 row (1-14) as a table-driven case, the safe-codec round-trips, and the ADR-0163
// widening's own pure math (identity/filter/search/sort/the view pipeline) further down this file.

/** A post-`cleanColumns` column at the sortable/searchable DEFAULTS (false/true) — the repeated shape every
 *  pre-existing hardening assertion below now carries (ADR-0163 cl.5/cl.2's schema widening). */
const col = (key: string, label: string, type: 'string' | 'number' = 'string'): TableColumn => ({
  key,
  label,
  type,
  sortable: false,
  searchable: true,
})

describe('cleanColumns — input hardening (SPEC-R3 rows 1/3/4)', () => {
  it('a non-array input (object, string, number, null, undefined) → []', () => {
    expect(cleanColumns(undefined)).toEqual([])
    expect(cleanColumns(null)).toEqual([])
    expect(cleanColumns('nope')).toEqual([])
    expect(cleanColumns(42)).toEqual([])
    expect(cleanColumns({ key: 'a', label: 'A' })).toEqual([]) // an object, not wrapped in an array
  })

  it('[] → []', () => {
    expect(cleanColumns([])).toEqual([])
  })

  it('drops an invalid column entry (non-object, missing/non-string key or label) — never coerces (row 3)', () => {
    const input = [
      { key: 'region', label: 'Region' },
      { key: 'revenue' }, // missing label
      { label: 'No key' }, // missing key
      { key: 42, label: 'Bad key' }, // non-string key
      { key: 'bad-label', label: 42 }, // non-string label
      null,
      undefined,
      'string-entry',
      42,
      ['array-entry'],
      { key: 'ok2', label: 'OK 2' },
    ]
    expect(cleanColumns(input)).toEqual([col('region', 'Region'), col('ok2', 'OK 2')])
  })

  it('an unknown/absent `type` normalizes to "string", never dropping the column (row 4)', () => {
    expect(cleanColumns([{ key: 'a', label: 'A' }])).toEqual([col('a', 'A')])
    expect(cleanColumns([{ key: 'a', label: 'A', type: 'bogus' }])).toEqual([col('a', 'A')])
    expect(cleanColumns([{ key: 'a', label: 'A', type: 42 }])).toEqual([col('a', 'A')])
  })

  it('`type: "number"` is kept as-is', () => {
    expect(cleanColumns([{ key: 'revenue', label: 'Revenue', type: 'number' }])).toEqual([
      col('revenue', 'Revenue', 'number'),
    ])
  })

  it('duplicate column keys both survive, positional not keyed (row 12)', () => {
    const input = [
      { key: 'x', label: 'First X' },
      { key: 'x', label: 'Second X' },
    ]
    expect(cleanColumns(input)).toEqual([col('x', 'First X'), col('x', 'Second X')])
  })

  it('`sortable`/`searchable` normalize to real booleans (ADR-0163 cl.5/cl.2) — sortable opts IN (default false), searchable opts OUT (default true)', () => {
    expect(cleanColumns([{ key: 'a', label: 'A' }])[0]).toMatchObject({ sortable: false, searchable: true })
    expect(cleanColumns([{ key: 'a', label: 'A', sortable: true }])[0]).toMatchObject({ sortable: true })
    expect(cleanColumns([{ key: 'a', label: 'A', sortable: 'yes' }])[0]).toMatchObject({ sortable: false }) // truthy-but-not-literal-true never coerces
    expect(cleanColumns([{ key: 'a', label: 'A', searchable: false }])[0]).toMatchObject({ searchable: false })
    expect(cleanColumns([{ key: 'a', label: 'A', searchable: 0 }])[0]).toMatchObject({ searchable: true }) // falsy-but-not-literal-false never coerces
  })

  it('preserves order', () => {
    const input = [{ key: 'c', label: 'C' }, { key: 'a', label: 'A' }, { key: 'b', label: 'B' }]
    expect(cleanColumns(input).map((c) => c.key)).toEqual(['c', 'a', 'b'])
  })
})

describe('cleanRows — input hardening (SPEC-R3 row 5)', () => {
  it('a non-array input → []', () => {
    expect(cleanRows(undefined)).toEqual([])
    expect(cleanRows(null)).toEqual([])
    expect(cleanRows('nope')).toEqual([])
    expect(cleanRows(42)).toEqual([])
    expect(cleanRows({ region: 'EMEA' })).toEqual([]) // an object, not wrapped in an array
  })

  it('[] → []', () => {
    expect(cleanRows([])).toEqual([])
  })

  it('drops an invalid row entry (non-object, null, array) — structural validity only (row 5)', () => {
    const input = [{ region: 'EMEA', revenue: 42000 }, null, ['array-entry'], 'string-entry', 42, { region: 'APAC', revenue: 31000 }]
    expect(cleanRows(input)).toEqual([
      { region: 'EMEA', revenue: 42000 },
      { region: 'APAC', revenue: 31000 },
    ])
  })

  it('cell VALUES are not judged here — a row with degenerate cell values still survives structurally', () => {
    expect(cleanRows([{ region: 'EMEA', revenue: Number.NaN }])).toEqual([{ region: 'EMEA', revenue: Number.NaN }])
    expect(cleanRows([{ region: 'EMEA', revenue: null }])).toEqual([{ region: 'EMEA', revenue: null }])
  })

  it('ragged records (extra keys no column names) survive structurally — columns select, rows never widen (row 13)', () => {
    expect(cleanRows([{ region: 'EMEA', revenue: 42000, extra: 'unused' }])).toEqual([
      { region: 'EMEA', revenue: 42000, extra: 'unused' },
    ])
  })

  it('preserves order', () => {
    const input = [{ region: 'c' }, { region: 'a' }, { region: 'b' }]
    expect(cleanRows(input).map((r) => r.region)).toEqual(['c', 'a', 'b'])
  })
})

describe('resolveCell — the SPEC-R3 cell-resolution table (rows 6-11), never throws', () => {
  const stringCol: TableColumn = { key: 'region', label: 'Region', type: 'string' }
  const numberCol: TableColumn = { key: 'revenue', label: 'Revenue', type: 'number' }

  it('row 6: missing key in the row → empty cell', () => {
    expect(resolveCell(numberCol, {})).toBe('')
    expect(resolveCell(numberCol, { other: 1 })).toBe('')
  })

  it('row 7: null cell value → empty cell', () => {
    expect(resolveCell(numberCol, { revenue: null })).toBe('')
    expect(resolveCell(stringCol, { region: null })).toBe('')
  })

  it('row 8: non-finite number (NaN / +Infinity / -Infinity) → the "—" placeholder, never the strings NaN/Infinity', () => {
    expect(resolveCell(numberCol, { revenue: Number.NaN })).toBe('—')
    expect(resolveCell(numberCol, { revenue: Number.POSITIVE_INFINITY })).toBe('—')
    expect(resolveCell(numberCol, { revenue: Number.NEGATIVE_INFINITY })).toBe('—')
  })

  it('row 9: a string in a type:"number" column renders verbatim, never coerced', () => {
    expect(resolveCell(numberCol, { revenue: 'n/a' })).toBe('n/a')
    expect(resolveCell(numberCol, { revenue: '42000' })).toBe('42000') // NOT Intl-formatted — it is a string, not a number
  })

  it('row 10: a finite number renders Intl-formatted — value-driven, any column type (incl. a STRING column)', () => {
    expect(resolveCell(numberCol, { revenue: 42000 })).toBe(new Intl.NumberFormat().format(42000))
    expect(resolveCell(stringCol, { region: 12345 })).toBe(new Intl.NumberFormat().format(12345)) // a number in a string column still formats
  })

  it('row 9 (string, normal case): a plain string cell in a string column renders verbatim', () => {
    expect(resolveCell(stringCol, { region: 'EMEA' })).toBe('EMEA')
  })

  it('row 11: a foreign-typed cell value (boolean/object/array) → empty cell, the row survives', () => {
    expect(resolveCell(numberCol, { revenue: true })).toBe('')
    expect(resolveCell(numberCol, { revenue: {} })).toBe('')
    expect(resolveCell(numberCol, { revenue: [1, 2] })).toBe('')
  })

  it('the exact SPEC-R3 AC2 four-cell strip: [42000, "n/a", NaN, null] over a number column', () => {
    expect(resolveCell(numberCol, { revenue: 42000 })).toBe(new Intl.NumberFormat().format(42000))
    expect(resolveCell(numberCol, { revenue: 'n/a' })).toBe('n/a')
    expect(resolveCell(numberCol, { revenue: Number.NaN })).toBe('—')
    expect(resolveCell(numberCol, { revenue: null })).toBe('')
  })

  it('row 14: a huge unbroken string resolves verbatim regardless of column type (wrap/nowrap is CSS, not this fn)', () => {
    const huge = 'x'.repeat(500)
    expect(resolveCell(stringCol, { region: huge })).toBe(huge)
    expect(resolveCell(numberCol, { revenue: huge })).toBe(huge)
  })

  it('never throws across a fuzz of degenerate value shapes', () => {
    const weirdValues: unknown[] = [
      undefined, null, Number.NaN, Infinity, -Infinity, 0, -0, '', 'text', true, false,
      {}, [], () => {}, Symbol('x'), 42n,
    ]
    for (const v of weirdValues) {
      expect(() => resolveCell(numberCol, { revenue: v })).not.toThrow()
      expect(() => resolveCell(stringCol, { region: v })).not.toThrow()
    }
  })
})

describe('formatNumber — module-memoized default-locale Intl.NumberFormat', () => {
  it('formats with locale grouping (en-US comma, observable)', () => {
    expect(formatNumber(42000)).toBe(new Intl.NumberFormat().format(42000))
  })

  it('preserves sign for negatives', () => {
    expect(formatNumber(-12)).toBe(new Intl.NumberFormat().format(-12))
  })

  it('formats zero', () => {
    expect(formatNumber(0)).toBe(new Intl.NumberFormat().format(0))
  })
})

describe('tableColumnsProp / tableRowsProp — the safe attribute codec (SPEC-R1 AC3)', () => {
  it('from(null) (attribute absent/removed) → [] — never null, for both codecs', () => {
    expect(tableColumnsProp.type.from(null)).toEqual([])
    expect(tableRowsProp.type.from(null)).toEqual([])
  })

  it('malformed JSON never throws — falls back to [] for both codecs', () => {
    expect(() => tableColumnsProp.type.from('{not json')).not.toThrow()
    expect(tableColumnsProp.type.from('{not json')).toEqual([])
    expect(() => tableRowsProp.type.from('{not json')).not.toThrow()
    expect(tableRowsProp.type.from('{not json')).toEqual([])
  })

  it('a non-array JSON value (e.g. an object or number) → [] for both codecs', () => {
    expect(tableColumnsProp.type.from('{"key":"a","label":"A"}')).toEqual([])
    expect(tableColumnsProp.type.from('42')).toEqual([])
    expect(tableRowsProp.type.from('{"a":1}')).toEqual([])
  })

  it('well-formed JSON round-trips through the matching clean function (garbage entries dropped)', () => {
    const columnsJson = JSON.stringify([{ key: 'region', label: 'Region' }, { key: 'bad' }, { key: 'revenue', label: 'Revenue', type: 'number' }])
    expect(tableColumnsProp.type.from(columnsJson)).toEqual([col('region', 'Region'), col('revenue', 'Revenue', 'number')])
    const rowsJson = JSON.stringify([{ region: 'EMEA' }, null, { region: 'APAC' }])
    expect(tableRowsProp.type.from(rowsJson)).toEqual([{ region: 'EMEA' }, { region: 'APAC' }])
  })

  it('to() serializes via JSON.stringify (the documented attribute form)', () => {
    const cols: TableColumn[] = [{ key: 'a', label: 'A', type: 'string' }]
    expect(tableColumnsProp.type.to(cols)).toBe(JSON.stringify(cols))
    expect(tableRowsProp.type.to([{ a: 1 }])).toBe(JSON.stringify([{ a: 1 }]))
  })

  it('default is [] for both', () => {
    expect(tableColumnsProp.default).toEqual([])
    expect(tableRowsProp.default).toEqual([])
  })
})

describe('computeRowIdentities — selection identity (ADR-0163 cl.4)', () => {
  it('rowKey non-empty and present on the row → the String-coerced cell value', () => {
    const rows: TableRow[] = [{ region: 'EMEA' }, { region: 'APAC' }]
    expect(computeRowIdentities(rows, 'region')).toEqual([
      { row: rows[0], id: 'EMEA' },
      { row: rows[1], id: 'APAC' },
    ])
  })

  it('rowKey empty, OR present but missing on a given row → the namespaced data-order-index fallback', () => {
    const rows: TableRow[] = [{ region: 'EMEA' }, { other: 'x' }]
    expect(computeRowIdentities(rows, '').map((ir) => ir.id)).toEqual(['#0', '#1'])
    expect(computeRowIdentities(rows, 'region').map((ir) => ir.id)).toEqual(['EMEA', '#1']) // row 1 lacks `region`
  })

  it('the "#"-namespaced fallback never collides with an explicitly-keyed row sharing the bare digits (component-checker finding)', () => {
    // A keyed row whose row-key value is the LITERAL string "1" vs. an unkeyed row that would have landed
    // at bare index "1" — both must resolve to DISTINCT ids.
    const rows: TableRow[] = [{ id: '0' }, { id: '1' }, { other: 'unkeyed' }]
    const ids = computeRowIdentities(rows, 'id').map((ir) => ir.id)
    expect(ids).toEqual(['0', '1', '#2'])
    expect(new Set(ids).size).toBe(3) // anti-vacuous: all three genuinely distinct
  })

  it('numeric/other primitive row-key values are String-coerced', () => {
    const rows: TableRow[] = [{ n: 42 }, { n: true }]
    expect(computeRowIdentities(rows, 'n').map((ir) => ir.id)).toEqual(['42', 'true'])
  })
})

describe('makeRowComparator — the sort comparator (ADR-0163 cl.5)', () => {
  const numberCol: TableColumn = { key: 'n', label: 'N', type: 'number', sortable: true }
  const nonSortableCol: TableColumn = { key: 'n', label: 'N', type: 'number', sortable: false }

  it('null sort → no comparator', () => {
    expect(makeRowComparator(null, [numberCol])).toBeNull()
  })

  it('a sort naming a column absent from `columns` → no comparator', () => {
    expect(makeRowComparator({ key: 'missing', direction: 'ascending' }, [numberCol])).toBeNull()
  })

  it('component-checker regression: a sort naming a column whose sortable is NOT true → no comparator (never silently reorders past its own affordance)', () => {
    expect(makeRowComparator({ key: 'n', direction: 'ascending' }, [nonSortableCol])).toBeNull()
    // the absent-`sortable` (post-cleanColumns default false) case too, not just an explicit false
    const absentSortable: TableColumn = { key: 'n', label: 'N', type: 'number' }
    expect(makeRowComparator({ key: 'n', direction: 'ascending' }, [absentSortable])).toBeNull()
  })

  it('a sort naming a real sortable column DOES produce a working comparator, ascending and descending', () => {
    const rows: TableRow[] = [{ n: 3 }, { n: 1 }, { n: 2 }]
    const identified = computeRowIdentities(rows, '')
    const asc = makeRowComparator({ key: 'n', direction: 'ascending' }, [numberCol])
    expect(asc).not.toBeNull()
    expect([...identified].sort(asc!).map((ir) => ir.row.n)).toEqual([1, 2, 3])
    const desc = makeRowComparator({ key: 'n', direction: 'descending' }, [numberCol])
    expect([...identified].sort(desc!).map((ir) => ir.row.n)).toEqual([3, 2, 1])
  })

  it('degenerate cells sort last in BOTH directions', () => {
    const rows: TableRow[] = [{ n: 2 }, { n: null }, { n: 1 }]
    const identified = computeRowIdentities(rows, '')
    const asc = makeRowComparator({ key: 'n', direction: 'ascending' }, [numberCol])
    expect([...identified].sort(asc!).map((ir) => ir.row.n)).toEqual([1, 2, null])
    const desc = makeRowComparator({ key: 'n', direction: 'descending' }, [numberCol])
    expect([...identified].sort(desc!).map((ir) => ir.row.n)).toEqual([2, 1, null])
  })
})

describe('computeTableView — the cl.7 view pipeline', () => {
  const columns: TableColumn[] = [{ key: 'n', label: 'N', type: 'number', sortable: true }]

  it('every stage is the identity function at its OFF default — SPEC-R2/cl.10 composes from this', () => {
    const rows: TableRow[] = [{ n: 3 }, { n: 1 }, { n: 2 }]
    const view = computeTableView({ rows, columns, rowKey: '', filter: [], search: '', sort: null, pageSize: 0, page: 1 })
    expect(view.matching.map((ir) => ir.row.n)).toEqual([3, 1, 2])
    expect(view.sorted).toBe(view.matching) // unchanged reference — no comparator ran
    expect(view.paged).toBe(view.sorted) // unchanged reference — no windowing ran
    expect(view.pageCount).toBe(0)
  })

  it('a non-sortable-column sort is a pipeline no-op too (the makeRowComparator fix, end to end)', () => {
    const rows: TableRow[] = [{ n: 3 }, { n: 1 }, { n: 2 }]
    const nonSortable: TableColumn[] = [{ key: 'n', label: 'N', type: 'number', sortable: false }]
    const view = computeTableView({ rows, columns: nonSortable, rowKey: '', filter: [], search: '', sort: { key: 'n', direction: 'ascending' }, pageSize: 0, page: 1 })
    expect(view.sorted.map((ir) => ir.row.n)).toEqual([3, 1, 2]) // unreordered
  })

  it('pageCount + paged window derive from the MATCHING SET (after filter/search, before sort)', () => {
    const rows: TableRow[] = Array.from({ length: 25 }, (_, i) => ({ n: i + 1 }))
    const view = computeTableView({ rows, columns, rowKey: '', filter: [], search: '', sort: null, pageSize: 10, page: 1 })
    expect(view.matching).toHaveLength(25)
    expect(view.pageCount).toBe(3)
    expect(view.paged).toHaveLength(10)
    expect(view.paged[0].row.n).toBe(1)
  })
})
