// map-tool.test.ts — LLD-C3's gate (SPEC-R25 AC1/AC2): the pure mapping + execute bridge, gated
// with a hand-built McpClient stub — NO transport, NO network (LLD §6). Every fixture records what
// it was called with instead of asserting behaviour indirectly, per this repo's dispatch-test
// precedent (`tool-dispatch.test.ts`).
import { describe, it, expect } from 'vitest'
import { mapMcpTool } from './map-tool.ts'
import { McpClientError } from './client.ts'
import type { McpCallResult, McpClient, McpToolInfo } from './client.ts'
import type { McpServerEntry } from './servers-config.ts'
import { assertSupportedSchema } from '../validate-input.ts'
import { buildToolDispatch } from '../tool-dispatch.ts'

const NONE_SERVER: McpServerEntry = { label: 'Docs Server', endpoint: 'https://mcp.example.com/mcp', auth: 'none' }
const KEYED_SERVER: McpServerEntry = {
  label: 'Keyed Server',
  endpoint: 'https://mcp.example.com/mcp',
  auth: 'serverKey',
  envKey: 'EXAMPLE_MCP_API_KEY',
}

const TOOL: McpToolInfo = {
  name: 'search_docs',
  description: 'Search the docs.',
  inputSchema: { type: 'object', properties: { q: { type: 'string' } }, required: ['q'] },
}

interface RecordedCall {
  name: string
  args: Record<string, unknown>
  opts: { signal?: AbortSignal; apiKey?: string } | undefined
}

/** A hand-built McpClient — `initialize`/`listTools` are never exercised by `mapMcpTool` (S3 owns
 *  ONLY the mapping + `execute`; S4's discovery loop calls those two), so they throw if reached. */
function stubClient(callTool: McpClient['callTool']): McpClient {
  return {
    initialize: async () => {
      throw new Error('not used by map-tool tests')
    },
    listTools: async () => {
      throw new Error('not used by map-tool tests')
    },
    callTool,
  }
}

function recordingClient(result: McpCallResult): { client: McpClient; calls: RecordedCall[] } {
  const calls: RecordedCall[] = []
  const client = stubClient(async (name, args, opts) => {
    calls.push({ name, args, opts })
    return result
  })
  return { client, calls }
}

describe('mapMcpTool — the three-fact law (SPEC-R25 AC1)', () => {
  it('id is the namespaced mcp:<server-id>:<tool-name>; tool.name is the wire name verbatim', () => {
    const { client } = recordingClient({ content: [] })
    const manifest = mapMcpTool({ serverId: 'docs', server: NONE_SERVER, tool: TOOL, client })
    expect(manifest.id).toBe('mcp:docs:search_docs')
    expect(manifest.tool.name).toBe('search_docs')
  })

  it('label is independently composed — relabeling the server touches ONLY the label, never id or tool.name', () => {
    const { client } = recordingClient({ content: [] })
    const before = mapMcpTool({ serverId: 'docs', server: NONE_SERVER, tool: TOOL, client })
    const relabeled: McpServerEntry = { ...NONE_SERVER, label: 'Renamed Server' }
    const after = mapMcpTool({ serverId: 'docs', server: relabeled, tool: TOOL, client })
    expect(before.label).toBe('Docs Server: search_docs')
    expect(after.label).toBe('Renamed Server: search_docs')
    expect(after.id).toBe(before.id)
    expect(after.tool.name).toBe(before.tool.name)
  })

  it('label prefers the tool title over its name when present, without touching the wire name', () => {
    const titled: McpToolInfo = { ...TOOL, title: 'Search the Docs' }
    const { client } = recordingClient({ content: [] })
    const manifest = mapMcpTool({ serverId: 'docs', server: NONE_SERVER, tool: titled, client })
    expect(manifest.label).toBe('Docs Server: Search the Docs')
    expect(manifest.tool.name).toBe('search_docs')
  })
})

describe('mapMcpTool — id grammar (the no-colon server-id guarantee upstream, SPEC-R27)', () => {
  it('produces exactly the mcp:<server-id>:<tool-name> shape given a colon-free server-id', () => {
    // servers-config.ts's loader (S1) already rejects any server-id containing ':' at LOAD time —
    // this module never re-validates that; it trusts the upstream guarantee and just composes the
    // string, so a colon-free id always splits into exactly three segments.
    const { client } = recordingClient({ content: [] })
    const manifest = mapMcpTool({ serverId: 'docs-server_1', server: NONE_SERVER, tool: TOOL, client })
    expect(manifest.id.split(':')).toEqual(['mcp', 'docs-server_1', 'search_docs'])
  })
})

