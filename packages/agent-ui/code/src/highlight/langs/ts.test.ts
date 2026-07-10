import { describe, it, expect } from 'vitest'
import { roundTrips } from '../../core/token.ts'
import { tsjs } from './ts.ts'

// An agent-real fixture (SPEC-C4 AC2) — a small TS module a model plausibly emits.
const FIXTURE = `// greet a user
export function greet(name: string): string {
  const prefix = 'Hello, '
  return prefix + name + '!'
}
`

describe('tsjs tokenizer (LLD-C6, SPEC-C4)', () => {
  it('round-trips exactly on the agent-real fixture', () => {
    const tokens = tsjs(FIXTURE)
    expect(roundTrips(tokens, FIXTURE)).toBe(true)
  })

  it('classifies the marked spans: line comment, keyword, string, punctuation', () => {
    const tokens = tsjs(FIXTURE)
    expect(tokens.find((t) => t.text === '// greet a user')?.kind).toBe('comment')
    expect(tokens.find((t) => t.text === 'function')?.kind).toBe('keyword')
    expect(tokens.find((t) => t.text === 'const')?.kind).toBe('keyword')
    expect(tokens.find((t) => t.text === "'Hello, '")?.kind).toBe('string')
    expect(tokens.find((t) => t.text === '(')?.kind).toBe('punctuation')
  })

  it('AC1 — a small module tokenizes with comment/keyword/number tiers and round-trips exactly', () => {
    const code = '// hi\nconst x = 1'
    const tokens = tsjs(code)
    expect(roundTrips(tokens, code)).toBe(true)
    expect(tokens.find((t) => t.text === '// hi')?.kind).toBe('comment')
    expect(tokens.find((t) => t.text === 'const')?.kind).toBe('keyword')
    expect(tokens.find((t) => t.text === '1')?.kind).toBe('number')
  })

  it('AC3 — an unknown-shaped input never throws and round-trips', () => {
    const weird = '/* unterminated\nstill in comment'
    expect(() => tsjs(weird)).not.toThrow()
    expect(roundTrips(tsjs(weird), weird)).toBe(true)
  })

  it('AC4 — a three-line block comment carries its tier on all three lines', () => {
    const code = '/*\ncomment body\n*/'
    const tokens = tsjs(code)
    expect(roundTrips(tokens, code)).toBe(true)
    const kindsPerLine = splitByNewlineKinds(tokens)
    expect(kindsPerLine).toEqual([['comment'], ['comment'], ['comment']])
  })

  it('AC4 — a three-line template literal carries the string tier on all three lines', () => {
    const code = '`\ntemplate body\n`'
    const tokens = tsjs(code)
    expect(roundTrips(tokens, code)).toBe(true)
    const kindsPerLine = splitByNewlineKinds(tokens)
    expect(kindsPerLine).toEqual([['string'], ['string'], ['string']])
  })

  it('negative control: a planted per-line reset (middle line plain) would fail the AC4 assertion', () => {
    const code = '/*\ncomment body\n*/'
    const real = splitByNewlineKinds(tsjs(code))
    const planted = [['comment'], ['plain'], ['comment']] // what a broken per-line-reset would produce
    expect(planted).not.toEqual(real)
  })

  it('negative control: a keyword incorrectly tagged plain would fail the tier assertion', () => {
    const tokens = tsjs(FIXTURE)
    const real = tokens.find((t) => t.text === 'function')
    expect(real?.kind).toBe('keyword')
    const planted = { ...real!, kind: 'plain' as const }
    expect(planted.kind).not.toBe(real!.kind)
  })
})

/** Bucket a token stream's KINDS by newline-delimited line (the `\n` boundary tokens are dropped). */
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
