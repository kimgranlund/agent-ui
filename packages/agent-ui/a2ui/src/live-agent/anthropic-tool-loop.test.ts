// anthropic-tool-loop.test.ts — GH #49: the adapter's INTERNAL tool-use loop, proven against a mocked
// two-round fetch sequence (no network, no key). Pins the four load-bearing behaviors: (1) round-1
// scratch text is NEVER yielded (only the post-tools round's output reaches the accumulated wire the
// A2UI producer validates); (2) executeTool receives the PARSED input; (3) the round-2 request body
// carries the assistant tool_use + user tool_result follow-ups AND the tools array; (4) the 'tool'
// ProviderEvent fires with the registry name. Fetch is stubbed PER-TEST with an afterEach unstub — the
// command-palette.browser.test.ts:48 law (a module-level stub bleeds).
import { describe, it, expect, vi, afterEach } from 'vitest'
import { anthropicProvider } from '../agent/providers/anthropic.ts'
import type { ProviderEvent, ToolDef } from '../agent/agent-transport.ts'

afterEach(() => vi.unstubAllGlobals())

function sseResponse(lines: string[]): Response {
  const body = lines.join('\n')
  // jsdom's Blob has no .stream() — construct the ReadableStream directly (one whole-body chunk; the
  // adapter's boundary buffering handles any chunking, proven by the sse fixture suite).
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(body))
      controller.close()
    },
  })
  return new Response(stream, { status: 200 })
}

const TOOL_ROUND = [
  'event: content_block_start',
  'data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}',
  '',
  'event: content_block_delta',
  'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Let me check that. "}}',
  '',
  'event: content_block_start',
  'data: {"type":"content_block_start","index":1,"content_block":{"type":"tool_use","id":"toolu_x","name":"weather"}}',
  '',
  'event: content_block_delta',
  'data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"{\\"place\\":\\"Bergen\\"}"}}',
  '',
  'event: message_delta',
  'data: {"type":"message_delta","delta":{"stop_reason":"tool_use"}}',
  '',
  'event: message_stop',
  'data: {"type":"message_stop"}',
  '',
]

const FINAL_ROUND = [
  'event: content_block_delta',
  'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"{\\"final\\":true}"}}',
  '',
  'event: message_delta',
  'data: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}',
  '',
  'event: message_stop',
  'data: {"type":"message_stop"}',
  '',
]

const TOOLS: ToolDef[] = [
  { name: 'weather', description: 'w', input_schema: { type: 'object', properties: { place: { type: 'string' } }, required: ['place'] } },
]

