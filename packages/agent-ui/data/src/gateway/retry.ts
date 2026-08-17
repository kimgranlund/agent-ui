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
    const onAbort = (): void => {
      clearTimeout(timer)
      reject(normalizeError(new DOMException('aborted', 'AbortError')))
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort) // no listener left behind on a long-lived signal
      resolve()
    }, ms)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

/** `withRetry(policy)` — SPEC-R10. */
export function withRetry(policy: RetryPolicy = {}): Middleware {
  const maxAttempts = policy.maxAttempts ?? 3
  const baseMs = policy.baseMs ?? 200
  const capMs = policy.capMs ?? 5_000

  return async (req, next) => {
    // The `idempotent` carrier header is READ here and stripped by the gateway's innermost fetch
    // step (never by this middleware — a re-shaped Request would needlessly transfer the body).
    const explicitIdempotent = req.headers.has(IDEMPOTENT_HEADER)
    const methodIdempotent = DEFAULT_IDEMPOTENT_METHODS.has(req.method.toUpperCase())
    const idempotent = methodIdempotent || explicitIdempotent

    // A request that can never be retried (single attempt, or non-idempotent under the default
    // predicate) is passed straight through — no clone, no body tee'd for a retry that cannot happen.
    const canRetry = maxAttempts > 1 && (policy.retryOn !== undefined || idempotent)
    if (!canRetry) {
      try {
        return await next(req)
      } catch (e) {
        throw normalizeError(e)
      }
    }

    let attempt = 0
    for (;;) {
      attempt++
      let res: Response | undefined
      let err: DataError | undefined
      try {
        // The LAST permitted attempt hands the original over — nothing left to preserve a body for.
        res = await next(attempt >= maxAttempts ? req : req.clone())
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
      // A response we are about to DISCARD releases its body (cancel is not a read — the caller
      // never sees this Response; leaving the stream open would hold the connection until GC).
      if (res?.body && !res.bodyUsed) void res.body.cancel().catch(() => {})
      const jitterCeiling = Math.min(capMs, baseMs * 2 ** attempt)
      const computedMs = Math.random() * jitterCeiling
      const delayMs = retryAfterMs !== undefined ? Math.max(computedMs, retryAfterMs) : computedMs

      await wait(delayMs, req.signal)
    }
  }
}