describe('mapMcpTool — schema passthrough (SPEC-R25 AC1)', () => {
  it('input_schema is reference-equal AND deep-equal to the discovered inputSchema — no copy', () => {
    const { client } = recordingClient({ content: [] })
    const manifest = mapMcpTool({ serverId: 'docs', server: NONE_SERVER, tool: TOOL, client })
    expect(manifest.tool.input_schema).toBe(TOOL.inputSchema)
    expect(manifest.tool.input_schema).toEqual(TOOL.inputSchema)
  })

  it('a schema the REAL assertSupportedSchema would reject still passes through untouched here — the gate fires at registration, not in this module', () => {
    const unsupported: McpToolInfo = {
      name: 'weird_tool',
      inputSchema: { type: 'object', properties: { q: { oneOf: [{ type: 'string' }] } } },
    }
    const { client } = recordingClient({ content: [] })
    const manifest = mapMcpTool({ serverId: 'docs', server: NONE_SERVER, tool: unsupported, client })
    // No pre-check throw here — passthrough is unconditional.
    expect(manifest.tool.input_schema).toBe(unsupported.inputSchema)
    // But the SHIPPED gate (imported, not reimplemented) really does reject it downstream, at
    // whatever seam calls it (`registerIntegration`, S4's job) — proving there is no MCP carve-out.
    expect(() => assertSupportedSchema(manifest.tool.input_schema)).toThrow(/unsupported input_schema/)
  })

  it('a schema the REAL assertSupportedSchema accepts also passes through unchanged', () => {
    const { client } = recordingClient({ content: [] })
    const manifest = mapMcpTool({ serverId: 'docs', server: NONE_SERVER, tool: TOOL, client })
    expect(() => assertSupportedSchema(manifest.tool.input_schema)).not.toThrow()
  })
})

describe('mapMcpTool — per-server auth inheritance, both arms (SPEC-R18 unchanged)', () => {
  it('inherits auth:"none" with no envKey', () => {
    const { client } = recordingClient({ content: [] })
    const manifest = mapMcpTool({ serverId: 'docs', server: NONE_SERVER, tool: TOOL, client })
    expect(manifest.auth).toBe('none')
    expect(manifest.envKey).toBeUndefined()
  })

  it('inherits auth:"serverKey" plus its envKey NAME verbatim (never a value)', () => {
    const { client } = recordingClient({ content: [] })
    const manifest = mapMcpTool({ serverId: 'docs', server: KEYED_SERVER, tool: TOOL, client })
    expect(manifest.auth).toBe('serverKey')
    expect(manifest.envKey).toBe('EXAMPLE_MCP_API_KEY')
  })

  it('every tool from the SAME server inherits the identical auth/envKey pair', () => {
    const { client } = recordingClient({ content: [] })
    const otherTool: McpToolInfo = { name: 'delete_doc', inputSchema: { type: 'object' } }
    const a = mapMcpTool({ serverId: 'docs', server: KEYED_SERVER, tool: TOOL, client })
    const b = mapMcpTool({ serverId: 'docs', server: KEYED_SERVER, tool: otherTool, client })
    expect(a.auth).toBe(b.auth)
    expect(a.envKey).toBe(b.envKey)
  })
})

describe('mapMcpTool — execute: TEXT-only flattening (SPEC-R25 AC2)', () => {
  it('joins multiple text parts with a blank line', async () => {
    const { client } = recordingClient({
      content: [
        { type: 'text', text: 'first' },
        { type: 'text', text: 'second' },
      ],
    })
    const manifest = mapMcpTool({ serverId: 'docs', server: NONE_SERVER, tool: TOOL, client })
    await expect(manifest.execute({ q: 'x' }, {})).resolves.toBe('first\n\nsecond')
  })

  it('degrades a non-text part to the stated placeholder, never silently, keeping surrounding text', async () => {
    const { client } = recordingClient({
      content: [
        { type: 'text', text: 'before' },
        { type: 'image', data: 'base64...' },
        { type: 'text', text: 'after' },
      ],
    })
    const manifest = mapMcpTool({ serverId: 'docs', server: NONE_SERVER, tool: TOOL, client })
    await expect(manifest.execute({ q: 'x' }, {})).resolves.toBe('before\n\n[image content omitted]\n\nafter')
  })

  it('resolves an empty string for empty content', async () => {
    const { client } = recordingClient({ content: [] })
    const manifest = mapMcpTool({ serverId: 'docs', server: NONE_SERVER, tool: TOOL, client })
    await expect(manifest.execute({ q: 'x' }, {})).resolves.toBe('')
  })
})

