// agent-config-schema.test.ts — ADR-0135 Piece B: `liveAgentConfigSchema` (the SettingsSchema builder,
// model options PROJECTED from the passed ProvidersConfig — Fork 1) + `resolveProduceOptions` (the
// fail-closed reader into ProduceOptions, via the Piece-A shared guards). ADR-0168 cl.6 / LLD-C8 widens
// both halves: the builder's optional `integrations` argument projects one `boolean` field per manifest,
// and `resolveIntegrationIds` reads the enabled ids back fail-closed. Deterministic, no live model — the
// integration fixtures below are minimal fakes, deliberately NOT the real weather/wikipedia/currency
// manifests, so this suite never couples to that pack's own contents.

import { describe, it, expect } from 'vitest'
import {
  liveAgentConfigSchema,
  resolveProduceOptions,
  resolveIntegrationIds,
  integrationFieldKey,
} from '../../tools/agent/agent-config-schema.ts'
import type { SettingsRead } from '../../tools/agent/agent-config-schema.ts'
import type { ProvidersConfig } from '../../tools/agent/providers-config.ts'
import type { IntegrationManifest } from '../../tools/agent/integrations/registry.ts'
import { DEFAULT_GEN_UI_MODE, GEN_UI_MODES } from '../agent/gen-ui-mode.ts'
import { DEFAULT_MINI_SKILL_CAP } from '../agent/mini-skills.ts'

const PROVIDERS: ProvidersConfig = {
  defaultProvider: 'anthropic',
  providers: {
    anthropic: {
      label: 'Anthropic',
      envKey: 'ANTHROPIC_API_KEY',
      endpoint: 'https://api.anthropic.com/v1/messages',
      defaultModel: 'claude-sonnet-5',
      models: [
        { id: 'claude-opus-4-8', label: 'Claude Opus 4.8' },
        { id: 'claude-sonnet-5', label: 'Claude Sonnet 5' },
      ],
      implemented: true,
    },
    openai: {
      label: 'OpenAI',
      envKey: 'OPENAI_API_KEY',
      endpoint: 'https://api.openai.com/v1/chat/completions',
      defaultModel: 'gpt-4.1',
      models: [{ id: 'gpt-4.1', label: 'GPT-4.1' }],
      implemented: false,
    },
  },
}

function fieldOf(schema: ReturnType<typeof liveAgentConfigSchema>, key: string) {
  return schema.sections.flatMap((s) => s.fields).find((f) => f.key === key)!
}

/** A minimal fake manifest — the builder reads only `id`/`label`/`description`, so the tool/auth/execute
 *  members exist to satisfy the type, not the behavior under test. */
function fakeManifest(id: string, label: string, description: string): IntegrationManifest {
  return {
    id,
    version: '1.0.0',
    label,
    description,
    tool: { name: id, description, input_schema: { type: 'object', properties: {} } },
    auth: 'none',
    execute: async () => '',
  }
}

const WEATHER = fakeManifest('weather', 'Weather', 'Current conditions for a place.')
const CURRENCY = fakeManifest('currency', 'Currency conversion', 'Convert an amount between currencies.')
const WIKIPEDIA = fakeManifest('wikipedia-search', 'Wikipedia search', 'Look an article up on Wikipedia.')

