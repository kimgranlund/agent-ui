// service-ref.test.ts — LLD-C1's gate (SPEC-R2 AC1): the AC1 vector set verbatim, PLUS the
// charset-parity trip-wire (LLD §5.1) that proves this module's grammar stays in BEHAVIORAL
// lockstep with the frozen `mcp/servers-config.ts`'s `SERVER_ID_PATTERN` — without ever importing
// or copying that regex. Deterministic, no network, no registry touched.
import { describe, it, expect } from 'vitest'
import { SERVICE_REF_PATTERN, parseServiceRef, serviceRef, serviceRefPrefix } from './service-ref.ts'
import { validateMcpServersConfig } from './mcp/servers-config.ts'

describe('parseServiceRef — the SPEC-R2 AC1 vector set', () => {
  it('parses exactly the ref-shaped member; everything else is an exact id', () => {
    expect(parseServiceRef('mcp:calc:*')).toBe('calc')
    // Plain ids — never mis-parsed as a ref for a server the grammar cannot even name.
    expect(parseServiceRef('mcp:calc:add')).toBeNull()
    expect(parseServiceRef('weather')).toBeNull()
    // The discriminating case: a real tool literally named `add:*` on server `calc` mints exactly
    // this manifest id — the middle segment's colon fails the server-id charset, so this stays an
    // exact id, never a ref for a server named `calc:add`.
    expect(parseServiceRef('mcp:calc:add:*')).toBeNull()
    // Fail-closed exact ids that resolve to nothing downstream.
    expect(parseServiceRef('mcp:*')).toBeNull()
    expect(parseServiceRef('mcp::*')).toBeNull()
    expect(parseServiceRef('*')).toBeNull()
  })
})

describe('serviceRef / serviceRefPrefix — the composer pair', () => {
  it('serviceRef composes the exact template parseServiceRef un-composes', () => {
    expect(serviceRef('calc')).toBe('mcp:calc:*')
    expect(parseServiceRef(serviceRef('calc'))).toBe('calc')
  })

  it('serviceRefPrefix is the expansion key — what a registered manifest id must start with', () => {
    expect(serviceRefPrefix('calc')).toBe('mcp:calc:')
    expect('mcp:calc:add'.startsWith(serviceRefPrefix('calc'))).toBe(true)
    expect('mcp:calculator:add'.startsWith(serviceRefPrefix('calc'))).toBe(false)
  })
})

describe('SERVICE_REF_PATTERN — negative controls (anchored, no multiline escape)', () => {
  it('never matches with leading/trailing junk or an embedded newline', () => {
    expect(SERVICE_REF_PATTERN.test(' mcp:calc:*')).toBe(false)
    expect(SERVICE_REF_PATTERN.test('mcp:calc:* ')).toBe(false)
    expect(SERVICE_REF_PATTERN.test('mcp:calc:*\nmcp:evil:*')).toBe(false)
    expect(SERVICE_REF_PATTERN.test('xmcp:calc:*')).toBe(false)
  })
})

describe('the charset-parity trip-wire (LLD §5.1) — behavioral lockstep with SERVER_ID_PATTERN', () => {
  const validEntry = { label: 'Test server', endpoint: 'https://fake.example/mcp', auth: 'none' as const }

  function rosterAccepts(id: string): boolean {
    try {
      validateMcpServersConfig({ servers: { [id]: validEntry } })
      return true
    } catch {
      return false
    }
  }

  // Boundary set per LLD §5.1 — spans the charset's accept/reject edges (leading digit, hyphen,
  // underscore, uppercase, leading hyphen, colon, space, empty) without ever exporting or copying
  // servers-config.ts's own SERVER_ID_PATTERN literal.
  const probes = ['a', 'a-b', 'a_b', '9x', 'A', '-a', 'a:b', 'a b', '']

  it.each(probes)('roster-accepts(%j) === (parseServiceRef(serviceRef(%j)) === id) — no drift', (id) => {
    expect(rosterAccepts(id)).toBe(parseServiceRef(serviceRef(id)) === id)
  })

  it('the trip-wire actually discriminates — at least one probe on each side of the fence', () => {
    const accepted = probes.filter(rosterAccepts)
    const rejected = probes.filter((id) => !rosterAccepts(id))
    expect(accepted.length).toBeGreaterThan(0)
    expect(rejected.length).toBeGreaterThan(0)
  })
})
