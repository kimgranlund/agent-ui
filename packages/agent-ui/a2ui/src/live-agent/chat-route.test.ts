// chat-route.test.ts — ALM-C6 (TKT-0052/ADR-0136): the `/chat` proxy branch's PURE validation spine
// (`resolveChatDispatch`, tools/agent/dev-proxy-plugin.ts), the deterministic 400/503 arms. The impure
// `provider.stream` fetch path stays MANUAL live acceptance (the SPEC-R3 adapter precedent) — a real key,
// `npm run dev`, one live turn. This test lives in the vitest+tsc include (`src/live-agent/`, the
// providers-config.test.ts / validate-mode.test.ts precedent) and imports the Node-scoped `tools/agent/`
// module by relative path, transitively typechecking it. Reads the real providers.json via readFileSync.

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { a2uiDevProxyPlugin, resolveChatDispatch, isChatBody } from '../../tools/agent/dev-proxy-plugin.ts'
import type { ProvidersConfig } from '../../tools/agent/providers-config.ts'

declare const process: { cwd(): string; env: Record<string, string | undefined> }

const CONFIG_PATH = `${process.cwd()}/packages/agent-ui/a2ui/tools/agent/providers.json`
const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8') as string) as ProvidersConfig

describe('resolveChatDispatch (ALM-C6 — the /chat route validation spine)', () => {
  it('derives the provider server-side + resolves to the env key when the pair is valid AND a key is set', () => {
    const out = resolveChatDispatch(config, { ANTHROPIC_API_KEY: 'sk-test-value' }, 'claude-sonnet-5')
    expect(out).toEqual({
      ok: true,
      provider: 'anthropic',
      apiKey: 'sk-test-value',
      endpoint: config.providers.anthropic!.endpoint,
    })
  })

  it('400 unknown-model: a model no IMPLEMENTED provider owns (incl. an implemented:false provider\'s model)', () => {
    expect(resolveChatDispatch(config, { ANTHROPIC_API_KEY: 'sk-x' }, 'not-a-real-model')).toEqual({
      ok: false,
      status: 400,
      error: 'unknown-model',
    })
    // gpt-4.1 ∈ openai (implemented:false) — must NOT resolve to a live call, a 400 not a 503
    expect(resolveChatDispatch(config, { ANTHROPIC_API_KEY: 'sk-x' }, 'gpt-4.1')).toEqual({
      ok: false,
      status: 400,
      error: 'unknown-model',
    })
  })

  it('503 no-key: a valid pair but no key configured for its provider (empty or absent env value)', () => {
    expect(resolveChatDispatch(config, {}, 'claude-sonnet-5')).toEqual({ ok: false, status: 503, error: 'no-key' })
    expect(resolveChatDispatch(config, { ANTHROPIC_API_KEY: '' }, 'claude-sonnet-5')).toEqual({
      ok: false,
      status: 503,
      error: 'no-key',
    })
  })

  it('never returns a key value on a degrade path (only the ok arm carries apiKey)', () => {
    const degrade = resolveChatDispatch(config, { ANTHROPIC_API_KEY: 'sk-secret' }, 'gpt-4.1')
    expect(JSON.stringify(degrade)).not.toContain('sk-secret')
  })
})

