// client.ts — LLD-C2 (SPEC-R24 AC1/AC2 / ADR-0177 cl.2, the F2/F4 freeze): the hand-rolled
// Streamable-HTTP JSON-RPC wire client. Node-side only (the ADR-0137 shell law) — this module never
// reads env, never touches the registry, never knows a manifest exists (S3's job); the auth header
// carries a key passed IN by the caller, never resolved here. F3 recorded: plain `fetch`, no SDK.
//
// Wire mechanics pinned by the LLD (§3.2), not re-derived here:
//   · Streamable HTTP only — every call is a POST to the ONE endpoint, `Accept: application/json,
//     text/event-stream`. The `initialize` handshake sends `protocolVersion: MCP_PROTOCOL_VERSION`;
//     a negotiated version outside ACCEPTED_PROTOCOL_VERSIONS is a server-scope SKIP (a discriminated
//     `{ok:false}` outcome, never a throw) — `tools/list` is never dialed for that server.
//   · A server-assigned `Mcp-Session-Id` is captured off the `initialize` response headers and echoed
//     verbatim on every later request; a server assigning none means the header is simply never sent.
//     Every post-initialize request also carries `MCP-Protocol-Version: <negotiated>`.
//   · A POST response arrives in ONE of two sanctioned framings — a single `application/json` body,
//     or a `text/event-stream` body — and BOTH parse to the same typed result through ONE shared
//     byte-capped reader (`readCapped`); the SSE leg skips interleaved notification/other-id frames
//     and stops at the response whose `id` matches the request's own monotonic id.
//   · `listTools()` follows `nextCursor` pagination to completion, bounded at 16 pages.
//   · The closed `McpClientError` taxonomy is the only typed failure surface this module produces;
//     any other exception (e.g. a raw network failure) is left to propagate un-wrapped — the LLD's
//     discovery-side catch-all (§3.4) never narrows to these codes, by design.

const DEFAULT_TIMEOUT_MS = 10_000
const DEFAULT_MAX_RESPONSE_BYTES = 1 << 20 // 1 MiB — the dev-proxy MAX_BODY / registry TRUST-NOTE parity
const MAX_LIST_PAGES = 16

/** The F2 freeze as one-line constants (LLD §3.2) — F4 widened the acceptance set by one member,
 *  zero client-design change. */
export const MCP_PROTOCOL_VERSION = '2025-06-18'
export const ACCEPTED_PROTOCOL_VERSIONS: readonly string[] = ['2025-06-18', '2025-03-26', '2025-11-25']

export interface McpClientOptions {
  endpoint: string
  /** Host-resolved key → `Authorization: Bearer <key>` on every request; never read from env here. */
  apiKey?: string
  /** Injectable transport (tests inject a scripted fake; default = global fetch). */
  fetchImpl?: typeof fetch
  /** Per-request timeout, default 10_000 ms (combined with a caller signal via AbortSignal.any). */
  timeoutMs?: number
  /** Per-response byte cap, default 1 MiB (dev-proxy MAX_BODY / registry TRUST-NOTE parity). */
  maxResponseBytes?: number
}

export type InitializeOutcome =
  | { ok: true; protocolVersion: string; sessionId?: string }
  | { ok: false; reason: 'unsupported-version'; negotiated: string }

export interface McpToolInfo {
  name: string
  title?: string
  description?: string
  inputSchema: Record<string, unknown>
}

export type McpContentPart =
  | { type: 'text'; text: string }
  | { type: string; [key: string]: unknown } // non-text — dropped with placeholder at mapping (S3)

export interface McpCallResult {
  content: McpContentPart[]
  isError?: boolean
}

export interface McpClient {
  initialize(): Promise<InitializeOutcome>
  listTools(): Promise<McpToolInfo[]>
  callTool(name: string, args: Record<string, unknown>, opts?: { signal?: AbortSignal; apiKey?: string }): Promise<McpCallResult>
}

/** Every non-version failure THROWS this (discovery catches per server; execute lets it ride to the
 *  adapter's is_error conversion). `code` is closed; `message` carries no key value ever. */
export class McpClientError extends Error {
  code: 'http' | 'timeout' | 'too-large' | 'parse' | 'jsonrpc' | 'too-many-pages'

  constructor(code: McpClientError['code'], message: string) {
    super(message)
    this.name = 'McpClientError'
    this.code = code
  }
}

interface JsonRpcRequestBody {
  jsonrpc: '2.0'
  /** Absent ⇒ a notification (no response expected — ANY 2xx is success, per the tolerant read). */
  id?: number
  method: string
  params?: Record<string, unknown>
}

