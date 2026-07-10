// dev-proxy-plugin.test.ts — LLD-C8 / SPEC-R18 AC3 offline legs. Drives the REAL Vite plugin's captured
// middleware handler with minimal fake `IncomingMessage`/`ServerResponse` stand-ins (an `EventEmitter`-
// based fake request so `readBody`'s `req.on('data'|'end'|'error', …)` behaves exactly as it would against
// a real Node stream — listeners attach synchronously before the handler's first `await`, so emitting the
// body immediately after invoking the handler is safe) — the LLD's own testability seam
// (`FeedDevProxyPluginOptions.provider`) lets this run the FULL POST path with a stub `AgentProvider`, no
// live model, no `process.env` key (the `/__a2ui/agent` proxy's own gate-covering-with-no-live-model
// precedent, generalized to a Plugin-level harness since this proxy has no prior unit-test precedent).
import { describe, expect, it, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin, ViteDevServer } from 'vite'
import { a2aFeedDevProxyPlugin } from '../../tools/feed/dev-proxy-plugin.ts'
import { createFrameAssembler } from '../../tools/feed/frames.ts'
import { validateA2a } from '../protocol/validate.ts'
import { validateA2ui, defaultCatalog } from '@agent-ui/a2ui'
import { wrapClientTurn, unwrapTurn } from '../../../a2ui/tools/pipeline/transports/a2a.ts'
import type { AgentProvider } from '../../../a2ui/tools/agent/agent-transport.ts'

const PROTOCOL_VERSION = '0.3.0'

// ── minimal fakes ────────────────────────────────────────────────────────────────────────────────────────
class FakeReq extends EventEmitter {
  method: string
  url: string
  constructor(method: string, url: string) {
    super()
    this.method = method
    this.url = url
  }
}

class FakeRes {
  statusCode = 200
  headersSent = false
  private readonly headers: Record<string, string> = {}
  private readonly chunks: string[] = []
  private resolveDone!: () => void
  readonly done: Promise<void> = new Promise((resolve) => {
    this.resolveDone = resolve
  })
  setHeader(name: string, value: string): void {
    this.headers[name] = value
  }
  getHeader(name: string): string | undefined {
    return this.headers[name]
  }
  write(chunk: string): boolean {
    this.headersSent = true
    this.chunks.push(chunk)
    return true
  }
  end(chunk?: string): void {
    this.headersSent = true
    if (chunk !== undefined) this.chunks.push(chunk)
    this.resolveDone()
  }
  get body(): string {
    return this.chunks.join('')
  }
}

type MiddlewareHandler = (req: IncomingMessage, res: ServerResponse) => void

/** Mount the plugin, capture its ONE registered middleware handler (`server.middlewares.use(MOUNT, fn)`). */
function captureHandler(plugin: Plugin): MiddlewareHandler {
  let captured: MiddlewareHandler | undefined
  const fakeServer = {
    middlewares: { use: (_mount: string, fn: MiddlewareHandler) => (captured = fn) },
  }
  // `configureServer` is typed as `ServerHook | ObjectHook<ServerHook>` (Vite may wrap it with
  // `{handler, order}`) — this plugin always defines the plain-function form, but the type is a union, so
  // unwrap defensively rather than asserting the function shape.
  const hook = plugin.configureServer
  const fn = typeof hook === 'function' ? hook : hook?.handler
  if (fn === undefined) throw new Error('plugin has no configureServer hook')
  // `this` inside `configureServer` is a plugin-context object this plugin never reads — an empty stub is fine.
  ;(fn as (this: unknown, server: ViteDevServer) => void).call({}, fakeServer as unknown as ViteDevServer)
  if (captured === undefined) throw new Error('plugin never registered a middleware handler')
  return captured
}

/** Invoke the handler with a JSON body, returning the completed fake response. Safe to emit the body
 *  immediately: `readBody`'s `req.on(...)` calls run synchronously inside the handler's first `await`
 *  boundary, so they are always attached before this function's `emit` calls run. */
