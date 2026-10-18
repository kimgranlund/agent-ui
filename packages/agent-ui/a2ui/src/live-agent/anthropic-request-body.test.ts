// anthropic-request-body.test.ts — the Anthropic adapter's PURE request-body builder (`buildRequestBody`,
// tools/agent/providers/anthropic.ts), extracted for deterministic testing without a live key or network —
// the `anthropic-sse.test.ts`/`parseAnthropicSSE` precedent, applied to the Effort dial (the Figma
// chat-input refactor). The impure `stream()`/fetch arm stays MANUAL live acceptance only (SPEC-R3).

import { describe, it, expect, vi, afterEach } from 'vitest'
import { buildRequestBody, anthropicBetas, anthropicProvider, MID_CONVERSATION_EFFORT_BETA } from '../agent/providers/anthropic.ts'
import { MODEL_CAPABILITIES } from '../agent/model-capabilities.ts'

const BASE = { model: 'claude-sonnet-5-5', system: 'be helpful', messages: [] }

describe('buildRequestBody — the Effort dial → Anthropic extended-thinking mapping', () => {
  it('unset effort on the LEGACY family (haiku-4-5): nothing added, the pre-Effort shape (effort errors there)', () => {
    const body = buildRequestBody({ ...BASE, model: 'claude-haiku-4-5' })
    expect(body['thinking']).toBeUndefined()
    expect(body['output_config']).toBeUndefined()
    expect(body['max_tokens']).toBe(4096)
  })

  it.each(['claude-haiku-5-5', 'anthropic.claude-haiku-5-5'])(
    "unset or 'low' effort on %s: no thinking param, max_tokens 5376 (T-0035: ~30% over 4096 for the heavier tokenizer), output_config.effort 'low' sent explicitly (T-0032: omitted, adaptive runs at its medium default)",
    (model) => {
      for (const effort of [undefined, 'low'] as const) {
        const body = buildRequestBody({ ...BASE, model, ...(effort ? { effort } : {}) })
        expect(body['thinking']).toBeUndefined()
        expect(body['max_tokens']).toBe(5376)
        expect(body['output_config']).toEqual({ effort: 'low' })
      }
    },
  )

  it('unset effort on sonnet-5-5: nothing extra (its default is high; only haiku-5-5 is pinned low); T-0185: an explicit low reaches the API', () => {
    const unset = buildRequestBody(BASE)
    expect(unset['thinking']).toBeUndefined()
    expect(unset['output_config']).toBeUndefined()
    expect(unset['max_tokens']).toBe(4096)
    const low = buildRequestBody({ ...BASE, effort: 'low' })
    expect(low['thinking']).toBeUndefined()
    expect(low['output_config']).toEqual({ effort: 'low' })
    expect(low['max_tokens']).toBe(4096)
  })

  it("'medium'/'high'/'xhigh' on a CURRENT-family model (sonnet-5): adaptive thinking + output_config.effort — NEVER budget_tokens (TKT-0075: the API 400s on it)", () => {
    for (const [effort, maxTokens] of [
      ['medium', 4096],
      ['high', 4096],
      ['xhigh', 6144],
    ] as const) {
      const body = buildRequestBody({ ...BASE, effort })
      expect(body['thinking']).toEqual({ type: 'adaptive', display: 'summarized' })
      expect(body['output_config']).toEqual({ effort })
      expect(body['max_tokens']).toBe(maxTokens) // T-0311: medium is floored at the unset tier (it was 3072)
    }
  })

  it('the current-family arm covers fable-5 and opus-4-8 too (adaptive is legal on all of them)', () => {
    for (const model of ['claude-fable-5', 'claude-opus-4-8']) {
      const body = buildRequestBody({ ...BASE, model, effort: 'medium' })
      expect(body['thinking']).toEqual({ type: 'adaptive', display: 'summarized' })
      expect(body['output_config']).toEqual({ effort: 'medium' })
    }
  })

  it("'medium'/'high'/'xhigh' on haiku-5-5: the CURRENT-family arm, never budget_tokens (T-0030: the Haiku 5.5 model page and migration guide, 2026-10-07: budget_tokens returns a 400, adaptive + effort is the only thinking shape)", () => {
    for (const model of ['claude-haiku-5-5', 'anthropic.claude-haiku-5-5']) {
      for (const effort of ['medium', 'high', 'xhigh'] as const) {
        const body = buildRequestBody({ ...BASE, model, effort })
        expect(body['thinking'], `${model} @ ${effort}`).toEqual({ type: 'adaptive', display: 'summarized' })
        expect(body['output_config'], `${model} @ ${effort}`).toEqual({ effort })
      }
    }
  })

  it("T-0172: every adaptive body asks for display 'summarized' (the current families default to 'omitted', which streamed empty thinking text); the legacy and low arms carry no display", () => {
    for (const model of ['claude-sonnet-5', 'claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-fable-5', 'claude-opus-5-5']) {
      const thinking = buildRequestBody({ ...BASE, model, effort: 'high' })['thinking'] as Record<string, unknown>
      expect(thinking['display'], model).toBe('summarized')
    }
    expect(buildRequestBody({ ...BASE, model: 'claude-haiku-4-5', effort: 'high' })['thinking']).toEqual({ type: 'enabled', budget_tokens: 2048 })
    expect(buildRequestBody({ ...BASE, effort: 'low' })['thinking']).toBeUndefined()
  })

  it('T-0172: a forced tool_choice is never sent on claude-sonnet-5-5 (400 there), at any effort; claude-haiku-5-5 at low effort still gets it', () => {
    const tools = [{ name: 'render_surface', description: 'x', input_schema: { type: 'object' } }]
    for (const effort of [undefined, 'low', 'medium', 'high'] as const) {
      const body = buildRequestBody({ ...BASE, model: 'claude-sonnet-5-5', effort, tools, toolChoice: { name: 'render_surface' } })
      expect(body['tool_choice'], String(effort)).toBeUndefined()
      expect(body['tools']).toEqual(tools)
    }
    expect(buildRequestBody({ ...BASE, model: 'claude-sonnet-5-5', effort: 'medium', tools })['thinking']).toEqual({ type: 'adaptive', display: 'summarized' })
    expect(buildRequestBody({ ...BASE, model: 'claude-haiku-5-5', effort: 'low', tools, toolChoice: { name: 'render_surface' } })['tool_choice']).toEqual({ type: 'tool', name: 'render_surface' })
    expect(buildRequestBody({ ...BASE, model: 'claude-haiku-5-5', effort: 'high', tools, toolChoice: { name: 'render_surface' } })['tool_choice']).toBeUndefined() // thinking on
  })

  it("T-0172: display rides only adaptive thinking: no body ever sends a disabled or between_tools thinking, and the legacy budget shape carries no display", () => {
    for (const model of ['claude-sonnet-5', 'claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-haiku-4-5', 'claude-opus-5-5', 'claude-fable-5-1']) {
      for (const effort of [undefined, 'low', 'medium', 'high', 'xhigh'] as const) {
        const thinking = buildRequestBody({ ...BASE, model, effort })['thinking'] as Record<string, unknown> | undefined
        if (thinking === undefined) continue
        expect(['adaptive', 'enabled'], `${model} @ ${effort}`).toContain(thinking['type'])
        if (thinking['type'] === 'adaptive') expect(thinking['display']).toBe('summarized')
        else expect(thinking['display']).toBeUndefined()
      }
    }
  })

  it('haiku-5-5 max_tokens tiers are ~30% above the shared 4096/4096/6144 (T-0035: the heavier tokenizer; T-0311: medium floored at the unset 5376), Bedrock id included', () => {
    for (const model of ['claude-haiku-5-5', 'anthropic.claude-haiku-5-5']) {
      for (const [effort, maxTokens] of [
        ['medium', 5376],
        ['high', 5376],
        ['xhigh', 8192],
      ] as const) {
        expect(buildRequestBody({ ...BASE, model, effort })['max_tokens'], `${model} @ ${effort}`).toBe(maxTokens)
      }
    }
  })

  // T-0311 (P3): adaptive thinking and the payload share max_tokens, so no effort tier may cap below the unset tier on a
  // current-family model (medium was 3072 against 4096, and 4096 against 5376 on Haiku 5.5; r7 rounds stopped there).
  it('T-0311: no effort tier caps max_tokens below the unset tier on any current-family model', () => {
    const current = Object.entries(MODEL_CAPABILITIES).filter(([, row]) => !row.legacyBudget).map(([id]) => id)
    expect(current.length).toBeGreaterThan(3)
    for (const model of [...current, 'anthropic.claude-haiku-5-5']) {
      const unset = buildRequestBody({ ...BASE, model })['max_tokens'] as number
      for (const effort of ['low', 'medium', 'high', 'xhigh'] as const) {
        expect(buildRequestBody({ ...BASE, model, effort })['max_tokens'] as number, `${model} @ ${effort}`).toBeGreaterThanOrEqual(unset)
      }
    }
  })

  it("'medium'/'high'/'xhigh' on the LEGACY family (haiku-4-5): the budget_tokens shape, NO output_config (effort errors on Haiku 4.5)", () => {
    for (const [effort, budget] of [
      ['medium', 1024],
      ['high', 2048],
      ['xhigh', 4096],
    ] as const) {
      const body = buildRequestBody({ ...BASE, model: 'claude-haiku-4-5-20251001', effort })
      expect(body['thinking']).toEqual({ type: 'enabled', budget_tokens: budget })
      expect(body['output_config']).toBeUndefined()
      expect(body['max_tokens'] as number).toBeGreaterThan(budget) // Anthropic requires max_tokens > thinking.budget_tokens
    }
  })

  it('carries model/system/messages through unchanged, and always sets stream:true', () => {
    const body = buildRequestBody({ model: 'claude-opus-4-8', system: 'a prompt', messages: [{ role: 'user', content: 'hi' }], effort: 'high' })
    expect(body['model']).toBe('claude-opus-4-8')
    expect(body['system']).toBe('a prompt')
    expect(body['messages']).toEqual([{ role: 'user', content: 'hi' }])
    expect(body['stream']).toBe(true)
  })
})

