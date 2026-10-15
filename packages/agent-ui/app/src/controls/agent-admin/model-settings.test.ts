// model-settings.test.ts: T-0185. The settings pane's Model section is generated from the model's capability
// row, a stored temperature is ignored, and the turn-time read sends only what the model accepts.

import { describe, it, expect } from 'vitest'
import { agentConfigSchema, modelSettingsSection, resolveAgentEffort, resolveModelSettings, runStubAgentTurn, MODEL_SETTING_KEYS } from './agent-admin-schema.ts'

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
    expect(fieldKeys('claude-haiku-4-5-20251001')).toEqual(['maxTokens', 'cacheTtl'])
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
