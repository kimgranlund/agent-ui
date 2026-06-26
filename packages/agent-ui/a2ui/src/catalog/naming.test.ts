import { describe, it, expect } from 'vitest'
import { validName } from './naming.ts'

describe('validName — UAX-31 / reserved @ (catalog SPEC-R2)', () => {
  const valid = [
    'Button',
    'TextField',
    'text', // lowercase start
    'a1', // digit ∈ ID_Continue, not start
    'snake_case', // `_` ∈ ID_Continue (not start)
    'café', // non-ASCII letter ∈ ID_Start
    'Δelta', // Greek capital ∈ ID_Start
    'naïve',
    'カタログ', // Katakana
  ]
  for (const name of valid) {
    it(`accepts "${name}"`, () => expect(validName(name)).toBe(true))
  }

  const invalid: ReadonlyArray<readonly [string, string]> = [
    ['@index', 'reserved @ namespace'],
    ['@', 'bare @'],
    ['', 'empty'],
    ['1abc', 'leading digit (not ID_Start)'],
    ['_leading', 'leading _ ∉ ID_Start (pure UAX-31)'],
    ['has space', 'whitespace'],
    ['kebab-case', 'hyphen ∉ ID_Continue'],
    ['dotted.name', 'dot ∉ ID_Continue'],
    ['slash/name', 'slash ∉ ID_Continue'],
    ['emoji😀', 'emoji ∉ ID_Continue'],
    ['$dollar', '$ ∉ ID_Start in the UAX-31 profile'],
  ]
  for (const [name, why] of invalid) {
    it(`rejects "${name}" (${why})`, () => expect(validName(name)).toBe(false))
  }
})