describe('liveAgentConfigSchema — the SettingsSchema builder (ADR-0135 cl.4)', () => {
  const schema = liveAgentConfigSchema(PROVIDERS)

  it('is a v1 schema carrying the five tuning knobs', () => {
    expect(schema.version).toBe(1)
    const keys = schema.sections.flatMap((s) => s.fields).map((f) => f.key)
    expect(keys).toEqual(['mode', 'model', 'k', 'maxRounds', 'miniSkillCap'])
  })

  it('the mode field enumerates GEN_UI_MODES and defaults to DEFAULT_GEN_UI_MODE', () => {
    const mode = fieldOf(schema, 'mode')
    expect(mode.type).toBe('select')
    expect(mode.default).toBe(DEFAULT_GEN_UI_MODE)
    expect(mode.options?.map((o) => o.value)).toEqual([...GEN_UI_MODES])
  })

  it('the model options PROJECT only implemented providers models — no parallel/hardcoded list (Fork 1)', () => {
    const model = fieldOf(schema, 'model')
    expect(model.type).toBe('select')
    expect(model.options?.map((o) => o.value)).toEqual(['claude-opus-4-8', 'claude-sonnet-5'])
    // The unimplemented provider's model never surfaces.
    expect(model.options?.some((o) => o.value === 'gpt-4.1')).toBe(false)
    // Default = the default provider's own defaultModel.
    expect(model.default).toBe('claude-sonnet-5')
    // Labels come from the registry, not re-derived.
    expect(model.options?.find((o) => o.value === 'claude-opus-4-8')?.label).toBe('Claude Opus 4.8')
  })

  it('the numeric knobs carry their defaults + validation bounds', () => {
    expect(fieldOf(schema, 'k')).toMatchObject({ type: 'number', default: 3, validation: { min: 1 } })
    expect(fieldOf(schema, 'maxRounds')).toMatchObject({ type: 'number', default: 3, validation: { min: 1 } })
    expect(fieldOf(schema, 'miniSkillCap')).toMatchObject({
      type: 'number',
      default: DEFAULT_MINI_SKILL_CAP,
      validation: { min: 0 },
    })
  })

  it('dedupes a model id shared across two implemented providers (first label wins)', () => {
    const shared: ProvidersConfig = {
      defaultProvider: 'a',
      providers: {
        a: { label: 'A', envKey: 'A_KEY', endpoint: 'x', defaultModel: 'shared', models: [{ id: 'shared', label: 'From A' }], implemented: true },
        b: { label: 'B', envKey: 'B_KEY', endpoint: 'y', defaultModel: 'shared', models: [{ id: 'shared', label: 'From B' }], implemented: true },
      },
    }
    const model = fieldOf(liveAgentConfigSchema(shared), 'model')
    expect(model.options).toEqual([{ value: 'shared', label: 'From A' }])
  })
})

describe('resolveProduceOptions — fail-closed read into ProduceOptions (ADR-0135 cl.6)', () => {
  const schema = liveAgentConfigSchema(PROVIDERS)
  const store = (values: Record<string, unknown>): SettingsRead => ({ get: (k) => values[k] })

  it('reads valid stored values straight through', () => {
    const opts = resolveProduceOptions(
      store({ mode: 'blue-sky', model: 'claude-opus-4-8', k: 5, maxRounds: 2, miniSkillCap: 1 }),
      schema,
    )
    expect(opts).toEqual({ mode: 'blue-sky', model: 'claude-opus-4-8', k: 5, maxRounds: 2, miniSkillCap: 1 })
  })

  it('fails closed to schema defaults when the store is empty (every get returns undefined)', () => {
    const opts = resolveProduceOptions(store({}), schema)
    expect(opts).toEqual({ mode: DEFAULT_GEN_UI_MODE, model: 'claude-sonnet-5', k: 3, maxRounds: 3, miniSkillCap: DEFAULT_MINI_SKILL_CAP })
  })

  it('rejects an out-of-range number and an unknown select value (never reaches the loop verbatim)', () => {
    const opts = resolveProduceOptions(
      store({ mode: 'nonsense-mode', model: 'gpt-4.1', k: 0, maxRounds: -3, miniSkillCap: -1 }),
      schema,
    )
    // mode/model fall back to schema defaults (unknown option); k/maxRounds below min → schema default 3;
    // miniSkillCap below min 0 → schema default DEFAULT_MINI_SKILL_CAP.
    expect(opts.mode).toBe(DEFAULT_GEN_UI_MODE)
    expect(opts.model).toBe('claude-sonnet-5')
    expect(opts.k).toBe(3)
    expect(opts.maxRounds).toBe(3)
    expect(opts.miniSkillCap).toBe(DEFAULT_MINI_SKILL_CAP)
  })
})

