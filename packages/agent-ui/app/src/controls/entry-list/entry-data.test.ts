// entry-data.test.ts — the generic entry-data CORE's own gate (ADR-0164 cl.2 split off
// agent-admin/entries.test.ts, no assertion lost). `validateNewEntry`'s LLD-C7 widening (an OPTIONAL
// explicit `id` on `NewEntryInput`) is parameterized by a bare `kind: string` — this file uses plain kind
// literals rather than a domain `ENTRY_KINDS` constant, since the core module the function under test
// lives in knows nothing about any consumer's kind taxonomy. The load-bearing property is symmetrical: a
// caller that supplies no id slugs from the label exactly as before.

import { describe, it, expect } from 'vitest'
import {
  ENTRY_AVAILABILITY,
  entriesStoreKey,
  entryAvailability,
  isAmbient,
  readEntries,
  validateNewEntry,
  type Entry,
  type NewEntryInput,
} from './entry-data.ts'
import { createMemoryStore } from '../settings/memory-store.ts'

describe('validateNewEntry — the optional explicit id (LLD-C7)', () => {
  const input = (over: Partial<NewEntryInput> & Pick<NewEntryInput, 'label'>): NewEntryInput => ({
    description: '',
    content: '',
    ...over,
  })

  it('BACKWARD COMPAT: no `id` supplied ⇒ slugify(label), unchanged for every other pack', () => {
    // The exact slug law: lowercase, non-alphanumeric runs → one hyphen, trimmed.
    const cases: ReadonlyArray<readonly [string, string]> = [
      ['booking-flow', 'booking-flow'], // an existing pack label (already kebab) — identical before/after
      ['Property Knowledge Base', 'property-knowledge-base'],
      ['Data Viz  Layouts!', 'data-viz-layouts'],
      ['  Trimmed  ', 'trimmed'],
      ['✦✦✦', 'entry'], // the all-non-alphanumeric fallback
    ]
    for (const [label, expected] of cases) {
      const result = validateNewEntry([], 'skill', input({ label }))
      expect(result.ok, `"${label}" must commit`).toBe(true)
      if (result.ok) expect(result.entry.id, `"${label}" slugs unchanged`).toBe(expected)
    }
  })

  it('an explicit `id` WINS over the slug, and is never itself slugged (it is a foreign key)', () => {
    const result = validateNewEntry([], 'tool', input({ id: 'wikipedia-search', label: 'Wikipedia search' }))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.entry.id).toBe('wikipedia-search') // NOT 'wikipedia-search' by luck: 'Wikipedia search' slugs the same...
      expect(result.entry.label).toBe('Wikipedia search')
    }
    // ...so prove it on a label whose slug genuinely DIFFERS from the id — the real regression this guards.
    const decoupled = validateNewEntry([], 'tool', input({ id: 'weather', label: 'Weather (Open-Meteo)' }))
    expect(decoupled.ok).toBe(true)
    if (decoupled.ok) {
      expect(decoupled.entry.id, 'the registry id rides through untouched').toBe('weather')
      expect(decoupled.entry.label, 'the human label is preserved for display').toBe('Weather (Open-Meteo)')
    }
  })

  it('a blank/whitespace `id` falls back to the slug (fail-closed: never an empty entry id)', () => {
    for (const id of ['', '   ']) {
      const result = validateNewEntry([], 'tool', input({ id, label: 'Weather (Open-Meteo)' }))
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.entry.id).toBe('weather-open-meteo')
    }
  })

  it('an explicit id gets the SAME suffix dedup a slugged one does (never a silent shared id)', () => {
    const first = validateNewEntry([], 'tool', input({ id: 'weather', label: 'Weather (Open-Meteo)' }))
    expect(first.ok).toBe(true)
    if (!first.ok) return
    const second = validateNewEntry([first.entry], 'tool', input({ id: 'weather', label: 'Weather (Open-Meteo)' }))
    expect(second.ok, 'a second add is deduped, never rejected').toBe(true)
    if (second.ok) expect(second.entry.id).toBe('weather-2')
  })

  it('the label is still the ONE required field — an explicit id cannot smuggle in a nameless entry', () => {
    const result = validateNewEntry([], 'tool', input({ id: 'weather', label: '   ' }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('A name is required.')
  })
})

