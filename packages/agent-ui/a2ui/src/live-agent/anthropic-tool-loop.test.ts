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

  // T-0031: the Haiku 5.5 / Sonnet 5 migration guide: "pass thinking blocks back unmodified with tool
  // results", in the order received, signature intact, the empty-`thinking` Haiku 5.5 default included.
  describe('thinking blocks ride the tool-loop replay unchanged (T-0031)', () => {
    /** One tool round whose stream opens with the given thinking-block frames, then text, then a tool call. */
    const thinkingRound = (thinkingFrames: string[]): string[] => [
      ...thinkingFrames,
      'event: content_block_start',
      'data: {"type":"content_block_start","index":1,"content_block":{"type":"text","text":""}}',
      '',
      'event: content_block_delta',
      'data: {"type":"content_block_delta","index":1,"delta":{"type":"text_delta","text":"Let me check that. "}}',
      '',
      'event: content_block_start',
      'data: {"type":"content_block_start","index":2,"content_block":{"type":"tool_use","id":"toolu_x","name":"weather"}}',
      '',
      'event: content_block_delta',
      'data: {"type":"content_block_delta","index":2,"delta":{"type":"input_json_delta","partial_json":"{\\"place\\":\\"Bergen\\"}"}}',
      '',
      'event: message_delta',
      'data: {"type":"message_delta","delta":{"stop_reason":"tool_use"}}',
      '',
      'event: message_stop',
      'data: {"type":"message_stop"}',
      '',
    ]

    /** Drive a two-round turn; return the round-2 assistant turn, the yielded text and the ProviderEvents. */
    async function replayOf(round1: string[]) {
      const bodies: Array<Record<string, unknown>> = []
      let call = 0
      vi.stubGlobal(
        'fetch',
        vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
          bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>)
          call += 1
          return call === 1 ? sseResponse(round1) : sseResponse(FINAL_ROUND)
        }),
      )
      const events: ProviderEvent[] = []
      const fragments: string[] = []
      for await (const frag of anthropicProvider({ apiKey: 'test-key' }).stream({
        model: 'claude-haiku-5-5',
        system: 'sys',
        messages: [{ role: 'user', content: 'weather in Bergen?' }],
        tools: TOOLS,
        executeTool: async () => 'Bergen: 12°C, rain.',
        onEvent: (ev) => events.push(ev),
      })) {
        fragments.push(frag)
      }
      const round2 = bodies[1]!.messages as Array<{ role: string; content: unknown }>
      return { assistant: round2.at(-2)!, fragments, events }
    }

    const SIGNED_THINKING = [
      'event: content_block_start',
      'data: {"type":"content_block_start","index":0,"content_block":{"type":"thinking","thinking":""}}',
      '',
      'event: content_block_delta',
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"Bergen is wet. "}}',
      '',
      'event: content_block_delta',
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"Ask the weather tool."}}',
      '',
      'event: content_block_delta',
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"signature_delta","signature":"sig_abc"}}',
      '',
      'event: content_block_stop',
      'data: {"type":"content_block_stop","index":0}',
      '',
    ]

    it('a thinking block before a tool call goes back FIRST in the assistant turn, text and signature intact', async () => {
      const { assistant, fragments, events } = await replayOf(thinkingRound(SIGNED_THINKING))
      expect(assistant.role).toBe('assistant')
      expect(assistant.content).toEqual([
        { type: 'thinking', thinking: 'Bergen is wet. Ask the weather tool.', signature: 'sig_abc' },
        { type: 'text', text: 'Let me check that. ' },
        { type: 'tool_use', id: 'toolu_x', name: 'weather', input: { place: 'Bergen' } },
      ])
      // the replay is request-side only: the thinking text never joins the accumulated wire, and the
      // ProviderEvent stream (ADR-0146 F1, ADR-0240) is unchanged, with no signature on it
      expect(fragments.join('')).toBe('{"final":true}')
      expect(events.filter((e) => e.kind === 'thinking').map((e) => e.text)).toEqual(['Bergen is wet. ', 'Ask the weather tool.'])
      expect(JSON.stringify(events)).not.toContain('sig_abc')
    })

    it('the Haiku 5.5 default (empty `thinking`, signature only) is kept as {thinking:"", signature}', async () => {
      const { assistant } = await replayOf(
        thinkingRound([
          'event: content_block_start',
          'data: {"type":"content_block_start","index":0,"content_block":{"type":"thinking","thinking":""}}',
          '',
          'event: content_block_delta',
          'data: {"type":"content_block_delta","index":0,"delta":{"type":"signature_delta","signature":"sig_only"}}',
          '',
          'event: content_block_stop',
          'data: {"type":"content_block_stop","index":0}',
          '',
        ]),
      )
      expect((assistant.content as unknown[])[0]).toEqual({ type: 'thinking', thinking: '', signature: 'sig_only' })
    })

    it('a redacted_thinking block goes back as received, in its place', async () => {
      const { assistant } = await replayOf(
        thinkingRound([
          'event: content_block_start',
          'data: {"type":"content_block_start","index":0,"content_block":{"type":"redacted_thinking","data":"opaque-bytes"}}',
          '',
          'event: content_block_stop',
          'data: {"type":"content_block_stop","index":0}',
          '',
        ]),
      )
      expect((assistant.content as Array<{ type: string }>).map((b) => b.type)).toEqual(['redacted_thinking', 'text', 'tool_use'])
      expect((assistant.content as unknown[])[0]).toEqual({ type: 'redacted_thinking', data: 'opaque-bytes' })
    })

    it('a thinking block whose signature never arrived is left out (the API 400s an unsigned block)', async () => {
      const { assistant } = await replayOf(
        thinkingRound([
          'event: content_block_start',
          'data: {"type":"content_block_start","index":0,"content_block":{"type":"thinking","thinking":""}}',
          '',
          'event: content_block_delta',
          'data: {"type":"content_block_delta","index":0,"delta":{"type":"thinking_delta","thinking":"unsigned"}}',
          '',
        ]),
      )
      expect((assistant.content as Array<{ type: string }>).map((b) => b.type)).toEqual(['text', 'tool_use'])
    })

    it('two thinking blocks keep their received order around the text', async () => {
      const second = [
        'event: content_block_start',
        'data: {"type":"content_block_start","index":3,"content_block":{"type":"thinking","thinking":""}}',
        '',
        'event: content_block_delta',
        'data: {"type":"content_block_delta","index":3,"delta":{"type":"signature_delta","signature":"sig_two"}}',
        '',
      ]
      const base = thinkingRound(SIGNED_THINKING)
      // splice a second thinking block between the text block and the tool call (index 2 frames start at 'content_block_start' for tool_use)
      const at = base.findIndex((l) => l.includes('"index":2,"content_block"')) - 1
      const { assistant } = await replayOf([...base.slice(0, at), ...second, ...base.slice(at)])
      expect((assistant.content as Array<{ type: string }>).map((b) => b.type)).toEqual(['thinking', 'text', 'thinking', 'tool_use'])
      expect((assistant.content as Array<{ signature?: string }>)[2]!.signature).toBe('sig_two')
    })
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

