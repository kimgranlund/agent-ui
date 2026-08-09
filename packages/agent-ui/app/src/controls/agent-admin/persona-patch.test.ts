// persona-patch.test.ts — LLD `agent-authoring-flow.lld.md` §11 (LLD-C1): the three-filter apply gate,
// row by row. The load-bearing property under test is not "valid values are written" — it is that an
// INVALID value is DROPPED rather than coerced: every shipped sanitizer answers a plausible default for
// garbage (read-time law), and a gate that inherited that behaviour would write the model's garbage into
// the user's draft as a silent, wrong-but-valid-looking default. Each admission row below therefore probes
// three points: admit, coerce-reject (a value the sanitizer would happily rewrite), and outright garbage.
import { describe, it, expect } from 'vitest'
import { createMemoryStore } from '../settings/memory-store.ts'
import {
  A2UI_CATALOG_KEY,
  A2UI_LOCAL_PATTERNS_KEY,
  AGENT_ENABLED_KEY,
  BANKROLL_CAPABLE_KEY,
  BANKROLL_KEY,
  DEFAULT_MODEL_ID,
  MODELS_INCLUDED_KEY,
  SURFACE_A2UI_KEY,
  SURFACE_AUTHORING_KEY,
  SURFACE_GENUI_KEY,
  SURFACE_PLANNER_KEY,
  defaultAgentConfigSchema,
  kindEnabledKey,
  modelRoster,
} from './agent-admin-schema.ts'
import { ENTRY_KINDS, initialEntryValues } from './entries.ts'
import { entriesStoreKey, readEntries } from '../entry-list/entry-data.ts'
import {
  PERSONA_ENTRY_LIST_KEYS,
  PERSONA_STATE_KEYS,
  PERSONA_VALUE_KEYS,
  PATCHABLE_VALUE_SHAPES,
  applyPersonaPatch,
  draftStateBlock,
  readPersonaState,
  type PatchDeps,
} from './persona-patch.ts'

const deps: PatchDeps = { models: modelRoster(), schema: defaultAgentConfigSchema }
const freshStore = (): ReturnType<typeof createMemoryStore> => createMemoryStore({ initial: { model: DEFAULT_MODEL_ID, ...initialEntryValues() } })

describe('the canonical key set (LLD-C1) — one enumeration, two consumers', () => {
  it('partitions cleanly into the value half and the entry-list half', () => {
    expect(new Set([...PERSONA_VALUE_KEYS, ...PERSONA_ENTRY_LIST_KEYS])).toEqual(new Set(PERSONA_STATE_KEYS))
    expect(PERSONA_VALUE_KEYS.some((key) => PERSONA_ENTRY_LIST_KEYS.includes(key))).toBe(false)
    expect(new Set(PERSONA_STATE_KEYS).size).toBe(PERSONA_STATE_KEYS.length)
  })

  it('carries the planner gate (GH #640) alongside the authoring gate', () => {
    expect(PERSONA_STATE_KEYS).toContain(SURFACE_PLANNER_KEY)
    expect(PERSONA_STATE_KEYS).toContain(SURFACE_AUTHORING_KEY)
  })

  it('the published value SHAPES cover exactly the patchable value keys — the vocabulary drift trip-wire', () => {
    // The Builder's key-vocabulary prompt section is generated from this map. A key present in one and
    // absent from the other would teach a model to send something the gate then silently drops (or hide
    // a key it may legitimately set) — so the two sets are pinned equal, not merely overlapping.
    expect(Object.keys(PATCHABLE_VALUE_SHAPES).sort()).toEqual([...PERSONA_VALUE_KEYS].sort())
  })

  it('has an admission row for EVERY value key — the drift trip-wire', () => {
    // A value key with no admission row is silently unpatchable: the model would be taught the key
    // (the Builder's generated vocabulary section reads the SAME export) and every patch naming it
    // would drop. This asserts the table and the set cannot diverge.
    const store = freshStore()
    const unpatchable = PERSONA_VALUE_KEYS.filter((key) => {
      // Probe each key with a value its own admission predicate must accept.
      const probe: Record<string, unknown> = {
        name: 'Probe',
        model: DEFAULT_MODEL_ID,
        temperature: 0.4,
        [MODELS_INCLUDED_KEY]: { [DEFAULT_MODEL_ID]: true },
        [A2UI_CATALOG_KEY]: 'agent-ui',
        [A2UI_LOCAL_PATTERNS_KEY]: undefined, // no selection is the only universally-valid value here
        [BANKROLL_KEY]: 25,
      }
      const value = key in probe ? probe[key] : true // every remaining key is a switch
      if (key === A2UI_LOCAL_PATTERNS_KEY) return false // probed in its own row below
      return applyPersonaPatch(store, { values: { [key]: value } }, deps).applied.length === 0
    })
    expect(unpatchable).toEqual([])
  })
})

