// anthropic-terminal-tool.test.ts: RTS-R2, the seam's `terminalTools` and `toolChoice` in the Anthropic
// adapter, proven against scripted SSE through a per-test `fetch` stub (no network, no key). AC1: the
// request body maps `toolChoice` to `tool_choice` only when no `thinking` is sent. AC2: a terminal-only
// round yields its text live, before the executor runs, and makes one request. AC3: a mixed round keeps
// the GH #49 law (two requests, only the second round's text), and a terminal call ends that loop.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { anthropicProvider, buildRequestBody } from '../agent/providers/anthropic.ts'
import type { ToolDef } from '../agent/agent-transport.ts'

afterEach(() => vi.unstubAllGlobals())

/** One SSE frame, terminated by the blank line the adapter splits on. */
function frame(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

const textStart = (index: number): string => frame('content_block_start', { type: 'content_block_start', index, content_block: { type: 'text', text: '' } })
const textDelta = (index: number, text: string): string => frame('content_block_delta', { type: 'content_block_delta', index, delta: { type: 'text_delta', text } })
const toolStart = (index: number, id: string, name: string): string =>
  frame('content_block_start', { type: 'content_block_start', index, content_block: { type: 'tool_use', id, name } })
const inputDelta = (index: number, partial: string): string =>
  frame('content_block_delta', { type: 'content_block_delta', index, delta: { type: 'input_json_delta', partial_json: partial } })
const blockStop = (index: number): string => frame('content_block_stop', { type: 'content_block_stop', index })
const end = (stopReason: string): string =>
  frame('message_delta', { type: 'message_delta', delta: { stop_reason: stopReason } }) + frame('message_stop', { type: 'message_stop' })

/** A 200 SSE response whose body arrives as the given chunks; a chunk after the first is enqueued on a
 *  timer (logging `chunk<n>` first) so a test can see whether text was yielded before the rest arrived. */
function sseResponse(chunks: string[], log?: string[]): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(chunks[0]!))
      const rest = chunks.slice(1)
      if (rest.length === 0) {
        controller.close()
        return
      }
      const next = (at: number): void => {
        setTimeout(() => {
          log?.push(`chunk${at + 2}`)
          controller.enqueue(encoder.encode(rest[at]!))
          if (at + 1 < rest.length) next(at + 1)
          else controller.close()
        }, 10)
      }
      next(0)
    },
  })
  return new Response(stream, { status: 200 })
}

const RENDER_SURFACE: ToolDef = {
  name: 'render_surface',
  description: 'Render an A2UI surface.',
  input_schema: { type: 'object', properties: { jsonl: { type: 'string' } }, required: ['jsonl'] },
}
const WEATHER: ToolDef = {
  name: 'weather',
  description: 'w',
  input_schema: { type: 'object', properties: { place: { type: 'string' } }, required: ['place'] },
}

/** The render_surface input JSON, split mid-escape (between a backslash and its quote) so only the fully
 *  assembled block parses. */
const SURFACE_INPUT = { jsonl: '{"version":"v0.9","createSurface":{"surfaceId":"s1"}}' }
const SURFACE_JSON = JSON.stringify(SURFACE_INPUT)
const SPLIT_AT = SURFACE_JSON.indexOf('\\"') + 1
const SURFACE_PARTS = [SURFACE_JSON.slice(0, SPLIT_AT), SURFACE_JSON.slice(SPLIT_AT)]

function stubFetch(responses: Array<() => Response>): Array<Record<string, unknown>> {
  const bodies: Array<Record<string, unknown>> = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>)
      const next = responses[bodies.length - 1]
      if (!next) throw new Error(`unexpected request #${bodies.length}`)
      return next()
    }),
  )
  return bodies
}

describe('tool_choice', () => {
  const body = (model: string, effort?: 'low' | 'high', tools: ToolDef[] = [RENDER_SURFACE]): Record<string, unknown> =>
    buildRequestBody({
      model,
      system: 's',
      messages: [{ role: 'user', content: 'hi' }],
      tools,
      toolChoice: { name: 'render_surface' },
      ...(effort ? { effort } : {}),
    })

  it('effort absent or low (no thinking field) sends tool_choice {type:"tool", name}', () => {
    for (const model of ['claude-haiku-5-5', 'claude-sonnet-5']) {
      for (const effort of [undefined, 'low'] as const) {
        const b = body(model, effort)
        expect(b.thinking).toBeUndefined()
        expect(b.tool_choice).toEqual({ type: 'tool', name: 'render_surface' })
      }
    }
  })

  it('effort high (thinking sent) omits tool_choice', () => {
    for (const model of ['claude-haiku-5-5', 'claude-sonnet-5', 'claude-haiku-4-5']) {
      const b = body(model, 'high')
      expect(b.thinking).toBeDefined()
      expect(b.tool_choice).toBeUndefined()
    }
  })

  it('no tools in the body means no tool_choice, and no toolChoice means none', () => {
    expect(body('claude-sonnet-5', undefined, []).tool_choice).toBeUndefined()
    const plain = buildRequestBody({ model: 'claude-sonnet-5', system: 's', messages: [{ role: 'user', content: 'hi' }], tools: [RENDER_SURFACE] })
    expect(plain.tool_choice).toBeUndefined()
  })

  it('stream() carries toolChoice onto the request body', async () => {
    const bodies = stubFetch([() => sseResponse([textStart(0) + textDelta(0, 'ok') + blockStop(0) + end('end_turn')])])
    const provider = anthropicProvider({ apiKey: 'test-key' })
    const fragments: string[] = []
    for await (const frag of provider.stream({
      model: 'claude-sonnet-5',
      system: 'sys',
      messages: [{ role: 'user', content: 'show me a card' }],
      tools: [RENDER_SURFACE],
      executeTool: async () => 'received',
      terminalTools: ['render_surface'],
      toolChoice: { name: 'render_surface' },
    })) {
      fragments.push(frag)
    }
    expect(fragments.join('')).toBe('ok')
    expect(bodies).toHaveLength(1)
    expect(bodies[0]!.tool_choice).toEqual({ type: 'tool', name: 'render_surface' })
  })
})