async function post(handler: MiddlewareHandler, body: unknown): Promise<FakeRes> {
  const req = new FakeReq('POST', '/')
  const res = new FakeRes()
  handler(req as unknown as IncomingMessage, res as unknown as ServerResponse)
  req.emit('data', JSON.stringify(body))
  req.emit('end')
  await res.done
  return res
}

async function get(handler: MiddlewareHandler, url: string): Promise<FakeRes> {
  const req = new FakeReq('GET', url)
  const res = new FakeRes()
  handler(req as unknown as IncomingMessage, res as unknown as ServerResponse)
  await res.done
  return res
}

// ── a stub AgentProvider (produce-loop.test.ts's own VALID shape — a Button root) ──────────────────────────
const VALID_NOTE_AND_PAYLOAD =
  '{"a2uiMeta":{"note":"Here you go."}}\n' +
  '{"version":"v1.0","createSurface":{"surfaceId":"main","catalogId":"agent-ui"}}\n' +
  '{"version":"v1.0","updateComponents":{"surfaceId":"main","components":[{"id":"root","component":"Button","label":"Hi","action":{"action":"submit"}}]}}'

function stubProvider(output: string): { provider: AgentProvider; calls: () => number } {
  let n = 0
  const provider: AgentProvider = {
    async *stream() {
      n += 1
      yield output
    },
  }
  return { provider, calls: () => n }
}

// ── a dispatch-ready feed log: header + one caps-bearing user turn (HV-8) ──────────────────────────────────
function feedLog(): string[] {
  const header = JSON.stringify({
    a2aFeed: { protocolVersion: PROTOCOL_VERSION, a2ui: 'v1.0', provenance: { source: 'live', date: '2026-07-09' } },
  })
  const u1 = wrapClientTurn({ text: 'a submit button' }, { messageId: 'live-u1', contextId: 'live-ctx' })
  return [header, JSON.stringify(u1)]
}

