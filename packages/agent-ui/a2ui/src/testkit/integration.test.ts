// integration.test.ts: the kit's integration leg (T-0011). MCP discovery over the scripted server through
// its injectable seams, and a producer turn whose scripted round calls a scripted tool. The process-wide
// integration registry is never touched. The dev-proxy boot gate stays with
// `src/live-agent/mcp-boot.test.ts`; the non-injectable 30 s `TOOL_CALL_TIMEOUT_MS` is proven through the
// MCP client's own `timeoutMs` instead (the seeded integration fixture, `MCP_TIMEOUT`).

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { armOffline } from '../../tools/testkit/offline.ts'
import { scriptedMcpServer } from '../../tools/testkit/scripted-mcp.ts'
import { runProducerTurn, judgeProduce } from '../../tools/testkit/producer-leg.ts'
import { discoverMcpIntegrations } from '../../tools/agent/integrations/mcp/discover.ts'
import { createMcpClient } from '../../tools/agent/integrations/mcp/client.ts'
import { listIntegrations } from '../../tools/agent/integrations/registry.ts'
import type { IntegrationManifest } from '../../tools/agent/integrations/registry.ts'
import { defaultCatalog } from '../catalog/default/index.ts'

let disarm: () => void
beforeAll(() => {
  disarm = armOffline()
})
afterAll(() => disarm())

const j = (v: unknown): string => JSON.stringify(v)
const VALID = [
  j({ version: 'v1.0', createSurface: { surfaceId: 's', catalogId: 'agent-ui' } }),
  j({ version: 'v1.0', updateComponents: { surfaceId: 's', components: [{ id: 'root', component: 'Text', text: 'sunny' }] } }),
].join('\n')

describe('integration leg', () => {
  it('discoverMcpIntegrations over the scripted server registers its tools into an injected sink', async () => {
    const before = listIntegrations()
    const beforeLength = before.length
    const server = scriptedMcpServer({
      tools: [{ name: 'forecast', description: 'weather', inputSchema: { type: 'object', properties: { city: { type: 'string' } } } }],
      calls: { forecast: { result: { content: [{ type: 'text', text: 'sunny' }] } } },
    })
    const sink: IntegrationManifest[] = []
    const lines: string[] = []
    const report = await discoverMcpIntegrations(
      { servers: { kit: { label: 'Kit', endpoint: 'http://kit.invalid/mcp', auth: 'none' } } },
      { env: {}, register: (m) => sink.push(m), createClient: (o) => createMcpClient({ ...o, fetchImpl: server.fetchImpl }), log: (l) => lines.push(l) },
    )
    expect(report.skipped).toEqual([])
    expect(report.registered).toHaveLength(1)
    expect(sink.map((m) => m.tool.name)).toEqual(['forecast'])
    expect(await sink[0]!.execute({ city: 'Oslo' }, {})).toBe('sunny')
    expect(server.calls.at(-1)).toEqual({ method: 'tools/call', params: { name: 'forecast', arguments: { city: 'Oslo' } } })
    expect(listIntegrations()).toBe(before)
    expect(listIntegrations().length).toBe(beforeLength)
  })

  it('a producer turn whose scripted round calls a tool records the call', async () => {
    const before = listIntegrations().length
    const r = await runProducerTurn(
      { kind: 'intent', text: 'weather in Oslo', session: { turns: [] } },
      [{ tool: 'forecast', input: { city: 'Oslo' }, then: VALID }],
      defaultCatalog,
      { tools: [{ name: 'forecast', input_schema: { type: 'object', properties: { city: { type: 'string' } } }, reply: 'sunny' }] },
    )
    expect(r.toolCalls).toEqual([{ tool: 'forecast', input: { city: 'Oslo' } }])
    expect(judgeProduce(r, { tools: [{ tool: 'forecast', input: { city: 'Oslo' } }] })).toEqual([])
    expect(listIntegrations().length).toBe(before)
  })
})
