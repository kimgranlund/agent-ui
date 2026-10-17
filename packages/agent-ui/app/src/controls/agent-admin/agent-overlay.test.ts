// agent-overlay.test.ts: T-0161, user edits stored as a diff over the seed. The laws: resolve(seed,
// diff(seed, value)) gives back exactly what was written; a seed update merges per field (base, new seed,
// user) and never wipes; a conflict keeps the user value and carries both values; reset per field and
// per key; the overlay round-trips through JSON (the StorageAdapter encoding).
import { describe, it, expect } from 'vitest'
import {
  createOverlayStore,
  diffOverlay,
  emptyOverlay,
  modifiedPaths,
  parseOverlay,
  rebaseOverlay,
  resetPath,
  resolveOverlay,
  setOverlayKey,
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
    expect(modifiedPaths(merged).some((p) => p.conflict !== undefined), 'nothing flagged').toBe(false)
  })

  it('conflict: both sides changed the field; the user value is kept and flagged with both values', () => {
    const v1 = seedV1()
    const overlay = editBook(v1, 'Book a table for two.')
    const v2 = { ...v1, name: 'Hotel Concierge', 'entries:skill': (v1['entries:skill'] as ReturnType<typeof entry>[]).map((e) => (e.id === 'book' ? { ...e, content: 'Book a table, confirm the time.' } : e)) }
    const merged = reload(rebaseOverlay(overlay, v2, 'concierge', 2))
    const resolved = resolveOverlay(v2, merged)
    expect(resolved['name']).toBe('Max')
    expect((resolved['entries:skill'] as ReturnType<typeof entry>[]).find((e) => e.id === 'book')!.content).toBe('Book a table for two.')
    expect(modifiedPaths(merged)).toEqual(
      expect.arrayContaining([
        { key: 'name', conflict: { seed: 'Hotel Concierge', user: 'Max' } },
        { key: 'entries:skill', entryId: 'book', field: 'content', conflict: { seed: 'Book a table, confirm the time.', user: 'Book a table for two.' } },
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
    expect(flagged.conflict, 'seed removed it: seed side is absent').toEqual({ user: entry('book', 'Book a table for two.', 1) })
  })

  it('a scalar key deleted upstream keeps a user edit and flags it', () => {
    const v1 = { ...seedV1(), a2uiLocalPatterns: 'concierge' }
    const overlay = setOverlayKey(v1, emptyOverlay('concierge', 1, v1), 'a2uiLocalPatterns', 'croupier')
    const { a2uiLocalPatterns: _gone, ...v2 } = v1
    const merged = reload(rebaseOverlay(overlay, v2, 'concierge', 2))
    expect(resolveOverlay(v2, merged)['a2uiLocalPatterns']).toBe('croupier')
    expect(modifiedPaths(merged)).toEqual([{ key: 'a2uiLocalPatterns', conflict: { user: 'croupier' } }])
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
