// dashboard-summary.test.ts — SPEC-R9-shaped "committed, validator-passing A2UI JSONL" proof for the
// dashboard's recorded summary fixture (GH #499, M-F), mirroring workbench-summary.test.ts exactly: the
// SAME shared validator (`validateA2ui`) against the real default catalog, 0 failures, checked BEFORE any
// browser test ever mounts a `ui-surface-host`.
import { describe, it, expect } from 'vitest'
import { validateA2ui, defaultCatalog } from '@agent-ui/a2ui'
import { summaryMessages, summaryLines, summaryViewKey, type SummaryViewKey } from './dashboard-summary.ts'

const KEYS: readonly SummaryViewKey[] = ['all', 'urgent', 'high']

describe('dashboard-summary — the recorded agent-summary fixture (GH #499)', () => {
  it('carries at least 2 recorded summaries keyed to distinct view states (this page carries 3)', () => {
    expect(KEYS.length).toBeGreaterThanOrEqual(2)
    expect(KEYS.length).toBe(3)
    expect(new Set(KEYS).size).toBe(KEYS.length) // distinct keys, no duplicate
  })

  for (const key of KEYS) {
    it(`"${key}" validates 0-failure against the default catalog (validateA2ui)`, () => {
      const verdict = validateA2ui(summaryMessages(key), defaultCatalog)
      expect(verdict.failures, JSON.stringify(verdict.failures)).toEqual([])
      expect(verdict.valid).toBe(true)
    })

    it(`"${key}" — summaryLines() returns one JSON-parseable line per message, in order`, () => {
      const lines = summaryLines(key)
      const messages = summaryMessages(key)
      expect(lines).toHaveLength(messages.length)
      for (const [index, line] of lines.entries()) {
        expect(() => JSON.parse(line)).not.toThrow()
        expect(JSON.parse(line)).toEqual(messages[index])
      }
    })
  }

  it('summaryViewKey maps the segmented-control value directly, falling back to "all" for anything else', () => {
    expect(summaryViewKey('urgent')).toBe('urgent')
    expect(summaryViewKey('high')).toBe('high')
    expect(summaryViewKey('all')).toBe('all')
    expect(summaryViewKey(null)).toBe('all')
    expect(summaryViewKey('bogus')).toBe('all')
  })
})
