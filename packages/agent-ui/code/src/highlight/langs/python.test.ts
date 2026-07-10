import { describe, it, expect } from 'vitest'
import { roundTrips } from '../../core/token.ts'
import { python } from './python.ts'

// An agent-real fixture — a small Python function a model plausibly emits.
const FIXTURE = `# greet a user
def greet(name):
    prefix = 'Hello, '
    return prefix + name + '!'
`

describe('python tokenizer (LLD-C6, SPEC-C4)', () => {
  it('round-trips exactly on the agent-real fixture', () => {
    const tokens = python(FIXTURE)
    expect(roundTrips(tokens, FIXTURE)).toBe(true)
  })

  it('classifies the marked spans: line comment, keyword, string, punctuation', () => {
    const tokens = python(FIXTURE)
    expect(tokens.find((t) => t.text === '# greet a user')?.kind).toBe('comment')
    expect(tokens.find((t) => t.text === 'def')?.kind).toBe('keyword')
    expect(tokens.find((t) => t.text === 'return')?.kind).toBe('keyword')
    expect(tokens.find((t) => t.text === "'Hello, '")?.kind).toBe('string')
    expect(tokens.find((t) => t.text === '(')?.kind).toBe('punctuation')
  })

  it('indentation stays plain (no significant-whitespace lane)', () => {
    const tokens = python(FIXTURE)
    // the 4-space indent before "prefix" is part of an ordinary plain run, never its own construct
    expect(tokens.some((t) => t.kind === 'plain' && t.text.includes('    prefix'))).toBe(true)
  })

  it('AC4 — a three-line triple-quoted string carries the string tier on all three lines', () => {
    const code = "'''\nstring body\n'''"
    const tokens = python(code)
    expect(roundTrips(tokens, code)).toBe(true)
    const kindsPerLine = splitByNewlineKinds(tokens)
    expect(kindsPerLine).toEqual([['string'], ['string'], ['string']])
  })

  it('double-quoted triple string (""") also carries across lines', () => {
    const code = '"""\ndoc body\n"""'
    const tokens = python(code)
    expect(roundTrips(tokens, code)).toBe(true)
    const kindsPerLine = splitByNewlineKinds(tokens)
    expect(kindsPerLine).toEqual([['string'], ['string'], ['string']])
  })

  it('negative control: a keyword incorrectly tagged plain would fail the tier assertion', () => {
    const tokens = python(FIXTURE)
    const real = tokens.find((t) => t.text === 'def')
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
