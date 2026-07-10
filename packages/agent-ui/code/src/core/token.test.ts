import { describe, it, expect } from 'vitest'
import { roundTrips, type Token } from './token.ts'

describe('roundTrips (LLD-C3, SPEC-C2) — the contiguous-partition invariant', () => {
  it('true for a contiguous, gap-free partition of the input', () => {
    const code = 'const x = 1'
    const tokens: Token[] = [
      { kind: 'keyword', text: 'const' },
      { kind: 'plain', text: ' x = ' },
      { kind: 'number', text: '1' },
    ]
    expect(roundTrips(tokens, code)).toBe(true)
  })

  it('true for the empty-input/empty-token-stream case', () => {
    expect(roundTrips([], '')).toBe(true)
  })

  it('true for a single verbatim plain token', () => {
    const code = 'anything at all'
    expect(roundTrips([{ kind: 'plain', text: code }], code)).toBe(true)
  })

  it('BITES on a gap (a dropped span) — negative control', () => {
    const code = 'const x = 1'
    const tokens: Token[] = [
      { kind: 'keyword', text: 'const' },
      // ' x = ' dropped — a gap
      { kind: 'number', text: '1' },
    ]
    expect(roundTrips(tokens, code)).toBe(false)
  })

  it('BITES on an overlap (duplicated/reordered text) — negative control', () => {
    const code = 'const x = 1'
    const tokens: Token[] = [
      { kind: 'keyword', text: 'const' },
      { kind: 'plain', text: ' x = ' },
      { kind: 'number', text: '1' },
      { kind: 'plain', text: '1' }, // extra — an overlap
    ]
    expect(roundTrips(tokens, code)).toBe(false)
  })

  it('BITES on reordered text (same multiset, wrong sequence) — negative control', () => {
    const code = 'ab'
    const tokens: Token[] = [
      { kind: 'plain', text: 'b' },
      { kind: 'plain', text: 'a' },
    ]
    expect(roundTrips(tokens, code)).toBe(false)
  })
})
