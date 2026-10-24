// persona-edit.test.ts: T-0447, the edit record behind an edit session's Undo (persona-edit.ts), and the
// `deny` admission seam that drops `SURFACE_AUTHORING_KEY` in edit sessions (persona-patch.ts).
import { describe, it, expect } from 'vitest'
import { createMemoryStore } from '../settings/memory-store.ts'
import { DEFAULT_MODEL_ID, SURFACE_AUTHORING_KEY, defaultAgentConfigSchema, modelRoster } from './agent-admin-schema.ts'
import { ENTRY_KINDS, initialEntryValues } from './entries.ts'
import { entriesStoreKey, readEntries } from '../entry-list/entry-data.ts'
import { applyPersonaPatch, type PatchDeps } from './persona-patch.ts'
import { createOverlayStore, emptyOverlay, rebaseOverlay, setOverlayKey } from './agent-overlay.ts'
import { captureEdit, finishEdit, mergeEdit, revertEdit, type EditRecord } from './persona-edit.ts'

const deps: PatchDeps = { models: modelRoster(), schema: defaultAgentConfigSchema }
const memoryStore = (extra: Record<string, unknown> = {}): ReturnType<typeof createMemoryStore> =>
  createMemoryStore({ initial: { model: DEFAULT_MODEL_ID, name: 'Concierge', ...initialEntryValues(), ...extra } })

type Patch = Parameters<typeof applyPersonaPatch>[1]

/** The element's capture, apply, finish sequence around one patch. */
function edit(store: Parameters<typeof applyPersonaPatch>[0], patch: Patch, extra: Partial<PatchDeps> = {}): EditRecord | undefined {
  const snapshot = captureEdit(store, patch)
  const report = applyPersonaPatch(store, patch, { ...deps, ...extra })
  return finishEdit(store, snapshot, report)
}

describe('captureEdit / finishEdit: the record holds only what the patch changed', () => {
  it('captures the persona keys a patch names, then keeps only the keys the report applied', () => {
    const store = memoryStore()
    const patch = { values: { name: 'Sommelier', model: 'not-a-model', bogus: 1 } }
    const snapshot = captureEdit(store, patch)
    expect(snapshot.keys, 'a key outside PERSONA_STATE_KEYS is never captured').toEqual(expect.arrayContaining(['name', 'model']))
    expect(snapshot.keys).not.toContain('bogus')
    const record = finishEdit(store, snapshot, applyPersonaPatch(store, patch, deps))
    expect(record?.keys, 'the dropped model is not part of the record').toEqual(['name'])
    expect(record?.before).toEqual({ name: 'Concierge' })
    expect(record?.after).toEqual({ name: 'Sommelier' })
  })

  it('an entries patch records the list key with its prior and resulting lists', () => {
    const store = memoryStore()
    const key = entriesStoreKey(ENTRY_KINDS.skill)
    const record = edit(store, { entries: { [key]: [{ label: 'Pair a wine' }] } })
    expect(record?.keys).toEqual([key])
    expect(record?.before[key]).toEqual([])
    expect((record?.after[key] as { label: string }[]).map((e) => e.label)).toEqual(['Pair a wine'])
  })

  it('finishEdit returns undefined for a patch whose every key dropped', () => {
    const store = memoryStore()
    expect(edit(store, { values: { model: 'not-a-model', bogus: true } })).toBeUndefined()
  })
})

