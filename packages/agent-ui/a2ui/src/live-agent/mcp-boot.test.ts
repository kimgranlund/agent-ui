// mcp-boot.test.ts — LLD-C5's gate (mcp-connector.lld.md §5 / SPEC-R27 AC2): the MCP boot-await
// ready-gate inside `dev-proxy-plugin.ts`'s `configureServer`. Sits BESIDE chat-route.test.ts (the
// SAME fake-Vite-server harness precedent, `chat-route.test.ts:133-186`) rather than folding into
// it — this file's own `vi.mock` of the provider dispatch module is scoped to its own module
// registry, so neither file's mocks can leak into the other's suite.
//
// Five things S5+S6 add over the shipped S1-S4 seam, each its own describe block below:
//   1. the ready-gate itself — a request racing boot QUEUES on discovery, never served early
//      (the `mcpDiscovery` test-only injection, LLD §5.6 — a manually-resolved deferred, no sink,
//      no REGISTRY mutation);
//   2. once-per-lifetime — N requests to one booted proxy trigger the discovery pass exactly once;
//   3. empty-roster byte-identity — the DEFAULT (uninjected) path, against the real committed empty
//      roster, leaves `/status` and `/chat` behaving exactly as they did before this slice existed;
//   4. the fail-fast roster load is UNCONDITIONAL and SYNCHRONOUS inside `configureServer` (a
//      structural gate, the same class as this file's neighbor's `worker handleChat` parity check,
//      `chat-route.test.ts:231-244` — `validateMcpServersConfig`'s own throw behavior is S1's unit
//      contract, already proven in `servers-config.test.ts`; what's left to prove here is that S5's
//      WIRING calls it unguarded, so a real malformed roster is a boot failure, never deferred into
//      the first request);
//   5. (S6, LLD-C6 / SPEC-R28, the F1 ruling) the admin GET (`/integrations`) — rides the SAME
//      ready-gate as `/status`, and serves trios ONLY. `projectIntegrationTrios` is unit-tested
//      directly against a FABRICATED manifest array (never the real `REGISTRY` — the SPEC-R26/S4
//      untouched-registry discipline this whole arc holds) so the leak-proof claim holds for ANY
//      future registry content, not just today's three hand-authored entries.

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { a2uiDevProxyPlugin, projectIntegrationTrios } from '../../tools/agent/dev-proxy-plugin.ts'
import type { DiscoveryReport } from '../../tools/agent/integrations/mcp/discover.ts'
import { listIntegrations } from '../../tools/agent/integrations/index.ts'
import type { IntegrationManifest } from '../../tools/agent/integrations/index.ts'

declare const process: { cwd(): string; env: Record<string, string | undefined> }

// The plugin captures `process.env` by reference at CREATION time (its `config` hook — the
// `loadEnv` merge — is deliberately never invoked by this harness, the same choice
// chat-route.test.ts:134-137 makes: it would read the developer's real, gitignored `.env`). A key
// must be present for the `/chat` route's `resolveChatDispatch` to reach 200 instead of 503.
let previousKey: string | undefined
beforeAll(() => {
  previousKey = process.env['ANTHROPIC_API_KEY']
  process.env['ANTHROPIC_API_KEY'] = 'sk-test-value'
})
afterAll(() => {
  if (previousKey === undefined) delete process.env['ANTHROPIC_API_KEY']
  else process.env['ANTHROPIC_API_KEY'] = previousKey
})

// The impure `provider.stream` leg is mocked exactly like chat-route.test.ts's own suite (a separate
// module registry — this file's mock never touches that file's), so the empty-roster `/chat` case
// below can drive the REAL middleware end to end without a key or a network call.
// `validateProviderKeyCached` rides the SAME mock (ticket #1634's `/status` live-validation dispatch) —
// stubbed to resolve `true` so the pre-existing `/status` shape assertion below stays a no-network check,
// same posture as the `stream` stub above.
const captured = vi.hoisted(() => ({ requests: [] as Array<Record<string, unknown>> }))
vi.mock('../../tools/agent/providers/index.ts', () => ({
  providerFor: () => ({
    ok: true,
    provider: {
      async *stream(req: Record<string, unknown>) {
        captured.requests.push(req)
        yield 'stubbed reply'
      },
    },
  }),
  validateProviderKeyCached: async () => true,
}))

