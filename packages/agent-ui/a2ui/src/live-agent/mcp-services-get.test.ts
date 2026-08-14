// mcp-services-get.test.ts — LLD-C4 (S2, mcp-agent-config.lld.md §3.2/§5.4, SPEC-R4 AC1/AC2,
// ADR-0185): the admin GET's additive `services` array. A NEW sibling to `mcp-boot.test.ts`, never
// folded in (LLD §5.4 — vitest's per-file module isolation is what lets THIS file register
// fabricated `mcp:*` manifests through the REAL `registerIntegration` without touching that file's
// own REGISTRY-untouched suite or the real REGISTRY any other test file sees). The fake-server
// harness below (`mountPlugin`/`getIntegrations`) is REPRODUCED, not imported, from
// `mcp-boot.test.ts`'s own precedent (itself lifted from `chat-route.test.ts`) — that file's own
// header comment states the same sibling-isolation posture for its `postChat` helper.
//
// Three grains, each its own describe block:
//   1. the two-fake-server route case — `mcpRoster` + `mcpDiscovery` stage a roster the real
//      committed (empty) `mcp-servers.json` never carries, proving the wiring end to end: roster
//      key order, the tool-count singular/plural copy, a zero-count server contributing no row,
//      `integrations` staying byte-identical, and the whole body leak-proof (no endpoint/envKey/key
//      value/JSON-RPC fact — SPEC-R4's cl.2 boundary, inherited from SPEC-R28's);
//   2. the default (uninjected) path over the REAL committed empty roster — SPEC-R4 AC2's
//      `services: []`, zero-cost-no-op extension;
//   3. `projectServiceRows` itself, unit-tested over FABRICATED manifest arrays (the
//      `projectIntegrationTrios` precedent) — no REGISTRY touched at all.
//
// ADR-0189 cl.3 (GH #877, ratified 2026-08-14) — every `services` row grain above widens with a
// `tools: Array<{id, label, description}>` member (one real per-tool trio per member manifest, in
// filter order); the row's own `description` (the boot-count aggregate) is UNCHANGED — a widen,
// not a replace. This file's own header precedent (the SPEC-N2 same-change law) is what authorizes
// amending these pinned-shape assertions in place rather than leaving them stale.

import { describe, it, expect, beforeAll } from 'vitest'
import { a2uiDevProxyPlugin, projectIntegrationTrios, projectServiceRows } from '../../tools/agent/dev-proxy-plugin.ts'
import { registerIntegration, listIntegrations } from '../../tools/agent/integrations/index.ts'
import type { IntegrationManifest } from '../../tools/agent/integrations/index.ts'
import { serviceRef } from '../../tools/agent/integrations/service-ref.ts'
import type { McpServersConfig } from '../../tools/agent/integrations/mcp/servers-config.ts'
import type { DiscoveryReport } from '../../tools/agent/integrations/mcp/discover.ts'

type Middleware = (req: unknown, res: unknown) => void

/** Wires a fresh plugin instance through the same fake-server harness `chat-route.test.ts`/
 *  `mcp-boot.test.ts` use, returns the captured middleware handler. */
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
  if (!handler) throw new Error('mcp-services-get.test.ts: configureServer never registered a middleware')
  return handler
}

/** GET /integrations — the cheapest real route to drive both projections through. */
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

/** A minimal, valid `IntegrationManifest` — `tool.name` derived from `id` so distinct ids never
 *  collide on `registerIntegration`'s duplicate-wire-name guard. */
function fakeManifest(id: string, auth: { auth: 'none' | 'serverKey'; envKey?: string }): IntegrationManifest {
  return {
    id,
    version: '1.0.0',
    label: id,
    description: `${id} — a fabricated manifest`,
    tool: {
      name: id.replace(/[^a-z0-9]/gi, '_'),
      description: 'x',
      input_schema: { type: 'object', properties: {} },
    },
    ...auth,
    execute: async () => '',
  }
}

// A no-op discovery stub — this file registers its fabricated manifests directly (below), so the
// injected `mcpDiscovery` need only resolve immediately without a real network dial (SPEC-N3: zero
// external network in any gate). Its own `registered`/`skipped` report feeds nothing but a boot log
// line; the /integrations route reads `listIntegrations()` directly.
const noopDiscovery = (): Promise<DiscoveryReport> => Promise.resolve({ registered: [], skipped: [] })

