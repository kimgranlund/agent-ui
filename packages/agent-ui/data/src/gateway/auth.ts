// gateway/auth.ts — SPEC-R9: `withToken`, a request decorator with single-flight 401 refresh.
// The token is applied per request and NEVER written to any store/state this package owns.

import type { Middleware } from './client.ts'
import { ONE_SHOT_BODY_HEADER } from './client.ts'
import { type DataError, normalizeError } from '../core/error.ts'

export interface WithTokenOptions {
  refresh?: () => Promise<string>
  /** Header name for the token (default `Authorization`, value `Bearer <token>`). */
  header?: string
}

/**
 * A request whose ORIGINAL `init.body` was a one-shot `ReadableStream` (SPEC-R9 AC4). Read from the
 * shaping step's carrier header, never from `req.body instanceof ReadableStream` — every standard
 * `Request` exposes any body (a JSON string included) as a `ReadableStream`, so that test would
 * refuse to replay EVERY bodied request (the SPEC §5 `PATCH … json: u` example).
 */
function isOneShotBody(req: Request): boolean {
  return req.headers.has(ONE_SHOT_BODY_HEADER)
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

  function withAuth(req: Request, token: string | undefined): Request {
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
    const oneShot = isOneShotBody(req)
    // A replay-capable clone, taken BEFORE the first send: a re-creatable body (string/JSON/blob/
    // form) clones safely; a one-shot stream must not be teed just for a MAYBE-replay, so no clone.
    const replayable = oneShot ? undefined : req.clone()

    const first = withAuth(req, await getToken())
    const res = await next(first)
    if (res.status !== 401 || !opts.refresh) return res

    if (!replayable) throw UNREPLAYABLE_BODY

    // Throws the SAME DataError to every concurrent 401 if refresh rejects. The replay carries the
    // token `refresh()` RESOLVED — not a second `getToken()` read, which may lag behind the refresh.
    const fresh = await refreshOnce()
    const replayed = withAuth(replayable, fresh)
    return next(replayed) // a second 401 after replay is returned as-is — no loop
  }
}
