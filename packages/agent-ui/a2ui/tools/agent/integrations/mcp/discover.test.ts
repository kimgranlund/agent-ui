// discover.test.ts — LLD-C4's gate (SPEC-R26 AC1 / SPEC-R23 AC2): the fail-soft discovery loop,
// gated with an injected fake client factory + a recording sink — ZERO network, and ZERO import of
// '../registry.ts' anywhere in this file (grep it). That absence IS the REGISTRY-untouched proof:
// every "registered" claim below is verified against THIS FILE's OWN sink recording, never against
// the real module-level REGISTRY singleton — the invariant that keeps the shipped both-directions
// trio-parity test (SPEC-R16 AC2, `agent-admin-app.test.ts:435`) green by construction (LLD §3.4/§6).
//
// `fakeRegistrySink` reproduces registerIntegration's two throw paths relevant to discovery
// (duplicate wire tool.name, unsupported input_schema) using its OWN local state + the real, pure
// `assertSupportedSchema` (no REGISTRY involved) — so a per-tool skip test proves the SAME failure
// shape the real sink would produce, without ever touching it.
import { describe, it, expect, vi } from 'vitest'
import { discoverMcpIntegrations } from './discover.ts'
import { MCP_PROTOCOL_VERSION, createMcpClient } from './client.ts'
import type { McpClient, McpToolInfo, InitializeOutcome } from './client.ts'
import type { McpServersConfig } from './servers-config.ts'
import { assertSupportedSchema } from '../validate-input.ts'

/** The minimal shape this file's sink needs from a manifest — any real `IntegrationManifest`
 *  satisfies it structurally (a strict superset), so `mapMcpTool`'s real return value is directly
 *  assignable here with no cast and no import of `registry.ts`'s own `IntegrationManifest` type. */
interface RecordedManifest {
  id: string
  tool: { name: string; input_schema: Record<string, unknown> }
}

/** A local stand-in for `registerIntegration`'s duplicate/schema policy — its OWN state, never the
 *  real module-level REGISTRY. Reproduces both throw messages verbatim (registry.ts's own wording)
 *  so a skip row's `reason` reads identically to what the real sink would produce. */
function fakeRegistrySink(): { register: (m: RecordedManifest) => void; manifests: RecordedManifest[] } {
  const manifests: RecordedManifest[] = []
  return {
    manifests,
    register: (m) => {
      if (manifests.some((existing) => existing.id === m.id)) {
        throw new Error(`integration registry: duplicate id \`${m.id}\``)
      }
      if (manifests.some((existing) => existing.tool.name === m.tool.name)) {
        throw new Error(`integration registry: duplicate tool name \`${m.tool.name}\` (id \`${m.id}\`)`)
      }
      assertSupportedSchema(m.tool.input_schema) // throws `unsupported input_schema: ...` untouched
      manifests.push(m)
    },
  }
}

/** A hand-built McpClient — `callTool` is never exercised by discovery (S3's job, invoked later at
 *  dispatch), so it throws if reached. */
function fakeClient(spec: {
  initialize?: () => InitializeOutcome | Promise<InitializeOutcome>
  listTools?: () => McpToolInfo[] | Promise<McpToolInfo[]>
}): McpClient {
  return {
    initialize: async () => (spec.initialize ? spec.initialize() : { ok: true, protocolVersion: MCP_PROTOCOL_VERSION }),
    listTools: async () => (spec.listTools ? spec.listTools() : []),
    callTool: async () => {
      throw new Error('discover.test.ts: callTool is not exercised by discovery')
    },
  }
}

/** The injectable `createClient` factory (LLD §3.4/§6) — dispatches by endpoint, since discovery
 *  constructs exactly one client per server. */
function clientFactoryFor(byEndpoint: Record<string, McpClient>): typeof createMcpClient {
  return ((opts) => {
    const client = byEndpoint[opts.endpoint]
    if (!client) throw new Error(`discover.test.ts: no fake client scripted for endpoint "${opts.endpoint}"`)
    return client
  }) as typeof createMcpClient
}

