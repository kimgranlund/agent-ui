import { describe, it, expect } from 'vitest'
import { roundTrips } from '../../core/token.ts'
import { json } from './json.ts'

// An agent-real fixture — a small JSON config a model plausibly emits.
const FIXTURE = `{
  "name": "agent-ui",
  "version": 1,
  "private": true,
  "tags": null
}`

describe('json tokenizer (LLD-C6, SPEC-C4)', () => {
  it('round-trips exactly on the agent-real fixture', () => {
    const tokens = json(FIXTURE)
    expect(roundTrips(tokens, FIXTURE)).toBe(true)
  })

  it('classifies the marked spans: string keys/values, number, boolean/null keyword, punctuation', () => {
    const tokens = json(FIXTURE)
    expect(tokens.find((t) => t.text === '"name"')?.kind).toBe('string')
    expect(tokens.find((t) => t.text === '"agent-ui"')?.kind).toBe('string')
    expect(tokens.find((t) => t.text === '1')?.kind).toBe('number')
    expect(tokens.find((t) => t.text === 'true')?.kind).toBe('keyword')
    expect(tokens.find((t) => t.text === 'null')?.kind).toBe('keyword')
    expect(tokens.find((t) => t.text === '{')?.kind).toBe('punctuation')
    expect(tokens.find((t) => t.text === ':')?.kind).toBe('punctuation')
  })

  it('a negative number tokenizes as one number lexeme', () => {
    const code = '{"x": -5.5}'
    const tokens = json(code)
    expect(roundTrips(tokens, code)).toBe(true)
    expect(tokens.find((t) => t.text === '-5.5')?.kind).toBe('number')
  })

  it('an unterminated string never throws and still round-trips (best-effort, no block carry)', () => {
    const malformed = '{"key": "unterminated'
    expect(() => json(malformed)).not.toThrow()
    expect(roundTrips(json(malformed), malformed)).toBe(true)
  })

  it('negative control: a boolean incorrectly tagged plain would fail the tier assertion', () => {
    const tokens = json(FIXTURE)
    const real = tokens.find((t) => t.text === 'true')
    expect(real?.kind).toBe('keyword')
    const planted = { ...real!, kind: 'plain' as const }
    expect(planted.kind).not.toBe(real!.kind)
  })
})