describe('T-0203: server tools and the mid-conversation effort beta', () => {
  const TOOL = { name: 'render_surface', description: 'r', input_schema: { type: 'object', properties: {} } }

  it('web search rides the request with max uses, allowed domains and user location; no tool means no tools key', () => {
    expect(buildRequestBody(BASE)['tools']).toBeUndefined()
    const body = buildRequestBody({
      ...BASE,
      modelSettings: { webSearch: { maxUses: 3, allowedDomains: ['example.com'], blockedDomains: ['x.com'], userLocation: { city: 'Helsinki', country: 'FI' } } },
    })
    expect(body['tools']).toEqual([
      {
        type: 'web_search_20260318',
        name: 'web_search',
        allowed_callers: ['direct'],
        max_uses: 3,
        allowed_domains: ['example.com'],
        user_location: { type: 'approximate', city: 'Helsinki', country: 'FI' },
      },
    ])
  })

  it('web fetch rides the request with blocked domains and citations on, after the client tools', () => {
    const body = buildRequestBody({ ...BASE, tools: [TOOL], modelSettings: { webFetch: { maxUses: 2, blockedDomains: ['bad.example'] } } })
    expect(body['tools']).toEqual([
      TOOL,
      { type: 'web_fetch_20260318', name: 'web_fetch', allowed_callers: ['direct'], max_uses: 2, blocked_domains: ['bad.example'], citations: { enabled: true } },
    ])
  })

  it('both tools together, in a fixed order; an unknown model drops them (no capability row)', () => {
    const settings = { webSearch: {}, webFetch: {} }
    const names = (buildRequestBody({ ...BASE, modelSettings: settings })['tools'] as { name: string }[]).map((t) => t.name)
    expect(names).toEqual(['web_search', 'web_fetch'])
    expect(buildRequestBody({ ...BASE, model: 'gpt-x', modelSettings: settings })['tools']).toBeUndefined()
  })

  it('a server tool alone never carries a forced tool_choice for a client tool that is not in the body', () => {
    const body = buildRequestBody({ ...BASE, model: 'claude-haiku-5-5', effort: 'low', toolChoice: { name: 'render_surface' }, modelSettings: { webSearch: {} } })
    expect(body['tool_choice']).toBeUndefined()
  })

  const history = (efforts: ('low' | 'medium' | 'high' | undefined)[]) =>
    efforts.flatMap((effort, i) => [
      { role: 'user' as const, content: `q${i}`, ...(effort !== undefined ? { effort } : {}) },
      { role: 'assistant' as const, content: `a${i}` },
    ])

  it('an effort change mid-conversation keeps the opening top-level effort and adds an effort-only system message, with the beta', () => {
    const messages = [...history(['high']), { role: 'user' as const, content: 'q1' }]
    const body = buildRequestBody({ ...BASE, messages, effort: 'low' })
    expect(body['output_config']).toEqual({ effort: 'high' })
    expect(body['thinking']).toEqual({ type: 'adaptive', display: 'summarized' })
    expect(body['messages']).toEqual([
      { role: 'user', content: 'q0' },
      { role: 'assistant', content: 'a0' },
      { role: 'system', content: [], output_config: { effort: 'low' } },
      { role: 'user', content: 'q1' },
    ])
    expect(anthropicBetas(body)).toEqual([MID_CONVERSATION_EFFORT_BETA])
  })

  it('a second change keeps the first marker in place, so the earlier request stays a prefix (the cache survives)', () => {
    const first = buildRequestBody({ ...BASE, messages: [...history(['high']), { role: 'user', content: 'q1' }], effort: 'low' })
    const second = buildRequestBody({ ...BASE, messages: [...history(['high', 'low']), { role: 'user', content: 'q2' }], effort: 'medium' })
    const firstMessages = first['messages'] as unknown[]
    expect((second['messages'] as unknown[]).slice(0, firstMessages.length)).toEqual(firstMessages)
    expect((second['messages'] as unknown[]).slice(firstMessages.length)).toEqual([
      { role: 'assistant', content: 'a1' },
      { role: 'system', content: [], output_config: { effort: 'medium' } },
      { role: 'user', content: 'q2' },
    ])
    expect(second['output_config']).toEqual({ effort: 'high' })
  })

  it('no beta and the plain body when nothing changed, no turn is stamped, the model has no per-message effort, or thinking is off', () => {
    const same = buildRequestBody({ ...BASE, messages: [...history(['high']), { role: 'user', content: 'q1' }], effort: 'high' })
    expect(anthropicBetas(same)).toEqual([])
    expect(same['output_config']).toEqual({ effort: 'high' })
    const unstamped = buildRequestBody({ ...BASE, messages: [...history([undefined]), { role: 'user', content: 'q1' }], effort: 'low' })
    expect(anthropicBetas(unstamped)).toEqual([])
    expect(unstamped['output_config']).toEqual({ effort: 'low' })
    const fable = buildRequestBody({ ...BASE, model: 'claude-fable-5', messages: [...history(['high']), { role: 'user', content: 'q1' }], effort: 'medium' })
    expect(anthropicBetas(fable)).toEqual([])
    const haikuOff = buildRequestBody({ ...BASE, model: 'claude-haiku-5-5', modelSettings: { thinking: 'disabled' }, messages: [...history(['high']), { role: 'user', content: 'q1' }], effort: 'medium' })
    expect(anthropicBetas(haikuOff)).toEqual([])
    expect(haikuOff['output_config']).toEqual({ effort: 'medium' })
  })
})