const ROSTER: McpServersConfig = {
  servers: {
    acme: { label: 'Acme Docs', endpoint: 'https://acme.example.com/mcp', auth: 'serverKey', envKey: 'ACME_MCP_KEY' },
    calc: { label: 'Calc Tools', endpoint: 'https://calc.example.com/mcp', auth: 'none' },
    // Zero manifests ever registered for this one — proves the count===0 ⇒ no-row rule end to end.
    ghost: { label: 'Ghost Server', endpoint: 'https://ghost.example.com/mcp', auth: 'none' },
  },
}

beforeAll(() => {
  registerIntegration(fakeManifest('mcp:acme:lookup', { auth: 'serverKey', envKey: 'ACME_MCP_KEY' }))
  registerIntegration(fakeManifest('mcp:acme:search', { auth: 'serverKey', envKey: 'ACME_MCP_KEY' }))
  registerIntegration(fakeManifest('mcp:calc:add', { auth: 'none' }))
})

describe('GET /integrations — the additive services array (LLD-C4 §3.2, SPEC-R4 AC1, ADR-0185)', () => {
  it('serves one row per roster server with ≥1 registered manifest, roster key order, tool-count copy, integrations byte-identical', async () => {
    const handler = mountPlugin({ mcpRoster: ROSTER, mcpDiscovery: noopDiscovery })
    const { status, body } = await getIntegrations(handler)
    expect(status).toBe(200)
    expect(body['services']).toEqual([
      {
        id: serviceRef('acme'),
        label: 'Acme Docs',
        description: '2 tools discovered at boot',
        tools: [
          { id: 'mcp:acme:lookup', label: 'mcp:acme:lookup', description: 'mcp:acme:lookup — a fabricated manifest' },
          { id: 'mcp:acme:search', label: 'mcp:acme:search', description: 'mcp:acme:search — a fabricated manifest' },
        ],
      },
      {
        id: serviceRef('calc'),
        label: 'Calc Tools',
        description: '1 tool discovered at boot',
        tools: [{ id: 'mcp:calc:add', label: 'mcp:calc:add', description: 'mcp:calc:add — a fabricated manifest' }],
      },
    ])
    expect(body['integrations']).toEqual(projectIntegrationTrios(listIntegrations()))
  })

  it('a roster server with zero registered manifests contributes no row', async () => {
    const handler = mountPlugin({ mcpRoster: ROSTER, mcpDiscovery: noopDiscovery })
    const { body } = await getIntegrations(handler)
    const ids = (body['services'] as Array<{ id: string }>).map((r) => r.id)
    expect(ids).not.toContain(serviceRef('ghost'))
  })

  it('leaks no endpoint, envKey name/value, auth fact, or JSON-RPC term across the WHOLE body', async () => {
    const handler = mountPlugin({ mcpRoster: ROSTER, mcpDiscovery: noopDiscovery })
    const { body } = await getIntegrations(handler)
    const json = JSON.stringify(body)
    for (const leak of ['ACME_MCP_KEY', 'serverKey', 'jsonrpc', 'http://', 'https://', 'endpoint', 'envKey']) {
      expect(json.toLowerCase(), `leaked "${leak}"`).not.toContain(leak.toLowerCase())
    }
  })
})

describe('GET /integrations — the real committed (empty) roster (SPEC-R4 AC2, the SPEC-R27 zero-cost-no-op extended)', () => {
  it('services is [] and integrations is unaffected — the default, uninjected path', async () => {
    const handler = mountPlugin() // no mcpRoster override — REAL discovery, REAL committed empty roster
    const { status, body } = await getIntegrations(handler)
    expect(status).toBe(200)
    expect(body).toEqual({ integrations: projectIntegrationTrios(listIntegrations()), services: [] })
  })
})

