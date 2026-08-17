// core/error.ts — SPEC-R6: the ONE typed error envelope + normalizeError's mapping table.
// UI is driven from `kind`/`retryable` alone (SPEC-N-adjacent law) — never `instanceof` on a vendor error.

/** The finite set of error kinds every failure normalizes onto (SPEC-R6). */
export type DataErrorKind = 'http' | 'network' | 'abort' | 'parse' | 'unknown'

/** The ONE typed error envelope (SPEC §2 Definitions, SPEC-R6). */
export interface DataError {
  readonly kind: DataErrorKind
  readonly status?: number
  readonly code?: string
  readonly retryable: boolean
  readonly cause: unknown
}

/** HTTP status codes `normalizeError` treats as retryable (SPEC-R6). */
const RETRYABLE_HTTP_STATUSES: ReadonlySet<number> = new Set([408, 425, 429, 500, 502, 503, 504])

/**
 * Carries an HTTP failure's status + (optionally) its already-parsed body, since `normalizeError`
 * is synchronous and a `Response.body` is an async stream (SPEC-R11's pass-through law: nothing in
 * this package tees/reads a body on its behalf). The gateway's `json()` helper is the terminal
 * consumer that parses a body and throws this on a non-ok response.
 */
export class HttpError extends Error {
  readonly status: number
  readonly body: unknown
  constructor(status: number, body?: unknown) {
    super(`HTTP ${status}`)
    this.name = 'HttpError'
    this.status = status
    this.body = body
  }
}

/** Runtime type guard — an object already shaped like `DataError` (identity passthrough, SPEC-R6 AC1). */
export function isDataError(e: unknown): e is DataError {
  return (
    typeof e === 'object' &&
    e !== null &&
    'kind' in e &&
    'retryable' in e &&
    'cause' in e &&
    typeof (e as { kind: unknown }).kind === 'string'
  )
}

/** Build the `missing-capability` DataError `resource()`/`mutation()` fail fast with (SPEC-R2). */
export function missingCapabilityError(verb: string): DataError {
  return {
    kind: 'unknown',
    code: 'missing-capability',
    retryable: false,
    cause: new Error(`DataSource has no "${verb}" capability`),
  }
}

export interface NormalizeErrorOptions {
  /** Extracts a server-supplied error code from an already-parsed HTTP body (SPEC-R6 AC2). */
  extractCode?: (body: unknown) => string | undefined
}

/** Maps ANY failure onto the one `DataError` envelope (SPEC-R6). */
export function normalizeError(e: unknown, opts: NormalizeErrorOptions = {}): DataError {
  if (isDataError(e)) return e // identity passthrough

  if (e instanceof HttpError) {
    return {
      kind: 'http',
      status: e.status,
      retryable: RETRYABLE_HTTP_STATUSES.has(e.status),
      code: opts.extractCode?.(e.body),
      cause: e,
    }
  }

  if (typeof Response !== 'undefined' && e instanceof Response) {
    return { kind: 'http', status: e.status, retryable: RETRYABLE_HTTP_STATUSES.has(e.status), cause: e }
  }

  if (typeof DOMException !== 'undefined' && e instanceof DOMException && e.name === 'AbortError') {
    return { kind: 'abort', retryable: false, cause: e }
  }
  if (e instanceof Error && e.name === 'AbortError') {
    return { kind: 'abort', retryable: false, cause: e }
  }

  if (e instanceof SyntaxError) return { kind: 'parse', retryable: false, cause: e }

  if (e instanceof TypeError) return { kind: 'network', retryable: true, cause: e }

  return { kind: 'unknown', retryable: false, cause: e }
}
