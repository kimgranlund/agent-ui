// verdicts.test.ts — LLD-C1 §3.2 (GH #1584), AC2: `parseGenuiVerdictsFile` batches issues; rejects
// `rubric ≠ 'genui-pack-idiom'`, marker mismatch, unknown keys, out-of-range dims,
// `passed ≠ (score >= 4)`; `mergeGenuiVerdictArchive` picks the latest date, returns conflicts on
// same-date disagreement, treats same-date identical as idempotent.

import { describe, it, expect } from 'vitest'
import { parseGenuiVerdictsFile, mergeGenuiVerdictArchive } from './verdicts.ts'
import type { GenuiVerdictsFile } from './verdicts.ts'

const VERSION = '1.0'

function fileJson(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    rubric: 'genui-pack-idiom',
    rubricVersion: VERSION,
    judgedBy: 'claude-sonnet-5',
    date: '2026-08-22',
    verdicts: {
      'data-viz-layouts--rev--r1': { qualityScore: 5, passed: true, dimensions: { D1: 5, D2: 5, D3: 5, D4: 5 } },
    },
    ...overrides,
  })
}

describe('parseGenuiVerdictsFile — the happy path', () => {
  it('parses a well-formed file', () => {
    const result = parseGenuiVerdictsFile(fileJson(), VERSION)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.file.rubric).toBe('genui-pack-idiom')
      expect(result.file.verdicts['data-viz-layouts--rev--r1']!.qualityScore).toBe(5)
    }
  })

  it('accepts a verdict with no dimensions (a critic seat may omit them)', () => {
    const json = JSON.stringify({
      rubric: 'genui-pack-idiom',
      rubricVersion: VERSION,
      judgedBy: 'a-critic-seat',
      date: '2026-08-22',
      verdicts: { x: { qualityScore: 2, passed: false, failingDimensions: ['D2'] } },
    })
    const result = parseGenuiVerdictsFile(json, VERSION)
    expect(result.ok).toBe(true)
  })

  it('accepts the optional model field', () => {
    const result = parseGenuiVerdictsFile(fileJson({ model: 'claude-sonnet-5' }), VERSION)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.file.model).toBe('claude-sonnet-5')
  })
})

describe('parseGenuiVerdictsFile — rejections, batched', () => {
  it('malformed JSON', () => {
    const result = parseGenuiVerdictsFile('{not json', VERSION)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issues[0]!.message).toMatch(/invalid JSON/)
  })

  it('rubric != "genui-pack-idiom"', () => {
    const result = parseGenuiVerdictsFile(fileJson({ rubric: 'a2ui-corpus' }), VERSION)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issues.some((i) => i.path === 'rubric')).toBe(true)
  })

  it('rubricVersion marker mismatch', () => {
    const result = parseGenuiVerdictsFile(fileJson({ rubricVersion: '0.9' }), VERSION)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issues.some((i) => i.path === 'rubricVersion')).toBe(true)
  })

  it('unknown top-level key', () => {
    const result = parseGenuiVerdictsFile(fileJson({ extra: true }), VERSION)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issues.some((i) => i.path === 'extra')).toBe(true)
  })

  it('unknown per-verdict key', () => {
    const json = fileJson({ verdicts: { x: { qualityScore: 5, passed: true, bogus: 1 } } })
    const result = parseGenuiVerdictsFile(json, VERSION)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issues.some((i) => i.path === 'verdicts.x.bogus')).toBe(true)
  })

  it('out-of-range dimension score (0 and 6 both reject)', () => {
    const json = fileJson({ verdicts: { x: { qualityScore: 5, passed: true, dimensions: { D1: 0, D2: 6, D3: 3, D4: 4 } } } })
    const result = parseGenuiVerdictsFile(json, VERSION)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.issues.some((i) => i.path === 'verdicts.x.dimensions.D1')).toBe(true)
      expect(result.issues.some((i) => i.path === 'verdicts.x.dimensions.D2')).toBe(true)
    }
  })

  it('passed does not equal (qualityScore >= 4)', () => {
    const json = fileJson({ verdicts: { x: { qualityScore: 5, passed: false } } })
    const result = parseGenuiVerdictsFile(json, VERSION)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issues.some((i) => i.path === 'verdicts.x.passed')).toBe(true)
  })

  it('qualityScore does not equal MIN(dimensions) when dimensions are present', () => {
    const json = fileJson({ verdicts: { x: { qualityScore: 5, passed: true, dimensions: { D1: 5, D2: 2, D3: 5, D4: 5 } } } })
    const result = parseGenuiVerdictsFile(json, VERSION)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issues.some((i) => i.path === 'verdicts.x.qualityScore')).toBe(true)
  })

  it('rationale over the 2000-char cap', () => {
    const json = fileJson({ verdicts: { x: { qualityScore: 5, passed: true, rationale: 'x'.repeat(2001) } } })
    const result = parseGenuiVerdictsFile(json, VERSION)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issues.some((i) => i.path === 'verdicts.x.rationale')).toBe(true)
  })

  it('empty judgedBy', () => {
    const result = parseGenuiVerdictsFile(fileJson({ judgedBy: '' }), VERSION)
    expect(result.ok).toBe(false)
  })

  it('batches every issue in one pass, never short-circuits', () => {
    const result = parseGenuiVerdictsFile(fileJson({ rubric: 'wrong', judgedBy: '', extra: 1 }), VERSION)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issues.length).toBeGreaterThanOrEqual(3)
  })
})

