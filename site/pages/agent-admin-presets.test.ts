// agent-admin-presets.test.ts — the shipped personas' own modality-neutrality gate (GH #419, guarding
// GH #412's fix). GH #412 rewrote all fourteen `surfaceStyle` texts to state INTENT, never DIALECT, and
// its recommendation (option 1) admitted the weakness: nothing stops a future author from reintroducing
// dialect — "relies on convention". This is that convention, mechanized, reading the SAME vocabulary the
// admin UI warns from (`@agent-ui/app`'s `lintSectionContent`, GH #419) so the two can never drift.
//
// It is also the lint's own FALSE-POSITIVE gate, which is the direction that matters: fourteen personas'
// worth of real authored prose must come back clean with every modality switched off. A lint that fires on
// correct text teaches an admin to ignore it, and then the real conflict lands unread.
import { describe, it, expect, afterEach } from 'vitest'
import { DEFAULT_PROMPT_SECTIONS, ENTRY_KINDS, entriesStoreKey, lintSectionContent, type Entry } from '@agent-ui/app'
import {
  AGENT_PRESETS,
  IMPORTED_PERSONAS_KEY,
  ROSTER_ORDER_KEY,
  deleteImportedPersona,
  loadImportedPersonas,
  loadRosterOrder,
  personaRoster,
  personaStore,
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

// ── GH #845 (LLD-C11/C12/C13, §8a–c) — roster ORDER · DELETE · RENAME ────────────────────────────────
// The page-owned persistence half of the Edit Agents drawer, proven against REAL localStorage (jsdom's
// own): an order round trip that degrades byte-exactly when absent, a delete that leaves NOTHING behind
// (enumerated, never spot-checked), and a rename that survives a reload without touching the agent's own
// state. Each has a NEGATIVE control on the preset arm — the guard that must refuse is proven to refuse.

const PERSIST_PREFIX = 'agent-admin-app'

/** Every localStorage key currently under a persona's own namespace — the ENUMERATION AC4 asks for
 *  ("no orphaned PERSIST_PREFIX state"), never a lookup of the handful of keys a test happens to know. */
function keysUnder(id: string): string[] {
  const prefix = `${PERSIST_PREFIX}.${id}.`
  return Object.keys(localStorage).filter((key) => key.startsWith(prefix))
}

/** A library persona with REAL persisted edits — the state a delete has to actually sweep. */
function customPersonaWithEdits(id: string, label: string): Persona {
  const persona: Persona = { id, label, tagline: 'A test persona.', seed: { name: label, temperature: 0.3 }, imported: true }
  saveImportedPersona(persona)
  const store = personaStore(persona)
  store.set('name', `${label} (edited)`) // a real user edit, persisted under this persona's namespace
  store.set('temperature', 0.9)
  return persona
}

describe('GH #845 — the persisted roster ORDER (LLD-C11/§8a)', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('absent ⇒ today’s order, byte for byte: presets first (in AGENT_PRESETS order), then imports in import order', () => {
    const first = customPersonaWithEdits('zeta-imported', 'Zeta')
    const second = customPersonaWithEdits('alpha-imported', 'Alpha')
    expect(localStorage.getItem(ROSTER_ORDER_KEY), 'no order record exists yet').toBeNull()
    const ids = personaRoster().map((p) => p.id)
    expect(ids.slice(0, AGENT_PRESETS.length), 'the shipped presets lead, untouched').toEqual(AGENT_PRESETS.map((p) => p.id))
    expect(ids.slice(AGENT_PRESETS.length), 'then the library, in IMPORT order — never alphabetical').toEqual([first.id, second.id])
  })

  it('a corrupt or foreign record reads as NO order (fail-closed) rather than throwing at boot', () => {
    customPersonaWithEdits('x-imported', 'X')
    const natural = personaRoster().map((p) => p.id)
    for (const junk of ['not json at all', '{"not":"an array"}', '[1,2,3]']) {
      localStorage.setItem(ROSTER_ORDER_KEY, junk)
      expect(loadRosterOrder().every((id) => typeof id === 'string'), junk).toBe(true)
      expect(personaRoster().map((p) => p.id), `${junk} degrades to the natural order`).toEqual(natural)
    }
  })

  it('a stored order reorders ACROSS the preset/imported boundary — the reason it is an array, not a record field', () => {
    const mine = customPersonaWithEdits('mine-imported', 'Mine')
    const lastPreset = AGENT_PRESETS[AGENT_PRESETS.length - 1]!
    saveRosterOrder([mine.id, lastPreset.id])
    const ids = personaRoster().map((p) => p.id)
    expect(ids.slice(0, 2), 'an imported persona can sit ABOVE a shipped preset').toEqual([mine.id, lastPreset.id])
    expect(new Set(ids).size, 'every persona appears exactly once').toBe(ids.length)
    expect(ids.length, 'and none went missing').toBe(AGENT_PRESETS.length + 1)
  })

  it('a GHOST id (deleted elsewhere, or hand-corrupted) is skipped — it can never resurrect a row', () => {
    saveRosterOrder(['ghost-that-never-existed', AGENT_PRESETS[1]!.id])
    const ids = personaRoster().map((p) => p.id)
    expect(ids, 'the ghost contributes nothing').not.toContain('ghost-that-never-existed')
    expect(ids[0], 'the surviving listed id still leads').toBe(AGENT_PRESETS[1]!.id)
    expect(ids.length).toBe(AGENT_PRESETS.length)
  })

  it('an UNLISTED persona appends after the listed ones — a fresh mint/import lands at the end', () => {
    saveRosterOrder([AGENT_PRESETS[2]!.id])
    const minted = customPersonaWithEdits('fresh-imported', 'Fresh')
    const ids = personaRoster().map((p) => p.id)
    expect(ids[0]).toBe(AGENT_PRESETS[2]!.id)
    expect(ids[ids.length - 1], 'the newest record is last').toBe(minted.id)
  })

  it('saveRosterOrder/loadRosterOrder round-trip, and a duplicated id in the record never duplicates a row', () => {
    saveRosterOrder([AGENT_PRESETS[0]!.id, AGENT_PRESETS[0]!.id, AGENT_PRESETS[1]!.id])
    expect(loadRosterOrder()).toEqual([AGENT_PRESETS[0]!.id, AGENT_PRESETS[0]!.id, AGENT_PRESETS[1]!.id])
    const ids = personaRoster().map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids.length).toBe(AGENT_PRESETS.length)
  })
})

