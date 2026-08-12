// mcp-enablement.test.ts — LLD-C7 (S5, mcp-agent-config.lld.md §5.4/§5.5, SPEC-R7 AC1/AC2, ADR-0185):
// the turn-time + degrade-ladder INTEGRATION suite. A NEW sibling module graph, never folded into
// `mcp-boot.test.ts` or `mcp-services-get.test.ts` (LLD §5.4 — vitest's per-file module isolation is
// exactly the fence that lets THIS file register fabricated `mcp:*` manifests through the REAL
// `registerIntegration` and mock `providerFor`, without touching either the real REGISTRY any other file
// sees or those files' own discipline). This slice is TEST-ONLY (the decomposition's S5 row): it grades
// the whole arc's already-shipped behavior — any gap it found would be a handback to the owning slice,
// never a local production patch.
//
// The verify-target: the tool defs that actually reach the provider adapter on a served turn. Both POST
// arms (`/chat`, the prose arm — ADR-0168 cl.5; and the bare-POST produce arm) build the SAME
// `resolveIntegrations` → `buildToolDispatch` → `...toolOpts` pair and spread it into
// `provider.stream({tools})`, so mocking `providerFor` (the `chat-route.test.ts` precedent) captures the
// offered `tool.name`s on EITHER arm — the SPEC-R7 "asserted on the captured provider-request tool defs,
// not narrated" contract.
//
// What is proven here:
//   · SPEC-R7 AC1 — a service ref `mcp:<sid>:*` expands to the referenced server's CURRENT registered
//     tools, unioned with an exact pinned id (both arms); and the CHURN claim — a tool registered under
//     the service between turns joins the next turn's offered set with the enablement list byte-identical.
//   · SPEC-R7 AC2 — the full degrade ladder, every rung a COMPLETED turn (200, no thrown error) with the
//     predicted (possibly empty) tool set: the empty/master-off projection · an entry disabled ·
//     an unknown/roster-removed ref · an unprovisioned `serverKey` through a ref · the Worker analogue
//     (a registry with no MCP manifests resolves every ref to nothing, fail-closed by construction).
// The SPEC-R1 AC2 master-switch case with a real `mcp:*` id lives at the SITE layer
// (`site/pages/agent-admin-app.test.ts`), NOT here and never in `packages/agent-ui/app/src` — LLD §5.3's
// grep-fence placement trap.

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { a2uiDevProxyPlugin } from '../../tools/agent/dev-proxy-plugin.ts'
import { registerIntegration, buildToolDispatch } from '../../tools/agent/integrations/index.ts'
import type { IntegrationManifest } from '../../tools/agent/integrations/index.ts'
import { resolveAgainst } from '../../tools/agent/integrations/registry.ts'
import { serviceRef } from '../../tools/agent/integrations/service-ref.ts'
import type { DiscoveryReport } from '../../tools/agent/integrations/mcp/discover.ts'
import type { TurnInput } from '../../src/agent/agent-transport.ts'

declare const process: { cwd(): string; env: Record<string, string | undefined> }

// ── the provider mock: the ONE impure leg, captured (chat-route.test.ts precedent) ──────────────────────
// `providerFor` is replaced so BOTH POST arms' `provider.stream(req)` land here — `req.tools` is exactly
// the `buildToolDispatch` pair the route composed from the expanded manifest set. The stub yields ONE
// note-only A2UI meta-line: on the produce arm that is a CLEAN note-only success (produce.ts: "empty ≠
// invalid"), so the turn completes without a halt; on the `/chat` arm it is simply the buffered `{text}`.
const captured = vi.hoisted(() => ({ requests: [] as Array<Record<string, unknown>> }))

vi.mock('../../tools/agent/providers/index.ts', () => ({
  providerFor: () => ({
    ok: true,
    provider: {
      async *stream(req: Record<string, unknown>) {
        captured.requests.push(req)
        yield '{"a2uiMeta":{"note":"ok"}}'
      },
    },
  }),
}))

