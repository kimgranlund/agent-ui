// genui-line.test.ts — genui-surface.spec.md SPEC-R1 AC1 / SPEC-R2 AC2: the reserved genui envelope's
// reader/guard, in isolation — proves the discriminator (no `version`/`a2uiMeta` key) against a real
// `A2uiServerMessage` and a real meta-line, and the exact SPEC-R2 byte-cap boundary. Lives under
// `src/live-agent/` (not co-located) — the `mini-skills.test.ts`/`produce-loop.test.ts` precedent: the
// vitest `packages` project globs `src/**/*.test.ts`, so a `src/agent/*.ts` subject is exercised from here.

import { describe, it, expect } from 'vitest'
import { readGenuiLine, isGenuiLine, isGenuiCandidate, formatGenuiLine, utf8ByteLength, GENUI_MAX_HTML_BYTES } from '../agent/genui-line.ts'
import type { A2uiServerMessage } from '../protocol.ts'

const realServerMessage: A2uiServerMessage = {
  version: 'v1.0',
  createSurface: { surfaceId: 'main', catalogId: 'agent-ui' },
}

describe('readGenuiLine / isGenuiLine (SPEC-R1 AC1)', () => {
  it('round-trips a well-formed envelope', () => {
    const line = formatGenuiLine('q3-revenue', '<html><body>hi</body></html>')
    expect(isGenuiLine(line)).toBe(true)
    expect(readGenuiLine(line)).toEqual({ genui: { surfaceId: 'q3-revenue', html: '<html><body>hi</body></html>' } })
  })

  it('rejects malformed JSON without throwing', () => {
    expect(readGenuiLine('not json')).toBeUndefined()
    expect(readGenuiLine('[]')).toBeUndefined()
    expect(readGenuiLine('null')).toBeUndefined()
    expect(isGenuiLine('not json')).toBe(false)
  })

  // The load-bearing negative control (SPEC-R1): a REAL A2uiServerMessage — carrying "version" — is
  // provably NOT a genui line, by the same discriminator dispatch.ts's version gate relies on.
  it('is provably NOT a genui line for a real A2uiServerMessage (has "version")', () => {
    const line = JSON.stringify(realServerMessage)
    expect(isGenuiLine(line)).toBe(false)
    expect(readGenuiLine(line)).toBeUndefined()
  })

  it('is provably NOT a genui line for a real meta-line (has "a2uiMeta")', () => {
    const line = '{"a2uiMeta":{"note":"hi"},"genui":{"surfaceId":"x","html":"<p></p>"}}'
    expect(readGenuiLine(line)).toBeUndefined()
  })

  it('rejects a non-object genui, an empty/missing surfaceId, and a non-string html', () => {
    expect(readGenuiLine('{"genui":"not-an-object"}')).toBeUndefined()
    expect(readGenuiLine('{"genui":["a","b"]}')).toBeUndefined()
    expect(readGenuiLine('{"genui":{"surfaceId":"","html":"<p></p>"}}')).toBeUndefined()
    expect(readGenuiLine('{"genui":{"html":"<p></p>"}}')).toBeUndefined()
    expect(readGenuiLine('{"genui":{"surfaceId":"x","html":42}}')).toBeUndefined()
    expect(readGenuiLine('{"genui":{"surfaceId":"x"}}')).toBeUndefined()
    expect(readGenuiLine('{"someOtherKey":true}')).toBeUndefined()
  })

  it('a line carrying BOTH "genui" and "version" is rejected — version wins the discriminator', () => {
    const line = '{"version":"v1.0","genui":{"surfaceId":"x","html":"<p></p>"}}'
    expect(readGenuiLine(line)).toBeUndefined()
  })
})

describe('SPEC-R2 — the 512 KiB byte-cap boundary (AC2)', () => {
  it('accepts an html payload of EXACTLY GENUI_MAX_HTML_BYTES bytes', () => {
    const html = 'a'.repeat(GENUI_MAX_HTML_BYTES) // ASCII — 1 byte/char, exact boundary
    expect(utf8ByteLength(html)).toBe(GENUI_MAX_HTML_BYTES)
    expect(readGenuiLine(formatGenuiLine('x', html))).toBeDefined()
  })

  it('rejects an html payload of GENUI_MAX_HTML_BYTES + 1 bytes — never truncated-and-rendered', () => {
    const html = 'a'.repeat(GENUI_MAX_HTML_BYTES + 1)
    expect(readGenuiLine(formatGenuiLine('x', html))).toBeUndefined()
  })

  it('measures UTF-8 BYTES, not JS string length, for non-ASCII content', () => {
    const multiByteChar = '★' // 3 UTF-8 bytes, 1 UTF-16 code unit
    const html = multiByteChar.repeat(GENUI_MAX_HTML_BYTES) // well over the byte cap despite equal .length
    expect(html.length).toBe(GENUI_MAX_HTML_BYTES)
    expect(utf8ByteLength(html)).toBeGreaterThan(GENUI_MAX_HTML_BYTES)
    expect(readGenuiLine(formatGenuiLine('x', html))).toBeUndefined()
  })
})

describe('isGenuiCandidate — the cheap "carries the genui key at all" probe (the peel-detection leg)', () => {
  it('true for any object carrying a genui key, valid or not', () => {
    expect(isGenuiCandidate('{"genui":{"surfaceId":"x","html":"<p></p>"}}')).toBe(true)
    expect(isGenuiCandidate('{"genui":"not-an-object"}')).toBe(true) // structurally present, invalid shape
  })

  it('false for anything without a genui key, or unparseable input', () => {
    expect(isGenuiCandidate('{"a2uiMeta":{"note":"hi"}}')).toBe(false)
    expect(isGenuiCandidate(JSON.stringify(realServerMessage))).toBe(false)
    expect(isGenuiCandidate('not json')).toBe(false)
    expect(isGenuiCandidate('[]')).toBe(false)
    expect(isGenuiCandidate('null')).toBe(false)
  })
})