describe('GH #845 — deleteImportedPersona leaves NOTHING behind (LLD-C12/§8b, AC4)', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('a custom persona with edits: every namespaced key gone (ENUMERATED), the library record gone, the order array cleaned', () => {
    const persona = customPersonaWithEdits('doomed-imported', 'Doomed')
    saveRosterOrder([persona.id, AGENT_PRESETS[0]!.id])
    expect(keysUnder(persona.id).length, 'anti-vacuous: there IS persisted state to sweep').toBeGreaterThan(0)
    expect(loadImportedPersonas().map((p) => p.id)).toContain(persona.id)

    expect(deleteImportedPersona(persona), 'a library record deletes').toBe(true)

    expect(keysUnder(persona.id), 'zero orphaned PERSIST_PREFIX keys — enumerated, not spot-checked').toEqual([])
    expect(loadImportedPersonas().map((p) => p.id), 'the library record is gone').not.toContain(persona.id)
    expect(loadRosterOrder(), 'and the order array no longer names it').toEqual([AGENT_PRESETS[0]!.id])
    expect(personaRoster().map((p) => p.id), 'so the roster never offers it again').not.toContain(persona.id)
  })

  it('the seedVersion marker goes too — it lives INSIDE the persona namespace by design', () => {
    const persona = customPersonaWithEdits('marked-imported', 'Marked')
    localStorage.setItem(`${PERSIST_PREFIX}.${persona.id}.seedVersion`, '3')
    expect(keysUnder(persona.id)).toContain(`${PERSIST_PREFIX}.${persona.id}.seedVersion`)
    deleteImportedPersona(persona)
    expect(keysUnder(persona.id)).toEqual([])
  })

  it('NEGATIVE CONTROL: a shipped PRESET returns false and removes NOTHING (fail-closed, defense in depth)', () => {
    const preset = personaRoster()[0]!
    expect(preset.imported, 'a shipped preset carries no imported flag').not.toBe(true)
    const store = personaStore(preset)
    store.set('name', 'preset edit that must survive')
    const before = keysUnder(preset.id)
    expect(before.length, 'anti-vacuous: the preset really has persisted state').toBeGreaterThan(0)

    expect(deleteImportedPersona(preset), 'refused').toBe(false)
    expect(keysUnder(preset.id), 'nothing was swept').toEqual(before)
    expect(personaRoster().map((p) => p.id), 'and it is still on the roster').toContain(preset.id)
  })

  it('deleting one custom persona leaves a SIBLING custom persona’s keys and record completely untouched', () => {
    const doomed = customPersonaWithEdits('one-imported', 'One')
    const keeper = customPersonaWithEdits('two-imported', 'Two')
    const keeperKeys = keysUnder(keeper.id)
    deleteImportedPersona(doomed)
    expect(keysUnder(keeper.id), 'the prefix sweep is namespaced by the trailing dot, not a loose prefix').toEqual(keeperKeys)
    expect(loadImportedPersonas().map((p) => p.id)).toEqual([keeper.id])
  })
})

