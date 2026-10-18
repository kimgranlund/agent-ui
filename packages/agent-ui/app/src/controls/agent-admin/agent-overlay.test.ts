// agent-overlay.test.ts: T-0161, user edits stored as a diff over the seed. The laws: resolve(seed,
// diff(seed, value)) gives back exactly what was written; a seed update merges per field (base, new seed,
// user) and never wipes; a conflict keeps the user value and is flagged seedChanged with the base, seed and
// user values; a legacy copy at an older version is kept flagged unless its value matches that version's
// field digest (T-0355), which takes the new seed; reset per field and
// per key; the overlay round-trips through JSON (the StorageAdapter encoding).
import { describe, it, expect } from 'vitest'
import {
  createOverlayStore,
  diffOverlay,
  emptyOverlay,
  modifiedPaths,
  parseOverlay,
  provenanceAt,
  rebaseOverlay,
  resetPath,
  resolveOverlay,
  setOverlayKey,
  valueDigest,
  type AgentOverlay,
} from './agent-overlay.ts'

const entry = (id: string, content: string, order: number, extra: Record<string, unknown> = {}) => ({
  id,
  kind: 'skill',
  label: id,
  description: `${id} description`,
  content,
  order,
  enabled: true,
  builtin: false,
  ...extra,
})

const seedV1 = (): Record<string, unknown> => ({
  name: 'Concierge',
  model: 'claude-sonnet-5-5',
  toolsEnabled: true,
  'entries:skill': [entry('greet', 'Say hello.', 0), entry('book', 'Book a table.', 1), entry('farewell', 'Say goodbye.', 2)],
  'entries:catalog': [],
})

/** JSON round trip: the StorageAdapter's own encoding, so a test sees what a reload sees. */
const reload = (overlay: AgentOverlay): AgentOverlay => parseOverlay(JSON.parse(JSON.stringify(overlay)))!

describe('diff and resolve: what was written is what is read', () => {
  it('an untouched seed has an empty overlay and resolves to the seed', () => {
    const seed = seedV1()
    const overlay = emptyOverlay('concierge', 1, seed)
    expect(overlay.base).toBe('concierge@1')
    expect(modifiedPaths(overlay)).toEqual([])
    expect(resolveOverlay(seed, overlay)).toEqual(seed)
  })

  it('a scalar edit is one field op; equal-to-seed removes it again', () => {
    const seed = seedV1()
    let overlay = setOverlayKey(seed, emptyOverlay('concierge', 1, seed), 'name', 'Max')
    expect(modifiedPaths(overlay)).toEqual([{ key: 'name' }])
    expect(resolveOverlay(seed, reload(overlay))['name']).toBe('Max')
    overlay = setOverlayKey(seed, overlay, 'name', 'Concierge')
    expect(modifiedPaths(overlay)).toEqual([])
  })

  it('an entry edit stores only the changed field, not the list', () => {
    const seed = seedV1()
    const list = seed['entries:skill'] as ReturnType<typeof entry>[]
    const edited = list.map((e) => (e.id === 'book' ? { ...e, content: 'Book a table for two.' } : e))
    const overlay = setOverlayKey(seed, emptyOverlay('concierge', 1, seed), 'entries:skill', edited)
    expect(modifiedPaths(overlay)).toEqual([{ key: 'entries:skill', entryId: 'book', field: 'content' }])
    const stored = JSON.stringify(overlay)
    expect(stored).not.toContain('Say hello.')
    expect(stored).not.toContain('Say goodbye.')
    expect(resolveOverlay(seed, reload(overlay))['entries:skill']).toEqual(edited)
  })

  it('add, remove, reorder and an unset field all round-trip exactly', () => {
    const seed = seedV1()
    const [greet, book, farewell] = seed['entries:skill'] as ReturnType<typeof entry>[]
    const { description: _drop, ...bookNoDescription } = book!
    const value = [entry('mine', 'My own skill.', 0), farewell!, bookNoDescription]
    void greet
    const overlay = reload(setOverlayKey(seed, emptyOverlay('concierge', 1, seed), 'entries:skill', value))
    expect(resolveOverlay(seed, overlay)['entries:skill']).toEqual(value)
    expect(modifiedPaths(overlay)).toEqual(
      expect.arrayContaining([
        { key: 'entries:skill', entryId: 'mine', change: 'added' },
        { key: 'entries:skill', entryId: 'greet', change: 'removed' },
        { key: 'entries:skill', entryId: 'book', field: 'description' },
        { key: 'entries:skill', change: 'order' },
      ]),
    )
  })

  it('a key the seed never had (a Surface Options switch) persists as an op', () => {
    const seed = seedV1()
    const overlay = reload(setOverlayKey(seed, emptyOverlay('concierge', 1, seed), 'surfaceA2ui', true))
    expect(resolveOverlay(seed, overlay)['surfaceA2ui']).toBe(true)
  })
})

