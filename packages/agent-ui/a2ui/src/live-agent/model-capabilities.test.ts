// model-capabilities.test.ts: T-0185. The capability table covers every implemented providers.json model,
// and per model the request body carries only the params that model's row accepts.

import { describe, it, expect } from 'vitest'
import providersConfigRaw from '../../tools/agent/providers.json'
import { buildRequestBody } from '../agent/providers/anthropic.ts'
import { MODEL_CAPABILITIES, capabilitiesFor, effortsAllowing, normalizeModelSettings, validateModelSettings } from '../agent/model-capabilities.ts'
import type { Effort } from '../agent/agent-transport.ts'

const BASE = { system: 'be helpful', messages: [] }
const SAMPLING = ['temperature', 'top_p', 'top_k']
/** Every top-level key a body may carry; anything else is an unaccepted param. */
const ACCEPTED_KEYS = new Set(['model', 'system', 'messages', 'stream', 'tools', 'tool_choice', 'max_tokens', 'thinking', 'output_config'])

describe('MODEL_CAPABILITIES: the per-model table', () => {
  it('has a row for every model of the implemented providers in providers.json', () => {
    for (const entry of Object.values(providersConfigRaw.providers)) {
      if (!entry.implemented) continue
      for (const model of entry.models) expect(capabilitiesFor(model.id), model.id).toBeDefined()
    }
  })

  it('the 5.5 rows: no sampling params, 128K output, both displays, the doc defaults', () => {
    expect(MODEL_CAPABILITIES['claude-haiku-5-5']!.defaultEffort).toBe('medium')
    expect(MODEL_CAPABILITIES['claude-opus-5-5']!.defaultEffort).toBe('medium')
    expect(MODEL_CAPABILITIES['claude-sonnet-5-5']!.defaultEffort).toBe('high')
    for (const id of ['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5']) {
      const row = MODEL_CAPABILITIES[id]!
      expect(row.sampling, id).toEqual([])
      expect(row.maxOutputTokens, id).toBe(128_000)
      expect(row.displays, id).toEqual(['summarized', 'omitted'])
    }
  })

  it('thinking off: Haiku 5.5 at high or below only; Opus 5.5 never; between_tools on Sonnet 5.5 at high or below', () => {
    expect(effortsAllowing('claude-haiku-5-5', 'disabled')).toEqual(['low', 'medium', 'high'])
    expect(effortsAllowing('claude-opus-5-5', 'disabled')).toEqual([])
    expect(effortsAllowing('claude-sonnet-5-5', 'disabled')).toEqual([])
    expect(effortsAllowing('claude-sonnet-5-5', 'between_tools')).toEqual(['low', 'medium', 'high'])
  })

  it('validateModelSettings names each rejected combination; normalize drops exactly those fields', () => {
    expect(validateModelSettings('claude-haiku-5-5', { thinking: 'disabled' }, 'xhigh').map((i) => i.key)).toEqual(['thinking'])
    expect(validateModelSettings('claude-haiku-5-5', { thinking: 'disabled' }, 'high')).toEqual([])
    expect(validateModelSettings('claude-opus-5-5', { thinking: 'disabled' }, 'low').map((i) => i.key)).toEqual(['thinking'])
    expect(validateModelSettings('claude-sonnet-5-5', { maxTokens: 200_000 }).map((i) => i.key)).toEqual(['maxTokens'])
    expect(normalizeModelSettings('claude-haiku-5-5', { thinking: 'disabled', display: 'omitted', maxTokens: 9000, cacheTtl: '1h', temperature: 0.4 }, 'xhigh'))
      .toEqual({ display: 'omitted', maxTokens: 9000, cacheTtl: '1h' })
  })
})

