// genui-line.test.ts — the round-trip + whole-line-rejection matrix for the site-local GenUI wire stub
// (genui-line.ts), mirroring genui-surface.spec.md SPEC-R1 AC1's own acceptance criteria: a well-formed
// envelope round-trips; a `version` key, an `a2uiMeta` key, a non-object `genui`, an empty/missing
// `surfaceId`, a non-string `html`, or an over-cap `html` each return `undefined` — whole-line rejection,
// never a throw.
import { describe, it, expect } from 'vitest'
import { readGenuiLine, isGenuiLine, formatGenuiLine, GENUI_MAX_HTML_BYTES } from './genui-line.ts'

describe('readGenuiLine — the round-trip (SPEC-R1 AC1)', () => {
  it('round-trips a well-formed envelope', () => {
    const line = formatGenuiLine('demo-surface', '<!DOCTYPE html><html><body>hi</body></html>')
    expect(readGenuiLine(line)).toEqual({ genui: { surfaceId: 'demo-surface', html: '<!DOCTYPE html><html><body>hi</body></html>' } })
    expect(isGenuiLine(line)).toBe(true)
  })

  it('rejects malformed JSON — never throws', () => {
    expect(() => readGenuiLine('{not json')).not.toThrow()
    expect(readGenuiLine('{not json')).toBeUndefined()
  })

  it('rejects a line carrying a `version` key (an A2uiServerMessage shape, not a genui line)', () => {
    const line = JSON.stringify({ version: 'v1.0', genui: { surfaceId: 'x', html: '<p>hi</p>' } })
    expect(readGenuiLine(line)).toBeUndefined()
  })

  it('rejects a line carrying an `a2uiMeta` key (a meta-line shape, not a genui line)', () => {
    const line = JSON.stringify({ a2uiMeta: { note: 'hi' }, genui: { surfaceId: 'x', html: '<p>hi</p>' } })
    expect(readGenuiLine(line)).toBeUndefined()
  })

  it('rejects a non-object `genui` value', () => {
    expect(readGenuiLine(JSON.stringify({ genui: 'nope' }))).toBeUndefined()
    expect(readGenuiLine(JSON.stringify({ genui: null }))).toBeUndefined()
    expect(readGenuiLine(JSON.stringify({ genui: ['x'] }))).toBeUndefined()
  })

  it('rejects a missing/empty surfaceId', () => {
    expect(readGenuiLine(JSON.stringify({ genui: { html: '<p>hi</p>' } }))).toBeUndefined()
    expect(readGenuiLine(JSON.stringify({ genui: { surfaceId: '', html: '<p>hi</p>' } }))).toBeUndefined()
  })

  it('rejects a non-string html', () => {
    expect(readGenuiLine(JSON.stringify({ genui: { surfaceId: 'x', html: 123 } }))).toBeUndefined()
    expect(readGenuiLine(JSON.stringify({ genui: { surfaceId: 'x' } }))).toBeUndefined()
  })

  it('accepts exactly GENUI_MAX_HTML_BYTES and rejects one byte more (the boundary, SPEC-R2)', () => {
    const atCap = 'x'.repeat(GENUI_MAX_HTML_BYTES)
    const overCap = 'x'.repeat(GENUI_MAX_HTML_BYTES + 1)
    expect(readGenuiLine(formatGenuiLine('s', atCap))).toBeDefined()
    expect(readGenuiLine(formatGenuiLine('s', overCap))).toBeUndefined()
  })

  it('negative control: isGenuiLine genuinely distinguishes a real A2UI line from a genui line', () => {
    expect(isGenuiLine(JSON.stringify({ version: 'v1.0', createSurface: { surfaceId: 'x', catalogId: 'agent-ui' } }))).toBe(false)
    expect(isGenuiLine(formatGenuiLine('x', '<p>hi</p>'))).toBe(true)
  })
})