describe('3-way merge on a seed update', () => {
  const editBook = (seed: Record<string, unknown>, content: string): AgentOverlay => {
    const list = (seed['entries:skill'] as ReturnType<typeof entry>[]).map((e) => (e.id === 'book' ? { ...e, content } : e))
    return reload(setOverlayKey(seed, setOverlayKey(seed, emptyOverlay('concierge', 1, seed), 'name', 'Max'), 'entries:skill', list))
  }

  it('no conflict: the seed changed other fields, they flow in and the user edit stays', () => {
    const v1 = seedV1()
    const overlay = editBook(v1, 'Book a table for two.')
    const v2 = { ...v1, model: 'claude-opus-5-5', 'entries:skill': (v1['entries:skill'] as ReturnType<typeof entry>[]).map((e) => (e.id === 'greet' ? { ...e, content: 'Greet warmly.' } : e)) }
    const merged = rebaseOverlay(overlay, v2, 'concierge', 2)
    expect(merged.base).toBe('concierge@2')
    const resolved = resolveOverlay(v2, reload(merged))
    expect(resolved['model'], 'an unedited field takes the new seed').toBe('claude-opus-5-5')
    expect(resolved['name'], 'the user edit survives').toBe('Max')
    const skills = resolved['entries:skill'] as ReturnType<typeof entry>[]
    expect(skills.find((e) => e.id === 'greet')!.content).toBe('Greet warmly.')
    expect(skills.find((e) => e.id === 'book')!.content).toBe('Book a table for two.')
    expect(modifiedPaths(merged).some((p) => p.seedChanged !== undefined), 'nothing flagged').toBe(false)
  })

  it('conflict: both sides changed the field; the user value is kept and flagged seedChanged with base, seed and user', () => {
    const v1 = seedV1()
    const overlay = editBook(v1, 'Book a table for two.')
    const v2 = { ...v1, name: 'Hotel Concierge', 'entries:skill': (v1['entries:skill'] as ReturnType<typeof entry>[]).map((e) => (e.id === 'book' ? { ...e, content: 'Book a table, confirm the time.' } : e)) }
    const merged = reload(rebaseOverlay(overlay, v2, 'concierge', 2))
    const resolved = resolveOverlay(v2, merged)
    expect(resolved['name']).toBe('Max')
    expect((resolved['entries:skill'] as ReturnType<typeof entry>[]).find((e) => e.id === 'book')!.content).toBe('Book a table for two.')
    expect(modifiedPaths(merged)).toEqual(
      expect.arrayContaining([
        { key: 'name', seedChanged: { base: 'Concierge', seed: 'Hotel Concierge', user: 'Max' } },
        {
          key: 'entries:skill',
          entryId: 'book',
          field: 'content',
          seedChanged: { base: 'Book a table.', seed: 'Book a table, confirm the time.', user: 'Book a table for two.' },
        },
      ]),
    )
  })

  it('the seed converged on the user value: the op drops, nothing is flagged', () => {
    const v1 = seedV1()
    const overlay = editBook(v1, 'Book a table for two.')
    const v2 = { ...v1, name: 'Max' }
    const merged = rebaseOverlay(overlay, v2, 'concierge', 2)
    expect(modifiedPaths(merged).map((p) => p.key + (p.field ?? ''))).toEqual(['entries:skillcontent'])
  })

  it('an entry deleted upstream that the user edited is kept as the user value and flagged; an unedited one goes', () => {
    const v1 = seedV1()
    const overlay = editBook(v1, 'Book a table for two.')
    const v2 = { ...v1, 'entries:skill': (v1['entries:skill'] as ReturnType<typeof entry>[]).filter((e) => e.id !== 'book' && e.id !== 'farewell') }
    const merged = reload(rebaseOverlay(overlay, v2, 'concierge', 2))
    const skills = resolveOverlay(v2, merged)['entries:skill'] as ReturnType<typeof entry>[]
    expect(skills.map((e) => e.id)).toEqual(['greet', 'book'])
    expect(skills.find((e) => e.id === 'book')).toEqual({ ...entry('book', 'Book a table for two.', 1) })
    const flagged = modifiedPaths(merged).find((p) => p.entryId === 'book')!
    expect(flagged.change).toBe('added')
    expect(flagged.seedChanged, 'seed removed it: no seed side').toEqual({ base: entry('book', 'Book a table.', 1), user: entry('book', 'Book a table for two.', 1) })
  })

  it('a scalar key deleted upstream keeps a user edit and flags it', () => {
    const v1 = { ...seedV1(), a2uiLocalPatterns: 'concierge' }
    const overlay = setOverlayKey(v1, emptyOverlay('concierge', 1, v1), 'a2uiLocalPatterns', 'croupier')
    const { a2uiLocalPatterns: _gone, ...v2 } = v1
    const merged = reload(rebaseOverlay(overlay, v2, 'concierge', 2))
    expect(resolveOverlay(v2, merged)['a2uiLocalPatterns']).toBe('croupier')
    expect(modifiedPaths(merged)).toEqual([{ key: 'a2uiLocalPatterns', seedChanged: { base: 'concierge', user: 'croupier' } }])
  })

  it('the same seed (digest and version) is a no-op', () => {
    const v1 = seedV1()
    const overlay = editBook(v1, 'Book a table for two.')
    expect(rebaseOverlay(overlay, seedV1(), 'concierge', 1)).toBe(overlay)
  })
})