describe('discoverMcpIntegrations — happy path (multi-server, multi-tool)', () => {
  it('registers every tool from every server, in roster-then-listing order, via the injected sink only', async () => {
    const docsClient = fakeClient({
      listTools: () => [
        { name: 'search_docs', inputSchema: { type: 'object' } },
        { name: 'list_docs', inputSchema: { type: 'object' } },
      ],
    })
    const billingClient = fakeClient({ listTools: () => [{ name: 'get_invoice', inputSchema: { type: 'object' } }] })
    const cfg: McpServersConfig = {
      servers: {
        docs: { label: 'Docs Server', endpoint: 'https://fake.example/mcp/docs', auth: 'none' },
        billing: { label: 'Billing Server', endpoint: 'https://fake.example/mcp/billing', auth: 'none' },
      },
    }
    const sink = fakeRegistrySink()
    const report = await discoverMcpIntegrations(cfg, {
      env: {},
      register: sink.register,
      createClient: clientFactoryFor({
        'https://fake.example/mcp/docs': docsClient,
        'https://fake.example/mcp/billing': billingClient,
      }),
    })

    expect(report.registered).toEqual(['mcp:docs:search_docs', 'mcp:docs:list_docs', 'mcp:billing:get_invoice'])
    expect(report.skipped).toEqual([])
    // The REGISTRY-untouched invariant: everything the report claims registered is exactly what
    // THIS sink recorded — no other path could have registered it.
    expect(sink.manifests.map((m) => m.id)).toEqual(report.registered)
  })
})

describe('discoverMcpIntegrations — per-server catch-all (LLD §3.4, wedge-proof by construction)', () => {
  it('a NON-McpClientError thrown mid-listTools yields one report row; the loop continues to the next server', async () => {
    const flakyClient = fakeClient({
      listTools: () => {
        throw new Error('ECONNRESET')
      },
    })
    const docsClient = fakeClient({ listTools: () => [{ name: 'search_docs', inputSchema: { type: 'object' } }] })
    const cfg: McpServersConfig = {
      servers: {
        flaky: { label: 'Flaky Server', endpoint: 'https://fake.example/mcp/flaky', auth: 'none' },
        docs: { label: 'Docs Server', endpoint: 'https://fake.example/mcp/docs', auth: 'none' },
      },
    }
    const sink = fakeRegistrySink()
    const report = await discoverMcpIntegrations(cfg, {
      env: {},
      register: sink.register,
      createClient: clientFactoryFor({
        'https://fake.example/mcp/flaky': flakyClient,
        'https://fake.example/mcp/docs': docsClient,
      }),
    })

    expect(report.skipped).toEqual([{ server: 'flaky', reason: 'ECONNRESET' }])
    expect(report.registered).toEqual(['mcp:docs:search_docs'])
  })
})

describe('discoverMcpIntegrations — version-refusal is a server-scope skip (SPEC-R24)', () => {
  it('an unsupported negotiated version skips the server and never dials tools/list', async () => {
    let listToolsCalled = false
    const legacyClient = fakeClient({
      initialize: () => ({ ok: false, reason: 'unsupported-version', negotiated: '2024-11-05' }),
      listTools: () => {
        listToolsCalled = true
        return []
      },
    })
    const cfg: McpServersConfig = {
      servers: { legacy: { label: 'Legacy Server', endpoint: 'https://fake.example/mcp/legacy', auth: 'none' } },
    }
    const sink = fakeRegistrySink()
    const report = await discoverMcpIntegrations(cfg, {
      env: {},
      register: sink.register,
      createClient: clientFactoryFor({ 'https://fake.example/mcp/legacy': legacyClient }),
    })

    expect(report.skipped).toEqual([{ server: 'legacy', reason: 'unsupported-version:2024-11-05' }])
    expect(report.registered).toEqual([])
    expect(listToolsCalled).toBe(false)
  })
})