describe('isChatBody (TKT-0052 review MEDIUM-1 — the /chat route request-shape guard)', () => {
  it('accepts a well-shaped body', () => {
    expect(isChatBody({ system: 'be helpful', model: 'claude-sonnet-5', messages: [] })).toBe(true)
  })

  it('rejects a missing messages array', () => {
    expect(isChatBody({ system: 'be helpful', model: 'claude-sonnet-5' })).toBe(false)
  })

  it('rejects a non-string system or model', () => {
    expect(isChatBody({ system: 42, model: 'claude-sonnet-5', messages: [] })).toBe(false)
    expect(isChatBody({ system: 'be helpful', model: null, messages: [] })).toBe(false)
  })

  it('rejects a messages value that is not an array', () => {
    expect(isChatBody({ system: 'be helpful', model: 'claude-sonnet-5', messages: 'not-an-array' })).toBe(false)
  })

  it('effort is OPTIONAL (the Figma chat-input refactor\'s Effort picker) — absent is a valid body', () => {
    expect(isChatBody({ system: 'be helpful', model: 'claude-sonnet-5', messages: [] })).toBe(true)
  })

  it('accepts each of the four closed effort values', () => {
    for (const effort of ['low', 'medium', 'high', 'xhigh']) {
      expect(isChatBody({ system: 'be helpful', model: 'claude-sonnet-5', messages: [], effort })).toBe(true)
    }
  })

  it('rejects an effort value outside the closed four — never forwarded as an arbitrary string', () => {
    expect(isChatBody({ system: 'be helpful', model: 'claude-sonnet-5', messages: [], effort: 'ultra' })).toBe(false)
    expect(isChatBody({ system: 'be helpful', model: 'claude-sonnet-5', messages: [], effort: 3 })).toBe(false)
  })

  // ADR-0168 cl.5 (GH #402) / LLD-C6 — the guard stays UNCHANGED: `integrations` is optional and
  // fail-closed downstream (`resolveIntegrations` degrades a non-array/unknown value to `[]`), so an extra
  // key must never turn a legitimate body into a 400.
  // (The bodies are built as typed VARIABLES, never inline literals: `isChatBody`'s parameter type doesn't
  // name `integrations`, so an object literal carrying it would trip TS's excess-property check — the
  // widened variable is exactly what both host routes pass it.)
  it('an extra `integrations` key never makes a well-shaped body invalid (the field is optional + fail-closed downstream, never a 400)', () => {
    type ChatBodyIn = { system?: unknown; model?: unknown; messages?: unknown; effort?: unknown; integrations?: unknown }
    const withIds: ChatBodyIn = { system: 'be helpful', model: 'claude-sonnet-5', messages: [], integrations: ['weather'] }
    const withMalformed: ChatBodyIn = { ...withIds, integrations: 'not-an-array' }
    expect(isChatBody(withIds)).toBe(true)
    expect(isChatBody(withMalformed)).toBe(true)
  })
})

// ── ADR-0168 cl.5 / SPEC-R19 AC1 — the `/chat` route's TOOL-DISPATCH leg (GH #402) ─────────────────────
// This drives the REAL dev-proxy middleware (`a2uiDevProxyPlugin().configureServer`'s registered handler)
// end to end — body parse → isChatBody → resolveChatDispatch → providerFor → provider.stream — with the
// provider DISPATCH module mocked so `stream`'s actual request object is captured. No key, no network, no
// live model: the mock replaces the only impure leg. This is the half of the route the file header called
// "manual live acceptance"; the tool pair it now builds is deterministic, so it is testable here.
const captured = vi.hoisted(() => ({ requests: [] as Array<Record<string, unknown>> }))

// vitest hoists vi.mock above the imports — the factory may only close over `vi.hoisted` state.
vi.mock('../../tools/agent/providers/index.ts', () => ({
  providerFor: () => ({
    ok: true,
    provider: {
      // One fragment is all the route buffers — the `{text}` contract is unchanged by this slice.
      async *stream(req: Record<string, unknown>) {
        captured.requests.push(req)
        yield 'stubbed reply'
      },
    },
  }),
}))

type Middleware = (req: unknown, res: unknown) => void

let chatHandler: Middleware
let previousKey: string | undefined

beforeAll(() => {
  // The plugin captures `process.env` by reference when built (its `config` hook — the `loadEnv` merge —
  // is deliberately NOT invoked here: it would read the developer's real, gitignored `.env`).
  previousKey = process.env['ANTHROPIC_API_KEY']
  process.env['ANTHROPIC_API_KEY'] = 'sk-test-value'
  const plugin = a2uiDevProxyPlugin()
  const server = {
    middlewares: {
      use: (_mount: string, fn: Middleware) => {
        chatHandler = fn
      },
    },
  }
  ;(plugin.configureServer as unknown as (s: unknown) => void)(server)
})

afterAll(() => {
  if (previousKey === undefined) delete process.env['ANTHROPIC_API_KEY']
  else process.env['ANTHROPIC_API_KEY'] = previousKey
})

/** POST one body at the mounted `/chat` sub-path and resolve with the route's own JSON response plus the
 *  request object `provider.stream` actually received. */