describe('migration from today’s stored shape (full per-key copies)', () => {
  it('diffs the stored values against the seed: only real edits become ops', () => {
    const seed = seedV1()
    const storedSkills = (seed['entries:skill'] as ReturnType<typeof entry>[]).map((e) => (e.id === 'greet' ? { ...e, enabled: false } : e))
    const stored = { 'entries:skill': storedSkills, model: 'claude-sonnet-5-5', surfaceA2ui: true }
    const overlay = diffOverlay('concierge', 1, seed, stored)
    expect(modifiedPaths(overlay)).toEqual([
      { key: 'surfaceA2ui' },
      { key: 'entries:skill', entryId: 'greet', field: 'enabled' },
    ])
    expect(resolveOverlay(seed, overlay)).toEqual({ ...seed, ...stored })
  })
})

describe('review findings: nothing is wiped, every write reads back, a malformed record fails closed', () => {
  it('a seed that turns an edited list into a non-list keeps the user\'s entries, flagged', () => {
    const v1 = { l: [{ id: 'p', t: 'seed' }, { id: 'q' }] }
    const overlay = setOverlayKey(v1, emptyOverlay('a', 1, v1), 'l', [{ id: 'p', t: 'mine' }, { id: 'q' }])
    const v2 = { l: 'now a string' }
    const merged = reload(rebaseOverlay(overlay, v2, 'a', 2))
    expect(resolveOverlay(v2, merged)['l']).toEqual([{ id: 'p', t: 'mine' }])
    expect(modifiedPaths(merged)).toEqual([{ key: 'l', seedChanged: { seed: 'now a string', user: [{ id: 'p', t: 'mine' }] } }])
  })

  it('an empty list on a key the seed lacks reads back as the empty list', () => {
    const seed = seedV1()
    const overlay = reload(setOverlayKey(seed, emptyOverlay('concierge', 1, seed), 'entries:extra', []))
    expect(resolveOverlay(seed, overlay)['entries:extra']).toEqual([])
    expect(modifiedPaths(overlay)).toEqual([{ key: 'entries:extra' }])
  })

  it('parseOverlay refuses a record with a malformed value op or entry op', () => {
    const good = setOverlayKey(seedV1(), emptyOverlay('concierge', 1, seedV1()), 'name', 'Max')
    expect(parseOverlay(JSON.parse(JSON.stringify(good)))).toBeDefined()
    const head = { format: 1, base: 'a@1', baseVersion: 1, baseDigest: 'fnv:0' }
    const bad: unknown[] = [
      { ...head, values: { name: 'not an op' }, lists: {} },
      { ...head, values: { name: { value: 1, seedChanged: 'x' } }, lists: {} },
      { ...head, values: {}, lists: { l: { entries: { p: { op: 'patch', base: { id: 'p' }, set: {} } } } } },
      { ...head, values: {}, lists: { l: { entries: { p: { op: 'patch', base: { id: 'p' }, set: [], unset: [] } } } } },
      { ...head, values: {}, lists: { l: { entries: { p: { op: 'patch', set: {}, unset: [] } } } } },
      { ...head, values: {}, lists: { l: { entries: { p: { op: 'added' } } } } },
      { ...head, values: {}, lists: { l: { entries: { p: { op: 'removed', base: 3 } } } } },
      { ...head, values: {}, lists: { l: { entries: { p: { op: 'renamed' } } } } },
      { ...head, values: {}, lists: { l: { entries: {}, order: [1] } } },
    ]
    for (const record of bad) expect(parseOverlay(record), JSON.stringify(record)).toBeUndefined()
  })
})