// T-0034: an object-typed field that arrives as a JSON string (Haiku 5.5 peer report).
describe('anthropicProvider: stringified object fields (T-0034)', () => {
  const OBJ_TOOLS: ToolDef[] = [
    { name: 'weather', description: 'w', input_schema: { type: 'object', properties: { place: { type: 'string' }, opts: { type: 'object' } } } },
  ]
  const roundWith = (inputJson: string) => [
    'event: content_block_start',
    'data: {"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"toolu_x","name":"weather"}}',
    '',
    'event: content_block_delta',
    `data: ${JSON.stringify({ type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: inputJson } })}`,
    '',
    'event: message_delta',
    'data: {"type":"message_delta","delta":{"stop_reason":"tool_use"}}',
    '',
    'event: message_stop',
    'data: {"type":"message_stop"}',
    '',
  ]
  async function run(inputJson: string) {
    const bodies: Array<Record<string, unknown>> = []
    let n = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_u: RequestInfo | URL, init?: RequestInit) => {
        bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>)
        n += 1
        return n === 1 ? sseResponse(roundWith(inputJson)) : sseResponse(FINAL_ROUND)
      }),
    )
    const executed: Array<Record<string, unknown>> = []
    const provider = anthropicProvider({ apiKey: 'test-key' })
    for await (const _ of provider.stream({
      model: 'claude-haiku-5-5',
      system: 's',
      messages: [{ role: 'user', content: 'x' }],
      tools: OBJ_TOOLS,
      executeTool: async (_name, input) => {
        executed.push(input)
        return 'ok'
      },
    })) void _
    const last = (bodies[1]!.messages as Array<{ content: Array<{ content?: string; is_error?: boolean }> }>).at(-1)!.content[0]!
    return { executed, last }
  }

  it('parses a stringified object field', async () => {
    const { executed } = await run('{"place":"Bergen","opts":"{\\"units\\":\\"c\\"}"}')
    expect(executed).toEqual([{ place: 'Bergen', opts: { units: 'c' } }])
  })
  it('rejects a malformed string plainly, naming the field, without executing', async () => {
    const { executed, last } = await run('{"opts":"not json"}')
    expect(executed).toEqual([])
    expect(last.is_error).toBe(true)
    expect(last.content).toContain('"opts"')
  })
  it('leaves a normal object (control) and non-object string fields untouched', async () => {
    const { executed } = await run('{"place":"{\\"a\\":1}","opts":{"units":"c"}}')
    expect(executed).toEqual([{ place: '{"a":1}', opts: { units: 'c' } }])
  })
})
