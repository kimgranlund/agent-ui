// anthropic-usage.test.ts: ADR-0234 (proposed). The Anthropic adapter reports the provider-billed token
// counts as ONE `{kind:'usage'}` ProviderEvent per upstream request: `message_start.message.usage` seeds,
// each `message_delta.usage` overrides (cumulative, latest wins), and the event fires at `message_stop`
// immediately before `done`, only when a `UsageCollector` rides the parse. Pure-parser cases, then the
// mocked-fetch provider (tool loop and text-only), then `produce()` summing the requests onto
// `trace.usage`. Fetch is stubbed PER-TEST with an afterEach unstub (a module-level stub bleeds).
import { describe, it, expect, vi, afterEach } from 'vitest'
import { anthropicProvider, newUsageCollector, parseAnthropicSSE } from '../agent/providers/anthropic.ts'
import type { ProviderEvent, ToolDef, TurnInput } from '../agent/agent-transport.ts'
import { produce } from '../agent/produce.ts'
import type { ProduceDeps } from '../agent/produce.ts'
import { readMetaLine } from '../agent/meta-line.ts'
import { defaultCatalog } from '../catalog/default/index.ts'

afterEach(() => vi.unstubAllGlobals())

/** One SSE frame as `event:` + `data:` + the blank-line separator. */
function frame(event: string, data: Record<string, unknown>): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

function textDelta(text: string): string {
  return frame('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } })
}

function messageStart(usage?: Record<string, number>): string {
  return frame('message_start', { type: 'message_start', message: { id: 'msg_1', ...(usage ? { usage } : {}) } })
}

function messageDelta(stopReason: string, usage?: Record<string, number>): string {
  return frame('message_delta', { type: 'message_delta', delta: { stop_reason: stopReason }, ...(usage ? { usage } : {}) })
}

const STOP = frame('message_stop', { type: 'message_stop' })

function sseResponse(body: string): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(body))
      controller.close()
    },
  })
  return new Response(stream, { status: 200 })
}

function collect(chunk: string, withUsage: boolean): { text: string; events: ProviderEvent[] } {
  const events: ProviderEvent[] = []
  const fragments = withUsage
    ? [...parseAnthropicSSE(chunk, (e) => events.push(e), undefined, newUsageCollector())]
    : [...parseAnthropicSSE(chunk, (e) => events.push(e))]
  return { text: fragments.join(''), events }
}

const usageEvents = (events: ProviderEvent[]): ProviderEvent[] => events.filter((e) => e.kind === 'usage')

const FIXTURE =
  messageStart({ input_tokens: 1200, cache_read_input_tokens: 800, cache_creation_input_tokens: 300, output_tokens: 1 }) +
  textDelta('Hello') +
  textDelta(' world') +
  messageDelta('end_turn', { output_tokens: 57 }) +
  STOP

describe('parseAnthropicSSE usage collection (ADR-0234)', () => {
  it('(a) message_start seeds, message_delta overrides output: exactly one merged usage event before done', () => {
    const { text, events } = collect(FIXTURE, true)
    expect(text).toBe('Hello world')
    expect(usageEvents(events)).toEqual([
      {
        kind: 'usage',
        usage: { inputTokens: 1200, outputTokens: 57, cacheReadInputTokens: 800, cacheCreationInputTokens: 300 },
      },
    ])
    const kinds = events.map((e) => e.kind)
    expect(kinds.slice(-2)).toEqual(['usage', 'done'])
  })

  it('(b) message_delta input and cache fields override the seed', () => {
    const chunk =
      messageStart({ input_tokens: 10, cache_read_input_tokens: 5, cache_creation_input_tokens: 2, output_tokens: 1 }) +
      textDelta('x') +
      messageDelta('end_turn', { input_tokens: 11, cache_read_input_tokens: 6, cache_creation_input_tokens: 3, output_tokens: 9 }) +
      STOP
    expect(usageEvents(collect(chunk, true).events)).toEqual([
      { kind: 'usage', usage: { inputTokens: 11, outputTokens: 9, cacheReadInputTokens: 6, cacheCreationInputTokens: 3 } },
    ])
  })

  it('(c) a collector with no usage frames emits no usage event', () => {
    const chunk = messageStart() + textDelta('x') + messageDelta('end_turn') + STOP
    const { events } = collect(chunk, true)
    expect(usageEvents(events)).toEqual([])
    expect(events.map((e) => e.kind)).toContain('done')
  })

  it('(d) the two-argument call emits no usage event and yields identical text', () => {
    const withCollector = collect(FIXTURE, true)
    const twoArg = collect(FIXTURE, false)
    expect(usageEvents(twoArg.events)).toEqual([])
    expect(twoArg.text).toBe(withCollector.text)
    expect(twoArg.events).toEqual(withCollector.events.filter((e) => e.kind !== 'usage'))
  })
})

const TOOLS: ToolDef[] = [
  { name: 'weather', description: 'w', input_schema: { type: 'object', properties: { place: { type: 'string' } }, required: ['place'] } },
]

