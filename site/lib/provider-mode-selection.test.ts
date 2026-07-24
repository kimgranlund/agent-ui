import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  PROVIDER_OPTIONS,
  DEFAULT_PROVIDER,
  DEFAULT_MODEL,
  MODE_OPTIONS,
  DEFAULT_MODE,
  loadPersistedSelection,
  persistSelection,
} from './provider-mode-selection.ts'

// provider-mode-selection.test.ts — GH #257: the shared option-list + persistence module that replaced
// `provider-switcher.ts`'s DOM-mounting job (that file's own jsdom coverage, provider-switcher.test.ts, is
// retired alongside it). Pure data + localStorage only — no DOM, no ui-select.

const LS_KEY = 'a2ui-live-provider-selection'

describe('provider-mode-selection — option lists (from the committed providers.json)', () => {
  it('derives ProviderOption[] from providers.json, marking unimplemented ("coming soon") providers disabled', () => {
    expect(PROVIDER_OPTIONS).toHaveLength(3) // anthropic, openai, gemini
    const anthropic = PROVIDER_OPTIONS.find((p) => p.id === 'anthropic')!
    expect(anthropic.disabled).toBe(false) // implemented ⇒ never disabled
    expect(anthropic.label).toBe('Anthropic')
    expect(anthropic.models).toHaveLength(4)
    expect(anthropic.defaultModel).toBe('claude-sonnet-5')
    const openai = PROVIDER_OPTIONS.find((p) => p.id === 'openai')!
    expect(openai.disabled).toBe(true)
    expect(openai.label).toBe('OpenAI — coming soon')
  })

  it('DEFAULT_PROVIDER/DEFAULT_MODEL match the committed catalog', () => {
    expect(DEFAULT_PROVIDER).toBe('anthropic')
    expect(DEFAULT_MODEL).toBe('claude-sonnet-5')
  })

  it('MODE_OPTIONS carries the 3 GenUiMode values with friendlier demo labels; DEFAULT_MODE is "default"', () => {
    expect(MODE_OPTIONS.map((m) => m.id)).toEqual(['default', 'specific', 'blue-sky'])
    expect(DEFAULT_MODE).toBe('default')
  })
})

describe('provider-mode-selection — persistence (localStorage, the provider-switcher.ts precedent)', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => localStorage.clear())

  it('with no stored selection, restores the catalog defaults', () => {
    expect(loadPersistedSelection()).toEqual({ provider: 'anthropic', model: 'claude-sonnet-5', mode: 'default' })
  })

  it('persists then restores a valid selection round-trip', () => {
    persistSelection({ provider: 'anthropic', model: 'claude-opus-4-8', mode: 'blue-sky' })
    expect(JSON.parse(localStorage.getItem(LS_KEY)!)).toEqual({ provider: 'anthropic', model: 'claude-opus-4-8', mode: 'blue-sky' })
    expect(loadPersistedSelection()).toEqual({ provider: 'anthropic', model: 'claude-opus-4-8', mode: 'blue-sky' })
  })

  it('rejects an unimplemented persisted provider, falling back to the default', () => {
    persistSelection({ provider: 'openai', model: 'gpt-4.1', mode: 'default' })
    expect(loadPersistedSelection().provider).toBe('anthropic')
  })

  it('rejects a persisted model that does not belong to its provider, falling back to that provider\'s defaultModel', () => {
    localStorage.setItem(LS_KEY, JSON.stringify({ provider: 'anthropic', model: 'not-a-real-model', mode: 'default' }))
    expect(loadPersistedSelection().model).toBe('claude-sonnet-5')
  })

  it('rejects an unrecognized persisted mode, falling back to "default"', () => {
    localStorage.setItem(LS_KEY, JSON.stringify({ provider: 'anthropic', model: 'claude-sonnet-5', mode: 'not-a-real-mode' }))
    expect(loadPersistedSelection().mode).toBe('default')
  })

  it('corrupt JSON never throws — falls back to the catalog defaults', () => {
    localStorage.setItem(LS_KEY, '{not json')
    expect(() => loadPersistedSelection()).not.toThrow()
    expect(loadPersistedSelection()).toEqual({ provider: 'anthropic', model: 'claude-sonnet-5', mode: 'default' })
  })
})
