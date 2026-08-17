import { describe, it, expect } from 'vitest'
import { asDataSource, type DataSource } from './data-source.ts'

describe('DataSource — SPEC-R2', () => {
  it('a read-only source type-checks and satisfies DataSource<number>', async () => {
    // `satisfies` checks structural compatibility but keeps `s`'s own narrower literal type (a
    // 0-arg `read`), so it's called through the DataSource-typed view, matching real consumer use.
    const s: DataSource<number> = { read: async () => 1 } satisfies DataSource<number>
    expect(await s.read!('k', { signal: new AbortController().signal })).toBe(1)
  })

  it('asDataSource wraps a bare fetcher into a read-only DataSource', async () => {
    const fetcher = async () => 42
    const src = asDataSource(fetcher)
    expect(typeof src.read).toBe('function')
    expect(await src.read!('k', { signal: new AbortController().signal })).toBe(42)
  })

  it('asDataSource passes a real DataSource object through unchanged', () => {
    const s: DataSource<number> = { read: async () => 1 }
    expect(asDataSource(s)).toBe(s)
  })

  it('a new optional verb appended to the interface leaves every fixture source unchanged (type-level)', () => {
    // Extension type used only at compile time — asserts the additive-widening shape (SPEC-R2 AC3).
    type ExtendedSource<T> = DataSource<T> & { archive?(key: string): Promise<void> }
    const s: ExtendedSource<number> = { read: async () => 1 }
    expect(s.archive).toBeUndefined()
  })
})