describe('the spec example and the older-version migration (ACS-R7)', () => {
  it('E1: effort medium to low; the next version sets high; low is kept, flagged with medium, high and low', () => {
    const v7 = { effort: 'medium', surfaceStyle: 'old' }
    const overlay = setOverlayKey(v7, emptyOverlay('concierge', 7, v7), 'effort', 'low')
    const quiet = rebaseOverlay(overlay, { effort: 'medium', surfaceStyle: 'new' }, 'concierge', 8)
    expect(resolveOverlay({ effort: 'medium', surfaceStyle: 'new' }, quiet)).toEqual({ effort: 'low', surfaceStyle: 'new' })
    expect(modifiedPaths(quiet)).toEqual([{ key: 'effort' }])
    const flagged = rebaseOverlay(overlay, { effort: 'high', surfaceStyle: 'new' }, 'concierge', 8)
    expect(modifiedPaths(flagged)).toEqual([{ key: 'effort', seedChanged: { base: 'medium', seed: 'high', user: 'low' } }])
  })

  it('a copy written against an older version keeps every differing value, flagged with no base; a missing seed entry is not a removal', () => {
    const seed = seedV1()
    const stale = [entry('greet', 'Old hello.', 0), entry('retired', 'A skill the seed dropped.', 1)]
    const overlay = diffOverlay('concierge', 2, seed, { model: 'claude-haiku-4-5', 'entries:skill': stale }, { baseUnknown: true })
    const resolved = resolveOverlay(seed, reload(overlay))
    expect(resolved['model']).toBe('claude-haiku-4-5')
    expect((resolved['entries:skill'] as ReturnType<typeof entry>[]).map((e) => [e.id, e.content])).toEqual([
      ['greet', 'Old hello.'],
      ['book', 'Book a table.'],
      ['farewell', 'Say goodbye.'],
      ['retired', 'A skill the seed dropped.'],
    ])
    expect(modifiedPaths(overlay)).toEqual([
      { key: 'model', seedChanged: { seed: 'claude-sonnet-5-5', user: 'claude-haiku-4-5' } },
      { key: 'entries:skill', entryId: 'greet', field: 'content', seedChanged: { seed: 'Say hello.', user: 'Old hello.' } },
      { key: 'entries:skill', entryId: 'retired', change: 'added', seedChanged: { user: stale[1] } },
    ])
  })

  it('T-0355: a stored value equal to the old version digest takes the new seed unflagged; a user value stays flagged', () => {
    const seed = seedV1()
    const baseDigests = { model: [valueDigest('claude-haiku-4-5'), valueDigest('claude-haiku-4-0')], name: [valueDigest('Old Concierge')] }
    const untouched = diffOverlay('concierge', 2, seed, { model: 'claude-haiku-4-5', name: 'Old Concierge' }, { baseUnknown: true, baseDigests })
    expect(untouched.values).toEqual({})
    expect(resolveOverlay(seed, reload(untouched))['model']).toBe('claude-sonnet-5-5')
    expect(modifiedPaths(untouched)).toEqual([])
    const edited = diffOverlay('concierge', 2, seed, { model: 'claude-opus-5-5', name: 'Old Concierge' }, { baseUnknown: true, baseDigests })
    expect(resolveOverlay(seed, reload(edited))['model']).toBe('claude-opus-5-5')
    expect(modifiedPaths(edited)).toEqual([{ key: 'model', seedChanged: { seed: 'claude-sonnet-5-5', user: 'claude-opus-5-5' } }])
  })

  it('T-0355: the digests apply only to an older-version copy; at the current version a matching value is still an edit', () => {
    const seed = seedV1()
    const overlay = diffOverlay('concierge', 2, seed, { model: 'claude-haiku-4-5' }, { baseDigests: { model: [valueDigest('claude-haiku-4-5')] } })
    expect(modifiedPaths(overlay)).toEqual([{ key: 'model' }])
  })
})

