// servers-config.test.ts — LLD-C1's gate (SPEC-R27 AC1): the allowlist loader's fail-fast contract,
// deterministic, zero I/O, zero network. Covers valid/malformed shapes, the two independent server-id
// rejections (the derived no-colon law vs the convention charset), and the empty-roster valid case.
import { describe, it, expect } from 'vitest'
import { validateMcpServersConfig } from './servers-config.ts'
import type { McpServersConfig } from './servers-config.ts'
import mcpServersRaw from '../../mcp-servers.json'

function validEntry(overrides: Partial<McpServersConfig['servers'][string]> = {}) {
  return {
    label: 'Example Docs Server',
    endpoint: 'https://mcp.example.com/mcp',
    auth: 'none' as const,
    ...overrides,
  }
}

describe('validateMcpServersConfig — the empty roster (SPEC-R27 shipped state)', () => {
  it('accepts { servers: {} } as valid', () => {
    const cfg = { servers: {} }
    expect(validateMcpServersConfig(cfg)).toEqual({ servers: {} })
  })

  it('accepts the actual committed mcp-servers.json shape', () => {
    expect(() => validateMcpServersConfig(mcpServersRaw)).not.toThrow()
    expect(validateMcpServersConfig(mcpServersRaw)).toEqual({ servers: {} })
  })
})

describe('validateMcpServersConfig — valid shapes', () => {
  it('accepts a single auth:"none" server', () => {
    const cfg = { servers: { docs: validEntry() } }
    expect(validateMcpServersConfig(cfg)).toEqual(cfg)
  })

  it('accepts a single auth:"serverKey" server with a non-empty envKey', () => {
    const cfg = { servers: { docs: validEntry({ auth: 'serverKey', envKey: 'DOCS_MCP_API_KEY' }) } }
    expect(validateMcpServersConfig(cfg)).toEqual(cfg)
  })

  it('accepts multiple servers and server-ids using the full allowed charset', () => {
    const cfg = {
      servers: {
        'docs-server_1': validEntry(),
        a1: validEntry({ endpoint: 'http://localhost:9000/mcp' }),
      },
    }
    expect(validateMcpServersConfig(cfg)).toEqual(cfg)
  })
})

describe('validateMcpServersConfig — root/servers shape', () => {
  it('throws on a non-object root', () => {
    expect(() => validateMcpServersConfig(null)).toThrow(/root must be an object/)
    expect(() => validateMcpServersConfig('nope')).toThrow(/root must be an object/)
    expect(() => validateMcpServersConfig([])).toThrow(/root must be an object/)
  })

  it('throws when "servers" is missing or not an object', () => {
    expect(() => validateMcpServersConfig({})).toThrow(/"servers" must be an object/)
    expect(() => validateMcpServersConfig({ servers: null })).toThrow(/"servers" must be an object/)
    expect(() => validateMcpServersConfig({ servers: [] })).toThrow(/"servers" must be an object/)
    expect(() => validateMcpServersConfig({ servers: 'nope' })).toThrow(/"servers" must be an object/)
  })
})

describe('validateMcpServersConfig — server-id charset (LLD §8, two independent rejections)', () => {
  it('rejects a colon — the DERIVED namespace-unparseable exclusion', () => {
    const cfg = { servers: { 'docs:server': validEntry() } }
    expect(() => validateMcpServersConfig(cfg)).toThrow(/must not contain ":"/)
  })

  it('rejects an id outside the convention charset (uppercase, leading dash, empty)', () => {
    expect(() => validateMcpServersConfig({ servers: { Docs: validEntry() } })).toThrow(/must match/)
    expect(() => validateMcpServersConfig({ servers: { '-docs': validEntry() } })).toThrow(/must match/)
    expect(() => validateMcpServersConfig({ servers: { '': validEntry() } })).toThrow(/must match/)
    expect(() => validateMcpServersConfig({ servers: { 'docs server': validEntry() } })).toThrow(/must match/)
  })
})

describe('validateMcpServersConfig — per-entry fail-fast (the providers-config.ts posture)', () => {
  it('throws when an entry is not an object', () => {
    expect(() => validateMcpServersConfig({ servers: { docs: null } })).toThrow(/server "docs" must be an object/)
    expect(() => validateMcpServersConfig({ servers: { docs: 'nope' } })).toThrow(/server "docs" must be an object/)
  })

  it('throws on a missing/empty label', () => {
    const { label: _label, ...rest } = validEntry()
    expect(() => validateMcpServersConfig({ servers: { docs: rest } })).toThrow(/is missing label/)
    expect(() => validateMcpServersConfig({ servers: { docs: validEntry({ label: '' }) } })).toThrow(/is missing label/)
  })

  it('throws when endpoint is missing, not absolute, or not http(s)', () => {
    const { endpoint: _endpoint, ...rest } = validEntry()
    expect(() => validateMcpServersConfig({ servers: { docs: rest } })).toThrow(/endpoint must be an absolute http\(s\) URL/)
    expect(() => validateMcpServersConfig({ servers: { docs: validEntry({ endpoint: '/relative/path' }) } })).toThrow(
      /endpoint must be an absolute http\(s\) URL/,
    )
    expect(() => validateMcpServersConfig({ servers: { docs: validEntry({ endpoint: 'ftp://mcp.example.com' }) } })).toThrow(
      /endpoint must be an absolute http\(s\) URL/,
    )
  })

  it('throws when auth is outside the two-member enum', () => {
    expect(() => validateMcpServersConfig({ servers: { docs: validEntry({ auth: 'mcp' as never }) } })).toThrow(
      /auth must be "none" or "serverKey"/,
    )
  })

  it('throws on auth:"serverKey" without a non-empty envKey', () => {
    const { auth: _auth, ...rest } = validEntry()
    expect(() => validateMcpServersConfig({ servers: { docs: { ...rest, auth: 'serverKey' } } })).toThrow(
      /auth "serverKey" requires a non-empty envKey/,
    )
    expect(() => validateMcpServersConfig({ servers: { docs: validEntry({ auth: 'serverKey', envKey: '' }) } })).toThrow(
      /auth "serverKey" requires a non-empty envKey/,
    )
  })

  it('reports the first violation across multiple malformed servers (fail-fast, not fail-soft)', () => {
    const cfg = {
      servers: {
        good: validEntry(),
        bad: { label: '', endpoint: 'https://x', auth: 'none' },
      },
    }
    expect(() => validateMcpServersConfig(cfg)).toThrow(/server "bad" is missing label/)
  })
})
