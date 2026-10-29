// regex-guard.test.ts: the bounded `regex` evaluation and both catalog dialects that read it.

import { describe, expect, it } from 'vitest'
import { guardedRegexTest, hasNestedQuantifier, MAX_PATTERN_LENGTH, MAX_VALUE_LENGTH } from './regex-guard.ts'
import { regex } from './functions.ts'
import { regex as basicRegex } from './a2ui-basic/functions.ts'

describe('hasNestedQuantifier', () => {
  it.each([
    ['^[a-z]{5}$'],
    ['^\\d+$'],
    ['(\\d{3}){2}'],
    ['(\\d{1,3}\\.){3}\\d{1,3}'],
    ['^(\\+\\d+)?[\\d ]+$'],
    ['[(a+)+]'],
    ['\\(a+\\)+'],
  ])('passes %s', (pattern) => {
    expect(hasNestedQuantifier(pattern)).toBe(false)
  })

  it.each([['(a+)+'], ['(a*)*'], ['(\\w+\\s?)*'], ['(a{2,})+'], ['((a+)b)*'], ['(a+){2,5}']])('refuses %s', (pattern) => {
    expect(hasNestedQuantifier(pattern)).toBe(true)
  })
})

describe('guardedRegexTest', () => {
  it('runs an in-cap pattern', () => {
    expect(guardedRegexTest('^[a-z]{5}$', 'heart')).toBe('match')
    expect(guardedRegexTest('^[a-z]{5}$', 'Heart')).toBe('no-match')
  })

  it('refuses a pattern over the length cap and accepts one at it', () => {
    expect(guardedRegexTest('a'.repeat(MAX_PATTERN_LENGTH + 1), 'a')).toBe('refused')
    expect(guardedRegexTest('a'.repeat(MAX_PATTERN_LENGTH), 'a'.repeat(MAX_PATTERN_LENGTH))).toBe('match')
  })

  it('reports a value over the length cap and runs one at it', () => {
    expect(guardedRegexTest('^a*$', 'a'.repeat(MAX_VALUE_LENGTH + 1))).toBe('too-long')
    expect(guardedRegexTest('^a*$', 'a'.repeat(MAX_VALUE_LENGTH))).toBe('match')
  })

  it('refuses a nested quantifier and a malformed pattern', () => {
    expect(guardedRegexTest('(a+)+', 'a')).toBe('refused')
    expect(guardedRegexTest('[invalid(', 'x')).toBe('refused')
  })
})

describe('both dialects read the guard', () => {
  it('default catalog: refused pattern and over-cap value are invalid with a message', () => {
    expect(regex({ value: 'a', pattern: '(a+)+' })).toMatchObject({ valid: false, message: expect.stringContaining('Invalid pattern') })
    expect(regex({ value: 'a'.repeat(MAX_VALUE_LENGTH + 1), pattern: '^a*$' })).toEqual({ valid: false, message: 'Value too long to check' })
    expect(regex({ value: 'heart', pattern: '^[a-z]{5}$' })).toEqual({ valid: true })
  })

  it('a2ui-basic: refused pattern and over-cap value are false', () => {
    expect(basicRegex({ value: 'a', pattern: '(a+)+' })).toBe(false)
    expect(basicRegex({ value: 'a'.repeat(MAX_VALUE_LENGTH + 1), pattern: '^a*$' })).toBe(false)
    expect(basicRegex({ value: 'heart', pattern: '^[a-z]{5}$' })).toBe(true)
  })
})
