import { describe, it, expect } from 'vitest'
import { HttpError, isDataError, missingCapabilityError, normalizeError, type DataError } from './error.ts'

describe('normalizeError — SPEC-R6', () => {
  it('a fetch TypeError -> network / retryable', () => {
    const e = normalizeError(new TypeError('Failed to fetch'))
    expect(e.kind).toBe('network')
    expect(e.retryable).toBe(true)
  })

  it('a DOMException AbortError -> abort / not retryable', () => {
    const e = normalizeError(new DOMException('aborted', 'AbortError'))
    expect(e.kind).toBe('abort')
    expect(e.retryable).toBe(false)
  })

  it('an HttpError 503 -> http / retryable', () => {
    const e = normalizeError(new HttpError(503))
    expect(e.kind).toBe('http')
    expect(e.status).toBe(503)
    expect(e.retryable).toBe(true)
  })

  it('an HttpError 404 -> http / not retryable', () => {
    const e = normalizeError(new HttpError(404))
    expect(e.kind).toBe('http')
    expect(e.status).toBe(404)
    expect(e.retryable).toBe(false)
  })

  it('a SyntaxError from body parsing -> parse', () => {
    const e = normalizeError(new SyntaxError('Unexpected token'))
    expect(e.kind).toBe('parse')
    expect(e.retryable).toBe(false)
  })

  it('anything else -> unknown / not retryable', () => {
    const e = normalizeError('boom')
    expect(e.kind).toBe('unknown')
    expect(e.retryable).toBe(false)
  })

  it('an already-DataError passes through by identity', () => {
    const original: DataError = { kind: 'http', status: 500, retryable: true, cause: undefined }
    const e = normalizeError(original)
    expect(e).toBe(original)
  })

  it('a Response with a JSON body + extractor yields code; no extractor yields undefined', () => {
    const withExtractor = normalizeError(new HttpError(400, { error: { code: 'E_QUOTA' } }), {
      extractCode: (body) => (body as { error?: { code?: string } })?.error?.code,
    })
    expect(withExtractor.code).toBe('E_QUOTA')

    const withoutExtractor = normalizeError(new HttpError(400, { error: { code: 'E_QUOTA' } }))
    expect(withoutExtractor.code).toBeUndefined()
  })

  it('a real Response instance maps to http/status', () => {
    const res = new Response('nope', { status: 502 })
    const e = normalizeError(res)
    expect(e.kind).toBe('http')
    expect(e.status).toBe(502)
    expect(e.retryable).toBe(true)
  })
})

describe('isDataError', () => {
  it('recognizes a well-shaped DataError and rejects a plain Error', () => {
    expect(isDataError({ kind: 'unknown', retryable: false, cause: undefined })).toBe(true)
    expect(isDataError(new Error('nope'))).toBe(false)
    expect(isDataError(null)).toBe(false)
  })
})

describe('missingCapabilityError', () => {
  it('carries code missing-capability, kind unknown, not retryable', () => {
    const e = missingCapabilityError('subscribe')
    expect(e).toEqual({ kind: 'unknown', code: 'missing-capability', retryable: false, cause: e.cause })
    expect(e.cause).toBeInstanceOf(Error)
  })
})
