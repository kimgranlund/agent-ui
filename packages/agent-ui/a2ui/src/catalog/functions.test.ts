// functions.test.ts — pure catalog function implementations (catalog LLD-C7 / ADR-0026/ADR-0034).
//
// Table-driven unit tests for `required`, `email`, `regex`, and `ping`. Each test checks the
// function in isolation — no DOM, no signals, no registry. The `catalogFunctions` registry is also
// exercised to confirm all four names are reachable at the shared lookup key.

import { describe, it, expect } from 'vitest'
import { required, email, regex, ping, formatCurrency, catalogFunctions } from './functions.ts'

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
  it('contains exactly the five declared names (required/email/regex/ping/formatCurrency)', () => {
    expect(Object.keys(catalogFunctions).sort()).toEqual(['email', 'formatCurrency', 'ping', 'regex', 'required'])
  })

  it('each entry is the same function as the named export', () => {
    expect(catalogFunctions.required).toBe(required)
    expect(catalogFunctions.email).toBe(email)
    expect(catalogFunctions.regex).toBe(regex)
    expect(catalogFunctions.ping).toBe(ping)
    expect(catalogFunctions.formatCurrency).toBe(formatCurrency)
  })

  it('invoking via the registry produces the same result as a direct call', () => {
    expect(catalogFunctions.required({ value: '' })).toEqual(required({ value: '' }))
    expect(catalogFunctions.email({ value: 'user@example.com' })).toEqual(email({ value: 'user@example.com' }))
    expect(catalogFunctions.regex({ value: 'abc', pattern: '^[a-z]+$' })).toEqual(
      regex({ value: 'abc', pattern: '^[a-z]+$' }),
    )
    expect(catalogFunctions.ping({})).toBe(true) // ping() → true, always; args ignored
  })
})

// ── ping ─────────────────────────────────────────────────────────────────────

describe('ping', () => {
  it('returns true with no args', () => {
    expect(ping()).toBe(true)
  })

  it('returns true regardless of args passed (server-invoke path passes empty args object)', () => {
    // `call-function.ts` calls `impl(args ?? {})` — ping ignores the args object entirely.
    expect((ping as (args?: unknown) => boolean)({})).toBe(true)
  })
})

// ── formatCurrency (ADR-0217) ───────────────────────────────────────────────────

describe('formatCurrency — locale-correct money formatting, runtime-default locale', () => {
  it('formats a whole USD amount with grouping + the currency symbol (the stat-model.test.ts en-US-runtime convention)', () => {
    expect(formatCurrency({ value: 1299, currency: 'USD' })).toBe('$1,299.00')
  })

  it('formats a fractional EUR amount', () => {
    expect(formatCurrency({ value: 42.5, currency: 'EUR' })).toBe('€42.50')
  })

  it('respects a currency\'s own fraction-digit lookup (JPY has none — Intl is the lookup, ADR-0038)', () => {
    expect(formatCurrency({ value: 500, currency: 'JPY' })).toBe('¥500')
  })

  it('a non-finite value degrades to the em-dash placeholder (the stat-model.ts convention), regardless of currency', () => {
    expect(formatCurrency({ value: Number.NaN, currency: 'USD' })).toBe('—')
    expect(formatCurrency({ value: Number.POSITIVE_INFINITY, currency: 'USD' })).toBe('—')
    expect(formatCurrency({ value: 'not-a-number', currency: 'USD' })).toBe('—')
  })

  it('an invalid/unknown currency code degrades to a plain default-locale number string — NOT a2ui-basic\'s String(value) posture (ADR-0217 cl.1)', () => {
    expect(formatCurrency({ value: 1299, currency: 'NOT-A-CODE' })).toBe('1,299')
  })

  it('a missing/non-string currency degrades to a plain number string the same way', () => {
    expect(formatCurrency({ value: 1299 })).toBe('1,299')
    expect(formatCurrency({ value: 1299, currency: 42 })).toBe('1,299')
    expect(formatCurrency({ value: 1299, currency: '' })).toBe('1,299')
  })

  it('carries no decimals/grouping args — Intl\'s own per-currency lookup and locale grouping are load-bearing, not re-admitted knobs', () => {
    // BHD (Bahraini Dinar) has 3 fraction digits by ISO 4217 — proves the lookup, not a hardcoded 2.
    expect(formatCurrency({ value: 1, currency: 'BHD' })).toContain('1.000')
  })

  it('reachable via the shared catalogFunctions registry, same result as a direct call', () => {
    expect(catalogFunctions.formatCurrency({ value: 1299, currency: 'USD' })).toEqual(
      formatCurrency({ value: 1299, currency: 'USD' }),
    )
  })
})