describe('discoverMcpIntegrations — no-key server skip (LLD §3.4, the discovery-time not-offered degrade)', () => {
  it('an unset envKey skips the server before ANY client is constructed', async () => {
    const cfg: McpServersConfig = {
      servers: {
        keyed: { label: 'Keyed Server', endpoint: 'https://fake.example/mcp/keyed', auth: 'serverKey', envKey: 'FAKE_MCP_KEY' },
      },
    }
    const sink = fakeRegistrySink()
    const createClient = vi.fn(() => {
      throw new Error('discover.test.ts: a no-key server must never construct a client')
    }) as unknown as typeof createMcpClient
    const report = await discoverMcpIntegrations(cfg, { env: {}, register: sink.register, createClient })

    expect(report.skipped).toEqual([{ server: 'keyed', reason: 'no-key' }])
    expect(report.registered).toEqual([])
    expect(createClient).not.toHaveBeenCalled()
  })

  it('an empty or whitespace-only env value is treated the SAME as unset', async () => {
    const cfg: McpServersConfig = {
      servers: {
        keyed: { label: 'Keyed Server', endpoint: 'https://fake.example/mcp/keyed', auth: 'serverKey', envKey: 'FAKE_MCP_KEY' },
      },
    }
    const sink = fakeRegistrySink()
    for (const value of ['', '   ']) {
      const report = await discoverMcpIntegrations(cfg, { env: { FAKE_MCP_KEY: value }, register: sink.register })
      expect(report.skipped).toEqual([{ server: 'keyed', reason: 'no-key' }])
    }
  })
})

describe('discoverMcpIntegrations — per-tool fail-soft, both registerIntegration throw paths (SPEC-R26)', () => {
  it('an unsupported-schema tool is skipped; the other tools on the same server still register', async () => {
    const client = fakeClient({
      listTools: () => [
        { name: 'good_tool', inputSchema: { type: 'object' } },
        {
          name: 'bad_tool',
          inputSchema: { type: 'object', properties: { where: { type: 'object', properties: { city: { type: 'string' } } } } },
        },
        { name: 'also_good', inputSchema: { type: 'object' } },
      ],
    })
    const cfg: McpServersConfig = {
      servers: { docs: { label: 'Docs Server', endpoint: 'https://fake.example/mcp/docs', auth: 'none' } },
    }
    const sink = fakeRegistrySink()
    const report = await discoverMcpIntegrations(cfg, {
      env: {},
      register: sink.register,
      createClient: clientFactoryFor({ 'https://fake.example/mcp/docs': client }),
    })

    expect(report.registered).toEqual(['mcp:docs:good_tool', 'mcp:docs:also_good'])
    expect(report.skipped).toHaveLength(1)
    expect(report.skipped[0]).toMatchObject({ server: 'docs', tool: 'bad_tool' })
    expect(report.skipped[0]!.reason).toMatch(/unsupported input_schema/)
  })

  it('an off-spec server listing the SAME tool twice collides on id — the second copy is skipped, the first survives', async () => {
    // Same server + same wire name ⇒ the SAME `mcp:<server>:<tool>` id for both — this hits
    // registerIntegration's id-duplicate check (checked first, both in the real sink and here),
    // never the tool-name check (that one needs a DIFFERENT id, i.e. a different server — the
    // cross-server describe block below).
    const client = fakeClient({
      listTools: () => [
        { name: 'dup_tool', description: 'first', inputSchema: { type: 'object' } },
        { name: 'dup_tool', description: 'second', inputSchema: { type: 'object' } },
      ],
    })
    const cfg: McpServersConfig = {
      servers: { docs: { label: 'Docs Server', endpoint: 'https://fake.example/mcp/docs', auth: 'none' } },
    }
    const sink = fakeRegistrySink()
    const report = await discoverMcpIntegrations(cfg, {
      env: {},
      register: sink.register,
      createClient: clientFactoryFor({ 'https://fake.example/mcp/docs': client }),
    })

    expect(report.registered).toEqual(['mcp:docs:dup_tool'])
    expect(report.skipped).toHaveLength(1)
    expect(report.skipped[0]).toMatchObject({ server: 'docs', tool: 'dup_tool' })
    expect(report.skipped[0]!.reason).toMatch(/duplicate id `mcp:docs:dup_tool`/)
  })
})