describe('validateNewEntry — rejectOnCollision (GH #564, ADR-0170 cl.8: the catalog kind\'s foreign-key id)', () => {
  const input = (over: Partial<NewEntryInput> & Pick<NewEntryInput, 'label'>): NewEntryInput => ({
    description: '',
    content: '',
    ...over,
  })

  it('a colliding id is REJECTED, not suffixed, when rejectOnCollision is true', () => {
    const first = validateNewEntry([], 'catalog', input({ id: 'agent-ui', label: 'Default (agent-ui)' }), { rejectOnCollision: true })
    expect(first.ok).toBe(true)
    if (!first.ok) return
    const second = validateNewEntry([first.entry], 'catalog', input({ id: 'agent-ui', label: 'Default (agent-ui)' }), {
      rejectOnCollision: true,
    })
    expect(second.ok, 'a re-add of the same registered catalog is refused outright').toBe(false)
    if (!second.ok) expect(second.error).toBe('Already in the list.')
  })

  it('a NON-colliding id still commits normally under rejectOnCollision (the flag guards the COLLISION branch only)', () => {
    const result = validateNewEntry([], 'catalog', input({ id: 'a2ui-org', label: 'A2UI.org' }), { rejectOnCollision: true })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.entry.id).toBe('a2ui-org')
  })

  it('SPEC-R1 AC2: the returned entry carries NO `availability` member — a new entry is in-context by ABSENCE', () => {
    const result = validateNewEntry([], 'skill', input({ label: 'House style' }))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    // The SHAPE assertion, not just a value one: `availability` must not appear as a key at all, so the
    // stored JSON of a freshly authored entry is byte-identical to the pre-#850 one.
    expect(Object.keys(result.entry).sort()).toEqual(['builtin', 'content', 'description', 'enabled', 'id', 'kind', 'label', 'order'])
    expect('availability' in result.entry).toBe(false)
    expect(entryAvailability(result.entry), 'and it still READS as in-context').toBe(ENTRY_AVAILABILITY.context)
  })

  it('BACKWARD COMPAT: rejectOnCollision absent/false ⇒ the suffix-dedup law is UNCHANGED (load-bearing for every hand-authored kind)', () => {
    const first = validateNewEntry([], 'skill', input({ label: 'Rules' }))
    expect(first.ok).toBe(true)
    if (!first.ok) return
    // absent
    const secondAbsent = validateNewEntry([first.entry], 'skill', input({ label: 'Rules' }))
    expect(secondAbsent.ok, 'two same-name prose entries legitimately coexist').toBe(true)
    if (secondAbsent.ok) expect(secondAbsent.entry.id).toBe('rules-2')
    // explicit false — same as absent
    const secondFalse = validateNewEntry([first.entry], 'skill', input({ label: 'Rules' }), { rejectOnCollision: false })
    expect(secondFalse.ok).toBe(true)
    if (secondFalse.ok) expect(secondFalse.entry.id).toBe('rules-2')
  })
})

// ── the AVAILABILITY mode (GH #850 / capability-availability-tagging.spec.md SPEC-R1) ────────────────────
// The core's own half of the contract: ONE optional member, a READ-TIME default of `'context'` (never a
// migration write), and the ONE ambient conjunct every projection filters on. The admin affordance is
// agent-admin.test.ts's; the four gated surfaces are entries.test.ts/agent-admin.test.ts's; the
// export/import leg is site/pages/agent-admin-persona-file.test.ts's (the module that owns that format).

