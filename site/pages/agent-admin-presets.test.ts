// agent-admin-presets.test.ts — the shipped personas' own modality-neutrality gate (GH #419, guarding
// GH #412's fix). GH #412 rewrote all fourteen `surfaceStyle` texts to state INTENT, never DIALECT, and
// its recommendation (option 1) admitted the weakness: nothing stops a future author from reintroducing
// dialect — "relies on convention". This is that convention, mechanized, reading the SAME vocabulary the
// admin UI warns from (`@agent-ui/app`'s `lintSectionContent`, GH #419) so the two can never drift.
//
// It is also the lint's own FALSE-POSITIVE gate, which is the direction that matters: fourteen personas'
// worth of real authored prose must come back clean with every modality switched off. A lint that fires on
// correct text teaches an admin to ignore it, and then the real conflict lands unread.
import { describe, it, expect } from 'vitest'
import { DEFAULT_PROMPT_SECTIONS, ENTRY_KINDS, entriesStoreKey, lintSectionContent, type Entry } from '@agent-ui/app'
import { AGENT_PRESETS, presetSeed } from './agent-admin-presets.ts'

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
