// gateway/retry.ts — SPEC-R10: `withRetry`, exponential backoff + full jitter over retryable,
// idempotent requests. Honors `Retry-After`; interruptible by `req.signal`; attempt-capped.

import type { Middleware } from './client.ts'
import { IDEMPOTENT_HEADER } from './client.ts'
import { normalizeError, type DataError } from '../core/error.ts'

const DEFAULT_IDEMPOTENT_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE'])

export interface RetryPolicy {
  maxAttempts?: number
  baseMs?: number
  capMs?: number
  retryOn?: (err: DataError, res?: Response) => boolean
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined
  const asSeconds = Number(value)
  if (Number.isFinite(asSeconds)) return asSeconds * 1000
  const asDate = Date.parse(value)
  if (!Number.isNaN(asDate)) return Math.max(0, asDate - Date.now())
  return undefined
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(normalizeError(new DOMException('aborted', 'AbortError')))
      return
    }
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(normalizeError(new DOMException('aborted', 'AbortError')))
      },
      { once: true },
    )
  })
}

/** Strips the internal `idempotent` carrier header before the request reaches the real network. */
function withoutIdempotentHeader(req: Request): { req: Request; idempotent: boolean } {
  const idempotent = req.headers.has(IDEMPOTENT_HEADER)
  if (!idempotent) return { req, idempotent: false }
  const headers = new Headers(req.headers)
  headers.delete(IDEMPOTENT_HEADER)
  return { req: new Request(req, { headers }), idempotent: true }
}

/** `withRetry(policy)` — SPEC-R10. */
export function withRetry(policy: RetryPolicy = {}): Middleware {
  const maxAttempts = policy.maxAttempts ?? 3
  const baseMs = policy.baseMs ?? 200
  const capMs = policy.capMs ?? 5_000

  return async (req, next) => {
    const { req: cleaned, idempotent: explicitIdempotent } = withoutIdempotentHeader(req)
    const methodIdempotent = DEFAULT_IDEMPOTENT_METHODS.has(cleaned.method.toUpperCase())
    const idempotent = methodIdempotent || explicitIdempotent

    let attempt = 0
    for (;;) {
      attempt++
      let res: Response | undefined
      let err: DataError | undefined
      try {
        res = await next(cleaned.clone())
      } catch (e) {
        err = normalizeError(e)
      }

      // Classify without READING the body — status/headers only, the pass-through law (SPEC-R11).
      const classified: DataError | undefined = err ?? (res && !res.ok ? normalizeError(res) : undefined)
      const shouldRetry = policy.retryOn
        ? policy.retryOn(classified ?? { kind: 'unknown', retryable: false, cause: undefined }, res)
        : idempotent && (classified?.retryable ?? false)

      if (!shouldRetry || attempt >= maxAttempts) {
        if (err) throw err
        return res!
      }

      const retryAfterMs = res ? parseRetryAfter(res.headers.get('retry-after')) : undefined
      const jitterCeiling = Math.min(capMs, baseMs * 2 ** attempt)
      const computedMs = Math.random() * jitterCeiling
      const delayMs = retryAfterMs !== undefined ? Math.max(computedMs, retryAfterMs) : computedMs

      await wait(delayMs, cleaned.signal)
    }
  }
}