async function postChat(body: unknown): Promise<{ status: number; json: Record<string, unknown>; streamRequest: Record<string, unknown> | undefined }> {
  const before = captured.requests.length
  const listeners: Record<string, Array<(arg?: unknown) => void>> = {}
  const req = {
    method: 'POST',
    url: '/chat',
    on(event: string, cb: (arg?: unknown) => void) {
      ;(listeners[event] ??= []).push(cb)
      // readBody registers data → end → error; emitting once `end` is armed keeps this independent of
      // whether the route awaits anything before reading the body.
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
  chatHandler(req, res)
  const answer = await done
  return { ...answer, streamRequest: captured.requests[before] }
}

describe('the /chat route builds the SHARED tool dispatch (SPEC-R19 AC1 — GH #402 branch (a))', () => {
  it('enabled ids reach provider.stream as the matching tools + executeTool pair', async () => {
    const out = await postChat({ system: 'be helpful', model: 'claude-sonnet-5', messages: [], integrations: ['weather', 'currency'] })
    expect(out.status).toBe(200)
    expect(out.json['text']).toBe('stubbed reply')
    const request = out.streamRequest!
    expect((request['tools'] as Array<{ name: string }>).map((t) => t.name)).toEqual(['weather', 'currency'])
    expect(typeof request['executeTool']).toBe('function')
  })

  it('an ABSENT integrations field leaves the stream request byte-identical (no tools key, no executeTool key)', async () => {
    const out = await postChat({ system: 'be helpful', model: 'claude-sonnet-5', messages: [] })
    expect(out.status).toBe(200)
    const request = out.streamRequest!
    expect('tools' in request).toBe(false)
    expect('executeTool' in request).toBe(false)
    // The whole request the route composes — the pre-amendment shape exactly.
    expect(Object.keys(request).sort()).toEqual(['effort', 'messages', 'model', 'system'])
  })

  it('a MALFORMED or unknown-id integrations value degrades to no tools — never a 400, never a partial pair', async () => {
    for (const integrations of ['weather', 42, null, [], ['not-a-real-integration'], [7]]) {
      const out = await postChat({ system: 'be helpful', model: 'claude-sonnet-5', messages: [], integrations })
      expect(out.status, `malformed integrations: ${JSON.stringify(integrations)}`).toBe(200)
      expect('tools' in out.streamRequest!).toBe(false)
      expect('executeTool' in out.streamRequest!).toBe(false)
    }
  })

  it("the dispatched executeTool is the SHARED one — an unknown wire name throws, a bad input is rejected by the manifest's schema before any integration runs", async () => {
    const out = await postChat({ system: 'be helpful', model: 'claude-sonnet-5', messages: [], integrations: ['weather'] })
    const executeTool = out.streamRequest!['executeTool'] as (name: string, input: unknown) => Promise<unknown>
    await expect(executeTool('not-a-tool', {})).rejects.toThrow(/unknown tool/)
    await expect(executeTool('weather', {})).rejects.toThrow(/weather: invalid input/)
  })
})

// The Worker's `/chat` twin (worker/index.ts `handleChat`) cannot be imported here — process-shim.ts's
// global `process.cwd()` override must never leak into a shared test process (vitest.config.ts's `tools`
// project + route-guards.test.ts both say so), and its `.json`/`.jsonl` raw imports are Wrangler-only. So
// its half of AC1 gets a STRUCTURAL gate instead of a behavioral one: assert the production route resolves
// and dispatches through the SAME shared pair, so the dev/prod fork GH #108 warned about can't reopen
// silently. Behavior for the shared pair itself is proven by tool-dispatch.test.ts + the route legs above.
describe('worker handleChat carries the same dispatch (structural parity gate — the Worker route is not importable under vitest)', () => {
  const source = readFileSync(`${process.cwd()}/packages/agent-ui/a2ui/tools/agent/worker/index.ts`, 'utf8') as string
  const handleChat = source.slice(source.indexOf('async function handleChat('), source.indexOf('async function handleProduce('))

  it('resolves the body\'s integrations and spreads the built pair into provider.stream', () => {
    expect(handleChat).toContain('resolveIntegrations(chatIntegrations')
    expect(handleChat).toContain('buildToolDispatch(active, hostEnv, request.signal)')
    expect(handleChat).toContain('...toolOpts')
  })

  it('reads integrations BEFORE isChatBody narrows the body (the field is no part of the 400 contract)', () => {
    expect(handleChat.indexOf('const chatIntegrations')).toBeLessThan(handleChat.indexOf('if (!isChatBody(body))'))
  })
})