type Middleware = (req: unknown, res: unknown) => void

/** Wires a fresh plugin instance through the same fake-server harness `chat-route.test.ts` uses,
 *  returns the captured middleware handler. */
function mountPlugin(opts?: Parameters<typeof a2uiDevProxyPlugin>[0]): Middleware {
  let handler: Middleware | undefined
  const server = {
    middlewares: {
      use: (_mount: string, fn: Middleware) => {
        handler = fn
      },
    },
  }
  const plugin = a2uiDevProxyPlugin(opts)
  ;(plugin.configureServer as unknown as (s: unknown) => void)(server)
  if (!handler) throw new Error('mcp-boot.test.ts: configureServer never registered a middleware')
  return handler
}

/** GET /status — the cheapest real route to drive the ready-gate through (no request body to read,
 *  no key required). */
function getStatus(handler: Middleware): Promise<{ status: number; body: Record<string, unknown> }> {
  const req = { method: 'GET', url: '/status' }
  let settle: (v: { status: number; body: Record<string, unknown> }) => void = () => {}
  const done = new Promise<{ status: number; body: Record<string, unknown> }>((resolve) => {
    settle = resolve
  })
  const res = {
    statusCode: 0,
    setHeader: () => {},
    end: (payload: string) => settle({ status: res.statusCode, body: JSON.parse(payload) as Record<string, unknown> }),
  }
  handler(req, res)
  return done
}

/** GET /integrations (S6, LLD-C6) — the SAME shape as `getStatus` above, one sub-path over. */
function getIntegrations(handler: Middleware): Promise<{ status: number; body: Record<string, unknown> }> {
  const req = { method: 'GET', url: '/integrations' }
  let settle: (v: { status: number; body: Record<string, unknown> }) => void = () => {}
  const done = new Promise<{ status: number; body: Record<string, unknown> }>((resolve) => {
    settle = resolve
  })
  const res = {
    statusCode: 0,
    setHeader: () => {},
    end: (payload: string) => settle({ status: res.statusCode, body: JSON.parse(payload) as Record<string, unknown> }),
  }
  handler(req, res)
  return done
}

/** POST /chat — the chat-route.test.ts `postChat` helper, reproduced here (the sibling-file
 *  isolation this header comment names) rather than imported, so this file carries no dependency on
 *  that one's internals. */
function postChat(handler: Middleware, body: unknown): Promise<{ status: number; json: Record<string, unknown> }> {
  const listeners: Record<string, Array<(arg?: unknown) => void>> = {}
  const req = {
    method: 'POST',
    url: '/chat',
    on(event: string, cb: (arg?: unknown) => void) {
      ;(listeners[event] ??= []).push(cb)
      if (event === 'end') {
        queueMicrotask(() => {
          for (const fn of listeners['data'] ?? []) fn(JSON.stringify(body))
          for (const fn of listeners['end'] ?? []) fn()
        })
      }
    },
  }
  let settle: (v: { status: number; json: Record<string, unknown> }) => void = () => {}
  const done = new Promise<{ status: number; json: Record<string, unknown> }>((resolve) => {
    settle = resolve
  })
  const res: { statusCode: number; setHeader: (k: string, v: string) => void; end: (payload: string) => void } = {
    statusCode: 0,
    setHeader: () => {},
    end: (payload: string) => settle({ status: res.statusCode, json: JSON.parse(payload) as Record<string, unknown> }),
  }
  handler(req, res)
  return done
}

describe('the MCP boot-await ready-gate (SPEC-R27 AC2, LLD §5.3) — a request racing boot queues, never served early', () => {
  it('answers a request ONLY after the injected discovery pass resolves', async () => {
    let resolveDiscovery!: (r: DiscoveryReport) => void
    const discovery = new Promise<DiscoveryReport>((resolve) => {
      resolveDiscovery = resolve
    })
    const handler = mountPlugin({ mcpDiscovery: () => discovery })

    const done = getStatus(handler)
    let settled = false
    const order: string[] = []
    void done.then(() => {
      settled = true
      order.push('responded')
    })

    // Give the handler's `await mcpReady` every chance to resolve if the gate were missing — a few
    // microtask turns is enough for a same-tick `await` chain to fully unwind.
    for (let i = 0; i < 5; i++) await Promise.resolve()
    expect(settled).toBe(false) // still queued — discovery hasn't resolved yet

    order.push('discovery-resolved')
    resolveDiscovery({ registered: [], skipped: [] })
    await done
    expect(order).toEqual(['discovery-resolved', 'responded'])
  })
})