describe('revertEdit: restore while unchanged, skip and name otherwise', () => {
  it('memory store: restores the before value through set', () => {
    const store = memoryStore()
    const record = edit(store, { values: { name: 'Sommelier' } })!
    expect(revertEdit(store, record)).toEqual({ reverted: ['name'], skipped: [] })
    expect(store.get('name')).toBe('Concierge')
  })

  it('memory store: a key absent before the edit is set back to undefined', () => {
    const store = createMemoryStore({ initial: { model: DEFAULT_MODEL_ID } })
    const record = edit(store, { values: { name: 'Sommelier' } })!
    expect(record.before).toEqual({ name: undefined })
    revertEdit(store, record)
    expect(store.get('name')).toBeUndefined()
  })

  it('a key changed after the edit is skipped and named, and keeps its newer value', () => {
    const store = memoryStore()
    const record = edit(store, { values: { name: 'Sommelier', effort: 'low' } })!
    store.set('name', 'Hand edited')
    expect(revertEdit(store, record)).toEqual({ reverted: ['effort'], skipped: ['name'] })
    expect(store.get('name')).toBe('Hand edited')
    expect(store.get('effort')).not.toBe('low')
  })

  it('overlay store: a user op survives a Builder overwrite plus Undo exactly, source and seedChanged included', () => {
    const seed = { name: 'Concierge', effort: 'medium' }
    // A user op at `effort` that a seed move later flagged: { value: 'low', base: 'high', seedChanged }.
    const flagged = rebaseOverlay(setOverlayKey(seed, emptyOverlay('a', 1, seed), 'effort', 'low'), { ...seed, effort: 'high' }, 'a', 2)
    const persisted: unknown[] = []
    const store = createOverlayStore({ seed: { ...seed, effort: 'high' }, overlay: flagged, persist: (o) => persisted.push(o) })
    const userOp = structuredClone(store.overlay().values['effort'])
    expect(userOp?.source, 'a user op stores no source').toBeUndefined()
    expect(userOp?.seedChanged).toEqual({ base: 'medium', seed: 'high' })

    const record = edit(store, { values: { effort: 'medium' } })!
    expect(store.overlay().values['effort']?.source).toBe('builder')
    expect(store.provenance({ key: 'effort' })).toBe('builder')

    persisted.length = 0
    expect(revertEdit(store, record)).toEqual({ reverted: ['effort'], skipped: [] })
    expect(store.overlay().values['effort']).toEqual(userOp)
    expect(store.get('effort')).toBe('low')
    expect(store.provenance({ key: 'effort' })).toBe('user')
    expect(persisted, 'one persist for the whole restore').toHaveLength(1)
  })

  it('overlay store: a key with no op before the edit returns to the seed', () => {
    const seed = { name: 'Concierge' }
    const store = createOverlayStore({ seed, overlay: emptyOverlay('a', 1, seed) })
    const record = edit(store, { values: { name: 'Sommelier' } })!
    revertEdit(store, record)
    expect(store.overlay().values).toEqual({})
    expect(store.get('name')).toBe('Concierge')
    expect(store.provenance({ key: 'name' })).toBe('seed')
  })

  it('a restore notifies the store subscribers (overlay restoreKeys and memory set alike), so a name subscriber sees the Undo', () => {
    const seed = { name: 'Concierge' }
    const overlay = createOverlayStore({ seed, overlay: emptyOverlay('a', 1, seed) })
    const memory = memoryStore()
    for (const store of [overlay, memory]) {
      const record = edit(store, { values: { name: 'Sommelier' } })!
      const seen: [string, unknown][] = []
      store.subscribe!((key, value) => seen.push([key, value]))
      revertEdit(store, record)
      expect(seen).toEqual([['name', 'Concierge']])
    }
  })
})

describe('mergeEdit: one record per turn', () => {
  it('keeps the earliest before and the latest after for a key named twice', () => {
    const store = memoryStore()
    const first = edit(store, { values: { name: 'First' } })
    const second = edit(store, { values: { name: 'Second', effort: 'low' } })
    const merged = mergeEdit(first, second)!
    expect(merged.keys).toEqual(['name', 'effort'])
    expect(merged.before['name']).toBe('Concierge')
    expect(merged.after['name']).toBe('Second')
    revertEdit(store, merged)
    expect(store.get('name')).toBe('Concierge')
  })

  it('an undefined side yields the other', () => {
    const store = memoryStore()
    const record = edit(store, { values: { name: 'Only' } })
    expect(mergeEdit(undefined, record)).toBe(record)
    expect(mergeEdit(record, undefined)).toBe(record)
    expect(mergeEdit(undefined, undefined)).toBeUndefined()
  })
})

describe('PatchDeps.deny: the edit-session admission seam', () => {
  it('drops a denied key into report.dropped and writes nothing for it', () => {
    const store = memoryStore()
    const report = applyPersonaPatch(store, { values: { [SURFACE_AUTHORING_KEY]: true, name: 'Kept' } }, { ...deps, deny: [SURFACE_AUTHORING_KEY] })
    expect(report.dropped).toEqual([SURFACE_AUTHORING_KEY])
    expect(report.applied).toEqual(['name'])
    expect(store.get(SURFACE_AUTHORING_KEY)).toBeUndefined()
  })

  it('without deny the same key is admitted, so the drop is the deny alone', () => {
    const store = memoryStore()
    const report = applyPersonaPatch(store, { values: { [SURFACE_AUTHORING_KEY]: true } }, deps)
    expect(report.applied).toEqual([SURFACE_AUTHORING_KEY])
    expect(store.get(SURFACE_AUTHORING_KEY)).toBe(true)
    expect(readEntries(store, ENTRY_KINDS.skill)).toEqual([])
  })
})
