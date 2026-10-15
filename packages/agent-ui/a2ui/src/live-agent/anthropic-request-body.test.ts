// anthropic-request-body.test.ts — the Anthropic adapter's PURE request-body builder (`buildRequestBody`,
// tools/agent/providers/anthropic.ts), extracted for deterministic testing without a live key or network —
// the `anthropic-sse.test.ts`/`parseAnthropicSSE` precedent, applied to the Effort dial (the Figma
// chat-input refactor). The impure `stream()`/fetch arm stays MANUAL live acceptance only (SPEC-R3).

import { describe, it, expect } from 'vitest'
import { buildRequestBody } from '../agent/providers/anthropic.ts'

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
      ['medium', 3072],
      ['high', 4096],
      ['xhigh', 6144],
    ] as const) {
      const body = buildRequestBody({ ...BASE, effort })
      expect(body['thinking']).toEqual({ type: 'adaptive', display: 'summarized' })
      expect(body['output_config']).toEqual({ effort })
      expect(body['max_tokens']).toBe(maxTokens) // same tiered cap as the legacy arm — reply room unchanged by the migration
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

  it('haiku-5-5 max_tokens tiers are ~30% above the shared 3072/4096/6144 (T-0035: the heavier tokenizer), Bedrock id included', () => {
    for (const model of ['claude-haiku-5-5', 'anthropic.claude-haiku-5-5']) {
      for (const [effort, maxTokens] of [
        ['medium', 4096],
        ['high', 5376],
        ['xhigh', 8192],
      ] as const) {
        expect(buildRequestBody({ ...BASE, model, effort })['max_tokens'], `${model} @ ${effort}`).toBe(maxTokens)
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