describe('reset and modified state', () => {
  it('reset one field, one entry, one key', () => {
    const seed = seedV1()
    const list = (seed['entries:skill'] as ReturnType<typeof entry>[]).map((e) => (e.id === 'book' ? { ...e, content: 'X', label: 'Y' } : e.id === 'greet' ? { ...e, enabled: false } : e))
    let overlay = setOverlayKey(seed, setOverlayKey(seed, emptyOverlay('concierge', 1, seed), 'entries:skill', list), 'name', 'Max')
    overlay = resetPath(overlay, { key: 'entries:skill', entryId: 'book', field: 'content' })
    let skills = resolveOverlay(seed, overlay)['entries:skill'] as ReturnType<typeof entry>[]
    expect(skills.find((e) => e.id === 'book')).toMatchObject({ content: 'Book a table.', label: 'Y' })
    overlay = resetPath(overlay, { key: 'entries:skill', entryId: 'greet' })
    skills = resolveOverlay(seed, overlay)['entries:skill'] as ReturnType<typeof entry>[]
    expect(skills.find((e) => e.id === 'greet')!.enabled).toBe(true)
    overlay = resetPath(overlay, { key: 'name' })
    expect(modifiedPaths(overlay)).toEqual([{ key: 'entries:skill', entryId: 'book', field: 'label' }])
  })
})

describe('createOverlayStore: the SettingsStore every reader goes through', () => {
  it('get resolves, set persists the overlay and notifies, reset re-notifies with the seed value', () => {
    const seed = seedV1()
    const persisted: AgentOverlay[] = []
    const seen: [string, unknown][] = []
    const store = createOverlayStore({ seed, overlay: emptyOverlay('concierge', 1, seed), persist: (o) => persisted.push(o) })
    store.subscribe?.((key, value) => seen.push([key, value]))
    expect(store.get('name')).toBe('Concierge')
    expect(store.get('entries:skill'), 'a stable reference between writes').toBe(store.get('entries:skill'))
    store.set('name', 'Max')
    expect(store.get('name')).toBe('Max')
    expect(persisted.at(-1) && modifiedPaths(persisted.at(-1)!)).toEqual([{ key: 'name' }])
    expect(store.modified()).toEqual([{ key: 'name' }])
    store.reset({ key: 'name' })
    expect(store.get('name')).toBe('Concierge')
    expect(seen).toEqual([
      ['name', 'Max'],
      ['name', 'Concierge'],
    ])
  })

  it('parseOverlay fails closed on a foreign value', () => {
    expect(parseOverlay(null)).toBeUndefined()
    expect(parseOverlay({ format: 9 })).toBeUndefined()
    expect(parseOverlay('x')).toBeUndefined()
  })
})

// ── T-0162: per-op source and provenance (ACS-R8) ─────────────────────────────────────────────────────

