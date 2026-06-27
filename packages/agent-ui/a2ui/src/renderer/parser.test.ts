import { describe, it, expect } from 'vitest'
import { parseLine, isParseError, ParseError } from './parser.ts'
import type { A2uiServerMessage } from '../protocol.ts'

describe('parseLine — JSONL decode (renderer LLD-C1, SPEC-R1 AC2)', () => {
  it('decodes a well-formed line into the server message (structural, in order)', () => {
    const msg = { version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'demo' } }
    const result = parseLine(JSON.stringify(msg))
    expect(isParseError(result)).toBe(false)
    expect(result).toEqual(msg)
  })

  it('decodes each of the five server message kinds', () => {
    const lines: A2uiServerMessage[] = [
      { version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'demo' } },
      { version: 'v1.0', updateComponents: { surfaceId: 's1', components: [{ id: 'root', component: 'Text' }] } },
      { version: 'v1.0', updateDataModel: { surfaceId: 's1', path: '/user/name', value: 'Ada' } },
      { version: 'v1.0', deleteSurface: { surfaceId: 's1' } },
      { version: 'v1.0', actionResponse: { surfaceId: 's1', actionId: 'a1', value: 42 } },
    ]
    for (const msg of lines) {
      const result = parseLine(JSON.stringify(msg))
      expect(isParseError(result)).toBe(false)
      expect(result).toEqual(msg)
    }
  })

  it('tolerates surrounding whitespace and a trailing CR (CRLF split) via trim', () => {
    const msg = { version: 'v1.0', deleteSurface: { surfaceId: 's1' } }
    const result = parseLine(`  ${JSON.stringify(msg)}\r`)
    expect(isParseError(result)).toBe(false)
    expect(result).toEqual(msg)
  })

  it('does not shape-validate: an unknown envelope passes the parser (SCHEMA is the dispatcher, LLD-C2)', () => {
    // parseLine only decodes JSON; whether the object is a valid envelope is dispatch's concern.
    const result = parseLine('{"version":"v1.0","bogusKey":{}}')
    expect(isParseError(result)).toBe(false)
  })
})

describe('fault isolation — one bad line never escapes (SPEC-R1 AC2 / N4)', () => {
  it('returns a ParseError (not a throw) for malformed JSON', () => {
    let result!: A2uiServerMessage | ParseError
    expect(() => {
      result = parseLine('{ this is not json')
    }).not.toThrow()
    expect(isParseError(result)).toBe(true)
    expect(result).toBeInstanceOf(ParseError)
  })

  it('the ParseError carries code PARSE, a decode message, and the offending raw line', () => {
    const bad = '{ broken'
    const result = parseLine(bad)
    expect(result).toBeInstanceOf(ParseError)
    if (result instanceof ParseError) {
      expect(result.code).toBe('PARSE')
      expect(result.message.length).toBeGreaterThan(0)
      expect(result.line).toBe(bad)
    }
  })

  it('a malformed line between two valid lines does not stop the stream — the next line still parses', () => {
    const stream = [
      '{"version":"v1.0","createSurface":{"surfaceId":"s1","catalogId":"demo"}}',
      '{ malformed }}}',
      '{"version":"v1.0","deleteSurface":{"surfaceId":"s1"}}',
    ]
    const results = stream.map((line) => parseLine(line)) // never throws across the batch

    expect(isParseError(results[0])).toBe(false)
    expect(results[0]).toEqual({ version: 'v1.0', createSurface: { surfaceId: 's1', catalogId: 'demo' } })

    expect(results[1]).toBeInstanceOf(ParseError) // the one bad line is isolated…

    expect(isParseError(results[2])).toBe(false) // …and the stream continues
    expect(results[2]).toEqual({ version: 'v1.0', deleteSurface: { surfaceId: 's1' } })
  })

  it('an empty / whitespace-only line is a ParseError, never a throw (host-facing boundary)', () => {
    // The contract is two-variant (message | ParseError); the parser does not invent a "skip" sentinel.
    // The transport owns not feeding blank trailing lines (runtime SPEC §6) — see handoff open question.
    expect(() => parseLine('')).not.toThrow()
    expect(parseLine('')).toBeInstanceOf(ParseError)
    expect(parseLine('   ')).toBeInstanceOf(ParseError)
  })
})