function verdictsFile(date: string, verdicts: GenuiVerdictsFile['verdicts']): GenuiVerdictsFile {
  return { rubric: 'genui-pack-idiom', rubricVersion: VERSION, judgedBy: 'claude-sonnet-5', date, verdicts }
}

describe('mergeGenuiVerdictArchive', () => {
  it('a single source merges straight through', () => {
    const result = mergeGenuiVerdictArchive([{ sourceFile: 'a.json', file: verdictsFile('2026-08-22', { x: { qualityScore: 5, passed: true } }) }])
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.archive.get('x')!.qualityScore).toBe(5)
  })

  it('latest date wins across two sources for the same name', () => {
    const older = { sourceFile: 'a.json', file: verdictsFile('2026-08-01', { x: { qualityScore: 2, passed: false } }) }
    const newer = { sourceFile: 'b.json', file: verdictsFile('2026-08-22', { x: { qualityScore: 5, passed: true } }) }
    const result = mergeGenuiVerdictArchive([older, newer])
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.archive.get('x')!.qualityScore).toBe(5)
      expect(result.archive.get('x')!.sourceFile).toBe('b.json')
    }
    // Order-independent — the SAME result regardless of input order.
    const reversed = mergeGenuiVerdictArchive([newer, older])
    expect(reversed.ok).toBe(true)
    if (reversed.ok) expect(reversed.archive.get('x')!.qualityScore).toBe(5)
  })

  it('same-date DISAGREEMENT is a conflict — nothing resolved silently', () => {
    const a = { sourceFile: 'a.json', file: verdictsFile('2026-08-22', { x: { qualityScore: 5, passed: true } }) }
    const b = { sourceFile: 'b.json', file: verdictsFile('2026-08-22', { x: { qualityScore: 2, passed: false } }) }
    const result = mergeGenuiVerdictArchive([a, b])
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.conflicts).toHaveLength(1)
      expect(result.conflicts[0]!.name).toBe('x')
      expect(result.conflicts[0]!.sourceFiles).toEqual(['a.json', 'b.json'])
    }
  })

  it('same-date IDENTICAL verdicts is idempotent — no conflict', () => {
    const a = { sourceFile: 'a.json', file: verdictsFile('2026-08-22', { x: { qualityScore: 5, passed: true } }) }
    const b = { sourceFile: 'b.json', file: verdictsFile('2026-08-22', { x: { qualityScore: 5, passed: true } }) }
    const result = mergeGenuiVerdictArchive([a, b])
    expect(result.ok).toBe(true)
  })

  it('an empty source list merges to an empty archive', () => {
    const result = mergeGenuiVerdictArchive([])
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.archive.size).toBe(0)
  })
})
