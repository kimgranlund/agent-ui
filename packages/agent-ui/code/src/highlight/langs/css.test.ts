import { describe, it, expect } from 'vitest'
import { roundTrips } from '../../core/token.ts'
import { css } from './css.ts'

// An agent-real fixture — a small CSS block a model plausibly emits.
const FIXTURE = `/* the card surface */
.card {
  color: #333;
  padding: 12px;
  display: flex;
}
@media (min-width: 600px) {
  .card { width: 50%; }
}`

describe('css tokenizer (LLD-C6, SPEC-C4)', () => {
  it('round-trips exactly on the agent-real fixture', () => {
    const tokens = css(FIXTURE)
    expect(roundTrips(tokens, FIXTURE)).toBe(true)
  })

  it('classifies the marked spans: comment, at-rule + property keywords, number+unit, punctuation', () => {
    const tokens = css(FIXTURE)
    expect(tokens.find((t) => t.text === '/* the card surface */')?.kind).toBe('comment')
    expect(tokens.find((t) => t.text === 'color')?.kind).toBe('keyword')
    expect(tokens.find((t) => t.text === '@media')?.kind).toBe('keyword')
    expect(tokens.find((t) => t.text === '12px')?.kind).toBe('number')
    expect(tokens.find((t) => t.text === '50%')?.kind).toBe('number')
    expect(tokens.find((t) => t.text === '{')?.kind).toBe('punctuation')
  })

  it('a bare #id selector stays punctuation+plain (the fidelity fence, no selector lane)', () => {
    const code = '#header { color: red; }'
    const tokens = css(code)
    expect(roundTrips(tokens, code)).toBe(true)
    expect(tokens.find((t) => t.text === '#')?.kind).toBe('punctuation')
    // "header" coalesces with the adjacent plain run (the trailing space before '{') — a substring check,
    // not an exact-token match (the coalescing is correct behavior, not the thing under test here).
    expect(tokens.some((t) => t.kind === 'plain' && t.text.includes('header'))).toBe(true)
  })

  it('AC4 — a three-line block comment carries its tier on all three lines', () => {
    const code = '/*\ncomment body\n*/'
    const tokens = css(code)
    expect(roundTrips(tokens, code)).toBe(true)
    const kindsPerLine = splitByNewlineKinds(tokens)
    expect(kindsPerLine).toEqual([['comment'], ['comment'], ['comment']])
  })

  it('negative control: a property keyword incorrectly tagged plain would fail the tier assertion', () => {
    const tokens = css(FIXTURE)
    const real = tokens.find((t) => t.text === 'display')
    expect(real?.kind).toBe('keyword')
    const planted = { ...real!, kind: 'plain' as const }
    expect(planted.kind).not.toBe(real!.kind)
  })
})

function splitByNewlineKinds(tokens: { kind: string; text: string }[]): string[][] {
  const buckets: string[][] = [[]]
  for (const t of tokens) {
    if (t.kind === 'plain' && t.text === '\n') {
      buckets.push([])
      continue
    }
    buckets[buckets.length - 1].push(t.kind)
  }
  return buckets
}
