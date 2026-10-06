// scripted-mcp.test.ts: the kit's scripted MCP server against the REAL MCP client (T-0011).

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { armOffline } from '../../tools/testkit/offline.ts'
import { scriptedMcpServer } from '../../tools/testkit/scripted-mcp.ts'
import type { McpServerScript } from '../../tools/testkit/scripted-mcp.ts'
import { createMcpClient, McpClientError } from '../../tools/agent/integrations/mcp/client.ts'

let disarm: () => void
beforeAll(() => {
  disarm = armOffline()
})
afterAll(() => disarm())

const ENDPOINT = 'http://kit.invalid/mcp'
const script = (framing: 'json' | 'sse'): McpServerScript => ({
  framing,
  sessionId: 'sess-1',
  pageSize: 1,
  tools: [
    { name: 'echo', inputSchema: { type: 'object', properties: { text: { type: 'string' } } } },
    { name: 'stall', inputSchema: { type: 'object' } },
  ],
  calls: { echo: { result: { content: [{ type: 'text', text: 'pong' }] } }, stall: { hang: true } },
})

describe('scriptedMcpServer with the real createMcpClient', () => {
  for (const framing of ['json', 'sse'] as const) {
    it(`${framing}: initialize, listTools across two pages (pageSize 1), callTool`, async () => {
      const server = scriptedMcpServer(script(framing))
      const client = createMcpClient({ endpoint: ENDPOINT, fetchImpl: server.fetchImpl })
      expect(await client.initialize()).toEqual({ ok: true, protocolVersion: '2025-06-18', sessionId: 'sess-1' })
      const tools = await client.listTools()
      expect(tools.map((t) => t.name)).toEqual(['echo', 'stall'])
      expect(await client.callTool('echo', { text: 'ping' })).toEqual({ content: [{ type: 'text', text: 'pong' }], isError: undefined })
      expect(server.calls.map((c) => c.method)).toEqual(['initialize', 'notifications/initialized', 'tools/list', 'tools/list', 'tools/call'])
      expect(server.calls[3]!.params).toEqual({ cursor: '1' })
    })
  }

  it('a hang step with timeoutMs 1 rejects with McpClientError code timeout', async () => {
    const server = scriptedMcpServer(script('json'))
    const client = createMcpClient({ endpoint: ENDPOINT, fetchImpl: server.fetchImpl, timeoutMs: 1 })
    let caught: unknown
    try {
      await client.callTool('stall', {})
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(McpClientError)
    expect((caught as McpClientError).code).toBe('timeout')
  })

  it('an unscripted tool is JSON-RPC -32602 and an unknown method -32601 (client code jsonrpc)', async () => {
    const server = scriptedMcpServer(script('json'))
    const client = createMcpClient({ endpoint: ENDPOINT, fetchImpl: server.fetchImpl })
    await expect(client.callTool('ghost', {})).rejects.toMatchObject({ code: 'jsonrpc' })
    const res = await server.handle(new Request(ENDPOINT, { method: 'POST', body: JSON.stringify({ jsonrpc: '2.0', id: 9, method: 'nope' }) }))
    expect(await res.json()).toMatchObject({ id: 9, error: { code: -32601 } })
  })
})
