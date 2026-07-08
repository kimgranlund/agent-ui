// errors.test.ts — S5 checkpoint: bidirectional mapping over all 12 codes; an unknown inbound code maps
// to the declared fallback, never a throw.
import { describe, expect, it } from 'vitest'
import { fromRpcError, RPC_ERROR_TABLE, toRpcError } from './errors.ts'
import type { A2aFailure } from '../protocol/validate.ts'

const ALL_CODES = [-32700, -32600, -32601, -32602, -32603, -32001, -32002, -32003, -32004, -32005, -32006, -32007]

describe('RPC error table (LLD-C5, HV-9 verbatim) — 12 codes, both directions', () => {
  it('has exactly the 5 standard + 7 A2A codes', () => {
    const codes = Object.values(RPC_ERROR_TABLE).map((e) => e.code)
    expect(codes.sort((a, b) => a - b)).toEqual(ALL_CODES.slice().sort((a, b) => a - b))
    expect(codes).toHaveLength(12)
  })

  it('fromRpcError round-trips every known code to its name and back to the same code', () => {
    for (const code of ALL_CODES) {
      const { name, code: got } = fromRpcError(code)
      expect(got).toBe(code)
      expect(name).not.toBe('unknown')
    }
  })

  it('fromRpcError falls back to "unknown" for an unrecognized code, preserving the numeric code, never throwing', () => {
    for (const code of [-1, 0, -99999, 32001]) {
      expect(() => fromRpcError(code)).not.toThrow()
      const { name, code: got } = fromRpcError(code)
      expect(name).toBe('unknown')
      expect(got).toBe(code)
    }
  })

  it('toRpcError maps every closed A2aFailure code outbound without throwing', () => {
    const codes: A2aFailure['code'][] = ['A2A_SCHEMA', 'A2A_PIN', 'A2A_STATE', 'A2A_RPC', 'A2A_CARD']
    for (const code of codes) {
      const failure: A2aFailure = { code, path: '/x', detail: 'x' }
      expect(() => toRpcError(failure)).not.toThrow()
      expect(typeof toRpcError(failure).code).toBe('number')
    }
    // A2A_RPC (malformed envelope) maps to InvalidRequest specifically
    expect(toRpcError({ code: 'A2A_RPC', path: '/', detail: 'x' })).toEqual(RPC_ERROR_TABLE.InvalidRequest)
  })

  it('the LLD §5 3-tier rule: parse -> -32700, non-parse A2A_RPC -> -32600, everything else schema-shaped -> -32602', () => {
    // parse-flavored, regardless of which producer coded it (decodeA2a: A2A_SCHEMA; parseFrame: A2A_RPC)
    // — carried via the explicit `parse: true` flag, never sniffed from `detail` text (review fix).
    expect(toRpcError({ code: 'A2A_SCHEMA', path: '/', detail: 'parse error: Unexpected token', parse: true })).toEqual(RPC_ERROR_TABLE.ParseError)
    expect(toRpcError({ code: 'A2A_RPC', path: '/', detail: 'parse error: Unexpected token', parse: true })).toEqual(RPC_ERROR_TABLE.ParseError)
    // non-parse A2A_RPC (malformed envelope shape, not a parse failure)
    expect(toRpcError({ code: 'A2A_RPC', path: '/jsonrpc', detail: 'jsonrpc must be "2.0"' })).toEqual(RPC_ERROR_TABLE.InvalidRequest)
    // everything else schema-shaped
    for (const code of ['A2A_SCHEMA', 'A2A_PIN', 'A2A_CARD', 'A2A_STATE'] as const) {
      expect(toRpcError({ code, path: '/x', detail: 'not a parse error' })).toEqual(RPC_ERROR_TABLE.InvalidParams)
    }
  })

  it('a stringly-worded detail containing "parse error" WITHOUT the explicit flag is NOT treated as parse-tier (no sniffing)', () => {
    expect(toRpcError({ code: 'A2A_SCHEMA', path: '/x', detail: 'parse error mentioned in prose but not a real parse failure' })).toEqual(
      RPC_ERROR_TABLE.InvalidParams,
    )
  })
})
