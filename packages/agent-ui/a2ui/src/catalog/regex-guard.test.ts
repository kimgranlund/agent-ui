// regex-guard.test.ts: the bounded `regex` evaluation and both catalog dialects that read it.

import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  countUnboundedRepeats,
  guardedRegexTest,
  hasNestedQuantifier,
  MAX_PATTERN_LENGTH,
  MAX_UNBOUNDED_REPEATS,
  MAX_VALUE_LENGTH,
} from './regex-guard.ts'
import { regex } from './functions.ts'
import { regex as basicRegex } from './a2ui-basic/functions.ts'
import * as examples from '../examples/index.ts'

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

describe('countUnboundedRepeats', () => {
  it.each([
    ['^[a-z]{5}$', 0],
    ['(\\d{1,3}\\.){3}\\d{1,3}', 0],
    ['[a+*]', 0],
    ['\\+\\*', 0],
    ['^\\d+$', 1],
    ['x{2,}', 1],
    ['(ab)+', 1],
    ['^(\\+\\d+)?[\\d ]+$', 2],
    ['^a+?b*?$', 2],
    ['^\\w+@\\w+\\.\\w+$', 3],
  ])('%s holds %i', (pattern, count) => {
    expect(countUnboundedRepeats(pattern)).toBe(count)
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

  it('refuses a pattern over the repeat cap and runs one at it', () => {
    expect(MAX_UNBOUNDED_REPEATS).toBe(2)
    expect(guardedRegexTest('^\\w+@\\w+\\.\\w+$', 'a@b.c')).toBe('refused')
    expect(guardedRegexTest('^\\w+@\\w+$', 'a@b')).toBe('match')
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
    expect(regex({ value: 'a@b.c', pattern: '^\\w+@\\w+\\.\\w+$' })).toMatchObject({ valid: false, message: expect.stringContaining('Invalid pattern') })
  })

  it('a2ui-basic: refused pattern and over-cap value are false', () => {
    expect(basicRegex({ value: 'a', pattern: '(a+)+' })).toBe(false)
    expect(basicRegex({ value: 'a'.repeat(MAX_VALUE_LENGTH + 1), pattern: '^a*$' })).toBe(false)
    expect(basicRegex({ value: 'heart', pattern: '^[a-z]{5}$' })).toBe(true)
    expect(basicRegex({ value: 'a@b.c', pattern: '^\\w+@\\w+\\.\\w+$' })).toBe(false)
  })
})

// The census the repeat cap is set from: every `regex` check pattern in the shipped examples and corpus.
describe('no shipped regex pattern is refused', () => {
  const patterns = new Set<string>()
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const item of node) walk(item)
    } else if (node !== null && typeof node === 'object') {
      const record = node as Record<string, unknown>
      const args = record['args'] as Record<string, unknown> | undefined
      if (record['call'] === 'regex' && typeof args?.['pattern'] === 'string') patterns.add(args['pattern'])
      for (const value of Object.values(record)) walk(value)
    }
  }
  walk(Object.values(examples))
  const corpusDir = `${process.cwd()}/packages/agent-ui/a2ui/corpus`
  for (const file of readdirSync(corpusDir, { recursive: true, encoding: 'utf8' })) {
    if (!file.endsWith('.jsonl')) continue
    for (const line of readFileSync(`${corpusDir}/${file}`, 'utf8').split('\n')) {
      if (line.trim() !== '') walk(JSON.parse(line))
    }
  }

  it('finds the shipped patterns', () => {
    expect(patterns.size).toBeGreaterThan(0)
  })

  it.each([...patterns])('%s passes the guard', (pattern) => {
    expect(countUnboundedRepeats(pattern)).toBeLessThanOrEqual(MAX_UNBOUNDED_REPEATS)
    expect(guardedRegexTest(pattern, '')).not.toBe('refused')
  })
})
