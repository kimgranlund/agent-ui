// agent-admin-presets.test.ts — the shipped personas' own modality-neutrality gate (GH #419, guarding
// GH #412's fix). GH #412 rewrote all fourteen `surfaceStyle` texts to state INTENT, never DIALECT, and
// its recommendation (option 1) admitted the weakness: nothing stops a future author from reintroducing
// dialect — "relies on convention". This is that convention, mechanized, reading the SAME vocabulary the
// admin UI warns from (`@agent-ui/app`'s `lintSectionContent`, GH #419) so the two can never drift.
//
// It is also the lint's own FALSE-POSITIVE gate, which is the direction that matters: fourteen personas'
// worth of real authored prose must come back clean with every modality switched off. A lint that fires on
// correct text teaches an admin to ignore it, and then the real conflict lands unread.
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { DEFAULT_PROMPT_SECTIONS, ENTRY_KINDS } from '@agent-ui/app/agent-admin-entries'
import { entriesStoreKey, type Entry } from '@agent-ui/app/entry-data'
import { lintSectionContent } from '@agent-ui/app/agent-admin-prompt-lint'
import {
  ACTIVE_PRESET_KEY,
  AGENT_PRESETS,
  ROSTER_ORDER_KEY,
  deleteImportedPersona,
  loadImportedPersonas,
  loadRosterOrder,
  personaFromPreset,
  personaRoster,
  presetSeed,
  renameImportedPersona,
  saveImportedPersona,
  saveRosterOrder,
  type Persona,
} from './agent-admin-presets.ts'

/** The worst case for the lint: NO modality is on, so every term in the vocabulary is live. */
const ALL_OFF = { a2ui: false, genui: false }

describe('the shipped personas name no modality (GH #412’s rewrite, gated by GH #419’s vocabulary)', () => {
  it('all fourteen `surfaceStyle` texts are modality-neutral', () => {
    expect(AGENT_PRESETS).toHaveLength(14) // anti-vacuity: the loop below really covers the roster
    for (const preset of AGENT_PRESETS) {
      expect(lintSectionContent(preset.surfaceStyle, ALL_OFF), `${preset.id} surfaceStyle`).toBeUndefined()
    }
  })

  it('every persona’s Foundation rewrite is modality-neutral too', () => {
    for (const preset of AGENT_PRESETS) {
      expect(lintSectionContent(preset.foundation, ALL_OFF), `${preset.id} foundation`).toBeUndefined()
    }
  })

  it('the shipped builtin prompt sections are modality-neutral', () => {
    for (const section of DEFAULT_PROMPT_SECTIONS) {
      expect(lintSectionContent(section.content, ALL_OFF), section.id).toBeUndefined()
    }
  })

  it('the gate is discriminating — the pre-#412 Croupier text would FAIL it', () => {
    // The exact wording GH #412's inventory recorded as the worst case (its "before" column).
    const before =
      'Always play on ONE A2UI surface: create the table once (each playing card its own Card tile ' +
      'holding a rank+suit glyph Text), then UPDATE THAT SAME surface via the data model on every move.'
    expect(lintSectionContent(before, ALL_OFF)).toBeDefined()
  })

  it('every persona’s ASSEMBLED prompt-section list is clean — the shape the admin actually lints', () => {
    // presetSeed is what a persona store is built from; its prompt-section list is exactly what the admin
    // pane renders and `lintPromptSections` walks. Reading it here (rather than the raw fields above) is
    // what keeps a future seed that injects a NEW section from slipping past this gate.
    for (const preset of AGENT_PRESETS) {
      const sections = presetSeed(preset)[entriesStoreKey(ENTRY_KINDS.promptSection)] as Entry[]
      expect(sections.length, preset.id).toBeGreaterThan(0)
      for (const section of sections) {
        expect(lintSectionContent(section.content, ALL_OFF), `${preset.id} / ${section.id}`).toBeUndefined()
      }
    }
  })
})

// ── GH #845 (LLD-C11/C12/C13) — the roster-management persistence the Edit Agents drawer runs on ────────
// Order · delete · rename, all three proven against REAL localStorage (jsdom's) rather than a stub, because
// what each one is FOR is what survives a reload. The delete leg in particular ENUMERATES the key store
// afterwards instead of re-reading the keys it wrote — "no orphaned PERSIST_PREFIX state" is a claim about
// every key under the namespace, and a spot-check cannot make it.

const PREFIX = 'agent-admin-app'

/** Every localStorage key currently under one persona's namespace — the enumeration AC4 is written in. */
function keysUnder(id: string): string[] {
  return Object.keys(localStorage).filter((key) => key.startsWith(`${PREFIX}.${id}.`))
}

