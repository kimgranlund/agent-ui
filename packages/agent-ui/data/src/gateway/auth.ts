// gateway/auth.ts — SPEC-R9: `withToken`, a request decorator with single-flight 401 refresh.
// The token is applied per request and NEVER written to any store/state this package owns.

import type { Middleware } from './client.ts'
import { type DataError, normalizeError } from '../core/error.ts'

export interface WithTokenOptions {
  refresh?: () => Promise<string>
  /** Header name for the token (default `Authorization`, value `Bearer <token>`). */
  header?: string
}

function isStreamBody(req: Request): boolean {
  return req.body !== null && typeof ReadableStream !== 'undefined' && req.body instanceof ReadableStream
}

const UNREPLAYABLE_BODY: DataError = {
  kind: 'http',
  status: 401,
  code: 'unreplayable-body',
  retryable: false,
  cause: new Error('request body is a one-shot stream — cannot replay after a token refresh'),
}

/** `withToken(getToken, { refresh?, header? })` — SPEC-R9. */
export function withToken(getToken: () => string | Promise<string | undefined>, opts: WithTokenOptions = {}): Middleware {
  const headerName = opts.header ?? 'Authorization'
  let inFlightRefresh: Promise<string> | undefined

  async function applyAuth(req: Request): Promise<Request> {
    const token = await getToken()
    if (token === undefined) return req
    const headers = new Headers(req.headers)
    headers.set(headerName, `Bearer ${token}`)
    return new Request(req, { headers })
  }

  function refreshOnce(): Promise<string> {
    if (!inFlightRefresh) {
      const refresh = opts.refresh
      inFlightRefresh = (refresh ? refresh() : Promise.reject(new Error('no refresh configured')))
        .catch((e): never => {
          throw normalizeError(e, {}) // one shared, normalized rejection — Object.is across every queued awaiter
        })
        .finally(() => {
          inFlightRefresh = undefined
        })
    }
    return inFlightRefresh
  }

  return async (req, next) => {
    const streamBody = isStreamBody(req)
    // A replay-capable clone, taken BEFORE the first send — a non-stream body clones safely; a
    // stream body cannot be cloned after (or safely before) it's read, so no clone is attempted.
    const replayable = !streamBody ? req.clone() : undefined

    const first = await applyAuth(req)
    const res = await next(first)
    if (res.status !== 401 || !opts.refresh) return res

    if (streamBody || !replayable) throw UNREPLAYABLE_BODY

    await refreshOnce() // throws the SAME DataError to every concurrent 401 if refresh rejects; the
    // caller's own getToken() is expected to read whatever state `refresh()` just updated.
    const replayed = await applyAuth(replayable)
    return next(replayed) // a second 401 after replay is returned as-is — no loop
  }
}
