// anthropic-server-tools.test.ts: T-0203. Server tool turns on the wire, fetch stubbed (no network): a
// `pause_turn` is continued by resending the paused content, and a client tool loop replays the server tool
// blocks and text citations in place beside the thinking blocks. Plus the mid-conversation effort fallback
// when the opening level's thinking is not adaptive.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { anthropicProvider, anthropicBetas, buildRequestBody } from '../agent/providers/anthropic.ts'

afterEach(() => vi.unstubAllGlobals())

const frame = (event: string, data: unknown): string => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`

/** One recorded round: blocks in order, then the stop reason. */
function round(blocks: string[], stop: string): string {
  return frame('message_start', { type: 'message_start', message: { usage: { input_tokens: 1 } } }) + blocks.join('') + frame('message_delta', { type: 'message_delta', delta: { stop_reason: stop } }) + frame('message_stop', { type: 'message_stop' })
}
const text = (index: number, value: string, citation?: unknown): string =>
  frame('content_block_start', { type: 'content_block_start', index, content_block: { type: 'text', text: '' } }) +
  (citation !== undefined ? frame('content_block_delta', { type: 'content_block_delta', index, delta: { type: 'citations_delta', citation } }) : '') +
  frame('content_block_delta', { type: 'content_block_delta', index, delta: { type: 'text_delta', text: value } }) +
  frame('content_block_stop', { type: 'content_block_stop', index })
const thinking = (index: number): string =>
  frame('content_block_start', { type: 'content_block_start', index, content_block: { type: 'thinking', thinking: '' } }) +
  frame('content_block_delta', { type: 'content_block_delta', index, delta: { type: 'thinking_delta', thinking: 'hmm' } }) +
  frame('content_block_delta', { type: 'content_block_delta', index, delta: { type: 'signature_delta', signature: 'sig' } }) +
  frame('content_block_stop', { type: 'content_block_stop', index })
const search = (index: number, id: string): string =>
  frame('content_block_start', { type: 'content_block_start', index, content_block: { type: 'server_tool_use', id, name: 'web_search' } }) +
  frame('content_block_delta', { type: 'content_block_delta', index, delta: { type: 'input_json_delta', partial_json: '{"query":"news"}' } }) +
  frame('content_block_stop', { type: 'content_block_stop', index })
const RESULT = { type: 'web_search_tool_result', tool_use_id: 'srv1', content: [{ type: 'web_search_result', url: 'https://example.com', title: 'Ex', encrypted_content: 'ENC' }] }
const result = (index: number): string =>
  frame('content_block_start', { type: 'content_block_start', index, content_block: RESULT }) + frame('content_block_stop', { type: 'content_block_stop', index })
const toolUse = (index: number, id: string, name: string): string =>
  frame('content_block_start', { type: 'content_block_start', index, content_block: { type: 'tool_use', id, name } }) +
  frame('content_block_delta', { type: 'content_block_delta', index, delta: { type: 'input_json_delta', partial_json: '{}' } }) +
  frame('content_block_stop', { type: 'content_block_stop', index })
const CITATION = { type: 'web_search_result_location', url: 'https://example.com', title: 'Ex', encrypted_index: 'IDX', cited_text: 'fact' }

/** Stub fetch with one recorded stream per call; returns the sent bodies. */
function stub(streams: string[]): Record<string, unknown>[] {
  const bodies: Record<string, unknown>[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: unknown, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>)
      const body = streams.shift() ?? round([], 'end_turn')
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(body))
          controller.close()
        },
      })
      return new Response(stream, { status: 200 })
    }),
  )
  return bodies
}

async function collect(it: AsyncIterable<string>): Promise<string> {
  let out = ''
  for await (const fragment of it) out += fragment
  return out
}

describe('T-0203: pause_turn continuation', () => {
  it('the text path resends the paused assistant content and carries on; the text streams through', async () => {
    const bodies = stub([round([text(0, 'Searching. '), search(1, 'srv1'), result(2)], 'pause_turn'), round([text(0, 'Found it.', CITATION)], 'end_turn')])
    const out = await collect(anthropicProvider({ apiKey: 'k' }).stream({ model: 'claude-opus-5-5', system: 's', messages: [{ role: 'user', content: 'news?' }], modelSettings: { webSearch: {} } }))
    expect(out).toBe('Searching. Found it.')
    expect(bodies).toHaveLength(2)
    const messages = bodies[1]!['messages'] as unknown[]
    expect(messages.at(-1)).toEqual({
      role: 'assistant',
      content: [
        { type: 'text', text: 'Searching. ' },
        { type: 'server_tool_use', id: 'srv1', name: 'web_search', input: { query: 'news' } },
        RESULT,
      ],
    })
  })

  it('continuations are bounded at three', async () => {
    const paused = () => round([text(0, 'x')], 'pause_turn')
    const bodies = stub([paused(), paused(), paused(), paused(), paused()])
    await collect(anthropicProvider({ apiKey: 'k' }).stream({ model: 'claude-opus-5-5', system: 's', messages: [{ role: 'user', content: 'q' }] }))
    expect(bodies).toHaveLength(4)
  })

  it('the client tool loop continues a paused round and folds it into one assistant turn', async () => {
    const bodies = stub([
      round([search(0, 'srv1'), result(1)], 'pause_turn'),
      round([toolUse(0, 'tu1', 'lookup')], 'tool_use'),
      round([text(0, 'done')], 'end_turn'),
    ])
    const out = await collect(
      anthropicProvider({ apiKey: 'k' }).stream({
        model: 'claude-opus-5-5',
        system: 's',
        messages: [{ role: 'user', content: 'q' }],
        tools: [{ name: 'lookup', description: 'l', input_schema: { type: 'object', properties: {} } }],
        executeTool: async () => 'ok',
      }),
    )
    expect(out).toBe('done')
    expect(bodies).toHaveLength(3)
    const last = bodies[2]!['messages'] as { role: string; content: { type: string }[] }[]
    expect(last.at(-2)!.content.map((b) => b.type)).toEqual(['server_tool_use', 'web_search_tool_result', 'tool_use'])
  })
})

describe('T-0203: a client tool loop replays server tool blocks and citations in place', () => {
  it('thinking, the search call, its result, the cited text and the tool_use go back in arrival order', async () => {
    const bodies = stub([
      round([thinking(0), search(1, 'srv1'), result(2), text(3, 'Per the source, fact.', CITATION), toolUse(4, 'tu1', 'lookup')], 'tool_use'),
      round([text(0, 'final')], 'end_turn'),
    ])
    await collect(
      anthropicProvider({ apiKey: 'k' }).stream({
        model: 'claude-opus-5-5',
        system: 's',
        messages: [{ role: 'user', content: 'q' }],
        tools: [{ name: 'lookup', description: 'l', input_schema: { type: 'object', properties: {} } }],
        executeTool: async () => 'ok',
        modelSettings: { webSearch: {} },
      }),
    )
    const messages = bodies[1]!['messages'] as { role: string; content: unknown }[]
    expect(messages[1]).toEqual({
      role: 'assistant',
      content: [
        { type: 'thinking', thinking: 'hmm', signature: 'sig' },
        { type: 'server_tool_use', id: 'srv1', name: 'web_search', input: { query: 'news' } },
        RESULT,
        { type: 'text', text: 'Per the source, fact.', citations: [CITATION] },
        { type: 'tool_use', id: 'tu1', name: 'lookup', input: {} },
      ],
    })
  })
})

describe('T-0203: the per-message effort plan falls back when the opening thinking is not adaptive', () => {
  const history = (effort: 'low' | 'medium') => [
    { role: 'user' as const, content: 'q0', effort },
    { role: 'assistant' as const, content: 'a0' },
    { role: 'user' as const, content: 'q1' },
  ]
  it('Haiku 5.5 thinking off at low, then xhigh: a plain top-level change, no marker, no beta', () => {
    const body = buildRequestBody({ model: 'claude-haiku-5-5', system: 's', messages: history('low'), effort: 'xhigh', modelSettings: { thinking: 'disabled' } })
    expect(anthropicBetas(body)).toEqual([])
    expect(body['output_config']).toEqual({ effort: 'xhigh' })
    expect(body['thinking']).toEqual({ type: 'adaptive', display: 'summarized' })
  })
  it('Sonnet 5.5 between_tools at medium, then xhigh: a plain top-level change, no marker, no beta', () => {
    const body = buildRequestBody({ model: 'claude-sonnet-5-5', system: 's', messages: history('medium'), effort: 'xhigh', modelSettings: { thinking: 'between_tools' } })
    expect(anthropicBetas(body)).toEqual([])
    expect(body['output_config']).toEqual({ effort: 'xhigh' })
    expect((body['messages'] as { role: string }[]).some((m) => m.role === 'system')).toBe(false)
  })
})