describe('filter 1 — the enumerated-key filter', () => {
  it('drops an unknown key silently, writing nothing', () => {
    const store = freshStore()
    const report = applyPersonaPatch(store, { values: { nonsense: 'x', __proto__: 'evil' } }, deps)
    expect(report.applied).toEqual([])
    expect(report.dropped).toContain('nonsense')
    expect(store.get('nonsense')).toBeUndefined()
  })

  it('drops a WRONG-INTENT member: an entry-list key named in `values`, and a value key named in `entries`', () => {
    const store = freshStore()
    const sectionsKey = entriesStoreKey(ENTRY_KINDS.promptSection)
    const before = readEntries(store, ENTRY_KINDS.promptSection)
    const report = applyPersonaPatch(store, { values: { [sectionsKey]: [] }, entries: { name: [{ label: 'x' }] } }, deps)
    expect(report.applied).toEqual([])
    expect(report.dropped).toEqual([sectionsKey, 'name'])
    // the crucial half: the sections list was NOT replaced with the empty array the `values` arm carried
    expect(readEntries(store, ENTRY_KINDS.promptSection)).toEqual(before)
  })
})

describe('filter 2 — per-key admission is a FIXPOINT over the shipped sanitizers, never a coercion', () => {
  it('model: a roster id admits; an off-roster id DROPS rather than coercing to the default', () => {
    const store = freshStore()
    expect(applyPersonaPatch(store, { values: { model: 'claude-sonnet-5' } }, deps).applied).toEqual(['model'])
    expect(store.get('model')).toBe('claude-sonnet-5')

    const report = applyPersonaPatch(store, { values: { model: 'gpt-9-imaginary' } }, deps)
    expect(report.applied).toEqual([])
    expect(report.dropped).toEqual(['model'])
    expect(store.get('model')).toBe('claude-sonnet-5') // untouched — NOT rewritten to DEFAULT_MODEL_ID
  })

  it('temperature: an in-range number admits; out-of-range and non-numbers drop', () => {
    const store = freshStore()
    expect(applyPersonaPatch(store, { values: { temperature: 0.3 } }, deps).applied).toEqual(['temperature'])
    expect(store.get('temperature')).toBe(0.3)
    for (const bad of [1.5, -1, '0.4', Number.NaN, null]) {
      expect(applyPersonaPatch(store, { values: { temperature: bad } }, deps).dropped).toEqual(['temperature'])
    }
    expect(store.get('temperature')).toBe(0.3)
  })

  it('every switch key admits a LITERAL boolean only — a truthy string/number never turns a capability on', () => {
    const store = freshStore()
    const switches = [AGENT_ENABLED_KEY, SURFACE_A2UI_KEY, SURFACE_GENUI_KEY, SURFACE_PLANNER_KEY, SURFACE_AUTHORING_KEY, BANKROLL_CAPABLE_KEY, kindEnabledKey(ENTRY_KINDS.skill)]
    for (const key of switches) {
      expect(applyPersonaPatch(store, { values: { [key]: true } }, deps).applied, key).toEqual([key])
      expect(store.get(key)).toBe(true)
      for (const truthy of ['true', 1, 'yes', {}]) {
        expect(applyPersonaPatch(store, { values: { [key]: truthy } }, deps).dropped, `${key} <- ${String(truthy)}`).toEqual([key])
      }
      expect(store.get(key)).toBe(true) // never overwritten by a near-miss
    }
  })

  it('catalog / local patterns / bankroll: each admits exactly what its own sanitizer returns unchanged', () => {
    const store = freshStore()
    expect(applyPersonaPatch(store, { values: { [A2UI_CATALOG_KEY]: 'a2ui-basic' } }, deps).applied).toEqual([A2UI_CATALOG_KEY])
    expect(applyPersonaPatch(store, { values: { [A2UI_CATALOG_KEY]: 'not-a-catalog' } }, deps).dropped).toEqual([A2UI_CATALOG_KEY])
    expect(store.get(A2UI_CATALOG_KEY)).toBe('a2ui-basic') // NOT coerced back to the default id

    expect(applyPersonaPatch(store, { values: { [A2UI_LOCAL_PATTERNS_KEY]: 'no-such-persona' } }, deps).dropped).toEqual([A2UI_LOCAL_PATTERNS_KEY])

    expect(applyPersonaPatch(store, { values: { [BANKROLL_KEY]: 250 } }, deps).applied).toEqual([BANKROLL_KEY])
    expect(applyPersonaPatch(store, { values: { [BANKROLL_KEY]: -5 } }, deps).dropped).toEqual([BANKROLL_KEY])
    expect(store.get(BANKROLL_KEY)).toBe(250)
  })

  it('the model-inclusion record admits a plain boolean map only', () => {
    const store = freshStore()
    expect(applyPersonaPatch(store, { values: { [MODELS_INCLUDED_KEY]: { 'claude-sonnet-5': false } } }, deps).applied).toEqual([MODELS_INCLUDED_KEY])
    for (const bad of [{ 'claude-sonnet-5': 'no' }, ['claude-sonnet-5'], null, 'all']) {
      expect(applyPersonaPatch(store, { values: { [MODELS_INCLUDED_KEY]: bad } }, deps).dropped).toEqual([MODELS_INCLUDED_KEY])
    }
  })
})