describe('discoverMcpIntegrations — cross-server tool.name collision: the SECOND server loses (SPEC-R26, disclosed)', () => {
  it("drops the second server's same-named tool, keeps the first, per roster key order", async () => {
    const alphaClient = fakeClient({ listTools: () => [{ name: 'shared_tool', inputSchema: { type: 'object' } }] })
    const betaClient = fakeClient({ listTools: () => [{ name: 'shared_tool', inputSchema: { type: 'object' } }] })
    const cfg: McpServersConfig = {
      servers: {
        alpha: { label: 'Alpha Server', endpoint: 'https://fake.example/mcp/alpha', auth: 'none' },
        beta: { label: 'Beta Server', endpoint: 'https://fake.example/mcp/beta', auth: 'none' },
      },
    }
    const sink = fakeRegistrySink()
    const report = await discoverMcpIntegrations(cfg, {
      env: {},
      register: sink.register,
      createClient: clientFactoryFor({
        'https://fake.example/mcp/alpha': alphaClient,
        'https://fake.example/mcp/beta': betaClient,
      }),
    })

    expect(report.registered).toEqual(['mcp:alpha:shared_tool'])
    expect(report.skipped).toEqual([
      { server: 'beta', tool: 'shared_tool', reason: expect.stringContaining('duplicate tool name `shared_tool`') },
    ])
  })
})

describe('discoverMcpIntegrations — the empty-name floor (review-inherited hardening, GH #567)', () => {
  it('skips an empty or whitespace-only tool name before mapMcpTool ever runs; no degenerate id ever registers', async () => {
    const client = fakeClient({
      listTools: () => [
        { name: '', inputSchema: { type: 'object' } },
        { name: '   ', inputSchema: { type: 'object' } },
        { name: 'real_tool', inputSchema: { type: 'object' } },
      ],
    })
    const cfg: McpServersConfig = {
      servers: { docs: { label: 'Docs Server', endpoint: 'https://fake.example/mcp/docs', auth: 'none' } },
    }
    const sink = fakeRegistrySink()
    const report = await discoverMcpIntegrations(cfg, {
      env: {},
      register: sink.register,
      createClient: clientFactoryFor({ 'https://fake.example/mcp/docs': client }),
    })

    expect(report.registered).toEqual(['mcp:docs:real_tool'])
    expect(report.skipped).toEqual([
      { server: 'docs', tool: '', reason: 'empty tool name' },
      { server: 'docs', tool: '   ', reason: 'empty tool name' },
    ])
    // The floor's whole point: a degenerate id like `mcp:docs:` (empty third segment) never reaches
    // the sink, and never shows up as registered.
    expect(report.registered).not.toContain('mcp:docs:')
    expect(sink.manifests.some((m) => m.id === 'mcp:docs:' || m.id.endsWith(':'))).toBe(false)
  })
})

describe('discoverMcpIntegrations — empty roster (SPEC-R27 zero-cost no-op)', () => {
  it('resolves an empty report immediately, constructing ZERO clients', async () => {
    const createClient = vi.fn() as unknown as typeof createMcpClient
    const report = await discoverMcpIntegrations({ servers: {} }, { env: {}, createClient })
    expect(report).toEqual({ registered: [], skipped: [] })
    expect(createClient).not.toHaveBeenCalled()
  })
})

describe('discoverMcpIntegrations — the log sink (LLD §3.4 DiscoveryDeps.log)', () => {
  it('an injected log sink receives every line uniformly — registrations AND skips, never a key value', async () => {
    const client = fakeClient({ listTools: () => [{ name: 'search_docs', inputSchema: { type: 'object' } }] })
    const cfg: McpServersConfig = {
      servers: {
        keyed: { label: 'Keyed Server', endpoint: 'https://fake.example/mcp/keyed', auth: 'serverKey', envKey: 'FAKE_MCP_KEY' },
        docs: { label: 'Docs Server', endpoint: 'https://fake.example/mcp/docs', auth: 'none' },
      },
    }
    const sink = fakeRegistrySink()
    const lines: string[] = []
    await discoverMcpIntegrations(cfg, {
      env: {},
      register: sink.register,
      log: (line) => lines.push(line),
      createClient: clientFactoryFor({ 'https://fake.example/mcp/docs': client }),
    })

    expect(lines.some((l) => l.includes('keyed') && l.includes('no-key'))).toBe(true)
    expect(lines.some((l) => l.includes('mcp:docs:search_docs'))).toBe(true)
    expect(lines.join('\n')).not.toContain('FAKE_MCP_KEY')
  })
})
