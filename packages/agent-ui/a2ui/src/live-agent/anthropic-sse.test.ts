// anthropic-sse.test.ts — LLD-C8 / SPEC-R11 AC3. The Anthropic adapter's PURE SSE parse is the code
// most likely to break on an upstream-contract change, so it is split out (`parseAnthropicSSE`) and
// gated here against a CAPTURED SSE-response fixture — deterministic, no network, no key. The impure
// fetch/stream arm is MANUAL live acceptance only (SPEC-R3; §2 discovery table).

import { describe, it, expect } from 'vitest'
import { parseAnthropicSSE, ANTHROPIC_SSE_ERROR_PREFIX } from '../../tools/agent/providers/anthropic.ts'

// A captured multi-event Anthropic Messages SSE response (the host-verified 2026-07-04 shape): a
// message_start, a content_block_start, two text_delta content_block_deltas, a ping, a content_block_stop,
// a message_delta, and message_stop. Only the two text_delta `delta.text` values are model output.
const FIXTURE = [
  'event: message_start',
  'data: {"type":"message_start","message":{"id":"msg_1","role":"assistant","model":"claude-sonnet-5"}}',
  '',
  'event: content_block_start',
  'data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}',
  '',
  'event: content_block_delta',
  'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello, "}}',
  '',
  'event: ping',
  'data: {"type":"ping"}',
  '',
  'event: content_block_delta',
  'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"world"}}',
  '',
  'event: content_block_stop',
  'data: {"type":"content_block_stop","index":0}',
  '',
  'event: message_delta',
  'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}',
  '',
  'event: message_stop',
  'data: {"type":"message_stop"}',
  '',
].join('\n')

describe('parseAnthropicSSE (LLD-C10 / SPEC-R11 AC3)', () => {
  it('yields ONLY the text_delta fragments, ignoring lifecycle + ping events', () => {
    const fragments = [...parseAnthropicSSE(FIXTURE)]
    expect(fragments).toEqual(['Hello, ', 'world'])
    expect(fragments.join('')).toBe('Hello, world')
  })

  it('ignores a non-text delta (thinking / tool_use) without emitting it', () => {
    const chunk =
      'event: content_block_delta\n' +
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"hmm"}}\n\n'
    expect([...parseAnthropicSSE(chunk)]).toEqual([])
  })

  it('surfaces an event: error frame as a distinguishable sentinel (never silently dropped)', () => {
    const errChunk =
      'event: error\ndata: {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}\n\n'
    const fragments = [...parseAnthropicSSE(errChunk)]
    expect(fragments).toHaveLength(1)
    expect(fragments[0]!.startsWith(ANTHROPIC_SSE_ERROR_PREFIX)).toBe(true)
    expect(fragments[0]).toContain('overloaded_error')
  })
})