describe('GH #845 — renameImportedPersona (LLD-C13/§8c, AC6)', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('the label changes, the SEED is byte-identical, and personaRoster() reflects it on the next read (no reload semantics)', () => {
    const persona = customPersonaWithEdits('nameable-imported', 'Nameable')
    const seedBefore = JSON.stringify(loadImportedPersonas().find((p) => p.id === persona.id)!.seed)

    expect(renameImportedPersona(persona, '  Renamed Agent  '), 'commits (and trims)').toBe(true)

    const record = loadImportedPersonas().find((p) => p.id === persona.id)!
    expect(record.label).toBe('Renamed Agent')
    expect(JSON.stringify(record.seed), 'the persona’s own state is untouched — edits live under store keys').toBe(seedBefore)
    expect(record.imported, 'still a library record').toBe(true)
    expect(personaRoster().find((p) => p.id === persona.id)?.label, 'the roster reads the record, so it follows immediately').toBe('Renamed Agent')
    expect(keysUnder(persona.id).length, 'and no store key was touched').toBeGreaterThan(0)
  })

  it('rejects an empty/whitespace name, and NEGATIVE CONTROL: a shipped preset cannot be renamed', () => {
    const persona = customPersonaWithEdits('guarded-imported', 'Guarded')
    expect(renameImportedPersona(persona, '   ')).toBe(false)
    expect(loadImportedPersonas().find((p) => p.id === persona.id)?.label, 'unchanged').toBe('Guarded')

    const preset = personaRoster()[0]!
    expect(renameImportedPersona(preset, 'Hijacked')).toBe(false)
    expect(personaRoster()[0]!.label, 'the shipped preset keeps its own label').toBe(preset.label)
    expect(localStorage.getItem(IMPORTED_PERSONAS_KEY) ?? '', 'and no preset leaked into the library record').not.toContain(preset.id)
  })

  it('rewrites the LIVE record, never the caller’s possibly-stale object', () => {
    const persona = customPersonaWithEdits('stale-imported', 'Stale')
    // Something else (another tab, an earlier action) rewrote the record since the caller read it.
    saveImportedPersona({ ...persona, tagline: 'rewritten since the caller last looked' })
    renameImportedPersona({ ...persona, tagline: 'the caller’s stale copy' }, 'Fresh Name')
    const record = loadImportedPersonas().find((p) => p.id === persona.id)!
    expect(record.label).toBe('Fresh Name')
    expect(record.tagline, 'the LIVE record’s other fields survive — the stale copy never won').toBe('rewritten since the caller last looked')
  })
})
