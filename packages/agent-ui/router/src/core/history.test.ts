import { describe, it, expect } from 'vitest'
import { MemoryHistory } from './history.ts'

describe('MemoryHistory — the in-memory entry stack + index (SPEC-R2, LLD-C4)', () => {
  it('seeds a single entry at index 0', () => {
    const h = new MemoryHistory('/')
    expect(h.entries).toEqual(['/'])
    expect(h.index).toBe(0)
    expect(h.current).toBe('/')
  })

  it('push appends and advances the index', () => {
    const h = new MemoryHistory('/')
    h.push('/a')
    expect(h.entries).toEqual(['/', '/a'])
    expect(h.index).toBe(1)
    h.push('/b')
    expect(h.entries).toEqual(['/', '/a', '/b'])
    expect(h.index).toBe(2)
  })

  it('push truncates any forward tail (the platform history semantics)', () => {
    const h = new MemoryHistory('/')
    h.push('/a')
    h.push('/b')
    h.go(-2) // back to '/'
    h.push('/c')
    expect(h.entries).toEqual(['/', '/c'])
    expect(h.index).toBe(1)
  })

  it('replace swaps the current entry in place (no index change, no new entry)', () => {
    const h = new MemoryHistory('/')
    h.push('/a')
    h.replace('/a2')
    expect(h.entries).toEqual(['/', '/a2'])
    expect(h.index).toBe(1)
  })

  it('go moves the index and returns the landed entry', () => {
    const h = new MemoryHistory('/a')
    h.push('/b')
    h.push('/c')
    expect(h.go(-1)).toBe('/b')
    expect(h.index).toBe(1)
    expect(h.go(1)).toBe('/c')
    expect(h.index).toBe(2)
  })

  it('go clamps silently at either end — null, never a throw', () => {
    const h = new MemoryHistory('/a')
    h.push('/b')
    expect(() => h.go(-5)).not.toThrow()
    expect(h.go(-5)).toBeNull()
    expect(h.index).toBe(1) // unchanged
    expect(h.go(5)).toBeNull()
    expect(h.index).toBe(1) // unchanged
  })

  it('setIndex jumps directly and returns the landed entry', () => {
    const h = new MemoryHistory('/a')
    h.push('/b')
    h.push('/c')
    expect(h.setIndex(0)).toBe('/a')
    expect(h.index).toBe(0)
  })

  it('setIndex out of range returns null and never throws (stale/foreign stamp)', () => {
    const h = new MemoryHistory('/a')
    h.push('/b')
    expect(() => h.setIndex(99)).not.toThrow()
    expect(h.setIndex(99)).toBeNull()
    expect(h.index).toBe(1) // unchanged
    expect(h.setIndex(-1)).toBeNull()
    expect(h.index).toBe(1) // unchanged
  })
})
