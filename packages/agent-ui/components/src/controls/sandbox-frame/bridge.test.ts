import { describe, it, expect } from 'vitest'
import { BRIDGE_MEMBERS, parseFrameMessage, utf8ByteLength, ACTION_NAME_MAX_LENGTH, ACTION_PAYLOAD_MAX_BYTES } from './bridge.ts'

// bridge.test.ts — genui-surface.spec.md SPEC-R7 AC2 (the closed six-member set, set-equal against the
// SPEC table) + SPEC-R7/R8's structural message-guard (pure, DOM-free unit tests; the live
// out-of-vocabulary/foreign-source browser probe lives in sandbox-frame.browser.test.ts).

describe('BRIDGE_MEMBERS — the closed six (SPEC-R7 AC2)', () => {
  it('is set-equal to the SPEC-R7 table', () => {
    expect(new Set(BRIDGE_MEMBERS)).toEqual(new Set(['initialize', 'initialized', 'teardown', 'size-changed', 'host-context-changed', 'action']))
  })

  it('NEGATIVE: a planted seventh member fails the set-equal comparison', () => {
    const planted = new Set([...BRIDGE_MEMBERS, 'zz-seventh'])
    expect(planted).not.toEqual(new Set(BRIDGE_MEMBERS))
  })
})

describe('parseFrameMessage — the frame→host structural guard (SPEC-R7)', () => {
  it('accepts a well-formed initialize message', () => {
    expect(parseFrameMessage({ type: 'initialize' })).toEqual({ type: 'initialize' })
  })

  it('accepts a well-formed size-changed message', () => {
    expect(parseFrameMessage({ type: 'size-changed', height: 240 })).toEqual({ type: 'size-changed', height: 240 })
  })

  it('rejects a malformed size-changed message (non-number height)', () => {
    expect(parseFrameMessage({ type: 'size-changed', height: 'lol' })).toBeUndefined()
    expect(parseFrameMessage({ type: 'size-changed', height: Number.NaN })).toBeUndefined()
    expect(parseFrameMessage({ type: 'size-changed', height: Infinity })).toBeUndefined()
  })

  it('accepts a well-formed action message with and without a payload', () => {
    expect(parseFrameMessage({ type: 'action', name: 'choose' })).toEqual({ type: 'action', name: 'choose' })
    expect(parseFrameMessage({ type: 'action', name: 'choose', payload: { id: 3 } })).toEqual({
      type: 'action', name: 'choose', payload: { id: 3 },
    })
  })

  it('rejects an action message with an empty or over-length name', () => {
    expect(parseFrameMessage({ type: 'action', name: '' })).toBeUndefined()
    expect(parseFrameMessage({ type: 'action', name: 'x'.repeat(ACTION_NAME_MAX_LENGTH + 1) })).toBeUndefined()
    expect(parseFrameMessage({ type: 'action', name: 'x'.repeat(ACTION_NAME_MAX_LENGTH) })).toBeDefined() // boundary: exactly the cap is accepted
  })

  it('rejects an action message whose payload exceeds the 16 KiB serialized cap', () => {
    const big = { blob: 'x'.repeat(ACTION_PAYLOAD_MAX_BYTES) } // the wrapper JSON alone exceeds the cap
    expect(parseFrameMessage({ type: 'action', name: 'x', payload: big })).toBeUndefined()
  })

  it('accepts an action message whose payload is exactly at the cap boundary', () => {
    // `JSON.stringify({p:"..."})` — reserve a few bytes for the wrapper `{"p":""}` (7 bytes) so the
    // whole serialized string lands exactly at the byte cap.
    const wrapperBytes = utf8ByteLength(JSON.stringify({ p: '' }))
    const filler = 'x'.repeat(ACTION_PAYLOAD_MAX_BYTES - wrapperBytes)
    const payload = { p: filler }
    expect(utf8ByteLength(JSON.stringify(payload))).toBe(ACTION_PAYLOAD_MAX_BYTES)
    expect(parseFrameMessage({ type: 'action', name: 'x', payload })).toBeDefined()
  })

  it('rejects a non-JSON-serializable payload (a cyclic structure)', () => {
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    expect(parseFrameMessage({ type: 'action', name: 'x', payload: cyclic })).toBeUndefined()
  })

  it('rejects a host→frame member arriving on the frame→host channel (out-of-vocabulary for THIS guard)', () => {
    expect(parseFrameMessage({ type: 'initialized', tokens: {}, colorScheme: 'light' })).toBeUndefined()
    expect(parseFrameMessage({ type: 'host-context-changed', tokens: {}, colorScheme: 'light' })).toBeUndefined()
    expect(parseFrameMessage({ type: 'teardown' })).toBeUndefined()
  })

  it('rejects an out-of-vocabulary type entirely (a tools/call-shaped message)', () => {
    expect(parseFrameMessage({ type: 'tools/call', name: 'evil' })).toBeUndefined()
  })

  it('rejects non-object / null / primitive payloads without throwing', () => {
    expect(parseFrameMessage(null)).toBeUndefined()
    expect(parseFrameMessage(undefined)).toBeUndefined()
    expect(parseFrameMessage('garbage')).toBeUndefined()
    expect(parseFrameMessage(42)).toBeUndefined()
    expect(parseFrameMessage([1, 2, 3])).toBeUndefined()
  })

  it('rejects a message with no type field', () => {
    expect(parseFrameMessage({ height: 100 })).toBeUndefined()
  })
})

describe('utf8ByteLength', () => {
  it('measures ASCII 1:1 and multi-byte UTF-8 correctly', () => {
    expect(utf8ByteLength('abc')).toBe(3)
    expect(utf8ByteLength('日本語')).toBe(9) // 3 bytes per CJK char in UTF-8
  })
})