/** A library persona, shaped exactly as an import/mint/duplicate persists one. */
function customPersona(id: string, label: string): Persona {
  return { id, label, tagline: `${label} tagline`, seed: { name: label, temperature: 0.3 }, imported: true }
}

function clearAll(): void {
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(PREFIX)) localStorage.removeItem(key)
  }
}

describe('the persisted roster ORDER (GH #845, LLD-C11)', () => {
  beforeEach(clearAll)
  afterEach(clearAll)

  const ids = (): string[] => personaRoster().map((p) => p.id)
  const naturalIds = (): string[] => [...AGENT_PRESETS.map((p) => p.id), ...loadImportedPersonas().map((p) => p.id)]

  it('NO order record ⇒ today’s order, byte for byte (presets in declaration order, then imports in import order)', () => {
    saveImportedPersona(customPersona('alpha', 'Alpha'))
    saveImportedPersona(customPersona('beta', 'Beta'))
    expect(localStorage.getItem(ROSTER_ORDER_KEY), 'no order record has been written').toBeNull()
    expect(ids()).toEqual(naturalIds())
    expect(ids().slice(-2), 'imports keep import order').toEqual(['alpha', 'beta'])
  })

  it('a CORRUPT/foreign order record degrades to that same natural order — fail-closed, never a throw at boot', () => {
    saveImportedPersona(customPersona('alpha', 'Alpha'))
    for (const junk of ['{not json', '{"order":["alpha"]}', '[1,2,3]']) {
      localStorage.setItem(ROSTER_ORDER_KEY, junk)
      expect(loadRosterOrder().every((id) => typeof id === 'string'), junk).toBe(true)
      expect(ids(), junk).toEqual(naturalIds())
    }
  })

  it('a stored order reorders ACROSS the preset/imported boundary — the reason it is an id array, not a field on the library record', () => {
    saveImportedPersona(customPersona('alpha', 'Alpha'))
    const secondPreset = AGENT_PRESETS[1]!.id
    saveRosterOrder(['alpha', secondPreset])
    expect(ids().slice(0, 2), 'an imported persona can sit ABOVE a shipped preset').toEqual(['alpha', secondPreset])
  })

  it('ids the order names but the roster no longer has are SKIPPED (a ghost can never resurrect); unlisted entries append after the listed ones in natural order', () => {
    saveImportedPersona(customPersona('alpha', 'Alpha'))
    const first = AGENT_PRESETS[0]!.id
    saveRosterOrder(['ghost-that-was-deleted', 'alpha', 'ghost-2', first, 'alpha'])
    const order = ids()
    expect(order.slice(0, 2), 'the listed survivors, in stored order — the ghosts vanish').toEqual(['alpha', first])
    expect(order).not.toContain('ghost-that-was-deleted')
    expect(order, 'a repeated id is placed once, never duplicated').toHaveLength(AGENT_PRESETS.length + 1)
    expect(new Set(order).size).toBe(order.length)
    expect(order.slice(2), 'everything unlisted follows in the natural order').toEqual(AGENT_PRESETS.map((p) => p.id).filter((id) => id !== first))
  })
})

