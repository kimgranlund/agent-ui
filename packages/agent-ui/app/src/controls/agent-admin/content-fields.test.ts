// content-fields.test.ts: T-0162, the persona kind schema is the one field definition (agent-content
// SPEC ACS-R10). Pins the schema against the constants every reader names, proves the settings form
// derives from it in both directions (every schema field rendered, no form field without a row), and
// proves the Builder's patch gate refuses what the schema refuses. The pane-level half (every pane-edited
// row has a rendered `[data-field]` control and no control lacks a row) runs in real engines:
// provenance.browser.test.ts.
import { describe, it, expect } from 'vitest'
import {
  PERSONA_FIELDS,
  PERSONA_FIELD_BY_KEY,
  SERVER_TOOL_FIELD_KEYS,
  checkFieldValue,
  checkFrontmatter,
  type ContentField,
} from './content-fields.ts'
import {
  AGENT_ENABLED_KEY,
  A2UI_CATALOG_KEY,
  A2UI_DOMAINS_KEY,
  A2UI_LOCAL_PATTERNS_KEY,
  BANKROLL_CAPABLE_KEY,
  BANKROLL_KEY,
  MODELS_INCLUDED_KEY,
  MODEL_SETTING_KEYS,
  SUPPORTED_MODELS,
  SURFACE_A2UI_KEY,
  SURFACE_AUTHORING_KEY,
  SURFACE_GENUI_DOGFOOD_KEY,
  SURFACE_GENUI_KEY,
  SURFACE_MARKDOWN_KEY,
  SURFACE_PLANNER_KEY,
  agentConfigSchema,
  kindEnabledKey,
  modelRoster,
} from './agent-admin-schema.ts'
import { PERSONA_STATE_KEYS, PERSONA_VALUE_KEYS, applyPersonaPatch } from './persona-patch.ts'
import { ENTRY_KINDS } from './entries.ts'
import { entriesStoreKey } from '../entry-list/entry-data.ts'
import { EFFORT_LEVELS } from '../conversation/composer-options.ts'
import { capabilitiesFor, SERVER_TOOL_KEY } from '@agent-ui/a2ui/agent/model-capabilities'
import { SERVER_TOOL_SETTING_KEYS } from './agent-admin-schema.ts'
import { createOverlayStore, emptyOverlay, provenanceAt } from './agent-overlay.ts'

describe('the schema pins the key constants every reader names', () => {
  it('PERSONA_STATE_KEYS is the pre-T-0162 hand list, in the same order (the persona file key order)', () => {
    const kinds = Object.values(ENTRY_KINDS)
    const handList = [
      ...new Set([
        'name',
        'model',
        ...Object.values(MODEL_SETTING_KEYS),
        MODELS_INCLUDED_KEY,
        AGENT_ENABLED_KEY,
        ...kinds.map((kind) => kindEnabledKey(kind)),
        SURFACE_MARKDOWN_KEY,
        SURFACE_A2UI_KEY,
        SURFACE_GENUI_KEY,
        SURFACE_GENUI_DOGFOOD_KEY,
        SURFACE_PLANNER_KEY,
        SURFACE_AUTHORING_KEY,
        A2UI_CATALOG_KEY,
        A2UI_LOCAL_PATTERNS_KEY,
        A2UI_DOMAINS_KEY,
        BANKROLL_CAPABLE_KEY,
        BANKROLL_KEY,
        ...kinds.map((kind) => entriesStoreKey(kind)),
      ]),
    ]
    expect(PERSONA_STATE_KEYS).toEqual(handList)
  })

  it('the effort values are the composer levels', () => {
    expect(PERSONA_FIELD_BY_KEY.get(MODEL_SETTING_KEYS.effort)?.values).toEqual(EFFORT_LEVELS.map((e) => e.id))
  })

  it('every row has a store key or a file key, and no key repeats', () => {
    const keys = PERSONA_FIELDS.flatMap((f) => (f.key === undefined ? [] : [f.key]))
    const files = PERSONA_FIELDS.flatMap((f) => (f.file === undefined ? [] : [f.file]))
    expect(PERSONA_FIELDS.every((f) => f.key !== undefined || f.file !== undefined)).toBe(true)
    expect(new Set(keys).size).toBe(keys.length)
    expect(new Set(files).size).toBe(files.length)
  })
})

/** The rows the `ui-settings` form renders for `model`: the agent rows, plus each model row whose gate the
 *  model's capability row allows. An independent reading of the gates, not the derivation's own code. */
function expectedFormKeys(model: string): string[] {
  const row = capabilitiesFor(model)
  const shows = (f: ContentField): boolean => {
    if (f.home === 'agent') return true
    if (f.home !== 'model' || row === undefined) return false
    switch (f.form?.gate) {
      case 'efforts':
        return row.efforts.length > 0
      case 'thinking':
        return Object.keys(row.thinking).length > 1
      case 'displays':
        return row.displays.length > 0
      case 'cacheTtls':
        return row.cacheTtls.length > 0
      default:
        return true
    }
  }
  return PERSONA_FIELDS.filter(shows).map((f) => f.key!)
}