describe('filter 3 — entries go through the pane’s OWN validateNewEntry add path', () => {
  it('appends admitted entries and never replaces or removes the existing list', () => {
    const store = freshStore()
    const key = entriesStoreKey(ENTRY_KINDS.skill)
    const report = applyPersonaPatch(store, { entries: { [key]: [{ label: 'Book a table', description: 'd', content: 'c' }, { label: 'Cancel' }] } }, deps)
    expect(report.added).toEqual({ [key]: 2 })
    const skills = readEntries(store, ENTRY_KINDS.skill)
    expect(skills.map((e) => e.label)).toEqual(['Book a table', 'Cancel'])
    // the add path's own shape: slugged id, ascending order, enabled, never builtin
    expect(skills[0]).toMatchObject({ id: 'book-a-table', kind: ENTRY_KINDS.skill, order: 0, enabled: true, builtin: false })
    expect(skills[1]?.order).toBe(1)
    // a second patch APPENDS — SPEC-R29's no-deletion law is structural here (no delete branch exists)
    applyPersonaPatch(store, { entries: { [key]: [{ label: 'Upsell' }] } }, deps)
    expect(readEntries(store, ENTRY_KINDS.skill).map((e) => e.label)).toEqual(['Book a table', 'Cancel', 'Upsell'])
  })

  it('drops a member that is not entry-shaped, keeping its well-formed siblings', () => {
    const store = freshStore()
    const key = entriesStoreKey(ENTRY_KINDS.tool)
    const report = applyPersonaPatch(store, { entries: { [key]: ['just a string', { label: 'Search' }, { description: 'no label' }, null] } }, deps)
    expect(report.added).toEqual({ [key]: 1 })
    expect(report.dropped).toEqual([`${key}[0]`, `${key}[2]`, `${key}[3]`])
    expect(readEntries(store, ENTRY_KINDS.tool).map((e) => e.label)).toEqual(['Search'])
  })

  it('dedup-suffixes a colliding id for an ordinary kind — parity with two sequential add-form submissions', () => {
    const store = freshStore()
    const key = entriesStoreKey(ENTRY_KINDS.workflow)
    applyPersonaPatch(store, { entries: { [key]: [{ label: 'Check in' }, { label: 'Check in' }] } }, deps)
    expect(readEntries(store, ENTRY_KINDS.workflow).map((e) => e.id)).toEqual(['check-in', 'check-in-2'])
  })

  it('REJECTS a colliding catalog entry instead of suffixing it — the pane’s own rejectOnCollision option (GH #564)', () => {
    const store = freshStore()
    const key = entriesStoreKey(ENTRY_KINDS.catalog)
    const report = applyPersonaPatch(store, { entries: { [key]: [{ label: 'Default', id: 'agent-ui' }, { label: 'Again', id: 'agent-ui' }] } }, deps)
    expect(report.added).toEqual({ [key]: 1 })
    expect(report.dropped).toEqual([`${key}[1]`])
    expect(readEntries(store, ENTRY_KINDS.catalog).map((e) => e.id)).toEqual(['agent-ui'])
  })

  it('a patch whose entries ALL drop writes nothing at all for that kind', () => {
    const store = freshStore()
    const key = entriesStoreKey(ENTRY_KINDS.resource)
    const before = store.get(key)
    expect(applyPersonaPatch(store, { entries: { [key]: [42, {}] } }, deps).added).toEqual({})
    expect(store.get(key)).toBe(before) // not even a same-value rewrite (no spurious pane re-render)
  })
})

