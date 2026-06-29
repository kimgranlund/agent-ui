// functions.test.ts — pure catalog function implementations (catalog LLD-C7 / ADR-0026).
//
// Table-driven unit tests for `required`, `email`, and `regex`. Each test checks the function in
// isolation — no DOM, no signals, no registry. The `catalogFunctions` registry is also exercised to
// confirm the three names are all reachable at the shared lookup key.

import { describe, it, expect } from 'vitest'
import { required, email, regex, catalogFunctions } from './functions.ts'

// ── required ─────────────────────────────────────────────────────────────────

describe('required — non-empty field gate', () => {
  it.each([
    ['null is absent', null, false],
    ['undefined is absent', undefined, false],
    ['empty string is absent', '', false],
    ['non-empty string is present', 'hello', true],
    ['whitespace string is present (not blank)', '  ', true],
    ['zero is present (non-null)', 0, true],
    ['false is present (non-null)', false, true],
  ])('%s', (_, value, expectedValid) => {
    const result = required({ value })
    expect(result.valid).toBe(expectedValid)
  })

  it('returns a non-empty message when invalid', () => {
    const result = required({ value: null })
    expect(result.valid).toBe(false)
    expect(typeof result.message).toBe('string')
    expect(result.message!.length).toBeGreaterThan(0)
  })

  it('returns no message when valid', () => {
    const result = required({ value: 'ok' })
    expect(result.valid).toBe(true)
    expect(result.message).toBeUndefined()
  })
})

// ── email ─────────────────────────────────────────────────────────────────────

describe('email — format check (empty passes, invalid fails)', () => {
  it.each([
    ['a@b.c is valid', 'a@b.c', true],
    ['user@example.com is valid', 'user@example.com', true],
    ['user+tag@domain.org is valid', 'user+tag@domain.org', true],
    ['missing @ is invalid', 'notanemail', false],
    ['missing TLD is invalid', 'user@domain', false],
    ['leading space is invalid', ' user@domain.com', false],
    ['empty string is valid (not-mandatory per spec)', '', true],
    ['null passes (not-string, not validator\'s job)', null, true],
    ['undefined passes (non-string)', undefined, true],
    ['number passes (non-string)', 42, true],
  ])('%s', (_, value, expectedValid) => {
    expect(email({ value }).valid).toBe(expectedValid)
  })

  it('returns a non-empty message when the format fails', () => {
    const result = email({ value: 'bad' })
    expect(result.valid).toBe(false)
    expect(typeof result.message).toBe('string')
    expect(result.message!.length).toBeGreaterThan(0)
  })
})

// ── regex ──────────────────────────────────────────────────────────────────────

describe('regex — pattern match gate', () => {
  it.each([
    ['matching value is valid', 'hello', '^[a-z]+$', true],
    ['non-matching value is invalid', 'Hello', '^[a-z]+$', false],
    ['digits-only pattern, match', '123', '^\\d+$', true],
    ['digits-only pattern, no match', '12a', '^\\d+$', false],
  ])('%s', (_, value, pattern, expectedValid) => {
    expect(regex({ value, pattern }).valid).toBe(expectedValid)
  })

  it('non-string value passes (type check is schema\'s job)', () => {
    expect(regex({ value: null, pattern: '.*' }).valid).toBe(true)
    expect(regex({ value: 42, pattern: '.*' }).valid).toBe(true)
  })

  it('non-string pattern passes (no crash, type guard)', () => {
    expect(regex({ value: 'hello', pattern: null }).valid).toBe(true)
    expect(regex({ value: 'hello', pattern: 99 }).valid).toBe(true)
  })

  it('malformed pattern returns invalid with a message instead of throwing', () => {
    const result = regex({ value: 'x', pattern: '[invalid(' })
    expect(result.valid).toBe(false)
    expect(typeof result.message).toBe('string')
    expect(result.message!.length).toBeGreaterThan(0)
  })

  it('empty string value against an always-match pattern', () => {
    expect(regex({ value: '', pattern: '.*' }).valid).toBe(true)
  })
})

// ── catalogFunctions registry ─────────────────────────────────────────────────

describe('catalogFunctions — shared lookup table', () => {
  it('contains exactly the three declared names', () => {
    expect(Object.keys(catalogFunctions).sort()).toEqual(['email', 'regex', 'required'])
  })

  it('each entry is the same function as the named export', () => {
    expect(catalogFunctions.required).toBe(required)
    expect(catalogFunctions.email).toBe(email)
    expect(catalogFunctions.regex).toBe(regex)
  })

  it('invoking via the registry produces the same result as a direct call', () => {
    expect(catalogFunctions.required({ value: '' })).toEqual(required({ value: '' }))
    expect(catalogFunctions.email({ value: 'user@example.com' })).toEqual(email({ value: 'user@example.com' }))
    expect(catalogFunctions.regex({ value: 'abc', pattern: '^[a-z]+$' })).toEqual(
      regex({ value: 'abc', pattern: '^[a-z]+$' }),
    )
  })
})