describe('T-0203: the anthropic-beta header on the wire (fetch stubbed, no network)', () => {
  afterEach(() => vi.unstubAllGlobals())
  async function sent(req: Parameters<ReturnType<typeof anthropicProvider>['stream']>[0]): Promise<{ headers: Headers; body: Record<string, unknown> }> {
    const fetchMock = vi.fn(async (_url: unknown, _init?: RequestInit) => {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('event: message_stop\ndata: {"type":"message_stop"}\n\n'))
          controller.close()
        },
      })
      return new Response(stream, { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)
    for await (const _ of anthropicProvider({ apiKey: 'k' }).stream(req) as AsyncIterable<string>) void _
    const init = fetchMock.mock.calls[0]?.[1]
    return { headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) as Record<string, unknown> }
  }

  it('a mid-conversation effort change sends the beta header; an unchanged effort sends none', async () => {
    const messages = [
      { role: 'user' as const, content: 'q0', effort: 'high' as const },
      { role: 'assistant' as const, content: 'a0' },
      { role: 'user' as const, content: 'q1' },
    ]
    const changed = await sent({ model: 'claude-opus-5-5', system: 's', messages, effort: 'low' })
    expect(changed.headers.get('anthropic-beta')).toBe(MID_CONVERSATION_EFFORT_BETA)
    expect(changed.body['output_config']).toEqual({ effort: 'high' })
    const same = await sent({ model: 'claude-opus-5-5', system: 's', messages, effort: 'high' })
    expect(same.headers.has('anthropic-beta')).toBe(false)
  })

  it('web search reaches the wire body on the text path (no client tools)', async () => {
    const { body } = await sent({ model: 'claude-sonnet-5-5', system: 's', messages: [{ role: 'user', content: 'news?' }], modelSettings: { webSearch: { maxUses: 1 } } })
    expect(body['tools']).toEqual([{ type: 'web_search_20260318', name: 'web_search', allowed_callers: ['direct'], max_uses: 1 }])
  })
})
