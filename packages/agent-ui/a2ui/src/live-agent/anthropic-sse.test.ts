// anthropic-sse.test.ts — LLD-C8 / SPEC-R11 AC3. The Anthropic adapter's PURE SSE parse is the code
// most likely to break on an upstream-contract change, so it is split out (`parseAnthropicSSE`) and
// gated here against a CAPTURED SSE-response fixture — deterministic, no network, no key. The impure
// fetch/stream arm is MANUAL live acceptance only (SPEC-R3; §2 discovery table).

import { describe, it, expect } from 'vitest'
import { parseAnthropicSSE, ANTHROPIC_SSE_ERROR_PREFIX } from '../agent/providers/anthropic.ts'
import type { ProviderEvent } from '../agent/agent-transport.ts'

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

// ── ADR-0146 F1/F4 — the optional onEvent lifecycle callback ─────────────────────────────────────────────
describe('parseAnthropicSSE onEvent (ADR-0146 F1/F4)', () => {
  it('with onEvent: maps the lifecycle frames to a ProviderEvent sequence WHILE yielding the IDENTICAL text fragments (the byte-identical accumulation regression guard)', () => {
    const events: ProviderEvent[] = []
    const fragments = [...parseAnthropicSSE(FIXTURE, (ev) => events.push(ev))]
    expect(fragments).toEqual(['Hello, ', 'world']) // text accumulation is UNCHANGED by onEvent
    expect(fragments.join('')).toBe('Hello, world')
    // the fixture's lifecycle frames, in order: message_start → content_block_start → content_block_stop →
    // message_stop (message_delta + ping + the two text_deltas are NOT lifecycle events on this seam).
    expect(events.map((e) => e.kind)).toEqual(['message_start', 'block_start', 'block_stop', 'done'])
  })

  it('a caller passing NO onEvent gets byte-identical behaviour to before (the additive `effort?` precedent)', () => {
    expect([...parseAnthropicSSE(FIXTURE)]).toEqual(['Hello, ', 'world'])
  })

  it('a thinking_delta maps to {kind:"thinking", text} — and is STILL never yielded as a text fragment', () => {
    const chunk =
      'event: content_block_delta\n' +
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"let me reason about this"}}\n\n'
    const events: ProviderEvent[] = []
    const fragments = [...parseAnthropicSSE(chunk, (ev) => events.push(ev))]
    expect(fragments).toEqual([]) // never text (unchanged from the pre-0146 "ignores a non-text delta" test above)
    expect(events).toEqual([{ kind: 'thinking', text: 'let me reason about this' }])
  })
})
