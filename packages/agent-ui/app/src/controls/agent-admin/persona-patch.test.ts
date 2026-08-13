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
import { DEFAULT_PROMPT_SECTIONS, ENTRY_KINDS, initialEntryValues } from './entries.ts'
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
  type PatchReport,
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
    const report = applyPersonaPatch(store, { values: { nonsense: 'x' } }, deps)
    expect(report.applied).toEqual([])
    expect(report.dropped).toContain('nonsense')
    expect(store.get('nonsense')).toBeUndefined()
  })

  // A patch arrives as PARSED JSON off the wire, and `JSON.parse` makes `__proto__`/`toString`/
  // `constructor` ordinary OWN keys that `Object.entries` hands straight to the admission lookup. Building
  // them with an object LITERAL instead would prove nothing: `{ __proto__: 'evil' }` is the literal's
  // special form — it sets the prototype and creates no own key at all, so the gate never even sees it.
  // Every case below is therefore built through `JSON.parse`, the real shape.
  const wirePatch = (json: string): { values?: Record<string, unknown>; entries?: Record<string, unknown[]> } =>
    JSON.parse(json) as { values?: Record<string, unknown>; entries?: Record<string, unknown[]> }

  it('a prototype-chain key is DROPPED like any other unknown — never thrown on, never admitted', () => {
    // Measured before the admission table became a Map: `__proto__`/`hasOwnProperty`/`valueOf` THREW
    // (the inherited member is not a callable predicate), and `toString`/`constructor` returned something
    // truthy and were ADMITTED AND WRITTEN — a non-enumerated key straight past filter 1. The throws were
    // the worse half: they escape into the component's turn `catch` and fail the WHOLE turn, breaking
    // §3's drop-the-item-never-the-turn law from a single malformed key.
    for (const key of ['__proto__', 'toString', 'constructor', 'hasOwnProperty', 'valueOf', 'isPrototypeOf']) {
      const store = freshStore()
      const before = { name: store.get('name'), model: store.get('model') }
      let report: PatchReport | undefined
      expect(() => {
        report = applyPersonaPatch(store, wirePatch(`{"values":{${JSON.stringify(key)}:"y"}}`), deps)
      }, `${key} must not throw — a bad key drops the ITEM, never the turn`).not.toThrow()
      expect(report!.applied, `${key} must never be admitted`).toEqual([])
      expect(report!.dropped).toEqual([key])
      expect(store.get(key), `${key} must never be written`).toBeUndefined()
      expect({ name: store.get('name'), model: store.get('model') }, 'no collateral writes').toEqual(before)
    }
  })

  it('a prototype-chain key alongside a GOOD one drops only itself — the rest of the patch still applies', () => {
    // The whole point of drop-the-item: one poisoned key must not cost the user the turn's real content.
    const store = freshStore()
    const report = applyPersonaPatch(store, wirePatch('{"values":{"__proto__":"evil","name":"Concierge","toString":"y"}}'), deps)
    expect(report.applied).toEqual(['name'])
    expect(report.dropped).toEqual(['__proto__', 'toString'])
    expect(store.get('name')).toBe('Concierge')
    // and the prototype itself is untouched — no pollution reached Object.prototype
    expect(({} as Record<string, unknown>).evil).toBeUndefined()
  })

  it('a prototype-chain key in the ENTRIES arm drops the same way (the kind map is a Map too)', () => {
    const store = freshStore()
    let report: PatchReport | undefined
    expect(() => {
      report = applyPersonaPatch(store, wirePatch('{"entries":{"__proto__":[{"label":"x"}],"toString":[{"label":"y"}]}}'), deps)
    }).not.toThrow()
    expect(report!.added).toEqual({})
    expect(report!.dropped).toEqual(['__proto__', 'toString'])
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
    expect(report).toEqual({ applied: ['name'], added: { [key]: 1 }, updated: {}, dropped: ['model', 'mystery', 'entries:ghost'] })
  })

  it('an empty patch is a no-op with an empty report', () => {
    expect(applyPersonaPatch(freshStore(), {}, deps)).toEqual({ applied: [], added: {}, updated: {}, dropped: [] })
  })
})

// ── the UPDATE verb — ADR-0178's ratified amendment (GH #696), `builder-builtin-section-update.lld.md` ────
// The property under test is the FENCE, in both polarities: a host-seeded BUILTIN prompt section is
// replaceable in place, and everything else on either side of that line still behaves exactly as it did
// before the verb existed. Deletion has no arm at all — an emptying update is the shape that would have been
// one, so it gets its own reject test.

