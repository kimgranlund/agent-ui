// chat-route.test.ts — ALM-C6 (TKT-0052/ADR-0136): the `/chat` proxy branch's PURE validation spine
// (`resolveChatDispatch`, tools/agent/dev-proxy-plugin.ts), the deterministic 400/503 arms. The impure
// `provider.stream` fetch path stays MANUAL live acceptance (the SPEC-R3 adapter precedent) — a real key,
// `npm run dev`, one live turn. This test lives in the vitest+tsc include (`src/live-agent/`, the
// providers-config.test.ts / validate-mode.test.ts precedent) and imports the Node-scoped `tools/agent/`
// module by relative path, transitively typechecking it. Reads the real providers.json via readFileSync.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolveChatDispatch, isChatBody } from '../../tools/agent/dev-proxy-plugin.ts'
import type { ProvidersConfig } from '../../tools/agent/providers-config.ts'

declare const process: { cwd(): string }

const CONFIG_PATH = `${process.cwd()}/packages/agent-ui/a2ui/tools/agent/providers.json`
const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8') as string) as ProvidersConfig

describe('resolveChatDispatch (ALM-C6 — the /chat route validation spine)', () => {
  it('derives the provider server-side + resolves to the env key when the pair is valid AND a key is set', () => {
    const out = resolveChatDispatch(config, { ANTHROPIC_API_KEY: 'sk-test-value' }, 'claude-sonnet-5')
    expect(out).toEqual({
      ok: true,
      provider: 'anthropic',
      apiKey: 'sk-test-value',
      endpoint: config.providers.anthropic!.endpoint,
    })
  })

  it('400 unknown-model: a model no IMPLEMENTED provider owns (incl. an implemented:false provider\'s model)', () => {
    expect(resolveChatDispatch(config, { ANTHROPIC_API_KEY: 'sk-x' }, 'not-a-real-model')).toEqual({
      ok: false,
      status: 400,
      error: 'unknown-model',
    })
    // gpt-4.1 ∈ openai (implemented:false) — must NOT resolve to a live call, a 400 not a 503
    expect(resolveChatDispatch(config, { ANTHROPIC_API_KEY: 'sk-x' }, 'gpt-4.1')).toEqual({
      ok: false,
      status: 400,
      error: 'unknown-model',
    })
  })

  it('503 no-key: a valid pair but no key configured for its provider (empty or absent env value)', () => {
    expect(resolveChatDispatch(config, {}, 'claude-sonnet-5')).toEqual({ ok: false, status: 503, error: 'no-key' })
    expect(resolveChatDispatch(config, { ANTHROPIC_API_KEY: '' }, 'claude-sonnet-5')).toEqual({
      ok: false,
      status: 503,
      error: 'no-key',
    })
  })

  it('never returns a key value on a degrade path (only the ok arm carries apiKey)', () => {
    const degrade = resolveChatDispatch(config, { ANTHROPIC_API_KEY: 'sk-secret' }, 'gpt-4.1')
    expect(JSON.stringify(degrade)).not.toContain('sk-secret')
  })
})

describe('isChatBody (TKT-0052 review MEDIUM-1 — the /chat route request-shape guard)', () => {
  it('accepts a well-shaped body', () => {
    expect(isChatBody({ system: 'be helpful', model: 'claude-sonnet-5', messages: [] })).toBe(true)
  })

  it('rejects a missing messages array', () => {
    expect(isChatBody({ system: 'be helpful', model: 'claude-sonnet-5' })).toBe(false)
  })

  it('rejects a non-string system or model', () => {
    expect(isChatBody({ system: 42, model: 'claude-sonnet-5', messages: [] })).toBe(false)
    expect(isChatBody({ system: 'be helpful', model: null, messages: [] })).toBe(false)
  })

  it('rejects a messages value that is not an array', () => {
    expect(isChatBody({ system: 'be helpful', model: 'claude-sonnet-5', messages: 'not-an-array' })).toBe(false)
  })

  it('effort is OPTIONAL (the Figma chat-input refactor\'s Effort picker) — absent is a valid body', () => {
    expect(isChatBody({ system: 'be helpful', model: 'claude-sonnet-5', messages: [] })).toBe(true)
  })

  it('accepts each of the four closed effort values', () => {
    for (const effort of ['low', 'medium', 'high', 'xhigh']) {
      expect(isChatBody({ system: 'be helpful', model: 'claude-sonnet-5', messages: [], effort })).toBe(true)
    }
  })

  it('rejects an effort value outside the closed four — never forwarded as an arbitrary string', () => {
    expect(isChatBody({ system: 'be helpful', model: 'claude-sonnet-5', messages: [], effort: 'ultra' })).toBe(false)
    expect(isChatBody({ system: 'be helpful', model: 'claude-sonnet-5', messages: [], effort: 3 })).toBe(false)
  })
})