interface JsonRpcResponseBody {
  jsonrpc?: unknown
  id?: unknown
  result?: unknown
  error?: { message?: unknown } | unknown
}

/** Read a `Response` body into text with the shared per-response byte cap — the SAME reader both
 *  sanctioned framings (JSON body / SSE-framed body) feed through, so the cap applies uniformly
 *  (LLD §3.2). A response with no body streams to an empty string. */
async function readCapped(response: Response, maxResponseBytes: number): Promise<string> {
  const body = response.body
  if (!body) return ''
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) {
      total += value.byteLength
      if (total > maxResponseBytes) {
        await reader.cancel().catch(() => {})
        throw new McpClientError('too-large', `response exceeded ${maxResponseBytes} bytes`)
      }
      chunks.push(value)
    }
  }
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new TextDecoder().decode(out)
}

/** Parse one JSON-RPC frame — the JSON body of the `application/json` framing, or one `data:` block
 *  of the SSE framing. A frame that doesn't parse to a JSON object is a `parse`-class failure (LLD
 *  §3.2's "malformed frame → parse" bullet). */
function parseJsonRpcFrame(text: string, method: string): JsonRpcResponseBody {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new McpClientError('parse', `${method}: malformed JSON in response`)
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new McpClientError('parse', `${method}: malformed JSON-RPC response`)
  }
  return parsed as JsonRpcResponseBody
}

/** Split an SSE body into per-event `data:` payloads (blank line = event boundary; multi-line
 *  `data:` fields join with `\n` per the SSE grammar). Comment lines / other fields are ignored —
 *  this client only ever needs the `data:` payload of each event. */
function splitSseFrames(text: string): string[] {
  return text
    .split(/\r?\n\r?\n/)
    .map((block) =>
      block
        .split(/\r?\n/)
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).replace(/^ /, ''))
        .join('\n'),
    )
    .filter((data) => data.length > 0)
}

/** Pull `result` out of one already-matched JSON-RPC response, or throw the `jsonrpc`-class error
 *  the LLD names for a response carrying an `error` member. */
function extractResult(parsed: JsonRpcResponseBody, method: string): unknown {
  if ('error' in parsed && parsed.error !== undefined) {
    const err = parsed.error as { message?: unknown } | undefined
    const message = err && typeof err.message === 'string' ? err.message : JSON.stringify(parsed.error)
    throw new McpClientError('jsonrpc', `${method}: ${message}`)
  }
  if (!('result' in parsed)) {
    throw new McpClientError('parse', `${method}: response has neither result nor error`)
  }
  return parsed.result
}