describe('a2aFeedDevProxyPlugin — POST /__a2a/feed (LLD-C8, offline via the test-injected provider seam)', () => {
  it('a valid feed + a registered pair streams a reassemblable, valid frame turn — no key, no live model', async () => {
    const { provider, calls } = stubProvider(VALID_NOTE_AND_PAYLOAD)
    const plugin = a2aFeedDevProxyPlugin({ provider })
    const handler = captureHandler(plugin)

    const res = await post(handler, { feed: feedLog(), provider: 'anthropic', model: 'claude-sonnet-5' })

    expect(res.statusCode).toBe(200)
    expect(res.getHeader('content-type')).toBe('application/x-ndjson')
    expect(calls()).toBe(1) // the stub WAS dispatched — proves the full path actually ran

    const lines = res.body.split('\n').filter((l) => l.trim().length > 0)
    const assembler = createFrameAssembler()
    for (const line of lines) expect(assembler.push(line).ok).toBe(true)
    const result = assembler.complete()
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.message.role).toBe('agent')
    expect(result.message.messageId).toBe('live-a1') // first agent turn in this conversation
    expect(result.message.contextId).toBe('live-ctx')
    expect(validateA2a(result.message, { protocolVersion: PROTOCOL_VERSION, expect: 'message' })).toEqual([])

    const { envelopes, prose } = unwrapTurn(result.message)
    expect(prose).toEqual(['Here you go.']) // the peeled meta-line note rides as the leading TextPart
    expect(validateA2ui(envelopes, defaultCatalog).valid).toBe(true) // same-checker parity
  })

  it('an unregistered {provider,model} pair rejects 400 BEFORE any provider dispatch (SPEC-R18 AC3)', async () => {
    const { provider, calls } = stubProvider(VALID_NOTE_AND_PAYLOAD)
    const handler = captureHandler(a2aFeedDevProxyPlugin({ provider }))
    const res = await post(handler, { feed: feedLog(), provider: 'anthropic', model: 'not-a-real-model' })
    expect(res.statusCode).toBe(400)
    expect(calls()).toBe(0)
  })

  it('a caps-less tail rejects 400 BEFORE any provider dispatch (SPEC-R18 AC3)', async () => {
    const { provider, calls } = stubProvider(VALID_NOTE_AND_PAYLOAD)
    const handler = captureHandler(a2aFeedDevProxyPlugin({ provider }))
    const [header, u1] = feedLog()
    const tampered = JSON.parse(u1!) as { metadata?: unknown }
    delete tampered.metadata
    const res = await post(handler, { feed: [header, JSON.stringify(tampered)], provider: 'anthropic', model: 'claude-sonnet-5' })
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).error).toMatch(/a2uiClientCapabilities/)
    expect(calls()).toBe(0)
  })

  it('a schema-invalid line in the log rejects 400 BEFORE any provider dispatch', async () => {
    const { provider, calls } = stubProvider(VALID_NOTE_AND_PAYLOAD)
    const handler = captureHandler(a2aFeedDevProxyPlugin({ provider }))
    const [header] = feedLog()
    const bogus = '{"kind":"message","role":"user","messageId":"bad","parts":[{"kind":"bogus"}]}'
    const res = await post(handler, { feed: [header, bogus], provider: 'anthropic', model: 'claude-sonnet-5' })
    expect(res.statusCode).toBe(400)
    expect(calls()).toBe(0)
  })

  it('a malformed request body (missing fields) rejects 400, never throws', async () => {
    const { provider } = stubProvider(VALID_NOTE_AND_PAYLOAD)
    const handler = captureHandler(a2aFeedDevProxyPlugin({ provider }))
    const res = await post(handler, { provider: 'anthropic' })
    expect(res.statusCode).toBe(400)
  })

  it('a second agent turn in the SAME conversation gets the next ordinal (live-a2)', async () => {
    const { provider } = stubProvider(VALID_NOTE_AND_PAYLOAD)
    const handler = captureHandler(a2aFeedDevProxyPlugin({ provider }))
    const [header, u1] = feedLog()
    // Simulate: turn 1's agent reply already joined the log (its OWN unwrapped envelope lines, folded the
    // way `feed-session.ts`'s `turnFromMessage` stores an assistant turn), then a second user turn arrives.
    const a1 =
      '{"kind":"message","role":"agent","messageId":"live-a1","contextId":"live-ctx","parts":[' +
      '{"kind":"text","text":"Here you go."},' +
      '{"kind":"data","data":{"version":"v1.0","createSurface":{"surfaceId":"main","catalogId":"agent-ui"}},"metadata":{"mimeType":"application/a2ui+json"}}]}'
    const u2 = wrapClientTurn({ text: 'another one' }, { messageId: 'live-u2', contextId: 'live-ctx' })
    const res = await post(handler, { feed: [header, u1!, a1, JSON.stringify(u2)], provider: 'anthropic', model: 'claude-sonnet-5' })
    expect(res.statusCode).toBe(200)
    const lines = res.body.split('\n').filter((l) => l.trim().length > 0)
    const header0 = JSON.parse(lines[0]!) as { turn: { messageId: string } }
    expect(header0.turn.messageId).toBe('live-a2')
  })
})

describe('a2aFeedDevProxyPlugin — GET /__a2a/feed/status', () => {
  it('reports availability without ever exposing the key value', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test-not-a-real-key')
    try {
      const handler = captureHandler(a2aFeedDevProxyPlugin())
      const res = await get(handler, '/status')
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body) as { available: boolean; providers: number }
      expect(body.available).toBe(true)
      expect(body.providers).toBeGreaterThan(0)
      expect(res.body).not.toContain('sk-test-not-a-real-key')
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('reports unavailable when no provider key is configured', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    try {
      const handler = captureHandler(a2aFeedDevProxyPlugin())
      const res = await get(handler, '/status')
      const body = JSON.parse(res.body) as { available: boolean; providers: number }
      expect(body.available).toBe(false)
      expect(body.providers).toBe(0)
    } finally {
      vi.unstubAllEnvs()
    }
  })
})
