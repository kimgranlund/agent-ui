import { describe, it, expect } from 'vitest'
import { cleanColumns, cleanRows, resolveCell, formatNumber, tableColumnsProp, tableRowsProp, type TableColumn } from './table-model.ts'

// table-model.test.ts — the pure-math unit probes (LLD-C1, report-family.lld.md §2/§8/§9). DOM-free: every
// SPEC-R3 row (1-14) as a table-driven case, plus the safe-codec round-trips.

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
    expect(cleanColumns(input)).toEqual([
      { key: 'region', label: 'Region', type: 'string' },
      { key: 'ok2', label: 'OK 2', type: 'string' },
    ])
  })

  it('an unknown/absent `type` normalizes to "string", never dropping the column (row 4)', () => {
    expect(cleanColumns([{ key: 'a', label: 'A' }])).toEqual([{ key: 'a', label: 'A', type: 'string' }])
    expect(cleanColumns([{ key: 'a', label: 'A', type: 'bogus' }])).toEqual([{ key: 'a', label: 'A', type: 'string' }])
    expect(cleanColumns([{ key: 'a', label: 'A', type: 42 }])).toEqual([{ key: 'a', label: 'A', type: 'string' }])
  })

  it('`type: "number"` is kept as-is', () => {
    expect(cleanColumns([{ key: 'revenue', label: 'Revenue', type: 'number' }])).toEqual([
      { key: 'revenue', label: 'Revenue', type: 'number' },
    ])
  })

  it('duplicate column keys both survive, positional not keyed (row 12)', () => {
    const input = [
      { key: 'x', label: 'First X' },
      { key: 'x', label: 'Second X' },
    ]
    expect(cleanColumns(input)).toEqual([
      { key: 'x', label: 'First X', type: 'string' },
      { key: 'x', label: 'Second X', type: 'string' },
    ])
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
    expect(tableColumnsProp.type.from(columnsJson)).toEqual([
      { key: 'region', label: 'Region', type: 'string' },
      { key: 'revenue', label: 'Revenue', type: 'number' },
    ])
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