describe('deleteImportedPersona (GH #845, LLD-C12) — the records AND the keys, or nothing at all', () => {
  beforeEach(clearAll)
  afterEach(clearAll)

  it('sweeps EVERY key under the persona’s namespace (enumerated), drops the library record and the order slot, and returns true', () => {
    const persona = customPersona('doomed', 'Doomed')
    saveImportedPersona(persona)
    saveRosterOrder(['doomed', AGENT_PRESETS[0]!.id])
    // Real edits: the keys a user's own edits mint, plus the seedVersion marker that lives in the namespace.
    localStorage.setItem(`${PREFIX}.doomed.name`, '"Doomed"')
    localStorage.setItem(`${PREFIX}.doomed.entries:skill`, '[]')
    localStorage.setItem(`${PREFIX}.doomed.seedVersion`, '1')
    // A NEIGHBOUR whose id shares the stem — the sweep must be namespace-exact, never a bare startsWith(id).
    localStorage.setItem(`${PREFIX}.doomed-2.name`, '"Neighbour"')
    expect(keysUnder('doomed')).toHaveLength(3)

    expect(deleteImportedPersona(persona)).toBe(true)

    expect(keysUnder('doomed'), 'zero orphaned PERSIST_PREFIX state').toEqual([])
    expect(loadImportedPersonas().map((p) => p.id), 'the library record is gone').toEqual([])
    expect(loadRosterOrder(), 'the order array no longer names it').toEqual([AGENT_PRESETS[0]!.id])
    expect(personaRoster().some((p) => p.id === 'doomed'), 'and it is off the roster').toBe(false)
    expect(localStorage.getItem(`${PREFIX}.doomed-2.name`), 'a neighbouring persona is untouched').toBe('"Neighbour"')
  })

  it('NEGATIVE CONTROL — on a shipped preset it returns false and removes NOTHING (fail-closed, behind the structurally absent affordance)', () => {
    const preset = personaFromPreset(AGENT_PRESETS[0]!)
    localStorage.setItem(`${PREFIX}.${preset.id}.name`, '"edited"')
    saveImportedPersona(customPersona('alpha', 'Alpha'))
    saveRosterOrder([preset.id, 'alpha'])

    expect(deleteImportedPersona(preset)).toBe(false)

    expect(localStorage.getItem(`${PREFIX}.${preset.id}.name`), 'its edits survive').toBe('"edited"')
    expect(loadRosterOrder(), 'its order slot survives').toEqual([preset.id, 'alpha'])
    expect(personaRoster().some((p) => p.id === preset.id), 'and so does the preset itself').toBe(true)
  })

  it('deleting one custom persona leaves every OTHER persona’s records and keys intact', () => {
    saveImportedPersona(customPersona('keep', 'Keep'))
    saveImportedPersona(customPersona('drop', 'Drop'))
    localStorage.setItem(`${PREFIX}.keep.name`, '"Keep"')
    localStorage.setItem(`${PREFIX}.drop.name`, '"Drop"')
    localStorage.setItem(ACTIVE_PRESET_KEY, 'keep')

    deleteImportedPersona(customPersona('drop', 'Drop'))

    expect(keysUnder('keep')).toEqual([`${PREFIX}.keep.name`])
    expect(loadImportedPersonas().map((p) => p.id)).toEqual(['keep'])
    expect(localStorage.getItem(ACTIVE_PRESET_KEY), 'ACTIVE_PRESET_KEY is the page’s business, not this function’s').toBe('keep')
  })
})

describe('renameImportedPersona (GH #845, LLD-C13) — display-only, ids stable (the GH #848 law)', () => {
  beforeEach(clearAll)
  afterEach(clearAll)

  it('rewrites the label in the live library record — byte-identical seed, id unchanged, POSITION unchanged — and personaRoster() reflects it on the next read', () => {
    saveImportedPersona(customPersona('alpha', 'Alpha'))
    saveImportedPersona(customPersona('beta', 'Beta'))
    saveImportedPersona(customPersona('gamma', 'Gamma'))
    const before = loadImportedPersonas().find((p) => p.id === 'alpha')!

    expect(renameImportedPersona(before, 'Renamed Alpha')).toBe(true)

    const after = loadImportedPersonas().find((p) => p.id === 'alpha')!
    expect(after.label).toBe('Renamed Alpha')
    expect(after.id, 'the id is STABLE — every persisted store key hangs off it').toBe('alpha')
    expect(after.seed, 'the seed bytes are untouched — a rename can never lose an edit').toEqual(before.seed)
    expect(loadImportedPersonas().map((p) => p.id), 'and the record keeps its PLACE (a rename is not a reorder)').toEqual(['alpha', 'beta', 'gamma'])
    expect(personaRoster().find((p) => p.id === 'alpha')?.label, 'no reload semantics — the next read carries it').toBe('Renamed Alpha')
  })

  it('trims the label, and refuses a blank one / a preset / an id no record answers to — each false, each a no-op', () => {
    saveImportedPersona(customPersona('alpha', 'Alpha'))
    expect(renameImportedPersona(loadImportedPersonas()[0]!, '  Padded  ')).toBe(true)
    expect(loadImportedPersonas()[0]!.label).toBe('Padded')

    expect(renameImportedPersona(loadImportedPersonas()[0]!, '   '), 'blank').toBe(false)
    expect(renameImportedPersona(personaFromPreset(AGENT_PRESETS[0]!), 'Hijacked'), 'a shipped preset').toBe(false)
    expect(renameImportedPersona(customPersona('never-saved', 'Ghost'), 'Whatever'), 'no such record').toBe(false)

    expect(loadImportedPersonas().map((p) => p.label), 'nothing changed on any refusal').toEqual(['Padded'])
    expect(AGENT_PRESETS[0]!.label, 'the shipped preset data is a frozen constant, never rewritten').not.toBe('Hijacked')
  })
})
