// model-settings.test.ts: T-0185. The settings pane's Model section is generated from the model's capability
// row, a stored temperature is ignored, and the turn-time read sends only what the model accepts.

import { describe, it, expect } from 'vitest'
import { agentConfigSchema, agentServerToolOn, modelSettingsSection, resolveAgentEffort, resolveModelSettings, runStubAgentTurn, MODEL_SETTING_KEYS } from './agent-admin-schema.ts'

const store = (values: Record<string, unknown>) => ({ get: (key: string) => values[key] })
const fieldKeys = (model: string) => modelSettingsSection(model)?.fields.map((f) => f.key) ?? []
const optionsOf = (model: string, key: string) => modelSettingsSection(model)?.fields.find((f) => f.key === key)?.options?.map((o) => o.value)

describe('the Model section is generated from the capability table', () => {
  it('no temperature field anywhere in the schema', () => {
    for (const model of ['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5', 'claude-haiku-4-5-20251001']) {
      const keys = agentConfigSchema(model).sections.flatMap((s) => s.fields.map((f) => f.key))
      expect(keys, model).not.toContain('temperature')
    }
  })

  it('Thinking offers Off only on Haiku 5.5, Between tools only on Sonnet 5.5, and is absent on Opus 5.5 (adaptive only)', () => {
    expect(optionsOf('claude-haiku-5-5', MODEL_SETTING_KEYS.thinking)).toEqual(['adaptive', 'disabled'])
    expect(optionsOf('claude-sonnet-5-5', MODEL_SETTING_KEYS.thinking)).toEqual(['adaptive', 'between_tools'])
    expect(fieldKeys('claude-opus-5-5')).not.toContain(MODEL_SETTING_KEYS.thinking)
  })

  it('effort, show reasoning, max tokens and cache TTL on every 5.5 model; effort defaults to the row default', () => {
    for (const model of ['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5']) {
      expect(fieldKeys(model), model).toEqual(expect.arrayContaining(['effort', 'showReasoning', 'maxTokens', 'cacheTtl']))
    }
    const effortDefault = (model: string) => modelSettingsSection(model)?.fields.find((f) => f.key === 'effort')?.default
    expect(effortDefault('claude-haiku-5-5')).toBe('medium')
    expect(effortDefault('claude-sonnet-5-5')).toBe('high')
    expect(effortDefault('claude-opus-5-5')).toBe('medium')
  })

  it('Haiku 4.5 has no effort dial and no display; a non-Anthropic roster model gets no section', () => {
    expect(fieldKeys('claude-haiku-4-5-20251001').filter((k) => !k.startsWith('web'))).toEqual(['maxTokens', 'cacheTtl']) // T-0203: the web rows follow `serverTools`
    expect(modelSettingsSection('gpt-4.1')).toBeUndefined()
  })
})

describe('the turn-time read (migration: a stored temperature is ignored)', () => {
  it('a legacy store carrying temperature yields no temperature anywhere: settings, stub reply', () => {
    const legacy = store({ name: 'Old', temperature: 0.9, effort: 'low' })
    const settings = resolveModelSettings(legacy, 'claude-sonnet-5-5', 'low')
    expect(settings).toEqual({})
    expect(JSON.stringify(settings)).not.toContain('temperature')
    const reply = runStubAgentTurn('hi', { name: 'Old', model: 'claude-sonnet-5-5', toolsEnabled: false, systemPrompt: '', skills: [], workflows: [], resources: [], tools: [] })
    expect(reply).not.toMatch(/temp/)
  })

  it('maps show reasoning to display, drops 0 max tokens and cache off, and drops a combination the model rejects', () => {
    expect(resolveModelSettings(store({ showReasoning: false, maxTokens: 0, cacheTtl: 'off' }), 'claude-opus-5-5', 'high')).toEqual({ display: 'omitted' })
    expect(resolveModelSettings(store({ thinking: 'disabled', maxTokens: 8000, cacheTtl: '1h' }), 'claude-haiku-5-5', 'high')).toEqual({ thinking: 'disabled', maxTokens: 8000, cacheTtl: '1h' })
    expect(resolveModelSettings(store({ thinking: 'disabled' }), 'claude-haiku-5-5', 'xhigh')).toEqual({})
    expect(resolveModelSettings(store({ thinking: 'disabled' }), 'claude-opus-5-5', 'low')).toEqual({})
  })

  it('the agent default effort: a stored level the model lists, else the row default; none for Haiku 4.5', () => {
    expect(resolveAgentEffort(store({ effort: 'xhigh' }), 'claude-sonnet-5-5')).toBe('xhigh')
    expect(resolveAgentEffort(store({ effort: 'bogus' }), 'claude-opus-5-5')).toBe('medium')
    expect(resolveAgentEffort(store({}), 'claude-haiku-4-5-20251001')).toBeUndefined()
  })
})