describe('liveAgentConfigSchema — the PROJECTED integrations section (ADR-0168 cl.6 / LLD-C8)', () => {
  it('is byte-identical to the pre-widening schema with no manifests passed (or an empty list)', () => {
    const bare = liveAgentConfigSchema(PROVIDERS)
    expect(bare.sections.map((s) => s.id)).toEqual(['live-agent'])
    expect(bare.sections.flatMap((s) => s.fields).some((f) => f.key.startsWith('integration:'))).toBe(false)
    // An explicitly empty list resolves to the SAME schema — the widening is opt-in, never a section
    // that exists-but-empty.
    expect(liveAgentConfigSchema(PROVIDERS, [])).toEqual(bare)
  })

  it('projects exactly one boolean field per manifest, keyed integration:<id>, default OFF', () => {
    const schema = liveAgentConfigSchema(PROVIDERS, [WEATHER, CURRENCY])
    expect(schema.sections.map((s) => s.id)).toEqual(['live-agent', 'integrations'])
    const section = schema.sections[1]!
    expect(section.fields).toEqual([
      {
        key: 'integration:weather',
        type: 'boolean',
        label: 'Weather',
        description: 'Current conditions for a place.',
        default: false,
      },
      {
        key: 'integration:currency',
        type: 'boolean',
        label: 'Currency conversion',
        description: 'Convert an amount between currencies.',
        default: false,
      },
    ])
  })

  it('leaves the live-agent section untouched — the widening adds, never edits', () => {
    const bare = liveAgentConfigSchema(PROVIDERS)
    const widened = liveAgentConfigSchema(PROVIDERS, [WEATHER])
    expect(widened.version).toBe(1)
    expect(widened.sections[0]).toEqual(bare.sections[0])
  })

  it('takes label + description from the MANIFEST, never re-derived from the id', () => {
    const field = fieldOf(liveAgentConfigSchema(PROVIDERS, [WIKIPEDIA]), 'integration:wikipedia-search')
    expect(field.label).toBe('Wikipedia search')
    expect(field.description).toBe('Look an article up on Wikipedia.')
  })

  it('integrationFieldKey is the ONE naming home the builder itself uses', () => {
    expect(integrationFieldKey('weather')).toBe('integration:weather')
    const keys = liveAgentConfigSchema(PROVIDERS, [WEATHER, WIKIPEDIA])
      .sections[1]!.fields.map((f) => f.key)
    expect(keys).toEqual([integrationFieldKey('weather'), integrationFieldKey('wikipedia-search')])
  })
})

describe('resolveIntegrationIds — the fail-closed enablement read (ADR-0168 cl.6)', () => {
  const schema = liveAgentConfigSchema(PROVIDERS, [WEATHER, CURRENCY, WIKIPEDIA])
  const store = (values: Record<string, unknown>): SettingsRead => ({ get: (k) => values[k] })

  it('returns only the ids whose field is stored EXACTLY true (false + unset excluded)', () => {
    const ids = resolveIntegrationIds(
      store({ 'integration:weather': true, 'integration:currency': false }),
      schema,
    )
    expect(ids).toEqual(['weather'])
  })

  it('excludes every truthy-but-not-boolean stored value — no coercion, ever', () => {
    for (const raw of ['true', 1, 'yes', [], {}, new Date()]) {
      expect(resolveIntegrationIds(store({ 'integration:weather': raw }), schema)).toEqual([])
    }
  })

  it('excludes null/undefined/malformed values without throwing', () => {
    for (const raw of [null, undefined, NaN, 0, '']) {
      expect(() => resolveIntegrationIds(store({ 'integration:currency': raw }), schema)).not.toThrow()
      expect(resolveIntegrationIds(store({ 'integration:currency': raw }), schema)).toEqual([])
    }
  })

  it('returns every enabled id in schema (registration) order', () => {
    const ids = resolveIntegrationIds(
      store({
        'integration:wikipedia-search': true,
        'integration:currency': true,
        'integration:weather': true,
      }),
      schema,
    )
    expect(ids).toEqual(['weather', 'currency', 'wikipedia-search'])
  })

  it('is empty for an empty store, and for a schema built without integrations', () => {
    expect(resolveIntegrationIds(store({}), schema)).toEqual([])
    // The SCHEMA is the candidate list: a stored flag for a field this schema never projected can never
    // enable a tool (the "never a hardcoded second list" law, read side).
    const bare = liveAgentConfigSchema(PROVIDERS)
    expect(resolveIntegrationIds(store({ 'integration:weather': true }), bare)).toEqual([])
  })

  it('ignores the live-agent knobs — only integration:<id> boolean fields are candidates', () => {
    const ids = resolveIntegrationIds(
      store({ mode: 'blue-sky', model: 'claude-opus-4-8', k: 5, 'integration:currency': true }),
      schema,
    )
    expect(ids).toEqual(['currency'])
  })
})