type Middleware = (req: unknown, res: unknown) => void

/** A no-op discovery stub — this file registers its fabricated manifests directly (below), so the injected
 *  `mcpDiscovery` need only resolve immediately without a real network dial (SPEC-N3: zero external network
 *  in any gate). The committed (empty) roster is what the uninjected `mcpRoster` reads; neither the roster
 *  nor discovery feeds the enablement path — `resolveIntegrations` reads `listIntegrations()` directly. */
const noopDiscovery = (): Promise<DiscoveryReport> => Promise.resolve({ registered: [], skipped: [] })

/** A minimal, valid `IntegrationManifest` — `tool.name` derived from `id` so distinct ids never collide on
 *  `registerIntegration`'s duplicate-wire-name guard (mcp-services-get.test.ts's exact `fakeManifest`). */
function fakeManifest(id: string, auth: { auth: 'none' | 'serverKey'; envKey?: string }): IntegrationManifest {
  return {
    id,
    version: '1.0.0',
    label: id,
    description: `${id} — a fabricated manifest`,
    tool: { name: id.replace(/[^a-z0-9]/gi, '_'), description: 'x', input_schema: { type: 'object', properties: {} } },
    ...auth,
    execute: async () => '',
  }
}

/** Wires a fresh plugin instance through the same fake-server harness `chat-route.test.ts`/
 *  `mcp-services-get.test.ts` use; returns the captured middleware handler. */
function mountPlugin(): Middleware {
  let handler: Middleware | undefined
  const server = { middlewares: { use: (_mount: string, fn: Middleware) => (handler = fn) } }
  const plugin = a2uiDevProxyPlugin({ mcpDiscovery: noopDiscovery })
  ;(plugin.configureServer as unknown as (s: unknown) => void)(server)
  if (!handler) throw new Error('mcp-enablement.test.ts: configureServer never registered a middleware')
  return handler
}

const INTENT: TurnInput = { kind: 'intent', text: 'compute something', session: { turns: [] } }

/** POST one body at the given sub-path and resolve with the route's status once the response ends. Drives
 *  the REAL middleware end to end (body parse → resolve pair → resolveIntegrations → buildToolDispatch →
 *  provider.stream), supporting BOTH the produce arm (res.write lines + res.end()) and the `/chat` arm
 *  (res.end(payload)). */