describe('terminal round', () => {
  it('yields the text fragments before the executor runs and makes exactly one request', async () => {
    const log: string[] = []
    const bodies = stubFetch([
      () =>
        sseResponse(
          [
            textStart(0) + textDelta(0, 'Here is ') + textDelta(0, 'your card.'),
            blockStop(0) + toolStart(1, 'toolu_r', 'render_surface') + inputDelta(1, SURFACE_PARTS[0]!),
            inputDelta(1, SURFACE_PARTS[1]!) + blockStop(1) + end('tool_use'),
          ],
          log,
        ),
    ])
    const executed: Array<{ name: string; input: Record<string, unknown> }> = []
    const provider = anthropicProvider({ apiKey: 'test-key' })
    for await (const frag of provider.stream({
      model: 'claude-sonnet-5',
      system: 'sys',
      messages: [{ role: 'user', content: 'show me a card' }],
      tools: [RENDER_SURFACE],
      executeTool: async (name, input) => {
        log.push('exec')
        executed.push({ name, input })
        return 'received'
      },
      terminalTools: ['render_surface'],
    })) {
      log.push(`frag:${frag}`)
    }

    // Live: both fragments are yielded before the tool_use chunks arrive, and the executor runs last.
    expect(log).toEqual(['frag:Here is ', 'frag:your card.', 'chunk2', 'chunk3', 'exec'])
    // The input is read from the fully assembled block, not a fragment.
    expect(executed).toEqual([{ name: 'render_surface', input: SURFACE_INPUT }])
    // No continuation request.
    expect(bodies).toHaveLength(1)
    expect(bodies[0]!.tools).toEqual([RENDER_SURFACE])
  })

  it('a text-only terminal round yields its text and never calls the executor', async () => {
    const bodies = stubFetch([() => sseResponse([textStart(0) + textDelta(0, 'Just words.') + blockStop(0) + end('end_turn')])])
    let calls = 0
    const provider = anthropicProvider({ apiKey: 'test-key' })
    const fragments: string[] = []
    for await (const frag of provider.stream({
      model: 'claude-sonnet-5',
      system: 'sys',
      messages: [{ role: 'user', content: 'hi' }],
      tools: [RENDER_SURFACE],
      executeTool: async () => {
        calls += 1
        return 'received'
      },
      terminalTools: ['render_surface'],
    })) {
      fragments.push(frag)
    }
    expect(fragments.join('')).toBe('Just words.')
    expect(calls).toBe(0)
    expect(bodies).toHaveLength(1)
  })
})

describe('mixed round', () => {
  const TOOLS = [WEATHER, RENDER_SURFACE]

  it('an integration tool_use then a text round makes two requests and yields only the second round', async () => {
    const bodies = stubFetch([
      () =>
        sseResponse([
          textStart(0) + textDelta(0, 'Let me check. ') + blockStop(0) + toolStart(1, 'toolu_w', 'weather') + inputDelta(1, '{"place":"Bergen"}') + blockStop(1) + end('tool_use'),
        ]),
      () => sseResponse([textStart(0) + textDelta(0, 'Bergen is rainy.') + blockStop(0) + end('end_turn')]),
    ])
    const executed: string[] = []
    const provider = anthropicProvider({ apiKey: 'test-key' })
    const fragments: string[] = []
    for await (const frag of provider.stream({
      model: 'claude-sonnet-5',
      system: 'sys',
      messages: [{ role: 'user', content: 'weather in Bergen?' }],
      tools: TOOLS,
      executeTool: async (name) => {
        executed.push(name)
        return 'Bergen: 12C, rain.'
      },
      terminalTools: ['render_surface'],
    })) {
      fragments.push(frag)
    }
    expect(bodies).toHaveLength(2)
    expect(fragments.join('')).toBe('Bergen is rainy.')
    expect(executed).toEqual(['weather'])
  })

  it('a terminal call ends the loop: executed once, integration calls in that round skipped, no continuation', async () => {
    const log: string[] = []
    const bodies = stubFetch([
      () =>
        sseResponse([
          textStart(0) +
            textDelta(0, 'Here it is.') +
            blockStop(0) +
            toolStart(1, 'toolu_w', 'weather') +
            inputDelta(1, '{"place":"Bergen"}') +
            blockStop(1) +
            toolStart(2, 'toolu_r', 'render_surface') +
            inputDelta(2, SURFACE_PARTS[0]!) +
            inputDelta(2, SURFACE_PARTS[1]!) +
            blockStop(2) +
            end('tool_use'),
        ]),
    ])
    const executed: Array<{ name: string; input: Record<string, unknown> }> = []
    const provider = anthropicProvider({ apiKey: 'test-key' })
    for await (const frag of provider.stream({
      model: 'claude-sonnet-5',
      system: 'sys',
      messages: [{ role: 'user', content: 'show the forecast' }],
      tools: TOOLS,
      executeTool: async (name, input) => {
        log.push('exec')
        executed.push({ name, input })
        return 'received'
      },
      terminalTools: ['render_surface'],
    })) {
      log.push(`frag:${frag}`)
    }
    expect(bodies).toHaveLength(1)
    expect(executed).toEqual([{ name: 'render_surface', input: SURFACE_INPUT }])
    // Mixed rounds stay buffered: the text flows only after the terminal call ran.
    expect(log).toEqual(['exec', 'frag:Here it is.'])
  })
})