const SECTION_KEY = entriesStoreKey(ENTRY_KINDS.promptSection)

describe('the UPDATE verb — builtin prompt sections replace in place (ADR-0178 amendment / LLD-C1)', () => {
  it('replaces a builtin section’s content, leaving every non-patchable field byte-identical', () => {
    const store = freshStore()
    const before = readEntries(store, ENTRY_KINDS.promptSection).find((e) => e.id === 'foundation')!
    const report = applyPersonaPatch(store, { entries: { [SECTION_KEY]: [{ id: 'foundation', content: 'You are Casey, a restaurant concierge.' }] } }, deps)
    expect(report.updated).toEqual({ [SECTION_KEY]: ['foundation'] })
    expect(report.added).toEqual({}) // an update is not an add — no zero-count row a consumer would misread
    expect(report.dropped).toEqual([])
    const after = readEntries(store, ENTRY_KINDS.promptSection).find((e) => e.id === 'foundation')!
    expect(after.content).toBe('You are Casey, a restaurant concierge.')
    // field-by-field: the placeholder text is gone and NOTHING else moved
    expect(after.id).toBe(before.id)
    expect(after.kind).toBe(before.kind)
    expect(after.label).toBe(before.label)
    expect(after.description).toBe(before.description)
    expect(after.order).toBe(before.order)
    expect(after.enabled).toBe(before.enabled)
    expect(after.builtin).toBe(true)
    // in PLACE: the list is the same length, in the same order — no fourth section, no reordering
    expect(readEntries(store, ENTRY_KINDS.promptSection).map((e) => e.id)).toEqual(['foundation', 'personality', 'critical-items'])
  })

  it('reaches all three seeded builtins, and `description` is optional in both directions', () => {
    const store = freshStore()
    const report = applyPersonaPatch(
      store,
      {
        entries: {
          [SECTION_KEY]: [
            { id: 'foundation', content: 'Role.' },
            { id: 'personality', content: 'Voice.', description: 'How Casey speaks.' },
            { id: 'critical-items', content: 'Rules.' },
          ],
        },
      },
      deps,
    )
    expect(report.updated).toEqual({ [SECTION_KEY]: ['foundation', 'personality', 'critical-items'] })
    const sections = readEntries(store, ENTRY_KINDS.promptSection)
    expect(sections.map((e) => e.content)).toEqual(['Role.', 'Voice.', 'Rules.'])
    // a sent description replaces (trimmed, the add path's own asymmetry); an omitted one is untouched
    expect(sections.find((e) => e.id === 'personality')?.description).toBe('How Casey speaks.')
    expect(sections.find((e) => e.id === 'foundation')?.description).toBe('Core role and capabilities — who this agent is and what it does.')
  })

  it('is repeatable — last writer wins across turns, so the model can refine its own earlier Foundation', () => {
    const store = freshStore()
    applyPersonaPatch(store, { entries: { [SECTION_KEY]: [{ id: 'foundation', content: 'First pass.' }] } }, deps)
    const second = applyPersonaPatch(store, { entries: { [SECTION_KEY]: [{ id: 'foundation', content: 'Refined pass.' }] } }, deps)
    expect(second.updated).toEqual({ [SECTION_KEY]: ['foundation'] })
    expect(readEntries(store, ENTRY_KINDS.promptSection).find((e) => e.id === 'foundation')?.content).toBe('Refined pass.')
  })

  it('ignores the fields it may never patch instead of refusing a member that mentions them', () => {
    const store = freshStore()
    // A model echoing what it read in the draft state: label/order/enabled/builtin/kind ride along and change
    // nothing — labels are the panes' stable anchors, order keeps Foundation leading, the toggle is the user's.
    applyPersonaPatch(
      store,
      { entries: { [SECTION_KEY]: [{ id: 'foundation', label: 'Renamed', order: 42, enabled: false, builtin: false, kind: 'skill', content: 'New body.' }] } },
      deps,
    )
    const after = readEntries(store, ENTRY_KINDS.promptSection).find((e) => e.id === 'foundation')!
    expect(after).toMatchObject({ label: 'Foundation', order: 0, enabled: true, builtin: true, kind: ENTRY_KINDS.promptSection, content: 'New body.' })
  })

  it('updates and appends in ONE patch land as a single store write — one pane re-render (the shipped law)', () => {
    const store = freshStore()
    let writes = 0
    const counting = {
      get: (key: string) => store.get(key),
      set: (key: string, value: unknown) => {
        if (key === SECTION_KEY) writes += 1
        store.set(key, value)
      },
    }
    const report = applyPersonaPatch(
      counting,
      { entries: { [SECTION_KEY]: [{ id: 'foundation', content: 'Filled in.' }, { label: 'Intake', content: 'Ask first.' }] } },
      deps,
    )
    expect(writes).toBe(1)
    expect(report.updated).toEqual({ [SECTION_KEY]: ['foundation'] })
    expect(report.added).toEqual({ [SECTION_KEY]: 1 })
    const sections = readEntries(store, ENTRY_KINDS.promptSection)
    expect(sections.map((e) => e.label)).toEqual(['Foundation', 'Personality', 'Critical Items', 'Intake'])
    expect(sections[0]?.content).toBe('Filled in.')
    expect(sections[3]).toMatchObject({ id: 'intake', order: 3, builtin: false })
  })

  it('REFUSES an emptying update — the no-deletion law has no arm here either', () => {
    const store = freshStore()
    const before = store.get(SECTION_KEY)
    const report = applyPersonaPatch(
      store,
      { entries: { [SECTION_KEY]: [{ id: 'foundation', content: '' }, { id: 'personality', content: '   \n  ' }, { id: 'critical-items' }] } },
      deps,
    )
    expect(report.updated).toEqual({})
    expect(report.added).toEqual({})
    expect(report.dropped).toEqual([`${SECTION_KEY}[0]`, `${SECTION_KEY}[1]`, `${SECTION_KEY}[2]`])
    expect(store.get(SECTION_KEY)).toBe(before) // not even a same-value rewrite
  })

  it('REFUSES a malformed update rather than half-applying it, and keeps its well-formed siblings', () => {
    const store = freshStore()
    const report = applyPersonaPatch(
      store,
      {
        entries: {
          [SECTION_KEY]: [
            { id: 'foundation', content: 42 }, // content must be a string
            { id: 'personality', content: 'Voice.', description: 7 }, // the arm validates as a WHOLE
            { id: 'critical-items', content: 'Rules.' },
          ],
        },
      },
      deps,
    )
    expect(report.dropped).toEqual([`${SECTION_KEY}[0]`, `${SECTION_KEY}[1]`])
    expect(report.updated).toEqual({ [SECTION_KEY]: ['critical-items'] })
    const sections = readEntries(store, ENTRY_KINDS.promptSection)
    expect(sections.find((e) => e.id === 'foundation')?.content).toBe('You are a helpful assistant.') // untouched
    expect(sections.find((e) => e.id === 'personality')?.content).toBe(DEFAULT_PROMPT_SECTIONS[1]?.content) // untouched
    expect(sections.find((e) => e.id === 'critical-items')?.content).toBe('Rules.')
  })

  it('REFUSES to update a USER-authored entry — the append-protection the amendment deliberately did not widen', () => {
    const store = freshStore()
    // the user's own section, added by hand (or by an earlier patch): NOT builtin
    applyPersonaPatch(store, { entries: { [SECTION_KEY]: [{ label: 'House rules', content: 'The user’s own words.' }] } }, deps)
    const report = applyPersonaPatch(store, { entries: { [SECTION_KEY]: [{ id: 'house-rules', label: 'House rules', content: 'Overwritten by the model.' }] } }, deps)
    // it took TODAY's append path verbatim — dedup-suffixed id, a NEW entry, the user's text intact
    expect(report.updated).toEqual({})
    expect(report.added).toEqual({ [SECTION_KEY]: 1 })
    const sections = readEntries(store, ENTRY_KINDS.promptSection)
    expect(sections.find((e) => e.id === 'house-rules')?.content).toBe('The user’s own words.')
    expect(sections.find((e) => e.id === 'house-rules-2')?.content).toBe('Overwritten by the model.')
  })

  it('a labelless member naming a user-authored entry DROPS — it can never become a replacement by another route', () => {
    const store = freshStore()
    applyPersonaPatch(store, { entries: { [SECTION_KEY]: [{ label: 'House rules', content: 'The user’s own words.' }] } }, deps)
    const report = applyPersonaPatch(store, { entries: { [SECTION_KEY]: [{ id: 'house-rules', content: 'Overwritten.' }] } }, deps)
    expect(report.updated).toEqual({})
    expect(report.added).toEqual({})
    expect(report.dropped).toEqual([`${SECTION_KEY}[0]`])
    expect(readEntries(store, ENTRY_KINDS.promptSection).find((e) => e.id === 'house-rules')?.content).toBe('The user’s own words.')
  })

  it('the fence is KIND-scoped — a builtin-looking id on any other list still appends (registry rows never drift)', () => {
    const store = freshStore()
    // The catalog kind's rows ARE builtin-shaped at read time, and they are registry-derived foreign keys:
    // the update verb must not reach them (LLD §4's named non-goal), so `agent-ui` collides and REJECTS.
    const catalogKey = entriesStoreKey(ENTRY_KINDS.catalog)
    applyPersonaPatch(store, { entries: { [catalogKey]: [{ label: 'Default', id: 'agent-ui' }] } }, deps)
    const report = applyPersonaPatch(store, { entries: { [catalogKey]: [{ label: 'Default', id: 'agent-ui', content: 'nope' }] } }, deps)
    expect(report.updated).toEqual({})
    expect(report.dropped).toEqual([`${catalogKey}[0]`])
    // and a skill list ignores the verb entirely: a matching id dedup-suffixes into a NEW entry
    const skillKey = entriesStoreKey(ENTRY_KINDS.skill)
    applyPersonaPatch(store, { entries: { [skillKey]: [{ label: 'Greet', content: 'first' }] } }, deps)
    const skills = applyPersonaPatch(store, { entries: { [skillKey]: [{ label: 'Greet', id: 'greet', content: 'second' }] } }, deps)
    expect(skills.updated).toEqual({})
    expect(skills.added).toEqual({ [skillKey]: 1 })
    expect(readEntries(store, ENTRY_KINDS.skill).map((e) => e.content)).toEqual(['first', 'second'])
  })

  it('an id matching NOTHING appends, so an imported persona missing its builtins degrades instead of dropping', () => {
    const store = createMemoryStore({ initial: { model: DEFAULT_MODEL_ID, [SECTION_KEY]: [] } })
    const report = applyPersonaPatch(store, { entries: { [SECTION_KEY]: [{ id: 'foundation', label: 'Foundation', content: 'Role.' }] } }, deps)
    expect(report.updated).toEqual({})
    expect(report.added).toEqual({ [SECTION_KEY]: 1 })
    expect(readEntries(store, ENTRY_KINDS.promptSection)).toMatchObject([{ id: 'foundation', content: 'Role.', builtin: false }])
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

  // ADR-0178's amendment makes this part of the RULING, not a nicety: last-writer-wins over a field the user
  // can hand-edit is only acceptable if the model can read the current text before it overwrites it.
  it('carries the BUILTIN prompt sections’ current content — the concurrency mitigation the update verb needs', () => {
    const store = freshStore()
    const block = draftStateBlock(store)
    for (const section of DEFAULT_PROMPT_SECTIONS) {
      expect(block, `${section.id} must be nameable by the model`).toContain(`"id": "${section.id}"`)
      expect(block, `${section.id}'s current text must be readable`).toContain(JSON.stringify(section.content).slice(1, -1))
    }
    // and it reflects a HAND EDIT, which is the whole point — the user's text wins and the model can see it
    const sections = readEntries(store, ENTRY_KINDS.promptSection).map((e) => (e.id === 'foundation' ? { ...e, content: 'Hand-edited by the user.' } : e))
    store.set(SECTION_KEY, sections)
    expect(draftStateBlock(store)).toContain('Hand-edited by the user.')
  })

  it('carries ONLY the builtin bodies — every other member, including the model’s own sections, stays a label', () => {
    const store = freshStore()
    applyPersonaPatch(
      store,
      {
        entries: {
          [SECTION_KEY]: [{ label: 'Intake', content: 'a long appended body the interviewer never needs' }],
          [entriesStoreKey(ENTRY_KINDS.skill)]: [{ label: 'Book a table', content: 'another long body' }],
        },
      },
      deps,
    )
    const block = draftStateBlock(store)
    expect(block).toContain('"Intake"') // the model's OWN appended section: a bare label, like every other kind
    expect(block).not.toContain('a long appended body the interviewer never needs')
    expect(block).toContain('"Book a table"')
    expect(block).not.toContain('another long body')
  })
})
