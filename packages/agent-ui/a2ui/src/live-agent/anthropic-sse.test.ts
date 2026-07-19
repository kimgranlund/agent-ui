// anthropic-sse.test.ts — LLD-C8 / SPEC-R11 AC3. The Anthropic adapter's PURE SSE parse is the code
// most likely to break on an upstream-contract change, so it is split out (`parseAnthropicSSE`) and
// gated here against a CAPTURED SSE-response fixture — deterministic, no network, no key. The impure
// fetch/stream arm is MANUAL live acceptance only (SPEC-R3; §2 discovery table).

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseAnthropicSSE, ANTHROPIC_SSE_ERROR_PREFIX } from '../agent/providers/anthropic.ts'
import type { ProviderEvent } from '../agent/agent-transport.ts'
declare const process: { cwd(): string }

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

// ── ADR-0146 F1: the onEvent lifecycle mapping ────────────────────────────────────────────────────────
describe('parseAnthropicSSE — onEvent lifecycle mapping (ADR-0146 F1)', () => {
  it('invokes onEvent with the mapped ProviderEvent sequence while yielding the IDENTICAL text fragments (byte-identical accumulation)', () => {
    const events: ProviderEvent[] = []
    const fragments = [...parseAnthropicSSE(FIXTURE, (ev) => events.push(ev))]
    // text accumulation is unchanged — the regression guard
    expect(fragments).toEqual(['Hello, ', 'world'])
    // the dropped lifecycle frames now surface, in order: message_start → block_start → block_stop → done
    // (message_delta/ping carry no event; content_block_delta text_delta yields text, emits no lifecycle event)
    expect(events.map((e) => e.kind)).toEqual(['message_start', 'block_start', 'block_stop', 'done'])
  })

  it('a caller passing NO onEvent gets today\'s behaviour EXACTLY (byte-identical to the no-callback path)', () => {
    expect([...parseAnthropicSSE(FIXTURE)]).toEqual([...parseAnthropicSSE(FIXTURE, undefined)])
    expect([...parseAnthropicSSE(FIXTURE)]).toEqual(['Hello, ', 'world'])
  })

  it('a thinking_delta maps to {kind:"thinking", text} and is NEVER yielded onto the accumulated wire (F3 default)', () => {
    const chunk =
      'event: content_block_delta\n' +
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"weighing the layout"}}\n\n'
    const events: ProviderEvent[] = []
    const fragments = [...parseAnthropicSSE(chunk, (ev) => events.push(ev))]
    expect(fragments, 'thinking text must never reach the accumulated wire').toEqual([])
    expect(events).toEqual([{ kind: 'thinking', text: 'weighing the layout' }])
  })

  it('the adapter imports NO @anthropic-ai/sdk (SPEC-R3 — plain fetch/SSE only, comments stripped)', () => {
    const src = readFileSync(`${process.cwd()}/packages/agent-ui/a2ui/src/agent/providers/anthropic.ts`, 'utf8') as string
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    expect(code).not.toMatch(/@anthropic-ai\/sdk/)
    expect(code).not.toMatch(/\brequire\s*\(\s*['"]@anthropic/)
  })
})

// ── GH #49 — the tool-use collector (parse-side) ────────────────────────────────────────────────────────

describe('parseAnthropicSSE — tool_use collection (GH #49)', () => {
  const toolStream = [
    'event: message_start',
    'data: {"type":"message_start"}',
    '',
    'event: content_block_start',
    'data: {"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"toolu_1","name":"weather"}}',
    '',
    'event: content_block_delta',
    'data: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{\\"pla"}}',
    '',
    'event: content_block_delta',
    'data: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"ce\\":\\"Oslo\\"}"}}',
    '',
    'event: content_block_stop',
    'data: {"type":"content_block_stop","index":0}',
    '',
    'event: message_delta',
    'data: {"type":"message_delta","delta":{"stop_reason":"tool_use"}}',
    '',
    'event: message_stop',
    'data: {"type":"message_stop"}',
    '',
  ].join('\n')

  it('fills the collector: block id/name captured, partial_json accumulated across deltas, stop_reason recorded — zero text yielded', async () => {
    const { newToolCollector } = await import('../agent/providers/anthropic.ts')
    const collector = newToolCollector()
    const fragments = [...parseAnthropicSSE(toolStream, undefined, collector)]
    expect(fragments).toEqual([])
    expect(collector.calls).toHaveLength(1)
    expect(collector.calls[0]).toMatchObject({ id: 'toolu_1', name: 'weather' })
    expect(JSON.parse(collector.calls[0]!.inputJson)).toEqual({ place: 'Oslo' })
    expect(collector.stopReason).toBe('tool_use')
  })

  it('with NO collector the same stream is byte-inert: no yield, no throw (the pre-#49 behavior)', () => {
    expect([...parseAnthropicSSE(toolStream)]).toEqual([])
  })

  it('a mixed stream still yields ONLY text deltas while collecting the tool block beside them', async () => {
    const { newToolCollector } = await import('../agent/providers/anthropic.ts')
    const mixed = [
      'event: content_block_delta',
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"checking… "}}',
      '',
      'event: content_block_start',
      'data: {"type":"content_block_start","index":1,"content_block":{"type":"tool_use","id":"toolu_2","name":"currency"}}',
      '',
      'event: content_block_delta',
      'data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"{}"}}',
      '',
    ].join('\n')
    const collector = newToolCollector()
    expect([...parseAnthropicSSE(mixed, undefined, collector)]).toEqual(['checking… '])
    expect(collector.calls).toHaveLength(1)
    expect(collector.calls[0]!.name).toBe('currency')
  })
})
