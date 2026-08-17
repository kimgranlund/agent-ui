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
   * sees a standard `Request`; the innermost fetch step strips it before the network.
   */
  idempotent?: boolean
}

/** Internal-only carrier header for `GatewayInit.idempotent` — never sent to the network (stripped innermost). */
export const IDEMPOTENT_HEADER = 'x-agent-ui-data-idempotent'

/**
 * Internal-only carrier header marking a request whose `init.body` was a one-shot `ReadableStream`
 * (SPEC-R9 AC4: `withToken` must not replay it after a 401 refresh). Set by the shaping step —
 * the ONLY place that still sees the raw `init.body` (every standard `Request` exposes any body,
 * even a string, as a `ReadableStream`, so a downstream `instanceof` test cannot tell them apart)
 * — and stripped by the innermost fetch step so it never reaches the network.
 */
export const ONE_SHOT_BODY_HEADER = 'x-agent-ui-data-one-shot-body'

const CARRIER_HEADERS: readonly string[] = [IDEMPOTENT_HEADER, ONE_SHOT_BODY_HEADER]

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

const ABSOLUTE_URL_RE = /^[a-z][a-z0-9+.-]*:\/\//i

/**
 * Resolves `input` against `baseUrl` WITHOUT inventing an origin (SPEC-R8 AC2 + the SPEC §5
 * `baseUrl: '/api/'` example): an absolute `input` is returned as-is; an absolute `baseUrl`
 * URL-resolves `input` against it; a relative `baseUrl` (`/api/`) is string-joined and the RESULT
 * stays relative — handed to `new Request` for the platform to resolve against its own ambient
 * base (a browser's document URL). No `baseUrl` → `input` untouched, same rule. Never reads
 * `location`/`document` (the headless invariant); in an ambient-base-less host (Node) a relative
 * result is the platform's own `TypeError`, exactly as a bare `fetch('/x')` would be.
 * @internal exported for the unit suite only — not on the `./gateway` barrel.
 */
export function resolveUrl(baseUrl: string | undefined, input: string): string {
  if (baseUrl === undefined || ABSOLUTE_URL_RE.test(input)) return input
  if (ABSOLUTE_URL_RE.test(baseUrl)) return new URL(input, baseUrl).toString()
  if (input.startsWith('/')) return input // a root-relative input replaces a relative base's path (URL semantics)
  return baseUrl.endsWith('/') ? baseUrl + input : `${baseUrl}/${input}`
}

function isReadableStream(body: unknown): boolean {
  return typeof ReadableStream !== 'undefined' && body instanceof ReadableStream
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
  const requestInit: RequestInit & { duplex?: 'half' } = { ...rest, headers, body: body as BodyInit | null | undefined }
  if (isReadableStream(body)) {
    headers.set(ONE_SHOT_BODY_HEADER, '1')
    // the platform REQUIRES `duplex: 'half'` to send a streaming body — set it unless the caller did
    if (!('duplex' in requestInit) || requestInit.duplex === undefined) requestInit.duplex = 'half'
  }
  return new Request(url, requestInit)
}

/** Strips every internal carrier header right before the real network call — a no-op (same object) when none is present. */
function withoutCarrierHeaders(req: Request): Request {
  if (!CARRIER_HEADERS.some((h) => req.headers.has(h))) return req
  const headers = new Headers(req.headers)
  for (const h of CARRIER_HEADERS) headers.delete(h)
  return new Request(req, { headers })
}

/** `createGateway({ baseUrl?, headers?, fetch?, middleware? })` — SPEC-R8. */
export function createGateway(opts: GatewayOptions = {}): Gateway {
  const doFetch = opts.fetch ?? fetch
  const chain = opts.middleware ?? []

  async function run(req: Request): Promise<Response> {
    // Innermost step: the real fetch call, carrier headers stripped. Middleware wraps around it,
    // outer-to-inner as listed.
    let next: (r: Request) => Promise<Response> = (r) => doFetch(withoutCarrierHeaders(r))
    for (let i = chain.length - 1; i >= 0; i--) {
      const mw = chain[i]
      const inner = next
      next = (r) => mw(r, inner)
    }
    return next(req)
  }

  async function request(input: string, init: GatewayInit = {}): Promise<Response> {
    const req = shapeRequest(opts.baseUrl, opts.headers, input, init)
    try {
      const res = await run(req)
      if (!(res instanceof Response)) throw new TypeError('middleware returned a non-Response value')
      return res
    } catch (e) {
      throw normalizeError(e) as DataError
    }
  }

  // The ONE built-in that consumes a body — a TERMINAL helper, not middleware (SPEC-R11).
  async function json<T>(input: string, init?: GatewayInit): Promise<T> {
    const res = await request(input, init)
    if (!res.ok) {
      // HTTP status FIRST: a non-JSON error body (a 502 text/html page) must still surface as
      // `kind: 'http'` with its status — the body is a best-effort payload, never the classifier.
      let body: unknown
      try {
        const text = await res.text()
        try {
          body = text.length > 0 ? JSON.parse(text) : undefined
        } catch {
          body = text
        }
      } catch {
        body = undefined
      }
      throw normalizeError(new HttpError(res.status, body))
    }
    if (res.status === 204 || res.status === 205) return undefined as T
    try {
      return (await res.json()) as T
    } catch (e) {
      throw normalizeError(e) // a SyntaxError from a malformed OK body → kind: 'parse'
    }
  }

  return { request, json }
}