describe('ACS-R8: every op records the surface that wrote it', () => {
  const seed = { name: 'Seed', effort: 'medium', 'entries:skill': [entry('menu', 'Menu.', 0), entry('wine', 'Wine.', 1)] }
  const base = (): AgentOverlay => emptyOverlay('a', 1, seed)

  it('a user write stores no source (the pre-T-0162 shape) and reads user; builder and pack are recorded', () => {
    let o = setOverlayKey(seed, base(), 'name', 'Mine')
    expect(o.values['name']).toEqual({ value: 'Mine', base: 'Seed' })
    expect(provenanceAt(o, { key: 'name' })).toBe('user')
    o = setOverlayKey(seed, o, 'effort', 'low', 'builder')
    expect(o.values['effort']?.source).toBe('builder')
    expect(provenanceAt(o, { key: 'effort' })).toBe('builder')
    expect(provenanceAt(o, { key: 'model' })).toBe('seed')
    o = setOverlayKey(seed, o, 'entries:skill', [...seed['entries:skill'], entry('cheese', 'Cheese.', 2)], 'pack')
    expect(provenanceAt(o, { key: 'entries:skill', entryId: 'cheese' })).toBe('pack')
    expect(provenanceAt(o, { key: 'entries:skill', entryId: 'menu' })).toBe('seed')
  })

  it('a later write that leaves an entry as it was keeps that entry\'s source; a changed entry takes the new one', () => {
    const withPack = setOverlayKey(seed, base(), 'entries:skill', [...seed['entries:skill'], entry('cheese', 'Cheese.', 2)], 'pack')
    const userEdit = setOverlayKey(seed, withPack, 'entries:skill', [entry('menu', 'Menu, edited.', 0), entry('wine', 'Wine.', 1), entry('cheese', 'Cheese.', 2)])
    expect(provenanceAt(userEdit, { key: 'entries:skill', entryId: 'cheese' })).toBe('pack')
    expect(provenanceAt(userEdit, { key: 'entries:skill', entryId: 'menu' })).toBe('user')
    expect(provenanceAt(userEdit, { key: 'entries:skill', entryId: 'menu', field: 'content' })).toBe('user')
    expect(provenanceAt(userEdit, { key: 'entries:skill', entryId: 'menu', field: 'label' })).toBe('seed')
    expect(modifiedPaths(userEdit).find((p) => p.entryId === 'cheese')).toEqual({ key: 'entries:skill', entryId: 'cheese', change: 'added', source: 'pack' })
  })

  it('re-writing a scalar to the value it holds keeps its source; a new value takes the writer\'s', () => {
    const store = createOverlayStore({ seed, overlay: base() })
    store.setFrom('model', 'claude-opus-5-5', 'builder')
    store.set('model', 'claude-opus-5-5')
    expect(provenanceAt(store.overlay(), { key: 'model' })).toBe('builder')
    store.set('model', 'claude-sonnet-5-5')
    expect(provenanceAt(store.overlay(), { key: 'model' })).toBe('user')
  })

  it('a seed update keeps each op\'s source, flagged or not', () => {
    const o = setOverlayKey(seed, base(), 'effort', 'low', 'builder')
    const next = rebaseOverlay(o, { ...seed, effort: 'high' }, 'a', 2)
    expect(next.values['effort']).toMatchObject({ value: 'low', source: 'builder', seedChanged: { base: 'medium', seed: 'high' } })
    const kept = rebaseOverlay(o, { ...seed, name: 'Seed 2' }, 'a', 2)
    expect(kept.values['effort']?.source).toBe('builder')
  })

  it('parseOverlay refuses an unknown source', () => {
    const o = setOverlayKey(seed, base(), 'effort', 'low', 'builder')
    expect(parseOverlay(JSON.parse(JSON.stringify(o)))).toBeDefined()
    expect(parseOverlay({ ...o, values: { effort: { value: 'low', source: 'model' } } })).toBeUndefined()
  })

  it('reset of a list order drops the order alone; Take seed on a flagged field resolves to the new seed', () => {
    const reordered = setOverlayKey(seed, base(), 'entries:skill', [entry('wine', 'Wine, edited.', 1), entry('menu', 'Menu.', 0)])
    expect(reordered.lists['entries:skill']?.order).toEqual(['wine', 'menu'])
    const orderBack = resetPath(reordered, { key: 'entries:skill', order: true })
    expect(orderBack.lists['entries:skill']?.order).toBeUndefined()
    expect(orderBack.lists['entries:skill']?.entries['wine']?.op).toBe('patch')

    const store = createOverlayStore({ seed: { ...seed, effort: 'high' }, overlay: rebaseOverlay(setOverlayKey(seed, base(), 'effort', 'low'), { ...seed, effort: 'high' }, 'a', 2) })
    expect(store.modified()).toEqual([{ key: 'effort', seedChanged: { base: 'medium', seed: 'high', user: 'low' } }])
    store.reset({ key: 'effort' })
    expect(store.get('effort')).toBe('high')
    expect(store.modified()).toEqual([])
  })
})