describe('ACS-R10: the settings form is generated from the schema', () => {
  for (const { id } of SUPPORTED_MODELS) {
    it(`${id}: every schema field the model accepts is in the form, and every form field has a schema row`, () => {
      const formKeys = agentConfigSchema(id).sections.flatMap((s) => s.fields.map((f) => f.key))
      expect(formKeys).toEqual(expectedFormKeys(id))
      for (const key of formKeys) expect(['agent', 'model']).toContain(PERSONA_FIELD_BY_KEY.get(key)?.home)
    })
  }

  it('the select options are the schema values the model row offers, labelled by the schema hint', () => {
    const effort = agentConfigSchema('claude-haiku-5-5').sections.flatMap((s) => s.fields).find((f) => f.key === 'effort')!
    const values = PERSONA_FIELD_BY_KEY.get('effort')!.values!
    for (const option of effort.options ?? []) {
      expect(values).toContain(option.value)
      expect(option.label).toBe(PERSONA_FIELD_BY_KEY.get('effort')!.form!.optionLabels![option.value])
    }
  })
})

describe('the Builder patch gate is schema-backed', () => {
  /** A value of the wrong shape for each value type, so every state row is exercised. */
  const WRONG: Record<string, unknown> = { string: 42, boolean: 'true', integer: 1.5, number: 'many', enum: 'turbo', flags: { a: 'yes' } }

  it('every value key refuses a value its schema row refuses: dropped, nothing written, no op recorded', () => {
    for (const key of PERSONA_VALUE_KEYS) {
      const field = PERSONA_FIELD_BY_KEY.get(key)!
      const bad = WRONG[field.type]
      expect(bad, `no wrong value for type ${field.type}`).not.toBeUndefined()
      expect(checkFieldValue(field, bad)).toBeTypeOf('string')
      const seed = { name: 'Seed' }
      const store = createOverlayStore({ seed, overlay: emptyOverlay('a', 1, seed) })
      const report = applyPersonaPatch(store, { values: { [key]: bad } }, { models: modelRoster(), schema: agentConfigSchema() })
      expect(report.dropped, key).toEqual([key])
      expect(store.overlay().values, key).toEqual({})
    }
  })

  it('an invalid op (an unknown key, an entry list named in values, a malformed entry) drops; a valid one lands as the Builder', () => {
    const seed = { name: 'Seed', [entriesStoreKey('skill')]: [] }
    const store = createOverlayStore({ seed, overlay: emptyOverlay('a', 1, seed) })
    const report = applyPersonaPatch(
      store,
      {
        values: { temperature: 0.2, [entriesStoreKey('skill')]: [], maxTokens: -1, effort: 'low' },
        entries: { [entriesStoreKey('skill')]: [{ description: 'no label' }] },
      },
      { models: modelRoster(), schema: agentConfigSchema() },
    )
    expect(report.dropped).toEqual(['temperature', entriesStoreKey('skill'), 'maxTokens', `${entriesStoreKey('skill')}[0]`])
    expect(report.applied).toEqual(['effort'])
    expect(store.overlay().values).toEqual({ effort: { value: 'low', source: 'builder' } })
    expect(provenanceAt(store.overlay(), { key: 'effort' })).toBe('builder')
    expect(store.overlay().lists).toEqual({})
  })
})

describe('checkFrontmatter', () => {
  it('names an unknown key, a missing required field and a wrong shape; a valid object has no problem', () => {
    const problems = checkFrontmatter(PERSONA_FIELDS, { id: 'x', version: 1, label: 'X', tagline: 'T', name: 'N', model: 'm', toolsEnabled: 'yes', effort: 'turbo', temperature: 1 })
    expect(problems).toContain('unknown key temperature')
    expect(problems).toContain('skills is required')
    expect(problems).toContain('toolsEnabled is not a boolean')
    expect(problems.some((p) => p.startsWith('effort "turbo" is not one of'))).toBe(true)
    const valid = { id: 'x', version: 1, order: 1, label: 'X', tagline: 'T', name: 'N', model: 'm', toolsEnabled: true, skills: [], workflows: [], resources: [], tools: ['weather@1'] }
    expect(checkFrontmatter(PERSONA_FIELDS, valid)).toEqual([])
  })
})

describe('T-0203: one server tool key vocabulary', () => {
  it('the import-free field table matches the capability table, and every derived store key is a pane row', () => {
    expect(SERVER_TOOL_FIELD_KEYS).toEqual(SERVER_TOOL_KEY)
    const keys = Object.values(SERVER_TOOL_SETTING_KEYS).flatMap((k) => Object.values(k))
    for (const key of keys) expect(PERSONA_FIELD_BY_KEY.get(key)?.home, key).toBe('model')
    const rows = PERSONA_FIELDS.filter((f) => f.form?.gate === 'serverTools').map((f) => f.key)
    expect(new Set(rows)).toEqual(new Set(keys))
  })
})