export function createMcpClient(opts: McpClientOptions): McpClient {
  const doFetch = opts.fetchImpl ?? fetch
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const maxResponseBytes = opts.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES

  let requestCounter = 0
  const nextId = (): number => ++requestCounter

  // Session state — one client instance per server per process lifetime (LLD §3.2 risk notes).
  let negotiatedVersion: string | undefined
  let sessionId: string | undefined

  function buildHeaders(kind: 'initialize' | 'post-init', apiKeyOverride: string | undefined): Headers {
    const headers = new Headers()
    headers.set('Content-Type', 'application/json')
    headers.set('Accept', 'application/json, text/event-stream')
    const key = apiKeyOverride ?? opts.apiKey
    if (key !== undefined && key.length > 0) headers.set('Authorization', `Bearer ${key}`)
    if (kind === 'post-init') {
      if (negotiatedVersion !== undefined) headers.set('MCP-Protocol-Version', negotiatedVersion)
      if (sessionId !== undefined) headers.set('Mcp-Session-Id', sessionId)
    }
    return headers
  }

  /** The one POST every request/notification rides. Non-2xx is ALWAYS `http` (the tolerant read
   *  applies only to what counts as success, not to the failure path) — read before any body bytes
   *  are pulled, so a large error page is never buffered. Abort (timeout OR a caller signal firing)
   *  is `timeout`; anything else fetch itself throws propagates un-wrapped (LLD §3.2's un-narrowed
   *  catch-all is the caller's job, not this module's). */
  async function post(
    body: JsonRpcRequestBody,
    kind: 'initialize' | 'post-init',
    callOpts?: { signal?: AbortSignal; apiKey?: string },
  ): Promise<Response> {
    const timeoutSignal = AbortSignal.timeout(timeoutMs)
    const signal = callOpts?.signal ? AbortSignal.any([timeoutSignal, callOpts.signal]) : timeoutSignal
    let response: Response
    try {
      response = await doFetch(opts.endpoint, {
        method: 'POST',
        headers: buildHeaders(kind, callOpts?.apiKey),
        body: JSON.stringify(body),
        signal,
      })
    } catch (error) {
      if (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')) {
        throw new McpClientError('timeout', `${body.method}: request timed out or was aborted`)
      }
      throw error
    }
    if (!response.ok) {
      throw new McpClientError('http', `${body.method}: HTTP ${response.status}`)
    }
    return response
  }

  /** A request that expects a matched JSON-RPC response, in either sanctioned framing. */
  async function requestResult(
    body: JsonRpcRequestBody,
    kind: 'initialize' | 'post-init',
    callOpts?: { signal?: AbortSignal; apiKey?: string },
  ): Promise<{ result: unknown; headers: Headers }> {
    const response = await post(body, kind, callOpts)
    const contentType = response.headers.get('content-type') ?? ''
    const text = await readCapped(response, maxResponseBytes)

    if (contentType.includes('application/json')) {
      const parsed = parseJsonRpcFrame(text, body.method)
      return { result: extractResult(parsed, body.method), headers: response.headers }
    }

    if (contentType.includes('text/event-stream')) {
      for (const frame of splitSseFrames(text)) {
        const parsed = parseJsonRpcFrame(frame, body.method)
        if (parsed.id === body.id) {
          return { result: extractResult(parsed, body.method), headers: response.headers }
        }
        // else: an interleaved notification or another request's frame — skip, keep scanning.
      }
      throw new McpClientError('parse', `${body.method}: no matching response frame in the SSE stream`)
    }

    throw new McpClientError('parse', `${body.method}: unrecognized response content-type "${contentType}"`)
  }

  /** `notifications/initialized` — success = ANY 2xx, no body expected/parsed (the tolerant read the
   *  LLD applies identically to the handshake and this notification). */
  async function postNotification(body: JsonRpcRequestBody): Promise<void> {
    await post(body, 'post-init')
  }

  return {
    async initialize(): Promise<InitializeOutcome> {
      const { result, headers } = await requestResult(
        {
          jsonrpc: '2.0',
          id: nextId(),
          method: 'initialize',
          params: {
            protocolVersion: MCP_PROTOCOL_VERSION,
            capabilities: {},
            clientInfo: { name: 'agent-ui-mcp-connector', version: '1.0.0' },
          },
        },
        'initialize',
      )

      const negotiated = result as { protocolVersion?: unknown } | undefined
      const version = typeof negotiated?.protocolVersion === 'string' ? negotiated.protocolVersion : ''
      if (!ACCEPTED_PROTOCOL_VERSIONS.includes(version)) {
        return { ok: false, reason: 'unsupported-version', negotiated: version }
      }

      negotiatedVersion = version
      sessionId = headers.get('Mcp-Session-Id') ?? undefined

      await postNotification({ jsonrpc: '2.0', method: 'notifications/initialized' })

      return sessionId === undefined ? { ok: true, protocolVersion: version } : { ok: true, protocolVersion: version, sessionId }
    },

    async listTools(): Promise<McpToolInfo[]> {
      const tools: McpToolInfo[] = []
      let cursor: string | undefined
      for (let page = 1; ; page++) {
        if (page > MAX_LIST_PAGES) {
          throw new McpClientError('too-many-pages', `tools/list exceeded ${MAX_LIST_PAGES} pages`)
        }
        const { result } = await requestResult(
          { jsonrpc: '2.0', id: nextId(), method: 'tools/list', params: cursor === undefined ? undefined : { cursor } },
          'post-init',
        )
        const parsed = result as { tools?: McpToolInfo[]; nextCursor?: unknown } | undefined
        if (!parsed || !Array.isArray(parsed.tools)) {
          throw new McpClientError('parse', 'tools/list: result missing `tools` array')
        }
        tools.push(...parsed.tools)
        cursor = typeof parsed.nextCursor === 'string' ? parsed.nextCursor : undefined
        if (cursor === undefined) break
      }
      return tools
    },

    async callTool(name, args, callOpts) {
      const { result } = await requestResult(
        { jsonrpc: '2.0', id: nextId(), method: 'tools/call', params: { name, arguments: args } },
        'post-init',
        callOpts,
      )
      const parsed = result as McpCallResult | undefined
      if (!parsed || !Array.isArray(parsed.content)) {
        throw new McpClientError('parse', 'tools/call: result missing `content` array')
      }
      return { content: parsed.content, isError: parsed.isError }
    },
  }
}
