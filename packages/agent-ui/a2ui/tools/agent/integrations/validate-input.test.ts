// validate-input.test.ts — LLD-C2's gate (SPEC-R17 AC1): the dispatch-time checker's three outcomes
// (missing required · wrong type · conforming), each error naming its field, plus the registration-time
// subset assertion that keeps a schema the checker cannot enforce from ever reaching dispatch.
import { describe, it, expect } from 'vitest'
import { validateToolInput, assertSupportedSchema } from './validate-input.ts'

// The shape of a real v1 manifest schema (weather/currency), the subset this checker covers.
const SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    place: { type: 'string', description: 'City or place name' },
    amount: { type: 'number', description: 'The amount to convert' },
    nights: { type: 'integer', description: 'Whole nights' },
    refundable: { type: 'boolean', description: 'Refundable rate only' },
  },
  required: ['place', 'amount'],
}

describe('validateToolInput — the three outcomes (SPEC-R17)', () => {
  it('accepts a conforming input', () => {
    expect(validateToolInput(SCHEMA, { place: 'Helsinki', amount: 12.5 })).toEqual({ ok: true })
  })

  it('reports a missing required field by name', () => {
    expect(validateToolInput(SCHEMA, { amount: 12.5 })).toEqual({ ok: false, errors: ['`place` is required'] })
  })

  it('reports a wrong-typed field by name', () => {
    expect(validateToolInput(SCHEMA, { place: 'Helsinki', amount: '12.5' })).toEqual({
      ok: false,
      errors: ['`amount` must be a number'],
    })
  })

  it('accumulates every failing field in one verdict', () => {
    expect(validateToolInput(SCHEMA, { amount: null, nights: 1.5, refundable: 'yes' })).toEqual({
      ok: false,
      errors: [
        '`place` is required',
        '`amount` must be a number',
        '`nights` must be an integer',
        '`refundable` must be a boolean',
      ],
    })
  })

  it('permits unknown extra properties (JSON Schema default — ADR-0168 cl.3)', () => {
    expect(validateToolInput(SCHEMA, { place: 'Oslo', amount: 1, sneaky: { deep: true } })).toEqual({ ok: true })
  })

  it('accepts an integer for a `number` field and a whole float for `integer`', () => {
    expect(validateToolInput(SCHEMA, { place: 'Oslo', amount: 3, nights: 2.0 })).toEqual({ ok: true })
  })

  it('reads an explicitly-undefined required field as missing — one error, not two', () => {
    expect(validateToolInput(SCHEMA, { place: undefined, amount: 1 })).toEqual({
      ok: false,
      errors: ['`place` is required'],
    })
  })

  it('rejects NaN/Infinity for a number field (not JSON-expressible, never silently accepted)', () => {
    expect(validateToolInput(SCHEMA, { place: 'Oslo', amount: Number.NaN })).toEqual({
      ok: false,
      errors: ['`amount` must be a number'],
    })
  })

  it('never throws on a schema shape it does not understand (registration is the fail-fast seam)', () => {
    expect(validateToolInput({ type: 'string' }, { place: 'Oslo' })).toEqual({ ok: true })
    expect(validateToolInput({ type: 'object', properties: null, required: 'place' }, {})).toEqual({ ok: true })
  })
})

describe('assertSupportedSchema — the closed subset, registration-time only (SPEC-R17)', () => {
  it('accepts the supported subset', () => {
    expect(() => assertSupportedSchema(SCHEMA)).not.toThrow()
    expect(() => assertSupportedSchema({ type: 'object' })).not.toThrow()
    expect(() =>
      assertSupportedSchema({ type: 'object', description: 'x', properties: { q: { type: 'string' } }, required: [] }),
    ).not.toThrow()
  })

  it('rejects a nested object property', () => {
    expect(() =>
      assertSupportedSchema({ type: 'object', properties: { where: { type: 'object', properties: { city: { type: 'string' } } } } }),
    ).toThrow(/property `where` declares type "object"/)
  })

  it('rejects an array property', () => {
    expect(() => assertSupportedSchema({ type: 'object', properties: { tags: { type: 'array', items: { type: 'string' } } } })).toThrow(
      /property `tags` declares type "array"/,
    )
  })

  it('rejects a combinator at the root (oneOf/anyOf/allOf)', () => {
    for (const keyword of ['oneOf', 'anyOf', 'allOf', '$ref', 'additionalProperties']) {
      expect(() => assertSupportedSchema({ type: 'object', properties: {}, [keyword]: [] })).toThrow(
        new RegExp(`keyword \\\`${keyword.replace('$', '\\$')}\\\``),
      )
    }
  })

  it('rejects per-property keywords the checker cannot enforce (enum, format, pattern)', () => {
    for (const keyword of ['enum', 'format', 'pattern', 'minimum']) {
      expect(() => assertSupportedSchema({ type: 'object', properties: { code: { type: 'string', [keyword]: 'x' } } })).toThrow(
        new RegExp(`property \\\`code\\\` uses keyword \\\`${keyword}\\\``),
      )
    }
  })

  it('rejects a non-object root type', () => {
    expect(() => assertSupportedSchema({ type: 'array' })).toThrow(/root `type` must be "object"/)
    expect(() => assertSupportedSchema({})).toThrow(/root `type` must be "object"/)
  })

  it('rejects a malformed `required` or `properties`', () => {
    expect(() => assertSupportedSchema({ type: 'object', required: 'place' })).toThrow(/`required` must be an array/)
    expect(() => assertSupportedSchema({ type: 'object', required: ['place', 7] })).toThrow(/`required` must be an array/)
    expect(() => assertSupportedSchema({ type: 'object', properties: [] })).toThrow(/`properties` must be an object/)
    expect(() => assertSupportedSchema({ type: 'object', properties: { q: 'string' } })).toThrow(
      /property `q` must be a schema object/,
    )
  })
})
