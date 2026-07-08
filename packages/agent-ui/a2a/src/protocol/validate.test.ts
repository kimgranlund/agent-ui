// validate.test.ts — S3 checkpoint: totality corpus (0 throws, SPEC-R6 AC1) + one firing fixture + one
// passing sibling per code (the negative-control discipline). A2A_STATE is exercised by the LLD-C4
// guard's own test (task-state.test.ts), not here — this validator never emits it (LLD §3).
import { describe, expect, it } from 'vitest'
import { validateA2a, type A2aFailure } from './validate.ts'
import { PROTOCOL_VERSION } from './types.ts'

import cardReferee from './fixtures/card.referee.json?raw'
import rpcMessageSendRequest from './fixtures/rpc.message-send.request.json?raw'
import messageText from './fixtures/message.text.json?raw'

const opts = { protocolVersion: PROTOCOL_VERSION } as const
const codesOf = (failures: A2aFailure[]) => failures.map((f) => f.code)

describe('validateA2a (LLD-C3) — per-code negative controls', () => {
  it('A2A_SCHEMA fires on a missing "message" discriminator; the sibling with it passes', () => {
    const good = JSON.parse(messageText)
    const bad = { ...good }
    delete (bad as Record<string, unknown>).kind
    expect(codesOf(validateA2a(bad, { ...opts, expect: 'message' }))).toContain('A2A_SCHEMA')
    expect(validateA2a(good, { ...opts, expect: 'message' })).toEqual([])
  })

  it('A2A_SCHEMA fires on unknown part discriminator (SPEC-R3 AC2)', () => {
    const msg = JSON.parse(messageText) as { parts: unknown[] }
    msg.parts = [{ kind: 'unknown-part-kind' }]
    const failures = validateA2a(msg, { ...opts, expect: 'message' })
    expect(failures).toEqual([{ code: 'A2A_SCHEMA', path: '/parts/0/kind', detail: expect.any(String) }])
  })

  it('A2A_SCHEMA fires on a FilePart with both bytes+uri, and on neither', () => {
    const both = { kind: 'message', role: 'user', messageId: 'm1', parts: [{ kind: 'file', file: { bytes: 'YQ==', uri: 'https://x' } }] }
    const neither = { kind: 'message', role: 'user', messageId: 'm1', parts: [{ kind: 'file', file: {} }] }
    expect(codesOf(validateA2a(both, { ...opts, expect: 'message' }))).toContain('A2A_SCHEMA')
    expect(codesOf(validateA2a(neither, { ...opts, expect: 'message' }))).toContain('A2A_SCHEMA')
  })

  it('A2A_PIN fires on a mismatched protocolVersion; the pinned card passes', () => {
    const good = JSON.parse(cardReferee)
    const bad = { ...good, protocolVersion: '1.0.0' }
    expect(codesOf(validateA2a(bad, { ...opts, expect: 'card' }))).toContain('A2A_PIN')
    expect(validateA2a(good, { ...opts, expect: 'card' })).toEqual([])
  })

  it('A2A_CARD fires on a card missing a required field; the sibling with it passes', () => {
    const good = JSON.parse(cardReferee)
    const bad = { ...good }
    delete (bad as Record<string, unknown>).name
    expect(codesOf(validateA2a(bad, { ...opts, expect: 'card' }))).toContain('A2A_CARD')
    expect(validateA2a(good, { ...opts, expect: 'card' })).toEqual([])
  })

  it('A2A_RPC fires on a malformed envelope (missing jsonrpc); the sibling passes', () => {
    const good = JSON.parse(rpcMessageSendRequest)
    const bad = { ...good }
    delete (bad as Record<string, unknown>).jsonrpc
    expect(codesOf(validateA2a(bad, { ...opts, expect: 'rpc-request' }))).toContain('A2A_RPC')
    expect(validateA2a(good, { ...opts, expect: 'rpc-request' })).toEqual([])
  })

  it("protocolVersion/version conflation: both required card fields are checked independently", () => {
    const good = JSON.parse(cardReferee)
    const bad = { ...good }
    delete (bad as Record<string, unknown>).version
    const failures = validateA2a(bad, { ...opts, expect: 'card' })
    expect(failures.some((f) => f.path.endsWith('/version'))).toBe(true)
    // protocolVersion is untouched and still pin-valid — not flagged
    expect(failures.some((f) => f.code === 'A2A_PIN')).toBe(false)
  })
})

describe('validateA2a — totality (0 throws over a malformed-input corpus)', () => {
  const base = JSON.parse(messageText) as Record<string, unknown>
  const scalars = [undefined, null, 0, 1, -1, '', 'x', true, false, [], {}, () => {}, Symbol('x'), 10n]
  const keys = ['kind', 'role', 'parts', 'messageId', 'metadata']

  it('field deletion never throws', () => {
    for (const k of keys) {
      const mutated = { ...base }
      delete mutated[k]
      expect(() => validateA2a(mutated, { ...opts, expect: 'message' })).not.toThrow()
    }
  })

  it('field retyping across scalar/array/object never throws', () => {
    for (const k of keys) {
      for (const s of scalars) {
        const mutated = { ...base, [k]: s }
        expect(() => validateA2a(mutated, { ...opts, expect: 'message' })).not.toThrow()
      }
    }
  })

  it('discriminator corruption never throws (top-level and per-part)', () => {
    for (const s of scalars) {
      expect(() => validateA2a({ ...base, kind: s }, { ...opts, expect: 'message' })).not.toThrow()
      expect(() =>
        validateA2a({ ...base, parts: [{ kind: s }] }, { ...opts, expect: 'message' }),
      ).not.toThrow()
    }
  })

  it('wholly foreign shapes never throw, across every artifact kind', () => {
    const foreign = [null, undefined, 0, '', [], {}, 'plain string', 42, true, [1, 2, 3], { a: { b: { c: 1 } } }]
    const kinds = ['message', 'task', 'card', 'rpc-request', 'rpc-response', 'auto'] as const
    for (const f of foreign) {
      for (const k of kinds) {
        expect(() => validateA2a(f, { ...opts, expect: k })).not.toThrow()
      }
    }
  })

  it('a structured fuzzer over nested field paths never throws', () => {
    const card = JSON.parse(cardReferee) as Record<string, unknown>
    const paths: Array<[Record<string, unknown>, string]> = [
      [base, 'kind'],
      [base, 'parts'],
      [card, 'capabilities'],
      [card, 'skills'],
      [card, 'protocolVersion'],
    ]
    for (const [obj, key] of paths) {
      for (const s of scalars) {
        const mutated = { ...obj, [key]: s }
        expect(() => validateA2a(mutated, { ...opts, expect: 'auto' })).not.toThrow()
      }
    }
  })
})