function post(handler: Middleware, url: string, body: unknown): Promise<{ status: number; text: string }> {
  const listeners: Record<string, Array<(arg?: unknown) => void>> = {}
  const req = {
    method: 'POST',
    url,
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
  const chunks: string[] = []
  let settle: (v: { status: number; text: string }) => void = () => {}
  const done = new Promise<{ status: number; text: string }>((resolve) => (settle = resolve))
  const res = {
    statusCode: 0,
    headersSent: false,
    destroyed: false,
    setHeader: () => {},
    write: (payload: string) => {
      chunks.push(payload)
      return true
    },
    end: (payload?: string) => {
      if (payload) chunks.push(payload)
      settle({ status: res.statusCode, text: chunks.join('') })
    },
  }
  handler(req, res)
  return done
}

/** Drive one turn on the named arm with an enablement list; return the route status plus the `tool.name`s
 *  the provider adapter was actually offered (`[]` when the pair is empty — the produce arm passes
 *  `tools: undefined`, the `/chat` arm omits the key entirely; both normalize to `[]`). Sorted for a
 *  set-equality comparison against the expanded set (registration order is a separate, S1-owned concern). */
async function turn(handler: Middleware, arm: 'chat' | 'produce', integrations: string[]): Promise<{ status: number; tools: string[] }> {
  const before = captured.requests.length
  const body =
    arm === 'chat'
      ? { system: 'be helpful', model: 'claude-sonnet-5', messages: [], integrations }
      : { input: INTENT, provider: 'anthropic', model: 'claude-sonnet-5', integrations }
  const { status } = await post(handler, arm === 'chat' ? '/chat' : '/produce', body)
  const req = captured.requests[before]
  const rawTools = req?.['tools']
  const tools = Array.isArray(rawTools) ? (rawTools as Array<{ name: string }>).map((t) => t.name).sort() : []
  return { status, tools }
}

const ARMS = ['chat', 'produce'] as const

let handler: Middleware
let previousAnthropicKey: string | undefined
let previousSecureKey: string | undefined

beforeAll(() => {
  // The plugin captures `process.env` by reference at build (its `config`/`loadEnv` hook is deliberately
  // NOT invoked here — chat-route.test.ts's exact posture). A resolvable pair needs a key; the
  // unprovisioned-key rung needs SECURE_MCP_KEY provably ABSENT.
  previousAnthropicKey = process.env['ANTHROPIC_API_KEY']
  previousSecureKey = process.env['SECURE_MCP_KEY']
  process.env['ANTHROPIC_API_KEY'] = 'sk-test-value'
  delete process.env['SECURE_MCP_KEY']

  // The baseline registry, registered through the REAL `registerIntegration` into THIS file's own module
  // graph (LLD §5.4). `calc` = two keyless tools; `secure` = one `serverKey` tool whose env var stays
  // unset (the unprovisioned rung); `churny`'s tools are registered inside the churn test alone, so its
  // append-only re-seed never perturbs the calc-based cases.
  registerIntegration(fakeManifest('mcp:calc:add', { auth: 'none' }))
  registerIntegration(fakeManifest('mcp:calc:multiply', { auth: 'none' }))
  registerIntegration(fakeManifest('mcp:secure:read', { auth: 'serverKey', envKey: 'SECURE_MCP_KEY' }))

  handler = mountPlugin()
})

afterAll(() => {
  if (previousAnthropicKey === undefined) delete process.env['ANTHROPIC_API_KEY']
  else process.env['ANTHROPIC_API_KEY'] = previousAnthropicKey
  if (previousSecureKey === undefined) delete process.env['SECURE_MCP_KEY']
  else process.env['SECURE_MCP_KEY'] = previousSecureKey
})

describe('SPEC-R7 AC1 — a service ref resolves against the registry as it stands that turn (both POST arms)', () => {
  it.each(ARMS)('a ref ∪ an exact id expands to the referenced service\'s current tools + the pin — %s arm', async (arm) => {
    // `mcp:calc:*` (a ref) unioned with `weather` (an exact, shipped, keyless id) — SPEC-R7's own "one
    // service ref and one exact id" case. The offered wire names are exactly the expanded set's tool.names.
    const { status, tools } = await turn(handler, arm, [serviceRef('calc'), 'weather'])
    expect(status, 'a served turn completes 200 on both arms').toBe(200)
    expect(tools).toEqual(['mcp_calc_add', 'mcp_calc_multiply', 'weather'])
  })

  it('churn: a tool registered under the referenced service joins the NEXT turn, the enablement list byte-identical', async () => {
    // Isolated to its own server (`churny`) so this append-only re-seed never widens the calc cases. The
    // enablement list is IDENTICAL across both turns — the "zero store edits" claim (SPEC-R7 AC1): the ref
    // tracks the live registry, not a pinned snapshot.
    const wire = [serviceRef('churny')]

    registerIntegration(fakeManifest('mcp:churny:one', { auth: 'none' }))
    const t1 = await turn(handler, 'chat', wire)
    expect(t1.status).toBe(200)
    expect(t1.tools, 'turn one sees only the tool registered so far').toEqual(['mcp_churny_one'])

    // The server "gained a tool" (visible after the next boot) — modeled as one more registration; the
    // route reads `listIntegrations()` fresh per request, so the same wire item now resolves wider.
    registerIntegration(fakeManifest('mcp:churny:two', { auth: 'none' }))
    const t2 = await turn(handler, 'chat', wire)
    expect(t2.status).toBe(200)
    expect(t2.tools, 'the next turn offers the new tool with the enablement list unchanged').toEqual([
      'mcp_churny_one',
      'mcp_churny_two',
    ])
  })
})

describe('SPEC-R7 AC2 — the full degrade ladder: every rung a COMPLETED turn with the predicted tool set', () => {
  it.each(ARMS)('the empty/master-off projection ⇒ an empty tool set, turn completes — %s arm', async (arm) => {
    // Master off (or every tool entry disabled) ⇒ `#enabledToolIds` projects `[]` (SPEC-R1 AC2, proven at
    // the site layer). At the proxy that empty list yields an empty pair (`buildToolDispatch` ⇒ `{}`), so
    // the request is byte-identical to a tools-unaware caller's — never a thrown turn.
    const { status, tools } = await turn(handler, arm, [])
    expect(status).toBe(200)
    expect(tools).toEqual([])
  })

  it('an entry disabled ⇒ only the still-enabled refs resolve (the narrowed projection completes)', async () => {
    // The disabled entry simply never reaches the wire list (the store projection's job); the remaining
    // enabled ref resolves normally. Modeled here as the narrowed list the projection would post.
    const { status, tools } = await turn(handler, 'chat', [serviceRef('calc')])
    expect(status).toBe(200)
    expect(tools).toEqual(['mcp_calc_add', 'mcp_calc_multiply'])
  })

  it.each(ARMS)('an unknown / roster-removed service ref ⇒ resolves to [] ⇒ empty tool set — %s arm', async (arm) => {
    // `mcp:ghost:*` names a server with zero registered manifests (removed from the roster, or never real):
    // the ref resolves to nothing and the turn proceeds without those tools (SPEC-R7's "removed/renamed
    // tool leaves it the same way", fail-closed).
    const { status, tools } = await turn(handler, arm, [serviceRef('ghost')])
    expect(status).toBe(200)
    expect(tools).toEqual([])
  })

  it.each(ARMS)('an unprovisioned serverKey through a ref ⇒ its manifests excluded, the rest unaffected — %s arm', async (arm) => {
    // `SECURE_MCP_KEY` is unset (beforeAll), so `mcp:secure:*` resolves to nothing (`isProvisioned` filter,
    // ADR-0168 cl.4 — proven THROUGH expansion); the sibling `mcp:calc:*` in the same list is untouched.
    const { status, tools } = await turn(handler, arm, [serviceRef('secure'), serviceRef('calc')])
    expect(status).toBe(200)
    expect(tools, 'the secure server contributes nothing; calc is unaffected').toEqual(['mcp_calc_add', 'mcp_calc_multiply'])
  })

  it('the Worker analogue: a registry with no MCP manifests resolves every service ref to nothing', () => {
    // The production Worker registers no MCP manifests (ADR-0177's deferred rollout), so every service ref
    // is inert there BY CONSTRUCTION — zero Worker edit. Proven at the injectable-registry grain
    // (`resolveAgainst`, the projectIntegrationTrios precedent): an empty registry, and a registry holding
    // only a non-MCP manifest, both resolve `mcp:calc:*` to `[]`; the empty pair is `{}` — a byte-identical
    // request. This is the resolution seam both arms share, so it needs no per-arm turn.
    const env = { SECURE_MCP_KEY: undefined }
    expect(resolveAgainst([], [serviceRef('calc')], env)).toEqual([])
    expect(resolveAgainst([fakeManifest('weather', { auth: 'none' })], [serviceRef('calc')], env)).toEqual([])
    expect(buildToolDispatch(resolveAgainst([], [serviceRef('calc')], env), env), 'an empty resolved set ⇒ the `{}` no-tools pair').toEqual({})
  })
})