describe('once-per-lifetime discovery (SPEC-R27 — no refresh mechanism, LLD §5.2)', () => {
  it('N requests to one booted proxy trigger the injected discovery pass exactly once', async () => {
    let calls = 0
    const handler = mountPlugin({
      mcpDiscovery: () => {
        calls += 1
        return Promise.resolve({ registered: [], skipped: [] })
      },
    })

    // Second and third requests never re-run discovery — `configureServer` itself is Vite's own
    // once-per-server-lifetime hook (never re-invoked by this plugin's own design, the same posture
    // every other per-boot load in it takes — the catalog/shard reads and providers.json's own
    // `loadConfig()` fail-fast call have no cross-call guard either); what THIS proves is the
    // memoized-promise half of that contract, the half a request can actually observe.
    await getStatus(handler)
    await getStatus(handler)
    await getStatus(handler)

    expect(calls).toBe(1)
  })
})

describe('empty-roster byte-identity (SPEC-R27 AC2 — the default, uninjected path over the real committed roster)', () => {
  it('/status answers exactly the pre-MCP shape (boolean + count, no MCP fact)', async () => {
    const handler = mountPlugin() // no mcpDiscovery override — the REAL discoverMcpIntegrations, REAL committed empty roster
    const { status, body } = await getStatus(handler)
    expect(status).toBe(200)
    expect(Object.keys(body).sort()).toEqual(['available', 'providers'])
    expect(typeof body['available']).toBe('boolean')
    expect(typeof body['providers']).toBe('number')
  })

  it('/chat builds the SAME hand-authored tool dispatch as before — an empty MCP roster adds nothing (SPEC-R19 AC1 unchanged)', async () => {
    const before = captured.requests.length
    const handler = mountPlugin()
    const out = await postChat(handler, { system: 'be helpful', model: 'claude-sonnet-5', messages: [], integrations: ['weather', 'currency'] })
    expect(out.status).toBe(200)
    expect(out.json['text']).toBe('stubbed reply')
    const request = captured.requests[before]!
    expect((request['tools'] as Array<{ name: string }>).map((t) => t.name)).toEqual(['weather', 'currency'])
    expect(typeof request['executeTool']).toBe('function')
  })
})

// ── S6 (LLD-C6, SPEC-R28) — the admin GET, the F1 ruling (Kim, GH #567) ─────────────────────────────────

describe('projectIntegrationTrios (LLD-C6 §3.5, SPEC-R28) — a fact-only projection, leak-proof by construction', () => {
  // A FABRICATED manifest array — never the real REGISTRY (registry.ts is frozen, §0; and no test in
  // this arc mutates the module singleton, the SPEC-R26/S4 discipline). `mcp:*`-shaped on purpose, so
  // the leak-proof claim covers a DISCOVERED manifest too, not only a hand-authored one.
  const fake: IntegrationManifest[] = [
    {
      id: 'weather',
      version: '1.0.0',
      label: 'Weather (Open-Meteo)',
      description: 'Current conditions. Keyless.',
      tool: { name: 'weather', description: 'weather', input_schema: { type: 'object', properties: {} } },
      auth: 'none',
      execute: async () => '',
    },
    {
      id: 'mcp:acme:lookup',
      version: '1.0.0',
      label: 'Acme: lookup',
      description: 'A discovered MCP tool.',
      // The WIRE tool name is deliberately unrelated text to the id/label/description above (the
      // three-fact law, SPEC-R25) — so a leak of it is unambiguously detectable below, unlike `lookup`
      // itself which legitimately appears in the label by the mapping's own convention.
      tool: { name: 'internal_op_9f3', description: 'looks things up', input_schema: { type: 'object', properties: {} } },
      auth: 'serverKey',
      envKey: 'ACME_API_KEY',
      execute: async () => '',
    },
  ]

  it('carries every {id, label, description} trio, in order, and NOTHING else', () => {
    expect(projectIntegrationTrios(fake)).toEqual([
      { id: 'weather', label: 'Weather (Open-Meteo)', description: 'Current conditions. Keyless.' },
      { id: 'mcp:acme:lookup', label: 'Acme: lookup', description: 'A discovered MCP tool.' },
    ])
  })

  it('never leaks envKey, auth, tool, or version — a JSON round-trip proves no OTHER field survives', () => {
    const projected = projectIntegrationTrios(fake)
    for (const row of projected) expect(Object.keys(row).sort()).toEqual(['description', 'id', 'label'])
    const json = JSON.stringify(projected)
    expect(json).not.toContain('ACME_API_KEY')
    expect(json).not.toContain('serverKey')
    expect(json).not.toContain('internal_op_9f3') // the wire tool.name — absent from the trio entirely
  })

  it('an empty manifest list projects to an empty array', () => {
    expect(projectIntegrationTrios([])).toEqual([])
  })
})