describe('buildRequestBody per model: only accepted params are sent (T-0185)', () => {
  const MODELS = ['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5'] as const
  const EFFORTS: readonly (Effort | undefined)[] = [undefined, 'low', 'medium', 'high', 'xhigh']
  const SETTINGS = [{}, { thinking: 'disabled' }, { thinking: 'between_tools' }, { display: 'omitted' }, { maxTokens: 20_000, cacheTtl: '1h' }, { temperature: 0.4, top_p: 0.9 }] as const

  it.each(MODELS)('%s: every effort and settings combination validates against its row', (model) => {
    const row = capabilitiesFor(model)!
    for (const effort of EFFORTS) {
      for (const modelSettings of SETTINGS) {
        const body = buildRequestBody({ ...BASE, model, ...(effort ? { effort } : {}), modelSettings: modelSettings as never, tools: [{ name: 't', description: 'd', input_schema: { type: 'object' } }], toolChoice: { name: 't' } })
        const label = `${model} ${effort} ${JSON.stringify(modelSettings)}`
        for (const key of Object.keys(body)) expect(ACCEPTED_KEYS.has(key), `${label}: ${key}`).toBe(true)
        for (const key of SAMPLING) expect(body[key], `${label}: ${key}`).toBeUndefined()
        const thinking = body['thinking'] as { type: 'adaptive' | 'disabled' | 'between_tools'; display?: string } | undefined
        const sentEffort = (body['output_config'] as { effort?: Effort } | undefined)?.effort
        if (sentEffort !== undefined) expect(row.efforts, label).toContain(sentEffort)
        if (thinking !== undefined) {
          expect(row.thinking[thinking.type], label).toBeDefined()
          expect(row.thinking[thinking.type], label).toContain(sentEffort ?? row.defaultEffort)
          if (thinking.display !== undefined) expect(row.displays, label).toContain(thinking.display)
        }
        expect(body['max_tokens'] as number, label).toBeLessThanOrEqual(row.maxOutputTokens)
        if (body['tool_choice'] !== undefined) {
          expect(row.forcedToolChoice, label).toBe(true)
          expect(thinking === undefined || thinking.type === 'disabled', label).toBe(true)
        }
      }
    }
  })

  it('the negative case: thinking disabled at xhigh on Haiku 5.5 is dropped before the call (adaptive sent instead)', () => {
    const body = buildRequestBody({ ...BASE, model: 'claude-haiku-5-5', effort: 'xhigh', modelSettings: { thinking: 'disabled' } })
    expect(body['thinking']).toEqual({ type: 'adaptive', display: 'summarized' })
    expect(body['output_config']).toEqual({ effort: 'xhigh' })
  })

  it('thinking off at high on Haiku 5.5 reaches the API, and a forced tool_choice still rides with it', () => {
    const body = buildRequestBody({ ...BASE, model: 'claude-haiku-5-5', effort: 'high', modelSettings: { thinking: 'disabled' }, tools: [{ name: 't', description: 'd', input_schema: { type: 'object' } }], toolChoice: { name: 't' } })
    expect(body['thinking']).toEqual({ type: 'disabled' })
    expect(body['output_config']).toEqual({ effort: 'high' })
    expect(body['tool_choice']).toEqual({ type: 'tool', name: 't' })
  })

  it('between_tools on Sonnet 5.5 at medium is sent; on Opus 5.5 it is dropped', () => {
    expect(buildRequestBody({ ...BASE, model: 'claude-sonnet-5-5', effort: 'medium', modelSettings: { thinking: 'between_tools' } })['thinking']).toEqual({ type: 'between_tools' })
    expect(buildRequestBody({ ...BASE, model: 'claude-opus-5-5', effort: 'medium', modelSettings: { thinking: 'between_tools' } })['thinking']).toEqual({ type: 'adaptive', display: 'summarized' })
  })

  it('the default show-reasoning display never costs Haiku 5.5 its forced tool_choice at low effort (RTS-R2)', () => {
    const tools = [{ name: 't', description: 'd', input_schema: { type: 'object' } }]
    const body = buildRequestBody({ ...BASE, model: 'claude-haiku-5-5', effort: 'low', modelSettings: { display: 'summarized' }, tools, toolChoice: { name: 't' } })
    expect(body['tool_choice']).toEqual({ type: 'tool', name: 't' })
    expect(body['thinking']).toBeUndefined()
    expect(buildRequestBody({ ...BASE, model: 'claude-haiku-5-5', modelSettings: { display: 'summarized' }, tools, toolChoice: { name: 't' } })['tool_choice']).toEqual({ type: 'tool', name: 't' })
  })

  it('show reasoning off sends display omitted; at low it still sends the thinking field so the choice reaches the API', () => {
    expect(buildRequestBody({ ...BASE, model: 'claude-opus-5-5', effort: 'high', modelSettings: { display: 'omitted' } })['thinking']).toEqual({ type: 'adaptive', display: 'omitted' })
    expect(buildRequestBody({ ...BASE, model: 'claude-sonnet-5-5', effort: 'low', modelSettings: { display: 'summarized' } })['thinking']).toEqual({ type: 'adaptive', display: 'summarized' })
  })

  it('max tokens and cache TTL reach the body: max_tokens set, system becomes one cached text block', () => {
    const body = buildRequestBody({ ...BASE, model: 'claude-sonnet-5-5', effort: 'high', modelSettings: { maxTokens: 20_000, cacheTtl: '1h' } })
    expect(body['max_tokens']).toBe(20_000)
    expect(body['system']).toEqual([{ type: 'text', text: 'be helpful', cache_control: { type: 'ephemeral', ttl: '1h' } }])
  })
})

describe('T-0203: server tool settings against the capability table', () => {
  it('normalize keeps a well-formed tool, types each field, and prefers allowed over blocked domains', () => {
    const out = normalizeModelSettings('claude-opus-5-5', {
      webSearch: { maxUses: 2.5, allowedDomains: [' a.com ', '', 3], blockedDomains: ['b.com'], userLocation: { city: 'Oslo', country: 7 } },
      webFetch: { maxUses: 4, blockedDomains: ['c.com'] },
    })
    expect(out.webSearch).toEqual({ allowedDomains: ['a.com'], userLocation: { city: 'Oslo' } })
    expect(out.webFetch).toEqual({ maxUses: 4, blockedDomains: ['c.com'] })
  })

  it('a non-object value drops the tool, and a model whose row lacks the tool is an issue', () => {
    expect(normalizeModelSettings('claude-opus-5-5', { webSearch: true, webFetch: ['x'] })).toEqual({})
    const row = MODEL_CAPABILITIES['claude-opus-5-5']!
    const saved = row.serverTools
    ;(row as { serverTools: readonly string[] }).serverTools = []
    try {
      expect(validateModelSettings('claude-opus-5-5', { webSearch: {} }).map((i) => i.key)).toEqual(['webSearch'])
      expect(normalizeModelSettings('claude-opus-5-5', { webSearch: {} })).toEqual({})
    } finally {
      ;(row as { serverTools: readonly string[] }).serverTools = saved
    }
  })
})