describe('mapMcpTool — execute: isError throws into the existing is_error path (SPEC-R25 AC2)', () => {
  it('throws with the flattened text when isError is true', async () => {
    const { client } = recordingClient({ content: [{ type: 'text', text: 'permission denied' }], isError: true })
    const manifest = mapMcpTool({ serverId: 'docs', server: NONE_SERVER, tool: TOOL, client })
    await expect(manifest.execute({ q: 'x' }, {})).rejects.toThrow('permission denied')
  })

  it('throws a stated fallback message naming the tool when isError is true with no text content', async () => {
    const { client } = recordingClient({ content: [], isError: true })
    const manifest = mapMcpTool({ serverId: 'docs', server: NONE_SERVER, tool: TOOL, client })
    await expect(manifest.execute({ q: 'x' }, {})).rejects.toThrow(/search_docs/)
  })

  it('propagates a transport McpClientError unchanged — the same is_error path applies', async () => {
    const client = stubClient(async () => {
      throw new McpClientError('http', 'search_docs: HTTP 503')
    })
    const manifest = mapMcpTool({ serverId: 'docs', server: NONE_SERVER, tool: TOOL, client })
    await expect(manifest.execute({ q: 'x' }, {})).rejects.toThrow('search_docs: HTTP 503')
  })

  it('rides through the shipped buildToolDispatch exactly like a hand-authored manifest (SPEC-R17 AC2 pattern)', async () => {
    const { client } = recordingClient({ content: [{ type: 'text', text: 'upstream 503' }], isError: true })
    const manifest = mapMcpTool({ serverId: 'docs', server: NONE_SERVER, tool: TOOL, client })
    const { executeTool } = buildToolDispatch([manifest], {})
    await expect(executeTool('search_docs', { q: 'x' })).rejects.toThrow('upstream 503')
  })
})

describe('mapMcpTool — execute: ctx forwarding into callTool (SPEC-R25 AC1 / SPEC-R18)', () => {
  it('forwards ctx.signal and ctx.apiKey into callTool opts, dialing the WIRE name', async () => {
    const { client, calls } = recordingClient({ content: [] })
    const manifest = mapMcpTool({ serverId: 'docs', server: KEYED_SERVER, tool: TOOL, client })
    const signal = new AbortController().signal
    await manifest.execute({ q: 'x' }, { signal, apiKey: 'sekret' })
    expect(calls).toHaveLength(1)
    expect(calls[0]!.name).toBe('search_docs')
    expect(calls[0]!.args).toEqual({ q: 'x' })
    expect(calls[0]!.opts).toEqual({ signal, apiKey: 'sekret' })
  })

  it('an unkeyed ctx (auth:"none") forwards undefined apiKey, never a stray value', async () => {
    const { client, calls } = recordingClient({ content: [] })
    const manifest = mapMcpTool({ serverId: 'docs', server: NONE_SERVER, tool: TOOL, client })
    await manifest.execute({ q: 'x' }, {})
    expect(calls[0]!.opts?.apiKey).toBeUndefined()
  })

  it('forwards ctx.apiKey through buildToolDispatch end to end — the ExecuteContext seam, SPEC-R18', async () => {
    const { client, calls } = recordingClient({ content: [{ type: 'text', text: 'ok' }] })
    const manifest = mapMcpTool({ serverId: 'docs', server: KEYED_SERVER, tool: TOOL, client })
    const { executeTool } = buildToolDispatch([manifest], { EXAMPLE_MCP_API_KEY: 'real-key' })
    await expect(executeTool('search_docs', { q: 'x' })).resolves.toBe('ok')
    expect(calls[0]!.opts?.apiKey).toBe('real-key')
  })
})
