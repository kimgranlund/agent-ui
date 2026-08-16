// gateway/client.ts — SPEC-R8: `createGateway`, an onion of middleware around an injected `fetch`.
// Headless (SPEC §2's headless invariant covers gateway/** too).

import { HttpError, normalizeError, type DataError } from '../core/error.ts'

/** `(req, next) => Promise<Response>` — composed as an onion; first-listed is OUTERMOST (SPEC-R8). */
export type Middleware = (req: Request, next: (req: Request) => Promise<Response>) => Promise<Response>

export interface GatewayInit extends RequestInit {
  /** Convenience: serialized as the JSON body + `Content-Type: application/json` (merged under any explicit `init.body`). */
  json?: unknown
  /**
   * Opts a non-default-idempotent method (chiefly `POST`) into `withRetry`'s retry set (SPEC-R10).
   * Carried across the onion as a private header (`IDEMPOTENT_HEADER`) since `Middleware` only
   * sees a standard `Request`; `withRetry` reads and strips it before the real fetch.
   */
  idempotent?: boolean
}

/** Internal-only carrier header for `GatewayInit.idempotent` — never sent to the network (`withRetry` strips it). */
export const IDEMPOTENT_HEADER = 'x-agent-ui-data-idempotent'

// Deliberately narrower than `typeof fetch` (which also accepts a bare URL/string): every call site
// in this package always constructs a real `Request` first, so an injected stub only ever needs to
// accept one. The real global `fetch` still satisfies this (it accepts a superset of `Request`).
export type FetchLike = (req: Request) => Promise<Response>

export interface GatewayOptions {
  baseUrl?: string
  headers?: HeadersInit
  fetch?: FetchLike
  middleware?: readonly Middleware[]
}

export interface Gateway {
  request(input: string, init?: GatewayInit): Promise<Response>
  json<T>(input: string, init?: GatewayInit): Promise<T>
}

// A synthetic, never-dereferenced origin — NOT a DOM global (the headless invariant covers
// gateway/**, SPEC §2): the WHATWG `Request`/`URL` constructors require an absolute URL with no
// ambient base in a non-browser host (Node/undici), so a relative `input` with no `baseUrl`
// configured resolves against this fixed placeholder rather than reading `location.href`.
const SYNTHETIC_ORIGIN = 'http://localhost/'

function resolveUrl(baseUrl: string | undefined, input: string): string {
  if (/^[a-z]+:\/\//i.test(input)) return input // already absolute
  return new URL(input, baseUrl ?? SYNTHETIC_ORIGIN).toString()
}

function shapeRequest(baseUrl: string | undefined, defaultHeaders: HeadersInit | undefined, input: string, init: GatewayInit): Request {
  const url = resolveUrl(baseUrl, input)
  const headers = new Headers(defaultHeaders)
  if (init.headers) new Headers(init.headers).forEach((v, k) => headers.set(k, v)) // per-request wins
  let body = init.body
  if (init.json !== undefined && body === undefined) {
    body = JSON.stringify(init.json)
    if (!headers.has('content-type')) headers.set('content-type', 'application/json')
  }
  if (init.idempotent) headers.set(IDEMPOTENT_HEADER, '1')
  const { json: _json, idempotent: _idempotent, ...rest } = init
  void _json
  void _idempotent
  return new Request(url, { ...rest, headers, body: body as BodyInit | null | undefined })
}

/** `createGateway({ baseUrl?, headers?, fetch?, middleware? })` — SPEC-R8. */
export function createGateway(opts: GatewayOptions = {}): Gateway {
  const doFetch = opts.fetch ?? fetch
  const chain = opts.middleware ?? []

  async function run(req: Request): Promise<Response> {
    // Innermost step: the real fetch call. Middleware wraps around it, outer-to-inner as listed.
    let next: (r: Request) => Promise<Response> = (r) => doFetch(r)
    for (let i = chain.length - 1; i >= 0; i--) {
      const mw = chain[i]
      const inner = next
      next = (r) => mw(r, inner)
    }
    return next(req)
  }

  return {
    async request(input, init = {}) {
      const req = shapeRequest(opts.baseUrl, opts.headers, input, init)
      try {
        const res = await run(req)
        if (!(res instanceof Response)) throw new TypeError('middleware returned a non-Response value')
        return res
      } catch (e) {
        throw normalizeError(e) as DataError
      }
    },
    async json<T>(input: string, init?: GatewayInit): Promise<T> {
      const res = await this.request(input, init)
      let body: unknown
      try {
        body = await res.json()
      } catch (e) {
        throw normalizeError(e)
      }
      if (!res.ok) {
        throw normalizeError(new HttpError(res.status, body))
      }
      return body as T
    },
  }
}
