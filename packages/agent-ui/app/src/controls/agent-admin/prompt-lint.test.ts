import { describe, it, expect } from 'vitest'
import { lintPromptSections, lintSectionContent, MODALITY_VOCABULARY } from './prompt-lint.ts'
import { ENTRY_KINDS } from './entries.ts'
import type { Entry } from '../entry-list/entry-data.ts'

// GH #419 — the vocabulary's own probes. The load-bearing half is NOT "it catches A2UI" (one substring
// match); it is that it stays SILENT on ordinary authored prose, because a lint that cries wolf on correct
// text trains the admin to ignore it — and then the real conflict lands unread.

const BOTH_OFF = { a2ui: false, genui: false }
const BOTH_ON = { a2ui: true, genui: true }

function section(content: string, over: Partial<Entry> = {}): Entry {
  return {
    id: 'surface-style',
    kind: ENTRY_KINDS.promptSection,
    label: 'Surface style',
    description: '',
    content,
    order: 0,
    enabled: true,
    builtin: false,
    ...over,
  }
}

describe('lintSectionContent — what it CATCHES', () => {
  it('names the modality and the term it found, for the modality name itself', () => {
    const warning = lintSectionContent('Always play on ONE A2UI surface.', { a2ui: false, genui: true })
    expect(warning).toContain('A2UI')
    expect(warning).toContain('is off')
  })

  it('catches the modality name case-insensitively (a2ui / GenUI / genui)', () => {
    expect(lintSectionContent('play on one a2ui surface', { a2ui: false, genui: true })).toBeDefined()
    expect(lintSectionContent('render a GenUI panel', { a2ui: true, genui: false })).toBeDefined()
    expect(lintSectionContent('the genui-surface frame', { a2ui: true, genui: false })).toBeDefined()
  })

  it('catches the WIRE vocabulary — envelope keys and the literal action payload shape (GH #412’s Admiral case)', () => {
    for (const text of [
      'emit createSurface once, then updateDataModel per move',
      'each cell carries action:{action:"cell", context:{row,col}}',
      'reuse the same surfaceId for the whole game',
      'never emit A2UI JSONL for table talk',
    ]) {
      expect(lintSectionContent(text, BOTH_OFF), text).toBeDefined()
    }
  })

  it('catches COMPOUND catalog type names', () => {
    expect(lintSectionContent('one RadioGroup per question, revealed by a Disclosure', BOTH_OFF)).toBeDefined()
    expect(lintSectionContent('the price history as a BarChart beside a TextField', BOTH_OFF)).toBeDefined()
  })

  it('reports BOTH disabled modalities in one message when a section names each', () => {
    const warning = lintSectionContent('an A2UI surface, or a GenUI frame', BOTH_OFF)
    expect(warning).toContain('A2UI')
    expect(warning).toContain('GenUI')
  })
})

describe('lintSectionContent — what it deliberately does NOT catch (false positives are the failure mode)', () => {
  it('stays silent when the modality it names is ON — the text and the toggle agree', () => {
    expect(lintSectionContent('Always play on ONE A2UI surface.', BOTH_ON)).toBeUndefined()
    expect(lintSectionContent('render a GenUI panel', BOTH_ON)).toBeUndefined()
  })

  it('never fires on a WORD that merely contains a term ("genuine", "ingenuity")', () => {
    expect(lintSectionContent('Answer with genuine warmth.', BOTH_OFF)).toBeUndefined()
    expect(lintSectionContent('Reward ingenuity over brute force.', BOTH_OFF)).toBeUndefined()
  })

  it('never fires on the single-word catalog types that are also plain English', () => {
    // Every one of these IS a shipped catalog component name — and every one is a word a persona may
    // legitimately write. They are deliberately absent from the vocabulary (see prompt-lint.ts's header).
    for (const text of [
      'Options → a side-by-side comparison card per route.',
      'Select the cheapest option and list the stops in order.',
      'Progress is shown alongside the running score.',
      'Text stays in chat; the table carries the state.',
      'Show every anchor color rendered for the eye, then each ramp step by step.',
      'A grid of clickable cells the player fires by selecting one.',
    ]) {
      expect(lintSectionContent(text, BOTH_OFF), text).toBeUndefined()
    }
  })
})

describe('lintPromptSections — which sections it looks at', () => {
  it('warns per ENABLED section, keyed by entry id', () => {
    const warnings = lintPromptSections(
      [section('one A2UI surface', { id: 'a' }), section('one persistent surface, updated in place', { id: 'b' })],
      BOTH_OFF,
    )
    expect([...warnings.keys()]).toEqual(['a'])
  })

  it('skips a DISABLED section — it composes nothing, so it can never contradict a toggle', () => {
    expect(lintPromptSections([section('one A2UI surface', { enabled: false })], BOTH_OFF).size).toBe(0)
  })

  it('returns an empty map when every modality is on', () => {
    expect(lintPromptSections([section('one A2UI surface, one GenUI frame')], BOTH_ON).size).toBe(0)
  })
})

describe('MODALITY_VOCABULARY — the list itself stays conservative', () => {
  it('covers both toggleable modalities', () => {
    expect(MODALITY_VOCABULARY.map((v) => v.surface)).toEqual(['a2ui', 'genui'])
  })

  it('carries no term that is a plain lowercase English word (the false-positive class)', () => {
    // Every term must be either a compound/camel identifier, an all-caps acronym, or carry punctuation —
    // never something like "card" or "list" that a sentence could contain innocently.
    for (const { terms } of MODALITY_VOCABULARY) {
      for (const term of terms) {
        const compoundOrAcronym = /[A-Z]/.test(term.slice(1)) || term === term.toUpperCase()
        expect(compoundOrAcronym || !/^[a-z]+$/.test(term), `"${term}" is too English to be a lint term`).toBe(true)
      }
    }
  })
})
