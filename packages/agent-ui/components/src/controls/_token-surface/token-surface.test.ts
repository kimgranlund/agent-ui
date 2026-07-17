import { describe, it, expect } from 'vitest'
import { cleanEntries, cssValue, isRenderableLength, tokenEntriesProp } from './token-surface.ts'

// token-surface.test.ts — DOM-free unit probes for the shared value-lane helper (LLD-C1, token-surfaces.lld.md
// §2; SPEC-R2/R7/R11). No custom element involved — pure function coverage, the bar-math.test.ts precedent.
// This environment's jsdom carries no global `CSS` (verified empirically), so `isRenderableLength` exercises
// its unit-regex FALLBACK here; the real `CSS.supports` platform-truth path is proven in the browser legs.

describe('cleanEntries — hardening (SPEC-R7/R11)', () => {
  it('a non-array input yields []', () => {
    expect(cleanEntries(null)).toEqual([])
    expect(cleanEntries(undefined)).toEqual([])
    expect(cleanEntries('not an array')).toEqual([])
    expect(cleanEntries({ label: 'x', value: 'y' })).toEqual([])
  })

  it('drops an entry with a missing/non-string label or value, keeps the rest, order preserved', () => {
    const input = [
      { label: 'ok', value: '#eef' },
      { label: 'bad-value', value: 42 },
      { value: 'no-label' },
      null,
      { label: 'ok2', value: '#003' },
    ]
    expect(cleanEntries(input)).toEqual([
      { label: 'ok', value: '#eef' },
      { label: 'ok2', value: '#003' },
    ])
  })

  it('duplicate labels: both entries survive (positional, not keyed)', () => {
    const input = [
      { label: 'dup', value: '#111' },
      { label: 'dup', value: '#222' },
    ]
    expect(cleanEntries(input)).toEqual(input)
  })

  it('an empty array stays empty', () => {
    expect(cleanEntries([])).toEqual([])
  })
})

describe('cssValue — the value-neutral --var lane (SPEC-R2)', () => {
  it('empty string stays empty (transparent/none)', () => {
    expect(cssValue('')).toBe('')
  })

  it('a --prefixed value routes through var()', () => {
    expect(cssValue('--x')).toBe('var(--x)')
    expect(cssValue('--md-sys-color-primary')).toBe('var(--md-sys-color-primary)')
  })

  it('a literal value passes through verbatim', () => {
    expect(cssValue('oklch(0.6 0.03 225)')).toBe('oklch(0.6 0.03 225)')
    expect(cssValue('24px')).toBe('24px')
    expect(cssValue('red')).toBe('red')
  })
})

describe('isRenderableLength — the length router, NOT a drop gate (SPEC-R11)', () => {
  it('recognizes real CSS lengths', () => {
    expect(isRenderableLength('24px')).toBe(true)
    expect(isRenderableLength('0')).toBe(true)
    expect(isRenderableLength('1.5rem')).toBe(true)
  })

  it('a --var name is always treated as renderable (its resolution is the browser\'s job)', () => {
    expect(isRenderableLength('--x')).toBe(true)
    expect(isRenderableLength('--md-sys-height-md')).toBe(true)
  })

  it('rejects a non-length value', () => {
    expect(isRenderableLength('red')).toBe(false)
    expect(isRenderableLength('abc')).toBe(false)
    expect(isRenderableLength('')).toBe(false)
  })
})

describe('tokenEntriesProp — the safe JSON codec (SPEC-R7/R11 row 1)', () => {
  it('defaults to [] and is a FRESH array per call (never a shared mutable default)', () => {
    const a = tokenEntriesProp()
    const b = tokenEntriesProp()
    expect(a.default).toEqual([])
    expect(a.default).not.toBe(b.default)
  })

  it('from(null) → [] (attribute absent/removed), never null', () => {
    const config = tokenEntriesProp()
    expect(config.type.from(null)).toEqual([])
  })

  it('malformed JSON never throws — falls back to []', () => {
    const config = tokenEntriesProp()
    expect(() => config.type.from('{not json')).not.toThrow()
    expect(config.type.from('{not json')).toEqual([])
  })

  it('valid JSON parses and hardens through cleanEntries', () => {
    const config = tokenEntriesProp()
    const parsed = config.type.from('[{"label":"100","value":"#eef"},{"label":"bad","value":42}]')
    expect(parsed).toEqual([{ label: '100', value: '#eef' }])
  })

  it('round-trips a clean array through to()/from()', () => {
    const config = tokenEntriesProp()
    const entries = [{ label: 'sm', value: '24px' }]
    expect(config.type.from(config.type.to(entries))).toEqual(entries)
  })

  it('a JSON array of non-objects parses to [] via cleanEntries', () => {
    const config = tokenEntriesProp()
    expect(config.type.from('[1,2,3]')).toEqual([])
  })
})