describe('GET /integrations rides the SAME boot-await ready-gate as /status (SPEC-R28, LLD-C6)', () => {
  it('answers a request ONLY after the injected discovery pass resolves', async () => {
    let resolveDiscovery!: (r: DiscoveryReport) => void
    const discovery = new Promise<DiscoveryReport>((resolve) => {
      resolveDiscovery = resolve
    })
    const handler = mountPlugin({ mcpDiscovery: () => discovery })

    const done = getIntegrations(handler)
    let settled = false
    void done.then(() => {
      settled = true
    })

    for (let i = 0; i < 5; i++) await Promise.resolve()
    expect(settled).toBe(false) // still queued — discovery hasn't resolved yet

    resolveDiscovery({ registered: [], skipped: [] })
    const { status } = await done
    expect(status).toBe(200)
  })
})

describe('GET /integrations — empty-roster byte-identity (SPEC-R28 AC1 — the served trios equal listIntegrations(), no leak)', () => {
  it('the served set equals the REAL registry\'s trio projection (today: the three hand-authored entries only)', async () => {
    const handler = mountPlugin() // no mcpDiscovery override — REAL discovery, REAL committed EMPTY roster
    const { status, body } = await getIntegrations(handler)
    expect(status).toBe(200)
    // GH #783 S2 (SPEC-R4 AC2 / ADR-0185, LLD-C4 §3.2): the body gained an ADDITIVE `services` key
    // (a same-change consequence of the SPEC-mandated widening, SPEC-N2) — `integrations` itself
    // stays byte-identical, proven by the untouched assertion below.
    expect(Object.keys(body)).toEqual(['integrations', 'services'])
    expect(body['integrations']).toEqual(projectIntegrationTrios(listIntegrations()))
  })

  it('the response body carries no URL, envKey, key value, or JSON-RPC fact (SPEC-R28 cl.2 boundary)', async () => {
    const handler = mountPlugin()
    const { body } = await getIntegrations(handler)
    const json = JSON.stringify(body)
    for (const leak of ['endpoint', 'envKey', 'jsonrpc', 'http://', 'https://']) {
      expect(json.toLowerCase(), `leaked "${leak}"`).not.toContain(leak.toLowerCase())
    }
  })
})

describe('the MCP roster is validated at BOOT, unconditionally (structural gate — the class chat-route.test.ts:231-244 already uses for the Worker parity check)', () => {
  const source = readFileSync(`${process.cwd()}/packages/agent-ui/a2ui/tools/agent/dev-proxy-plugin.ts`, 'utf8') as string
  const configureServerBody = source.slice(source.indexOf('configureServer(server)'), source.indexOf('server.middlewares.use(MOUNT'))

  it('calls validateMcpServersConfig unconditionally, before the middleware handler is even registered — never inside a try/catch that could defer a malformed roster into the first request instead of failing boot', () => {
    expect(configureServerBody).toContain('validateMcpServersConfig(')
    expect(configureServerBody).not.toMatch(/try\s*\{/)
  })
})
