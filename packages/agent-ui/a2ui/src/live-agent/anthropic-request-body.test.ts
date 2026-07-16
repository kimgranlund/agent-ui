// anthropic-request-body.test.ts — the Anthropic adapter's PURE request-body builder (`buildRequestBody`,
// tools/agent/providers/anthropic.ts), extracted for deterministic testing without a live key or network —
// the `anthropic-sse.test.ts`/`parseAnthropicSSE` precedent, applied to the Effort dial (the Figma
// chat-input refactor). The impure `stream()`/fetch arm stays MANUAL live acceptance only (SPEC-R3).

import { describe, it, expect } from 'vitest'
import { buildRequestBody } from '../../tools/agent/providers/anthropic.ts'

const BASE = { model: 'claude-sonnet-5', system: 'be helpful', messages: [] }

describe('buildRequestBody — the Effort dial → Anthropic extended-thinking mapping', () => {
  it('unset effort: no thinking param, the pre-Effort max_tokens (4096) — byte-identical to the original request shape', () => {
    const body = buildRequestBody(BASE)
    expect(body['thinking']).toBeUndefined()
    expect(body['max_tokens']).toBe(4096)
  })

  it("'low' effort: ALSO no thinking param — 'low' means the same as unset, never a behavior change", () => {
    const body = buildRequestBody({ ...BASE, effort: 'low' })
    expect(body['thinking']).toBeUndefined()
    expect(body['max_tokens']).toBe(4096)
  })

  it("'medium'/'high'/'xhigh' each enable thinking with a real, increasing budget, and max_tokens strictly exceeds it", () => {
    for (const [effort, budget] of [
      ['medium', 1024],
      ['high', 2048],
      ['xhigh', 4096],
    ] as const) {
      const body = buildRequestBody({ ...BASE, effort })
      expect(body['thinking']).toEqual({ type: 'enabled', budget_tokens: budget })
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
