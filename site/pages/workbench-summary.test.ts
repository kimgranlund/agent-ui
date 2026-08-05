// workbench-summary.test.ts — SPEC-R9's "committed, validator-passing A2UI JSONL" proof, checked BEFORE
// any browser test ever mounts a `ui-surface-host`. Mirrors `@agent-ui/a2ui/src/examples/examples.test.ts`'s
// own leg (a): `validateA2ui` against the real default catalog, 0 failures — the SAME shared validator the
// renderer and corpus admission both run (renderer LLD-C11), imported from the PUBLISHED `@agent-ui/a2ui`
// barrel (never a package-internal path — this file lives in `site/`, a consumer, not the package itself).
import { describe, it, expect } from 'vitest'
import { validateA2ui, defaultCatalog } from '@agent-ui/a2ui'
import { summaryMessages, summaryLines, summaryViewKey, type SummaryViewKey } from './workbench-summary.ts'

const KEYS: readonly SummaryViewKey[] = ['all', 'filtered']

describe('workbench-summary — the recorded agent-summary fixture (SPEC-R9)', () => {
  it('carries at least 2 recorded summaries keyed to distinct view states', () => {
    expect(KEYS.length).toBeGreaterThanOrEqual(2)
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

  it('summaryViewKey is binary and total: filter or search active ⇒ "filtered", neither ⇒ "all"', () => {
    expect(summaryViewKey({ filterActive: false, searchActive: false })).toBe('all')
    expect(summaryViewKey({ filterActive: true, searchActive: false })).toBe('filtered')
    expect(summaryViewKey({ filterActive: false, searchActive: true })).toBe('filtered')
    expect(summaryViewKey({ filterActive: true, searchActive: true })).toBe('filtered')
  })
})