describe('the availability mode — the read-time default (SPEC-R1)', () => {
  const entry = (over: Partial<Entry> = {}): Entry => ({
    id: 'menu-pdf',
    kind: 'resource',
    label: 'Menu PDF',
    description: '',
    content: 'the menu',
    order: 0,
    enabled: true,
    builtin: false,
    ...over,
  })

  it('ABSENT reads as in-context — the pre-#850 behaviour, unchanged', () => {
    expect(entryAvailability(entry())).toBe(ENTRY_AVAILABILITY.context)
    expect(entryAvailability(entry({ availability: 'context' })), 'and an explicit `context` reads the same').toBe(ENTRY_AVAILABILITY.context)
  })

  it("`'invocable'` reads verbatim — the one value that changes anything", () => {
    expect(entryAvailability(entry({ availability: 'invocable' }))).toBe(ENTRY_AVAILABILITY.invocable)
  })

  it('a GARBAGE value (a hand-edited persona file) degrades to in-context, never to invocable', () => {
    // Fail-soft in the direction of today's behaviour: a typo'd mode can only ever cost the user AMBIENCE
    // they already had, never silently dark a capability they still see listed as available.
    for (const bogus of ['invocble', 'Invocable', '', 'true', '1']) {
      expect(entryAvailability({ availability: bogus }), `"${bogus}" is not the invocable literal`).toBe(ENTRY_AVAILABILITY.context)
    }
  })

  it('`isAmbient` is the ONE conjunct — enabled AND in-context, orthogonal axes never collapsed', () => {
    expect(isAmbient(entry()), 'enabled + field-less ⇒ ambient').toBe(true)
    expect(isAmbient(entry({ availability: 'context' }))).toBe(true)
    expect(isAmbient(entry({ availability: 'invocable' })), 'enabled but invocable ⇒ NOT ambient').toBe(false)
    expect(isAmbient(entry({ enabled: false })), 'disabled ⇒ not ambient (unchanged)').toBe(false)
    // The orthogonality itself: a DISABLED-but-invocable entry is expressible and stays disabled — the
    // shape a tri-state `enabled` could not represent (SPEC §3's rejected shape).
    expect(isAmbient(entry({ enabled: false, availability: 'invocable' }))).toBe(false)
    expect(entryAvailability(entry({ enabled: false, availability: 'invocable' })), 'its mode survives being disabled').toBe(
      ENTRY_AVAILABILITY.invocable,
    )
  })
})

describe('the availability mode — a store write/read round trip (SPEC-R1 AC1)', () => {
  const KIND = 'resource'
  const base: Entry = {
    id: 'menu-pdf',
    kind: KIND,
    label: 'Menu PDF',
    description: 'The dinner menu.',
    content: 'Starters …',
    order: 0,
    enabled: true,
    builtin: false,
  }

  it('a FIELD-LESS entry round-trips with no `availability` key in the stored JSON, and reads as in-context', () => {
    const store = createMemoryStore()
    store.set(entriesStoreKey(KIND), [base])
    const read = readEntries(store, KIND)[0]!
    expect('availability' in read, 'the read-back entry carries no such key').toBe(false)
    expect(entryAvailability(read)).toBe(ENTRY_AVAILABILITY.context)
    // The BYTE assertion the migration clause needs: the persisted JSON is unchanged, key for key.
    expect(JSON.stringify(readEntries(store, KIND))).toBe(JSON.stringify([base]))
    expect(JSON.stringify(read)).not.toContain('availability')
  })

  it("a stored `'invocable'` survives the write/read cycle verbatim", () => {
    const store = createMemoryStore({ persistKey: 'entry-data-availability-test' })
    store.set(entriesStoreKey(KIND), [{ ...base, availability: ENTRY_AVAILABILITY.invocable }])
    // A SECOND store on the same persistKey is the real reload (a plain Map would pass by object identity).
    const reloaded = createMemoryStore({ persistKey: 'entry-data-availability-test' })
    const read = readEntries(reloaded, KIND)[0]!
    expect(read.availability).toBe(ENTRY_AVAILABILITY.invocable)
    expect(entryAvailability(read)).toBe(ENTRY_AVAILABILITY.invocable)
    expect(isAmbient(read)).toBe(false)
    localStorage.clear()
  })
})