const TOOL_ROUND =
  messageStart({ input_tokens: 100, output_tokens: 1 }) +
  frame('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id: 'toolu_x', name: 'weather' } }) +
  frame('content_block_delta', {
    type: 'content_block_delta',
    index: 0,
    delta: { type: 'input_json_delta', partial_json: '{"place":"Bergen"}' },
  }) +
  frame('content_block_stop', { type: 'content_block_stop', index: 0 }) +
  messageDelta('tool_use', { output_tokens: 20 }) +
  STOP

const FINAL_ROUND =
  messageStart({ input_tokens: 150, cache_read_input_tokens: 90, output_tokens: 1 }) +
  textDelta('{"final":true}') +
  messageDelta('end_turn', { output_tokens: 30 }) +
  STOP

describe('anthropicProvider usage events (mocked fetch, ADR-0234)', () => {
  it('(e) a two-request tool loop gives two usage events, in request order', async () => {
    let call = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        call += 1
        return sseResponse(call === 1 ? TOOL_ROUND : FINAL_ROUND)
      }),
    )
    const events: ProviderEvent[] = []
    const fragments: string[] = []
    const provider = anthropicProvider({ apiKey: 'test-key' })
    for await (const f of provider.stream({
      model: 'claude-sonnet-4-5',
      system: 's',
      messages: [{ role: 'user', content: 'weather?' }],
      tools: TOOLS,
      executeTool: async () => 'rain',
      onEvent: (e) => events.push(e),
    })) {
      fragments.push(f)
    }
    expect(call).toBe(2)
    expect(fragments.join('')).toBe('{"final":true}')
    expect(usageEvents(events)).toEqual([
      { kind: 'usage', usage: { inputTokens: 100, outputTokens: 20 } },
      { kind: 'usage', usage: { inputTokens: 150, outputTokens: 30, cacheReadInputTokens: 90 } },
    ])
  })

  it('(f) the text-only path gives one usage event', async () => {
    const fetchMock = vi.fn(async () => sseResponse(FIXTURE))
    vi.stubGlobal('fetch', fetchMock)
    const events: ProviderEvent[] = []
    const provider = anthropicProvider({ apiKey: 'test-key' })
    let text = ''
    for await (const f of provider.stream({
      model: 'claude-sonnet-4-5',
      system: 's',
      messages: [{ role: 'user', content: 'hi' }],
      onEvent: (e) => events.push(e),
    })) {
      text += f
    }
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(text).toBe('Hello world')
    expect(usageEvents(events)).toEqual([
      {
        kind: 'usage',
        usage: { inputTokens: 1200, outputTokens: 57, cacheReadInputTokens: 800, cacheCreationInputTokens: 300 },
      },
    ])
  })
})

const NOTE = '{"a2uiMeta":{"note":"here you go"}}\n'
// An UNKNOWN component: CATALOG-invalid, so produce() self-corrects into a second request.
const INVALID =
  NOTE +
  '{"version":"v1.0","createSurface":{"surfaceId":"main","catalogId":"agent-ui"}}\n' +
  '{"version":"v1.0","updateComponents":{"surfaceId":"main","components":[{"id":"root","component":"NotARealComponent"}]}}'
const VALID =
  NOTE +
  '{"version":"v1.0","createSurface":{"surfaceId":"main","catalogId":"agent-ui"}}\n' +
  '{"version":"v1.0","updateComponents":{"surfaceId":"main","components":[{"id":"root","component":"Button","label":"Hi","action":{"action":"submit"}}]}}'

describe('produce() over anthropicProvider (mocked fetch, ADR-0234)', () => {
  it('(g) trace.usage equals the per-request sum', async () => {
    const responses = [
      messageStart({ input_tokens: 1000, cache_read_input_tokens: 400, output_tokens: 1 }) +
        textDelta(INVALID) +
        messageDelta('end_turn', { output_tokens: 70 }) +
        STOP,
      messageStart({ input_tokens: 1300, cache_read_input_tokens: 400, cache_creation_input_tokens: 25, output_tokens: 1 }) +
        textDelta(VALID) +
        messageDelta('end_turn', { output_tokens: 80 }) +
        STOP,
    ]
    let call = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => sseResponse(responses[Math.min(call++, responses.length - 1)]!)),
    )
    const intent: TurnInput = { kind: 'intent', text: 'a submit button', session: { turns: [] } }
    const deps: ProduceDeps = { provider: anthropicProvider({ apiKey: 'test-key' }), retrieve: () => [], catalog: defaultCatalog }
    const lines: string[] = []
    for await (const line of produce(intent, deps, { maxRounds: 3 })) lines.push(line)

    expect(call).toBe(2)
    const trace = lines.map((l) => readMetaLine(l)?.a2uiMeta.trace).find((t) => t !== undefined)
    expect(trace).toBeDefined()
    expect(trace!.usage).toEqual({
      inputTokens: 2300,
      outputTokens: 150,
      cacheReadInputTokens: 800,
      cacheCreationInputTokens: 25,
    })
  })
})
