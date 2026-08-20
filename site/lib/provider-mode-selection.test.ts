import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  PROVIDER_OPTIONS,
  DEFAULT_PROVIDER,
  DEFAULT_MODEL,
  MODE_OPTIONS,
  DEFAULT_MODE,
  loadPersistedSelection,
  persistSelection,
  groupedModelOptions,
  providerIdForModel,
} from './provider-mode-selection.ts'
import type { ProviderOption } from '../../packages/agent-ui/app/src/controls/conversation/composer-options.ts'

// provider-mode-selection.test.ts — GH #257: the shared option-list + persistence module that replaced
// `provider-switcher.ts`'s DOM-mounting job (that file's own jsdom coverage, provider-switcher.test.ts, is
// retired alongside it). Pure data + localStorage only — no DOM, no ui-select.

// The StorageAdapter-tier key (GH #1544): `a2ui-live` namespace + `provider-selection` — the value
// encoding is unchanged (JSON.stringify of the selection object), only the key gained its dot.
const LS_KEY = 'a2ui-live.provider-selection'

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
    expect(loadPersistedSelection()).toEqual({ provider: 'anthropic', model: 'claude-sonnet-5', mode: 'default', effort: 'medium' })
  })

  it('persists then restores a valid selection round-trip', () => {
    persistSelection({ provider: 'anthropic', model: 'claude-opus-4-8', mode: 'blue-sky', effort: 'high' })
    expect(JSON.parse(localStorage.getItem(LS_KEY)!)).toEqual({ provider: 'anthropic', model: 'claude-opus-4-8', mode: 'blue-sky', effort: 'high' })
    expect(loadPersistedSelection()).toEqual({ provider: 'anthropic', model: 'claude-opus-4-8', mode: 'blue-sky', effort: 'high' })
  })

  it('rejects an unimplemented persisted provider, falling back to the default', () => {
    persistSelection({ provider: 'openai', model: 'gpt-4.1', mode: 'default', effort: 'medium' })
    expect(loadPersistedSelection().provider).toBe('anthropic')
  })

  it('rejects a persisted model that does not belong to its provider, falling back to that provider\'s defaultModel', () => {
    localStorage.setItem(LS_KEY, JSON.stringify({ provider: 'anthropic', model: 'not-a-real-model', mode: 'default', effort: 'medium' }))
    expect(loadPersistedSelection().model).toBe('claude-sonnet-5')
  })

  it('rejects an unrecognized persisted mode, falling back to "default"', () => {
    localStorage.setItem(LS_KEY, JSON.stringify({ provider: 'anthropic', model: 'claude-sonnet-5', mode: 'not-a-real-mode', effort: 'medium' }))
    expect(loadPersistedSelection().mode).toBe('default')
  })

  it('rejects an unrecognized persisted effort, falling back to "medium"', () => {
    localStorage.setItem(LS_KEY, JSON.stringify({ provider: 'anthropic', model: 'claude-sonnet-5', mode: 'default', effort: 'not-a-real-effort' }))
    expect(loadPersistedSelection().effort).toBe('medium')
  })

  it('corrupt JSON never throws — falls back to the catalog defaults', () => {
    localStorage.setItem(LS_KEY, '{not json')
    expect(() => loadPersistedSelection()).not.toThrow()
    expect(loadPersistedSelection()).toEqual({ provider: 'anthropic', model: 'claude-sonnet-5', mode: 'default', effort: 'medium' })
  })
})

