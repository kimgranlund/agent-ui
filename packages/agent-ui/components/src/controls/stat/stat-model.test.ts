import { describe, it, expect } from 'vitest'
import { deltaParts, formatStatValue, statDeltaProp, statValueProp } from './stat-model.ts'

// stat-model.test.ts — LLD-C4 DOM-free unit probes (SPEC-R7/R9): formatStatValue, deltaParts, and the
// two safe codecs. Table-driven over the value space per the fuzz discipline (resolveCell's sibling
// precedent, chart-family) — every case documented, none may throw.

describe('formatStatValue (SPEC-R7)', () => {
  it('a finite number Intl-formats (default locale grouping observable)', () => {
    expect(formatStatValue(48200)).toBe('48,200')
    expect(formatStatValue(0)).toBe('0')
    expect(formatStatValue(-3)).toBe('-3')
  })

  it('a non-finite number renders the placeholder em dash — never the strings NaN/Infinity', () => {
    expect(formatStatValue(Number.NaN)).toBe('—')
    expect(formatStatValue(Number.POSITIVE_INFINITY)).toBe('—')
    expect(formatStatValue(Number.NEGATIVE_INFINITY)).toBe('—')
  })

  it('a string passes through VERBATIM — the author controls pre-formatted text', () => {
    expect(formatStatValue('$1.2M')).toBe('$1.2M')
    expect(formatStatValue('99.98%')).toBe('99.98%')
    expect(formatStatValue('')).toBe('')
  })
})

describe('deltaParts (SPEC-R9)', () => {
  it('a positive delta is "up" — signed text carries an explicit +', () => {
    expect(deltaParts(12)).toEqual({ dir: 'up', word: 'up', text: '+12' })
  })

  it('a negative delta is "down" — signed text carries the -', () => {
    expect(deltaParts(-3)).toEqual({ dir: 'down', word: 'down', text: '-3' })
  })

  it('exactly zero is "flat"/"unchanged" — bare, no sign', () => {
    expect(deltaParts(0)).toEqual({ dir: 'flat', word: 'unchanged', text: '0' })
  })

  it('null for every non-number / non-finite input — the delta region is not rendered', () => {
    expect(deltaParts(null)).toBeNull()
    expect(deltaParts(undefined)).toBeNull()
    expect(deltaParts(Number.NaN)).toBeNull()
    expect(deltaParts(Number.POSITIVE_INFINITY)).toBeNull()
    expect(deltaParts(Number.NEGATIVE_INFINITY)).toBeNull()
    expect(deltaParts('12')).toBeNull()
    expect(deltaParts({})).toBeNull()
    expect(deltaParts([])).toBeNull()
  })

  it('never throws over a fuzz of degenerate inputs', () => {
    for (const v of [null, undefined, 'x', {}, [], Symbol('x'), () => 1, true, false, Number.NaN]) {
      expect(() => deltaParts(v)).not.toThrow()
    }
  })
})

describe('statValueProp — the safe value codec (SPEC-R7)', () => {
  it('from(null) = "" (attribute absent) — never throws, never null', () => {
    expect(statValueProp.type.from(null)).toBe('')
  })

  it('a numeric attribute string parses to the typed FINITE number (so it formats)', () => {
    expect(statValueProp.type.from('48200')).toBe(48200)
    expect(statValueProp.type.from('  48200  ')).toBe(48200) // trimmed before the numeric parse
    expect(statValueProp.type.from('-3')).toBe(-3)
    expect(statValueProp.type.from('0')).toBe(0)
  })

  it('a non-numeric attribute string passes through VERBATIM (untrimmed)', () => {
    expect(statValueProp.type.from('$1.2M')).toBe('$1.2M')
    expect(statValueProp.type.from('  $1.2M  ')).toBe('  $1.2M  ')
  })

  it('an empty-string attribute stays the empty string (not coerced to 0)', () => {
    expect(statValueProp.type.from('')).toBe('')
  })

  it('default is "" — the empty-value state', () => {
    expect(statValueProp.default).toBe('')
  })
})

describe('statDeltaProp — the safe delta codec (SPEC-R7)', () => {
  it('from(null) = null (attribute absent)', () => {
    expect(statDeltaProp.type.from(null)).toBeNull()
  })

  it('a finite numeric attribute string parses through', () => {
    expect(statDeltaProp.type.from('12')).toBe(12)
    expect(statDeltaProp.type.from('-3.5')).toBe(-3.5)
    expect(statDeltaProp.type.from('0')).toBe(0)
  })

  it('a non-finite / non-numeric attribute string falls back to null — never NaN, never throws', () => {
    expect(statDeltaProp.type.from('not a number')).toBeNull()
    expect(statDeltaProp.type.from('')).toBeNull()
    expect(statDeltaProp.type.from('Infinity')).toBeNull()
  })

  it('default is null — the absent-delta state', () => {
    expect(statDeltaProp.default).toBeNull()
  })
})