describe('T-0203: server tools in the agent settings and the composer overrides', () => {
  const read = (values: Record<string, unknown>) => ({ get: (key: string) => values[key] })

  it('the Model section offers the web search and web fetch rows for a model whose row lists them, none for an unknown model', () => {
    const keys = (modelSettingsSection('claude-opus-5-5')?.fields ?? []).map((f) => f.key)
    expect(keys).toEqual(expect.arrayContaining(['webSearch', 'webSearchMaxUses', 'webSearchAllowedDomains', 'webSearchBlockedDomains', 'webSearchCity', 'webSearchRegion', 'webSearchCountry', 'webSearchTimezone', 'webFetch', 'webFetchMaxUses', 'webFetchAllowedDomains', 'webFetchBlockedDomains']))
    const search = modelSettingsSection('claude-opus-5-5')?.fields.find((f) => f.key === 'webSearch')
    expect(search?.description).toContain('Billed per search')
    expect(modelSettingsSection('gpt-x')).toBeUndefined()
  })

  it('a switched-on tool resolves with its options; off, it is absent; the composer toggle can only narrow', () => {
    const values = {
      webSearch: true,
      webSearchMaxUses: 3,
      webSearchAllowedDomains: 'a.com, b.org',
      webSearchBlockedDomains: 'c.com',
      webSearchCity: 'Helsinki',
      webSearchCountry: 'FI',
      webFetch: false,
      webFetchMaxUses: 2,
    }
    const settings = resolveModelSettings(read(values), 'claude-opus-5-5', 'medium')
    expect(settings.webSearch).toEqual({ maxUses: 3, allowedDomains: ['a.com', 'b.org'], userLocation: { city: 'Helsinki', country: 'FI' } })
    expect(settings.webFetch).toBeUndefined()
    expect(resolveModelSettings(read(values), 'claude-opus-5-5', 'medium', { webSearch: false }).webSearch).toBeUndefined()
    expect(resolveModelSettings(read(values), 'claude-opus-5-5', 'medium', { webFetch: true }).webFetch).toBeUndefined()
    expect(agentServerToolOn(read(values), 'claude-opus-5-5', 'web_search')).toBe(true)
    expect(agentServerToolOn(read(values), 'claude-opus-5-5', 'web_fetch')).toBe(false)
    expect(agentServerToolOn(read(values), 'gpt-x', 'web_search')).toBe(false)
  })

  it('thinking off and show reasoning from the composer replace the agent settings, still capability-checked', () => {
    const agent = read({ showReasoning: true })
    expect(resolveModelSettings(agent, 'claude-haiku-5-5', 'high', { thinkingOff: true, showReasoning: false })).toEqual({ thinking: 'disabled', display: 'omitted' })
    expect(resolveModelSettings(agent, 'claude-haiku-5-5', 'xhigh', { thinkingOff: true })).toEqual({ display: 'summarized' })
    expect(resolveModelSettings(read({ thinking: 'disabled' }), 'claude-haiku-5-5', 'high', { thinkingOff: false })).toEqual({})
  })
})

describe('T-0203: the web search location is validated, never sent invalid', () => {
  const read = (values: Record<string, unknown>) => ({ get: (key: string) => values[key] })
  it('a bad country or timezone is dropped from the request; the pane field carries a pattern', () => {
    const settings = resolveModelSettings(read({ webSearch: true, webSearchCity: 'Oslo', webSearchCountry: 'Norway', webSearchTimezone: 'Mars/Base' }), 'claude-opus-5-5', 'medium')
    expect(settings.webSearch).toEqual({ userLocation: { city: 'Oslo' } })
    const good = resolveModelSettings(read({ webSearch: true, webSearchCountry: 'no', webSearchTimezone: 'Europe/Oslo' }), 'claude-opus-5-5', 'medium')
    expect(good.webSearch).toEqual({ userLocation: { country: 'NO', timezone: 'Europe/Oslo' } })
    const country = modelSettingsSection('claude-opus-5-5')?.fields.find((f) => f.key === 'webSearchCountry')
    expect(country?.validation?.pattern).toBe('^([A-Za-z]{2})?$')
  })
})