// gen-ui-live.ts's Model-roster upgrade (Kim's agent-admin Surface-Options-screenshot ask): a flat,
// provider-grouped reshape of PROVIDER_OPTIONS — replacing the two-step Provider→Model flow with ONE
// picker's option list. `groupedModelOptions`/`providerIdForModel` are the pure derivation + its companion
// lookup; gen-ui-live.live-picker-wiring.test.ts proves the real page wires them into the composer end to
// end — this suite proves the DATA SHAPE itself, independent of any DOM.
describe('provider-mode-selection — groupedModelOptions/providerIdForModel (the flat provider-grouped Model roster)', () => {
  it('interleaves a disabled, non-committable header row (id `__group-<providerId>`) before each provider\'s own model rows, from the REAL committed providers.json', () => {
    const options = groupedModelOptions()
    // anthropic (1 header + 4 models) + openai (1 + 2) + gemini (1 + 2) = 11
    expect(options).toHaveLength(11)
    const anthropicHeaderIndex = options.findIndex((o) => o.id === '__group-anthropic')
    expect(anthropicHeaderIndex).toBe(0) // providers.json's own declaration order
    expect(options[anthropicHeaderIndex]).toEqual({ id: '__group-anthropic', label: 'Anthropic', disabled: true })
    // the 4 Anthropic models immediately follow their header, none disabled (anthropic IS implemented)
    const anthropicModelIds = options.slice(anthropicHeaderIndex + 1, anthropicHeaderIndex + 5).map((o) => o.id)
    expect(anthropicModelIds).toEqual(['claude-opus-4-8', 'claude-sonnet-5', 'claude-haiku-4-5-20251001', 'claude-fable-5'])
    expect(options.find((o) => o.id === 'claude-sonnet-5')?.disabled).toBe(false)
  })

  it('a "coming soon" (not-yet-implemented) provider\'s header AND every one of its own model rows are disabled — none is genuinely selectable yet', () => {
    const options = groupedModelOptions()
    const openaiHeader = options.find((o) => o.id === '__group-openai')!
    expect(openaiHeader.disabled).toBe(true)
    expect(openaiHeader.label).toBe('OpenAI — coming soon') // PROVIDER_OPTIONS' own "coming soon" label, carried straight through
    const gpt = options.find((o) => o.id === 'gpt-4.1')!
    expect(gpt.disabled).toBe(true)
    const geminiHeader = options.find((o) => o.id === '__group-gemini')!
    expect(geminiHeader.disabled).toBe(true)
    const gemini = options.find((o) => o.id === 'gemini-2.5-pro')!
    expect(gemini.disabled).toBe(true)
  })

  it('providerIdForModel recovers the owning provider for a real committed model id', () => {
    expect(providerIdForModel('claude-sonnet-5')).toBe('anthropic')
    expect(providerIdForModel('claude-fable-5')).toBe('anthropic')
    expect(providerIdForModel('gpt-4.1')).toBe('openai')
    expect(providerIdForModel('gemini-2.5-flash')).toBe('gemini')
  })

  it('providerIdForModel returns undefined for a header id or an unknown model id — never throws, never guesses', () => {
    expect(providerIdForModel('__group-anthropic')).toBeUndefined()
    expect(providerIdForModel('not-a-real-model-id')).toBeUndefined()
  })

  // The real committed providers.json ships only ONE implemented provider (anthropic) — it cannot alone
  // prove a commit genuinely crossing PROVIDERS (every other provider's models are disabled/non-
  // committable). This synthetic multi-provider fixture proves the underlying mechanism itself: a flat
  // grouped list's commit on a DIFFERENT provider's model correctly recovers THAT provider, not the
  // previously-selected one — the exact fact gen-ui-live.ts's `onModelChange` handler depends on.
  it('negative control: selecting a model belonging to a DIFFERENT provider than the current selection derives the NEW provider, not the old one', () => {
    const synthetic: readonly ProviderOption[] = [
      { id: 'alpha', label: 'Alpha', defaultModel: 'a1', models: [{ id: 'a1', label: 'A1' }, { id: 'a2', label: 'A2' }] },
      { id: 'beta', label: 'Beta', defaultModel: 'b1', models: [{ id: 'b1', label: 'B1' }] },
    ]
    const options = groupedModelOptions(synthetic)
    expect(options.map((o) => o.id)).toEqual(['__group-alpha', 'a1', 'a2', '__group-beta', 'b1'])
    // starting selection is 'alpha' (via a1) — committing 'b1' (a Beta model) must resolve to 'beta', not 'alpha'
    expect(providerIdForModel('a1', synthetic)).toBe('alpha')
    expect(providerIdForModel('b1', synthetic)).toBe('beta') // the cross-provider commit this control targets
  })
})