describe('projectServiceRows (LLD-C4 §3.2) — a fact-only projection over FABRICATED arrays, no REGISTRY touched', () => {
  const manifests: IntegrationManifest[] = [
    fakeManifest('mcp:alpha:one', { auth: 'none' }),
    fakeManifest('mcp:zebra:one', { auth: 'none' }),
    fakeManifest('mcp:zebra:two', { auth: 'none' }),
  ]

  it('rows follow ROSTER key order, not manifest registration order', () => {
    const cfg: McpServersConfig = {
      servers: {
        zebra: { label: 'Zebra', endpoint: 'https://z.example.com/mcp', auth: 'none' },
        alpha: { label: 'Alpha', endpoint: 'https://a.example.com/mcp', auth: 'none' },
      },
    }
    expect(projectServiceRows(cfg, manifests)).toEqual([
      {
        id: serviceRef('zebra'),
        label: 'Zebra',
        description: '2 tools discovered at boot',
        tools: [
          { id: 'mcp:zebra:one', label: 'mcp:zebra:one', description: 'mcp:zebra:one — a fabricated manifest' },
          { id: 'mcp:zebra:two', label: 'mcp:zebra:two', description: 'mcp:zebra:two — a fabricated manifest' },
        ],
      },
      {
        id: serviceRef('alpha'),
        label: 'Alpha',
        description: '1 tool discovered at boot',
        tools: [{ id: 'mcp:alpha:one', label: 'mcp:alpha:one', description: 'mcp:alpha:one — a fabricated manifest' }],
      },
    ])
  })

  it('ADR-0189 cl.3 — `tools` carries the SAME per-manifest {id, label, description} trio projectIntegrationTrios would, one entry per member manifest, in filter order (zero new capture)', () => {
    const cfg: McpServersConfig = { servers: { zebra: { label: 'Zebra', endpoint: 'https://z.example.com/mcp', auth: 'none' } } }
    const rows = projectServiceRows(cfg, manifests)
    expect(rows[0]!.tools).toEqual(
      manifests.filter((m) => m.id.startsWith('mcp:zebra:')).map((m) => ({ id: m.id, label: m.label, description: m.description })),
    )
  })

  it('a server with zero matching manifests contributes no row', () => {
    const cfg: McpServersConfig = { servers: { ghost: { label: 'Ghost', endpoint: 'https://g.example.com/mcp', auth: 'none' } } }
    expect(projectServiceRows(cfg, manifests)).toEqual([])
  })

  it('an empty roster projects to an empty array regardless of manifests', () => {
    expect(projectServiceRows({ servers: {} }, manifests)).toEqual([])
  })

  it('an empty manifest list projects every roster server to zero rows', () => {
    const cfg: McpServersConfig = { servers: { alpha: { label: 'Alpha', endpoint: 'https://a.example.com/mcp', auth: 'none' } } }
    expect(projectServiceRows(cfg, [])).toEqual([])
  })

  it('singular "tool" vs plural "tools" tracks the exact count', () => {
    const cfg: McpServersConfig = { servers: { alpha: { label: 'Alpha', endpoint: 'https://a.example.com/mcp', auth: 'none' } } }
    expect(projectServiceRows(cfg, [fakeManifest('mcp:alpha:one', { auth: 'none' })])[0]?.description).toBe('1 tool discovered at boot')
    expect(
      projectServiceRows(cfg, [fakeManifest('mcp:alpha:one', { auth: 'none' }), fakeManifest('mcp:alpha:two', { auth: 'none' })])[0]
        ?.description,
    ).toBe('2 tools discovered at boot')
  })

  it('never leaks envKey or auth — a JSON round-trip proves only {id, label, description, tools} survive, and each tool trio is itself leak-proof', () => {
    const cfg: McpServersConfig = {
      servers: { acme: { label: 'Acme', endpoint: 'https://acme.example.com/mcp', auth: 'serverKey', envKey: 'SECRET_KEY_NAME' } },
    }
    const rows = projectServiceRows(cfg, [fakeManifest('mcp:acme:lookup', { auth: 'serverKey', envKey: 'SECRET_KEY_NAME' })])
    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual(['description', 'id', 'label', 'tools'])
      for (const tool of row.tools) expect(Object.keys(tool).sort()).toEqual(['description', 'id', 'label'])
    }
    expect(JSON.stringify(rows)).not.toContain('SECRET_KEY_NAME')
  })
})
