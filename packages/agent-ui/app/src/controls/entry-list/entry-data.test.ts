// entry-data.test.ts — the generic entry-data CORE's own gate (ADR-0164 cl.2 split off
// agent-admin/entries.test.ts, no assertion lost). `validateNewEntry`'s LLD-C7 widening (an OPTIONAL
// explicit `id` on `NewEntryInput`) is parameterized by a bare `kind: string` — this file uses plain kind
// literals rather than a domain `ENTRY_KINDS` constant, since the core module the function under test
// lives in knows nothing about any consumer's kind taxonomy. The load-bearing property is symmetrical: a
// caller that supplies no id slugs from the label exactly as before.

import { describe, it, expect } from 'vitest'
import { validateNewEntry, type NewEntryInput } from './entry-data.ts'

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
