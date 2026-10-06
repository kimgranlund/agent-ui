// scripted-mcp.ts: a scripted MCP server, Streamable-HTTP JSON-RPC, for the real MCP client and discovery
// (T-0011). Plug `fetchImpl` into `createMcpClient({ fetchImpl })` (directly, or through discovery's
// injectable `createClient`); `handle(req)` answers a real `Request` for a host that routes one.
//
// Methods: `initialize` answers the script's protocol version, `{ tools: {} }` capabilities and a fixed
// server info (with `Mcp-Session-Id` when the script sets `sessionId`); `notifications/initialized` answers
// HTTP 202 with no body; `tools/list` pages by `pageSize` (`nextCursor` is the next offset as a string);
// `tools/call` answers the step scripted for `params.name`. An unscripted tool is JSON-RPC error -32602, an
// unknown method -32601. `framing: 'sse'` wraps every response in one `event: message` frame.
//
// A `hang` step answers nothing until the request's signal aborts, then rejects with `signal.reason` when
// that is an Error, else with a plain Error named after the reason (`TimeoutError`, else `AbortError`). Never
// a bare DOMException: jsdom's is not `instanceof Error`, and the client maps only Error-named aborts to its
// `timeout` code. `calls` logs every JSON-RPC message received, notifications included.

import { MCP_PROTOCOL_VERSION } from '../agent/integrations/mcp/client.ts'
import type { McpCallResult, McpToolInfo } from '../agent/integrations/mcp/client.ts'

export type McpCallStep =
  | { result: McpCallResult }
  | { error: { code: number; message: string } }
  | { hang: true }

export interface McpServerScript {
  /** Default `json`, applied to every response. */
  framing?: 'json' | 'sse'
  /** The initialize result's version; default the client's `MCP_PROTOCOL_VERSION`. */
  protocolVersion?: string
  /** Sent as the `Mcp-Session-Id` header on the initialize response. */
  sessionId?: string
  tools: McpToolInfo[]
  /** The tools/list page size; default one page. */
  pageSize?: number
  /** Keyed by tool name. */
  calls?: Record<string, McpCallStep>
}

export interface McpReceived {
  method: string
  params?: Record<string, unknown>
}

export interface ScriptedMcpServer {
  handle(req: Request): Promise<Response>
  fetchImpl: typeof fetch
  calls: McpReceived[]
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

function abortReason(signal: AbortSignal): Error {
  const reason = signal.reason as { name?: unknown; message?: unknown } | undefined
  if (reason instanceof Error) return reason
  const name = reason?.name === 'TimeoutError' ? 'TimeoutError' : 'AbortError'
  const message = typeof reason?.message === 'string' ? reason.message : 'the request was aborted'
  return Object.assign(new Error(message), { name })
}

function hangUntilAborted(signal: AbortSignal | undefined): Promise<never> {
  return new Promise((_resolve, reject) => {
    if (signal === undefined) return // no signal: hang forever (the client always sends one)
    if (signal.aborted) {
      reject(abortReason(signal))
      return
    }
    signal.addEventListener('abort', () => reject(abortReason(signal)), { once: true })
  })
}

export function scriptedMcpServer(script: McpServerScript): ScriptedMcpServer {
  const calls: McpReceived[] = []
  const framing = script.framing ?? 'json'

  const reply = (id: unknown, payload: { result: unknown } | { error: { code: number; message: string } }, headers: Record<string, string> = {}): Response => {
    const body = JSON.stringify({ jsonrpc: '2.0', id, ...payload })
    if (framing === 'sse') {
      return new Response(`event: message\ndata: ${body}\n\n`, { status: 200, headers: { 'content-type': 'text/event-stream', ...headers } })
    }
    return new Response(body, { status: 200, headers: { 'content-type': 'application/json', ...headers } })
  }

  async function respond(text: string, signal: AbortSignal | undefined): Promise<Response> {
    let msg: unknown
    try {
      msg = JSON.parse(text)
    } catch {
      return new Response('not JSON', { status: 400 })
    }
    if (!isObject(msg) || typeof msg.method !== 'string') return new Response('not a JSON-RPC message', { status: 400 })
    const params = isObject(msg.params) ? msg.params : undefined
    calls.push(params === undefined ? { method: msg.method } : { method: msg.method, params })
    const id = msg.id
    switch (msg.method) {
      case 'initialize':
        return reply(
          id,
          { result: { protocolVersion: script.protocolVersion ?? MCP_PROTOCOL_VERSION, capabilities: { tools: {} }, serverInfo: { name: 'kit-scripted-mcp', version: '0.0.0' } } },
          script.sessionId !== undefined ? { 'Mcp-Session-Id': script.sessionId } : {},
        )
      case 'notifications/initialized':
        return new Response(null, { status: 202 })
      case 'tools/list': {
        const size = script.pageSize ?? Math.max(script.tools.length, 1)
        const offset = typeof params?.cursor === 'string' ? Number(params.cursor) : 0
        const page = script.tools.slice(offset, offset + size)
        const nextOffset = offset + size
        return reply(id, { result: { tools: page, ...(nextOffset < script.tools.length ? { nextCursor: String(nextOffset) } : {}) } })
      }
      case 'tools/call': {
        const name = typeof params?.name === 'string' ? params.name : ''
        const step = script.calls?.[name]
        if (step === undefined) return reply(id, { error: { code: -32602, message: `unscripted tool ${name}` } })
        if ('hang' in step) return hangUntilAborted(signal)
        if ('error' in step) return reply(id, { error: step.error })
        return reply(id, { result: step.result })
      }
      default:
        return reply(id, { error: { code: -32601, message: `unknown method ${msg.method}` } })
    }
  }

  const fetchImpl = (async (_input: unknown, init?: RequestInit): Promise<Response> => {
    const body = init?.body
    const text = typeof body === 'string' ? body : body == null ? '' : await new Response(body).text()
    return respond(text, init?.signal ?? undefined)
  }) as typeof fetch

  return {
    calls,
    fetchImpl,
    async handle(req: Request): Promise<Response> {
      return respond(await req.text(), req.signal)
    },
  }
}