describe('anthropicProvider — the GH #49 tool-use loop (mocked fetch)', () => {
  it('executes the call, feeds results back, suppresses scratch text, yields only the final round', async () => {
    const bodies: Array<Record<string, unknown>> = []
    let call = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
        bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>)
        call += 1
        return call === 1 ? sseResponse(TOOL_ROUND) : sseResponse(FINAL_ROUND)
      }),
    )

    const executed: Array<{ name: string; input: Record<string, unknown> }> = []
    const events: ProviderEvent[] = []
    const provider = anthropicProvider({ apiKey: 'test-key' })
    const fragments: string[] = []
    for await (const frag of provider.stream({
      model: 'claude-sonnet-5',
      system: 'sys',
      messages: [{ role: 'user', content: 'weather in Bergen?' }],
      tools: TOOLS,
      executeTool: async (name, input) => {
        executed.push({ name, input })
        return 'Bergen: 12°C, rain.'
      },
      onEvent: (ev) => events.push(ev),
    })) {
      fragments.push(frag)
    }

    // (1) scratch text suppressed; only the final round's text flows
    expect(fragments.join('')).toBe('{"final":true}')
    // (2) parsed input reached the executor
    expect(executed).toEqual([{ name: 'weather', input: { place: 'Bergen' } }])
    // (3) round-2 body: tools + the tool_use/tool_result follow-ups
    expect(bodies).toHaveLength(2)
    expect(bodies[0]!.tools).toEqual(TOOLS)
    const round2Messages = bodies[1]!.messages as Array<{ role: string; content: unknown }>
    const assistant = round2Messages.at(-2)!
    const toolResult = round2Messages.at(-1)!
    expect(assistant.role).toBe('assistant')
    expect(assistant.content).toEqual([
      { type: 'text', text: 'Let me check that. ' },
      { type: 'tool_use', id: 'toolu_x', name: 'weather', input: { place: 'Bergen' } },
    ])
    expect(toolResult.role).toBe('user')
    expect(toolResult.content).toEqual([{ type: 'tool_result', tool_use_id: 'toolu_x', content: 'Bergen: 12°C, rain.' }])
    // (4) the 'tool' event carried the registry name
    expect(events.some((e) => e.kind === 'tool' && e.text === 'weather')).toBe(true)
  })

  it('a REJECTED executeTool becomes an is_error tool_result — the turn continues, never throws', async () => {
    let call = 0
    const bodies: Array<Record<string, unknown>> = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
        bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>)
        call += 1
        return call === 1 ? sseResponse(TOOL_ROUND) : sseResponse(FINAL_ROUND)
      }),
    )
    const provider = anthropicProvider({ apiKey: 'test-key' })
    const fragments: string[] = []
    for await (const frag of provider.stream({
      model: 'claude-sonnet-5',
      system: 'sys',
      messages: [{ role: 'user', content: 'x' }],
      tools: TOOLS,
      executeTool: async () => {
        throw new Error('upstream 503')
      },
    })) {
      fragments.push(frag)
    }
    expect(fragments.join('')).toBe('{"final":true}')
    const toolResult = (bodies[1]!.messages as Array<{ content: unknown }>).at(-1)!
    expect(toolResult.content).toEqual([
      { type: 'tool_result', tool_use_id: 'toolu_x', content: 'tool failed: upstream 503', is_error: true },
    ])
  })

  it('WITHOUT tools the request body is byte-identical to the pre-#49 shape and one round streams through', async () => {
    const bodies: Array<Record<string, unknown>> = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
        bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>)
        return sseResponse(FINAL_ROUND)
      }),
    )
    const provider = anthropicProvider({ apiKey: 'test-key' })
    const fragments: string[] = []
    for await (const frag of provider.stream({ model: 'claude-sonnet-5', system: 'sys', messages: [{ role: 'user', content: 'x' }] })) {
      fragments.push(frag)
    }
    expect(fragments.join('')).toBe('{"final":true}')
    expect(bodies).toHaveLength(1)
    expect('tools' in bodies[0]!).toBe(false)
  })

  it('CAP EXHAUSTION (PR #59 review): a model that always wants tools makes exactly MAX_TOOL_ROUNDS+1 fetches, MAX_TOOL_ROUNDS executions, and the forced-final round\'s text is PRESERVED', async () => {
    let fetches = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        fetches += 1
        return sseResponse(TOOL_ROUND) // EVERY round ends stop_reason:'tool_use'
      }),
    )
    let executions = 0
    const provider = anthropicProvider({ apiKey: 'test-key' })
    const fragments: string[] = []
    for await (const frag of provider.stream({
      model: 'claude-sonnet-5',
      system: 'sys',
      messages: [{ role: 'user', content: 'x' }],
      tools: TOOLS,
      executeTool: async () => {
        executions += 1
        return 'ok'
      },
    })) {
      fragments.push(frag)
    }
    // rounds 0..4 fetch (5 calls); rounds 0..3 execute (4); round 4 is FORCED final — its buffered text
    // must flow, never be lost (the `round <= MAX` / `round < MAX` pairing this leg pins against refactors).
    expect(fetches).toBe(5)
    expect(executions).toBe(4)
    expect(fragments.join('')).toBe('Let me check that. ')
  })
})