describe('the merge law + the report (SPEC-R29 / ADR-0178 cl.2)', () => {
  it('values are whole-value last-writer-wins per key; absent keys stay untouched', () => {
    const store = freshStore()
    applyPersonaPatch(store, { values: { name: 'First', temperature: 0.2 } }, deps)
    applyPersonaPatch(store, { values: { name: 'Second' } }, deps)
    expect(store.get('name')).toBe('Second')
    expect(store.get('temperature')).toBe(0.2) // the absent key was not reset
  })

  it('reports exactly what happened — applied, added, dropped — with no error thrown for any of it', () => {
    const store = freshStore()
    const key = entriesStoreKey(ENTRY_KINDS.skill)
    const report = applyPersonaPatch(
      store,
      { values: { name: 'Concierge', model: 'nope', mystery: 1 }, entries: { [key]: [{ label: 'Greet' }], 'entries:ghost': [{ label: 'x' }] } },
      deps,
    )
    expect(report).toEqual({ applied: ['name'], added: { [key]: 1 }, dropped: ['model', 'mystery', 'entries:ghost'] })
  })

  it('an empty patch is a no-op with an empty report', () => {
    expect(applyPersonaPatch(freshStore(), {}, deps)).toEqual({ applied: [], added: {}, dropped: [] })
  })
})

describe('the draft-state block (LLD §2 draft-state feedback)', () => {
  it('serializes the canonical projection, collapsing entry lists to their labels', () => {
    const store = freshStore()
    store.set('name', 'Concierge')
    applyPersonaPatch(store, { entries: { [entriesStoreKey(ENTRY_KINDS.skill)]: [{ label: 'Book a table', content: 'a long body the interviewer never needs' }] } }, deps)
    const block = draftStateBlock(store)
    expect(block).toContain('"name": "Concierge"')
    expect(block).toContain('"Book a table"')
    expect(block).not.toContain('a long body the interviewer never needs')
    // it reads THROUGH the canonical projection — never a key outside the set
    for (const key of Object.keys(readPersonaState(store))) expect(PERSONA_STATE_KEYS).toContain(key)
  })

  it('degrades to an empty projection for an absent store rather than throwing', () => {
    expect(() => draftStateBlock(undefined)).not.toThrow()
  })
})
