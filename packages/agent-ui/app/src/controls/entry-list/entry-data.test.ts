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
  renameEntry,
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

// ── GH #848 — renameEntry: the DISPLAY-NAME write, ids never rewritten ────────────────────────────────────
describe('renameEntry (GH #848)', () => {
  /** A pack-added tool whose id is a FOREIGN KEY into an external registry and whose label is human text
   *  (the `NewEntryInput.id` shape, LLD-C7) — the case a rename must not break, plus a plain hand-authored
   *  sibling to prove the rename never leaks sideways. */
  const seed = (): Entry[] => [
    { id: 'weather', kind: 'tool', label: 'Weather (Open-Meteo)', description: 'Current conditions.', content: 'Keyless.', order: 0, enabled: true, builtin: false },
    { id: 'rules', kind: 'tool', label: 'Rules', description: 'House rules.', content: 'Play fair.', order: 1, enabled: false, builtin: true },
  ]

  it('renames the named entry and NOTHING else — every other member, `id` above all, rides through untouched', () => {
    const before = seed()
    const after = renameEntry(before, 'weather', 'Local forecast')

    expect(after[0]).toEqual({ ...before[0]!, label: 'Local forecast' })
    expect(after[0]!.id, 'the foreign-key id is never rewritten by a rename').toBe('weather')
    expect(after[1], 'a sibling entry is byte-identical').toEqual(before[1])
    expect(before[0]!.label, 'the input list is never mutated').toBe('Weather (Open-Meteo)')
  })

  it('trims, and an empty/whitespace-only label is a fail-closed NO-OP (the "A name is required." law, rename side)', () => {
    expect(renameEntry(seed(), 'weather', '  Local forecast  ')[0]!.label).toBe('Local forecast')
    for (const blank of ['', '   ', '\n\t']) {
      expect(renameEntry(seed(), 'weather', blank), `"${blank}" changes nothing`).toEqual(seed())
    }
  })

  it('an id no entry carries changes nothing (and never appends a phantom row)', () => {
    expect(renameEntry(seed(), 'nope', 'Whatever')).toEqual(seed())
  })

  it('a builtin entry IS renamable — ADR-0132 Fork 4 protects DELETION, not configuration', () => {
    const after = renameEntry(seed(), 'rules', 'Table rules')
    expect(after[1]).toEqual({ ...seed()[1]!, label: 'Table rules' })
    expect(after[1]!.builtin, 'still builtin, still non-deletable').toBe(true)
  })

  it('a COLLIDING rename is allowed — labels may duplicate, ids stay unique (the validateNewEntry suffix law, other side)', () => {
    // The design ruling: `validateNewEntry` above already lets two entries share a label and separates them
    // by id ('rules' + 'rules-2'), so refusing the same collision on rename would be stricter than adding.
    const after = renameEntry(seed(), 'weather', 'Rules')
    expect(after.map((e) => e.label), 'two rows may legitimately read the same').toEqual(['Rules', 'Rules'])
    expect(new Set(after.map((e) => e.id)).size, 'ids are still unique — nothing resolving by id is confused').toBe(2)
  })

  it('EXPORT/IMPORT ROUND-TRIP: a renamed entry survives a JSON store cycle with its new label and its old id', () => {
    const renamed = renameEntry(seed(), 'weather', 'Local forecast')
    const roundTripped = JSON.parse(JSON.stringify(renamed)) as Entry[]
    expect(roundTripped, 'nothing about the entry is lost or coerced by serialization').toEqual(renamed)
    expect(roundTripped[0]!.label).toBe('Local forecast')
    expect(roundTripped[0]!.id).toBe('weather')
    // And a rename applied to the RE-IMPORTED list behaves identically (no hidden state rode along).
    expect(renameEntry(roundTripped, 'weather', 'Forecast')[0]!.label).toBe('Forecast')
  })

  // GH #850 reconciliation (SPEC-R1) — the two per-entry writes are ORTHOGONAL: a rename must carry the
  // availability mode through untouched, or a renamed user-invocable entry would silently go ambient again
  // (leaking exactly the bytes SPEC-R3 gates out). Asserted on both polarities, plus the field-less case.
  it('carries `availability` through untouched — a renamed invocable entry stays invocable, a field-less one stays field-less', () => {
    const invocable: Entry[] = [{ ...seed()[0]!, availability: ENTRY_AVAILABILITY.invocable }]
    const renamed = renameEntry(invocable, 'weather', 'Local forecast')
    expect(renamed[0]!.availability).toBe(ENTRY_AVAILABILITY.invocable)
    expect(entryAvailability(renamed[0]!)).toBe(ENTRY_AVAILABILITY.invocable)
    expect(isAmbient(renamed[0]!), 'still gated out of every ambient projection').toBe(false)

    // A field-less entry (every entry written before #850) must not GAIN the key from a rename — the
    // read-time-default law: no migration write, ever, so the stored JSON stays byte-compatible.
    const fieldLess = renameEntry(seed(), 'weather', 'Local forecast')
    expect('availability' in fieldLess[0]!, 'no key materialized by renaming').toBe(false)
    expect(entryAvailability(fieldLess[0]!)).toBe(ENTRY_AVAILABILITY.context)
    expect(JSON.parse(JSON.stringify(fieldLess[0]!))).toEqual({ ...seed()[0]!, label: 'Local forecast' })
  })
})
